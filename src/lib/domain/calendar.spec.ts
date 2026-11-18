import { describe, expect, it } from 'vitest';
import { addDays, dateRange, localIsoDate, mondayOf, monthDay, weekdayName, weekdayShort } from './calendar.ts';

describe('calendar', () => {
	it('formats the local calendar date, not the UTC one', () => {
		expect(localIsoDate(new Date(2026, 11, 7, 23, 59).getTime())).toBe('2026-12-07');
		expect(localIsoDate(new Date(2027, 0, 1, 0, 1).getTime())).toBe('2027-01-01');
	});

	it('steps days across month and year ends', () => {
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	it('finds the Monday that starts the week', () => {
		expect(mondayOf('2026-12-07')).toBe('2026-12-07');
		expect(mondayOf('2026-12-13')).toBe('2026-12-07');
		expect(mondayOf('2026-12-14')).toBe('2026-12-14');
	});

	it('names days and ranges the way the design does', () => {
		expect(weekdayName('2026-12-07')).toBe('Monday');
		expect(weekdayShort('2026-12-13')).toBe('Sun');
		expect(monthDay('2026-12-07')).toBe('Dec 7');
		expect(dateRange('2026-12-07', '2026-12-13')).toBe('Dec 7 – 13');
		expect(dateRange('2026-12-28', '2027-01-03')).toBe('Dec 28 – Jan 3');
	});
});
