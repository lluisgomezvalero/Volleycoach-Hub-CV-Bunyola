import { useEffect, useState } from 'react';
import { BellOff, LoaderCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { detachCurrentDevicePushSubscription, getCurrentDevicePushSubscription } from '../lib/pushDevice.js';

export default function NotificationDeviceControl() {
  const { identity } = useAuth();
  const profileId = identity?.profile?.id || null;
  const role = identity?.profile?.role || '';
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkDevice() {
      try {
        const subscription = await getCurrentDevicePushSubscription();
        if (!active) return;

        // Entrenadores/administradores no reciben push actualmente. Si el navegador conserva
        // una suscripción de una jugadora usada antes en este móvil, la invalidamos localmente.
        if (subscription && role && role !== 'player') {
          await detachCurrentDevicePushSubscription(profileId);
          if (active) setEnabled(false);
          return;
        }
        if (active) setEnabled(Boolean(subscription));
      } catch {
        if (active) setEnabled(false);
      }
    }
    void checkDevice();
    return () => { active = false; };
  }, [profileId, role]);

  if (role !== 'player' || !enabled) return null;

  async function disableOnThisDevice() {
    if (busy) return;
    setBusy(true);
    try {
      await detachCurrentDevicePushSubscription(profileId);
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="drawer-push-control" type="button" onClick={() => void disableOnThisDevice()} disabled={busy}>
      {busy ? <LoaderCircle className="spin" size={17} /> : <BellOff size={17} />}
      {busy ? 'Desactivando…' : 'Desactivar avisos en este móvil'}
    </button>
  );
}
