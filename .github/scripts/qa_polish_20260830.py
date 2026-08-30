from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'No se encontró bloque: {label}')
    return text.replace(old, new, 1)

# Profile: Escape closes the crop editor first, not the whole profile.
profile_path = Path('react-migration/src/components/ProfileModal.jsx')
profile = profile_path.read_text()
profile = replace_once(
    profile,
    "    const onKeyDown = (event) => {\n      if (event.key === 'Escape' && !saving && !avatarSaving) onClose();\n    };",
    "    const onKeyDown = (event) => {\n      if (event.key !== 'Escape' || saving || avatarSaving) return;\n      if (avatarCropFile) setAvatarCropFile(null);\n      else onClose();\n    };",
    'Escape profile/crop'
)
profile = replace_once(
    profile,
    "  }, [open, onClose, saving, avatarSaving]);",
    "  }, [open, onClose, saving, avatarSaving, avatarCropFile]);",
    'dependencias Escape'
)
profile_path.write_text(profile)

# Auth: token refresh is silent; don't replace the app with the boot screen.
auth_path = Path('react-migration/src/auth/AuthProvider.jsx')
auth = auth_path.read_text()
auth = replace_once(
    auth,
    "      setAuthError('');\n      setLoading(true);\n\n      window.setTimeout(() => {",
    "      setAuthError('');\n      if (_event === 'TOKEN_REFRESHED') return;\n      setLoading(true);\n\n      window.setTimeout(() => {",
    'TOKEN_REFRESHED guard'
)
auth = replace_once(
    auth,
    ".select('id, legacy_id, profile_id, club_id, team_id, dorsal, birth_date, position, status, private_data, active, avatar_path')",
    ".select('id, legacy_id, display_name, profile_id, club_id, team_id, dorsal, birth_date, position, status, private_data, active, avatar_path')",
    'display_name identity'
)
auth_path.write_text(auth)
