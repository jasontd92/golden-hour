<script lang="ts">
	import type { Snippet } from 'svelte';
	import { dateRange, monthDay, weekdayName, weekdayShort } from '#lib/domain/calendar.ts';
	import { planWeeks, type PlanSession } from '#lib/domain/plan.ts';
	import { columnNames, planGrid, type GridDay } from '#lib/domain/plan-grid.ts';
	import { focusDate, pickToday } from '#lib/domain/schedule.ts';
	import WeekSummary from './WeekSummary.svelte';

	let {
		plan,
		today,
		logged,
		session
	}: {
		plan: PlanSession[];
		today: string;
		logged: ReadonlySet<string>;
		session: Snippet<[session: PlanSession, dayLabel: string, status: string | undefined]>;
	} = $props();

	type Selection = { kind: 'day'; date: string } | { kind: 'week'; week: number };

	const grid = $derived(planGrid(plan));
	const columns = $derived(columnNames(plan));
	const home = $derived(focusDate(pickToday(plan, today)));
	const homeWeek = $derived(plan.find((s) => s.date >= home)?.week ?? plan[0]?.week ?? 1);
	const span = $derived(grid.length > 0 ? dateRange(grid[0]?.monday ?? '', grid.at(-1)?.days.at(-1)?.date ?? '') : '');

	let chosen = $state<Selection | null | undefined>();
	const selection = $derived(chosen === undefined ? { kind: 'day' as const, date: home } : chosen);
	let focus = $state<{ row: number; col: number } | undefined>();
	const cells: (HTMLButtonElement | undefined)[][] = [];

	const homeCell = $derived.by(() => {
		const row = grid.findIndex((w) => w.days.some((d) => d.date === home));
		const col = row < 0 ? 1 : (grid[row]?.days.findIndex((d) => d.date === home) ?? 0) + 1;
		return { row: Math.max(row, 0), col };
	});
	const tabStop = $derived(focus ?? homeCell);

	const isSelectedDay = (day: GridDay) => selection?.kind === 'day' && selection.date === day.date;

	function status(date: string): string | undefined {
		if (logged.has(date)) return 'Logged';
		return date < today ? 'Not logged' : undefined;
	}

	function dayAria(day: GridDay): string {
		const parts = [`${weekdayShort(day.date)} ${monthDay(day.date)}`, day.session?.title ?? day.holiday ?? 'Rest'];
		if (day.hard) parts.push(day.scaled ? 'hard, scaled' : 'hard');
		if (day.date === today) parts.push('today');
		const state = day.session ? status(day.date) : undefined;
		if (state) parts.push(state.toLowerCase());
		return parts.join(', ');
	}

	function select(row: number, col: number): void {
		const week = grid[row];
		if (!week) return;
		focus = { row, col };
		const day = week.days[col - 1];
		chosen = col === 0 || !day ? { kind: 'week', week: week.week } : { kind: 'day', date: day.date };
	}

	const moves: Record<string, [number, number]> = {
		ArrowUp: [-1, 0],
		ArrowDown: [1, 0],
		ArrowLeft: [0, -1],
		ArrowRight: [0, 1]
	};

	function onGridKey(event: KeyboardEvent): void {
		const move = moves[event.key];
		if (!move) return;
		event.preventDefault();
		const row = Math.min(Math.max(tabStop.row + move[0], 0), grid.length - 1);
		const col = Math.min(Math.max(tabStop.col + move[1], 0), 6);
		select(row, col);
		cells[row]?.[col]?.focus();
	}

	function onWindowKey(event: KeyboardEvent): void {
		if (event.key === 'Escape' && selection) chosen = null;
	}

	const selectedDay = $derived.by(() => {
		if (selection?.kind !== 'day') return undefined;
		const date = selection.date;
		return { date, session: plan.find((s) => s.date === date), holiday: grid.flatMap((w) => w.days).find((d) => d.date === date)?.holiday };
	});
</script>

<svelte:window onkeydown={onWindowKey} />

<div class="plan" class:closed={!selection}>
	<section aria-label="Plan calendar">
		<header>
			<div class="titles">
				<p>Evolution 5 · {span}</p>
				<h1>Week {homeWeek} <span>of {planWeeks}</span></h1>
			</div>
			<div class="key" aria-hidden="true">
				<span><i class="dot"></i>Hard</span>
				<span><i class="dot hollow"></i>Scaled</span>
				<span><i class="swatch"></i>Logged</span>
			</div>
		</header>
		<div role="grid" aria-label="Weeks and days" tabindex="-1" onkeydown={onGridKey}>
			<div role="row" class="row columns">
				<span role="columnheader"><span class="visually-hidden">Phase</span></span>
				<span role="columnheader"><span class="visually-hidden">Week</span></span>
				{#each columns as name, d (d)}
					<span role="columnheader" class="column">
						<span class="muted">{weekdayShort(grid[0]?.days[d]?.date ?? '')}</span>
						<span class="trunc">{name}</span>
					</span>
				{/each}
			</div>
			{#each grid as week, row (week.week)}
				<div role="row" class="row" class:phase-start={week.firstOfPhase && row > 0}>
					<span role="rowheader" class="phase">{week.firstOfPhase ? week.phase : ''}</span>
					<span role="gridcell">
						<button
							type="button"
							class="cell week"
							class:home={week.week === homeWeek}
							class:selected={selection?.kind === 'week' && selection.week === week.week}
							aria-label="Week {week.week}, {week.phase}, starts {monthDay(week.monday)}"
							aria-pressed={selection?.kind === 'week' && selection.week === week.week}
							tabindex={tabStop.row === row && tabStop.col === 0 ? 0 : -1}
							bind:this={() => cells[row]?.[0], (el) => ((cells[row] ??= [])[0] = el)}
							onclick={() => select(row, 0)}
						>
							<span class="num n">{week.week}</span><span class="muted">{monthDay(week.monday)}</span>
						</button>
					</span>
					{#each week.days as day, d (day.date)}
						{@const col = d + 1}
						<span role="gridcell">
							<button
								type="button"
								class="cell day"
								class:logged={logged.has(day.date)}
								class:today={day.date === today}
								class:selected={isSelectedDay(day)}
								aria-label={dayAria(day)}
								title={dayAria(day)}
								aria-pressed={isSelectedDay(day)}
								tabindex={tabStop.row === row && tabStop.col === col ? 0 : -1}
								bind:this={() => cells[row]?.[col], (el) => ((cells[row] ??= [])[col] = el)}
								onclick={() => select(row, col)}
							>
								{#if day.hard}<i class="dot" class:hollow={day.scaled}></i>{/if}
								{#if day.test}
									<span class="trunc">{day.test}</span>
								{:else if day.holiday}
									<span class="trunc muted">{day.holiday}</span>
								{/if}
							</button>
						</span>
					{/each}
				</div>
			{/each}
		</div>
	</section>

	{#if selection}
		<aside aria-label="Selected">
			{#if !(selectedDay && selectedDay.date === home)}
				<button type="button" class="quiet today-link" onclick={() => (chosen = undefined)}>Today</button>
			{/if}
			<div class="pane">
				{#if selection.kind === 'week'}
					<WeekSummary {plan} week={selection.week} {logged} {today} />
				{:else if selectedDay}
					{@const label = `${weekdayName(selectedDay.date)}, ${monthDay(selectedDay.date)}${selectedDay.holiday ? ` · ${selectedDay.holiday}` : ''}`}
					{#if selectedDay.session}
						{#key selectedDay.date}
							{@render session(selectedDay.session, label, status(selectedDay.date))}
						{/key}
					{:else}
						<p class="day-label">{label}</p>
						<h2>Rest</h2>
					{/if}
				{/if}
			</div>
		</aside>
	{/if}
</div>

<style>
	.plan {
		flex: 1;
		min-height: 0;
		padding: 0 48px 36px;
		display: grid;
		grid-template-columns: minmax(0, 1fr) clamp(320px, 28vw, 400px);
		gap: 40px;
		font-variant-numeric: tabular-nums;
	}

	.plan.closed {
		grid-template-columns: minmax(0, 1fr);
	}

	section {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	header {
		padding: 20px 0 22px;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px;
	}

	.titles {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.titles p {
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

	.key {
		display: flex;
		align-items: center;
		gap: 18px;
		padding-bottom: 4px;
		font-size: 13px;
		color: var(--text-muted);
	}

	.key span {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.swatch {
		width: 20px;
		height: 12px;
		border-radius: var(--radius);
		background: var(--bg-glass);
	}

	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		border: 1.5px solid var(--accent);
	}

	.dot.hollow {
		background: transparent;
	}

	.row {
		display: grid;
		grid-template-columns: 76px 96px repeat(6, minmax(0, 1fr));
		column-gap: 4px;
		height: 34px;
		align-items: center;
	}

	.row.columns {
		height: 40px;
		font-size: 13px;
	}

	.row.phase-start {
		margin-top: 8px;
	}

	.column {
		padding: 0 10px;
		display: flex;
		gap: 6px;
		min-width: 0;
	}

	.phase {
		font-size: 13px;
		color: var(--text-muted);
	}

	[role='gridcell'] {
		min-width: 0;
	}

	.cell {
		position: relative;
		isolation: isolate;
		width: 100%;
		height: 30px;
		min-width: 0;
		border: 0;
		border-radius: var(--radius);
		padding: 0 10px;
		display: flex;
		align-items: center;
		gap: 8px;
		background: transparent;
		color: var(--text-primary);
		font-size: 13px;
		text-align: left;
		cursor: pointer;
	}

	.cell::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		border-radius: inherit;
		background: var(--bg-glass);
		opacity: 0;
		transition: opacity 100ms ease;
	}

	.n {
		width: 18px;
		text-align: right;
	}

	.week.home .n {
		color: var(--accent);
	}

	.week .muted {
		white-space: nowrap;
	}

	.day.logged {
		background: var(--bg-glass);
	}

	.cell.selected {
		box-shadow: inset 0 0 0 1px var(--text-primary);
	}

	.day.today {
		box-shadow: inset 0 0 0 1px var(--accent);
	}

	.day.today.selected {
		box-shadow: inset 0 0 0 2px var(--accent);
	}

	.muted {
		color: var(--text-muted);
	}

	.trunc {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	aside {
		border-left: 1px solid var(--border-glass);
		position: relative;
		padding: 24px 0 0 40px;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.today-link {
		position: absolute;
		top: 24px;
		right: 0;
	}

	.day-label {
		margin: 0 0 6px;
		font-size: 15px;
		color: var(--text-muted);
	}

	.quiet {
		border: 0;
		padding: 0;
		background: transparent;
		color: var(--text-muted);
		font-size: 15px;
		cursor: pointer;
		transition: color 100ms ease;
	}

	.pane {
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
	}

	.pane h2 {
		font-size: 28px;
		line-height: 1.1;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (hover: hover) and (pointer: fine) {
		.cell:hover::before {
			opacity: 1;
		}

		.quiet:hover {
			color: var(--text-primary);
		}
	}
</style>
