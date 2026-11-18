<script lang="ts">
	import { chartX, chartY, evolutionChart, type WeekValue } from '#lib/domain/evolution-chart.ts';
	import type { PlanSession } from '#lib/domain/plan.ts';
	import { trainingMaxByWeek } from '#lib/domain/plan-grid.ts';
	import type { ProgressDetail } from '#lib/domain/progress-detail.ts';
	import { formatScore } from '#lib/domain/score.ts';

	let {
		detail,
		plan,
		firstMonday,
		today
	}: { detail: ProgressDetail; plan: PlanSession[]; firstMonday: string; today: string } = $props();

	const height = 168;
	let width = $state(820);

	const trainingMaxes = $derived(detail.kind === 'lift' ? trainingMaxByWeek(plan, detail.id.replaceAll('-', '_')) : []);
	const chart = $derived(
		evolutionChart({
			better: detail.better,
			observations: detail.observations,
			targets: detail.targets,
			trainingMaxes,
			firstMonday,
			today
		})
	);
	const show = (value: number) => formatScore(Math.round(value), detail.scoreType);
	const x = (week: number) => chartX(week, width);
	const y = (value: number) => (chart ? chartY(chart, value, height) : 0);
	const path = (points: readonly WeekValue[]) =>
		points.map((p, i) => `${i ? 'L' : 'M'}${x(p.week).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
	const planLabel = $derived(trainingMaxes.length > 0 ? 'Training max' : 'Target');
	const labelAt = $derived.by(() => {
		if (!chart) return undefined;
		if (trainingMaxes.length > 0) return chart.plan[Math.floor(chart.plan.length * 0.7)];
		return chart.targets.at(-1);
	});
	const targetAt = $derived(chart?.targets.at(-1));
	const description = $derived.by(() => {
		const start = chart?.logged[0];
		const target = chart?.targets.at(-1);
		return `${detail.name} over Evolution 5${start ? `: start ${show(start.value)}` : ''}${target ? `, target ${show(target.value)}` : ''}`;
	});
	const ticks = [0, 4, 8, 12, 16];
</script>

{#if chart}
	<figure aria-label={description}>
		<figcaption>
			<span>This evolution · up is better</span>
			<span class="key" aria-hidden="true">
				<span><i class="line"></i>Logged</span>
				{#if chart.plan.length > 0}<span><i class="line dashed"></i>{planLabel}</span>{/if}
			</span>
		</figcaption>
		<div class="plot" bind:clientWidth={width}>
			{#each chart.ticks as tick (tick)}
				<div class="grid" style:top="{y(tick)}px"></div>
				<div class="y num" style:top="{y(tick)}px">{show(tick)}</div>
			{/each}
			{#if chart.todayWeek !== undefined}
				<div class="today" style:left="{x(chart.todayWeek)}px"></div>
				<div class="today-label" style:left="{x(chart.todayWeek)}px">Today</div>
			{/if}
			<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true">
				{#if chart.plan.length > 0}<path class="plan" d={path(chart.plan)} />{/if}
				{#if chart.logged.length > 1}<path class="logged" d={path(chart.logged)} />{/if}
				{#each chart.targets as point (point.week)}
					<circle class="target" cx={x(point.week)} cy={y(point.value)} r="4">
						<title>Target, week {point.week}: {show(point.value)}</title>
					</circle>
				{/each}
				{#each chart.logged as point, i (i)}
					<circle class="point" cx={x(point.week)} cy={y(point.value)} r="4">
						<title>{point.week === 0 ? 'Start' : `Week ${Math.floor(point.week) + 1}`}: {show(point.value)}</title>
					</circle>
				{/each}
			</svg>
			{#if labelAt}
				<span class="direct" style:left="{x(labelAt.week)}px" style:top="{y(labelAt.value)}px">{planLabel}</span>
			{/if}
			{#if trainingMaxes.length > 0 && targetAt}
				<span class="direct" style:left="{x(targetAt.week)}px" style:top="{y(targetAt.value)}px">Target</span>
			{/if}
			{#each ticks as week (week)}
				<span class="x num" style:left="{x(week)}px">{week}</span>
			{/each}
		</div>
	</figure>
{/if}

<style>
	figure {
		position: relative;
		margin: 32px 0 0;
		height: 236px;
	}

	figcaption {
		display: flex;
		gap: 18px;
		font-size: 13px;
		color: var(--text-muted);
	}

	.key {
		display: flex;
		gap: 14px;
	}

	.key span {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.line {
		width: 16px;
		border-top: 2px solid var(--accent);
	}

	.line.dashed {
		border-top: 2px dashed var(--text-muted);
	}

	.plot {
		position: absolute;
		left: 48px;
		right: 8px;
		top: 44px;
		height: 168px;
	}

	.grid {
		position: absolute;
		left: 0;
		right: 0;
		border-top: 1px solid var(--border-glass);
	}

	.y {
		position: absolute;
		left: -48px;
		width: 40px;
		transform: translateY(-50%);
		text-align: right;
		font-size: 12px;
		color: var(--text-muted);
	}

	.today {
		position: absolute;
		top: -6px;
		bottom: 0;
		border-left: 1px dashed var(--text-muted);
		opacity: 0.6;
	}

	.today-label {
		position: absolute;
		top: -24px;
		transform: translateX(-50%);
		font-size: 12px;
		color: var(--text-muted);
	}

	svg {
		position: absolute;
		inset: 0;
		overflow: visible;
	}

	path {
		fill: none;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.plan {
		stroke: var(--text-muted);
		stroke-dasharray: 4 5;
	}

	.logged {
		stroke: var(--accent);
	}

	circle {
		stroke-width: 2;
		paint-order: stroke;
	}

	.point {
		fill: var(--accent);
		stroke: var(--bg-base);
	}

	.target {
		fill: var(--bg-base);
		stroke: var(--text-muted);
	}

	.direct {
		position: absolute;
		transform: translate(-50%, -100%);
		padding-bottom: 8px;
		font-size: 12px;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.x {
		position: absolute;
		top: 178px;
		transform: translateX(-50%);
		font-size: 12px;
		color: var(--text-muted);
	}
</style>
