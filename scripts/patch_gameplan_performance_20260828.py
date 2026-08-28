from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
gp = ROOT / 'react-migration/src/pages/GamePlanPage.jsx'
gpcss = ROOT / 'react-migration/src/pages/GamePlanPage.css'
perf = ROOT / 'react-migration/src/pages/PerformancePage.jsx'


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'No se encontro el bloque: {label}')
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------------
# PLAN DE JUEGO
# ---------------------------------------------------------------------------
text = gp.read_text(encoding='utf-8')

helpers = r'''
function normalizeTeamName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bclub\s+voleibol\b/g, '')
    .replace(/\bcv\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveLogo(path) {
  const raw = String(path || '').trim();
  if (!raw) return '';
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  return `../${raw.replace(/^\.?\//, '')}`;
}

function leagueTeamForEvent(event, leagueTeams) {
  const target = normalizeTeamName(opponentName(event));
  if (!target) return null;
  return (leagueTeams || []).find((row) => {
    const name = normalizeTeamName(row?.name);
    return name && (name === target || name.includes(target) || target.includes(name));
  }) || null;
}

function MatchLogo({ event, leagueTeams }) {
  const [broken, setBroken] = useState(false);
  const team = leagueTeamForEvent(event, leagueTeams);
  const src = resolveLogo(team?.logo);
  if (src && !broken) return <img src={src} alt="" onError={() => setBroken(true)} />;
  if (team?.name) {
    const letters = String(team.name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    return <span className="gp-match-logo-fallback">{letters || 'CV'}</span>;
  }
  return <span className="gp-match-logo-fallback is-generic"><Trophy size={18} /></span>;
}

'''
text = replace_once(text, 'function detailedDate(event) {', helpers + 'function detailedDate(event) {', 'helpers selector visual')

text = replace_once(
    text,
    "  const [players, setPlayers] = useState([]);\n  const [selectedEventId, setSelectedEventId] = useState('');",
    "  const [players, setPlayers] = useState([]);\n  const [leagueTeams, setLeagueTeams] = useState([]);\n  const [selectedEventId, setSelectedEventId] = useState('');",
    'estado leagueTeams'
)

old_request = """        const playerRequest = isStaff
          ? supabase.from('players').select('id,legacy_id,dorsal,position,profiles:profile_id(full_name,username)').eq('team_id', team.id).eq('active', true).order('dorsal', { ascending: true, nullsFirst: false })
          : Promise.resolve({ data: [], error: null });
        const [eventResult, planResult, playerResult] = await Promise.all([eventRequest, planRequest, playerRequest]);
        if (eventResult.error) throw eventResult.error;
        if (planResult.error) throw planResult.error;
        if (playerResult.error) throw playerResult.error;
"""
new_request = """        const playerRequest = isStaff
          ? supabase.from('players').select('id,legacy_id,dorsal,position,profiles:profile_id(full_name,username)').eq('team_id', team.id).eq('active', true).order('dorsal', { ascending: true, nullsFirst: false })
          : Promise.resolve({ data: [], error: null });
        const standingRequest = supabase
          .from('league_standings')
          .select('id,name,logo,is_own')
          .eq('context_team_id', team.id);
        const [eventResult, planResult, playerResult, standingResult] = await Promise.all([eventRequest, planRequest, playerRequest, standingRequest]);
        if (eventResult.error) throw eventResult.error;
        if (planResult.error) throw planResult.error;
        if (playerResult.error) throw playerResult.error;
"""
text = replace_once(text, old_request, new_request, 'consulta clasificacion')
text = replace_once(
    text,
    "        setPlayers(playerResult.data || []);\n        setSelectedEventId((current) => {",
    "        setPlayers(playerResult.data || []);\n        setLeagueTeams(standingResult.error ? [] : (standingResult.data || []));\n        setSelectedEventId((current) => {",
    'guardar equipos clasificacion'
)

old_picker = """          <label>
            <span>Partido</span>
            <select value={selectedEventId} onChange={(event) => void changeEvent(event.target.value)}>
              {events.map((event) => <option key={event.id} value={event.id}>{eventLabel(event)}</option>)}
            </select>
          </label>
"""
new_picker = """          <details className="gp-match-picker">
            <summary>
              <span className="gp-match-picker-logo"><MatchLogo key={selectedEvent?.id || 'selected'} event={selectedEvent} leagueTeams={leagueTeams} /></span>
              <span className="gp-match-picker-copy">
                <small>Partido</small>
                <strong>{opponentName(selectedEvent)}</strong>
                <em>{detailedDate(selectedEvent)}</em>
              </span>
            </summary>
            <div className="gp-match-menu">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={event.id === selectedEventId ? 'active' : ''}
                  onClick={(clickEvent) => {
                    clickEvent.currentTarget.closest('details')?.removeAttribute('open');
                    void changeEvent(event.id);
                  }}
                >
                  <span className="gp-match-menu-logo"><MatchLogo event={event} leagueTeams={leagueTeams} /></span>
                  <span className="gp-match-menu-copy"><strong>{opponentName(event)}</strong><small>{detailedDate(event)}</small></span>
                  {event.id === selectedEventId ? <Check size={17} /> : null}
                </button>
              ))}
            </div>
          </details>
"""
text = replace_once(text, old_picker, new_picker, 'selector de partidos')
gp.write_text(text, encoding='utf-8')

css = gpcss.read_text(encoding='utf-8')
css = replace_once(css, 'aspect-ratio:1.36/1;', 'aspect-ratio:1/1;', 'proporcion pista 1:1')

picker_css = r'''
.gp-match-picker{position:relative;min-width:280px}
.gp-match-picker summary{list-style:none;display:flex;align-items:center;gap:.65rem;min-height:58px;border:1px solid #d8dee8;border-radius:14px;background:#fff;padding:.52rem .72rem;cursor:pointer;box-shadow:0 5px 18px rgba(15,23,42,.035)}
.gp-match-picker summary::-webkit-details-marker{display:none}
.gp-match-picker summary::after{content:'⌄';margin-left:auto;color:#8390a2;font-size:1rem;font-weight:800;transition:.15s}
.gp-match-picker[open] summary::after{transform:rotate(180deg)}
.gp-match-picker-logo,.gp-match-menu-logo{display:grid;place-items:center;flex:0 0 auto;width:39px;height:39px;border-radius:11px;border:1px solid #e5e9ef;background:#fff;overflow:hidden}
.gp-match-picker-logo img,.gp-match-menu-logo img{width:100%;height:100%;object-fit:contain;padding:3px}
.gp-match-logo-fallback{display:grid;place-items:center;width:100%;height:100%;background:#f7f8fa;color:#526074;font-size:.68rem;font-weight:900}
.gp-match-logo-fallback.is-generic{color:#a56819;background:#fff8eb}
.gp-match-picker-copy,.gp-match-menu-copy{display:grid;min-width:0;gap:.05rem}
.gp-match-picker-copy small{font-size:.58rem;text-transform:uppercase;letter-spacing:.08em;color:#9aa3b2;font-weight:850}
.gp-match-picker-copy strong{font-size:.82rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gp-match-picker-copy em{font-style:normal;font-size:.64rem;color:#7f8999;text-transform:capitalize;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gp-match-menu{position:absolute;z-index:50;top:calc(100% + 7px);right:0;width:min(390px,calc(100vw - 2rem));max-height:min(55vh,420px);overflow:auto;padding:.4rem;border:1px solid #dfe4eb;border-radius:16px;background:#fff;box-shadow:0 22px 55px rgba(15,23,42,.18)}
.gp-match-menu button{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.65rem;border:0;border-radius:11px;background:transparent;padding:.55rem;text-align:left;color:#263247;cursor:pointer}
.gp-match-menu button:hover,.gp-match-menu button.active{background:#f4f7fb}
.gp-match-menu button.active{box-shadow:inset 0 0 0 1px #d6e2f5}
.gp-match-menu-copy strong{font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gp-match-menu-copy small{font-size:.64rem;color:#8792a2;text-transform:capitalize;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gp-match-menu button>svg{color:#2563eb}
'''
anchor = '.gp-header-tools select:focus,.gp-field input:focus,.gp-field select:focus{border-color:#8ab4ff;box-shadow:0 0 0 3px rgba(37,99,235,.1)}\n'
css = replace_once(css, anchor, anchor + '\n' + picker_css + '\n', 'css selector visual')

mobile_anchor = '  .gp-header-tools{justify-content:stretch;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end}\n'
mobile_new = mobile_anchor + '  .gp-match-picker{min-width:0;width:100%}.gp-match-picker summary{width:100%}.gp-match-menu{left:0;right:auto;width:min(100%,390px)}\n'
css = replace_once(css, mobile_anchor, mobile_new, 'css movil selector')
gpcss.write_text(css, encoding='utf-8')

# ---------------------------------------------------------------------------
# RENDIMIENTO
# ---------------------------------------------------------------------------
ptext = perf.read_text(encoding='utf-8')
ptext = replace_once(
    ptext,
    "  const team = identity?.teams?.[0] || null;\n  const isStaff = ['coach', 'administrator'].includes(profile?.role);",
    "  const team = identity?.teams?.[0] || null;\n  const teamId = team?.id || identity?.player?.team_id || null;\n  const isStaff = ['coach', 'administrator'].includes(profile?.role);",
    'teamId rendimiento'
)
ptext = replace_once(
    ptext,
    "    if (!team?.id) {\n      setLoading(false);\n      return;\n    }",
    "    if (!teamId) {\n      setLoading(false);\n      return;\n    }",
    'guard rendimiento'
)
ptext = replace_once(ptext, ".eq('team_id', team.id).eq('active', true)", ".eq('team_id', teamId).eq('active', true)", 'consulta jugadoras rendimiento')
ptext = replace_once(
    ptext,
    "  useEffect(() => { void loadData(); }, [identity?.player?.id, isStaff, team?.id]);",
    "  useEffect(() => { void loadData(); }, [identity?.player?.id, isStaff, teamId]);",
    'dependencias rendimiento'
)
ptext = replace_once(
    ptext,
    "  if (!team?.id) {\n    return <div className=\"perf-page\"><section className=\"perf-empty-state\"><CircleGauge size={32} /><h2>No hay un equipo activo</h2><p>Necesitamos un equipo para mostrar los tests de rendimiento.</p></section></div>;\n  }",
    "  if (!teamId) {\n    return <div className=\"perf-page\"><section className=\"perf-empty-state\"><CircleGauge size={32} /><h2>No hay un equipo activo</h2><p>Necesitamos un equipo para mostrar los tests de rendimiento.</p></section></div>;\n  }",
    'render guard rendimiento'
)

empty_block = """
      {!visibleRecords.length ? (
        <section className="perf-empty-state">
          <CircleGauge size={32} />
          <h2>Aún no hay tests de rendimiento</h2>
          <p>{isStaff ? 'Registra el primer SJ, CMJ, Abalakov o Drop Jump para empezar el seguimiento del equipo.' : 'Cuando el cuerpo técnico registre tu primer test, aparecerá aquí tu evolución.'}</p>
          {isStaff ? <button type="button" className="perf-new" onClick={() => { setError(''); setFormOpen(true); }}><Plus size={17} /> Registrar primer test</button> : null}
        </section>
      ) : null}

"""
insert_anchor = "      <nav className=\"perf-tabs\" aria-label=\"Tests de rendimiento\">\n"
ptext = replace_once(ptext, insert_anchor, empty_block + insert_anchor, 'estado vacio rendimiento')
perf.write_text(ptext, encoding='utf-8')

print('Patch aplicado correctamente')
