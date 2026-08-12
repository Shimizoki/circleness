import { useCallback, useEffect, useMemo, useState } from 'react';
import { CenterOverlay } from './components/CenterOverlay';
import { DrawingCanvas } from './components/DrawingCanvas';
import { GradeVizOverlay } from './components/GradeVizOverlay';
import { ResultsOverlay } from './components/ResultsOverlay';
import { ShapeIODialog } from './components/ShapeIODialog';
import { SubmitButton } from './components/SubmitButton';
import { gradeAll, type GradeResult, type Point } from './grading';
import {
  buildShapePoints,
  loadTestShapes,
  toCanonicalDrawingInput,
  USER_SHAPE_ID,
  type ShapeSourceId,
  type TestShape,
} from './shapes';
import './styles.css';

type Mode = 'draw' | 'results';

function App() {
  const [mode, setMode] = useState<Mode>('draw');
  const [points, setPoints] = useState<Point[]>([]);
  const [userPoints, setUserPoints] = useState<Point[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [results, setResults] = useState<GradeResult[]>([]);
  const [selectedGraderId, setSelectedGraderId] = useState<string | null>(null);
  const [shapeSource, setShapeSource] = useState<ShapeSourceId>(USER_SHAPE_ID);
  const [testShapes, setTestShapes] = useState<TestShape[]>([]);
  const [shapeIOOpen, setShapeIOOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTestShapes()
      .then((shapes) => {
        if (!cancelled) setTestShapes(shapes);
      })
      .catch((err) => {
        console.error(err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePointsChange = useCallback((next: Point[]) => {
    setPoints(next);
  }, []);

  const handleSizeChange = useCallback((width: number, height: number) => {
    setSize({ width, height });
  }, []);

  const resolveShapePoints = useCallback(
    (source: ShapeSourceId, submittedUser: Point[]) => {
      if (source === USER_SHAPE_ID) return submittedUser;
      const shape = testShapes.find((s) => s.id === source);
      if (!shape || size.width === 0) return [];
      return buildShapePoints(shape, size.width, size.height);
    },
    [size.height, size.width, testShapes],
  );

  const activePoints = useMemo(() => {
    if (mode !== 'results') return points;
    return resolveShapePoints(shapeSource, userPoints);
  }, [mode, points, resolveShapePoints, shapeSource, userPoints]);

  const drawingInput = useMemo(
    () =>
      toCanonicalDrawingInput({
        points: activePoints,
        canvasWidth: size.width,
        canvasHeight: size.height,
        center: { x: size.width / 2, y: size.height / 2 },
      }),
    [activePoints, size.height, size.width],
  );

  const runGrading = useCallback(
    (source: ShapeSourceId, submittedUser: Point[]) => {
      if (size.width === 0) return;
      const pts = resolveShapePoints(source, submittedUser);
      if (pts.length === 0) return;

      const graded = gradeAll(
        toCanonicalDrawingInput({
          points: pts,
          canvasWidth: size.width,
          canvasHeight: size.height,
          center: { x: size.width / 2, y: size.height / 2 },
        }),
      );
      setResults(graded);
      setSelectedGraderId((current) => current ?? graded[0]?.id ?? null);
      setShapeSource(source);
      setMode('results');
    },
    [resolveShapePoints, size.height, size.width],
  );

  const handleSubmit = () => {
    if (points.length === 0 || size.width === 0) return;
    setUserPoints(points);
    runGrading(USER_SHAPE_ID, points);
  };

  const handleTryAgain = () => {
    setPoints([]);
    setUserPoints([]);
    setResults([]);
    setSelectedGraderId(null);
    setShapeSource(USER_SHAPE_ID);
    setMode('draw');
  };

  const handleSelectGrader = (id: string) => {
    setSelectedGraderId((current) => (current === id ? null : id));
  };

  const handleShapeSourceChange = (id: ShapeSourceId) => {
    if (id === USER_SHAPE_ID && userPoints.length === 0) return;
    runGrading(id, userPoints);
  };

  const handleImportShape = (imported: Point[]) => {
    setPoints(imported);
  };

  return (
    <div className={`app${mode === 'results' ? ' is-results' : ''}`}>
      <DrawingCanvas
        points={points}
        onPointsChange={handlePointsChange}
        drawingEnabled={mode === 'draw'}
        onSizeChange={handleSizeChange}
      />
      {mode === 'draw' && <CenterOverlay />}
      {mode === 'draw' && (
        <div className="controls-overlay">
          <p className="brand-mark">Circleness</p>
          <div className="controls-row">
            <button
              type="button"
              className="overlay-btn overlay-btn-secondary"
              onClick={() => setShapeIOOpen(true)}
            >
              Import / export
            </button>
            <SubmitButton disabled={points.length === 0} onClick={handleSubmit} />
          </div>
        </div>
      )}
      {mode === 'results' && (
        <div className="results-layout">
          <ResultsOverlay
            results={results}
            selectedId={selectedGraderId}
            onSelect={handleSelectGrader}
            onTryAgain={handleTryAgain}
            shapeSource={shapeSource}
            onShapeSourceChange={handleShapeSourceChange}
            hasUserShape={userPoints.length > 0}
            testShapes={testShapes}
          />
          <GradeVizOverlay graderId={selectedGraderId} input={drawingInput} />
        </div>
      )}
      <ShapeIODialog
        open={shapeIOOpen}
        onClose={() => setShapeIOOpen(false)}
        points={points}
        canvasWidth={size.width}
        canvasHeight={size.height}
        onImport={handleImportShape}
      />
    </div>
  );
}

export default App;
