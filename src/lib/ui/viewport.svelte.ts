import { MediaQuery } from 'svelte/reactivity';

export const deskMinWidth = 1024;

const desk = new MediaQuery(`min-width: ${deskMinWidth}px`);
let hydrated = $state(false);

export type View = 'phone' | 'desk';

export const viewport = {
	get hydrated() {
		return hydrated;
	}
};

export function trackHydration(): void {
	$effect(() => {
		hydrated = true;
		document.documentElement.dataset.hydrated = '';
	});
}

export function showsView(view: View): boolean {
	if (!hydrated) return true;
	return view === 'desk' ? desk.current : !desk.current;
}
