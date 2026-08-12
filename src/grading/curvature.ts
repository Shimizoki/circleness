import {
  areaCentroid,
  clamp01,
  distance,
  mean,
  polygonArea,
  redGreen,
  sampleAlongPath,
  sampleVerticesAlongPath,
  stddev,
  strokeAsPolygon,
  type Circle,
} from './geometry';
import { drawResidualLineChart } from './charts';
import type { DrawingInput, GradeResult, Grader, Point } from './types';

const MIN_POINTS = 12;
const SAMPLE_COUNT = 64;
/** Keeps CV finite when mean dθ/ds is near 0 (long straight tails, etc.). */
const RATE_EPS = 1e-3;
/** Graded shapes never display as exactly 0.00 (toFixed(2)). */
const SCORE_FLOOR = 0.01;

function wrapAngle(delta: number): number {
  let a = delta;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

type CurvatureSample = {
  from: Point;
  to: Point;
  mid: Point;
  /** Signed curvature κ ≈ dθ/ds */
  kappa: number;
};

type PolarSeries = {
  origin: Point;
  /** Arc length at each sample. */
  s: number[];
  /** Unwrapped polar angle about the origin. */
  theta: number[];
  /** Best-fit line θ ≈ intercept + slope * s */
  slope: number;
  intercept: number;
  /** Coefficient of determination for the linear fit. */
  r2: number;
};

/**
 * Estimate signed path curvature from equal arc-length samples.
 */
export function curvatureSamples(
  points: Point[],
  sampleCount = SAMPLE_COUNT,
): CurvatureSample[] {
  const samples = sampleAlongPath(points, sampleCount);
  if (samples.length < 3) return [];

  const tangents: number[] = [];
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    tangents.push(Math.atan2(b.y - a.y, b.x - a.x));
  }

  const out: CurvatureSample[] = [];
  for (let i = 1; i < tangents.length; i++) {
    const dTheta = wrapAngle(tangents[i] - tangents[i - 1]);
    const p0 = samples[i - 1];
    const p1 = samples[i];
    const p2 = samples[i + 1];
    const ds = (distance(p0, p1) + distance(p1, p2)) / 2;
    if (ds < 1e-6) continue;
    out.push({
      from: p0,
      to: p2,
      mid: p1,
      kappa: dTheta / ds,
    });
  }
  return out;
}

/** Unwrapped polar angle about arc-length centroid, plus linear fit stats. */
export function polarAngleSeries(points: Point[]): PolarSeries | null {
  const origin = areaCentroid(points);
  // Prefer on-vertex samples when the polyline is already dense/regular;
  // fall back to arc-length lerp for sparse hand strokes.
  const vertexSamples = sampleVerticesAlongPath(points, SAMPLE_COUNT);
  const samples =
    vertexSamples.length >= SAMPLE_COUNT * 0.75
      ? vertexSamples
      : sampleAlongPath(points, SAMPLE_COUNT);
  if (samples.length < 4) return null;

  const s: number[] = [0];
  const theta: number[] = [
    Math.atan2(samples[0].y - origin.y, samples[0].x - origin.x),
  ];

  for (let i = 1; i < samples.length; i++) {
    s.push(s[i - 1] + distance(samples[i - 1], samples[i]));
    const tPrev = Math.atan2(
      samples[i - 1].y - origin.y,
      samples[i - 1].x - origin.x,
    );
    const tCurr = Math.atan2(samples[i].y - origin.y, samples[i].x - origin.x);
    theta.push(theta[i - 1] + wrapAngle(tCurr - tPrev));
  }

  const n = theta.length;
  const meanS = mean(s);
  const meanT = mean(theta);
  let cov = 0;
  let varS = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const ds = s[i] - meanS;
    const dt = theta[i] - meanT;
    cov += ds * dt;
    varS += ds * ds;
    ssTot += dt * dt;
  }
  const slope = varS < 1e-12 ? 0 : cov / varS;
  const intercept = meanT - slope * meanS;

  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * s[i];
    ssRes += (theta[i] - pred) ** 2;
  }
  const r2 = ssTot < 1e-12 ? 1 : clamp01(1 - ssRes / ssTot);

  return { origin, s, theta, slope, intercept, r2 };
}

/**
 * Ideal circle for viz: mass centroid + equal-area radius (√(A/π)).
 * Matches the shape's enclosed area rather than 1/|mean κ|, which blows up
 * when the path winds and then unwinds (net dθ/ds ≈ 0).
 */
export function idealCurvatureCircle(points: Point[]): Circle | null {
  if (points.length < 3) return null;
  const polygon = strokeAsPolygon(points);
  const area = polygonArea(polygon);
  if (area < 1) return null;

  const radius = Math.sqrt(area / Math.PI);
  if (radius < 1) return null;
  return { center: areaCentroid(points), radius };
}

export type CurvatureResidual = {
  dx: number;
  residual: number;
  meanRate: number;
};

/**
 * Residual of centroid-relative dθ/ds from its mean (chart series).
 * Equivalent to how far each sample's angular rate is from the fitted slope.
 */
export function curvatureDerivativeResiduals(
  points: Point[],
): CurvatureResidual[] {
  const series = polarAngleSeries(points);
  if (!series || series.s.length < 3) return [];

  const rates: number[] = [];
  for (let i = 0; i < series.s.length - 1; i++) {
    const ds = series.s[i + 1] - series.s[i];
    if (ds < 1e-6) {
      rates.push(series.slope);
      continue;
    }
    rates.push((series.theta[i + 1] - series.theta[i]) / ds);
  }

  const avg = mean(rates);
  return rates.map((rate, i) => ({
    dx: i,
    residual: rate - avg,
    meanRate: avg,
  }));
}

/**
 * Grade how flat centroid-relative dθ/ds is — the same signal as the chart.
 *
 * R² on cumulative θ(s) is too soft: local rate errors are tiny next to a 2π
 * swing, so imperfect circles still score ~1. Instead we use the coefficient
 * of variation of dθ/ds: score = 1 - std(rate)/(|mean(rate)| + ε).
 *
 * A small denominator ε and score floor keep highly non-circular shapes
 * (e.g. tadpoles) near zero without hard-clamping to exactly 0.00.
 */
function grade(input: DrawingInput): GradeResult {
  const { points } = input;

  if (points.length < MIN_POINTS) {
    return { id: 'curvature', label: 'Curvature', score: 0 };
  }

  const series = polarAngleSeries(points);
  if (!series) {
    return { id: 'curvature', label: 'Curvature', score: 0 };
  }

  const residuals = curvatureDerivativeResiduals(points);
  if (residuals.length < 4) {
    return { id: 'curvature', label: 'Curvature', score: 0 };
  }

  const rates = residuals.map((r) => r.residual + r.meanRate);
  const avg = mean(rates);
  const absMean = Math.abs(avg);

  const cv = stddev(rates, avg) / (absMean + RATE_EPS);
  const flatness = clamp01(1 - cv);

  const totalTurn = series.theta[series.theta.length - 1] - series.theta[0];
  const turnScore = clamp01(
    1 - Math.abs(Math.abs(totalTurn) - 2 * Math.PI) / (2 * Math.PI),
  );

  const raw = clamp01(flatness * (0.9 + 0.1 * turnScore));
  const score = Math.max(SCORE_FLOOR, raw);
  return { id: 'curvature', label: 'Curvature', score };
}

function visualize(ctx: CanvasRenderingContext2D, input: DrawingInput): void {
  const { points } = input;
  const series = polarAngleSeries(points);
  const samples = curvatureSamples(points);
  if (!series || samples.length === 0) return;

  const ideal = idealCurvatureCircle(points);
  if (ideal) {
    ctx.beginPath();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(47, 93, 80, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.arc(ideal.center.x, ideal.center.y, ideal.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.fillStyle = 'rgba(47, 93, 80, 0.75)';
    ctx.arc(ideal.center.x, ideal.center.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Color by local deviation of centroid-relative dθ/ds from the mean rate.
  const absSlope = Math.max(Math.abs(series.slope), 1e-6);
  const rateByMid = curvatureDerivativeResiduals(points);
  // Map residual samples onto path segments via curvatureSamples order.
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const rateSample = rateByMid[Math.min(i, rateByMid.length - 1)];
    const localRate = rateSample
      ? rateSample.residual + rateSample.meanRate
      : s.kappa;
    const error = Math.abs(localRate - series.slope) / absSlope;
    const goodness = clamp01(1 - error / 1.0);
    const color = redGreen(goodness);

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.9;
    ctx.moveTo(s.from.x, s.from.y);
    ctx.lineTo(s.mid.x, s.mid.y);
    ctx.lineTo(s.to.x, s.to.y);
    ctx.stroke();

    const tx = s.to.x - s.from.x;
    const ty = s.to.y - s.from.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    const tick = 10 + 40 * Math.min(1, Math.abs(s.kappa) * 40);
    const sign = s.kappa >= 0 ? 1 : -1;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.moveTo(s.mid.x, s.mid.y);
    ctx.lineTo(s.mid.x + nx * tick * sign, s.mid.y + ny * tick * sign);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export const curvatureGrader: Grader = {
  id: 'curvature',
  label: 'Curvature',
  grade,
  visualize,
  drawChart: (surface, input) => {
    const residuals = curvatureDerivativeResiduals(input.points);
    if (residuals.length < 2) return;
    drawResidualLineChart(
      surface,
      'dθ/ds − mean  (about mass centroid)',
      residuals.map((r) => r.residual),
      residuals[0].meanRate,
    );
  },
};
