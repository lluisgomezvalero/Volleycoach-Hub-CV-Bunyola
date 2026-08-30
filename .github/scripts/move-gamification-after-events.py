from pathlib import Path

home = Path('react-migration/src/pages/HomePage.jsx')
css = Path('react-migration/src/pages/HomePageDashboard.css')

text = home.read_text(encoding='utf-8')
old = '\n      {!isStaff ? <PlayerGamificationCard /> : null}\n\n      <div className="coach-home-grid">'
if old not in text:
    raise SystemExit('No se encontró la gamificación antes del grid')
text = text.replace(old, '\n\n      <div className="coach-home-grid">', 1)

anchor = '        )}\n\n        {isStaff ? (<>\n'
if anchor not in text:
    raise SystemExit('No se encontró el punto posterior a Próximo partido')
text = text.replace(
    anchor,
    '        )}\n\n        {!isStaff ? <PlayerGamificationCard /> : null}\n\n        {isStaff ? (<>\n',
    1,
)
home.write_text(text, encoding='utf-8')

css_text = css.read_text(encoding='utf-8')
rule = '\n/* Gamificación: después de las próximas actividades y a ancho completo */\n.coach-home-grid>.player-game-card{grid-column:1/-1}\n'
if '.coach-home-grid>.player-game-card{grid-column:1/-1}' not in css_text:
    css.write_text(css_text.rstrip() + rule, encoding='utf-8')
