import type { DrawingInput, Point } from '../grading';

/** A shape in normalized coordinates: origin at (0, 0), max radius ≈ 1. */
export type ShapeDocument = {
  id?: string;
  label?: string;
  points: Point[];
};

export type TestShape = {
  id: string;
  label: string;
  points: Point[];
};

export type ShapeSourceId = 'user' | string;

export const USER_SHAPE_ID = 'user' as const;

type ManifestEntry = {
  id: string;
  label: string;
  file: string;
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function asPoint(value: unknown): Point | null {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    if (isFiniteNumber(x) && isFiniteNumber(y)) return { x, y };
    return null;
  }
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    const x = Number(rec.x);
    const y = Number(rec.y);
    if (isFiniteNumber(x) && isFiniteNumber(y)) return { x, y };
  }
  return null;
}

/** Parse a pasted shape: full document, `{ points }`, or a bare point array. */
export function parseShapeText(text: string): ShapeDocument {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty shape data');

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    throw new Error('Shape data must be valid JSON');
  }

  let id: string | undefined;
  let label: string | undefined;
  let rawPoints: unknown;

  if (Array.isArray(data)) {
    rawPoints = data;
  } else if (data && typeof data === 'object') {
    const rec = data as Record<string, unknown>;
    if (typeof rec.id === 'string') id = rec.id;
    if (typeof rec.label === 'string') label = rec.label;
    rawPoints = rec.points;
  } else {
    throw new Error('Expected a JSON object or point array');
  }

  if (!Array.isArray(rawPoints) || rawPoints.length === 0) {
    throw new Error('Shape needs a non-empty points array');
  }

  const points: Point[] = [];
  for (const item of rawPoints) {
    const p = asPoint(item);
    if (!p) throw new Error('Each point must be {x,y} or [x,y]');
    points.push(p);
  }

  return { id, label, points };
}

export function maxRadius(points: Point[]): number {
  let max = 0;
  for (const p of points) {
    max = Math.max(max, Math.hypot(p.x, p.y));
  }
  return max;
}

/**
 * Convert canvas/world points into normalized shape space:
 * canvas center → (0, 0), scaled so max radius = 1.
 */
export function toNormalizedShape(
  points: Point[],
  center: Point,
): ShapeDocument {
  const local = points.map((p) => ({
    x: p.x - center.x,
    y: p.y - center.y,
  }));
  const r = maxRadius(local);
  const scale = r < 1e-9 ? 1 : r;
  return {
    points: local.map((p) => ({
      x: Math.round((p.x / scale) * 1e6) / 1e6,
      y: Math.round((p.y / scale) * 1e6) / 1e6,
    })),
  };
}

export function serializeShape(doc: ShapeDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/** Default size so library shapes fit comfortably on the canvas. */
export function defaultShapeRadius(
  canvasWidth: number,
  canvasHeight: number,
): number {
  return Math.min(canvasWidth, canvasHeight) * 0.28;
}

/**
 * Place a normalized shape onto the canvas (center at canvas midpoint,
 * scaled to the default radius).
 */
export function placeShapeOnCanvas(
  normalized: Point[],
  canvasWidth: number,
  canvasHeight: number,
): Point[] {
  const center = { x: canvasWidth / 2, y: canvasHeight / 2 };
  const targetR = defaultShapeRadius(canvasWidth, canvasHeight);
  const sourceR = maxRadius(normalized);
  const scale = sourceR < 1e-9 ? targetR : targetR / sourceR;
  return normalized.map((p) => ({
    x: center.x + p.x * scale,
    y: center.y + p.y * scale,
  }));
}

export function buildShapePoints(
  shape: TestShape,
  canvasWidth: number,
  canvasHeight: number,
): Point[] {
  return placeShapeOnCanvas(shape.points, canvasWidth, canvasHeight);
}

/**
 * Re-center on the crosshair and scale so max radius = 1, then place at the
 * default canvas radius. Grades and overlays then share a common size whether
 * the user drew a tiny or huge circle.
 */
export function toCanonicalDrawingInput(input: DrawingInput): DrawingInput {
  const { points, canvasWidth, canvasHeight, center } = input;
  if (points.length === 0 || canvasWidth <= 0 || canvasHeight <= 0) {
    return input;
  }

  const normalized = toNormalizedShape(points, center).points;
  return {
    points: placeShapeOnCanvas(normalized, canvasWidth, canvasHeight),
    canvasWidth,
    canvasHeight,
    center: { x: canvasWidth / 2, y: canvasHeight / 2 },
  };
}

let shapesCache: TestShape[] | null = null;
let shapesPromise: Promise<TestShape[]> | null = null;

const shapesBase = `${import.meta.env.BASE_URL}shapes/`;

async function loadShapeFile(entry: ManifestEntry): Promise<TestShape> {
  const res = await fetch(`${shapesBase}${entry.file}`);
  if (!res.ok) {
    throw new Error(`Failed to load shape ${entry.file}: ${res.status}`);
  }
  const doc = parseShapeText(await res.text());
  return {
    id: entry.id || doc.id || entry.file.replace(/\.json$/i, ''),
    label: entry.label || doc.label || entry.id,
    points: doc.points,
  };
}

/** Load all shapes listed in `/shapes/index.json` (public folder). */
export async function loadTestShapes(): Promise<TestShape[]> {
  if (shapesCache) return shapesCache;
  if (shapesPromise) return shapesPromise;

  shapesPromise = (async () => {
    const res = await fetch(`${shapesBase}index.json`);
    if (!res.ok) {
      throw new Error(`Failed to load shape index: ${res.status}`);
    }
    const manifest = (await res.json()) as ManifestEntry[];
    if (!Array.isArray(manifest)) {
      throw new Error('Shape index must be an array');
    }
    const shapes = await Promise.all(manifest.map(loadShapeFile));
    shapesCache = shapes;
    return shapes;
  })();

  try {
    return await shapesPromise;
  } catch (err) {
    shapesPromise = null;
    throw err;
  }
}

export function getCachedTestShapes(): TestShape[] {
  return shapesCache ?? [];
}

export function getTestShape(id: string): TestShape | undefined {
  return getCachedTestShapes().find((s) => s.id === id);
}
