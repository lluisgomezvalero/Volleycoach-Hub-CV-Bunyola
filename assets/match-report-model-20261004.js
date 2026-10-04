export const REPORT_VERSION = 'cvbunyola_match_report_v1';
const groups = {
  reception: ['positive', 'exclamative', 'errors'],
  attack: ['int', 'points', 'errors'],
  serve: ['int', 'aces', 'errors'],
  block: ['points', 'total', 'errors'],
  defense: ['positive', 'errors'],
  setting: ['positive', 'errors']
};
export function deriveStats(raw = {}) {
  const r = raw.reception, a = raw.attack, s = raw.serve, b = raw.block;
  const pct = (n, d) => d > 0 ? n / d * 100 : null;
  const total = r ? r.positive + r.exclamative + r.errors : null;
  return {
    receptionTotal: total, receptionPositive: r ? pct(r.positive, total) : null,
    receptionError: r ? pct(r.errors, total) : null,
    attackPoint: a ? pct(a.points, a.int) : null,
    attackError: a ? pct(a.errors, a.int) : null,
    attackEfficiency: a ? pct(a.points - a.errors, a.int) : null,
    attackContinuities: a ? a.int - a.points - a.errors : null,
    serveAce: s ? pct(s.aces, s.int) : null,
    serveError: s ? pct(s.errors, s.int) : null,
    serveContinuities: s ? s.int - s.aces - s.errors : null,
    ownPoints: a && s && b ? a.points + s.aces + b.points : null
  };
}
export function validateReport(input) {
  const errors = [];
  let value;
  try { value = typeof input === 'string' ? JSON.parse(input) : input; }
  catch { return { errors: ['El texto no es un JSON válido.'], report: null }; }
  const object = v => v && typeof v === 'object' && !Array.isArray(v);
  const text = (v, path, required = false, max = 300) => {
    if (typeof v !== 'string' || (required && !v.trim()) || v.length > max) {
      errors.push(`${path}: debe ser un texto${required ? ' no vacío' : ''} de hasta ${max} caracteres.`); return '';
    }
    return v.trim();
  };
  const count = (v, path) => {
    if (!Number.isSafeInteger(v) || v < 0) { errors.push(`${path}: debe ser un entero mayor o igual a 0.`); return 0; }
    return v;
  };
  const raw = (v, path, required = false) => {
    if (!object(v)) { errors.push(`${path}: falta el objeto de datos brutos.`); return {}; }
    const out = {};
    for (const key of Object.keys(v)) if (!groups[key] && key !== 'opponent_errors') errors.push(`${path}.${key}: campo no reconocido; no incluyas porcentajes calculados.`);
    for (const [group, fields] of Object.entries(groups)) {
      if (v[group] == null) {
        if (required && ['reception','attack','serve','block'].includes(group)) errors.push(`${path}.${group}: obligatorio.`);
        continue;
      }
      if (!object(v[group])) { errors.push(`${path}.${group}: debe ser un objeto.`); continue; }
      out[group] = {};
      for (const key of Object.keys(v[group])) if (!fields.includes(key)) errors.push(`${path}.${group}.${key}: campo no reconocido.`);
      for (const field of fields) {
        const optional = group === 'block' && field !== 'points';
        if (optional && v[group][field] == null) continue;
        out[group][field] = count(v[group][field], `${path}.${group}.${field}`);
      }
    }
    if (v.opponent_errors != null) out.opponent_errors = count(v.opponent_errors, `${path}.opponent_errors`);
    for (const [group, point] of [['attack','points'],['serve','aces']]) {
      const data = out[group];
      if (data && data[point] + data.errors > data.int) errors.push(`${path}.${group}: ${point} + errors no puede superar INT. INT ya incluye ambas acciones.`);
    }
    if (out.block?.total != null && out.block.points > out.block.total) errors.push(`${path}.block: los puntos no pueden superar el total de bloqueos.`);
    return out;
  };
  if (!object(value)) return { errors: ['El informe debe ser un objeto JSON.'], report: null };
  if (value.version !== REPORT_VERSION) errors.push(`version debe ser "${REPORT_VERSION}".`);
  const match = object(value.match) ? value.match : {};
  const result = object(match.result) ? match.result : {};
  const report = { version: REPORT_VERSION, match: {
    opponent: text(match.opponent, 'match.opponent', true, 100),
    round: count(match.round, 'match.round'),
    result: { ours: count(result.ours,'match.result.ours'), theirs: count(result.theirs,'match.result.theirs') }
  }, headline: text(value.headline, 'headline', true), totals: raw(value.totals, 'totals', true), sets: [], players: [], conclusions: {} };
  if (report.match.result.ours > 3 || report.match.result.theirs > 3 || report.match.result.ours === report.match.result.theirs || report.match.result.ours + report.match.result.theirs > 5) errors.push('match.result: resultado de sets inválido.');
  if (report.match.round < 1) errors.push('match.round: la jornada debe ser al menos 1.');
  if (match.event_id != null) {
    if (typeof match.event_id !== 'string' || !/^[a-f\d-]{36}$/i.test(match.event_id)) errors.push('match.event_id: identificador de partido inválido.');
    else report.match.event_id = match.event_id;
  }
  if (!Array.isArray(value.sets) || value.sets.length > 5) errors.push('sets debe ser una lista de 0 a 5 sets.');
  else value.sets.forEach((set, index) => {
    if (!object(set)) { errors.push(`sets[${index}]: debe ser un objeto.`); return; }
    const number = count(set.number, `sets[${index}].number`);
    if (number !== index + 1) errors.push('Los sets deben estar ordenados S1, S2… sin duplicados.');
    report.sets.push({ number, ...(set.score == null ? {} : { score: text(set.score, `sets[${index}].score`, false, 30) }), stats: raw(set.stats, `sets[${index}].stats`, true) });
  });
  if (report.sets.length && report.sets.length !== report.match.result.ours + report.match.result.theirs) errors.push('El número de sets no coincide con el resultado del partido.');
  if (!Array.isArray(value.players) || value.players.length > 30) errors.push('players debe ser una lista de hasta 30 jugadoras.');
  else value.players.forEach((player, index) => {
    if (!object(player)) { errors.push(`players[${index}]: debe ser un objeto.`); return; }
    const p = { name: text(player.name, `players[${index}].name`, true, 100), stats: raw(player.stats, `players[${index}].stats`) };
    if (player.player_id != null) p.player_id = text(player.player_id, `players[${index}].player_id`, true, 36);
    if (player.position != null) p.position = text(player.position, `players[${index}].position`, false, 60);
    report.players.push(p);
  });
  if (new Set(report.players.map(p => (p.player_id || p.name).toLowerCase())).size !== report.players.length) errors.push('Hay jugadoras duplicadas.');
  if (!object(value.conclusions)) errors.push('conclusions debe ser un objeto.');
  else for (const key of ['headline','positive','key_issue','next_objective']) if (value.conclusions[key] != null) report.conclusions[key] = text(value.conclusions[key], `conclusions.${key}`);
  for (const [group, fields] of Object.entries(groups)) for (const field of fields) {
    const total = report.totals[group]?.[field];
    if (total == null) continue;
    if (report.sets.length && report.sets.every(s => s.stats[group]?.[field] != null)) {
      const sum = report.sets.reduce((n,s) => n+s.stats[group][field],0);
      if (sum !== total) errors.push(`totals.${group}.${field}: ${total} no coincide con la suma por sets (${sum}).`);
    }
    const sum = report.players.reduce((n,p) => n+(p.stats[group]?.[field] || 0),0);
    if (sum > total) errors.push(`players: la suma de ${group}.${field} (${sum}) supera el total del equipo (${total}).`);
  }
  if (report.totals.opponent_errors != null && report.sets.length && report.sets.every(s=>s.stats.opponent_errors!=null) && report.sets.reduce((n,s)=>n+s.stats.opponent_errors,0)!==report.totals.opponent_errors) errors.push('Los errores del rival por sets no coinciden con el total.');
  return { errors, report: errors.length ? null : report };
}
export const reportExample = {
  version: REPORT_VERSION,
  match: { opponent: 'CV CIDE', round: 1, result: { ours: 1, theirs: 3 } },
  headline: 'Resumen breve del partido.',
  totals: { reception: {positive: 20, exclamative: 30, errors: 10}, attack: {int: 89, points: 33, errors: 17}, serve: {int: 80, aces: 10, errors: 9}, block: {points: 6}, opponent_errors: 29 },
  sets: [], players: [],
  conclusions: {headline: 'Lectura del partido.', positive: 'Lo que hicimos bien.', key_issue: 'Aspecto a mejorar.', next_objective: 'Objetivo del próximo partido.'}
};
