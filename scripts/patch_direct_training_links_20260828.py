from pathlib import Path

home_path = Path('react-migration/src/pages/HomePage.jsx')
training_path = Path('react-migration/src/pages/TrainingPageProfessional.jsx')

home = home_path.read_text()
old = '''                <Link className="coach-action-primary" to="/training"><Activity size={15} /> Abrir sesión</Link>\n                <Link className="coach-action-secondary" to="/training"><ClipboardCheck size={15} /> Pasar lista</Link>'''
new = '''                <Link className="coach-action-primary" to={`/training?event=${encodeURIComponent(displayNextTraining.id)}&mode=session`}><Activity size={15} /> Abrir sesión</Link>\n                <Link className="coach-action-secondary" to={`/training?event=${encodeURIComponent(displayNextTraining.id)}&mode=attendance`}><ClipboardCheck size={15} /> Pasar lista</Link>'''
if old not in home:
    raise SystemExit('No se encontraron los enlaces genéricos de Inicio')
home = home.replace(old, new, 1)
home_path.write_text(home)

training = training_path.read_text()
training = training.replace("import { useEffect, useMemo, useState } from 'react';", "import { useEffect, useMemo, useRef, useState } from 'react';", 1)
needle = "import { useAuth } from '../auth/AuthProvider.jsx';"
if "useLocation" not in training:
    training = training.replace(needle, "import { useLocation } from 'react-router-dom';\n" + needle, 1)

state_anchor = "  const { identity } = useAuth();\n"
state_insert = "  const { identity } = useAuth();\n  const location = useLocation();\n  const deepLinkHandled = useRef('');\n"
if state_anchor not in training:
    raise SystemExit('No se encontró inicio de TrainingPageProfessional')
training = training.replace(state_anchor, state_insert, 1)

effect_anchor = "  useEffect(() => { void loadEvents(); }, [teamId]);\n\n"
new_effect = '''  useEffect(() => { void loadEvents(); }, [teamId]);\n\n  useEffect(() => {\n    if (loading || !events.length) return;\n    const params = new URLSearchParams(location.search);\n    const eventId = params.get('event');\n    const mode = params.get('mode') || 'session';\n    if (!eventId) return;\n    const key = `${eventId}:${mode}`;\n    if (deepLinkHandled.current === key) return;\n    const target = events.find((event) => event.id === eventId);\n    if (!target) {\n      deepLinkHandled.current = key;\n      setError('No se encontró el entrenamiento solicitado.');\n      return;\n    }\n    deepLinkHandled.current = key;\n    if (mode === 'attendance' && isStaff) {\n      void openRollCall(target);\n      return;\n    }\n    setSelected(target);\n  }, [events, isStaff, loading, location.search]);\n\n'''
if effect_anchor not in training:
    raise SystemExit('No se encontró efecto de carga de eventos')
training = training.replace(effect_anchor, new_effect, 1)
training_path.write_text(training)
