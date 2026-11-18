<script lang="ts">
	import { resolve } from '$app/paths';
	import { sessionMinutes, type PlanSession } from '#lib/domain/plan.ts';
	import BlockRow from './BlockRow.svelte';

	let { session, dayLabel, startable = false }: { session: PlanSession; dayLabel: string; startable?: boolean } = $props();

	let openBlock = $state<number | undefined>();
	let whyOpen = $state(false);
</script>

<div class="screen">
	<header>
		<p class="day">{dayLabel}</p>
		<h1>{session.title}</h1>
		<p class="minutes"><span class="num">{sessionMinutes(session)}</span> min</p>
	</header>
	<main>
		{#each session.blocks as block, i (i)}
			<BlockRow
				{block}
				id="block-{i}"
				open={openBlock === i}
				ontoggle={() => (openBlock = openBlock === i ? undefined : i)}
			/>
		{/each}
		<div class="rule"></div>
		<button type="button" class="why" aria-expanded={whyOpen} aria-controls="why" onclick={() => (whyOpen = !whyOpen)}>
			{whyOpen ? 'Hide why' : 'Why this session'}
		</button>
		{#if whyOpen}<p class="why-text" id="why">{session.why}</p>{/if}
	</main>
	{#if startable}
		<div class="start">
			<a href={resolve('/log/[date]', { date: session.date })}>Start</a>
		</div>
	{/if}
</div>

<style>
	.screen {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

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

	main {
		flex: 1;
		padding: 0 16px;
		display: flex;
		flex-direction: column;
	}

	.rule {
		border-top: 1px solid var(--border-glass);
	}

	.why {
		align-self: flex-start;
		margin-top: 14px;
		min-height: 44px;
		padding: 0 8px;
		background: transparent;
		border: 0;
		color: var(--text-muted);
		font-size: 15px;
	}

	.why-text {
		margin: 0;
		padding: 0 8px;
		max-width: 34ch;
		font-size: 15px;
		line-height: 1.5;
		color: var(--text-muted);
		transition: opacity 200ms var(--ease-out);

		@starting-style {
			opacity: 0;
		}
	}

	.start {
		padding: 12px 16px;
	}

	.start a {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 56px;
		border-radius: var(--radius);
		background: var(--accent);
		color: var(--bg-base);
		font-weight: 600;
		font-size: 17px;
		text-decoration: none;
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
		transition: transform var(--press-duration) var(--ease-out);
	}

	.start a:active {
		transform: scale(0.97);
	}
</style>
