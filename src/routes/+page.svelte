<script lang="ts">
	import { loggedSessions, trackLoggedSessions } from '#lib/features/log/effects.svelte.ts';
	import Plan from '#lib/features/plan/Plan.svelte';
	import SessionView from '#lib/features/today/SessionView.svelte';
	import Today from '#lib/features/today/Today.svelte';
	import { clock } from '#lib/ui/clock.svelte.ts';
	import Viewport from '#lib/ui/Viewport.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	trackLoggedSessions();
</script>

<svelte:head>
	<title>Golden Hour</title>
</svelte:head>

<Viewport only="phone" page>
	<Today plan={data.plan} today={clock.today} startable={data.startEnabled} />
</Viewport>
<Viewport only="desk" page>
	<Plan plan={data.plan} today={clock.today} logged={loggedSessions.dates}>
		{#snippet session(session, dayLabel, status)}
			<SessionView {session} {dayLabel} {status} nested />
		{/snippet}
	</Plan>
</Viewport>
