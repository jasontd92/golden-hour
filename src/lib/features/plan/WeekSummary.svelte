<script lang="ts">
	import { dateRange } from '#lib/domain/calendar.ts';
	import type { MainLift } from '#lib/domain/evolution.ts';
	import type { PlanSession } from '#lib/domain/plan.ts';
	import { weekSummary } from '#lib/domain/plan-grid.ts';

	let { plan, week, logged, today }: { plan: PlanSession[]; week: number; logged: ReadonlySet<string>; today: string } =
		$props();

	const liftNames: Record<MainLift, string> = { back_squat: 'Squat TM', shoulder_press: 'Press TM', deadlift: 'Deadlift TM' };

	const summary = $derived(weekSummary(plan, week));
	const rows = $derived.by(() => {
		if (!summary) return [];
		const sessions = plan.filter((s) => s.week === week);
		const facts: [name: string, value: string][] = [];
		if (summary.scheme) facts.push(['Main lifts', summary.scheme]);
		for (const tm of summary.trainingMaxes) facts.push([liftNames[tm.lift], String(tm.value)]);
		if (summary.longRunMinutes !== undefined) facts.push(['Long run', `${summary.longRunMinutes} min`]);
		if (!summary.scheme && summary.tests > 0) facts.push(['Tests', String(summary.tests)]);
		if (summary.monday <= today) {
			const done = sessions.filter((s) => logged.has(s.date)).length;
			facts.push(['Logged', `${done} of ${summary.planned}`]);
		}
		return facts;
	});
</script>

{#if summary}
	<p class="kicker">{dateRange(summary.monday, summary.sunday)}</p>
	<h2>Week {summary.week} · {summary.phase}</h2>
	<dl>
		{#each rows as [name, value] (name)}
			<div>
				<dt>{name}</dt>
				<dd class="num">{value}</dd>
			</div>
		{/each}
	</dl>
{/if}

<style>
	.kicker {
		margin: 0;
		font-size: 15px;
		color: var(--text-muted);
	}

	h2 {
		margin-top: 6px;
		font-size: 28px;
		line-height: 1.1;
	}

	dl {
		margin: 24px 0 0;
		border-bottom: 1px solid var(--border-glass);
	}

	div {
		min-height: 52px;
		padding: 0 8px;
		display: flex;
		align-items: center;
		gap: 10px;
		border-top: 1px solid var(--border-glass);
		font-size: 16px;
	}

	dt {
		flex: 1;
		color: var(--text-muted);
	}

	dd {
		margin: 0;
		font-size: 15px;
	}
</style>
