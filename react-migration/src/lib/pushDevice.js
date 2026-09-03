import { supabase } from './supabase.js';

export async function getCurrentDevicePushSubscription() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const registrations = navigator.serviceWorker.getRegistrations
    ? await navigator.serviceWorker.getRegistrations()
    : [await navigator.serviceWorker.getRegistration()].filter(Boolean);

  for (const registration of registrations) {
    const subscription = await registration?.pushManager?.getSubscription?.();
    if (subscription) return subscription;
  }
  return null;
}

export async function detachCurrentDevicePushSubscription(profileId = null) {
  const subscription = await getCurrentDevicePushSubscription();
  if (!subscription) return false;

  const endpoint = subscription.endpoint;
  if (endpoint && profileId) {
    try {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('profile_id', profileId)
        .eq('endpoint', endpoint);
    } catch {
      // El unsubscribe local sigue siendo suficiente para que este móvil deje de recibir avisos.
    }
  }

  try { await subscription.unsubscribe(); } catch { /* endpoint local ya puede estar invalidado */ }
  window.dispatchEvent(new CustomEvent('volleycoach:push-device-changed'));
  return true;
}
