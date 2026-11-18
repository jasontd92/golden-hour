<script lang="ts">
	import { monthDay, weekdayName } from '#lib/domain/calendar.ts';
	import type { PlanSession } from '#lib/domain/plan.ts';
	import { pickToday } from '#lib/domain/schedule.ts';
	import SessionView from './SessionView.svelte';

	let {
		plan,
		today,
		startable
	}: { plan: PlanSession[]; today: string; startable?: boolean } = $props();

	const pick = $derived(pickToday(plan, today));
</script>

{#if pick.kind === 'session'}
	{@const date = pick.session.date}
	{#key date}
		<SessionView
			session={pick.session}
			dayLabel={pick.beforePlan ? `${weekdayName(date)}, ${monthDay(date)}` : weekdayName(date)}
			{startable}
		/>
	{/key}
{:else}
	<header>
		<p>{weekdayName(pick.date)}</p>
		<h1>Rest</h1>
	</header>
{/if}

<style>
	header {
		padding: 24px 24px 28px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	p {
		margin: 0;
		font-size: 15px;
		color: var(--text-muted);
	}

	h1 {
		font-size: 34px;
		line-height: 1.08;
	}
</style>
