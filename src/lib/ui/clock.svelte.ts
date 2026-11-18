import { localIsoDate } from '#lib/domain/calendar.ts';

let today = $state(localIsoDate(Date.now()));

export const clock = {
	get today() {
		return today;
	}
};

export function trackToday(): void {
	$effect(() => {
		const refresh = () => {
			today = localIsoDate(Date.now());
		};
		refresh();
		document.addEventListener('visibilitychange', refresh);
		window.addEventListener('focus', refresh);
		return () => {
			document.removeEventListener('visibilitychange', refresh);
			window.removeEventListener('focus', refresh);
		};
	});
}
