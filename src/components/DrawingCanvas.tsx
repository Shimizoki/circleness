import { useEffect, useRef } from 'react';
import type { Point } from '../grading';

const STROKE_WIDTH = 2.5;
const STROKE_COLOR = '#1a1a18';

type DrawingCanvasProps = {
  points: Point[];
  onPointsChange: (points: Point[]) => void;
  drawingEnabled: boolean;
  onSizeChange: (width: number, height: number) => void;
};

function redraw(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  points: Point[],
) {
  ctx.clearRect(0, 0, width, height);
  if (points.length === 0) return;

  if (points.length === 1) {
    ctx.beginPath();
    ctx.fillStyle = STROKE_COLOR;
    ctx.arc(points[0].x, points[0].y, STROKE_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.strokeStyle = STROKE_COLOR;
  ctx.lineWidth = STROKE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

export function DrawingCanvas({
  points,
  onPointsChange,
  drawingEnabled,
  onSizeChange,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef(points);
  const drawingRef = useRef(false);
  const drawingEnabledRef = useRef(drawingEnabled);
  const sizeRef = useRef({ width: 0, height: 0 });

  pointsRef.current = points;
  drawingEnabledRef.current = drawingEnabled;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const prev = sizeRef.current;
      const sizeChanged = prev.width !== width || prev.height !== height;
      sizeRef.current = { width, height };
      onSizeChange(width, height);

      // Canvas pixel coords are only valid for the current viewport. Clear the
      // in-progress stroke when the size changes during draw mode — submitted
      // shapes live in normalized unit space and are re-placed by App.
      if (sizeChanged && drawingEnabledRef.current) {
        drawingRef.current = false;
        onPointsChange([]);
        redraw(ctx, width, height, []);
      } else {
        redraw(ctx, width, height, pointsRef.current);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [onPointsChange, onSizeChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = sizeRef.current;
    if (width === 0 || height === 0) return;
    redraw(ctx, width, height, points);
  }, [points]);

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingEnabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    // One continuous stroke only — each press replaces the previous drawing.
    onPointsChange([pointerPos(e)]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingEnabled || !drawingRef.current) return;
    onPointsChange([...pointsRef.current, pointerPos(e)]);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="drawing-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'none', cursor: drawingEnabled ? 'crosshair' : 'default' }}
    />
  );
}
