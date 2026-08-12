import type { Point } from './types';

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Average of point positions (stroke centroid). Skips a closing duplicate. */
export function centroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };

  let end = points.length;
  if (
    end > 1 &&
    distance(points[0], points[end - 1]) < 1e-6
  ) {
    end -= 1;
  }
  if (end === 0) return { x: 0, y: 0 };

  let x = 0;
  let y = 0;
  for (let i = 0; i < end; i++) {
    x += points[i].x;
    y += points[i].y;
  }
  return { x: x / end, y: y / end };
}

export function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Cumulative arc length along a polyline. */
export function pathLengths(points: Point[]): number[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]));
  }
  return lengths;
}

/** Sample N points evenly spaced by arc length along the drawing. */
export function sampleAlongPath(points: Point[], n: number): Point[] {
  if (points.length === 0 || n <= 0) return [];
  if (points.length === 1 || n === 1) return [points[0]];

  const lengths = pathLengths(points);
  const total = lengths[lengths.length - 1];
  if (total < 1e-6) return [points[0]];

  const samples: Point[] = [];
  for (let i = 0; i < n; i++) {
    const target = (i / (n - 1)) * total;
    let j = 1;
    while (j < lengths.length && lengths[j] < target) j++;
    const prev = points[j - 1];
    const next = points[Math.min(j, points.length - 1)];
    const segStart = lengths[j - 1];
    const segEnd = lengths[Math.min(j, lengths.length - 1)];
    const segLen = segEnd - segStart;
    const t = segLen < 1e-9 ? 0 : (target - segStart) / segLen;
    samples.push({
      x: prev.x + (next.x - prev.x) * t,
      y: prev.y + (next.y - prev.y) * t,
    });
  }
  return samples;
}

/**
 * Centroid of points spaced uniformly by arc length.
 * Avoids bias when the user draws slower (denser samples) on one side.
 */
export function arcLengthCentroid(points: Point[], sampleCount = 64): Point {
  return centroid(sampleAlongPath(points, sampleCount));
}

/**
 * Like sampleAlongPath, but snaps to existing vertices (no chord lerp).
 * Keeps samples on the true polyline corners — important for circles
 * built from equal angular vertices.
 */
export function sampleVerticesAlongPath(points: Point[], n: number): Point[] {
  if (points.length === 0 || n <= 0) return [];

  // Drop closing duplicate so the open ring is uniformly indexed.
  let end = points.length;
  if (end > 1 && distance(points[0], points[end - 1]) < 1e-6) {
    end -= 1;
  }
  if (end === 0) return [];
  if (n === 1 || end === 1) return [{ ...points[0] }];

  const ring = points.slice(0, end);
  const lengths = pathLengths([...ring, ring[0]]);
  const total = lengths[lengths.length - 1];
  if (total < 1e-6) return [{ ...ring[0] }];

  const samples: Point[] = [];
  for (let i = 0; i < n; i++) {
    const target = (i / n) * total; // exclusive of full loop → n unique verts
    let j = 1;
    while (j < lengths.length && lengths[j] < target) j++;
    // Pick nearer endpoint of the spanning segment.
    const prevIdx = j - 1;
    const nextIdx = Math.min(j, lengths.length - 1);
    const choosePrev =
      Math.abs(lengths[prevIdx] - target) <= Math.abs(lengths[nextIdx] - target);
    const idx = (choosePrev ? prevIdx : nextIdx) % ring.length;
    samples.push({ ...ring[idx] });
  }
  return samples;
}

/** Absolute shoelace area of a (preferably closed) polygon. */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Closed-path perimeter (includes edge from last → first). */
export function polygonPerimeter(points: Point[]): number {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    sum += distance(points[i], points[(i + 1) % points.length]);
  }
  return sum;
}

export function circleArea(radius: number): number {
  return Math.PI * radius * radius;
}

export type Circle = { center: Point; radius: number };

function circumcircleFrom2(a: Point, b: Point): Circle {
  return {
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    radius: distance(a, b) / 2,
  };
}

function circumcircleFrom3(a: Point, b: Point, c: Point): Circle | null {
  const d =
    2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;

  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;

  const center = {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
  return { center, radius: distance(center, a) };
}

function isInsideCircle(p: Point, circle: Circle, eps = 1e-6): boolean {
  return distance(p, circle.center) <= circle.radius + eps;
}

function minCircleWithPoints(points: Point[], boundary: Point[]): Circle {
  if (boundary.length === 3) {
    return (
      circumcircleFrom3(boundary[0], boundary[1], boundary[2]) ??
      circumcircleFrom2(boundary[0], boundary[1])
    );
  }
  if (boundary.length === 2) {
    const base = circumcircleFrom2(boundary[0], boundary[1]);
    if (points.length === 0) return base;
  }
  if (boundary.length === 1 && points.length === 0) {
    return { center: boundary[0], radius: 0 };
  }
  if (points.length === 0 && boundary.length === 0) {
    return { center: { x: 0, y: 0 }, radius: 0 };
  }

  const pts = points.slice();
  for (let i = pts.length - 1; i > 0; i--) {
    const j = (i * 2654435761 + pts.length) % (i + 1);
    ;[pts[i], pts[j]] = [pts[j], pts[i]];
  }

  let circle: Circle =
    boundary.length === 0
      ? { center: pts[0], radius: 0 }
      : boundary.length === 1
        ? { center: boundary[0], radius: 0 }
        : circumcircleFrom2(boundary[0], boundary[1]);

  for (let i = 0; i < pts.length; i++) {
    if (isInsideCircle(pts[i], circle)) continue;
    circle = minCircleWithPoints(pts.slice(0, i), [...boundary, pts[i]]);
  }
  return circle;
}

/** Smallest circle enclosing all points (Welzl). */
export function minEnclosingCircle(points: Point[]): Circle {
  if (points.length === 0) return { center: { x: 0, y: 0 }, radius: 0 };
  if (points.length === 1) return { center: points[0], radius: 0 };
  return minCircleWithPoints(points, []);
}

function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y + 0) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function distToPolygonEdges(p: Point, polygon: Point[]): number {
  let min = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    min = Math.min(min, distToSegment(p, a, b));
  }
  return min;
}

/**
 * Largest inscribed circle via multi-resolution grid search + local refine.
 * A single coarse grid (old 12×12) undershoots on elongated shapes where the
 * optimum sits in a small region of a large bbox (e.g. tadpole head).
 */
export function maxInscribedCircle(polygon: Point[]): Circle {
  if (polygon.length < 3) return { center: { x: 0, y: 0 }, radius: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  const evaluate = (c: Point): number => {
    if (!pointInPolygon(c, polygon)) return -1;
    return distToPolygonEdges(c, polygon);
  };

  let best: Circle = {
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    radius: 0,
  };

  const consider = (c: Point) => {
    const radius = evaluate(c);
    if (radius > best.radius) best = { center: c, radius };
  };

  // Pass 1: dense coverage of the bbox.
  const coarseSteps = Math.max(24, Math.ceil(Math.max(width, height) / 8));
  for (let iy = 0; iy <= coarseSteps; iy++) {
    for (let ix = 0; ix <= coarseSteps; ix++) {
      consider({
        x: minX + (width * ix) / coarseSteps,
        y: minY + (height * iy) / coarseSteps,
      });
    }
  }

  if (best.radius <= 0) return best;

  // Passes 2–N: zoom around the current best with finer cells.
  let cell = Math.min(width, height) / coarseSteps;
  for (let pass = 0; pass < 5 && cell > 0.35; pass++) {
    const span = cell * 3;
    const localMinX = best.center.x - span;
    const localMaxX = best.center.x + span;
    const localMinY = best.center.y - span;
    const localMaxY = best.center.y + span;
    const localSteps = 12;
    for (let iy = 0; iy <= localSteps; iy++) {
      for (let ix = 0; ix <= localSteps; ix++) {
        consider({
          x: localMinX + ((localMaxX - localMinX) * ix) / localSteps,
          y: localMinY + ((localMaxY - localMinY) * iy) / localSteps,
        });
      }
    }
    cell /= 2;
  }

  return best;
}

/** Close the stroke into a polygon for area-based metrics. */
export function strokeAsPolygon(points: Point[]): Point[] {
  if (points.length < 3) return points.slice();
  const first = points[0];
  const last = points[points.length - 1];
  if (distance(first, last) < 1e-3) return points.slice();
  return [...points, first];
}

/**
 * Area-weighted (mass) centroid of a polygon (shoelace).
 * Unlike perimeter/point averages, a long thin tail barely moves this —
 * mass sits in the bulky region (e.g. a tadpole's head).
 */
export function polygonAreaCentroid(polygon: Point[]): Point {
  if (polygon.length < 3) return centroid(polygon);

  let crossSum = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cross = a.x * b.y - b.x * a.y;
    crossSum += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }

  if (Math.abs(crossSum) < 1e-9) return centroid(polygon);
  const inv = 1 / (3 * crossSum);
  return { x: cx * inv, y: cy * inv };
}

/** Mass centroid of a freehand stroke treated as a filled closed shape. */
export function areaCentroid(points: Point[]): Point {
  return polygonAreaCentroid(strokeAsPolygon(points));
}

export function pathPolygon(
  ctx: CanvasRenderingContext2D,
  polygon: Point[],
): void {
  if (polygon.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let i = 1; i < polygon.length; i++) {
    ctx.lineTo(polygon[i].x, polygon[i].y);
  }
  ctx.closePath();
}

export function pathCircle(
  ctx: CanvasRenderingContext2D,
  circle: Circle,
): void {
  ctx.beginPath();
  ctx.arc(circle.center.x, circle.center.y, Math.max(0, circle.radius), 0, Math.PI * 2);
}

/** Map 0 (bad/red) → 1 (good/green). */
export function redGreen(t: number): string {
  const g = clamp01(t);
  const r = Math.round(210 * (1 - g) + 40 * g);
  const gr = Math.round(70 * (1 - g) + 150 * g);
  const b = Math.round(60 * (1 - g) + 90 * g);
  return `rgb(${r}, ${gr}, ${b})`;
}
