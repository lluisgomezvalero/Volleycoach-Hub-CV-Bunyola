(function () {
  'use strict';

  const config = window.VOLLEY_SUPABASE_CONFIG || {};
  let client = null;

  function initialize() {
    if (!config.enabled) return null;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      console.warn('[Supabase] La librería no está disponible.');
      return null;
    }
    if (!config.url || !config.publishableKey) {
      console.warn('[Supabase] Faltan URL o publishable key.');
      return null;
    }

    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return client;
  }

  function getClient() {
    return client || initialize();
  }

  async function healthcheck() {
    const supabaseClient = getClient();
    if (!supabaseClient) {
      return { ok: false, status: 'client-error', message: 'Cliente Supabase no disponible' };
    }

    try {
      const { data, error } = await supabaseClient.rpc('volleycoach_healthcheck');
      if (error) {
        return {
          ok: false,
          status: error.code === 'PGRST202' ? 'schema-missing' : 'database-error',
          message: error.code === 'PGRST202'
            ? 'Conexión correcta; falta ejecutar el esquema SQL'
            : error.message,
          error
        };
      }
      return { ok: true, status: 'ready', message: String(data || 'Supabase conectado') };
    } catch (error) {
      return { ok: false, status: 'network-error', message: 'No se pudo conectar con Supabase', error };
    }
  }

  function usernameToEmail(username) {
    const clean = String(username || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '');

    return `${clean}@${config.usernameDomain || 'cvbunyola.app'}`;
  }

  async function signInWithUsername(username, password) {
    const supabaseClient = getClient();
    if (!supabaseClient) throw new Error('Supabase no está inicializado.');

    const cleanUsername = String(username || '').trim();
    if (!cleanUsername || !password) {
      return { data: null, error: new Error('Usuario o contraseña incorrectos.') };
    }

    // 1. Intentar autenticar mediante la Edge Function login-by-username si está desplegada
    try {
      const { data: edgeData, error: edgeError } = await supabaseClient.functions.invoke('login-by-username', {
        body: { username: cleanUsername, password }
      });

      if (!edgeError && edgeData?.session) {
        const { data: setSessionData, error: setSessionError } = await supabaseClient.auth.setSession(edgeData.session);
        if (!setSessionError && setSessionData?.session) {
          return { data: setSessionData, error: null };
        }
      }
    } catch (edgeEx) {
      console.warn('[Supabase Auth] Edge function login-by-username no disponible, usando RPC de seguridad:', edgeEx);
    }

    // 2. Método RPC get_auth_email_by_username (SECURITY DEFINER)
    // Busca exclusivamente en public.profiles WHERE lower(username) = lower(cleanUsername) AND active = true
    let authEmail = null;
    try {
      const { data: rpcEmail, error: rpcError } = await supabaseClient.rpc('get_auth_email_by_username', {
        p_username: cleanUsername
      });

      if (!rpcError && rpcEmail) {
        authEmail = rpcEmail;
      }
    } catch (rpcEx) {
      console.warn('[Supabase Auth] Excepción en RPC get_auth_email_by_username:', rpcEx);
    }

    if (!authEmail) {
      return {
        data: null,
        error: new Error('Usuario o contraseña incorrectos.')
      };
    }

    // 3. Iniciar sesión mediante Supabase Auth con el email real obtenido de profiles.username
    const authResult = await supabaseClient.auth.signInWithPassword({
      email: authEmail,
      password: password
    });

    if (authResult.error) {
      return {
        data: null,
        error: new Error('Usuario o contraseña incorrectos.')
      };
    }

    return authResult;
  }

  async function signOut() {
    const supabaseClient = getClient();
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
  }

  async function getSession() {
    const supabaseClient = getClient();
    if (!supabaseClient) return { data: { session: null }, error: new Error('Supabase no inicializado') };
    return supabaseClient.auth.getSession();
  }

  async function getProfile() {
    const supabaseClient = getClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase no inicializado') };
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData?.user) return { data: null, error: authError || new Error('No hay una sesión activa') };
    return supabaseClient
      .from('profiles')
      .select('id, club_id, username, full_name, role, avatar_path, active, last_login_at')
      .eq('id', authData.user.id)
      .single();
  }

  async function getIdentity() {
    const supabaseClient = getClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase no inicializado') };
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData?.user) return { data: null, error: authError || new Error('No hay una sesión activa') };

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, club_id, username, full_name, role, avatar_path, active, last_login_at')
      .eq('id', authData.user.id)
      .single();
    if (profileError) return { data: null, error: profileError };

    let player = null;
    let teams = [];

    if (profile.role === 'player') {
      const playerResult = await supabaseClient
        .from('players')
        .select('id, legacy_id, club_id, team_id, dorsal, birth_date, position, status, private_data, active, teams:team_id(id, name, category, active)')
        .eq('profile_id', authData.user.id)
        .maybeSingle();
      if (playerResult.error) return { data: null, error: playerResult.error };
      player = playerResult.data || null;
      if (player?.teams) teams = [player.teams];
    } else if (profile.role === 'coach') {
      const staffResult = await supabaseClient
        .from('team_staff')
        .select('teams:team_id(id, name, category, active)')
        .eq('profile_id', authData.user.id);
      if (staffResult.error) return { data: null, error: staffResult.error };
      teams = (staffResult.data || []).map(row => row.teams).filter(Boolean);
    } else if (profile.role === 'administrator' && profile.club_id) {
      const teamsResult = await supabaseClient
        .from('teams')
        .select('id, name, category, active')
        .eq('club_id', profile.club_id)
        .eq('active', true)
        .order('name');
      if (teamsResult.error) return { data: null, error: teamsResult.error };
      teams = teamsResult.data || [];
    }

    return { data: { authUser: authData.user, profile, player, teams }, error: null };
  }

  async function updateOwnProfile(changes) {
    const supabaseClient = getClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase no inicializado') };
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData?.user) return { data: null, error: authError || new Error('No hay una sesión activa') };

    const allowed = {};
    if (typeof changes?.full_name === 'string') allowed.full_name = changes.full_name.trim();
    if (typeof changes?.avatar_path === 'string' || changes?.avatar_path === null) allowed.avatar_path = changes.avatar_path;
    if (!Object.keys(allowed).length) return { data: null, error: new Error('No hay cambios válidos') };

    return supabaseClient
      .from('profiles')
      .update(allowed)
      .eq('id', authData.user.id)
      .select('id, club_id, username, full_name, role, avatar_path, active, last_login_at')
      .single();
  }

  async function updateOwnPlayer(changes) {
    const supabaseClient = getClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase no inicializado') };
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData?.user) return { data: null, error: authError || new Error('No hay una sesión activa') };

    const allowed = {};
    if (Number.isInteger(Number(changes?.dorsal))) allowed.dorsal = Number(changes.dorsal);
    if (typeof changes?.birth_date === 'string' || changes?.birth_date === null) allowed.birth_date = changes.birth_date || null;
    if (typeof changes?.position === 'string') allowed.position = changes.position.trim();
    if (!Object.keys(allowed).length) return { data: null, error: new Error('No hay cambios válidos') };

    return supabaseClient
      .from('players')
      .update(allowed)
      .eq('profile_id', authData.user.id)
      .select('id, legacy_id, team_id, dorsal, birth_date, position, status, active')
      .single();
  }

  async function touchLastLogin() {
    const supabaseClient = getClient();
    if (!supabaseClient) return;
    const { data } = await supabaseClient.auth.getUser();
    if (!data?.user) return;
    await supabaseClient
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id);
  }

  async function updatePassword(newPassword) {
    const supabaseClient = getClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase no inicializado') };
    return supabaseClient.auth.updateUser({ password: newPassword });
  }

  function paintConnectionStatus(result) {
    const el = document.getElementById('supabase-connection-status');
    if (!el) return;
    el.dataset.state = result.ok ? 'ready' : result.status;
    el.innerHTML = `<span class="supabase-status-dot" aria-hidden="true"></span><span>${escapeHtml(result.message)}</span>`;
    el.title = result.ok
      ? 'El proyecto Supabase y el esquema están disponibles.'
      : 'Consulta SUPABASE_PASO_1.md para completar la configuración.';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function initializeStatus() {
    const result = await healthcheck();
    paintConnectionStatus(result);
    window.dispatchEvent(new CustomEvent('volley:supabase-status', { detail: result }));
    return result;
  }

  // ==========================================
  // EVENTOS / CALENDARIO / ENTRENAMIENTOS (BLOQUE C)
  // ==========================================

  function supabaseToFrontendEvent(row) {
    if (!row) return null;
    const payload = row.payload || {};
    const typeMap = {
      training: 'Entrenamiento',
      match: 'Partido',
      friendly: 'Amistoso',
      tournament: 'Torneo',
      birthday: 'Cumpleaños',
      other: 'Otro'
    };
    
    let dateStr = '';
    let timeStr = payload.time || '';
    if (row.starts_at) {
      const dt = new Date(row.starts_at);
      if (!isNaN(dt.getTime())) {
        const year = dt.getFullYear();
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
        if (!timeStr) {
          const hh = String(dt.getHours()).padStart(2, '0');
          const mm = String(dt.getMinutes()).padStart(2, '0');
          timeStr = `${hh}:${mm}`;
        }
      }
    }

    return {
      id: row.id,
      legacyId: row.legacy_id || null,
      clubId: row.club_id,
      teamId: row.team_id || null,
      type: payload.type || typeMap[row.event_type] || 'Entrenamiento',
      title: row.title || '',
      date: dateStr || payload.date || '',
      time: timeStr || '18:00',
      location: row.location || payload.location || '',
      status: row.status || payload.status || 'Próximo',
      description: payload.description || '',
      plan: payload.plan || '',
      opponent: payload.opponent || '',
      coachRPE: payload.coachRPE !== undefined ? payload.coachRPE : null,
      sessionImage: payload.sessionImage || null,
      round: payload.round || null,
      result: payload.result || null,
      stats: payload.stats || null,
      starts_at: row.starts_at || null,
      startsAt: row.starts_at || null,
      ends_at: row.ends_at || null,
      endsAt: row.ends_at || null,
      duration: (Number.isFinite(Number(payload.duration)) && Number(payload.duration) > 0)
        ? Number(payload.duration)
        : (row.starts_at && row.ends_at ? Math.max(0, Math.round((new Date(row.ends_at) - new Date(row.starts_at)) / 60000)) : null),
      durationMinutes: (Number.isFinite(Number(payload.duration)) && Number(payload.duration) > 0)
        ? Number(payload.duration)
        : (row.starts_at && row.ends_at ? Math.max(0, Math.round((new Date(row.ends_at) - new Date(row.starts_at)) / 60000)) : null),
      rawPayload: payload
    };
  }

  function frontendToSupabaseEvent(evt, clubId, teamId, userId) {
    const reverseTypeMap = {
      'Entrenamiento': 'training',
      'Partido': 'match',
      'Amistoso': 'friendly',
      'Torneo': 'tournament',
      'Cumpleaños': 'birthday'
    };

    const eventType = reverseTypeMap[evt.type] || 'other';
    let startsAtISO = null;
    if (evt.date) {
      const timePart = (evt.time && evt.time.includes(':')) ? evt.time.split(' ')[0] : '18:00';
      startsAtISO = new Date(`${evt.date}T${timePart}:00`).toISOString();
    }

    const payload = {
      type: evt.type,
      time: evt.time || '18:00',
      description: evt.description || '',
      plan: evt.plan || '',
      opponent: evt.opponent || '',
      coachRPE: evt.coachRPE !== undefined ? evt.coachRPE : null,
      sessionImage: evt.sessionImage || null,
      round: evt.round || null,
      result: evt.result || null,
      stats: evt.stats || null,
      status: evt.status || 'Próximo'
    };

    const record = {
      club_id: clubId,
      team_id: evt.teamId || teamId || null,
      event_type: eventType,
      title: evt.title,
      starts_at: startsAtISO || new Date().toISOString(),
      location: evt.location || '',
      status: evt.status || 'Próximo',
      payload: payload
    };

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (evt.id && uuidRegex.test(evt.id)) {
      record.id = evt.id;
    } else if (evt.id) {
      record.legacy_id = String(evt.id);
    }

    if (userId) record.created_by = userId;
    return record;
  }

  async function fetchEvents(clubId, teamId) {
    const supabaseClient = getClient();
    if (!supabaseClient) return { data: [], error: new Error('Supabase no inicializado') };

    let query = supabaseClient
      .from('events')
      .select('*')
      .order('starts_at', { ascending: true });

    if (clubId) query = query.eq('club_id', clubId);

    const { data, error } = await query;
    if (error) return { data: [], error };

    const mapped = (data || []).map(supabaseToFrontendEvent).filter(Boolean);
    return { data: mapped, error: null };
  }

  async function saveEvent(evt, clubId, teamId, userId) {
    const supabaseClient = getClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase no inicializado') };

    const record = frontendToSupabaseEvent(evt, clubId, teamId, userId);
    
    let result;
    if (record.id) {
      result = await supabaseClient
        .from('events')
        .update(record)
        .eq('id', record.id)
        .select('*')
        .single();
    } else {
      result = await supabaseClient
        .from('events')
        .insert(record)
        .select('*')
        .single();
    }

    if (result.error) return { data: null, error: result.error };
    return { data: supabaseToFrontendEvent(result.data), error: null };
  }

  async function deleteEvent(eventId) {
    const supabaseClient = getClient();
    if (!supabaseClient) return { error: new Error('Supabase no inicializado') };

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let query = supabaseClient.from('events').delete();
    if (uuidRegex.test(eventId)) {
      query = query.eq('id', eventId);
    } else {
      query = query.eq('legacy_id', eventId);
    }

    const { error } = await query;
    return { error };
  }

  let eventsChannel = null;

  function subscribeEventsRealtime(clubId, onDataChange) {
    const supabaseClient = getClient();
    if (!supabaseClient || !clubId) return null;

    if (eventsChannel) {
      try { supabaseClient.removeChannel(eventsChannel); } catch(e){}
      eventsChannel = null;
    }

    eventsChannel = supabaseClient
      .channel('public:events:' + clubId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `club_id=eq.${clubId}`
        },
        (payload) => {
          if (typeof onDataChange === 'function') {
            onDataChange(payload);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Supabase Realtime] Eventos suscritos correctamente.');
        }
      });

    return eventsChannel;
  }

  // ==========================================
  // ASISTENCIA (BLOQUE D)
  // ==========================================

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  async function resolvePlayerUUID(supabaseClient, playerId) {
    if (!playerId) return null;
    if (uuidRegex.test(playerId)) return playerId;

    const pid = String(playerId).trim();
    try {
      const { data: legacyData } = await supabaseClient
        .from('players')
        .select('id')
        .eq('legacy_id', pid)
        .maybeSingle();

      if (legacyData?.id) return legacyData.id;

      const { data: profileData } = await supabaseClient
        .from('players')
        .select('id')
        .eq('profile_id', pid)
        .maybeSingle();

      if (profileData?.id) return profileData.id;

      const { data: authUser } = await supabaseClient.auth.getUser();
      if (authUser?.user?.id) {
        const { data: ownPlayer } = await supabaseClient
          .from('players')
          .select('id')
          .eq('profile_id', authUser.user.id)
          .maybeSingle();

        if (ownPlayer?.id) return ownPlayer.id;
      }

      // Auto-creación en public.players si la jugadora aún no tiene UUID en Supabase
      const localPlayer = (typeof window.appState !== 'undefined' && Array.isArray(window.appState.players))
        ? window.appState.players.find(p => String(p.id) === pid || String(p.legacy_id) === pid)
        : null;

      const defaultClub = config.clubId || 'b0000000-0000-4000-8000-000000000001';
      const { data: newPlayer } = await supabaseClient
        .from('players')
        .insert({
          legacy_id: pid,
          profile_id: (localPlayer?.profile_id || localPlayer?.authId || (uuidRegex.test(pid) ? pid : null)),
          club_id: defaultClub,
          active: true
        })
        .select('id')
        .single();

      if (newPlayer?.id) return newPlayer.id;
    } catch (e) {
      console.warn('[Supabase Attendance] Error al resolver o crear UUID de jugadora:', e);
    }
    return null;
  }

  async function resolveEventUUID(supabaseClient, eventId) {
    if (!eventId) return null;
    if (uuidRegex.test(eventId)) return eventId;

    const eid = String(eventId).trim();
    try {
      const { data } = await supabaseClient
        .from('events')
        .select('id')
        .eq('legacy_id', eid)
        .maybeSingle();

      if (data?.id) return data.id;

      // Buscar si el evento existe localmente en appState para copiar sus datos reales
      const localEvt = (typeof window.appState !== 'undefined' && Array.isArray(window.appState.events))
        ? window.appState.events.find(e => String(e.id) === eid || String(e.legacy_id) === eid || String(e.legacyId) === eid)
        : null;

      const defaultClub = config.clubId || 'b0000000-0000-4000-8000-000000000001';
      const eventTitle = localEvt?.title || localEvt?.name || 'Entrenamiento Sincronizado';
      const startsAt = (localEvt?.date && localEvt?.time)
        ? new Date(`${localEvt.date}T${localEvt.time}:00`).toISOString()
        : (localEvt?.date ? new Date(`${localEvt.date}T12:00:00`).toISOString() : new Date().toISOString());

      const { data: newEvt } = await supabaseClient
        .from('events')
        .insert({
          legacy_id: eid,
          club_id: defaultClub,
          event_type: (localEvt?.type === 'Partido' ? 'match' : 'training'),
          title: eventTitle,
          starts_at: startsAt
        })
        .select('id')
        .single();

      if (newEvt?.id) return newEvt.id;
    } catch (e) {
      console.warn('[Supabase Events] Error al resolver o crear UUID de evento:', e);
    }
    return null;
  }

  async function fetchAttendance(clubId) {
    const supabaseClient = getClient();
    if (!supabaseClient) return { data: [], error: new Error('Supabase no inicializado') };

    const { data, error } = await supabaseClient
      .from('attendance')
      .select('*, events(id, legacy_id), players(id, legacy_id, profile_id)');

    if (error) {
      const fallback = await supabaseClient.from('attendance').select('*');
      return { data: fallback.data || [], error: fallback.error };
    }
    return { data: data || [], error: null };
  }

  async function savePlayerAttendanceResponse(eventId, playerId, response) {
    const supabaseClient = getClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase no inicializado') };

    const realEventId = await resolveEventUUID(supabaseClient, eventId);
    const realPlayerId = await resolvePlayerUUID(supabaseClient, playerId);

    if (!realEventId) {
      return { data: null, error: new Error(`El entrenamiento ("${eventId}") no existe en Supabase como UUID. Guarde o sincronice el evento primero.`) };
    }
    if (!realPlayerId) {
      return { data: null, error: new Error(`La jugadora ("${playerId}") no tiene un UUID asignado en Supabase.`) };
    }

    const payload = {
      event_id: realEventId,
      player_id: realPlayerId,
      player_response: response
    };

    const { data, error } = await supabaseClient
      .from('attendance')
      .upsert(payload, { onConflict: 'event_id,player_id' })
      .select('*')
      .single();

    if (error) return { data: null, error };
    return { data, error: null };
  }

  async function validateOfficialAttendance(eventId, playerStatusList, coachProfileId) {
    const supabaseClient = getClient();
    if (!supabaseClient) return { data: null, error: new Error('Supabase no inicializado') };

    const realEventId = await resolveEventUUID(supabaseClient, eventId);
    if (!realEventId) {
      return { data: null, error: new Error(`El entrenamiento ("${eventId}") no está registrado en Supabase como UUID.`) };
    }

    const nowISO = new Date().toISOString();
    const rows = [];

    for (const item of (playerStatusList || [])) {
      const realPlayerId = await resolvePlayerUUID(supabaseClient, item.playerId);
      if (realPlayerId) {
        rows.push({
          event_id: realEventId,
          player_id: realPlayerId,
          official_status: item.officialStatus,
          validated_by: (coachProfileId && uuidRegex.test(coachProfileId)) ? coachProfileId : null,
          validated_at: nowISO
        });
      }
    }

    if (!rows.length) {
      return { data: [], error: new Error('No hay jugadoras vinculadas con UUID en Supabase para este equipo.') };
    }

    const { data, error } = await supabaseClient
      .from('attendance')
      .upsert(rows, { onConflict: 'event_id,player_id' })
      .select('*');

    if (error) return { data: null, error };
    return { data: data || [], error: null };
  }

  let attendanceChannel = null;

  function subscribeAttendanceRealtime(clubId, onDataChange) {
    const supabaseClient = getClient();
    if (!supabaseClient || !clubId) return null;

    if (attendanceChannel) {
      try { supabaseClient.removeChannel(attendanceChannel); } catch(e){}
      attendanceChannel = null;
    }

    attendanceChannel = supabaseClient
      .channel('public:attendance:' + clubId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance'
        },
        (payload) => {
          if (typeof onDataChange === 'function') {
            onDataChange(payload);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Supabase Realtime] Asistencia suscrita correctamente.');
        }
      });

    return attendanceChannel;
  }

  window.VolleySupabase = Object.freeze({
    config,
    getClient,
    healthcheck,
    initializeStatus,
    usernameToEmail,
    signInWithUsername,
    signOut,
    getSession,
    getProfile,
    getIdentity,
    updateOwnProfile,
    updateOwnPlayer,
    touchLastLogin,
    updatePassword,
    supabaseToFrontendEvent,
    frontendToSupabaseEvent,
    fetchEvents,
    saveEvent,
    deleteEvent,
    subscribeEventsRealtime,
    fetchAttendance,
    savePlayerAttendanceResponse,
    validateOfficialAttendance,
    subscribeAttendanceRealtime
  });

  document.addEventListener('DOMContentLoaded', initializeStatus, { once: true });
})();
