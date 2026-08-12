import {
  circleArea,
  clamp01,
  maxInscribedCircle,
  pathCircle,
  pathPolygon,
  polygonArea,
  strokeAsPolygon,
} from "./geometry";
import { drawAreaPieChart } from "./charts";
import type { DrawingInput, GradeResult, Grader, Point } from "./types";

const MIN_POINTS = 8;

const INSCRIBED_COLOR = "rgba(47, 93, 80, 0.85)";
const REMAINDER_COLOR = "rgba(196, 84, 60, 0.85)";

/**
 * Largest inscribed circle vs drawing area.
 * Score = area(inscribed) / area(drawing).
 */
function grade(input: DrawingInput): GradeResult {
  const { points } = input;

  if (points.length < MIN_POINTS) {
    return { id: "inscribed-area", label: "Inscribed circle area", score: 0 };
  }

  const polygon = strokeAsPolygon(points);
  const drawingArea = polygonArea(polygon);
  const inscribed = maxInscribedCircle(polygon);
  const inscribedArea = circleArea(inscribed.radius);

  if (drawingArea < 1 || inscribed.radius < 1) {
    return { id: "inscribed-area", label: "Inscribed circle area", score: 0 };
  }

  const score = clamp01(inscribedArea / drawingArea);
  return { id: "inscribed-area", label: "Inscribed circle area", score };
}

function visualize(ctx: CanvasRenderingContext2D, input: DrawingInput): void {
  const { points } = input;
  if (points.length < 3) return;

  const polygon = strokeAsPolygon(points);
  const inscribed = maxInscribedCircle(polygon);

  pathPolygon(ctx, polygon);
  ctx.fillStyle = "rgba(196, 84, 60, 0.38)";
  ctx.fill();

  if (inscribed.radius > 0) {
    ctx.globalCompositeOperation = "destination-out";
    pathCircle(ctx, inscribed);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    pathCircle(ctx, inscribed);
    ctx.fillStyle = "rgba(47, 93, 80, 0.45)";
    ctx.fill();

    pathCircle(ctx, inscribed);
    ctx.strokeStyle = "rgba(47, 93, 80, 0.95)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = "rgba(47, 93, 80, 0.9)";
    ctx.arc(inscribed.center.x, inscribed.center.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  pathPolygon(ctx, polygon);
  ctx.strokeStyle = "rgba(26, 26, 24, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function visualizationShift(input: DrawingInput): Point {
  const inscribed = maxInscribedCircle(strokeAsPolygon(input.points));
  return {
    x: input.center.x - inscribed.center.x,
    y: input.center.y - inscribed.center.y,
  };
}

export const inscribedAreaGrader: Grader = {
  id: "inscribed-area",
  label: "Inscribed circle area",
  grade,
  visualize,
  visualizationShift,
  drawChart: (surface, input) => {
    const polygon = strokeAsPolygon(input.points);
    const drawingArea = polygonArea(polygon);
    const inscribed = maxInscribedCircle(polygon);
    const inscribedArea = circleArea(inscribed.radius);
    const remainder = Math.max(0, drawingArea - inscribedArea);
    drawAreaPieChart(surface, "Inscribed vs remaining shape", [
      { label: "Inscribed", value: inscribedArea, color: INSCRIBED_COLOR },
      { label: "Remainder", value: remainder, color: REMAINDER_COLOR }
    ]);
  }
};
