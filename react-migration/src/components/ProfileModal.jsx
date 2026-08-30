import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Award,
  CalendarCheck2,
  Camera,
  CheckCircle2,
  Dumbbell,
  Flame,
  HeartPulse,
  LoaderCircle,
  LockKeyhole,
  Save,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  X
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { loadPlayerEngagement } from '../lib/engagement.js';
import { supabase } from '../lib/supabase.js';
import AvatarCropDialog from './AvatarCropDialog.jsx';
import './ProfilePassport.css';

const ROLE_LABELS = {
  administrator: 'Administrador',
  coach: 'Entrenador',
  player: 'Jugadora'
};

function shortDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date);
}

function sleepLabel(value) {
  return ({ 1: 'Muy mal', 2: 'Mal', 3: 'Regular', 4: 'Bien', 5: 'Muy bien' })[Number(value)] || '—';
}

function ActivityIcon({ action }) {
  if (action === 'training-attendance') return <CalendarCheck2 size={16} />;
  if (action === 'rpe') return <Dumbbell size={16} />;
  if (action?.startsWith('wellness')) return <HeartPulse size={16} />;
  if (action === 'weekly-compliance') return <Trophy size={16} />;
  return <CheckCircle2 size={16} />;
}

export default function ProfileModal({ open, onClose }) {
  const { identity, refreshIdentity } = useAuth();
  const profile = identity?.profile;
  const player = identity?.player;
  const team = identity?.teams?.[0] || null;
  const season = identity?.season;
  const avatarInput = useRef(null);

  const [fullName, setFullName] = useState('');
  const [dorsal, setDorsal] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [position, setPosition] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [engagement, setEngagement] = useState(null);
  const [passportLoading, setPassportLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarCropFile, setAvatarCropFile] = useState(null);
  const [latestCmj, setLatestCmj] = useState(null);

  useEffect(() => {
    if (!open) return;
    setFullName(profile?.full_name || '');
    setDorsal(player?.dorsal ?? '');
    setBirthDate(player?.birth_date || '');
    setPosition(player?.position || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSaved(false);
  }, [open, profile, player]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving && !avatarSaving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, saving, avatarSaving]);

  useEffect(() => {
    let active = true;
    if (!open || profile?.role !== 'player' || !player?.id || !team?.id) {
      setEngagement(null);
      setLatestCmj(null);
      return () => { active = false; };
    }
    setPassportLoading(true);
    Promise.all([
      loadPlayerEngagement({ playerId: player.id, teamId: team.id, seasonId: season?.id, seasonStart: season?.starts_on }),
      supabase.from('performance_tests').select('id,test_type,value,unit,tested_on').eq('player_id', player.id).eq('test_type', 'CMJ').order('tested_on', { ascending: false }).limit(1).maybeSingle()
    ]).then(([progress, cmjResult]) => {
      if (!active) return;
      setEngagement(progress);
      if (!cmjResult.error) setLatestCmj(cmjResult.data || null);
    }).catch((nextError) => {
      if (active) setError(nextError?.message || 'No se pudo cargar el pasaporte deportivo.');
    }).finally(() => {
      if (active) setPassportLoading(false);
    });
    return () => { active = false; };
  }, [open, profile?.role, player?.id, team?.id, season?.id, season?.starts_on]);

  useEffect(() => {
    let active = true;
    const path = player?.avatar_path || profile?.avatar_path;
    if (!open || !path) {
      setAvatarUrl('');
      return () => { active = false; };
    }
    supabase.storage.from('avatars').createSignedUrl(path, 3600).then(({ data }) => {
      if (active) setAvatarUrl(data?.signedUrl || '');
    });
    return () => { active = false; };
  }, [open, player?.avatar_path, profile?.avatar_path]);

  const initials = useMemo(() => {
    const source = profile?.full_name || profile?.username || 'VB';
    return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }, [profile]);

  if (!open) return null;

  function chooseAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !player?.id || !player?.club_id || profile?.role !== 'player') return;
    if (!file.type.startsWith('image/')) {
      setError('Selecciona una imagen válida.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('La foto no puede superar 8 MB.');
      return;
    }
    setError('');
    setAvatarCropFile(file);
  }

  async function saveCroppedAvatar(blob) {
    if (!blob || !player?.id || !player?.club_id || profile?.role !== 'player' || avatarSaving) return;
    setAvatarSaving(true);
    setError('');
    setSaved(false);
    try {
      const nextPath = `${player.club_id}/${player.id}/avatar-${Date.now()}.jpg`;
      const previousPath = player.avatar_path || profile.avatar_path || '';
      const { error: uploadError } = await supabase.storage.from('avatars').upload(nextPath, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg'
      });
      if (uploadError) throw uploadError;

      const [{ error: playerError }, { error: profileError }] = await Promise.all([
        supabase.from('players').update({ avatar_path: nextPath }).eq('id', player.id),
        supabase.from('profiles').update({ avatar_path: nextPath }).eq('id', profile.id)
      ]);
      if (playerError || profileError) throw playerError || profileError;

      const { data, error: signedError } = await supabase.storage.from('avatars').createSignedUrl(nextPath, 3600);
      if (signedError) throw signedError;
      setAvatarUrl(data?.signedUrl || '');
      setAvatarCropFile(null);
      window.dispatchEvent(new CustomEvent('volleycoach:player-directory-updated', { detail: { playerId: player.id } }));
      await refreshIdentity();
      if (previousPath && previousPath !== nextPath) void supabase.storage.from('avatars').remove([previousPath]);
      setSaved(true);
    } catch (nextError) {
      setError(nextError?.message || 'No se pudo actualizar la foto.');
    } finally {
      setAvatarSaving(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (saving || !profile?.id) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const cleanName = fullName.trim();
      if (!cleanName) throw new Error('El nombre no puede estar vacío.');
      const { error: profileError } = await supabase.from('profiles').update({ full_name: cleanName }).eq('id', profile.id);
      if (profileError) throw profileError;

      if (profile.role === 'player' && player?.id) {
        const nextDorsal = dorsal === '' ? null : Number(dorsal);
        if (nextDorsal !== null && (!Number.isInteger(nextDorsal) || nextDorsal < 0 || nextDorsal > 99)) throw new Error('El dorsal debe ser un número entre 0 y 99.');
        const { error: playerError } = await supabase.from('players').update({ display_name: cleanName, dorsal: nextDorsal, birth_date: birthDate || null, position: position.trim() }).eq('id', player.id);
        if (playerError) throw playerError;
      }

      if (newPassword || currentPassword || confirmPassword) {
        if (!currentPassword) throw new Error('Introduce tu contraseña actual para cambiarla.');
        if (newPassword.length < 6) throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
        if (newPassword !== confirmPassword) throw new Error('Las contraseñas nuevas no coinciden.');
        const email = identity?.authUser?.email;
        if (!email) throw new Error('No se pudo verificar tu cuenta.');
        const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
        if (verifyError) throw new Error('La contraseña actual no es correcta.');
        const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
        if (passwordError) throw passwordError;
      }

      await refreshIdentity();
      if (profile.role === 'player' && player?.id) {
        window.dispatchEvent(new CustomEvent('volleycoach:player-directory-updated', { detail: { playerId: player.id } }));
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
    } catch (nextError) {
      setError(nextError?.message || 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  const latestWellness = engagement?.latestWellness;
  const unlocked = engagement?.achievements?.filter((item) => item.unlocked) || [];
  const nextAchievement = engagement?.achievements?.find((item) => !item.unlocked) || null;
  const habitsDone = engagement?.missions?.filter((mission) => mission.done).length || 0;

  return (
    <div className="profile-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving && !avatarSaving) onClose();
    }}>
      <section className={`profile-modal ${profile?.role === 'player' ? 'profile-passport-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <header className="profile-modal-header">
          <div><p className="eyebrow">Cuenta personal</p><h2 id="profile-title">Mi Perfil</h2></div>
          <button className="icon-button" type="button" onClick={onClose} disabled={saving || avatarSaving} aria-label="Cerrar perfil"><X /></button>
        </header>

        <div className="profile-modal-scroll">
          {profile?.role === 'player' ? (
            <>
              <section className="profile-passport-hero">
                <div className="profile-passport-main">
                  <button className="profile-passport-avatar-button" type="button" onClick={() => avatarInput.current?.click()} disabled={avatarSaving} title="Cambiar foto">
                    {avatarUrl ? <img src={avatarUrl} alt="" /> : <span className="profile-passport-avatar-fallback">{initials}</span>}
                    <span className="profile-passport-camera"><Camera size={15} /></span>
                    {avatarSaving ? <span className="profile-passport-uploading"><LoaderCircle className="spin" size={22} /></span> : null}
                  </button>
                  <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={chooseAvatar} />
                  <div className="profile-passport-identity">
                    <p className="eyebrow">Player Passport · {season?.name || 'Temporada actual'}</p>
                    <h2>{profile?.full_name || profile?.username}</h2>
                    <span>@{profile?.username}</span>
                    <div className="profile-passport-tags"><span>#{player?.dorsal ?? '—'}</span><span>{player?.position || 'Sin posición'}</span><span>{team?.category || team?.name || 'CV Bunyola'}</span></div>
                  </div>
                </div>
                <div className="profile-passport-level">
                  {passportLoading ? <small>Cargando progreso…</small> : (
                    <>
                      <div className="profile-passport-level-row"><strong><Sparkles size={14} /> {engagement?.level || 'Inicio'}</strong><span>{engagement?.xp || 0} XP</span></div>
                      <div className="profile-passport-track"><span style={{ width: `${engagement?.levelProgress || 0}%` }} /></div>
                      <small>{engagement?.nextLevel ? `Faltan ${engagement.pointsToNext} XP para ${engagement.nextLevel}.` : 'Nivel máximo de esta temporada alcanzado.'}</small>
                    </>
                  )}
                </div>
              </section>

              <section className="profile-passport-metrics">
                <div className="profile-passport-metric"><CalendarCheck2 size={17} /><strong>{engagement?.totalAttended ?? '—'}</strong><span>Entrenamientos</span></div>
                <div className="profile-passport-metric"><Flame size={17} /><strong>{engagement?.currentStreak ?? '—'}</strong><span>Racha asistencia</span></div>
                <div className="profile-passport-metric"><Award size={17} /><strong>{engagement ? `${engagement.attendanceRatio}%` : '—'}</strong><span>Asistencia</span></div>
                <div className="profile-passport-metric"><HeartPulse size={17} /><strong>{engagement?.wellnessCount ?? '—'}</strong><span>Bienestar</span></div>
                <div className="profile-passport-metric"><CheckCircle2 size={17} /><strong>{engagement ? `${habitsDone}/${engagement.missions.length}` : '—'}</strong><span>Hábitos</span></div>
                <div className="profile-passport-metric"><Trophy size={17} /><strong>{engagement?.matches ?? '—'}</strong><span>Partidos</span></div>
              </section>

              <div className="profile-passport-columns">
                <div className="profile-passport-column">
                  <section className="profile-passport-panel">
                    <div className="profile-passport-panel-head"><div><span>Seguimiento</span><h3>Actividad reciente</h3></div><Activity size={18} /></div>
                    <div className="profile-passport-activities">
                      {(engagement?.activities || []).slice(0, 6).map((item, index) => (
                        <div className="profile-passport-activity" key={`${item.action}-${item.referenceId}-${index}`}>
                          <span><ActivityIcon action={item.action} /></span>
                          <div><strong>{item.label}</strong><small>{shortDate(item.occurredAt)}</small></div>
                          <b>+{item.amount} XP</b>
                        </div>
                      ))}
                      {!passportLoading && !(engagement?.activities || []).length ? <small>Aún no hay actividad de gamificación registrada.</small> : null}
                    </div>
                  </section>

                  <section className="profile-passport-panel">
                    <div className="profile-passport-panel-head"><div><span>Constancia</span><h3>Hitos e insignias</h3></div><Award size={18} /></div>
                    <div className="profile-passport-badges">
                      {(engagement?.achievements || []).slice(0, 8).map((item) => (
                        <div className={`profile-passport-badge ${item.unlocked ? 'is-unlocked' : ''}`} key={item.id}>
                          <div className="profile-passport-badge-top"><span>{item.unlocked ? <Trophy size={14} /> : <Award size={14} />}</span><strong>{item.title}</strong></div>
                          <small>{item.description}</small>
                          <div className="profile-passport-badge-progress"><span style={{ width: `${item.progress}%` }} /></div>
                        </div>
                      ))}
                    </div>
                    {nextAchievement ? <p className="profile-passport-next">Próximo hito: <strong>{nextAchievement.title}</strong> · {nextAchievement.progressText}</p> : unlocked.length ? <p className="profile-passport-next">Todos los hitos disponibles están desbloqueados.</p> : null}
                  </section>
                </div>

                <aside className="profile-passport-column">
                  <section className="profile-passport-panel">
                    <div className="profile-passport-panel-head"><div><span>Estado actual</span><h3>Último bienestar</h3></div><HeartPulse size={18} /></div>
                    {latestWellness ? (
                      <><div className="profile-passport-wellness"><div><small>Fatiga</small><strong>{latestWellness.fatigue ?? '—'}/5</strong></div><div><small>Sueño</small><strong>{sleepLabel(latestWellness.sleep)}</strong></div><div><small>Molestias</small><strong>{latestWellness.pain_score ?? 0}/10</strong></div></div><p className="profile-passport-wellness-date">Último registro · {shortDate(`${latestWellness.entry_date}T12:00:00`)}</p></>
                    ) : <small>Sin registro reciente de bienestar.</small>}
                  </section>

                  <section className="profile-passport-panel">
                    <div className="profile-passport-panel-head"><div><span>Rendimiento</span><h3>Salto CMJ</h3></div><Dumbbell size={18} /></div>
                    <div className="profile-passport-cmj"><div><Dumbbell size={17} /><span>Último registro</span></div><div><strong>{latestCmj ? `${Number(latestCmj.value).toFixed(0)} ${latestCmj.unit || 'cm'}` : 'Pendiente'}</strong><small>{latestCmj ? shortDate(`${latestCmj.tested_on}T12:00:00`) : 'Sin medición'}</small></div></div>
                  </section>
                </aside>
              </div>

              <details className="profile-passport-edit">
                <summary>Editar datos personales y seguridad</summary>
                <form className="profile-form" onSubmit={saveProfile}>
                  <div className="form-section">
                    <div className="form-section-title"><UserRound size={18} /><span>Datos personales</span></div>
                    <label><span>Nombre completo</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={saving} /></label>
                    <div className="two-column-fields"><label><span>Dorsal</span><input inputMode="numeric" value={dorsal} onChange={(event) => setDorsal(event.target.value)} disabled={saving} /></label><label><span>Posición</span><input value={position} onChange={(event) => setPosition(event.target.value)} disabled={saving} /></label></div>
                    <label><span>Fecha de nacimiento</span><input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} disabled={saving} /></label>
                  </div>
                  <div className="form-section">
                    <div className="form-section-title"><LockKeyhole size={18} /><span>Cambiar contraseña</span></div>
                    <div className="profile-password-grid"><label><span>Contraseña actual</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label><span>Nueva contraseña</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label><span>Repetir nueva contraseña</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label></div>
                  </div>
                  {error ? <p className="form-error" role="alert">{error}</p> : null}
                  {saved ? <p className="form-success" role="status">Cambios guardados correctamente.</p> : null}
                  <div className="profile-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cerrar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
                </form>
              </details>
            </>
          ) : (
            <>
              <div className="profile-identity-card"><span className="profile-avatar">{initials}</span><div><strong>{profile?.full_name || profile?.username}</strong><span>@{profile?.username}</span><small><ShieldCheck size={14} /> {ROLE_LABELS[profile?.role] || profile?.role}</small></div></div>
              <div className="coach-profile-note profile-passport-staff-note"><ShieldCheck size={19} /><div><strong>Perfil de {ROLE_LABELS[profile?.role]?.toLowerCase() || 'staff'}</strong><span>La gamificación se reserva a las jugadoras y premia hábitos de participación.</span></div></div>
              <form className="profile-form" onSubmit={saveProfile}>
                <div className="form-section"><div className="form-section-title"><UserRound size={18} /><span>Datos personales</span></div><label><span>Nombre completo</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} /></label><label><span>Equipo</span><input value={team?.category || team?.name || 'Sin equipo asignado'} disabled /></label></div>
                <div className="form-section"><div className="form-section-title"><LockKeyhole size={18} /><span>Cambiar contraseña</span></div><div className="profile-password-grid"><label><span>Contraseña actual</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label><span>Nueva contraseña</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><label><span>Repetir nueva contraseña</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label></div></div>
                {error ? <p className="form-error">{error}</p> : null}{saved ? <p className="form-success">Cambios guardados correctamente.</p> : null}
                <div className="profile-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
              </form>
            </>
          )}
        </div>
      </section>
      <AvatarCropDialog
        file={avatarCropFile}
        saving={avatarSaving}
        onCancel={() => { if (!avatarSaving) setAvatarCropFile(null); }}
        onConfirm={saveCroppedAvatar}
      />
    </div>
  );
}
