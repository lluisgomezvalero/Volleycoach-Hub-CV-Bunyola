import { useEffect } from 'react';

const modalState = new WeakMap();

function ensureState(modal) {
  if (!modalState.has(modal)) modalState.set(modal, { fatigue: false, sleep: false });
  return modalState.get(modal);
}

function groupForButton(modal, button) {
  const field = button.closest('.player-checkin-field');
  if (!field) return null;
  const fields = Array.from(modal.querySelectorAll(':scope > .player-checkin-field'));
  const index = fields.indexOf(field);
  if (index === 0) return 'fatigue';
  if (index === 1) return 'sleep';
  return null;
}

function markPressedButton(modal, button) {
  const field = button.closest('.player-checkin-field');
  if (!field) return;
  field.querySelectorAll('.player-checkin-scale button').forEach((item) => {
    const pressed = item === button;
    item.classList.toggle('selected', pressed);
    item.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  });
}

function paintModal(modal) {
  if (!modal?.isConnected) return;
  const state = ensureState(modal);
  const fields = Array.from(modal.querySelectorAll(':scope > .player-checkin-field'));

  [['fatigue', fields[0]], ['sleep', fields[1]]].forEach(([key, field]) => {
    if (!field || state[key]) return;
    field.querySelectorAll('.player-checkin-scale button').forEach((button) => {
      button.classList.remove('selected');
      button.setAttribute('aria-pressed', 'false');
    });
  });

  const submit = modal.querySelector('.player-checkin-submit');
  if (!submit) return;

  const complete = state.fatigue && state.sleep;
  if (!submit.dataset.selectionGuardDefaultLabel) {
    submit.dataset.selectionGuardDefaultLabel = submit.textContent || 'Guardar bienestar';
  }

  if (!complete) {
    submit.disabled = true;
    submit.setAttribute('aria-disabled', 'true');
    if (!/Guardando|Guardado/i.test(submit.textContent || '')) {
      submit.textContent = 'Selecciona fatiga y sueño';
    }
    return;
  }

  if (!/Guardando|Guardado/i.test(submit.textContent || '')) {
    submit.disabled = false;
    submit.removeAttribute('aria-disabled');
    submit.textContent = submit.dataset.selectionGuardDefaultLabel || 'Guardar bienestar';
  }
}

function paintAll() {
  document.querySelectorAll('.player-checkin-modal').forEach((modal) => paintModal(modal));
}

export default function WellnessRequiredSelectionGuard() {
  useEffect(() => {
    let frame = null;
    const schedulePaint = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        paintAll();
      });
    };

    const onClickCapture = (event) => {
      const button = event.target.closest?.('.player-checkin-scale button');
      if (!button) return;
      const modal = button.closest('.player-checkin-modal');
      if (!modal) return;
      const group = groupForButton(modal, button);
      if (!group) return;
      const state = ensureState(modal);
      state[group] = true;

      // React conserva internamente 2/3 como valores iniciales. Si la primera pulsación
      // coincide justo con ese valor, React no vuelve a renderizar porque el estado no
      // cambia. Marcamos explícitamente el botón pulsado para que esa primera selección
      // se vea siempre, tanto en fatiga como en sueño.
      window.requestAnimationFrame(() => {
        if (!modal.isConnected) return;
        markPressedButton(modal, button);
        paintModal(modal);
      });
      schedulePaint();
    };

    document.addEventListener('click', onClickCapture, true);
    const root = document.getElementById('root');
    const observer = new MutationObserver(schedulePaint);
    if (root) observer.observe(root, { childList: true, subtree: true });
    schedulePaint();

    return () => {
      document.removeEventListener('click', onClickCapture, true);
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
