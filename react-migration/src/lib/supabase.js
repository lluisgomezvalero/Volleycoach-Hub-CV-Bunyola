import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://zpvlkdjdfnvamfcjihyt.supabase.co';
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_seL2H6gAGBrUDR0O1vhJDA_Y9d7Ky-u';
const projectRef = new URL(url).hostname.split('.')[0];
const isPreview = typeof window !== 'undefined' && window.location.pathname.includes('/react-preview/');
const storageKey = isPreview
  ? `volleycoach-${projectRef}-preview-auth-v1`
  : `volleycoach-${projectRef}-production-auth-v1`;

// La versión React usa su propio almacenamiento de sesión para que una pestaña/PWA antigua
// o la preview no pueda rotar el mismo refresh token y expulsar a otra sesión del dispositivo.
if (typeof window !== 'undefined' && !isPreview) {
  try {
    const legacyStorageKey = `sb-${projectRef}-auth-token`;
    const migrationMarker = `${storageKey}:legacy-migrated`;
    if (!window.localStorage.getItem(migrationMarker)) {
      if (!window.localStorage.getItem(storageKey)) {
        const legacySession = window.localStorage.getItem(legacyStorageKey);
        if (legacySession) window.localStorage.setItem(storageKey, legacySession);
      }
      window.localStorage.setItem(migrationMarker, '1');
    }
  } catch {
    // Safari en modo privado puede restringir localStorage; Supabase gestionará el fallback.
  }
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey
  }
});
