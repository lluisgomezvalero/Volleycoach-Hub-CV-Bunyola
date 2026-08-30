from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'No se encontró bloque: {label}')
    return text.replace(old, new, 1)

path = Path('react-migration/src/pages/RosterPage.jsx')
text = path.read_text()

text = replace_once(
    text,
    "import { useEffect, useMemo, useState } from 'react';",
    "import { useEffect, useMemo, useRef, useState } from 'react';",
    'useRef import'
)
text = replace_once(
    text,
    "  CalendarDays,\n  Download,\n  Hash,\n  Pencil,\n  Search,",
    "  CalendarDays,\n  Camera,\n  Download,\n  Hash,\n  LoaderCircle,\n  Pencil,\n  Search,",
    'icons'
)
text = replace_once(
    text,
    "import { useAuth } from '../auth/AuthProvider.jsx';\nimport { supabase } from '../lib/supabase.js';",
    "import { useAuth } from '../auth/AuthProvider.jsx';\nimport AvatarCropDialog from '../components/AvatarCropDialog.jsx';\nimport { supabase } from '../lib/supabase.js';",
    'crop import'
)
text = replace_once(
    text,
    "  const canEdit = ['coach', 'administrator'].includes(identity?.profile?.role);\n  const [teamId, setTeamId] = useState(teams[0]?.id || '');",
    "  const canEdit = ['coach', 'administrator'].includes(identity?.profile?.role);\n  const avatarInput = useRef(null);\n  const [teamId, setTeamId] = useState(teams[0]?.id || '');",
    'avatar ref'
)
text = replace_once(
    text,
    "  const [selected, setSelected] = useState(null);\n  const [saving, setSaving] = useState(false);\n  const [formError, setFormError] = useState('');",
    "  const [selected, setSelected] = useState(null);\n  const [saving, setSaving] = useState(false);\n  const [avatarSaving, setAvatarSaving] = useState(false);\n  const [avatarCropFile, setAvatarCropFile] = useState(null);\n  const [formError, setFormError] = useState('');",
    'avatar state'
)
text = replace_once(
    text,
    ".select('id,legacy_id,display_name,profile_id,team_id,dorsal,birth_date,position,status,active,avatar_path,profiles:profile_id(id,username,full_name,avatar_path,active,last_login_at)')",
    ".select('id,legacy_id,display_name,profile_id,club_id,team_id,dorsal,birth_date,position,status,active,avatar_path,profiles:profile_id(id,username,full_name,avatar_path,active,last_login_at)')",
    'club_id select'
)
text = replace_once(
    text,
    "  function openPlayer(player) {\n    setSelected({ ...player });\n    setFormError('');\n  }\n\n  async function savePlayer() {",
    "  function openPlayer(player) {\n    setSelected({ ...player });\n    setAvatarCropFile(null);\n    setFormError('');\n  }\n\n  function selectRosterAvatar(event) {\n    const file = event.target.files?.[0];\n    event.target.value = '';\n    if (!file || !canEdit || !selected?.id) return;\n    if (!file.type.startsWith('image/')) {\n      setFormError('Selecciona una imagen válida.');\n      return;\n    }\n    if (file.size > 8 * 1024 * 1024) {\n      setFormError('La foto no puede superar 8 MB.');\n      return;\n    }\n    setFormError('');\n    setAvatarCropFile(file);\n  }\n\n  async function uploadRosterAvatar(blob) {\n    if (!canEdit || !selected?.id || !selected?.club_id || avatarSaving) return;\n    setAvatarSaving(true);\n    setFormError('');\n    try {\n      const nextPath = `${selected.club_id}/${selected.id}/avatar-${Date.now()}.jpg`;\n      const previousPlayerPath = selected.avatar_path || '';\n      const { error: uploadError } = await supabase.storage.from('avatars').upload(nextPath, blob, {\n        cacheControl: '3600',\n        upsert: false,\n        contentType: 'image/jpeg'\n      });\n      if (uploadError) throw uploadError;\n\n      const { error: playerError } = await supabase\n        .from('players')\n        .update({ avatar_path: nextPath, updated_at: new Date().toISOString() })\n        .eq('id', selected.id);\n      if (playerError) throw playerError;\n\n      const { data: signed, error: signedError } = await supabase.storage.from('avatars').createSignedUrl(nextPath, 3600);\n      if (signedError) throw signedError;\n      const rawUrl = signed?.signedUrl || '';\n      const freshUrl = rawUrl ? `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}v=${Date.now()}` : '';\n      if (freshUrl) setAvatars((current) => ({ ...current, [nextPath]: freshUrl }));\n      setPlayers((current) => current.map((player) => player.id === selected.id ? { ...player, avatar_path: nextPath } : player));\n      setSelected((current) => current ? { ...current, avatar_path: nextPath } : current);\n      setAvatarCropFile(null);\n\n      if (previousPlayerPath && previousPlayerPath !== nextPath) {\n        void supabase.storage.from('avatars').remove([previousPlayerPath]);\n      }\n      window.dispatchEvent(new CustomEvent('volleycoach:player-directory-updated', {\n        detail: { playerId: selected.id, avatarPath: nextPath }\n      }));\n    } catch (nextError) {\n      setFormError(nextError?.message || 'No se pudo actualizar la foto.');\n    } finally {\n      setAvatarSaving(false);\n    }\n  }\n\n  async function savePlayer() {",
    'avatar functions'
)
text = replace_once(
    text,
    "              <div className=\"roster-detail-identity\">\n                {avatarUrl(selected) ? <img src={avatarUrl(selected)} alt=\"\" className=\"roster-detail-avatar\" /> : <div className=\"roster-detail-avatar fallback\">{initials(selected)}</div>}\n                <div><p className=\"eyebrow\">Ficha de jugadora</p><h2>{displayName(selected)}</h2><span>{selected.profiles?.username ? `@${selected.profiles.username}` : 'Sin cuenta vinculada'}</span></div>\n              </div>",
    "              <div className=\"roster-detail-identity\">\n                <div className=\"roster-detail-avatar-edit\">\n                  {avatarUrl(selected) ? <img src={avatarUrl(selected)} alt=\"\" className=\"roster-detail-avatar\" /> : <div className=\"roster-detail-avatar fallback\">{initials(selected)}</div>}\n                  {canEdit ? (\n                    <>\n                      <button className=\"roster-avatar-edit-button\" type=\"button\" onClick={() => avatarInput.current?.click()} disabled={avatarSaving} aria-label=\"Cambiar foto de jugadora\">\n                        {avatarSaving ? <LoaderCircle className=\"spin\" size={15} /> : <Camera size={15} />}\n                      </button>\n                      <input ref={avatarInput} type=\"file\" accept=\"image/jpeg,image/png,image/webp\" hidden onChange={selectRosterAvatar} />\n                    </>\n                  ) : null}\n                </div>\n                <div><p className=\"eyebrow\">Ficha de jugadora</p><h2>{displayName(selected)}</h2><span>{selected.profiles?.username ? `@${selected.profiles.username}` : 'Sin cuenta vinculada'}</span></div>\n              </div>",
    'avatar UI'
)
text = replace_once(
    text,
    "      {selected ? (\n        <div className=\"roster-detail-backdrop\" role=\"presentation\" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>",
    "      {selected ? (\n        <div className=\"roster-detail-backdrop\" role=\"presentation\" onMouseDown={(event) => { if (event.target === event.currentTarget && !avatarSaving && !avatarCropFile) setSelected(null); }}>",
    'backdrop guard'
)
text = replace_once(
    text,
    "      ) : null}\n    </div>\n  );\n}",
    "      ) : null}\n\n      <AvatarCropDialog\n        file={avatarCropFile}\n        busy={avatarSaving}\n        onCancel={() => setAvatarCropFile(null)}\n        onConfirm={uploadRosterAvatar}\n      />\n    </div>\n  );\n}",
    'crop dialog'
)
path.write_text(text)

css_path = Path('react-migration/src/pages/RosterPage.css')
css = css_path.read_text()
append = ".roster-detail-avatar-edit{position:relative;flex:0 0 auto}.roster-detail-avatar-edit .roster-detail-avatar{display:block}.roster-avatar-edit-button{position:absolute;right:-5px;bottom:-5px;width:30px;height:30px;border:2px solid #fff;border-radius:999px;display:grid;place-items:center;background:#d97706;color:#fff;box-shadow:0 5px 12px rgba(15,23,42,.2);cursor:pointer}.roster-avatar-edit-button:disabled{opacity:.65;cursor:wait}.roster-avatar-edit-button:active{transform:scale(.94)}"
if append not in css:
    css += append
css_path.write_text(css)
