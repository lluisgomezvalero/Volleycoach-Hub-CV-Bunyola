import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

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
      .select('id, legacy_id, profile_id, club_id, team_id, dorsal, birth_date, position, status, private_data, active, avatar_path')
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

  const hydrate = useCallback(async (user) => {
    if (!user) {
      setIdentity(null);
      return null;
    }
    const nextIdentity = await loadIdentityForUser(user);
    if (alive.current) setIdentity(nextIdentity);
    return nextIdentity;
  }, []);

  useEffect(() => {
    alive.current = true;

    const bootstrap = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const nextSession = data?.session || null;
        if (!alive.current) return;
        setSession(nextSession);
        if (nextSession?.user) await hydrate(nextSession.user);
      } catch (error) {
        if (alive.current) {
          setAuthError(error?.message || 'No se pudo recuperar la sesión.');
          setIdentity(null);
        }
      } finally {
        if (alive.current) setLoading(false);
      }
    };

    bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive.current) return;
      setSession(nextSession || null);
      if (!nextSession?.user) {
        setIdentity(null);
        setAuthError('');
        setLoading(false);
        return;
      }

      window.setTimeout(() => {
        if (!alive.current) return;
        hydrate(nextSession.user).catch((error) => {
          if (alive.current) setAuthError(error?.message || 'No se pudo cargar el perfil.');
        });
      }, 0);
    });

    return () => {
      alive.current = false;
      subscription?.subscription?.unsubscribe?.();
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

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password
    });
    if (error || !data?.session?.user) throw new Error('Usuario o contraseña incorrectos.');

    setSession(data.session);
    const nextIdentity = await hydrate(data.session.user);

    void supabase
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.session.user.id);

    return nextIdentity;
  }, [hydrate]);

  const logout = useCallback(async () => {
    setIdentity(null);
    setSession(null);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

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
