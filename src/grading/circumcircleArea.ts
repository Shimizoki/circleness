import {
  circleArea,
  clamp01,
  minEnclosingCircle,
  pathCircle,
  pathPolygon,
  polygonArea,
  strokeAsPolygon,
} from './geometry';
import { drawAreaPieChart } from './charts';
import type { DrawingInput, GradeResult, Grader, Point } from './types';

const MIN_POINTS = 8;

const SHAPE_COLOR = 'rgba(47, 93, 80, 0.85)';
const EXTRA_COLOR = 'rgba(196, 84, 60, 0.85)';

/**
 * Circumcircle (min enclosing circle) of the stroke vs drawing area.
 * Score = area(drawing) / area(circumcircle).
 */
function grade(input: DrawingInput): GradeResult {
  const { points } = input;

  if (points.length < MIN_POINTS) {
    return { id: 'circumcircle-area', label: 'Circumcircle area', score: 0 };
  }

  const polygon = strokeAsPolygon(points);
  const drawingArea = polygonArea(polygon);
  const circum = minEnclosingCircle(points);
  const circumArea = circleArea(circum.radius);

  if (drawingArea < 1 || circumArea < 1) {
    return { id: 'circumcircle-area', label: 'Circumcircle area', score: 0 };
  }

  const score = clamp01(drawingArea / circumArea);
  return { id: 'circumcircle-area', label: 'Circumcircle area', score };
}

function visualize(ctx: CanvasRenderingContext2D, input: DrawingInput): void {
  const { points } = input;
  if (points.length < 3) return;

  const polygon = strokeAsPolygon(points);
  const circum = minEnclosingCircle(points);
  if (circum.radius < 1) return;

  pathCircle(ctx, circum);
  ctx.fillStyle = 'rgba(196, 84, 60, 0.38)';
  ctx.fill();

  ctx.globalCompositeOperation = 'destination-out';
  pathPolygon(ctx, polygon);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  pathPolygon(ctx, polygon);
  ctx.fillStyle = 'rgba(47, 93, 80, 0.42)';
  ctx.fill();

  pathCircle(ctx, circum);
  ctx.strokeStyle = 'rgba(196, 84, 60, 0.95)';
  ctx.lineWidth = 2;
  ctx.stroke();

  pathPolygon(ctx, polygon);
  ctx.strokeStyle = 'rgba(26, 26, 24, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = 'rgba(196, 84, 60, 0.9)';
  ctx.arc(circum.center.x, circum.center.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function visualizationShift(input: DrawingInput): Point {
  const circum = minEnclosingCircle(input.points);
  return {
    x: input.center.x - circum.center.x,
    y: input.center.y - circum.center.y,
  };
}

export const circumcircleAreaGrader: Grader = {
  id: 'circumcircle-area',
  label: 'Circumcircle area',
  grade,
  visualize,
  visualizationShift,
  drawChart: (surface, input) => {
    const polygon = strokeAsPolygon(input.points);
    const drawingArea = polygonArea(polygon);
    const circum = minEnclosingCircle(input.points);
    const circumArea = circleArea(circum.radius);
    const outside = Math.max(0, circumArea - drawingArea);
    drawAreaPieChart(surface, 'shape area vs circumcircle', [
      { label: 'Shape', value: drawingArea, color: SHAPE_COLOR },
      { label: 'Outside shape', value: outside, color: EXTRA_COLOR },
    ]);
  },
};
