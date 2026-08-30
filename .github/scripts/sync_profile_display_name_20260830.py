from pathlib import Path

path = Path('react-migration/src/components/ProfileModal.jsx')
text = path.read_text()
old = "const { error: playerError } = await supabase.from('players').update({ dorsal: nextDorsal, birth_date: birthDate || null, position: position.trim() }).eq('id', player.id);"
new = "const { error: playerError } = await supabase.from('players').update({ display_name: cleanName, dorsal: nextDorsal, birth_date: birthDate || null, position: position.trim() }).eq('id', player.id);"
if old not in text:
    raise SystemExit('No se encontró el guardado de datos de jugadora en ProfileModal')
path.write_text(text.replace(old, new, 1))
