from pathlib import Path
p = Path('react-migration/src/pages/CalendarPage.jsx')
text = p.read_text()
broken = "split('\n')"
fixed = "split('\\n')"
if broken not in text:
    raise SystemExit('Broken split pattern not found')
text = text.replace(broken, fixed, 1)
p.write_text(text)
print('Calendar split fixed')
