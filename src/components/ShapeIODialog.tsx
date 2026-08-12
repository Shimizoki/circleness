import { useEffect, useId, useMemo, useState } from 'react';
import type { Point } from '../grading';
import {
  parseShapeText,
  placeShapeOnCanvas,
  serializeShape,
  toNormalizedShape,
} from '../shapes';

type ShapeIODialogProps = {
  open: boolean;
  onClose: () => void;
  points: Point[];
  canvasWidth: number;
  canvasHeight: number;
  onImport: (points: Point[]) => void;
};

export function ShapeIODialog({
  open,
  onClose,
  points,
  canvasWidth,
  canvasHeight,
  onImport,
}: ShapeIODialogProps) {
  const titleId = useId();
  const center = useMemo(
    () => ({ x: canvasWidth / 2, y: canvasHeight / 2 }),
    [canvasHeight, canvasWidth],
  );

  const exported = useMemo(() => {
    if (points.length === 0 || canvasWidth === 0) {
      return '{\n  "points": []\n}\n';
    }
    return serializeShape(toNormalizedShape(points, center));
  }, [canvasWidth, center, points]);

  const [text, setText] = useState(exported);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText(exported);
    setError(null);
    setCopied(false);
  }, [exported, open]);

  if (!open) return null;

  const handleLoad = () => {
    try {
      const doc = parseShapeText(text);
      if (canvasWidth === 0 || canvasHeight === 0) {
        throw new Error('Canvas is not ready yet');
      }
      const placed = placeShapeOnCanvas(doc.points, canvasWidth, canvasHeight);
      onImport(placed);
      setError(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import shape');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(null);
    } catch {
      setError('Could not copy to clipboard');
    }
  };

  const handleUseDrawing = () => {
    setText(exported);
    setError(null);
    setCopied(false);
  };

  return (
    <div className="shape-io-scrim" role="presentation" onClick={onClose}>
      <div
        className="shape-io-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shape-io-header">
          <h2 id={titleId} className="shape-io-title">
            Import / export shape
          </h2>
          <p className="shape-io-hint">
            Points use a shared coordinate system with the center at (0, 0) and
            max radius ≈ 1. Paste JSON to load, or copy your drawing to share.
          </p>
        </div>

        <textarea
          className="shape-io-textarea"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCopied(false);
            setError(null);
          }}
          spellCheck={false}
          aria-label="Shape JSON"
        />

        {error && <p className="shape-io-error">{error}</p>}

        <div className="shape-io-actions">
          <button
            type="button"
            className="overlay-btn shape-io-secondary"
            onClick={handleUseDrawing}
            disabled={points.length === 0}
          >
            From drawing
          </button>
          <button
            type="button"
            className="overlay-btn shape-io-secondary"
            onClick={handleCopy}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="overlay-btn" onClick={handleLoad}>
            Load onto canvas
          </button>
        </div>
      </div>
    </div>
  );
}
