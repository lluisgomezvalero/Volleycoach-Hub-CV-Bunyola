from pathlib import Path

path = Path('react-migration/src/pages/GamePlanPage.css')
text = path.read_text(encoding='utf-8')

old_court = ".gp-serve-court{position:relative;border:1px solid #d8caae;border-radius:16px;overflow:hidden;background:#ead9b8;padding-top:25px}"
new_court = ".gp-serve-court{position:relative;aspect-ratio:1/1;display:flex;flex-direction:column;border:1px solid #d8caae;border-radius:16px;overflow:hidden;background:#ead9b8;padding-top:25px}"
old_grid = ".gp-zone-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:rgba(255,255,255,.72);border-top:1px solid rgba(255,255,255,.75)}"
new_grid = ".gp-zone-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));flex:1;min-height:0;gap:1px;background:rgba(255,255,255,.72);border-top:1px solid rgba(255,255,255,.75)}"

if old_court not in text:
    if new_court in text:
        print('Serve court already square')
    else:
        raise SystemExit('Expected .gp-serve-court rule not found')
else:
    text = text.replace(old_court, new_court, 1)

if old_grid not in text:
    if new_grid in text:
        print('Zone grid already stretched')
    else:
        raise SystemExit('Expected .gp-zone-grid rule not found')
else:
    text = text.replace(old_grid, new_grid, 1)

path.write_text(text, encoding='utf-8')
print('Square serve courts patch applied')
