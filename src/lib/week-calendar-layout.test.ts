import { describe, expect, it } from 'vitest';
import type { WeeklyJournalEvent } from './weekly-journal';
import {
  calendarHourLabels,
  format24HourTime,
  initialCalendarHour,
  layoutWeeklyEvents,
  WEEK_CALENDAR_DAY_HEIGHT,
  WEEK_CALENDAR_EVENT_HEIGHT,
} from './week-calendar-layout';

const day = '2026-08-10';
const at = (hour: number, minute = 0) =>
  new Date(
    `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
  ).getTime();

function foodEvent(id: string, timestamp: number): WeeklyJournalEvent {
  return {
    type: 'food',
    id,
    at: timestamp,
    entry: {
      id,
      foodId: null,
      foodName: id,
      amount: 1,
      unitLabel: 'plate',
      calories: 400,
      carbsG: 40,
      proteinG: 20,
      fibreG: 5,
      eatenAt: timestamp,
    },
  };
}

describe('weekly calendar layout', () => {
  it('uses an explicit 24-hour clock', () => {
    expect(calendarHourLabels()).toHaveLength(25);
    expect(calendarHourLabels().at(0)).toBe('00:00');
    expect(calendarHourLabels().at(-1)).toBe('24:00');
    expect(format24HourTime(at(4, 5))).toBe('04:05');
    expect(format24HourTime(at(18, 30))).toBe('18:30');
  });

  it('places events by local time and scrolls near the earliest one', () => {
    const events = [foodEvent('lunch', at(12, 30)), foodEvent('breakfast', at(7, 30))];
    const positioned = layoutWeeklyEvents(events);

    expect(positioned.map((item) => item.event.id)).toEqual(['breakfast', 'lunch']);
    expect(positioned[0].top).toBe(480);
    expect(positioned[1].top).toBe(800);
    expect(initialCalendarHour(events)).toBe(6);
    expect(initialCalendarHour([])).toBe(7);
  });

  it('assigns close events to separate lanes and resets after the cluster', () => {
    const positioned = layoutWeeklyEvents([
      foodEvent('first', at(8)),
      foodEvent('second', at(8, 15)),
      foodEvent('later', at(10)),
    ]);

    expect(positioned.slice(0, 2).map(({ lane, laneCount }) => ({ lane, laneCount }))).toEqual([
      { lane: 0, laneCount: 2 },
      { lane: 1, laneCount: 2 },
    ]);
    expect(positioned[2]).toMatchObject({ lane: 0, laneCount: 1 });
  });

  it('keeps a final-minute event inside the 24-hour canvas', () => {
    const [positioned] = layoutWeeklyEvents([foodEvent('late', at(23, 59))]);

    expect(positioned.top + WEEK_CALENDAR_EVENT_HEIGHT).toBe(WEEK_CALENDAR_DAY_HEIGHT);
  });
});
