from pathlib import Path

jsx_path = Path('react-migration/src/pages/HomePage.jsx')
css_path = Path('react-migration/src/pages/HomePageDashboard.css')

jsx = jsx_path.read_text()

old_stats = """            <div className={`coach-mini-stats ${isStaff ? '' : 'coach-mini-stats-player'}`}>
              {isStaff ? (<>
                <span>{attendanceModel.confirmed} confirmadas</span>
                <span>{attendanceModel.pending} pendientes</span>
              </>) : <span>{playerAttendanceResponse === 'yes' ? 'Asistencia confirmada' : playerAttendanceResponse === 'no' ? 'No asistirás' : 'Confirma tu asistencia'}</span>}
              <span>{eventDuration(displayNextTraining)} min</span>
            </div>
"""
new_stats = """            <div className={`coach-mini-stats ${isStaff ? '' : 'coach-mini-stats-player'}`}>
              {isStaff ? (<>
                <span>{attendanceModel.confirmed} confirmadas</span>
                <span>{attendanceModel.pending} pendientes</span>
              </>) : null}
              <span>{eventDuration(displayNextTraining)} min</span>
            </div>
"""

if old_stats in jsx:
    jsx = jsx.replace(old_stats, new_stats, 1)
elif "'Confirma tu asistencia'" in jsx:
    raise SystemExit('El bloque de asistencia cambió y no se ha parcheado de forma segura')

old_yes = "><CheckCircle2 size={17} /> Asistiré</button>"
new_yes = "><CheckCircle2 size={17} /> Sí, asistiré</button>"
if old_yes in jsx:
    jsx = jsx.replace(old_yes, new_yes, 1)
elif 'Sí, asistiré</button>' not in jsx:
    raise SystemExit('No se encontró el botón de asistencia')

jsx_path.write_text(jsx)

css = css_path.read_text()
marker = '/* Asistencia jugadora: acciones semánticas */'
rules = """

/* Asistencia jugadora: acciones semánticas */
.coach-mini-stats-player{grid-template-columns:1fr;max-width:120px}
.player-home-attendance-btn.yes{background:#16a34a!important;border-color:#16a34a!important;color:#fff!important}
.player-home-attendance-btn.no{background:#dc2626!important;border-color:#dc2626!important;color:#fff!important}
.player-home-attendance-btn.yes.active{background:#15803d!important;border-color:#15803d!important;box-shadow:0 0 0 3px rgba(34,197,94,.22)}
.player-home-attendance-btn.no.active{background:#b91c1c!important;border-color:#b91c1c!important;box-shadow:0 0 0 3px rgba(239,68,68,.20)}
.player-home-attendance-btn:disabled{opacity:.7}
"""
if marker not in css:
    css += rules
css_path.write_text(css)
