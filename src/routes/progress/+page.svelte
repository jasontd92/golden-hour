<script lang="ts">
	import Progress from '#lib/features/progress/Progress.svelte';
	import ProgressDesk from '#lib/features/progress/ProgressDesk.svelte';
	import { clock } from '#lib/ui/clock.svelte.ts';
	import Viewport from '#lib/ui/Viewport.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Progress · Golden Hour</title>
</svelte:head>

<Viewport only="phone" page>
	<Progress
		benchmarks={data.benchmarks}
		lifts={data.lifts}
		benchmarkCount={data.benchmarkCount}
		liftCount={data.liftCount}
	/>
</Viewport>
<Viewport only="desk" page>
	<ProgressDesk
		benchmarks={data.benchmarks}
		lifts={data.lifts}
		details={data.details}
		plan={data.plan}
		firstMonday={data.firstMonday}
		today={clock.today}
	/>
</Viewport>
