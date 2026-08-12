export type Point = { x: number; y: number };

export type DrawingInput = {
  points: Point[];
  canvasWidth: number;
  canvasHeight: number;
  center: Point;
};

export type GradeResult = {
  id: string;
  label: string;
  score: number;
};

export type Grader = {
  id: string;
  label: string;
  grade: (input: DrawingInput) => GradeResult;
  /** Draw criteria explanation onto an overlay canvas. */
  visualize: (ctx: CanvasRenderingContext2D, input: DrawingInput) => void;
  /**
   * Optional translation applied to drawing + viz coords so overlays can
   * re-center the stroke (e.g. centroid → canvas center).
   */
  visualizationShift?: (input: DrawingInput) => Point;
  /** Optional bottom supporting chart (residual line, area pie, etc.). */
  drawChart?: (
    surface: {
      ctx: CanvasRenderingContext2D;
      panelW: number;
      panelH: number;
    },
    input: DrawingInput,
  ) => void;
};
