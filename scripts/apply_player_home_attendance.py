from pathlib import Path

home_path = Path('react-migration/src/pages/HomePage.jsx')
css_path = Path('react-migration/src/pages/HomePageDashboard.css')

home = home_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

home = home.replace(
"  UsersRound\n} from 'lucide-react';",
"  UsersRound,\n  XCircle\n} from 'lucide-react';"
)

needle = "  const [trainingAttendance, setTrainingAttendance] = useState([]);\n"
replacement = needle + "  const [playerAttendanceResponse, setPlayerAttendanceResponse] = useState(null);\n  const [attendanceSaving, setAttendanceSaving] = useState(false);\n  const [attendanceError, setAttendanceError] = useState('');\n"
if needle not in home:
    raise SystemExit('No se encontró estado trainingAttendance')
home = home.replace(needle, replacement, 1)

needle = "  }, [identity?.player?.id, isStaff, team?.id]);\n\n  useEffect(() => {\n    let active = true;\n\n    async function loadLeagueTeams()"
insert = """  }, [identity?.player?.id, isStaff, team?.id]);

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

    async function loadLeagueTeams()"""
if needle not in home:
    raise SystemExit('No se encontró punto de inserción de asistencia propia')
home = home.replace(needle, insert, 1)

needle = "  function openDailyCheckin() {\n"
handler = """  async function saveOwnAttendance(response) {
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
"""
if needle not in home:
    raise SystemExit('No se encontró openDailyCheckin')
home = home.replace(needle, handler, 1)

old_stats = """            <div className={`coach-mini-stats ${isStaff ? '' : 'coach-mini-stats-player'}`}>
              {isStaff ? (<>
                <span>{attendanceModel.confirmed} confirmadas</span>
                <span>{attendanceModel.pending} pendientes</span>
              </>) : <span>Tu próxima sesión</span>}
              <span>{eventDuration(displayNextTraining)} min</span>
            </div>

            <div className="coach-card-actions">
              <Link className="coach-action-primary" to="/training"><Activity size={15} /> Abrir sesión</Link>
              {isStaff ? <Link className="coach-action-secondary" to="/training"><ClipboardCheck size={15} /> Pasar lista</Link> : <Link className="coach-action-secondary" to="/training"><CheckCircle2 size={15} /> Mi asistencia</Link>}
            </div>"""
new_stats = """            <div className={`coach-mini-stats ${isStaff ? '' : 'coach-mini-stats-player'}`}>
              {isStaff ? (<>
                <span>{attendanceModel.confirmed} confirmadas</span>
                <span>{attendanceModel.pending} pendientes</span>
              </>) : <span>{playerAttendanceResponse === 'yes' ? 'Asistencia confirmada' : playerAttendanceResponse === 'no' ? 'No asistirás' : 'Confirma tu asistencia'}</span>}
              <span>{eventDuration(displayNextTraining)} min</span>
            </div>

            {isStaff ? (
              <div className="coach-card-actions">
                <Link className="coach-action-primary" to="/training"><Activity size={15} /> Abrir sesión</Link>
                <Link className="coach-action-secondary" to="/training"><ClipboardCheck size={15} /> Pasar lista</Link>
              </div>
            ) : (
              <>
                <div className="player-home-attendance-actions" aria-label="Confirma tu asistencia al próximo entrenamiento">
                  <button type="button" className={`player-home-attendance-btn yes ${playerAttendanceResponse === 'yes' ? 'active' : ''}`} disabled={attendanceSaving} onClick={() => void saveOwnAttendance('yes')}><CheckCircle2 size={17} /> Asistiré</button>
                  <button type="button" className={`player-home-attendance-btn no ${playerAttendanceResponse === 'no' ? 'active' : ''}`} disabled={attendanceSaving} onClick={() => void saveOwnAttendance('no')}><XCircle size={17} /> No asistiré</button>
                </div>
                {attendanceError ? <div className="player-home-attendance-error">{attendanceError}</div> : null}
              </>
            )}"""
if old_stats not in home:
    raise SystemExit('No se encontró bloque de acciones del próximo entrenamiento')
home = home.replace(old_stats, new_stats, 1)

css_append = """

/* Confirmación directa de asistencia para jugadoras desde Inicio */
.player-home-attendance-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.player-home-attendance-btn{min-height:42px;border:1px solid rgba(255,255,255,.72);border-radius:11px;background:#fff;color:#263348;font:inherit;font-size:.69rem;font-weight:900;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;transition:transform .12s ease,background .12s ease,border-color .12s ease,color .12s ease}.player-home-attendance-btn:active{transform:scale(.985)}.player-home-attendance-btn:disabled{cursor:wait;opacity:.65}.player-home-attendance-btn.yes.active{border-color:#86efac;background:#dcfce7;color:#166534}.player-home-attendance-btn.no.active{border-color:#fca5a5;background:#fee2e2;color:#991b1b}.player-home-attendance-error{margin-top:7px;padding:7px 9px;border-radius:9px;background:rgba(127,29,29,.26);color:#fecaca;font-size:.61rem;line-height:1.35}@media(max-width:430px){.player-home-attendance-btn{min-height:41px;font-size:.65rem}}
"""
if 'player-home-attendance-actions' not in css:
    css += css_append

home_path.write_text(home, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
