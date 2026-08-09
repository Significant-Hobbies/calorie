import { describe, expect, it } from 'vitest';
import {
  displayWeightValue,
  localDateInputValue,
  storedWeightValue,
  waterTotal,
} from './log-corrections';

describe('log correction calculations', () => {
  it('recalculates water totals after edits and removals', () => {
    expect(
      waterTotal([
        { id: 'a', amountMl: 250, drankAt: 1 },
        { id: 'b', amountMl: 500, drankAt: 2 },
      ])
    ).toBe(750);
    expect(waterTotal([{ id: 'a', amountMl: 350, drankAt: 1 }])).toBe(350);
  });

  it('round-trips preferred weight units at journal precision', () => {
    expect(displayWeightValue(70, 'imperial')).toBe(154.3);
    expect(storedWeightValue(154.3, 'imperial')).toBe(70);
    expect(storedWeightValue(70.04, 'metric')).toBe(70);
  });

  it('keeps the local calendar day when preparing a weight edit', () => {
    const earlyMorning = new Date(2026, 7, 9, 1, 30).getTime();
    expect(localDateInputValue(earlyMorning)).toBe('2026-08-09');
  });
});
