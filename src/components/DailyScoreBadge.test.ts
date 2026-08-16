import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DailyScore } from '../lib/nutrient-density';
import { DailyScoreBadge } from './DailyScoreBadge';

const result: DailyScore = {
  score: 82,
  label: 'Score so far',
  nutrients: { calories: 1800, proteinG: 90, fibreG: 24 },
  calorieFactor: 0.8,
  proteinFactor: 1,
  fibreFactor: 0.8,
  fallbackCount: 1,
  explanation: 'Score so far 82/100 with one logged fallback.',
};

describe('DailyScoreBadge', () => {
  it('shows a numeric score, factor summary, and exact accessible explanation', () => {
    const html = renderToStaticMarkup(createElement(DailyScoreBadge, { result }));

    expect(html).toContain('82/100');
    expect(html).toContain('Calories 80% · Protein 100% · Fibre 80%');
    expect(html).toContain('How it’s calculated');
    expect(html).toContain('aria-label="Score so far 82/100 with one logged fallback."');
  });

  it('shows an unavailable state without inventing a score', () => {
    const unavailable = { ...result, score: null, explanation: 'No targets are available.' };
    const html = renderToStaticMarkup(createElement(DailyScoreBadge, { result: unavailable }));

    expect(html).toContain('Score —');
    expect(html).toContain('daily-score-unavailable');
  });
});
