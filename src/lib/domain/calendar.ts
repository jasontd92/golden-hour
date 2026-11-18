const msPerDay = 86_400_000;
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

export function localIsoDate(epochMs: number): string {
	const now = new Date(epochMs);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(date: string, days: number): string {
	return new Date(utc(date).getTime() + days * msPerDay).toISOString().slice(0, 10);
}

export function mondayOf(date: string): string {
	return addDays(date, -((utc(date).getUTCDay() + 6) % 7));
}

export function weekdayName(date: string): string {
	return weekdays[utc(date).getUTCDay()] ?? '';
}

export function weekdayShort(date: string): string {
	return weekdayName(date).slice(0, 3);
}

export function monthDay(date: string): string {
	const day = utc(date);
	return `${months[day.getUTCMonth()]} ${day.getUTCDate()}`;
}

export function dateRange(first: string, last: string): string {
	const sameMonth = first.slice(0, 7) === last.slice(0, 7);
	return `${monthDay(first)} – ${sameMonth ? utc(last).getUTCDate() : monthDay(last)}`;
}

const fixedHolidays: Readonly<Record<string, string>> = { '12-25': 'Christmas', '01-01': "New Year's" };

export function holidayName(date: string): string | undefined {
	return fixedHolidays[date.slice(5)];
}
