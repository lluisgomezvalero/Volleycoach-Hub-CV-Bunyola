import { supabase } from './supabase.js';

export const ENGAGEMENT_XP = {
  wellness: 15,
  wellnessEarly: 5,
  attendanceConfirm: 5,
  trainingAttendance: 20,
  rpe: 10,
  perfectWeek: 30
};

export const ENGAGEMENT_LEVELS = [
  { name: 'Inicio', min: 0 },
  { name: 'Compromiso', min: 100 },
  { name: 'Constancia', min: 250 },
  { name: 'Referente', min: 500 },
  { name: 'Líder de equipo', min: 850 }
];

function dateKey(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function weekKey(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  date.setHours(12, 0, 0, 0);
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  return dateKey(date);
}

function endOfWeek(value = new Date()) {
  const monday = new Date(`${weekKey(value)}T00:00:00`);
  monday.setDate(monday.getDate() + 7);
  return monday;
}

function eventEnd(event) {
  if (event?.ends_at) {
    const explicit = new Date(event.ends_at);
    if (!Number.isNaN(explicit.getTime())) return explicit;
  }
  const start = new Date(event?.starts_at || 0);
  const duration = Number(event?.payload?.duration);
  return new Date(start.getTime() + (Number.isFinite(duration) && duration > 0 ? duration : 90) * 60000);
}

function isAttended(row) {
  return ['present', 'late'].includes(row?.official_status);
}

function isValidated(row) {
  return ['present', 'late', 'justified', 'unjustified'].includes(row?.official_status);
}

function levelFromXp(xp) {
  let index = 0;
  ENGAGEMENT_LEVELS.forEach((level, candidate) => {
    if (xp >= level.min) index = candidate;
  });
  const level = ENGAGEMENT_LEVELS[index];
  const next = ENGAGEMENT_LEVELS[index + 1] || null;
  const progress = next
    ? Math.max(0, Math.min(100, Math.round(((xp - level.min) * 100) / (next.min - level.min))))
    : 100;
  return {
    level: level.name,
    nextLevel: next?.name || null,
    pointsToNext: next ? Math.max(0, next.min - xp) : 0,
    levelProgress: progress
  };
}

function buildStreaks(trainings, attendanceMap) {
  const finished = trainings
    .filter((event) => eventEnd(event).getTime() <= Date.now())
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  let current = 0;
  let best = 0;
  finished.forEach((event) => {
    const row = attendanceMap.get(event.id);
    if (!isValidated(row)) return;
    if (isAttended(row)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });
  return { current, best };
}

function countPerfectMonths(trainings, attendanceMap) {
  const months = new Map();
  trainings.forEach((event) => {
    if (eventEnd(event).getTime() > Date.now()) return;
    const row = attendanceMap.get(event.id);
    if (!isValidated(row)) return;
    const date = new Date(event.starts_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = months.get(key) || { total: 0, attended: 0 };
    current.total += 1;
    if (isAttended(row)) current.attended += 1;
    months.set(key, current);
  });
  return [...months.values()].filter((month) => month.total > 0 && month.total === month.attended).length;
}

function activityEntry(action, referenceId, amount, label, occurredAt) {
  return { action, referenceId, amount, label, occurredAt };
}

function buildAchievements({ attended, maxStreak, perfectMonths, wellnessCount, perfectWeeks, attendanceRatio }) {
  const definitions = [
    ['firstClass', 'Primer entrenamiento', 'Asistir al primer entrenamiento validado', attended, 1],
    ['streak5', 'Racha de 5', 'Completar 5 entrenamientos consecutivos', maxStreak, 5],
    ['streak10', 'Racha de 10', 'Completar 10 entrenamientos consecutivos', maxStreak, 10],
    ['perfectMonth', 'Mes perfecto', 'Completar un mes sin ausencias', perfectMonths, 1],
    ['wellness5', 'Cuidarse también entrena', 'Responder 5 registros de bienestar', wellnessCount, 5],
    ['wellness10', 'Autoconocimiento', 'Responder 10 registros de bienestar', wellnessCount, 10],
    ['week1', 'Semana completa', 'Completar todos los hábitos de una semana', perfectWeeks, 1],
    ['week5', 'Constancia semanal', 'Completar 5 semanas de hábitos', perfectWeeks, 5],
    ['eliteAttendance', 'Asistencia 90%', 'Mantener al menos un 90% de asistencia validada', attendanceRatio, 90]
  ];
  return definitions.map(([id, title, description, value, target]) => ({
    id,
    title,
    description,
    value,
    target,
    unlocked: value >= target,
    progress: Math.min(100, Math.round((value * 100) / target)),
    progressText: value >= target ? '¡Desbloqueado!' : `${value} / ${target}`
  }));
}

export async function loadPlayerEngagement({ playerId, teamId, seasonId, seasonStart }) {
  if (!playerId || !teamId) return null;
  const now = new Date();
  const startIso = seasonStart ? `${seasonStart}T00:00:00` : new Date(now.getFullYear(), 6, 1).toISOString();
  const missionEnd = endOfWeek(now).toISOString();

  let trainingQuery = supabase
    .from('events')
    .select('id,team_id,season_id,event_type,title,starts_at,ends_at,payload')
    .eq('team_id', teamId)
    .eq('event_type', 'training')
    .gte('starts_at', startIso)
    .lte('starts_at', missionEnd)
    .order('starts_at', { ascending: true });
  if (seasonId) trainingQuery = trainingQuery.eq('season_id', seasonId);

  let matchesQuery = supabase
    .from('events')
    .select('id,starts_at')
    .eq('team_id', teamId)
    .in('event_type', ['match', 'friendly', 'tournament'])
    .gte('starts_at', startIso)
    .lte('starts_at', now.toISOString());
  if (seasonId) matchesQuery = matchesQuery.eq('season_id', seasonId);

  const [trainingResult, wellnessResult, attendanceResult, rpeResult, matchesResult] = await Promise.all([
    trainingQuery,
    supabase.from('wellness_entries').select('id,player_id,entry_date,fatigue,sleep,pain_score,general_state,notes,created_at').eq('player_id', playerId).gte('entry_date', dateKey(new Date(startIso))).order('entry_date', { ascending: true }),
    supabase.from('attendance').select('event_id,player_id,player_response,official_status,effective_minutes,validated_at,updated_at').eq('player_id', playerId),
    supabase.from('rpe_entries').select('event_id,player_id,score,source,created_at,updated_at').eq('player_id', playerId).eq('source', 'player'),
    matchesQuery
  ]);

  for (const result of [trainingResult, wellnessResult, attendanceResult, rpeResult, matchesResult]) {
    if (result.error) throw result.error;
  }

  const trainings = trainingResult.data || [];
  const wellness = wellnessResult.data || [];
  const attendance = attendanceResult.data || [];
  const rpe = rpeResult.data || [];
  const attendanceMap = new Map(attendance.map((row) => [row.event_id, row]));
  const rpeMap = new Map(rpe.map((row) => [row.event_id, row]));
  const trainingMap = new Map(trainings.map((event) => [event.id, event]));
  const activities = [];

  wellness.forEach((entry) => {
    activities.push(activityEntry('wellness', entry.id || entry.entry_date, ENGAGEMENT_XP.wellness, 'Bienestar registrado', entry.created_at || `${entry.entry_date}T12:00:00`));
    const created = new Date(entry.created_at || `${entry.entry_date}T12:00:00`);
    if (!Number.isNaN(created.getTime()) && created.getDay() === 1 && created.getHours() < 10) {
      activities.push(activityEntry('wellness-early', weekKey(created), ENGAGEMENT_XP.wellnessEarly, 'Bienestar del lunes registrado temprano', created.toISOString()));
    }
  });

  attendance.forEach((row) => {
    if (!trainingMap.has(row.event_id)) return;
    if (row.player_response === 'yes') {
      activities.push(activityEntry('attendance-confirm', row.event_id, ENGAGEMENT_XP.attendanceConfirm, 'Asistencia confirmada', row.updated_at));
    }
    if (isAttended(row)) {
      activities.push(activityEntry('training-attendance', row.event_id, ENGAGEMENT_XP.trainingAttendance, 'Asistencia validada por el entrenador', row.validated_at || row.updated_at));
    }
  });

  rpe.forEach((row) => {
    if (!trainingMap.has(row.event_id)) return;
    activities.push(activityEntry('rpe', row.event_id, ENGAGEMENT_XP.rpe, 'RPE registrado', row.created_at || row.updated_at));
  });

  const groupedWeeks = new Map();
  trainings.forEach((event) => {
    const key = weekKey(event.starts_at);
    if (!groupedWeeks.has(key)) groupedWeeks.set(key, []);
    groupedWeeks.get(key).push(event);
  });

  let perfectWeeks = 0;
  groupedWeeks.forEach((events, key) => {
    const completed = events.filter((event) => eventEnd(event).getTime() <= now.getTime());
    const wellnessDone = wellness.some((entry) => weekKey(`${entry.entry_date}T12:00:00`) === key);
    const allConfirmed = events.length > 0 && events.every((event) => attendanceMap.get(event.id)?.player_response === 'yes');
    const allAttended = completed.length > 0 && completed.every((event) => isAttended(attendanceMap.get(event.id)));
    const allRpe = completed.length > 0 && completed.every((event) => rpeMap.has(event.id));
    if (wellnessDone && allConfirmed && allAttended && allRpe) {
      perfectWeeks += 1;
      activities.push(activityEntry('weekly-compliance', key, ENGAGEMENT_XP.perfectWeek, 'Objetivos de la semana completados', `${key}T23:59:00`));
    }
  });

  const xp = activities.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const level = levelFromXp(xp);
  const currentWeek = weekKey(now);
  const weekEvents = groupedWeeks.get(currentWeek) || [];
  const completedWeekEvents = weekEvents.filter((event) => eventEnd(event).getTime() <= now.getTime());
  const confirmed = weekEvents.filter((event) => attendanceMap.get(event.id)?.player_response === 'yes').length;
  const attendedThisWeek = completedWeekEvents.filter((event) => isAttended(attendanceMap.get(event.id))).length;
  const rpeThisWeek = completedWeekEvents.filter((event) => rpeMap.has(event.id)).length;
  const wellnessThisWeek = wellness.some((entry) => weekKey(`${entry.entry_date}T12:00:00`) === currentWeek);
  const missions = [
    { id: 'confirm', title: 'Confirmar “Asistiré”', detail: 'Confirma tu disponibilidad para cada entrenamiento', progress: confirmed, target: weekEvents.length || 1, done: weekEvents.length > 0 && confirmed === weekEvents.length, xp: ENGAGEMENT_XP.attendanceConfirm * Math.max(1, weekEvents.length) },
    { id: 'attendance', title: 'Asistencia confirmada', detail: 'Se completa cuando el entrenador valida la lista', progress: attendedThisWeek, target: completedWeekEvents.length || 1, done: completedWeekEvents.length > 0 && attendedThisWeek === completedWeekEvents.length, xp: ENGAGEMENT_XP.trainingAttendance * Math.max(1, completedWeekEvents.length) },
    { id: 'wellness', title: 'Completar Bienestar', detail: 'Responder al menos un registro de bienestar esta semana', progress: wellnessThisWeek ? 1 : 0, target: 1, done: wellnessThisWeek, xp: ENGAGEMENT_XP.wellness },
    { id: 'rpe-week', title: 'Completar la Carga semanal', detail: 'Registrar el RPE de todos los entrenamientos finalizados', progress: rpeThisWeek, target: completedWeekEvents.length || 1, done: completedWeekEvents.length > 0 && rpeThisWeek === completedWeekEvents.length, xp: ENGAGEMENT_XP.rpe * Math.max(1, completedWeekEvents.length) }
  ];

  const validated = attendance.filter((row) => trainingMap.has(row.event_id) && isValidated(row));
  const attended = validated.filter(isAttended).length;
  const attendanceRatio = validated.length ? Math.round((attended * 100) / validated.length) : 0;
  const streaks = buildStreaks(trainings, attendanceMap);
  const perfectMonths = countPerfectMonths(trainings, attendanceMap);
  const achievements = buildAchievements({ attended, maxStreak: streaks.best, perfectMonths, wellnessCount: wellness.length, perfectWeeks, attendanceRatio });
  const latestWellness = [...wellness].sort((a, b) => String(b.entry_date).localeCompare(String(a.entry_date)))[0] || null;

  return {
    xp,
    ...level,
    missions,
    activities: activities.sort((a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0)),
    achievements,
    totalAttended: attended,
    validatedTrainings: validated.length,
    attendanceRatio,
    currentStreak: streaks.current,
    maxStreak: streaks.best,
    wellnessCount: wellness.length,
    perfectWeeks,
    matches: (matchesResult.data || []).length,
    latestWellness,
    weekPerfect: missions.every((mission) => mission.done),
    weekKey: currentWeek
  };
}
