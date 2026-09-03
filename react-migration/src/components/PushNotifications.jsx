import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, BellRing, Check, Smartphone } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import './PushNotifications.css';

const VAPID_PUBLIC_KEY = 'BFfrWc3f5F4rWqqKtGWaZWXnqussOA9Pg2oAbXObcU-t3PHHYznz0lKcvMK2qVD9KrOWBJ7UGBD4xZyz4YMO0aU';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
}

function subscriptionEndpoint(subscription) {
  const json = subscription?.toJSON?.() || {};
  return json.endpoint || subscription?.endpoint || '';
}

export default function PushNotifications() {
  const { session, identity } = useAuth();
  const authenticated = Boolean(session?.user?.id);
  const isPlayer = identity?.profile?.role === 'player';
  const playerId = identity?.player?.id || null;
  const profileId = identity?.profile?.id || null;
  const supported = useMemo(() => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window, []);
  const [status, setStatus] = useState('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pushRefreshKey, setPushRefreshKey] = useState(0);

  async function registrationForApp() {
    return navigator.serviceWorker.register(new URL('service-worker.js', document.baseURI).href);
  }

  async function subscriptionBelongsToCurrentPlayer(subscription) {
    if (!isPlayer || !profileId || !playerId || !subscription) return false;
    const endpoint = subscriptionEndpoint(subscription);
    if (!endpoint) return false;

    const { data, error: ownerError } = await supabase
      .from('push_subscriptions')
      .select('id, profile_id, player_id')
      .eq('endpoint', endpoint)
      .maybeSingle();
    if (ownerError) throw ownerError;
    return data?.profile_id === profileId && data?.player_id === playerId;
  }

  useEffect(() => {
    const refresh = () => setPushRefreshKey((value) => value + 1);
    window.addEventListener('volleycoach:push-device-changed', refresh);
    return () => window.removeEventListener('volleycoach:push-device-changed', refresh);
  }, []);

  async function saveSubscription(subscription) {
    if (!profileId || !playerId || !subscription) return;
    const json = subscription.toJSON();
    const endpoint = json.endpoint || subscription.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) throw new Error('La suscripción push no contiene todas las claves necesarias.');

    const { error: saveError } = await supabase.from('push_subscriptions').upsert({
      profile_id: profileId,
      player_id: playerId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'endpoint' });
    if (saveError) throw saveError;
  }

  useEffect(() => {
    let active = true;

    if (!authenticated) {
      setStatus('hidden');
      return () => { active = false; };
    }
    if (!supported) {
      setStatus(isPlayer ? 'unsupported' : 'hidden');
      return () => { active = false; };
    }
    if (isPlayer && isIos() && !isStandalone()) {
      setStatus('ios-install');
      return () => { active = false; };
    }

    async function check() {
      try {
        const registration = await registrationForApp();
        const existing = await registration.pushManager.getSubscription();
        if (!active) return;

        if (existing) {
          if (!isPlayer) {
            setStatus('foreign');
            return;
          }
          const own = await subscriptionBelongsToCurrentPlayer(existing);
          if (active) setStatus(own ? 'enabled' : 'foreign');
          return;
        }

        if (!isPlayer) {
          setStatus('hidden');
          return;
        }
        if (Notification.permission === 'denied') setStatus('denied');
        else setStatus('available');
      } catch (checkError) {
        if (active) {
          setError(checkError?.message || 'No se pudo preparar las notificaciones.');
          setStatus(isPlayer ? 'available' : 'hidden');
        }
      }
    }

    void check();
    return () => { active = false; };
  }, [authenticated, isPlayer, playerId, profileId, supported]);

  async function disableOnThisDevice() {
    if (busy || !supported) return;
    setBusy(true);
    setError('');
    try {
      const registration = await registrationForApp();
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        const endpoint = subscriptionEndpoint(existing);
        if (endpoint && isPlayer && profileId && playerId) {
          // RLS only allows deleting a subscription owned by the signed-in player.
          // If this device belongs to another account, unsubscribe locally; the
          // server removes the stale endpoint automatically after a failed push.
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', endpoint)
            .eq('profile_id', profileId)
            .eq('player_id', playerId);
        }
        await existing.unsubscribe();
      }
      setStatus(isPlayer && Notification.permission !== 'denied' ? 'available' : 'hidden');
    } catch (disableError) {
      setError(disableError?.message || 'No se pudieron desactivar los avisos de este móvil.');
    } finally {
      setBusy(false);
    }
  }

  async function enable() {
    if (busy || !supported || !isPlayer) return;
    setBusy(true);
    setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'available');
        return;
      }

      const registration = await registrationForApp();
      let subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const own = await subscriptionBelongsToCurrentPlayer(subscription);
        if (!own) {
          // A browser push subscription is device/scope specific. Never silently
          // transfer one account's endpoint to another account on the same phone.
          await subscription.unsubscribe();
          subscription = null;
        }
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }
      await saveSubscription(subscription);
      setStatus('enabled');
    } catch (enableError) {
      setError(enableError?.message || 'No se pudieron activar las notificaciones.');
      setStatus('available');
    } finally {
      setBusy(false);
    }
  }

  if (!authenticated || ['hidden', 'enabled', 'denied', 'unsupported', 'checking'].includes(status)) return null;

  if (status === 'ios-install') {
    return (
      <aside className="push-optin-card push-optin-ios">
        <span className="push-optin-icon"><Smartphone size={19} /></span>
        <div><strong>Activa las notificaciones</strong><p>En iPhone, añade primero VolleyCoach Hub a la pantalla de inicio. Después podrás recibir avisos de RPE y bienestar.</p></div>
      </aside>
    );
  }

  if (status === 'foreign') {
    return (
      <aside className="push-optin-card push-optin-warning">
        <span className="push-optin-icon"><BellOff size={19} /></span>
        <div className="push-optin-copy">
          <strong>{isPlayer ? 'Avisos de otra cuenta en este móvil' : 'Avisos de jugadora en este móvil'}</strong>
          <p>{isPlayer ? 'Este navegador conserva una suscripción de otra cuenta. Puedes sustituirla por la tuya.' : 'Este navegador conserva una suscripción de notificaciones de una jugadora aunque hayas cerrado su sesión.'}</p>
          {error ? <small>{error}</small> : null}
        </div>
        <button type="button" className={isPlayer ? '' : 'push-disable-button'} onClick={() => void (isPlayer ? enable() : disableOnThisDevice())} disabled={busy}>
          {busy ? <Bell size={16} /> : isPlayer ? <Check size={16} /> : <BellOff size={16} />}
          {busy ? 'Procesando…' : isPlayer ? 'Usar mi cuenta' : 'Desactivar'}
        </button>
      </aside>
    );
  }

  return (
    <aside className="push-optin-card">
      <span className="push-optin-icon"><BellRing size={19} /></span>
      <div className="push-optin-copy">
        <strong>Notificaciones del equipo</strong>
        <p>Te avisaremos si falta tu RPE y los lunes a las 15:00 si aún no has completado el bienestar obligatorio.</p>
        {error ? <small>{error}</small> : null}
      </div>
      <button type="button" onClick={() => void enable()} disabled={busy}>
        {busy ? <Bell size={16} /> : <Check size={16} />}{busy ? 'Activando…' : 'Activar'}
      </button>
    </aside>
  );
}
