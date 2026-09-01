import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';

function trainingLocation() {
  const raw = String(window.location.hash || '').replace(/^#/, '') || '/';
  const question = raw.indexOf('?');
  const pathname = question >= 0 ? raw.slice(0, question) : raw;
  const search = question >= 0 ? raw.slice(question + 1) : '';
  const params = new URLSearchParams(search);
  return {
    pathname,
    eventId: params.get('event') || '',
    mode: params.get('mode') || 'session'
  };
}

function normalize(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function dateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { full: '', time: '' };
  return {
    full: new Intl.DateTimeFormat('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(date),
    time: new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date)
  };
}

function visibleTrainingView() {
  const rollCall = document.querySelector('.rollcall-modal');
  if (rollCall) {
    return {
      mode: 'attendance',
      title: rollCall.querySelector('.rollcall-header h2')?.textContent || '',
      meta: rollCall.querySelector('.rollcall-header span')?.textContent || ''
    };
  }

  const detail = document.querySelector('.pro-session-page');
  if (detail) {
    return {
      mode: 'session',
      title: detail.querySelector('.pro-session-hero-card h1')?.textContent || '',
      meta: detail.querySelector('.pro-session-hero-card p')?.textContent || ''
    };
  }

  return { mode: 'list', title: '', meta: '' };
}

function eventMatchesView(event, view) {
  if (!event || view.mode === 'list') return false;
  if (normalize(event.title || 'Entrenamiento') !== normalize(view.title || 'Entrenamiento')) return false;
  const parts = dateParts(event.starts_at);
  const meta = normalize(view.meta);
  return (!parts.full || meta.includes(normalize(parts.full))) && (!parts.time || meta.includes(normalize(parts.time)));
}

function clickRollCallClose() {
  const modal = document.querySelector('.rollcall-modal');
  if (!modal) return;
  const headerClose = modal.querySelector('.rollcall-header .icon-button');
  if (headerClose) {
    headerClose.click();
    return;
  }
  const buttons = [...modal.querySelectorAll('button')];
  buttons.find((button) => normalize(button.textContent) === 'cerrar')?.click();
}

export default function MobileBackNavigation() {
  const { identity } = useAuth();
  const resolvingRef = useRef(false);
  const lastViewRef = useRef('list');
  const teamIds = (identity?.teams || []).map((team) => team.id).filter(Boolean);

  const resolveVisibleEvent = useCallback(async (view) => {
    if (!teamIds.length || resolvingRef.current || view.mode === 'list') return null;
    resolvingRef.current = true;
    try {
      const from = new Date(Date.now() - 180 * 86400000).toISOString();
      const to = new Date(Date.now() + 180 * 86400000).toISOString();
      const { data } = await supabase
        .from('events')
        .select('id,team_id,title,starts_at')
        .in('team_id', teamIds)
        .eq('event_type', 'training')
        .gte('starts_at', from)
        .lte('starts_at', to);
      return (data || []).find((event) => eventMatchesView(event, view)) || null;
    } finally {
      resolvingRef.current = false;
    }
  }, [teamIds.join('|')]);

  const syncVisibleRoute = useCallback(async () => {
    const current = trainingLocation();
    if (current.pathname !== '/training') return;
    const view = visibleTrainingView();
    lastViewRef.current = view.mode;
    if (view.mode === 'list') return;
    if (current.eventId && current.mode === view.mode) return;

    const event = await resolveVisibleEvent(view);
    if (!event?.id) return;
    const query = new URLSearchParams({ event: event.id, mode: view.mode });
    const nextHash = `#/training?${query.toString()}`;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  }, [resolveVisibleEvent]);

  useEffect(() => {
    if (!identity?.profile?.id) return undefined;
    let timer = 0;
    const scheduleSync = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void syncVisibleRoute(); }, 40);
    };
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleSync();
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [identity?.profile?.id, syncVisibleRoute]);

  useEffect(() => {
    if (!identity?.profile?.id) return undefined;

    const onDocumentClick = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      // Los accesos directos desde Inicio entraban directamente en el detalle y se
      // saltaban la lista de Entrenos al usar el botón Atrás del móvil. Insertamos
      // esa pantalla intermedia en el historial antes de que React Router navegue.
      const anchor = target.closest('a[href]');
      if (anchor) {
        try {
          const destination = new URL(anchor.href, window.location.href);
          if (destination.hash.startsWith('#/training?') && destination.hash.includes('event=')) {
            const current = trainingLocation();
            if (current.pathname !== '/training') {
              const listUrl = `${window.location.pathname}${window.location.search}#/training`;
              window.history.pushState({ ...(window.history.state || {}), volleyTrainingListBridge: true }, '', listUrl);
            }
          }
        } catch {
          // Un enlace ajeno a la app no necesita tratamiento especial.
        }
      }

      const sessionBack = target.closest('.pro-session-back');
      if (sessionBack) {
        const current = trainingLocation();
        if (current.pathname === '/training' && current.eventId && current.mode === 'session') {
          window.setTimeout(() => window.history.back(), 0);
        }
        return;
      }

      const rollCall = target.closest('.rollcall-modal');
      if (rollCall) {
        const closeButton = target.closest('.rollcall-header .icon-button, .rollcall-actions .secondary-button');
        if (closeButton) {
          const current = trainingLocation();
          if (current.pathname === '/training' && current.eventId && current.mode === 'attendance') {
            window.setTimeout(() => window.history.back(), 0);
          }
        }
      }
    };

    const onPopState = () => {
      window.setTimeout(() => {
        const current = trainingLocation();
        const rollCall = document.querySelector('.rollcall-modal');
        if (rollCall && (current.pathname !== '/training' || current.mode !== 'attendance')) {
          clickRollCallClose();
        }

        const detail = document.querySelector('.pro-session-page');
        if (detail && (current.pathname !== '/training' || !current.eventId)) {
          detail.querySelector('.pro-session-back')?.click();
        }
      }, 0);
    };

    document.addEventListener('click', onDocumentClick, true);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onDocumentClick, true);
      window.removeEventListener('popstate', onPopState);
    };
  }, [identity?.profile?.id]);

  return null;
}
