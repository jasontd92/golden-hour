<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type { PlanSession } from '#lib/domain/plan.ts';
	import { estimatedOneRm } from '#lib/domain/strength.ts';
	import { deviceId } from './device.ts';
	import { logSync, requestSync, restCountdown, resumeOnOpen } from './effects.svelte.ts';
	import { persistLocalLog } from './effects.ts';
	import { LogFlow } from './flow.svelte.ts';
	import { localLog } from './local.ts';
	import { formatRest, rememberedRest, rememberRest } from './rest.ts';
	import { logSteps, repsTarget, stepTitle } from './steps.ts';

	let { session }: { session: PlanSession } = $props();

	const flow = untrack(
		() =>
			new LogFlow(session.date, logSteps(session), {
				store: localLog,
				deviceId: () => deviceId(),
				recallRest: () => rememberedRest(),
				keepRest: (rest) => rememberRest(rest),
				saved: () => {
					persistLocalLog();
					requestSync();
				}
			})
	);
	resumeOnOpen(flow);
	const rest = restCountdown(() => flow.restEndsAt);

	let noteOpen = $state(false);
	const rpeChoices = Array.from({ length: 19 }, (_, i) => 1 + i / 2);
	const status = $derived(!logSync.online ? 'Offline' : logSync.notSynced ? 'Not synced' : undefined);

	async function done() {
		await flow.done();
		noteOpen = false;
	}
</script>

<div class="screen">
	<header>
		<a class="back" href={resolve('/')} aria-label="Back to today">
			<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"></path></svg>
		</a>
		<span class="title">{flow.step ? stepTitle(flow.step) : session.title}</span>
		<span class="status">{#if status}<a href={resolve('/sync')}>{status}</a>{/if}</span>
	</header>
	{#if flow.ready && flow.step}
		{@const step = flow.step}
		<main>
			<div class="target">
				{#if step.load === undefined}
					<div class="load bodyweight">Bodyweight</div>
					<div class="sub">{repsTarget(step)}</div>
				{:else}
					<div class="load num">{step.load}</div>
					<div class="sub">lb · {repsTarget(step)}</div>
				{/if}
			</div>
			{#if flow.saved}
				{@const saved = flow.saved}
				<div class="swap saved" data-testid="saved">
					<div class="saved-reps">{saved.reps} {saved.reps === 1 ? 'rep' : 'reps'} saved</div>
					{#if saved.load !== undefined}
						<div class="estimate">Estimated max <span class="num">{estimatedOneRm(saved.load, saved.reps)}</span> lb</div>
					{/if}
					{#if rest.left !== undefined}
						<div class="rest num" role="timer">{formatRest(rest.left)}</div>
						<div class="rest-label">rest</div>
					{/if}
				</div>
			{:else}
				<div class="swap stepper">
					<button type="button" class="step" aria-label="One fewer rep" onclick={() => flow.less()}>−</button>
					<div class="count">
						<span class="num" aria-live="polite">{flow.reps}</span>
						<span class="count-label">reps</span>
					</div>
					<button type="button" class="step" aria-label="One more rep" onclick={() => flow.more()}>+</button>
				</div>
			{/if}
		</main>
		{#if noteOpen && !flow.saved}
			<div class="swap note" id="note" data-testid="note">
				<label>
					<span>Effort (RPE)</span>
					<select bind:value={flow.rpe}>
						<option value={undefined}>—</option>
						{#each rpeChoices as choice (choice)}<option value={choice}>{choice}</option>{/each}
					</select>
				</label>
				<textarea bind:value={flow.note} maxlength="500" rows="3" placeholder="Note" aria-label="Note"></textarea>
			</div>
		{/if}
		<footer>
			{#if !flow.saved}
				<button type="button" class="primary" onclick={done}>Done</button>
				<button
					type="button"
					class="secondary"
					aria-expanded={noteOpen}
					aria-controls="note"
					onclick={() => (noteOpen = !noteOpen)}>{noteOpen ? 'Hide note' : 'Add a note'}</button
				>
			{:else if flow.next}
				<button type="button" class="primary" onclick={() => flow.advance()}>Next: {flow.next}</button>
				<button type="button" class="secondary" onclick={() => flow.undo()}>Undo</button>
			{:else}
				<a class="primary" href={resolve('/')}>Finish</a>
				<button type="button" class="secondary" onclick={() => flow.undo()}>Undo</button>
			{/if}
		</footer>
	{/if}
</div>

<style>
	.screen {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: calc(100dvh - var(--safe-top) - var(--safe-bottom));
		font-variant-numeric: tabular-nums;
	}

	header {
		padding: 10px 8px 0;
		display: grid;
		grid-template-columns: 88px 1fr 88px;
		align-items: center;
	}

	.back {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		color: var(--text-primary);
	}

	.title {
		text-align: center;
		font-size: 15px;
		color: var(--text-muted);
	}

	.status {
		justify-self: end;
		font-size: 13px;
	}

	.status a {
		display: flex;
		align-items: center;
		min-height: 44px;
		padding: 0 8px;
		color: var(--text-muted);
		text-decoration: none;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 36px;
		padding: 0 24px;
	}

	.target,
	.saved,
	.count {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.target {
		gap: 4px;
	}

	.load {
		font-size: 80px;
		line-height: 1;
		font-weight: 650;
		letter-spacing: -0.03em;
	}

	.bodyweight {
		font-size: 44px;
		letter-spacing: -0.02em;
	}

	.sub {
		font-size: 17px;
		color: var(--text-muted);
	}

	.swap {
		transition:
			opacity 200ms var(--ease-out),
			transform 200ms var(--ease-out);

		@starting-style {
			opacity: 0;
			transform: translateY(6px);
		}
	}

	.stepper {
		display: flex;
		align-items: center;
		gap: 28px;
	}

	.step {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: var(--bg-glass);
		border: 0;
		color: var(--text-primary);
		font-size: 30px;
		transition: none;
	}

	.step:active {
		transform: none;
		background: var(--border-glass);
	}

	.count {
		min-width: 72px;
	}

	.count .num {
		font-size: 44px;
		font-weight: 600;
	}

	.count-label,
	.rest-label {
		font-size: 13px;
		color: var(--text-muted);
	}

	.saved {
		gap: 6px;
	}

	.saved-reps {
		font-size: 17px;
		font-weight: 600;
	}

	.estimate {
		font-size: 15px;
		color: var(--text-muted);
	}

	.rest {
		margin-top: 18px;
		font-size: 36px;
		font-weight: 600;
		color: var(--accent);
	}

	.note {
		padding: 0 16px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.note label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 44px;
		font-size: 15px;
		color: var(--text-muted);
	}

	.note select,
	.note textarea {
		background: var(--bg-glass);
		border: 1px solid var(--border-glass);
		border-radius: 12px;
		color: var(--text-primary);
	}

	.note select {
		min-height: 44px;
		padding: 0 12px;
	}

	.note textarea {
		padding: 12px;
		resize: none;
	}

	footer {
		padding: 0 16px 40px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.primary {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 56px;
		border-radius: var(--radius);
		background: var(--accent);
		border: 0;
		color: var(--bg-base);
		font-weight: 600;
		font-size: 17px;
		text-decoration: none;
	}

	a.primary {
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
		transition: transform var(--press-duration) var(--ease-out);
	}

	a.primary:active {
		transform: scale(0.97);
	}

	.secondary {
		min-height: 44px;
		background: transparent;
		border: 0;
		color: var(--text-muted);
		font-size: 15px;
	}
</style>
