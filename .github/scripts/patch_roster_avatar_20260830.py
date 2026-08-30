from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'No se encontró bloque: {label}')
    return text.replace(old, new, 1)

# 1) Plantilla: nombre deportivo visible + recarga al cambiar datos/foto.
roster_path = Path('react-migration/src/pages/RosterPage.jsx')
roster = roster_path.read_text()
roster = replace_once(
    roster,
    "function displayName(player) {\n  return player.profiles?.full_name || player.profiles?.username || player.legacy_id || 'Jugadora';\n}",
    "function displayName(player) {\n  return player.display_name || player.profiles?.full_name || player.profiles?.username || player.legacy_id || 'Jugadora';\n}",
    'displayName plantilla'
)
roster = replace_once(
    roster,
    "  const [avatars, setAvatars] = useState({});\n  const [loading, setLoading] = useState(true);",
    "  const [avatars, setAvatars] = useState({});\n  const [directoryRevision, setDirectoryRevision] = useState(0);\n  const [loading, setLoading] = useState(true);",
    'estado revision plantilla'
)
roster = replace_once(
    roster,
    "  useEffect(() => {\n    let active = true;\n    async function loadRoster() {",
    "  useEffect(() => {\n    const refreshDirectory = () => setDirectoryRevision((value) => value + 1);\n    window.addEventListener('volleycoach:player-directory-updated', refreshDirectory);\n    return () => window.removeEventListener('volleycoach:player-directory-updated', refreshDirectory);\n  }, []);\n\n  useEffect(() => {\n    let active = true;\n    async function loadRoster() {",
    'listener actualización plantilla'
)
roster = replace_once(
    roster,
    ".select('id,legacy_id,profile_id,team_id,dorsal,birth_date,position,status,active,avatar_path,profiles:profile_id(id,username,full_name,avatar_path,active,last_login_at)')",
    ".select('id,legacy_id,display_name,profile_id,team_id,dorsal,birth_date,position,status,active,avatar_path,profiles:profile_id(id,username,full_name,avatar_path,active,last_login_at)')",
    'select display_name'
)
roster = replace_once(
    roster,
    "  }, [teamId]);\n\n  const positions = useMemo(() => {",
    "  }, [teamId, directoryRevision]);\n\n  const positions = useMemo(() => {",
    'dependencias carga plantilla'
)
roster_path.write_text(roster)

# 2) Perfil: selector con crop/zoom, actualización inmediata y sincronizar display_name.
profile_path = Path('react-migration/src/components/ProfileModal.jsx')
profile = profile_path.read_text()
profile = replace_once(
    profile,
    "import { supabase } from '../lib/supabase.js';\nimport './ProfilePassport.css';",
    "import { supabase } from '../lib/supabase.js';\nimport AvatarCropDialog from './AvatarCropDialog.jsx';\nimport './ProfilePassport.css';",
    'import cropper'
)
profile = replace_once(
    profile,
    "  const [avatarUrl, setAvatarUrl] = useState('');\n  const [latestCmj, setLatestCmj] = useState(null);",
    "  const [avatarUrl, setAvatarUrl] = useState('');\n  const [avatarCropFile, setAvatarCropFile] = useState(null);\n  const [latestCmj, setLatestCmj] = useState(null);",
    'estado cropper'
)
start = profile.find('  async function uploadAvatar(event) {')
end = profile.find('  async function saveProfile(event) {', start)
if start == -1 or end == -1:
    raise SystemExit('No se encontró función uploadAvatar')
new_avatar = '''  function chooseAvatar(event) {\n    const file = event.target.files?.[0];\n    event.target.value = '';\n    if (!file || !player?.id || !player?.club_id || profile?.role !== 'player') return;\n    if (!file.type.startsWith('image/')) {\n      setError('Selecciona una imagen válida.');\n      return;\n    }\n    if (file.size > 8 * 1024 * 1024) {\n      setError('La foto no puede superar 8 MB.');\n      return;\n    }\n    setError('');\n    setAvatarCropFile(file);\n  }\n\n  async function saveCroppedAvatar(blob) {\n    if (!blob || !player?.id || !player?.club_id || profile?.role !== 'player' || avatarSaving) return;\n    setAvatarSaving(true);\n    setError('');\n    setSaved(false);\n    try {\n      const nextPath = `${player.club_id}/${player.id}/avatar-${Date.now()}.jpg`;\n      const previousPath = player.avatar_path || profile.avatar_path || '';\n      const { error: uploadError } = await supabase.storage.from('avatars').upload(nextPath, blob, {\n        cacheControl: '3600',\n        upsert: false,\n        contentType: 'image/jpeg'\n      });\n      if (uploadError) throw uploadError;\n\n      const [{ error: playerError }, { error: profileError }] = await Promise.all([\n        supabase.from('players').update({ avatar_path: nextPath }).eq('id', player.id),\n        supabase.from('profiles').update({ avatar_path: nextPath }).eq('id', profile.id)\n      ]);\n      if (playerError || profileError) throw playerError || profileError;\n\n      const { data, error: signedError } = await supabase.storage.from('avatars').createSignedUrl(nextPath, 3600);\n      if (signedError) throw signedError;\n      setAvatarUrl(data?.signedUrl || '');\n      setAvatarCropFile(null);\n      window.dispatchEvent(new CustomEvent('volleycoach:player-directory-updated', { detail: { playerId: player.id } }));\n      await refreshIdentity();\n      if (previousPath && previousPath !== nextPath) void supabase.storage.from('avatars').remove([previousPath]);\n      setSaved(true);\n    } catch (nextError) {\n      setError(nextError?.message || 'No se pudo actualizar la foto.');\n    } finally {\n      setAvatarSaving(false);\n    }\n  }\n\n'''
profile = profile[:start] + new_avatar + profile[end:]
profile = replace_once(
    profile,
    "        const { error: playerError } = await supabase.from('players').update({ dorsal: nextDorsal, birth_date: birthDate || null, position: position.trim() }).eq('id', player.id);",
    "        const { error: playerError } = await supabase.from('players').update({ display_name: cleanName, dorsal: nextDorsal, birth_date: birthDate || null, position: position.trim() }).eq('id', player.id);",
    'sincronizar display_name'
)
profile = replace_once(
    profile,
    "      await refreshIdentity();\n      setCurrentPassword('');",
    "      await refreshIdentity();\n      if (profile.role === 'player' && player?.id) {\n        window.dispatchEvent(new CustomEvent('volleycoach:player-directory-updated', { detail: { playerId: player.id } }));\n      }\n      setCurrentPassword('');",
    'evento actualización perfil'
)
profile = replace_once(
    profile,
    'hidden onChange={uploadAvatar}',
    'hidden onChange={chooseAvatar}',
    'input foto'
)
profile = replace_once(
    profile,
    "      </section>\n    </div>\n  );\n}",
    "      </section>\n      <AvatarCropDialog\n        file={avatarCropFile}\n        saving={avatarSaving}\n        onCancel={() => { if (!avatarSaving) setAvatarCropFile(null); }}\n        onConfirm={saveCroppedAvatar}\n      />\n    </div>\n  );\n}",
    'render crop dialog'
)
profile_path.write_text(profile)

# 3) Ajustar el cropper a tamaño fijo seguro en móvil.
crop_path = Path('react-migration/src/components/AvatarCropDialog.jsx')
crop = crop_path.read_text().replace('const STAGE_SIZE = 280;', 'const STAGE_SIZE = 260;', 1)
crop_path.write_text(crop)

css_path = Path('react-migration/src/components/AvatarCropDialog.css')
css = css_path.read_text()
css = css.replace('width:280px;height:280px;', 'width:260px;height:260px;', 1)
css = css.replace('.avatar-crop-stage{width:260px;height:260px}', '.avatar-crop-stage{width:260px;height:260px}', 1)
css_path.write_text(css)
