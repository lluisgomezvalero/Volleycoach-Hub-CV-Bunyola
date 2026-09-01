import { useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, Check, Smartphone } from 'lucide-react';
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

export default function PushNotifications() {
  const { identity } = useAuth();
  const isPlayer = identity?.profile?.role === 'player';
  const playerId = identity?.player?.id || null;
  const profileId = identity?.profile?.id || null;
  const supported = useMemo(() => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window, []);
  const [status, setStatus] = useState('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
    if (!isPlayer || !profileId || !playerId) {
      setStatus('hidden');
      return () => { active = false; };
    }
    if (!supported) {
      setStatus('unsupported');
      return () => { active = false; };
    }
    if (isIos() && !isStandalone()) {
      setStatus('ios-install');
      return () => { active = false; };
    }

    async function check() {
      try {
        const registration = await navigator.serviceWorker.register(new URL('service-worker.js', document.baseURI).href);
        const existing = await registration.pushManager.getSubscription();
        if (!active) return;
        if (existing) {
          await saveSubscription(existing);
          if (active) setStatus('enabled');
          return;
        }
        if (Notification.permission === 'denied') setStatus('denied');
        else setStatus('available');
      } catch (checkError) {
        if (active) {
          setError(checkError?.message || 'No se pudo preparar las notificaciones.');
          setStatus('available');
        }
      }
    }

    void check();
    return () => { active = false; };
  }, [isPlayer, playerId, profileId, supported]);

  async function enable() {
    if (busy || !supported) return;
    setBusy(true);
    setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'available');
        return;
      }
      const registration = await navigator.serviceWorker.register(new URL('service-worker.js', document.baseURI).href);
      let subscription = await registration.pushManager.getSubscription();
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

  if (!isPlayer || ['hidden', 'enabled', 'denied', 'unsupported', 'checking'].includes(status)) return null;

  if (status === 'ios-install') {
    return (
      <aside className="push-optin-card push-optin-ios">
        <span className="push-optin-icon"><Smartphone size={19} /></span>
        <div><strong>Activa avisos de RPE</strong><p>En iPhone, añade primero VolleyCoach Hub a la pantalla de inicio. Después podrás activar las notificaciones.</p></div>
      </aside>
    );
  }

  return (
    <aside className="push-optin-card">
      <span className="push-optin-icon"><BellRing size={19} /></span>
      <div className="push-optin-copy">
        <strong>Recordatorio de RPE</strong>
        <p>Te avisaremos 30 min después de terminar el entreno si aún no has respondido.</p>
        {error ? <small>{error}</small> : null}
      </div>
      <button type="button" onClick={() => void enable()} disabled={busy}>
        {busy ? <Bell size={16} /> : <Check size={16} />}{busy ? 'Activando…' : 'Activar'}
      </button>
    </aside>
  );
}
