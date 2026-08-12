import {
  areaCentroid,
  clamp01,
  pathCircle,
  pathPolygon,
  polygonArea,
  polygonPerimeter,
  strokeAsPolygon,
  type Circle
} from "./geometry";
import { drawComparisonBars } from "./charts";
import type { DrawingInput, GradeResult, Grader, Point } from "./types";

const MIN_POINTS = 8;

const IDEAL_COLOR = "rgba(47, 93, 80, 0.85)";
const SHAPE_COLOR = "rgba(196, 84, 60, 0.85)";

/**
 * Circle with the same area as the polygon, centered on the mass centroid.
 * Keeps the overlay compact even when perimeter is huge (e.g. a star).
 */
export function equalAreaCircle(
  points: ReturnType<typeof strokeAsPolygon>
): Circle | null {
  const area = polygonArea(points);
  if (area < 1) return null;
  return {
    center: areaCentroid(points),
    radius: Math.sqrt(area / Math.PI)
  };
}

function grade(input: DrawingInput): GradeResult {
  const { points } = input;

  if (points.length < MIN_POINTS) {
    return { id: "isoperimetric", label: "Isoperimetric", score: 0 };
  }

  const polygon = strokeAsPolygon(points);
  const area = polygonArea(polygon);
  const perimeter = polygonPerimeter(polygon);

  if (area < 1 || perimeter < 1e-6) {
    return { id: "isoperimetric", label: "Isoperimetric", score: 0 };
  }

  // 4πA/P² = (P_eq-area-circle / P_shape)²
  const score = clamp01((4 * Math.PI * area) / (perimeter * perimeter));
  return { id: "isoperimetric", label: "Isoperimetric", score };
}

function visualize(ctx: CanvasRenderingContext2D, input: DrawingInput): void {
  const { points } = input;
  if (points.length < 3) return;

  const polygon = strokeAsPolygon(points);
  const ref = equalAreaCircle(polygon);
  if (!ref || ref.radius < 1) return;

  // Shape fill
  pathPolygon(ctx, polygon);
  ctx.fillStyle = "rgba(47, 93, 80, 0.35)";
  ctx.fill();

  // Equal-area circle: same mass, more compact — star tips stick out past it
  pathCircle(ctx, ref);
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "rgba(196, 84, 60, 0.95)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);

  // Soft fill inside the circle so indentations vs tips are readable
  pathCircle(ctx, ref);
  ctx.fillStyle = "rgba(196, 84, 60, 0.18)";
  ctx.fill();

  pathPolygon(ctx, polygon);
  ctx.strokeStyle = "rgba(26, 26, 24, 0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = "rgba(196, 84, 60, 0.9)";
  ctx.arc(ref.center.x, ref.center.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function visualizationShift(input: DrawingInput): Point {
  const ref = equalAreaCircle(strokeAsPolygon(input.points));
  if (!ref) return { x: 0, y: 0 };
  return {
    x: input.center.x - ref.center.x,
    y: input.center.y - ref.center.y,
  };
}

export const isoperimetricGrader: Grader = {
  id: "isoperimetric",
  label: "Isoperimetric",
  grade,
  visualize,
  visualizationShift,
  drawChart: (surface, input) => {
    const polygon = strokeAsPolygon(input.points);
    const area = polygonArea(polygon);
    const perimeter = polygonPerimeter(polygon);
    if (area < 1 || perimeter < 1e-6) return;

    // Score = (P○ / P)² where P○ is the equal-area circle's perimeter.
    const idealPerimeter = 2 * Math.sqrt(Math.PI * area);
    const ratio = idealPerimeter / perimeter;
    const score = Math.min(1, ratio * ratio);
    drawComparisonBars(
      surface,
      "Perimeter length in px for two shapes with the same area",
      [
        { label: "Ideal", value: idealPerimeter, color: IDEAL_COLOR },
        { label: "Yours", value: perimeter, color: SHAPE_COLOR }
      ],
      `score = (P○ / P)² = ${ratio.toFixed(2)}² = ${score.toFixed(2)}`
    );
  }
};
