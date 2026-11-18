<script lang="ts">
	import { planWeeks, type PlanSession } from '#lib/domain/plan.ts';
	import { nextAttempt } from '#lib/domain/plan-grid.ts';
	import type { ProgressDetail } from '#lib/domain/progress-detail.ts';
	import type { ProgressRow } from '#lib/domain/progress.ts';
	import { weeksSince } from '#lib/domain/evolution-chart.ts';
	import EvolutionChart from './EvolutionChart.svelte';

	let {
		benchmarks,
		lifts,
		details,
		plan,
		firstMonday,
		today
	}: {
		benchmarks: ProgressRow[];
		lifts: ProgressRow[];
		details: ProgressDetail[];
		plan: PlanSession[];
		firstMonday: string;
		today: string;
	} = $props();

	const groups = $derived([
		{ name: 'Benchmarks', kind: 'benchmark' as const, rows: benchmarks },
		{ name: 'Lifts · 1 rep max', kind: 'lift' as const, rows: lifts }
	]);
	let chosen = $state<string | undefined>();
	const key = (kind: string, id: string) => `${kind}:${id}`;
	const selected = $derived(
		details.find((d) => key(d.kind, d.id) === chosen) ?? details[0]
	);
	const week = $derived(Math.floor(weeksSince(firstMonday, today)) + 1);
	const next = $derived(selected ? nextAttempt(plan, selected.kind, selected.id, today) : undefined);
	const stats = $derived.by(() => {
		if (!selected) return [];
		const list: { label: string; value: string; quiet: boolean }[] = [];
		if (selected.best) list.push({ label: 'Best', value: selected.best, quiet: false });
		if (selected.latest) list.push({ label: 'Latest', value: selected.latest, quiet: false });
		if (selected.target) list.push({ label: 'Target', value: selected.target, quiet: true });
		if (next !== undefined) list.push({ label: 'Next', value: `Wk ${next}`, quiet: true });
		return list;
	});
</script>

<div class="progress">
	<section aria-label="Results">
		<header>
			<p>
				Evolution 5 · {week < 1 ? `starts ${firstMonday}` : week > planWeeks ? 'done' : `week ${week} of ${planWeeks}`}
			</p>
			<h1>Progress</h1>
		</header>
		<div class="groups">
			{#each groups as group (group.name)}
				<div class="group">
					<h2>{group.name}</h2>
					<ul aria-label={group.name}>
						{#each group.rows as row (row.id)}
							{@const current = selected?.kind === group.kind && selected.id === row.id}
							<li>
								<button type="button" class="row" class:current aria-pressed={current} onclick={() => (chosen = key(group.kind, row.id))}>
									<span class="name">{row.name}</span>
									<span class="num best">{row.best}</span>
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</section>

	{#if selected}
		<article aria-label={selected.name}>
			<div class="top">
				<div class="titles">
					<p>{selected.kind === 'lift' ? 'Lift' : 'Benchmark'} · {selected.unit}</p>
					<h2>{selected.name}</h2>
				</div>
				<dl>
					{#each stats as stat (stat.label)}
						<div>
							<dt>{stat.label}</dt>
							<dd class="num" class:quiet={stat.quiet}>{stat.value}</dd>
						</div>
					{/each}
				</dl>
			</div>
			{#key key(selected.kind, selected.id)}
				<EvolutionChart detail={selected} {plan} {firstMonday} {today} />
			{/key}
			<div class="history">
				<h3>History</h3>
				<ol aria-label="{selected.name} history">
					{#each selected.history as row, i (i)}
						<li>
							<span class="date">{row.date}</span>
							<span class="num score">{row.score}</span>
							<span class="note">{[row.score === selected.best && !row.conflict ? 'Best' : '', row.conflict ?? row.source].filter(Boolean).join(' · ')}</span>
						</li>
					{/each}
				</ol>
			</div>
		</article>
	{/if}
</div>

<style>
	.progress {
		flex: 1;
		min-height: 0;
		padding: 0 48px 36px;
		display: grid;
		grid-template-columns: 360px minmax(0, 1fr);
		gap: 40px;
		font-variant-numeric: tabular-nums;
	}

	section {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	header {
		padding: 20px 0 22px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	header p,
	.titles p {
		margin: 0;
		font-size: 15px;
		color: var(--text-muted);
	}

	h1 {
		font-size: 34px;
		line-height: 1.08;
	}

	.groups {
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.group h2 {
		margin: 0 8px 6px;
		font-size: 15px;
		font-weight: 400;
		letter-spacing: 0;
		color: var(--text-muted);
	}

	ul,
	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	ul li {
		border-top: 1px solid var(--border-glass);
	}

	.row {
		position: relative;
		isolation: isolate;
		width: 100%;
		height: 44px;
		margin: 2px 0;
		padding: 0 8px;
		border: 0;
		border-radius: var(--radius);
		display: flex;
		align-items: center;
		gap: 10px;
		background: transparent;
		font-size: 16px;
		text-align: left;
		cursor: pointer;
	}

	.row::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: inherit;
		background: var(--bg-glass);
		opacity: 0;
		transition: opacity 100ms ease;
	}

	.row.current {
		background: var(--bg-glass);
	}

	.name {
		flex: 1;
	}

	.best {
		font-size: 15px;
		font-weight: 500;
	}

	article {
		border-left: 1px solid var(--border-glass);
		padding: 24px 0 0 40px;
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
	}

	.top {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px;
	}

	.titles {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.titles h2 {
		font-size: 28px;
		line-height: 1.1;
	}

	dl {
		margin: 0;
		display: flex;
		gap: 36px;
	}

	dl div {
		display: flex;
		flex-direction: column;
		gap: 2px;
		align-items: flex-end;
	}

	dt {
		font-size: 13px;
		color: var(--text-muted);
	}

	dd {
		margin: 0;
		font-size: 28px;
		font-weight: 500;
		letter-spacing: -0.01em;
	}

	dd.quiet {
		color: var(--text-muted);
	}

	.history {
		margin-top: 20px;
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
	}

	h3 {
		margin: 0 8px 6px;
		font-size: 13px;
		font-weight: 400;
		letter-spacing: 0;
		color: var(--text-muted);
	}

	ol li {
		min-height: 36px;
		padding: 0 8px;
		display: flex;
		align-items: center;
		gap: 16px;
		border-top: 1px solid var(--border-glass);
		font-size: 15px;
	}

	.date {
		width: 120px;
		color: var(--text-muted);
	}

	.score {
		width: 80px;
		text-align: right;
	}

	.note {
		flex: 1;
		font-size: 13px;
		color: var(--text-muted);
	}

	@media (hover: hover) and (pointer: fine) {
		.row:hover::before {
			opacity: 1;
		}
	}
</style>
