<script lang="ts">
	import { resolve } from '$app/paths';
	import { dateRange, weekdayShort } from '#lib/domain/calendar.ts';
	import { isHardSession, planWeeks, type PlanSession } from '#lib/domain/plan.ts';
	import { weekView } from '#lib/domain/schedule.ts';
	import HardDot from '#lib/ui/HardDot.svelte';

	let { plan, highlighted }: { plan: PlanSession[]; highlighted: string } = $props();

	const view = $derived(weekView(plan, highlighted));
</script>

{#if view}
	<header>
		<p>{dateRange(view.days[0]?.date ?? '', view.days.at(-1)?.date ?? '')}</p>
		<h1>Week {view.week} <span>of {planWeeks}</span></h1>
	</header>
	<main>
		{#each view.days as day (day.date)}
			{@const current = day.date === highlighted}
			{#if day.session}
				<a class="row" class:current href={current ? resolve('/') : resolve('/day/[date]', { date: day.date })} aria-current={current ? 'date' : undefined}>
					<span class="day">{weekdayShort(day.date)}</span>
					<span class="title">{day.session.title}</span>
					{#if isHardSession(day.session)}<HardDot />{/if}
				</a>
			{:else}
				<div class="row rest" class:current aria-current={current ? 'date' : undefined}>
					<span class="day">{weekdayShort(day.date)}</span>
					<span class="title">Rest</span>
				</div>
			{/if}
		{/each}
	</main>
{/if}

<style>
	header {
		padding: 24px 24px 28px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	header p {
		margin: 0;
		font-size: 15px;
		color: var(--text-muted);
	}

	h1 {
		font-size: 34px;
		line-height: 1.08;
	}

	h1 span {
		color: var(--text-muted);
		font-weight: 600;
	}

	main {
		padding: 0 16px;
		display: flex;
		flex-direction: column;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 64px;
		padding: 0 8px;
		border-top: 1px solid var(--border-glass);
		color: inherit;
		text-decoration: none;
	}

	.row:last-child {
		border-bottom: 1px solid var(--border-glass);
	}

	a.row {
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
		transition: transform var(--press-duration) var(--ease-out);
	}

	a.row:active {
		transform: scale(0.98);
	}

	.day {
		width: 36px;
		font-size: 15px;
		color: var(--text-muted);
	}

	.title {
		flex: 1;
		font-size: 17px;
	}

	.current .day {
		color: var(--accent);
		font-weight: 600;
	}

	.current .title {
		font-weight: 600;
	}

	.rest .title {
		color: var(--text-muted);
	}

	@media (hover: hover) and (pointer: fine) {
		a.row:hover {
			background: var(--bg-glass);
		}
	}
</style>
