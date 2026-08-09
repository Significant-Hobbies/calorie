export type CalendarCell = {
  date: string;
  day: number;
  inMonth: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function calendarGrid(month: Date): CalendarCell[] {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const mondayOffset = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(date.getDate() + index);
    return {
      date: localDateKey(date),
      day: date.getDate(),
      inMonth:
        date.getFullYear() === monthStart.getFullYear() &&
        date.getMonth() === monthStart.getMonth(),
    };
  });
}

export function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  return start;
}

export function weekDateKeys(date: Date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    return localDateKey(day);
  });
}

export function shiftWeek(date: Date, amount: number) {
  const shifted = startOfWeek(date);
  shifted.setDate(shifted.getDate() + amount * 7);
  return shifted;
}

export function isSameWeek(left: Date, right: Date) {
  return localDateKey(startOfWeek(left)) === localDateKey(startOfWeek(right));
}

export function calendarHistoryBounds(cells: CalendarCell[]) {
  if (cells.length === 0) throw new Error('A calendar range needs at least one date.');
  const startDate = dateFromKey(cells[0].date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = dateFromKey(cells[cells.length - 1].date);
  endDate.setHours(0, 0, 0, 0);
  endDate.setDate(endDate.getDate() + 1);
  if (endDate.getTime() - startDate.getTime() > 43 * DAY_MS) {
    throw new Error('Calendar history is limited to six weeks.');
  }
  return { start: startDate.getTime(), end: endDate.getTime() };
}

export function shiftMonth(month: Date, amount: number) {
  return new Date(month.getFullYear(), month.getMonth() + amount, 1, 12);
}

export function isSameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}
