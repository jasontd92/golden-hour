<script lang="ts">
	import type { DayLog } from '#lib/domain/log.ts';
	import type { Block } from '#lib/domain/plan.ts';
	import HardDot from '#lib/ui/HardDot.svelte';
	import { blockLines, loggedText } from './prescription-lines.ts';

	let { block, blockIndex, log, group }: { block: Block; blockIndex: number; log?: DayLog; group: string } = $props();
</script>

<details class="block" name={group}>
	<summary>
		<span class="name">{block.name}</span>
		{#if block.hard}<HardDot />{/if}
		<span class="minutes num">{block.minutes}</span>
	</summary>
	<div class="lines">
		{#each blockLines(block) as line, i (i)}
			{@const logged = log ? loggedText(line, blockIndex, log) : undefined}
			{#if logged}
				<p class="{line.tone} with-log">
					<span>{line.text}</span>
					<span class="logged num">{logged}</span>
				</p>
			{:else}
				<p class={line.tone}>{line.text}</p>
			{/if}
		{/each}
	</div>
</details>

<style>
	.block {
		border-top: 1px solid var(--border-glass);
	}

	summary {
		min-height: 60px;
		padding: 0 8px;
		display: flex;
		align-items: center;
		gap: 10px;
		background: transparent;
		border: 0;
		list-style: none;
		font-size: 17px;
		text-align: left;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	.name {
		flex: 1;
	}

	.minutes {
		color: var(--text-muted);
		font-size: 14px;
	}

	.lines {
		padding: 0 8px 18px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	[open] .lines {
		animation: reveal 200ms var(--ease-out);
	}

	@keyframes reveal {
		from {
			opacity: 0;
			translate: 0 -4px;
		}
	}

	p {
		margin: 0;
		font-size: 17px;
		line-height: 1.4;
	}

	.quiet {
		color: var(--text-muted);
	}

	.with-log {
		display: flex;
		gap: 12px;
	}

	.with-log > :first-child {
		flex: 1;
	}

	.logged {
		font-size: 14px;
		font-weight: 400;
		color: var(--text-muted);
	}

	.strong {
		font-weight: 600;
	}

	@media (hover: hover) and (pointer: fine) {
		summary:hover {
			background: var(--bg-glass);
		}
	}
</style>
