import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Save, ShieldCheck, UserRound, X } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';

const ROLE_LABELS = {
  administrator: 'Administrador',
  coach: 'Entrenador',
  player: 'Jugadora'
};

export default function ProfileModal({ open, onClose }) {
  const { identity, refreshIdentity } = useAuth();
  const profile = identity?.profile;
  const player = identity?.player;
  const team = identity?.teams?.[0] || null;

  const [fullName, setFullName] = useState('');
  const [dorsal, setDorsal] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [position, setPosition] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName(profile?.full_name || '');
    setDorsal(player?.dorsal ?? '');
    setBirthDate(player?.birth_date || '');
    setPosition(player?.position || '');
    setNewPassword('');
    setError('');
    setSaved(false);
  }, [open, profile, player]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, saving]);

  const initials = useMemo(() => {
    const source = profile?.full_name || profile?.username || 'VB';
    return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }, [profile]);

  if (!open) return null;

  async function saveProfile(event) {
    event.preventDefault();
    if (saving || !profile?.id) return;
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const cleanName = fullName.trim();
      if (!cleanName) throw new Error('El nombre no puede estar vacío.');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: cleanName })
        .eq('id', profile.id);
      if (profileError) throw profileError;

      if (profile.role === 'player' && player?.id) {
        const nextDorsal = dorsal === '' ? null : Number(dorsal);
        if (nextDorsal !== null && (!Number.isInteger(nextDorsal) || nextDorsal < 0 || nextDorsal > 99)) {
          throw new Error('El dorsal debe ser un número entre 0 y 99.');
        }

        const { error: playerError } = await supabase
          .from('players')
          .update({
            dorsal: nextDorsal,
            birth_date: birthDate || null,
            position: position.trim()
          })
          .eq('id', player.id);
        if (playerError) throw playerError;
      }

      if (newPassword) {
        if (newPassword.length < 6) throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
        const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
        if (passwordError) throw passwordError;
      }

      await refreshIdentity();
      setNewPassword('');
      setSaved(true);
    } catch (nextError) {
      setError(nextError?.message || 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <header className="profile-modal-header">
          <div>
            <p className="eyebrow">Cuenta</p>
            <h2 id="profile-title">Mi Perfil Privado</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} disabled={saving} aria-label="Cerrar perfil"><X /></button>
        </header>

        <div className="profile-modal-scroll">
          <div className="profile-identity-card">
            <span className="profile-avatar">{initials}</span>
            <div>
              <strong>{profile?.full_name || profile?.username}</strong>
              <span>@{profile?.username}</span>
              <small><ShieldCheck size={14} /> {ROLE_LABELS[profile?.role] || profile?.role}</small>
            </div>
          </div>

          <form className="profile-form" onSubmit={saveProfile}>
            <div className="form-section">
              <div className="form-section-title"><UserRound size={18} /><span>Datos personales</span></div>
              <label>
                <span>Nombre completo</span>
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={saving} />
              </label>
              <div className="two-column-fields">
                <label>
                  <span>Usuario</span>
                  <input value={profile?.username || ''} disabled />
                </label>
                <label>
                  <span>Rol</span>
                  <input value={ROLE_LABELS[profile?.role] || profile?.role || ''} disabled />
                </label>
              </div>
              <label>
                <span>Equipo</span>
                <input value={team?.category || team?.name || 'Sin equipo asignado'} disabled />
              </label>
            </div>

            {profile?.role === 'player' ? (
              <div className="form-section">
                <div className="form-section-title"><span>Datos deportivos</span></div>
                <div className="two-column-fields">
                  <label>
                    <span>Dorsal</span>
                    <input inputMode="numeric" value={dorsal} onChange={(event) => setDorsal(event.target.value)} disabled={saving} />
                  </label>
                  <label>
                    <span>Posición</span>
                    <input value={position} onChange={(event) => setPosition(event.target.value)} disabled={saving} />
                  </label>
                </div>
                <label>
                  <span>Fecha de nacimiento</span>
                  <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} disabled={saving} />
                </label>
              </div>
            ) : (
              <div className="coach-profile-note">
                <ShieldCheck size={19} />
                <div><strong>Perfil de entrenador</strong><span>Sin gamificación, logros ni registro personal de asistencia.</span></div>
              </div>
            )}

            <div className="form-section">
              <div className="form-section-title"><span>Seguridad</span></div>
              <label>
                <span>Nueva contraseña <small>(opcional)</small></span>
                <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Dejar vacío para mantener la actual" disabled={saving} />
              </label>
            </div>

            {error ? <p className="form-error" role="alert">{error}</p> : null}
            {saved ? <p className="form-success" role="status">Cambios guardados correctamente.</p> : null}

            <div className="profile-actions">
              <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
