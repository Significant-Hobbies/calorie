import type { WeeklyJournalEvent } from './weekly-journal';

export const WEEK_CALENDAR_HOUR_HEIGHT = 64;
export const WEEK_CALENDAR_EVENT_HEIGHT = 58;
export const WEEK_CALENDAR_DAY_HEIGHT = WEEK_CALENDAR_HOUR_HEIGHT * 24;

export type PositionedWeeklyEvent = {
  event: WeeklyJournalEvent;
  height: number;
  lane: number;
  laneCount: number;
  top: number;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function format24HourTime(timestamp: number) {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function minuteOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes();
}

export function calendarHourLabels() {
  return Array.from({ length: 25 }, (_, hour) => `${pad(hour)}:00`);
}

export function initialCalendarHour(events: WeeklyJournalEvent[]) {
  if (!events.length) return 7;
  const earliestMinute = Math.min(...events.map((event) => minuteOfLocalDay(event.at)));
  return Math.max(0, Math.floor(earliestMinute / 60) - 1);
}

export function layoutWeeklyEvents(events: WeeklyJournalEvent[]): PositionedWeeklyEvent[] {
  const visualMinutes = Math.ceil((WEEK_CALENDAR_EVENT_HEIGHT / WEEK_CALENDAR_HOUR_HEIGHT) * 60);
  const sorted = [...events].sort(
    (left, right) => left.at - right.at || left.id.localeCompare(right.id)
  );
  const positioned: PositionedWeeklyEvent[] = [];
  let cluster: Array<PositionedWeeklyEvent & { endMinute: number }> = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  const finishCluster = () => {
    if (!cluster.length) return;
    const laneCount = Math.max(...cluster.map((item) => item.lane)) + 1;
    positioned.push(
      ...cluster.map(({ endMinute: _endMinute, ...item }) => ({ ...item, laneCount }))
    );
    cluster = [];
    clusterEnd = -1;
    laneEnds = [];
  };

  for (const event of sorted) {
    const startMinute = minuteOfLocalDay(event.at);
    const endMinute = startMinute + visualMinutes;
    if (cluster.length && startMinute >= clusterEnd) finishCluster();

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= startMinute);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = endMinute;
    clusterEnd = Math.max(clusterEnd, endMinute);

    const rawTop = (startMinute / 60) * WEEK_CALENDAR_HOUR_HEIGHT;
    cluster.push({
      event,
      height: WEEK_CALENDAR_EVENT_HEIGHT,
      lane,
      laneCount: 1,
      top: Math.min(rawTop, WEEK_CALENDAR_DAY_HEIGHT - WEEK_CALENDAR_EVENT_HEIGHT),
      endMinute,
    });
  }

  finishCluster();
  return positioned;
}
