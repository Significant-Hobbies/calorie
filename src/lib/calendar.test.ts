import { describe, expect, it } from 'vitest';
import {
  calendarGrid,
  calendarHistoryBounds,
  dateFromKey,
  isSameMonth,
  localDateKey,
  shiftMonth,
} from './calendar';

describe('calendar history helpers', () => {
  it('builds a stable Monday-first six-week grid', () => {
    const cells = calendarGrid(new Date(2026, 6, 25, 12));

    expect(cells).toHaveLength(42);
    expect(cells[0]).toEqual({ date: '2026-06-29', day: 29, inMonth: false });
    expect(cells[6].date).toBe('2026-07-05');
    expect(cells[41]).toEqual({ date: '2026-08-09', day: 9, inMonth: false });
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(31);
  });

  it('uses local midnights for an inclusive grid and exclusive query end', () => {
    const cells = calendarGrid(new Date(2026, 1, 10, 12));
    const bounds = calendarHistoryBounds(cells);

    expect(localDateKey(new Date(bounds.start))).toBe(cells[0].date);
    expect(localDateKey(new Date(bounds.end - 1))).toBe(cells[41].date);
  });

  it('round-trips date keys and shifts months without end-of-month overflow', () => {
    expect(localDateKey(dateFromKey('2026-07-04'))).toBe('2026-07-04');
    expect(localDateKey(shiftMonth(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
    expect(isSameMonth(shiftMonth(new Date(2026, 6, 25), 0), new Date(2026, 6, 1))).toBe(true);
  });
});
