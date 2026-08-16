import { Target } from 'lucide-react';
import type { DailyScore } from '../lib/nutrient-density';

function factorLabel(value: number | null) {
  return value === null ? 'not scored' : `${Math.round(value * 100)}%`;
}

export function DailyScoreBadge({ result }: { result: DailyScore }) {
  return (
    <div className="daily-score-badge-wrap">
      <span
        className={`daily-score-badge ${result.score === null ? 'daily-score-unavailable' : ''}`}
        title={result.explanation}
        aria-label={result.explanation}
      >
        <Target size={13} aria-hidden="true" />
        {result.score === null ? 'Score —' : `${result.score}/100`}
      </span>
      <details className="daily-score-details">
        <summary>How it’s calculated</summary>
        <small>
          Calories {factorLabel(result.calorieFactor)} · Protein {factorLabel(result.proteinFactor)}
          {' · '}Fibre {factorLabel(result.fibreFactor)}
        </small>
        <small>{result.explanation}</small>
      </details>
    </div>
  );
}
