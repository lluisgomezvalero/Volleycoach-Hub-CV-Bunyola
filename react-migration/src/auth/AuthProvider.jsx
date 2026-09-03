import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { detachCurrentDevicePushSubscription } from '../lib/pushDevice.js';

const AuthContext = createContext(null);

async function loadIdentityForUser(user) {
  if (!user?.id) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, club_id, username, full_name, role, avatar_path, active, last_login_at')
    .eq('id', user.id)
    .single();

  if (profileError) throw profileError;
  if (!profile?.active) throw new Error('Este usuario no está activo.');

  let player = null;
  let teams = [];

  if (profile.role === 'player') {
    const { data, error } = await supabase
      .from('players')
      .select('id, legacy_id, display_name, profile_id, club_id, team_id, dorsal, birth_date, position, status, private_data, active, avatar_path')
      .eq('profile_id', user.id)
      .maybeSingle();
    if (error) throw error;
    player = data || null;

    if (player?.team_id) {
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('id, club_id, season_id, name, category, active')
        .eq('id', player.team_id)
        .maybeSingle();
      if (teamError) throw teamError;
      if (team) teams = [team];
    }
  } else if (profile.role === 'coach') {
    const { data: staff, error: staffError } = await supabase
      .from('team_staff')
      .select('team_id')
      .eq('profile_id', user.id);
    if (staffError) throw staffError;

    const teamIds = [...new Set((staff || []).map((row) => row.team_id).filter(Boolean))];
    if (teamIds.length) {
      const { data, error } = await supabase
        .from('teams')
        .select('id, club_id, season_id, name, category, active')
        .in('id', teamIds)
        .eq('active', true)
        .order('name');
      if (error) throw error;
      teams = data || [];
    }
  } else if (profile.role === 'administrator' && profile.club_id) {
    const { data, error } = await supabase
      .from('teams')
      .select('id, club_id, season_id, name, category, active')
      .eq('club_id', profile.club_id)
      .eq('active', true)
      .order('name');
    if (error) throw error;
    teams = data || [];
  }

  let season = null;
  if (profile.club_id) {
    const { data, error } = await supabase
      .from('seasons')
      .select('id, club_id, name, starts_on, ends_on, is_active')
      .eq('club_id', profile.club_id)
      .eq('is_active', true)
      .maybeSingle();
    if (!error) season = data || null;
  }

  return { authUser: user, profile, player, teams, season };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const alive = useRef(true);
  const loginInFlight = useRef(false);

  const hydrate = useCallback(async (user) => {
    if (!user) {
      if (alive.current) setIdentity(null);
      return null;
    }
    const nextIdentity = await loadIdentityForUser(user);
    if (alive.current) {
      setIdentity(nextIdentity);
      setAuthError('');
    }
    return nextIdentity;
  }, []);

  useEffect(() => {
    alive.current = true;
    let authSubscription = null;
    let bootstrappedUserId = null;
    let cancelled = false;

    const handleAuthChange = (_event, nextSession) => {
      if (!alive.current || cancelled) return;
      if (_event === 'INITIAL_SESSION' && nextSession?.user?.id === bootstrappedUserId) return;
      if (_event === 'SIGNED_IN' && loginInFlight.current) return;

      setSession(nextSession || null);
      if (!nextSession?.user) {
        setIdentity(null);
        setAuthError('');
        setLoading(false);
        return;
      }

      setAuthError('');
      if (_event === 'TOKEN_REFRESHED') {
        setLoading(false);
        return;
      }

      setLoading(true);
      window.setTimeout(() => {
        if (!alive.current || cancelled) return;
        hydrate(nextSession.user)
          .catch((error) => {
            if (alive.current && !cancelled) {
              setIdentity(null);
              setAuthError(error?.message || 'No se pudo cargar el perfil.');
            }
          })
          .finally(() => {
            if (alive.current && !cancelled) setLoading(false);
          });
      }, 0);
    };

    const bootstrap = async () => {
      try {
        // Primero recuperamos la sesión y después registramos el listener. Evita dos caminos de
        // inicialización simultáneos, especialmente problemáticos en Safari/PWA.
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const nextSession = data?.session || null;
        if (!alive.current || cancelled) return;
        bootstrappedUserId = nextSession?.user?.id || null;
        setSession(nextSession);
        if (nextSession?.user) await hydrate(nextSession.user);
      } catch (error) {
        if (alive.current && !cancelled) {
          setAuthError(error?.message || 'No se pudo recuperar la sesión.');
          setIdentity(null);
          setSession(null);
        }
      }

      if (!alive.current || cancelled) return;
      const { data: subscription } = supabase.auth.onAuthStateChange(handleAuthChange);
      authSubscription = subscription?.subscription || null;
      setLoading(false);
    };

    void bootstrap();

    return () => {
      cancelled = true;
      alive.current = false;
      authSubscription?.unsubscribe?.();
    };
  }, [hydrate]);

  const login = useCallback(async (username, password) => {
    const cleanUsername = String(username || '').trim();
    if (!cleanUsername || !password) throw new Error('Introduce usuario y contraseña.');

    setAuthError('');
    const { data: authEmail, error: rpcError } = await supabase.rpc('get_auth_email_by_username', {
      p_username: cleanUsername
    });

    if (rpcError || !authEmail) throw new Error('Usuario o contraseña incorrectos.');

    loginInFlight.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password
      });
      if (error || !data?.session?.user) throw new Error('Usuario o contraseña incorrectos.');

      if (alive.current) {
        setLoading(true);
        setSession(data.session);
      }

      const nextIdentity = await hydrate(data.session.user);

      void supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', data.session.user.id);

      return nextIdentity;
    } finally {
      loginInFlight.current = false;
      if (alive.current) setLoading(false);
    }
  }, [hydrate]);

  const logout = useCallback(async () => {
    const currentProfileId = identity?.profile?.id || session?.user?.id || null;

    // Una suscripción push es del dispositivo, no de la pestaña. Al cerrar sesión la desligamos
    // antes de perder permisos RLS para que este móvil no siga recibiendo avisos de esa jugadora.
    try { await detachCurrentDevicePushSubscription(currentProfileId); } catch { /* best effort */ }

    setIdentity(null);
    setSession(null);
    setAuthError('');

    // Scope local: cerrar sesión en este móvil NO debe expulsar a la misma jugadora de su móvil.
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }, [identity?.profile?.id, session?.user?.id]);

  const refreshIdentity = useCallback(async () => {
    if (!session?.user) return null;
    return hydrate(session.user);
  }, [hydrate, session]);

  const value = useMemo(() => ({
    session,
    identity,
    loading,
    authError,
    login,
    logout,
    refreshIdentity
  }), [session, identity, loading, authError, login, logout, refreshIdentity]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return value;
}
