import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronRight, HeartPulse } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import './WellnessPlayerCheckin.css';
import './PlayerCheckinVisual.css';

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function useWellnessPlayerHost(enabled) {
  const [host, setHost] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setHost(null);
      return undefined;
    }

    let currentHost = null;
    let pendingMessage = null;
    let frame = null;

    const sync = () => {
      frame = null;
      const page = document.querySelector('.wellness-player-page');
      const header = page?.querySelector(':scope > .wellness-page-head');

      if (!page || !header) {
        if (pendingMessage) {
          pendingMessage.classList.remove('wellness-native-pending-hidden');
          pendingMessage = null;
        }
        if (currentHost && !currentHost.isConnected) {
          currentHost = null;
          setHost(null);
        }
        return;
      }

      let nextHost = document.getElementById('wellness-player-checkin-host');
      if (!nextHost || !nextHost.isConnected) {
        nextHost = document.createElement('div');
        nextHost.id = 'wellness-player-checkin-host';
        header.insertAdjacentElement('afterend', nextHost);
      } else if (nextHost.previousElementSibling !== header) {
        header.insertAdjacentElement('afterend', nextHost);
      }

      const nextPending = page.querySelector(':scope > .wellness-inline-empty');
      if (pendingMessage && pendingMessage !== nextPending) {
        pendingMessage.classList.remove('wellness-native-pending-hidden');
      }
      pendingMessage = nextPending || null;
      pendingMessage?.classList.add('wellness-native-pending-hidden');

      if (currentHost !== nextHost) {
        currentHost = nextHost;
        setHost(nextHost);
      }
    };

    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    const root = document.getElementById('root');
    const observer = new MutationObserver(schedule);
    if (root) observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      pendingMessage?.classList.remove('wellness-native-pending-hidden');
      if (currentHost?.isConnected) currentHost.remove();
      setHost(null);
    };
  }, [enabled]);

  return host;
}

export default function WellnessPlayerCheckin() {
  const { identity } = useAuth();
  const profile = identity?.profile;
  const team = identity?.teams?.[0] || null;
  const playerId = identity?.player?.id || null;
  const isPlayer = profile?.role === 'player';
  const host = useWellnessPlayerHost(Boolean(isPlayer && team?.id && playerId));

  const [loading, setLoading] = useState(true);
  const [hasToday, setHasToday] = useState(false);
  const [open, setOpen] = useState(false);
  const [fatigue, setFatigue] = useState(2);
  const [sleep, setSleep] = useState(3);
  const [pain, setPain] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => {
    if (!isPlayer || !playerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error: queryError } = await supabase
        .from('wellness_entries')
        .select('id')
        .eq('player_id', playerId)
        .eq('entry_date', localDateKey())
        .maybeSingle();
      if (queryError) throw queryError;
      setHasToday(Boolean(data?.id));
    } catch {
      // WellnessPage sigue siendo la fuente visual principal si esta comprobación auxiliar falla.
    } finally {
      setLoading(false);
    }
  }, [isPlayer, playerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openCheckin() {
    setError('');
    setSaved(false);
    setFatigue(2);
    setSleep(3);
    setPain(0);
    setNotes('');
    setOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    if (!playerId || saving) return;

    setSaving(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('wellness_entries').insert({
        player_id: playerId,
        entry_date: localDateKey(),
        general_state: fatigue,
        fatigue,
        sleep,
        pain_score: pain,
        notes: notes.trim()
      });

      if (insertError && insertError.code !== '23505') throw insertError;

      setHasToday(true);
      setSaved(true);
      window.dispatchEvent(new CustomEvent('volleycoach:wellness-updated'));
      window.setTimeout(() => window.location.reload(), 650);
    } catch (saveError) {
      setError(saveError?.message || 'No se pudo guardar el bienestar.');
    } finally {
      setSaving(false);
    }
  }

  if (!isPlayer || !team?.id || !playerId || !host || loading || hasToday) return null;

  return createPortal(
    <>
      <section className="wellness-card wellness-player-checkin-card">
        <span className="wellness-player-checkin-icon"><HeartPulse /></span>
        <div className="wellness-player-checkin-copy">
          <small>Bienestar pendiente</small>
          <h2>¿Cómo estás hoy?</h2>
          <p>Registra fatiga, sueño y molestias sin salir de Bienestar.</p>
        </div>
        <button type="button" className="wellness-player-checkin-button" onClick={openCheckin}>
          Responder ahora <ChevronRight size={16} />
        </button>
      </section>

      {open ? (
        <div className="player-checkin-backdrop wellness-player-checkin-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <form className="player-checkin-modal wellness-player-checkin-modal" onSubmit={submit}>
            <div className="player-checkin-head">
              <div><small>Bienestar diario</small><h3>¿Cómo estás hoy?</h3><p>Responde pensando en cómo te encuentras ahora mismo.</p></div>
              <button type="button" className="player-checkin-close" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
            </div>

            <div className="player-checkin-field">
              <div><strong>Fatiga</strong><span>1 = muy fresca · 5 = muy cansada</span></div>
              <div className="player-checkin-scale">
                {[1, 2, 3, 4, 5].map((value) => <button key={`f-${value}`} type="button" aria-pressed={fatigue === value} className={fatigue === value ? 'selected' : ''} onClick={() => setFatigue(value)}>{value}</button>)}
              </div>
            </div>

            <div className="player-checkin-field">
              <div><strong>Sueño</strong><span>1 = muy mal · 5 = muy bien</span></div>
              <div className="player-checkin-scale">
                {[1, 2, 3, 4, 5].map((value) => <button key={`s-${value}`} type="button" aria-pressed={sleep === value} className={sleep === value ? 'selected' : ''} onClick={() => setSleep(value)}>{value}</button>)}
              </div>
            </div>

            <div className="player-checkin-field">
              <div><strong>Molestias</strong><span>0 = nada · 10 = dolor máximo</span></div>
              <div className="player-checkin-pain"><input type="range" min="0" max="10" step="1" value={pain} onChange={(event) => setPain(Number(event.target.value))} /><strong>{pain}/10</strong></div>
            </div>

            <label className="player-checkin-notes"><span>¿Algo que quieras comentar? <small>Opcional</small></span><textarea rows="3" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Molestia concreta, poco descanso, sensaciones…" /></label>
            {error ? <div className="player-checkin-error">{error}</div> : null}
            {saved ? <div className="wellness-player-checkin-success"><CheckCircle2 size={17} /> Bienestar guardado</div> : null}
            <button className="player-checkin-submit" type="submit" disabled={saving || saved}>{saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar bienestar'}</button>
          </form>
        </div>
      ) : null}
    </>,
    host
  );
}
