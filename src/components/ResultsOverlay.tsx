import { USER_SHAPE_ID, type ShapeSourceId, type TestShape } from '../shapes';
import type { GradeResult } from '../grading';

type ResultsOverlayProps = {
  results: GradeResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onTryAgain: () => void;
  shapeSource: ShapeSourceId;
  onShapeSourceChange: (id: ShapeSourceId) => void;
  hasUserShape: boolean;
  testShapes: TestShape[];
};

function formatScore(score: number): string {
  return score.toFixed(2);
}

export function ResultsOverlay({
  results,
  selectedId,
  onSelect,
  onTryAgain,
  shapeSource,
  onShapeSourceChange,
  hasUserShape,
  testShapes,
}: ResultsOverlayProps) {
  return (
    <aside className="results-chrome">
      <div className="results-panel">
        <div className="results-header">
          <h1 className="results-brand">Circleness</h1>
          <p className="results-hint">Select a metric to see how it grades</p>
        </div>

        <label className="shape-source">
          <span className="shape-source-label">Test shape</span>
          <select
            className="shape-source-select"
            value={shapeSource}
            onChange={(e) => onShapeSourceChange(e.target.value as ShapeSourceId)}
          >
            <option value={USER_SHAPE_ID} disabled={!hasUserShape}>
              User submitted shape
            </option>
            {testShapes.map((shape) => (
              <option key={shape.id} value={shape.id}>
                {shape.label}
              </option>
            ))}
          </select>
        </label>

        <ul className="results-list" role="listbox" aria-label="Grading metrics">
          {results.map((result) => {
            const selected = result.id === selectedId;
            return (
              <li key={result.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`result-row${selected ? ' is-selected' : ''}`}
                  onClick={() => onSelect(result.id)}
                >
                  <span className="result-label">{result.label}</span>
                  <span className="result-score">{formatScore(result.score)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="overlay-btn try-again-btn" onClick={onTryAgain}>
          Try again
        </button>
      </div>
    </aside>
  );
}
