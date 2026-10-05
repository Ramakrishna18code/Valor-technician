import { calendarDays, dateKey, monthRange, sortVisits } from '../src/utils/visitCalendar';
import type { VisitView } from '../src/types/technician';

describe('visit calendar', () => {
  it('includes leap day and complete Monday-first weeks', () => {
    expect(monthRange('2028-02')).toEqual({fromDate: '2028-02-01', toDate: '2028-02-29'});
    const days = calendarDays('2028-02');
    expect(days[0]).toBe('2028-01-31');
    expect(days[days.length - 1]).toBe('2028-03-05');
    expect(days).toContain('2028-02-29');
    expect(days.length % 7).toBe(0);
    expect(new Set(days).size).toBe(days.length);
  });
  it('handles a six-week month across the year boundary', () => {
    const days = calendarDays('2023-01');
    expect(days).toHaveLength(42);
    expect(days[0]).toBe('2022-12-26');
    expect(days[41]).toBe('2023-02-05');
    expect(monthRange('2026-12').toDate).toBe('2026-12-31');
  });
  it('uses local calendar dates instead of UTC serialization', () => {
    expect(dateKey(new Date(2026, 9, 5, 0, 1))).toBe('2026-10-05');
  });
  it('orders future visits by date then time without changing the source', () => {
    const visit = (id: number, scheduledDate: string, startTime: string): VisitView => ({id, serviceRequestId: id, scheduledDate, startTime, endTime: '18:00', status: 'SCHEDULED'});
    const source = [visit(1, '2026-11-01', '09:00'), visit(2, '2026-10-06', '15:00'), visit(3, '2026-10-06', '08:00')];
    expect(sortVisits(source).map(item => item.id)).toEqual([3, 2, 1]);
    expect(source.map(item => item.id)).toEqual([1, 2, 3]);
  });
});
