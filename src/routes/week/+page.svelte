<script lang="ts">
	import { focusDate, pickToday } from '#lib/domain/schedule.ts';
	import Week from '#lib/features/week/Week.svelte';
	import { clock } from '#lib/ui/clock.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const highlighted = $derived(focusDate(pickToday(data.plan, clock.today)));
</script>

<svelte:head>
	<title>Week · Golden Hour</title>
</svelte:head>

<Week plan={data.plan} {highlighted} />
