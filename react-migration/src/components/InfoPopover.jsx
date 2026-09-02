import { useEffect, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';
import './InfoPopover.css';

export default function InfoPopover({ children, label = 'Más información', align = 'right' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span className={`app-info-popover-root align-${align}`} ref={rootRef}>
      <button
        type="button"
        className="app-info-popover-trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Info size={16} />
      </button>
      {open ? (
        <span className="app-info-popover-card" role="dialog" aria-label={label}>
          <span className="app-info-popover-copy">{children}</span>
          <button type="button" className="app-info-popover-close" aria-label="Cerrar información" onClick={() => setOpen(false)}>
            <X size={14} />
          </button>
        </span>
      ) : null}
    </span>
  );
}
