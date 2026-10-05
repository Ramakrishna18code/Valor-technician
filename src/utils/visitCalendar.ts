import type { VisitView } from "../types/technician";

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function monthRange(month: string) {
  const start = new Date(`${month}-01T12:00:00`);
  return { fromDate: dateKey(start), toDate: dateKey(new Date(start.getFullYear(), start.getMonth() + 1, 0, 12)) };
}

/** Monday-first calendar, using local noon to avoid UTC date shifts. */
export function calendarDays(month: string): string[] {
  const start = new Date(`${month}-01T12:00:00`);
  const offset = (start.getDay() + 6) % 7;
  const count = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) =>
    dateKey(new Date(start.getFullYear(), start.getMonth(), 1 - offset + index, 12)));
}

export function sortVisits(visits: VisitView[]): VisitView[] {
  return [...visits].sort((a, b) => `${a.scheduledDate} ${a.startTime}`.localeCompare(`${b.scheduledDate} ${b.startTime}`) || a.id - b.id);
}
