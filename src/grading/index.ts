import { centroidRadialGrader } from './centroidRadial';
import { circumcircleAreaGrader } from './circumcircleArea';
import { curvatureGrader } from './curvature';
import { inscribedAreaGrader } from './inscribedArea';
import { isoperimetricGrader } from './isoperimetric';
import { radialDistanceGrader } from './radialDistance';
import type { DrawingInput, GradeResult, Grader } from './types';

export type { DrawingInput, GradeResult, Grader, Point } from './types';

export const graders: Grader[] = [
  radialDistanceGrader,
  centroidRadialGrader,
  curvatureGrader,
  circumcircleAreaGrader,
  inscribedAreaGrader,
  isoperimetricGrader,
];

export function gradeAll(input: DrawingInput): GradeResult[] {
  return graders.map((grader) => grader.grade(input));
}

export function getGrader(id: string): Grader | undefined {
  return graders.find((g) => g.id === id);
}
