import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import imageCompression from 'browser-image-compression';
import './EventPosterCropModal.css';

// Event posters only ever use one shape — no aspect-ratio picker needed here
// (contrast with ImageScaleCropModal, which offers square/portrait/landscape).
const ASPECT = { w: 4, h: 5 };

const COMPRESSION_OPTIONS = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
};

const MIN_SCALE = 1;
const MAX_SCALE = 3;

/**
 * Full-screen pan/zoom crop tool for event posters — fixed 4:5 aspect ratio.
 * This is a deliberate copy of ImageScaleCropModal's pan/zoom/bake mechanics
 * (not a shared import) so that dropping the aspect picker here can never
 * affect the comment-photo crop flow, which still needs it.
 */
export default function EventPosterCropModal({ file, onCancel, onConfirm }) {
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [imgUrl, setImgUrl] = useState('');
    const [naturalSize, setNaturalSize] = useState(null);
    const [frameSize, setFrameSize] = useState({ w: 400, h: 500 });
    const [saving, setSaving] = useState(false);
    const [interacting, setInteracting] = useState(false);
    const [snapping, setSnapping] = useState(false);

    const imgRef = useRef(null);
    const frameRef = useRef(null);
    const dragRef = useRef(null);
    const pinchRef = useRef(null);

    useEffect(() => {
        const url = URL.createObjectURL(file);
        setImgUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    useEffect(() => {
        const computeFrame = () => {
            const maxW = Math.min(window.innerWidth * 0.8, 480);
            const maxH = window.innerHeight * 0.6;
            let w = maxW;
            let h = (w * ASPECT.h) / ASPECT.w;
            if (h > maxH) {
                h = maxH;
                w = (h * ASPECT.w) / ASPECT.h;
            }
            setFrameSize({ w, h });
        };
        computeFrame();
        window.addEventListener('resize', computeFrame);
        return () => window.removeEventListener('resize', computeFrame);
    }, []);

    const coverScale = naturalSize
        ? Math.max(frameSize.w / naturalSize.w, frameSize.h / naturalSize.h)
        : 1;
    const displayedScale = coverScale * scale;

    const handleImgLoad = (e) => {
        setNaturalSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
    };

    const correctBounds = useCallback((rawScale, rawOffset) => {
        if (!naturalSize) return;
        const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, rawScale));
        const totalScale = coverScale * clampedScale;
        const displayedW = naturalSize.w * totalScale;
        const displayedH = naturalSize.h * totalScale;
        const maxOffsetX = Math.max(0, (displayedW - frameSize.w) / 2);
        const maxOffsetY = Math.max(0, (displayedH - frameSize.h) / 2);

        const targetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, rawOffset.x));
        const targetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, rawOffset.y));

        setSnapping(true);
        setScale(clampedScale);
        setOffset({ x: targetX, y: targetY });
        window.setTimeout(() => setSnapping(false), 220);
    }, [coverScale, frameSize, naturalSize]);

    const onPointerDown = (e) => {
        if (e.pointerType === 'touch' && pinchRef.current) return;
        setInteracting(true);
        dragRef.current = { startX: e.clientX, startY: e.clientY, offset };
        e.target.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setOffset({ x: dragRef.current.offset.x + dx, y: dragRef.current.offset.y + dy });
    };
    const onPointerUp = () => {
        if (dragRef.current) {
            dragRef.current = null;
            correctBounds(scale, offset);
        }
        setInteracting(false);
    };

    const onTouchStart = (e) => {
        if (e.touches.length !== 2) return;
        setInteracting(true);
        const [t1, t2] = e.touches;
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        pinchRef.current = { startDist: dist, startScale: scale };
        dragRef.current = null;
    };
    const onTouchMove = (e) => {
        if (e.touches.length !== 2 || !pinchRef.current) return;
        e.preventDefault();
        const [t1, t2] = e.touches;
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const ratio = dist / pinchRef.current.startDist;
        setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchRef.current.startScale * ratio)));
    };
    const onTouchEnd = (e) => {
        if (e.touches.length < 2 && pinchRef.current) {
            pinchRef.current = null;
            correctBounds(scale, offset);
            setInteracting(false);
        }
    };

    const handleZoomSlider = (e) => {
        setInteracting(true);
        setScale(Number(e.target.value));
    };
    const handleZoomSliderRelease = () => correctBounds(scale, offset);

    const handleApply = useCallback(async () => {
        if (!imgRef.current || !naturalSize) return;
        setSaving(true);
        try {
            const { w: frameW, h: frameH } = frameSize;
            const sx = naturalSize.w / 2 - (frameW / 2 + offset.x) / displayedScale;
            const sy = naturalSize.h / 2 - (frameH / 2 + offset.y) / displayedScale;
            const sw = frameW / displayedScale;
            const sh = frameH / displayedScale;

            const outputW = 800;
            const outputH = Math.round((outputW * ASPECT.h) / ASPECT.w);

            const canvas = document.createElement('canvas');
            canvas.width = outputW;
            canvas.height = outputH;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, outputW, outputH);

            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
            const croppedFile = new File([blob], file.name, { type: 'image/jpeg' });
            const compressed = await imageCompression(croppedFile, COMPRESSION_OPTIONS);
            onConfirm(compressed);
        } finally {
            setSaving(false);
        }
    }, [displayedScale, file.name, frameSize, naturalSize, offset, onConfirm]);

    return createPortal(
        <div className="epc-overlay" onClick={onCancel}>
            <div className="epc-modal" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="epc-close-btn" onClick={onCancel} aria-label="Close">
                    ×
                </button>

                <h3 className="epc-title">Scale Poster</h3>

                <div
                    ref={frameRef}
                    className="epc-frame"
                    style={{ width: frameSize.w, height: frameSize.h }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    {imgUrl && (
                        <img
                            ref={imgRef}
                            src={imgUrl}
                            alt=""
                            className={`epc-frame-img${snapping ? ' is-snapping' : ''}`}
                            draggable={false}
                            onLoad={handleImgLoad}
                            style={{
                                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${displayedScale})`,
                                width: naturalSize ? naturalSize.w : 'auto',
                                height: naturalSize ? naturalSize.h : 'auto',
                            }}
                        />
                    )}

                    <div className={`epc-grid${interacting ? ' is-visible' : ''}`}>
                        {[1, 2].map((i) => (
                            <span key={`v${i}`} className="epc-grid-line epc-grid-line--v" style={{ left: `${(i * 100) / 3}%` }} />
                        ))}
                        {[1, 2].map((i) => (
                            <span key={`h${i}`} className="epc-grid-line epc-grid-line--h" style={{ top: `${(i * 100) / 3}%` }} />
                        ))}
                    </div>
                </div>

                <input
                    type="range"
                    className="epc-zoom-slider"
                    min={MIN_SCALE}
                    max={MAX_SCALE}
                    step="0.05"
                    value={scale}
                    onChange={handleZoomSlider}
                    onMouseUp={handleZoomSliderRelease}
                    onTouchEnd={handleZoomSliderRelease}
                />
                <div className="epc-actions">
                    <div className="duo-btn-wrap epc-apply-wrap">
                        <div className="duo-btn-pill" aria-hidden="true" />
                        <button
                            type="button"
                            className="epc-apply-btn duo-btn"
                            style={{ '--duo-shadow': 'rgb(150, 150, 150)' }}
                            onClick={handleApply}
                            disabled={saving || !naturalSize}
                        >
                            {saving ? 'Saving...' : 'Apply'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
