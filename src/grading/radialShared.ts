import {
  clamp01,
  distance,
  mean,
  redGreen,
  sampleAlongPath,
  stddev,
} from './geometry';
import { drawResidualLineChart, type ChartSurface } from './charts';
import type { Point } from './types';

export const RADIAL_SAMPLE_COUNT = 64;

export type RadialResidual = {
  residual: number;
  meanRadius: number;
};

/** Distance-to-origin residuals vs mean radius (for the supporting chart). */
export function radialResiduals(
  points: Point[],
  origin: Point,
  sampleCount = RADIAL_SAMPLE_COUNT,
): RadialResidual[] {
  if (points.length < 2) return [];
  const samples = sampleAlongPath(points, sampleCount);
  const distances = samples.map((p) => distance(p, origin));
  const radius = mean(distances);
  if (radius < 1) return [];
  return distances.map((d) => ({
    residual: d - radius,
    meanRadius: radius,
  }));
}

export function drawRadialResidualChart(
  surface: ChartSurface,
  points: Point[],
  origin: Point,
  title: string,
): void {
  const rows = radialResiduals(points, origin);
  if (rows.length < 2) return;
  drawResidualLineChart(
    surface,
    title,
    rows.map((r) => r.residual),
    rows[0].meanRadius,
  );
}

/** Score radial consistency of arc-length samples about an origin. */
export function scoreRadialAbout(
  points: Point[],
  origin: Point,
  sampleCount = RADIAL_SAMPLE_COUNT,
): number {
  if (points.length < 2) return 0;

  const samples = sampleAlongPath(points, sampleCount);
  const distances = samples.map((p) => distance(p, origin));
  const radius = mean(distances);
  if (radius < 1) return 0;

  return clamp01(1 - stddev(distances, radius) / radius);
}

/** Draw mean-radius circle + red/green rays from origin to samples. */
export function visualizeRadialAbout(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  origin: Point,
  sampleCount = RADIAL_SAMPLE_COUNT,
): void {
  if (points.length < 2) return;

  const samples = sampleAlongPath(points, sampleCount);
  const distances = samples.map((p) => distance(p, origin));
  const radius = mean(distances);
  if (radius < 1) return;

  ctx.beginPath();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(47, 93, 80, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.arc(origin.x, origin.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < samples.length; i++) {
    const p = samples[i];
    const d = distances[i];
    const error = Math.abs(d - radius) / radius;
    const goodness = clamp01(1 - error / 0.35);
    const color = redGreen(goodness);

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.25;
    ctx.globalAlpha = 0.85;
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
