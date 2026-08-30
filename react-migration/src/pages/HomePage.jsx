import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Dumbbell,
  HeartPulse,
  MapPin,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UsersRound,
  XCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import PlayerGamificationCard from '../components/PlayerGamificationCard.jsx';
import { supabase } from '../lib/supabase.js';
import './HomePageDashboard.css';

const ROLE_LABELS = {
  administrator: 'Administrador',
  coach: 'Entrenador principal',
  player: 'Jugadora'
};

const CLUB_LOGO = `${import.meta.env.BASE_URL}../assets/pwa-icon-192.png?v=20260825pwa4`;

function playerName(player) {
  return player?.profiles?.full_name || player?.profiles?.username || player?.legacy_id || 'Jugadora';
}

function initials(value) {
  return String(value || 'VB')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function resolveLogo(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  const normalized = raw.replace(/^\.?\//, '');
  if (normalized.startsWith('assets/')) return `../${normalized}`;
  return raw;
}

function normalizedTeamName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function teamMatchKey(value) {
  return normalizedTeamName(value)
    .replace(/^(cv|c v|club voleibol|club volei|volei)\s+/, '')
    .trim();
}

function MatchTeamLogo({ name, src }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const resolved = resolveLogo(src);
  if (!resolved || broken) return <>{initials(name)}</>;
  return <img src={resolved} alt="" onError={() => setBroken(true)} />;
}

function eventDuration(event) {
  if (event?.starts_at && event?.ends_at) {
    const minutes = Math.round((new Date(event.ends_at) - new Date(event.starts_at)) / 60000);
    if (Number.isFinite(minutes) && minutes > 0) return minutes;
  }
  const payloadDuration = Number(event?.payload?.duration);
  return Number.isFinite(payloadDuration) && payloadDuration > 0 ? Math.round(payloadDuration) : 90;
}

function dateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { short: 'Fecha por confirmar', time: '—', weekday: '—' };
  return {
    short: new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: 'short' }).format(date),
    time: new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date),
    weekday: new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).format(date)
  };
}

function daysUntil(value) {
  const diff = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(diff)) return null;
  if (diff <= 0) return 0;
  return Math.max(1, Math.ceil(diff / 86400000));
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 13) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function planLines(event) {
  return String(event?.payload?.plan || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function opponentName(event) {
  const explicit = String(event?.payload?.opponent || '').trim();
  if (explicit) return explicit;
  const title = String(event?.title || '').trim();
  const parts = title.split(/\s+vs\.?\s+/i);
  if (parts.length > 1) return parts.slice(1).join(' vs ').trim();
  return title || 'Rival por confirmar';
}

function loadTone(load, ready = false) {
  if (!ready) return { key: 'learning', label: 'Sin historial suficiente' };
  if (load >= 1200) return { key: 'high', label: 'Alta' };
  if (load >= 600) return { key: 'optimal', label: 'Moderada' };
  return { key: 'low', label: 'Baja' };
}

function latestWellnessByPlayer(rows) {
  const map = new Map();
  [...rows]
    .sort((a, b) => String(b.entry_date).localeCompare(String(a.entry_date)))
    .forEach((row) => {
      if (!map.has(row.player_id)) map.set(row.player_id, row);
    });
  return map;
}

function completedMatch(event) {
  return new Date(event?.starts_at).getTime() < Date.now() && Boolean(event?.payload?.result);
}

const HOME_EVENTS_CACHE_PREFIX = 'volleycoach:home-next-events:';

function readHomeEventsCache(teamId) {
  if (!teamId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${HOME_EVENTS_CACHE_PREFIX}${teamId}`);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    const age = Date.now() - Number(cached?.cachedAt || 0);
    if (!Number.isFinite(age) || age > 24 * 60 * 60 * 1000) return null;
    const keepFuture = (event) => event && new Date(event.starts_at).getTime() > Date.now() - 5 * 60 * 1000 ? event : null;
    return { training: keepFuture(cached?.training), match: keepFuture(cached?.match) };
  } catch {
    return null;
  }
}

function writeHomeEventsCache(teamId, training, match) {
  if (!teamId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${HOME_EVENTS_CACHE_PREFIX}${teamId}`, JSON.stringify({ cachedAt: Date.now(), training: training || null, match: match || null }));
  } catch {
    // La caché es solo una optimización visual; si falla, Supabase sigue siendo la fuente real.
  }
}

export default function HomePage() {
  const { identity } = useAuth();
  const profile = identity?.profile;
  const team = identity?.teams?.[0] || null;
  const seasonName = identity?.season?.name || '2026/27';
  const isStaff = ['coach', 'administrator'].includes(profile?.role);
  const firstName = useMemo(() => String(profile?.full_name || profile?.username || '').trim().split(/\s+/)[0] || 'equipo', [profile]);
  const initialHomeEvents = useMemo(() => readHomeEventsCache(team?.id), [team?.id]);

  const [loading, setLoading] = useState(() => !initialHomeEvents);
  const [error, setError] = useState('');
  const [nextTraining, setNextTraining] = useState(() => initialHomeEvents?.training || null);
  const [nextMatch, setNextMatch] = useState(() => initialHomeEvents?.match || null);
  const [trainingAttendance, setTrainingAttendance] = useState([]);
  const [playerAttendanceResponse, setPlayerAttendanceResponse] = useState(null);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [gamePlan, setGamePlan] = useState(null);
  const [players, setPlayers] = useState([]);
  const [wellness, setWellness] = useState([]);
  const [playerWellnessLoaded, setPlayerWellnessLoaded] = useState(false);
  const [workloadRows, setWorkloadRows] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [leagueTeams, setLeagueTeams] = useState([]);
  const [playerTrainingSummary, setPlayerTrainingSummary] = useState({ weekLoads: [0, 0, 0, 0, 0], recentSessions: 0, recentRpeMean: null, historyCoverageDays: 0, ready: false, label: 'Conociendo tu ritmo', text: 'Estamos empezando a conocer tu ritmo habitual de entrenamiento.' });
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinFatigue, setCheckinFatigue] = useState(2);
  const [checkinSleep, setCheckinSleep] = useState(3);
  const [checkinPain, setCheckinPain] = useState(0);
  const [checkinNotes, setCheckinNotes] = useState('');
  const [checkinSaving, setCheckinSaving] = useState(false);
  const [checkinError, setCheckinError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      if (!team?.id) {
        setLoading(false);
        return;
      }

      setPlayerWellnessLoaded(isStaff || !identity?.player?.id);

      const cachedHomeEvents = readHomeEventsCache(team.id);
      if (cachedHomeEvents) {
        setNextTraining(cachedHomeEvents.training);
        setNextMatch(cachedHomeEvents.match);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError('');
      try {
        const now = new Date();
        const from28 = new Date(now.getTime() - 28 * 86400000).toISOString();
        const from7Date = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);

        const futureRequest = supabase
          .from('events')
          .select('id,team_id,event_type,title,starts_at,ends_at,location,status,payload')
          .eq('team_id', team.id)
          .gte('starts_at', now.toISOString())
          .order('starts_at', { ascending: true })
          .limit(12);
        const pastTrainingRequest = supabase
          .from('events')
          .select('id,starts_at,ends_at,payload')
          .eq('team_id', team.id)
          .eq('event_type', 'training')
          .gte('starts_at', from28)
          .lte('starts_at', now.toISOString())
          .order('starts_at', { ascending: false })
          .limit(30);
        const recentMatchRequest = supabase
          .from('events')
          .select('id,event_type,title,starts_at,payload')
          .eq('team_id', team.id)
          .in('event_type', ['match', 'friendly', 'tournament'])
          .lt('starts_at', now.toISOString())
          .order('starts_at', { ascending: false })
          .limit(5);

      let firstTrainingRequest = supabase
        .from('events')
        .select('starts_at')
        .eq('team_id', team.id)
        .eq('event_type', 'training')
        .lte('starts_at', now.toISOString());
      if (identity?.season?.id) firstTrainingRequest = firstTrainingRequest.eq('season_id', identity.season.id);
      firstTrainingRequest = firstTrainingRequest.order('starts_at', { ascending: true }).limit(1);

        // Próximo entreno y partido son la prioridad para cualquier rol.
        // Se muestran en cuanto responde el calendario futuro; el resto continúa en segundo plano.
        const futureResult = await futureRequest;
        if (futureResult.error) throw futureResult.error;
        const quickFuture = futureResult.data || [];
        const quickTraining = quickFuture.find((event) => event.event_type === 'training') || null;
        const quickMatch = quickFuture.find((event) => ['match', 'friendly', 'tournament'].includes(event.event_type)) || null;
        writeHomeEventsCache(team.id, quickTraining, quickMatch);
        if (active) {
          setNextTraining(quickTraining);
          setNextMatch(quickMatch);
          setLoading(false);
        }

        const [pastTrainingResult, recentMatchResult, firstTrainingResult] = await Promise.all([pastTrainingRequest, recentMatchRequest, isStaff ? firstTrainingRequest : Promise.resolve({ data: [], error: null })]);

        if (pastTrainingResult.error) throw pastTrainingResult.error;
        if (recentMatchResult.error) throw recentMatchResult.error;
        if (firstTrainingResult.error) throw firstTrainingResult.error;

        const future = futureResult.data || [];
        const training = future.find((event) => event.event_type === 'training') || null;
        const match = future.find((event) => ['match', 'friendly', 'tournament'].includes(event.event_type)) || null;
        const pastTrainings = pastTrainingResult.data || [];

        let nextPlayers = [];
        let nextWellness = [];
        let nextWorkloads = [];
        let nextAttendance = [];
        let nextPlan = null;

        if (isStaff) {
          const playersResult = await supabase
            .from('players')
            .select('id,legacy_id,dorsal,position,profiles:profile_id(full_name,username)')
            .eq('team_id', team.id)
            .eq('active', true)
            .order('dorsal', { ascending: true, nullsFirst: false });
          if (playersResult.error) throw playersResult.error;
          nextPlayers = playersResult.data || [];

          const playerIds = nextPlayers.map((player) => player.id);
          const eventIds = pastTrainings.map((event) => event.id);
          const requests = [];

          requests.push(playerIds.length
            ? supabase.from('wellness_entries').select('player_id,entry_date,general_state,fatigue,sleep').in('player_id', playerIds).gte('entry_date', from7Date).order('entry_date', { ascending: false })
            : Promise.resolve({ data: [], error: null }));
          requests.push(eventIds.length
            ? supabase.from('rpe_entries').select('event_id,player_id,score,source').in('event_id', eventIds).not('player_id', 'is', null)
            : Promise.resolve({ data: [], error: null }));
          requests.push(training?.id
            ? supabase.from('attendance').select('player_id,player_response,official_status').eq('event_id', training.id)
            : Promise.resolve({ data: [], error: null }));
          requests.push(match?.id
            ? supabase.from('game_plans').select('id,event_id,status,published_at').eq('event_id', match.id).order('updated_at', { ascending: false }).limit(1)
            : Promise.resolve({ data: [], error: null }));

          const [wellnessResult, rpeResult, attendanceResult, planResult] = await Promise.all(requests);
          if (wellnessResult.error) throw wellnessResult.error;
          if (rpeResult.error) throw rpeResult.error;
          if (attendanceResult.error) throw attendanceResult.error;
          if (planResult.error) throw planResult.error;

          nextWellness = wellnessResult.data || [];
          nextAttendance = attendanceResult.data || [];
          nextPlan = planResult.data?.[0] || null;

          const firstTrainingAt = firstTrainingResult.data?.[0]?.starts_at || null;
          const firstTrainingTime = firstTrainingAt ? new Date(firstTrainingAt).getTime() : NaN;
          const historyCoverageDays = Number.isFinite(firstTrainingTime)
            ? Math.min(35, Math.max(1, Math.floor((now.getTime() - firstTrainingTime) / 86400000) + 1))
            : 0;
          const workloadReady = historyCoverageDays >= 35;

          const eventMap = new Map(pastTrainings.map((event) => [event.id, event]));
          const loads = new Map(nextPlayers.map((player) => [player.id, { seven: 0, twentyEight: 0 }]));
          const sevenCutoff = now.getTime() - 7 * 86400000;
          (rpeResult.data || []).forEach((row) => {
            if (!row.player_id) return;
            const event = eventMap.get(row.event_id);
            if (!event) return;
            const load = Math.round(Number(row.score || 0) * eventDuration(event));
            const target = loads.get(row.player_id) || { seven: 0, twentyEight: 0 };
            target.twentyEight += load;
            if (new Date(event.starts_at).getTime() >= sevenCutoff) target.seven += load;
            loads.set(row.player_id, target);
          });

          nextWorkloads = nextPlayers
            .map((player) => ({ player, ...(loads.get(player.id) || { seven: 0, twentyEight: 0 }), historyCoverageDays, ready: workloadReady }))
            .sort((a, b) => b.seven - a.seven || playerName(a.player).localeCompare(playerName(b.player), 'es'));
        } else if (identity?.player?.id) {
          const wellnessResult = await supabase
            .from('wellness_entries')
            .select('player_id,entry_date,general_state,fatigue,sleep,pain_score')
            .eq('player_id', identity.player.id)
            .gte('entry_date', from7Date)
            .order('entry_date', { ascending: false });
          if (wellnessResult.error) throw wellnessResult.error;
          nextWellness = wellnessResult.data || [];

          const historyStart = new Date(now.getTime() - 35 * 86400000).toISOString();
          const playerEventsResult = await supabase
            .from('events')
            .select('id,starts_at,ends_at,payload')
            .eq('team_id', team.id)
            .eq('event_type', 'training')
            .gte('starts_at', historyStart)
            .lte('starts_at', now.toISOString())
            .order('starts_at', { ascending: true });
          if (playerEventsResult.error) throw playerEventsResult.error;
          const playerEvents = playerEventsResult.data || [];
          const playerEventIds = playerEvents.map((event) => event.id);
          let summary = { weekLoads: [0, 0, 0, 0, 0], recentSessions: 0, recentRpeMean: null, historyCoverageDays: 0, ready: false, label: 'Conociendo tu ritmo', text: 'Estamos empezando a conocer tu ritmo habitual de entrenamiento.' };
          if (playerEventIds.length) {
            const [playerRpeResult, playerAttendanceResult] = await Promise.all([
              supabase.from('rpe_entries').select('event_id,player_id,score,source,created_at').in('event_id', playerEventIds).eq('player_id', identity.player.id),
              supabase.from('attendance').select('event_id,player_id,official_status,effective_minutes').in('event_id', playerEventIds).eq('player_id', identity.player.id)
            ]);
            if (playerRpeResult.error) throw playerRpeResult.error;
            if (playerAttendanceResult.error) throw playerAttendanceResult.error;
            const eventMap = new Map(playerEvents.map((event) => [event.id, event]));
            const attendanceMap = new Map((playerAttendanceResult.data || []).map((row) => [row.event_id, row]));
            const chosen = new Map();
            (playerRpeResult.data || []).filter((row) => ['player', 'coach_for_player'].includes(row.source)).forEach((row) => {
              const prev = chosen.get(row.event_id);
              if (!prev || (row.source === 'player' && prev.source !== 'player') || (row.source === prev.source && new Date(row.created_at || 0) > new Date(prev.created_at || 0))) chosen.set(row.event_id, row);
            });
            const weekLoads = [0, 0, 0, 0, 0];
            const recentRpes = [];
            let oldest = null;
            chosen.forEach((row) => {
              const event = eventMap.get(row.event_id);
              const attendance = attendanceMap.get(row.event_id);
              if (!event || !['present', 'late'].includes(attendance?.official_status)) return;
              const start = new Date(event.starts_at).getTime();
              const duration = eventDuration(event);
              const end = event.ends_at ? new Date(event.ends_at).getTime() : start + duration * 60000;
              if (!Number.isFinite(start) || !Number.isFinite(end) || end > now.getTime()) return;
              let minutes = duration;
              if (attendance.official_status === 'late') {
                const effective = Number(attendance.effective_minutes);
                if (!Number.isFinite(effective) || effective <= 0) return;
                minutes = Math.min(duration, effective);
              }
              const score = Number(row.score);
              if (!Number.isFinite(score) || score < 0 || score > 10) return;
              const age = now.getTime() - start;
              const weekFromNow = Math.floor(age / (7 * 86400000));
              if (weekFromNow < 0 || weekFromNow > 4) return;
              weekLoads[4 - weekFromNow] += Math.round(score * minutes);
              oldest = oldest === null ? start : Math.min(oldest, start);
              if (age < 7 * 86400000) recentRpes.push(score);
            });
            const coverage = oldest === null ? 0 : Math.floor((now.getTime() - oldest) / 86400000);
            const prevMean = weekLoads.slice(0, 4).reduce((sum, value) => sum + value, 0) / 4;
            const current = weekLoads[4];
            const ready = coverage >= 35 && prevMean > 0;
            let label = 'Conociendo tu ritmo';
            let text = 'Estamos empezando a conocer tu ritmo habitual de entrenamiento.';
            if (ready) {
              if (current < prevMean * .8) { label = 'Semana más suave'; text = 'Esta semana está siendo más ligera que tu ritmo habitual.'; }
              else if (current > prevMean * 1.3) { label = 'Semana más exigente'; text = 'Esta semana está siendo más intensa que tu ritmo habitual. Cuida especialmente tu recuperación.'; }
              else { label = 'En tu ritmo habitual'; text = 'Tu semana está siendo parecida a lo que vienes haciendo normalmente.'; }
            }
            summary = {
              weekLoads,
              recentSessions: recentRpes.length,
              recentRpeMean: recentRpes.length ? recentRpes.reduce((a, b) => a + b, 0) / recentRpes.length : null,
              historyCoverageDays: coverage,
              ready,
              label,
              text
            };
          }
          setPlayerTrainingSummary(summary);
        }

        if (!active) return;
        setNextTraining(training);
        setNextMatch(match);
        setPlayers(nextPlayers);
        setWellness(nextWellness);
        setPlayerWellnessLoaded(true);
        setWorkloadRows(nextWorkloads);
        setTrainingAttendance(nextAttendance);
        setGamePlan(nextPlan);
        setRecentMatches(recentMatchResult.data || []);
      } catch (loadError) {
        if (active) setError(loadError?.message || 'No se pudo cargar el panel técnico.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();
    return () => { active = false; };
  }, [identity?.player?.id, isStaff, team?.id]);

  useEffect(() => {
    let active = true;

    async function loadOwnAttendance() {
      if (isStaff || !identity?.player?.id || !nextTraining?.id) {
        if (active) {
          setPlayerAttendanceResponse(null);
          setAttendanceError('');
        }
        return;
      }

      const { data, error: ownAttendanceError } = await supabase
        .from('attendance')
        .select('player_response')
        .eq('event_id', nextTraining.id)
        .eq('player_id', identity.player.id)
        .maybeSingle();

      if (!active) return;
      if (ownAttendanceError) {
        setAttendanceError('No se pudo cargar tu respuesta de asistencia.');
        return;
      }
      setPlayerAttendanceResponse(data?.player_response || null);
      setAttendanceError('');
    }

    void loadOwnAttendance();
    return () => { active = false; };
  }, [identity?.player?.id, isStaff, nextTraining?.id]);

  useEffect(() => {
    let active = true;

    async function loadLeagueTeams() {
      if (!team?.id) {
        setLeagueTeams([]);
        return;
      }
      const { data, error: standingsError } = await supabase
        .from('league_standings')
        .select('id,name,logo,team_key,is_own')
        .eq('context_team_id', team.id);
      if (active && !standingsError) setLeagueTeams(data || []);
    }

    void loadLeagueTeams();
    return () => { active = false; };
  }, [team?.id]);

  const wellnessModel = useMemo(() => {
    const latest = latestWellnessByPlayer(wellness);
    const values = [...latest.values()];
    const low = values.filter((row) => Number(row.fatigue || 0) <= 2).length;
    const medium = values.filter((row) => Number(row.fatigue || 0) === 3).length;
    const high = values.filter((row) => Number(row.fatigue || 0) >= 4).length;
    return { latest, values, low, medium, high };
  }, [wellness]);

  const attendanceModel = useMemo(() => {
    const confirmed = trainingAttendance.filter((row) => row.player_response === 'yes').length;
    const unavailable = trainingAttendance.filter((row) => row.player_response === 'no').length;
    const pending = Math.max(0, players.length - confirmed - unavailable);
    return { confirmed, unavailable, pending };
  }, [players.length, trainingAttendance]);

  const completedMatches = recentMatches.filter(completedMatch);
  const planReady = gamePlan?.status === 'published';
  const primaryLoading = loading && !initialHomeEvents;
  const displayNextTraining = loading ? (nextTraining || initialHomeEvents?.training || null) : nextTraining;
  const displayNextMatch = loading ? (nextMatch || initialHomeEvents?.match || null) : nextMatch;
  const matchOpponentName = opponentName(displayNextMatch);
  const directOpponentLogo = displayNextMatch?.payload?.opponent_logo || displayNextMatch?.payload?.rival_logo || displayNextMatch?.payload?.opponentLogo || '';
  const opponentTeamKey = String(displayNextMatch?.payload?.opponent_key || displayNextMatch?.payload?.rival_key || '').trim().toLowerCase();
  const opponentNameKey = teamMatchKey(matchOpponentName);
  const opponentStanding = leagueTeams.find((row) => !row.is_own && (
    (opponentTeamKey && String(row.team_key || '').trim().toLowerCase() === opponentTeamKey) ||
    teamMatchKey(row.name) === opponentNameKey ||
    normalizedTeamName(row.name) === normalizedTeamName(matchOpponentName)
  )) || null;
  const opponentLogo = directOpponentLogo || opponentStanding?.logo || '';
  const trainingCountdown = displayNextTraining ? daysUntil(displayNextTraining.starts_at) : null;
  const matchCountdown = displayNextMatch ? daysUntil(displayNextMatch.starts_at) : null;
  const trainingDate = displayNextTraining ? dateParts(displayNextTraining.starts_at) : null;
  const matchDate = displayNextMatch ? dateParts(displayNextMatch.starts_at) : null;
  const trainingPlan = displayNextTraining ? planLines(displayNextTraining) : [];
  const localNow = new Date();
  const todayKey = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`;
  const playerWellnessToday = !isStaff ? wellness.find((row) => row.entry_date === todayKey) || null : null;

  async function saveOwnAttendance(response) {
    if (isStaff || !identity?.player?.id || !displayNextTraining?.id || attendanceSaving) return;
    setAttendanceSaving(true);
    setAttendanceError('');
    try {
      const { data, error: saveError } = await supabase
        .from('attendance')
        .upsert({
          event_id: displayNextTraining.id,
          player_id: identity.player.id,
          player_response: response
        }, { onConflict: 'event_id,player_id' })
        .select('player_response')
        .single();
      if (saveError) throw saveError;
      setPlayerAttendanceResponse(data?.player_response || response);
    } catch (saveError) {
      setAttendanceError(saveError?.message || 'No se pudo guardar tu asistencia.');
    } finally {
      setAttendanceSaving(false);
    }
  }

  function openDailyCheckin() {
    setCheckinFatigue(2);
    setCheckinSleep(3);
    setCheckinPain(0);
    setCheckinNotes('');
    setCheckinError('');
    setCheckinOpen(true);
  }

  async function submitDailyCheckin(event) {
    event.preventDefault();
    if (!identity?.player?.id || playerWellnessToday || checkinSaving) return;
    setCheckinSaving(true);
    setCheckinError('');
    try {
      const { data, error: insertError } = await supabase
        .from('wellness_entries')
        .insert({
          player_id: identity.player.id,
          entry_date: todayKey,
          general_state: checkinFatigue,
          fatigue: checkinFatigue,
          sleep: checkinSleep,
          pain_score: checkinPain,
          notes: checkinNotes.trim()
        })
        .select('player_id,entry_date,general_state,fatigue,sleep,pain_score,notes')
        .single();
      if (insertError) throw insertError;
      setWellness((rows) => [data, ...rows.filter((row) => row.entry_date !== todayKey)]);
      setCheckinOpen(false);
    } catch (saveError) {
      if (saveError?.code === '23505') {
        setCheckinOpen(false);
        setWellness((rows) => rows.some((row) => row.entry_date === todayKey) ? rows : [{ player_id: identity.player.id, entry_date: todayKey, fatigue: checkinFatigue, sleep: checkinSleep, pain_score: checkinPain, notes: checkinNotes.trim() }, ...rows]);
      } else {
        setCheckinError(saveError?.message || 'No se pudo guardar tu bienestar.');
      }
    } finally {
      setCheckinSaving(false);
    }
  }

  return (
    <div className="coach-home">
      <section className="coach-home-identity">
        <span className="coach-home-season"><Trophy size={12} /> Temporada {seasonName}</span>
        <div className="coach-home-club-row">
          <img className="coach-home-club-logo" src={CLUB_LOGO} alt="CV Bunyola" />
          <div className="coach-home-club-copy">
            <h1>CV Bunyola</h1>
            <p>{team?.category || team?.name || 'Cadete Femenino 1ª División'}</p>
          </div>
        </div>
        <div className="coach-home-greeting">
          <small>{greetingForNow()}</small>
          <strong>{firstName}</strong>
          <span>{ROLE_LABELS[profile?.role] || 'Usuario'}</span>
        </div>
      </section>

      <header className="coach-home-section-head">
        <div>
          <small>{isStaff ? 'Panel técnico' : 'Tu equipo'}</small>
          <h2>{isStaff ? 'Lo importante, de un vistazo' : 'Lo importante para ti'}</h2>
          <p>{isStaff ? 'Entrenos, competición, bienestar y carga del equipo.' : 'Próximo entreno, partido y tu seguimiento personal.'}</p>
        </div>
      </header>

      {error ? <div className="coach-home-error">{error}</div> : null}

      {!isStaff && !loading && playerWellnessLoaded && !playerWellnessToday ? (
        <button type="button" className="player-daily-wellness-banner" onClick={openDailyCheckin}>
          <span className="player-daily-wellness-icon"><HeartPulse /></span>
          <span className="player-daily-wellness-copy"><small>Bienestar diario</small><strong>Registrar bienestar de hoy</strong><span>Fatiga, sueño y molestias · menos de 1 minuto</span></span>
          <ChevronRight />
        </button>
      ) : null}

      {!isStaff ? <PlayerGamificationCard /> : null}

      <div className="coach-home-grid">
        {primaryLoading ? (
          <article className="coach-card coach-card-skeleton">Cargando próximo entrenamiento…</article>
        ) : displayNextTraining ? (
          <article className="coach-card coach-card-dark coach-card-pad">
            <div className="coach-card-top">
              <div>
                <span className="coach-card-kicker"><Dumbbell size={13} /> Próximo entrenamiento</span>
                <h3 className="coach-training-title">{displayNextTraining.title || 'Entrenamiento'}</h3>
              </div>
              {trainingCountdown !== null ? <span className="coach-countdown">{trainingCountdown === 0 ? 'Hoy' : `Dentro de ${trainingCountdown} día${trainingCountdown === 1 ? '' : 's'}`}</span> : null}
            </div>

            <div className="coach-event-meta">
              <span><CalendarDays size={13} /> {trainingDate?.weekday} · {trainingDate?.time}</span>
              {displayNextTraining.location ? <span><MapPin size={13} /> {displayNextTraining.location}</span> : null}
            </div>

            <div className="coach-plan-box">
              <small><Target size={13} /> Qué vamos a trabajar</small>
              <div className="coach-plan-list">
                {trainingPlan.length ? trainingPlan.map((line, index) => <span key={`${line}-${index}`}>{line}</span>) : <span>Sesión pendiente de detallar.</span>}
              </div>
            </div>

            <div className={`coach-mini-stats ${isStaff ? '' : 'coach-mini-stats-player'}`}>
              {isStaff ? (<>
                <span>{attendanceModel.confirmed} confirmadas</span>
                <span>{attendanceModel.pending} pendientes</span>
              </>) : null}
              <span>{eventDuration(displayNextTraining)} min</span>
            </div>

            {isStaff ? (
              <div className="coach-card-actions">
                <Link className="coach-action-primary" to={`/training?event=${encodeURIComponent(displayNextTraining.id)}&mode=session`}><Activity size={15} /> Abrir sesión</Link>
                <Link className="coach-action-secondary" to={`/training?event=${encodeURIComponent(displayNextTraining.id)}&mode=attendance`}><ClipboardCheck size={15} /> Pasar lista</Link>
              </div>
            ) : (
              <>
                <div className="player-home-attendance-actions" aria-label="Confirma tu asistencia al próximo entrenamiento">
                  <button type="button" className={`player-home-attendance-btn yes ${playerAttendanceResponse === 'yes' ? 'active' : ''}`} disabled={attendanceSaving} onClick={() => void saveOwnAttendance('yes')}><CheckCircle2 size={17} /> Sí, asistiré</button>
                  <button type="button" className={`player-home-attendance-btn no ${playerAttendanceResponse === 'no' ? 'active' : ''}`} disabled={attendanceSaving} onClick={() => void saveOwnAttendance('no')}><XCircle size={17} /> No asistiré</button>
                </div>
                {attendanceError ? <div className="player-home-attendance-error">{attendanceError}</div> : null}
              </>
            )}
          </article>
        ) : (
          <article className="coach-card coach-card-skeleton">No hay entrenamientos próximos.</article>
        )}

        {primaryLoading ? (
          <article className="coach-card coach-card-skeleton">Cargando próximo partido…</article>
        ) : displayNextMatch ? (
          <article className="coach-card coach-match-card">
            <div className="coach-card-top">
              <span className="coach-card-kicker"><Trophy size={13} /> Próximo partido</span>
              {matchCountdown !== null ? <span className="coach-countdown">{matchCountdown === 0 ? 'Hoy' : `${matchCountdown} días`}</span> : null}
            </div>
            <div className="coach-match-main">
              <div className="coach-team-mark">
                <span><img src={CLUB_LOGO} alt="" /></span>
                <strong>CV Bunyola</strong>
              </div>
              <div className="coach-match-vs">VS</div>
              <div className="coach-team-mark">
                <span><MatchTeamLogo name={matchOpponentName} src={opponentLogo} /></span>
                <strong>{matchOpponentName}</strong>
              </div>
            </div>
            <div className="coach-match-date">
              <strong>{matchDate?.weekday} · {matchDate?.time}</strong>
              <span>{displayNextMatch.location || 'Lugar por confirmar'}</span>
            </div>
            <div className="coach-status-pill">{planReady ? 'Plan de juego publicado' : 'Plan de juego pendiente'}</div>
            <Link className="coach-inline-link" to="/game-plan">Ver plan de juego <ChevronRight size={14} /></Link>
          </article>
        ) : (
          <article className="coach-card coach-card-skeleton">No hay partidos próximos.</article>
        )}

        {isStaff ? (<>
          <article className="coach-card coach-wellness-card">
            <div className="coach-wellness-head">
              <div>
                <span className="coach-card-kicker"><HeartPulse size={13} /> Próximos 7 días</span>
                <h3>Carga y bienestar</h3>
              </div>
              <HeartPulse size={22} color="#7b8798" />
            </div>
            <div className="coach-wellness-grid">
              <div className="coach-wellness-metric low"><strong>{wellnessModel.low}</strong><span>Fatiga baja</span></div>
              <div className="coach-wellness-metric medium"><strong>{wellnessModel.medium}</strong><span>Fatiga moderada</span></div>
              <div className="coach-wellness-metric high"><strong>{wellnessModel.high}</strong><span>Fatiga alta</span></div>
            </div>
            <div className="coach-wellness-foot">
              <span>{wellnessModel.values.length} respuestas recientes</span>
              <Link to="/wellness">Ver detalle <ChevronRight size={12} /></Link>
            </div>
          </article>

          <article className="coach-card coach-form-card">
            <span className="coach-card-kicker"><Sparkles size={13} /> En forma esta fase</span>
            <h3>Últimos partidos</h3>
            <div className="coach-form-line" />
            {completedMatches.length ? (
              <p>{completedMatches.slice(0, 3).map((event) => event.payload?.result).filter(Boolean).join(' · ')}</p>
            ) : (
              <p>La temporada todavía no ha comenzado.</p>
            )}
          </article>
        </>) : null}

        {isStaff ? (
          <article className="coach-card coach-load-card">
            <div className="coach-load-head">
              <div>
                <span className="coach-card-kicker"><Activity size={13} /> Carga del equipo</span>
                <h3>Seguimiento individual de carga</h3>
                <p>Volumen de los últimos 7 días calculado con sRPE × duración.</p>
              </div>
              <select className="coach-load-select" defaultValue="7d" aria-label="Periodo de carga">
                <option value="7d">Carga 7 días</option>
              </select>
            </div>
            <div className="coach-load-table-wrap">
              {workloadRows.length ? (
                <table className="coach-load-table">
                  <thead><tr><th>Jugadora</th><th>Carga 7 días</th><th>Estado</th></tr></thead>
                  <tbody>
                    {workloadRows.map((row) => {
                      const tone = loadTone(row.seven, row.ready);
                      const name = playerName(row.player);
                      return (
                        <tr key={row.player.id}>
                          <td><div className="coach-load-player"><span className="coach-load-avatar">{initials(name)}</span><span><strong>{name}</strong><small>#{row.player.dorsal ?? '—'} · {row.player.position || 'Sin posición'}</small></span></div></td>
                          <td className="coach-load-value"><strong>{row.seven} UA</strong><small>{row.twentyEight} UA · 28 días</small></td>
                          <td><span className={`coach-load-state ${tone.key}`}>{tone.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <div className="coach-load-empty">Aún no hay datos de RPE suficientes para mostrar carga.</div>}
            </div>
          </article>
        ) : (
          <article className="coach-card player-week-card">
            <span className="coach-card-kicker"><Activity size={13} /> Tu entrenamiento</span>
            <h3>Tu semana de entrenamiento</h3>
            <div className="player-week-status"><span className="player-week-dot" /><div><strong>{playerTrainingSummary.label}</strong><p>{playerTrainingSummary.text}</p></div></div>
            <div className="player-week-divider" />
            <div className="player-week-feelings">
              <h4>Cómo te has encontrado</h4>
              <small>{wellnessModel.values.length} registro{wellnessModel.values.length === 1 ? '' : 's'} en los últimos 7 días</small>
              {wellnessModel.values[0] ? (
                <div className="player-feeling-grid">
                  <div><span className="player-feeling-icon energy"><Activity size={17} /></span><div><small>Energía</small><strong>{Number(wellnessModel.values[0].fatigue) >= 4 ? 'Más cansada' : Number(wellnessModel.values[0].fatigue) === 3 ? 'Cansancio moderado' : 'Buena energía'}</strong><p>{Number(wellnessModel.values[0].fatigue) >= 4 ? 'Tus últimos registros reflejan más cansancio acumulado.' : 'Tus sensaciones de fatiga están dentro de un rango cómodo.'}</p></div></div>
                  <div><span className="player-feeling-icon sleep"><HeartPulse size={17} /></span><div><small>Sueño</small><strong>{Number(wellnessModel.values[0].sleep) <= 2 ? 'Sueño más flojo' : Number(wellnessModel.values[0].sleep) === 3 ? 'Sueño regular' : 'Buen descanso'}</strong><p>{Number(wellnessModel.values[0].sleep) <= 2 ? 'La calidad de tu sueño ha sido más baja en tu último registro.' : 'Tu descanso reciente acompaña bien al entrenamiento.'}</p></div></div>
                </div>
              ) : <p className="player-week-empty">Cuando registres tu bienestar podremos enseñarte aquí tus sensaciones recientes.</p>}
            </div>
            <div className="player-week-divider" />
            <div className="player-week-evolution">
              <h4>Tu evolución reciente</h4><small>Comparada con tus últimas semanas</small>
              <div className="player-week-bars">
                {playerTrainingSummary.weekLoads.map((value, index, values) => {
                  const max = Math.max(...values, 1);
                  const height = Math.max(8, Math.round((value / max) * 100));
                  const labels = ['Hace 4 sem.', 'Hace 3 sem.', 'Hace 2 sem.', 'Semana pasada', 'Esta semana'];
                  return <div key={labels[index]}><span><i style={{ height: `${height}%` }} /></span><small>{labels[index]}</small></div>;
                })}
              </div>
            </div>
            <Link className="coach-inline-link player-week-link" to="/wellness">Ver mi bienestar <ChevronRight size={14} /></Link>
          </article>
        )}
      </div>

      {checkinOpen && !isStaff ? (
        <div className="player-checkin-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckinOpen(false); }}>
          <form className="player-checkin-modal" onSubmit={submitDailyCheckin}>
            <div className="player-checkin-head">
              <div><small>Bienestar diario</small><h3>¿Cómo estás hoy?</h3><p>Responde pensando en cómo te encuentras ahora mismo.</p></div>
              <button type="button" className="player-checkin-close" onClick={() => setCheckinOpen(false)} aria-label="Cerrar">×</button>
            </div>

            <div className="player-checkin-field"><div><strong>Fatiga</strong><span>1 = muy fresca · 5 = muy cansada</span></div><div className="player-checkin-scale">{[1,2,3,4,5].map((value) => <button key={`f-${value}`} type="button" className={checkinFatigue === value ? 'selected' : ''} onClick={() => setCheckinFatigue(value)}>{value}</button>)}</div></div>
            <div className="player-checkin-field"><div><strong>Sueño</strong><span>1 = muy mal · 5 = muy bien</span></div><div className="player-checkin-scale">{[1,2,3,4,5].map((value) => <button key={`s-${value}`} type="button" className={checkinSleep === value ? 'selected' : ''} onClick={() => setCheckinSleep(value)}>{value}</button>)}</div></div>
            <div className="player-checkin-field"><div><strong>Molestias</strong><span>0 = nada · 10 = dolor máximo</span></div><div className="player-checkin-pain"><input type="range" min="0" max="10" step="1" value={checkinPain} onChange={(event) => setCheckinPain(Number(event.target.value))} /><strong>{checkinPain}/10</strong></div></div>
            <label className="player-checkin-notes"><span>¿Algo que quieras comentar? <small>Opcional</small></span><textarea rows="3" value={checkinNotes} onChange={(event) => setCheckinNotes(event.target.value)} placeholder="Molestia concreta, poco descanso, sensaciones…" /></label>
            {checkinError ? <div className="player-checkin-error">{checkinError}</div> : null}
            <button className="player-checkin-submit" type="submit" disabled={checkinSaving}>{checkinSaving ? 'Guardando…' : 'Guardar bienestar'}</button>
          </form>
        </div>
      ) : null}

      <div className="coach-mobile-spacer" />
    </div>
  );
}
