import { describe, expect, it } from 'vitest';
import {
  calendarGrid,
  calendarHistoryBounds,
  dateFromKey,
  isSameMonth,
  isSameWeek,
  localDateKey,
  shiftMonth,
  shiftWeek,
  startOfWeek,
  weekDateKeys,
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

  it('builds a Monday-first week across month boundaries', () => {
    const date = new Date(2026, 8, 2, 1, 30);

    expect(localDateKey(startOfWeek(date))).toBe('2026-08-31');
    expect(weekDateKeys(date)).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ]);
  });

  it('shifts weeks safely across a year boundary', () => {
    const finalWeek = new Date(2026, 11, 31, 23, 30);
    const nextWeek = shiftWeek(finalWeek, 1);

    expect(weekDateKeys(finalWeek)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
    expect(localDateKey(nextWeek)).toBe('2027-01-04');
    expect(isSameWeek(nextWeek, new Date(2027, 0, 10, 23, 59))).toBe(true);
  });

  it('increments calendar dates through a daylight-saving transition week', () => {
    expect(weekDateKeys(new Date(2026, 2, 8, 12))).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
    ]);
  });
});
