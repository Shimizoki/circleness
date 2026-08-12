import { areaCentroid } from './geometry';
import {
  drawRadialResidualChart,
  scoreRadialAbout,
  visualizeRadialAbout,
} from './radialShared';
import type { DrawingInput, GradeResult, Grader, Point } from './types';

const MIN_POINTS = 8;

/**
 * Same as radial distance, but measured from the shape's area (mass) centroid
 * so thin tails don't pull the origin away from the bulky region.
 */
function grade(input: DrawingInput): GradeResult {
  const { points } = input;

  if (points.length < MIN_POINTS) {
    return {
      id: 'centroid-radial',
      label: 'Centroid radial',
      score: 0,
    };
  }

  return {
    id: 'centroid-radial',
    label: 'Centroid radial',
    score: scoreRadialAbout(points, areaCentroid(points)),
  };
}

function visualizationShift(input: DrawingInput): Point {
  const c = areaCentroid(input.points);
  return {
    x: input.center.x - c.x,
    y: input.center.y - c.y,
  };
}

function visualize(ctx: CanvasRenderingContext2D, input: DrawingInput): void {
  visualizeRadialAbout(ctx, input.points, areaCentroid(input.points));
}

export const centroidRadialGrader: Grader = {
  id: 'centroid-radial',
  label: 'Centroid radial',
  grade,
  visualize,
  visualizationShift,
  drawChart: (surface, input) =>
    drawRadialResidualChart(
      surface,
      input.points,
      areaCentroid(input.points),
      'radius − mean  (about mass centroid)',
    ),
};
