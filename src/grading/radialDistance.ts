import type { DrawingInput, GradeResult, Grader } from './types';
import {
  drawRadialResidualChart,
  scoreRadialAbout,
  visualizeRadialAbout,
} from './radialShared';

const MIN_POINTS = 8;

/**
 * Sample N points along the stroke and score how consistently their
 * distances match the mean radius from the canvas center.
 */
function grade(input: DrawingInput): GradeResult {
  const { points, center } = input;

  if (points.length < MIN_POINTS) {
    return { id: 'radial-distance', label: 'Radial distance', score: 0 };
  }

  return {
    id: 'radial-distance',
    label: 'Radial distance',
    score: scoreRadialAbout(points, center),
  };
}

function visualize(ctx: CanvasRenderingContext2D, input: DrawingInput): void {
  visualizeRadialAbout(ctx, input.points, input.center);
}

export const radialDistanceGrader: Grader = {
  id: 'radial-distance',
  label: 'Radial distance',
  grade,
  visualize,
  drawChart: (surface, input) =>
    drawRadialResidualChart(
      surface,
      input.points,
      input.center,
      'radius − mean  (about canvas center)',
    ),
};

export { RADIAL_SAMPLE_COUNT } from './radialShared';
