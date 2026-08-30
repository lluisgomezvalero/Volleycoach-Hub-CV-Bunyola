import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import './AvatarCropDialog.css';

const STAGE_SIZE = 260;
const OUTPUT_SIZE = 640;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function AvatarCropDialog({ file, saving = false, onCancel, onConfirm }) {
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const [url, setUrl] = useState('');
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!file) {
      setUrl('');
      return undefined;
    }
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  const geometry = useMemo(() => {
    const baseScale = Math.max(STAGE_SIZE / naturalSize.width, STAGE_SIZE / naturalSize.height);
    const scale = baseScale * zoom;
    const width = naturalSize.width * scale;
    const height = naturalSize.height * scale;
    return {
      scale,
      width,
      height,
      limitX: Math.max(0, (width - STAGE_SIZE) / 2),
      limitY: Math.max(0, (height - STAGE_SIZE) / 2)
    };
  }, [naturalSize, zoom]);

  useEffect(() => {
    setOffset((current) => ({
      x: clamp(current.x, -geometry.limitX, geometry.limitX),
      y: clamp(current.y, -geometry.limitY, geometry.limitY)
    }));
  }, [geometry.limitX, geometry.limitY]);

  if (!file) return null;

  function updateZoom(nextZoom) {
    setZoom(clamp(Number(nextZoom), 1, 3));
  }

  function pointerDown(event) {
    if (saving) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: offset.x,
      originY: offset.y
    };
  }

  function pointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset({
      x: clamp(drag.originX + event.clientX - drag.x, -geometry.limitX, geometry.limitX),
      y: clamp(drag.originY + event.clientY - drag.y, -geometry.limitY, geometry.limitY)
    });
  }

  function pointerUp(event) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  async function confirmCrop() {
    const image = imageRef.current;
    if (!image || saving) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    if (!context) return;

    const factor = OUTPUT_SIZE / STAGE_SIZE;
    const drawWidth = geometry.width * factor;
    const drawHeight = geometry.height * factor;
    const centerX = OUTPUT_SIZE / 2 + offset.x * factor;
    const centerY = OUTPUT_SIZE / 2 + offset.y * factor;
    context.drawImage(
      image,
      centerX - drawWidth / 2,
      centerY - drawHeight / 2,
      drawWidth,
      drawHeight
    );

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (blob) await onConfirm(blob);
  }

  return (
    <div className="avatar-crop-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onCancel();
    }}>
      <section className="avatar-crop-dialog" role="dialog" aria-modal="true" aria-label="Ajustar foto de perfil">
        <header>
          <div><strong>Ajustar foto</strong><small>Arrastra para encuadrar y usa el zoom.</small></div>
          <button type="button" className="icon-button" onClick={onCancel} disabled={saving} aria-label="Cancelar"><X size={19} /></button>
        </header>

        <div
          className="avatar-crop-stage"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
        >
          {url ? (
            <img
              ref={imageRef}
              src={url}
              alt=""
              draggable="false"
              onLoad={(event) => setNaturalSize({
                width: event.currentTarget.naturalWidth || 1,
                height: event.currentTarget.naturalHeight || 1
              })}
              style={{
                width: `${geometry.width}px`,
                height: `${geometry.height}px`,
                left: `${STAGE_SIZE / 2 + offset.x}px`,
                top: `${STAGE_SIZE / 2 + offset.y}px`
              }}
            />
          ) : null}
          <span className="avatar-crop-mask" aria-hidden="true" />
        </div>

        <div className="avatar-crop-controls">
          <button type="button" onClick={() => updateZoom(zoom - 0.1)} disabled={saving || zoom <= 1} aria-label="Alejar"><Minus size={17} /></button>
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(event) => updateZoom(event.target.value)}
            aria-label="Zoom de la foto"
            disabled={saving}
          />
          <button type="button" onClick={() => updateZoom(zoom + 0.1)} disabled={saving || zoom >= 3} aria-label="Acercar"><Plus size={17} /></button>
        </div>

        <div className="avatar-crop-actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button className="primary-button" type="button" onClick={confirmCrop} disabled={saving}>
            <Check size={17} /> {saving ? 'Guardando…' : 'Usar esta foto'}
          </button>
        </div>
      </section>
    </div>
  );
}
