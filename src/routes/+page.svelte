<script lang="ts">
	import type { PlanSession } from '#lib/domain/plan.ts';
	import { logSteps } from '#lib/features/log/steps.ts';
	import Today from '#lib/features/today/Today.svelte';
	import { clock } from '#lib/ui/clock.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hasSets = (session: PlanSession) => logSteps(session).length > 0;
</script>

<svelte:head>
	<title>Golden Hour</title>
</svelte:head>

<Today plan={data.plan} today={clock.today} startable={data.startEnabled ? hasSets : undefined} />
