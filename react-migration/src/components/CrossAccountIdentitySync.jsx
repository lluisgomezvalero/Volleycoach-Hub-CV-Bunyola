import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';

const REFRESH_COOLDOWN_MS = 700;

export default function CrossAccountIdentitySync() {
  const { identity, refreshIdentity } = useAuth();
  const lastRefreshRef = useRef(0);
  const profileId = identity?.profile?.id || '';
  const playerId = identity?.player?.id || '';
  const role = identity?.profile?.role || '';
  const isStaff = role === 'coach' || role === 'administrator';

  useEffect(() => {
    if (!profileId) return undefined;
    let active = true;

    async function refreshOwnIdentity(reason = 'remote') {
      const now = Date.now();
      if (now - lastRefreshRef.current < REFRESH_COOLDOWN_MS) return;
      lastRefreshRef.current = now;
      try {
        await refreshIdentity?.();
      } catch {
        // La sincronización es de mejora progresiva: la sesión actual sigue funcionando.
      }
      if (!active) return;
      window.dispatchEvent(new CustomEvent('volleycoach:player-directory-updated', {
        detail: { source: 'cross-account-sync', reason }
      }));
    }

    const onFocus = () => { void refreshOwnIdentity('focus'); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refreshOwnIdentity('visible');
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    const ownChannel = supabase
      .channel(`react-own-identity-${profileId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profileId}`
      }, () => { void refreshOwnIdentity('profile-update'); })
      .subscribe();

    let playerChannel = null;
    if (playerId) {
      playerChannel = supabase
        .channel(`react-own-player-${playerId}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'players', filter: `id=eq.${playerId}`
        }, () => { void refreshOwnIdentity('player-update'); })
        .subscribe();
    }

    let staffDirectoryChannel = null;
    if (isStaff) {
      staffDirectoryChannel = supabase
        .channel(`react-staff-directory-${profileId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, () => {
          window.dispatchEvent(new CustomEvent('volleycoach:player-directory-updated', {
            detail: { source: 'cross-account-sync', reason: 'player-directory-update' }
          }));
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
          window.dispatchEvent(new CustomEvent('volleycoach:player-directory-updated', {
            detail: { source: 'cross-account-sync', reason: 'profile-directory-update' }
          }));
        })
        .subscribe();
    }

    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      void supabase.removeChannel(ownChannel);
      if (playerChannel) void supabase.removeChannel(playerChannel);
      if (staffDirectoryChannel) void supabase.removeChannel(staffDirectoryChannel);
    };
  }, [isStaff, playerId, profileId, refreshIdentity]);

  return null;
}
