import { useEffect, useRef } from 'react';
import {
  getGrader,
  type DrawingInput,
  type Point,
} from '../grading';
import { chartHeightForPanel } from '../grading/charts';
import {
  areaCentroid,
  distance,
  maxInscribedCircle,
  mean,
  minEnclosingCircle,
  sampleAlongPath,
  strokeAsPolygon,
} from '../grading/geometry';
import { idealCurvatureCircle } from '../grading/curvature';
import { equalAreaCircle } from '../grading/isoperimetric';
import { RADIAL_SAMPLE_COUNT } from '../grading/radialShared';

const STROKE_WIDTH = 2.5;
const STROKE_COLOR = '#1a1a18';
const FIT_PADDING_PX = 48;
const CONTENT_MARGIN = 8;

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type GradeVizOverlayProps = {
  graderId: string | null;
  input: DrawingInput;
};

function emptyBounds(): Bounds {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function includePoint(bounds: Bounds, x: number, y: number): void {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
}

function includeCircle(
  bounds: Bounds,
  center: Point,
  radius: number,
): void {
  includePoint(bounds, center.x - radius, center.y - radius);
  includePoint(bounds, center.x + radius, center.y + radius);
}

function shiftBounds(bounds: Bounds, shift: Point): Bounds {
  return {
    minX: bounds.minX + shift.x,
    minY: bounds.minY + shift.y,
    maxX: bounds.maxX + shift.x,
    maxY: bounds.maxY + shift.y,
  };
}

function strokeBounds(points: Point[]): Bounds {
  const bounds = emptyBounds();
  for (const p of points) includePoint(bounds, p.x, p.y);
  return bounds;
}

function isValidBounds(bounds: Bounds): boolean {
  return (
    Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.minY) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.maxY)
  );
}

function finalizeBounds(bounds: Bounds): Bounds {
  bounds.minX -= CONTENT_MARGIN;
  bounds.minY -= CONTENT_MARGIN;
  bounds.maxX += CONTENT_MARGIN;
  bounds.maxY += CONTENT_MARGIN;

  const minSpan = 40;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width < minSpan) {
    const pad = (minSpan - width) / 2;
    bounds.minX -= pad;
    bounds.maxX += pad;
  }
  if (height < minSpan) {
    const pad = (minSpan - height) / 2;
    bounds.minY -= pad;
    bounds.maxY += pad;
  }
  return bounds;
}

function contentBounds(
  graderId: string | null,
  input: DrawingInput,
  shift: Point,
): Bounds {
  const { points, center } = input;
  let bounds = strokeBounds(points);

  if (!isValidBounds(bounds)) {
    return {
      minX: center.x - 50,
      minY: center.y - 50,
      maxX: center.x + 50,
      maxY: center.y + 50,
    };
  }

  if (
    (graderId === 'radial-distance' || graderId === 'centroid-radial') &&
    points.length >= 2
  ) {
    const origin =
      graderId === 'centroid-radial' ? areaCentroid(points) : center;
    includePoint(bounds, origin.x, origin.y);
    const samples = sampleAlongPath(points, RADIAL_SAMPLE_COUNT);
    const radius = mean(samples.map((p) => distance(p, origin)));
    if (radius > 0) includeCircle(bounds, origin, radius);
  }

  if (graderId === 'circumcircle-area' && points.length >= 2) {
    const circum = minEnclosingCircle(points);
    includeCircle(bounds, circum.center, circum.radius);
  }

  if (graderId === 'isoperimetric' && points.length >= 3) {
    const ref = equalAreaCircle(strokeAsPolygon(points));
    if (ref) includeCircle(bounds, ref.center, ref.radius);
  }

  if (graderId === 'curvature') {
    const ideal = idealCurvatureCircle(points);
    if (ideal) includeCircle(bounds, ideal.center, ideal.radius);
    bounds.minX -= 50;
    bounds.minY -= 50;
    bounds.maxX += 50;
    bounds.maxY += 50;
  }

  bounds = shiftBounds(bounds, shift);
  if (
    graderId === 'centroid-radial' ||
    graderId === 'circumcircle-area' ||
    graderId === 'inscribed-area' ||
    graderId === 'isoperimetric'
  ) {
    includePoint(bounds, center.x, center.y);
  }

  return finalizeBounds(bounds);
}

function drawStroke(ctx: CanvasRenderingContext2D, points: Point[]) {
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

function drawCenterMark(
  ctx: CanvasRenderingContext2D,
  center: Point,
  scale: number,
) {
  const mark = 7 / scale;
  ctx.strokeStyle = 'rgba(26, 26, 24, 0.4)';
  ctx.lineWidth = 1.5 / scale;
  ctx.beginPath();
  ctx.moveTo(center.x - mark, center.y);
  ctx.lineTo(center.x + mark, center.y);
  ctx.moveTo(center.x, center.y - mark);
  ctx.lineTo(center.x, center.y + mark);
  ctx.stroke();
}

export function GradeVizOverlay({ graderId, input }: GradeVizOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const paint = () => {
      const dpr = window.devicePixelRatio || 1;
      const panelW = container.clientWidth;
      const panelH = container.clientHeight;
      if (panelW === 0 || panelH === 0) return;

      canvas.width = Math.floor(panelW * dpr);
      canvas.height = Math.floor(panelH * dpr);
      canvas.style.width = `${panelW}px`;
      canvas.style.height = `${panelH}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, panelW, panelH);

      const grader = graderId ? getGrader(graderId) : undefined;
      const shift = grader?.visualizationShift?.(input) ?? { x: 0, y: 0 };
      const showChart = Boolean(grader?.drawChart);
      const chartReserve = showChart ? chartHeightForPanel(panelH) : 0;
      const fitPad = panelH < 280 ? 20 : FIT_PADDING_PX;

      const bounds = contentBounds(graderId, input, shift);
      const contentW = Math.max(1, bounds.maxX - bounds.minX);
      const contentH = Math.max(1, bounds.maxY - bounds.minY);

      const availW = Math.max(1, panelW - fitPad * 2);
      const availH = Math.max(1, panelH - chartReserve - fitPad * 2);
      const scale = Math.min(availW / contentW, availH / contentH);

      const offsetX = (panelW - contentW * scale) / 2 - bounds.minX * scale;
      const offsetY =
        (panelH - chartReserve - contentH * scale) / 2 - bounds.minY * scale;

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      ctx.translate(shift.x, shift.y);

      if (graderId === 'curvature' || graderId === 'centroid-radial') {
        drawCenterMark(ctx, areaCentroid(input.points), scale);
      } else if (graderId === 'circumcircle-area' && input.points.length >= 2) {
        drawCenterMark(ctx, minEnclosingCircle(input.points).center, scale);
      } else if (graderId === 'inscribed-area' && input.points.length >= 3) {
        drawCenterMark(
          ctx,
          maxInscribedCircle(strokeAsPolygon(input.points)).center,
          scale,
        );
      } else if (graderId === 'isoperimetric' && input.points.length >= 3) {
        const ref = equalAreaCircle(strokeAsPolygon(input.points));
        drawCenterMark(ctx, ref?.center ?? input.center, scale);
      } else {
        drawCenterMark(ctx, input.center, scale);
      }
      drawStroke(ctx, input.points);
      grader?.visualize(ctx, input);

      ctx.restore();

      if (grader?.drawChart) {
        grader.drawChart({ ctx, panelW, panelH }, input);
      }
    };

    paint();

    const observer = new ResizeObserver(paint);
    observer.observe(container);
    return () => observer.disconnect();
  }, [graderId, input]);

  return (
    <div ref={containerRef} className="results-viz-pane">
      <canvas ref={canvasRef} className="grade-viz-canvas" aria-hidden="true" />
    </div>
  );
}
