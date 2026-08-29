from pathlib import Path

jsx = Path('react-migration/src/pages/CalendarPage.jsx')
text = jsx.read_text()

anchor = """const TYPE_OPTIONS = [
  ['training', 'Entrenamiento'],
  ['friendly', 'Amistoso'],
  ['match', 'Partido de liga'],
  ['tournament', 'Torneo']
];
"""
addition = anchor + """
const LOCAL_TEAM_LOGOS = {
  cvbunyola: '/images/logos/logo_cvbunyola.png',
  cvportol: '/images/logos/logo_cvportol.png',
  cvmanacor: '/images/logos/logo_cvmanacor.png',
  cvsonferrer: '/images/logos/logo_cvsonferrer.png',
  cvalaro: '/images/logos/logo_cvalaro.png',
  cvsoller: '/images/logos/logo_cvsoller.png',
  palmavoley: '/images/logos/logo_palmavoley.png'
};

function normalizeAssetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function resolveTeamLogo(row) {
  return normalizeAssetUrl(row?.logo) || LOCAL_TEAM_LOGOS[row?.team_key] || null;
}

function teamInitials(name) {
  const parts = String(name || '').trim().split(/\\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]).join('') || 'EQ').toUpperCase();
}

function TeamBadge({ src, name, compact = false }) {
  const [failed, setFailed] = useState(false);
  const url = normalizeAssetUrl(src);
  if (!url || failed) return <span className={`calendar-team-fallback${compact ? ' compact' : ''}`}>{teamInitials(name)}</span>;
  return <img className={`calendar-team-logo${compact ? ' compact' : ''}`} src={url} alt={`Escudo ${name || 'rival'}`} onError={() => setFailed(true)} />;
}
"""
if 'const LOCAL_TEAM_LOGOS' not in text:
    if anchor not in text: raise SystemExit('TYPE_OPTIONS anchor not found')
    text = text.replace(anchor, addition, 1)

old = """    description: '',
    plan: ''
  };"""
new = """    description: '',
    plan: '',
    opponent: '',
    opponent_key: '',
    opponent_logo: ''
  };"""
if "opponent_key: ''" not in text:
    if old not in text: raise SystemExit('defaultForm fields not found')
    text = text.replace(old, new, 1)

old = """    description: event.payload?.description || '',
    plan: event.payload?.plan || ''
  };"""
new = """    description: event.payload?.description || '',
    plan: event.payload?.plan || '',
    opponent: event.payload?.opponent || '',
    opponent_key: event.payload?.opponent_key || '',
    opponent_logo: event.payload?.opponent_logo || ''
  };"""
if "opponent: event.payload?.opponent" not in text:
    if old not in text: raise SystemExit('formFromEvent fields not found')
    text = text.replace(old, new, 1)

old = """  const planItems = String(event?.payload?.plan || '').split('\\n').map((item) => item.trim()).filter(Boolean);

  const content = (
    <>
      <span className={`calendar-event-icon type-${type}`}><Icon size={18} /></span>"""
new = """  const planItems = String(event?.payload?.plan || '').split('\\n').map((item) => item.trim()).filter(Boolean);
  const isMatchLike = ['match', 'friendly'].includes(type);
  const opponentName = event?.payload?.opponent || event.title || meta.label;
  const opponentLogo = event?.payload?.opponent_logo || '';

  const content = (
    <>
      <span className={`calendar-event-icon type-${type}`}>{isMatchLike && opponentLogo ? <TeamBadge src={opponentLogo} name={opponentName} compact /> : <Icon size={18} />}</span>"""
if 'const opponentLogo = event?.payload?.opponent_logo' not in text:
    if old not in text: raise SystemExit('EventCard icon block not found')
    text = text.replace(old, new, 1)

old = """function EventEditor({ open, teams, form, setForm, saving, error, editing, onClose, onSubmit }) {
  if (!open) return null;
  return ("""
new = """function EventEditor({ open, teams, leagueTeams, form, setForm, saving, error, editing, onClose, onSubmit }) {
  if (!open) return null;
  const isMatchLike = ['match', 'friendly'].includes(form.type);
  const rivals = (leagueTeams || []).filter((row) => !row.is_own && (!form.team_id || row.context_team_id === form.team_id));

  function chooseOpponent(row) {
    const logo = resolveTeamLogo(row) || '';
    setForm((prev) => ({ ...prev, opponent: row.name || '', opponent_key: row.team_key || '', opponent_logo: logo }));
  }

  return ("""
if 'leagueTeams, form, setForm' not in text:
    if old not in text: raise SystemExit('EventEditor signature not found')
    text = text.replace(old, new, 1)

old = """            <label><span>Tipo</span><select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value, title: prev.title === 'Entrenamiento' ? eventTypePayload(e.target.value) : prev.title }))}>{TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Título</span><input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} required /></label>
          </div>
          <div className="calendar-form-grid three">"""
new = """            <label><span>Tipo</span><select value={form.type} onChange={(e) => { const nextType = e.target.value; setForm((prev) => ({ ...prev, type: nextType, title: prev.title === 'Entrenamiento' ? eventTypePayload(nextType) : prev.title, ...(!['match', 'friendly'].includes(nextType) ? { opponent: '', opponent_key: '', opponent_logo: '' } : {}) })); }}>{TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Título</span><input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} required /></label>
          </div>
          {isMatchLike ? (
            <div className="calendar-opponent-picker">
              <span className="calendar-opponent-label">Rival</span>
              {rivals.length ? (
                <div className="calendar-opponent-grid">
                  {rivals.map((row) => {
                    const logo = resolveTeamLogo(row);
                    const selected = form.opponent_key === row.team_key;
                    return <button key={`${row.context_team_id}-${row.team_key}`} type="button" className={`calendar-opponent-option${selected ? ' selected' : ''}`} onClick={() => chooseOpponent(row)}><TeamBadge src={logo} name={row.name} /><strong>{row.name}</strong></button>;
                  })}
                </div>
              ) : <small className="calendar-opponent-help">No hay rivales registrados para este equipo.</small>}
              <label className="calendar-opponent-manual"><span>Otro rival</span><input value={form.opponent} onChange={(e) => setForm((prev) => ({ ...prev, opponent: e.target.value, opponent_key: '', opponent_logo: '' }))} placeholder="Escribe el nombre si no está en la lista…" /></label>
            </div>
          ) : null}
          <div className="calendar-form-grid three">"""
if 'calendar-opponent-picker' not in text:
    if old not in text: raise SystemExit('EventEditor type/title block not found')
    text = text.replace(old, new, 1)

old = """  const [events, setEvents] = useState([]);
  const [birthdays, setBirthdays] = useState([]);"""
new = """  const [events, setEvents] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [leagueTeams, setLeagueTeams] = useState([]);"""
if 'const [leagueTeams, setLeagueTeams]' not in text:
    if old not in text: raise SystemExit('state block not found')
    text = text.replace(old, new, 1)

marker = """  useEffect(() => {
    let active = true;
    async function loadMonth() {"""
league_effect = """  useEffect(() => {
    let active = true;
    async function loadLeagueTeams() {
      if (!teamIds.length) { setLeagueTeams([]); return; }
      const { data, error } = await supabase.from('league_standings').select('context_team_id,team_key,name,logo,is_own').in('context_team_id', teamIds).order('name');
      if (!active) return;
      if (!error) setLeagueTeams(data || []);
    }
    void loadLeagueTeams();
    return () => { active = false; };
  }, [teamIds]);

""" + marker
if "async function loadLeagueTeams()" not in text:
    if marker not in text: raise SystemExit('loadMonth marker not found')
    text = text.replace(marker, league_effect, 1)

old = """      const payload = {
        ...previousPayload,
        type: eventTypePayload(form.type),
        time: form.time,
        duration: minutes,
        description: form.description.trim(),
        plan: form.plan.trim(),
        status: editingEvent?.status || 'Próximo'
      };"""
new = """      const isMatchLike = ['match', 'friendly'].includes(form.type);
      const payload = {
        ...previousPayload,
        type: eventTypePayload(form.type),
        time: form.time,
        duration: minutes,
        description: form.description.trim(),
        plan: form.plan.trim(),
        opponent: isMatchLike && form.opponent.trim() ? form.opponent.trim() : null,
        opponent_key: isMatchLike && form.opponent_key ? form.opponent_key : null,
        opponent_logo: isMatchLike && form.opponent_logo ? form.opponent_logo : null,
        status: editingEvent?.status || 'Próximo'
      };"""
if 'opponent: isMatchLike && form.opponent.trim()' not in text:
    if old not in text: raise SystemExit('save payload block not found')
    text = text.replace(old, new, 1)

old = """      <EventEditor open={editorOpen} teams={teams} form={form} setForm={setForm} saving={saving} error={formError} editing={Boolean(editingEvent)} onClose={() => { if (!saving) { setEditorOpen(false); setEditingEvent(null); } }} onSubmit={saveEvent} />"""
new = """      <EventEditor open={editorOpen} teams={teams} leagueTeams={leagueTeams} form={form} setForm={setForm} saving={saving} error={formError} editing={Boolean(editingEvent)} onClose={() => { if (!saving) { setEditorOpen(false); setEditingEvent(null); } }} onSubmit={saveEvent} />"""
if 'leagueTeams={leagueTeams}' not in text:
    if old not in text: raise SystemExit('EventEditor invocation not found')
    text = text.replace(old, new, 1)

jsx.write_text(text)

css = Path('react-migration/src/pages/CalendarPage.css')
styles = css.read_text()
if '.calendar-opponent-picker{' not in styles:
    styles += """
.calendar-opponent-picker{display:grid;gap:8px}.calendar-opponent-label{color:#526072;font-size:.7rem;font-weight:800}.calendar-opponent-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.calendar-opponent-option{min-width:0;min-height:68px;padding:8px;border:1px solid #dfe5eb;border-radius:13px;background:#fbfcfd;display:flex;align-items:center;gap:8px;text-align:left;color:#273449;font:inherit;cursor:pointer}.calendar-opponent-option.selected{border-color:#dfa329;background:#fff7e6;box-shadow:0 0 0 3px rgba(223,163,41,.12)}.calendar-opponent-option strong{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:.72rem;line-height:1.2}.calendar-team-logo,.calendar-team-fallback{width:38px;height:38px;flex:0 0 38px;border-radius:10px}.calendar-team-logo{object-fit:contain;background:#fff}.calendar-team-fallback{display:grid;place-items:center;background:#eef2f6;color:#536174;font-size:.68rem;font-weight:900}.calendar-team-logo.compact,.calendar-team-fallback.compact{width:30px;height:30px;flex-basis:30px;border-radius:8px}.calendar-team-fallback.compact{font-size:.55rem}.calendar-opponent-manual{display:grid;gap:6px}.calendar-opponent-manual>span{color:#7b8797;font-size:.64rem;font-weight:750}.calendar-opponent-help{color:#8a95a4;font-size:.68rem}.calendar-event-icon:has(.calendar-team-logo),.calendar-event-icon:has(.calendar-team-fallback){background:#fff!important;border:1px solid #edf0f4}
@media(max-width:640px){.calendar-opponent-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.calendar-opponent-option{min-height:62px;padding:7px}.calendar-team-logo,.calendar-team-fallback{width:34px;height:34px;flex-basis:34px}}
"""
css.write_text(styles)
