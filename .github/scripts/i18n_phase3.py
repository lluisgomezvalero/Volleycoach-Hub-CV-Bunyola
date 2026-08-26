from pathlib import Path
import re

i18n = Path('i18n-es-ca-20260826.js')
s = i18n.read_text(encoding='utf-8')
marker = "  ['Sin sesiones programadas','Sense sessions programades'],['No hay sesiones completadas','No hi ha sessions completades'],['Sin partidos registrados','Sense partits registrats']\n];"
replacement = """  ['Sin sesiones programadas','Sense sessions programades'],['No hay sesiones completadas','No hi ha sessions completades'],['Sin partidos registrados','Sense partits registrats'],
  ['CONVOCATORIA','CONVOCATÒRIA'],['Convocatoria','Convocatòria'],['Convocatoria pendiente','Convocatòria pendent'],['Guardar convocatoria','Desar convocatòria'],
  ['Convocatoria guardada','Convocatòria desada'],['Estás convocada','Estàs convocada'],['✅ Estás convocada','✅ Estàs convocada'],['No estás convocada','No estàs convocada'],
  ['No estás en esta convocatoria','No ets en aquesta convocatòria'],['Aún no se ha publicado ninguna convocatoria.','Encara no s’ha publicat cap convocatòria.'],
  ['El cuerpo técnico todavía no ha publicado la convocatoria de este partido.','El cos tècnic encara no ha publicat la convocatòria d’aquest partit.'],
  ['Formas parte de la convocatoria para este partido.','Formes part de la convocatòria per a aquest partit.'],['No figuras en la convocatoria publicada para este partido.','No figures a la convocatòria publicada per a aquest partit.'],
  ['Selecciona las jugadoras convocadas. Esto no cuenta como asistencia.','Selecciona les jugadores convocades. Això no compta com a assistència.'],
  ['Seleccionar todas','Seleccionar-les totes'],['Limpiar','Netejar'],['Cargando…','Carregant…'],['Cargando plantilla…','Carregant plantilla…'],
  ['No hay jugadoras activas.','No hi ha jugadores actives.'],['No disponible','No disponible'],['No se ha podido cargar la convocatoria.','No s’ha pogut carregar la convocatòria.'],
  ['No se ha podido cargar la convocatoria ahora mismo.','No s’ha pogut carregar la convocatòria ara mateix.'],['No se ha podido identificar el partido.','No s’ha pogut identificar el partit.'],
  ['No se ha podido guardar la convocatoria.','No s’ha pogut desar la convocatòria.'],['Guardando…','Desant…'],
  ['Borrador guardado.','Esborrany desat.'],['Publicar plan','Publicar pla'],['Publicar Plan','Publicar pla'],['Plan publicado','Pla publicat'],['Plan publicado.','Pla publicat.'],
  ['Guardar borrador','Desar esborrany'],['Editar plan','Editar pla'],['Vista previa','Vista prèvia'],['Volver a editar','Tornar a editar'],['Historial de planes','Historial de plans'],
  ['Plan actual','Pla actual'],['Plan anterior','Pla anterior'],['Jugadoras que lo han visto','Jugadores que l’han vist'],['Nadie lo ha visto todavía','Encara no l’ha vist ningú'],
  ['Atacante receptora 1','Atacant receptora 1'],['Atacante receptora 2','Atacant receptora 2'],['Opuesta','Oposada'],['Central 1','Central 1'],['Central 2','Central 2'],
  ['Línea','Línia'],['Diagonal larga','Diagonal llarga'],['Diagonal media','Diagonal mitjana'],['Diagonal corta','Diagonal curta'],['Finta','Finta'],
  ['Ataque a Z5','Atac a Z5'],['Ataque a Z1','Atac a Z1'],['Objetivos de saque','Objectius de servei'],['Objetivo de saque','Objectiu de servei'],
  ['Recepción rival','Recepció rival'],['Prioridad principal','Prioritat principal'],['Prioridad secundaria','Prioritat secundària'],['Sin prioridad','Sense prioritat'],
  ['Largo','Llarg'],['Corto','Curt'],['Muy buena','Molt bona'],['Buena','Bona'],['Débil','Feble'],['Ocultar objetivos de saque a jugadoras','Amagar els objectius de servei a les jugadores']
];"""
if marker not in s:
    raise SystemExit('phase3 translation marker not found')
s = s.replace(marker, replacement, 1)
old = """    const playerMatch=trimmed.match(/^(\\d+)\\s+(jugadora|jugadoras|jugadores)$/i);
    if(!translated&&playerMatch){
      const n=Number(playerMatch[1]);
      translated=language==='ca'?`${n} ${n===1?'jugadora':'jugadores'}`:`${n} ${n===1?'jugadora':'jugadoras'}`;
    }
"""
new = old + """    const callupMatch=trimmed.match(/^(\\d+)\\s+(convocada|convocadas|convocades)$/i);
    if(!translated&&callupMatch){
      const n=Number(callupMatch[1]);
      translated=language==='ca'?`${n} ${n===1?'convocada':'convocades'}`:`${n} ${n===1?'convocada':'convocadas'}`;
    }
"""
if old not in s:
    raise SystemExit('dynamic player pattern not found')
s = s.replace(old, new, 1)
i18n.write_text(s, encoding='utf-8')

locale_files = [
    'player-passport-priority-20260813.js', 'performance-mobile-ux-20260823.js',
    'team-attendance-overview-20260812.js', 'game-plan-canonical-20260817.js',
    'match-statistics-player-polish-20260819.js', 'match-statistics-player-mobile-ux-20260824.js',
    'wellness-svg-point-tooltip-20260823.js', 'calendar-mobile-app-ux-20260820.js',
    'calendar-profile-roster-fixes-20260825.js', 'wellness-rpe-session-detail-20260822.js',
    'wellness-individual-tracking-20260822.js', 'training-load-team-dashboard-20260809.js',
    'training-load-player-dashboard-20260809.js'
]
for name in locale_files:
    p = Path(name)
    if not p.exists():
        raise SystemExit(f'missing locale file: {name}')
    text = p.read_text(encoding='utf-8')
    before = text
    text = text.replace(".toLocaleDateString('es-ES'", ".toLocaleDateString(window.VolleyI18n?.locale?.() || 'es-ES'")
    text = text.replace('.toLocaleDateString("es-ES"', ".toLocaleDateString(window.VolleyI18n?.locale?.() || 'es-ES'")
    text = text.replace(".toLocaleString('es-ES'", ".toLocaleString(window.VolleyI18n?.locale?.() || 'es-ES'")
    text = text.replace('.toLocaleString("es-ES"', ".toLocaleString(window.VolleyI18n?.locale?.() || 'es-ES'")
    text = text.replace("new Intl.DateTimeFormat('es-ES'", "new Intl.DateTimeFormat(window.VolleyI18n?.locale?.() || 'es-ES'")
    text = text.replace('new Intl.DateTimeFormat("es-ES"', "new Intl.DateTimeFormat(window.VolleyI18n?.locale?.() || 'es-ES'")
    if text != before:
        p.write_text(text, encoding='utf-8')

cfg = Path('supabase-config.js')
c = cfg.read_text(encoding='utf-8')
c = re.sub(r"window\.VOLLEY_ASSET_VERSION = '[^']+';", "window.VOLLEY_ASSET_VERSION = '20260826i18n3';", c, count=1)
versioned = ['i18n-es-ca-20260826.js'] + locale_files
for name in versioned:
    c = re.sub(re.escape(name) + r"\?v=[^']+", name + '?v=20260826i18n3', c)
cfg.write_text(c, encoding='utf-8')
