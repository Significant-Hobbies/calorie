import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NutrientDensityBadge } from './NutrientDensityBadge';

describe('NutrientDensityBadge', () => {
  it('renders a compact numeric score with an inspectable accessible explanation', () => {
    const html = renderToStaticMarkup(
      createElement(NutrientDensityBadge, {
        nutrients: { calories: 100, proteinG: 8, fibreG: 0 },
      })
    );

    expect(html).toContain('70/100 tracked');
    expect(html).toContain('aria-label="Tracked quality 70/100');
    expect(html).not.toContain('How it’s calculated');
  });

  it('renders an unavailable state when calories are missing', () => {
    const html = renderToStaticMarkup(createElement(NutrientDensityBadge));

    expect(html).toContain('Score —');
    expect(html).toContain('Add calories to calculate Tracked quality');
    expect(html).toContain('nutrient-density-unavailable');
  });

  it('reveals the exact calculation and caveat only inside an expandable detail', () => {
    const html = renderToStaticMarkup(
      createElement(NutrientDensityBadge, {
        nutrients: { calories: 100, proteinG: 8, fibreG: 3 },
        showBasis: true,
        contextLabel: 'Daily menu',
      })
    );

    expect(html).toContain('<details class="nutrient-density-details">');
    expect(html).toContain('How it’s calculated');
    expect(html).toContain('Daily menu</strong> · 8g protein (100%) · 3g fibre (100%)');
    expect(html).toContain('does not assess ingredients');
  });

  it('labels the nutrient source used for a historical entry score', () => {
    const html = renderToStaticMarkup(
      createElement(NutrientDensityBadge, {
        nutrients: { calories: 100, proteinG: 8, fibreG: 3 },
        basisLabel: 'Logged values fallback',
      })
    );

    expect(html).toContain('Logged values fallback');
    expect(html).toContain('aria-label="Logged values fallback. Tracked quality 100/100');
  });
});
