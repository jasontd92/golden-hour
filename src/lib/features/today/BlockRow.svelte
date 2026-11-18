<script lang="ts">
	import type { Block } from '#lib/domain/plan.ts';
	import HardDot from '#lib/ui/HardDot.svelte';
	import { blockLines } from './prescription-lines.ts';

	let { block, id, open, ontoggle }: { block: Block; id: string; open: boolean; ontoggle: () => void } = $props();
</script>

<div class="block">
	<button type="button" aria-expanded={open} aria-controls={id} onclick={ontoggle}>
		<span class="name">{block.name}</span>
		{#if block.hard}<HardDot />{/if}
		<span class="minutes num">{block.minutes}</span>
	</button>
	{#if open}
		<div class="lines" {id}>
			{#each blockLines(block) as line, i (i)}
				<p class={line.tone}>{line.text}</p>
			{/each}
		</div>
	{/if}
</div>

<style>
	.block {
		border-top: 1px solid var(--border-glass);
	}

	button {
		width: 100%;
		min-height: 60px;
		padding: 0 8px;
		display: flex;
		align-items: center;
		gap: 10px;
		background: transparent;
		border: 0;
		font-size: 17px;
		text-align: left;
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
		transition:
			opacity 200ms var(--ease-out),
			translate 200ms var(--ease-out);

		@starting-style {
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

	.strong {
		font-weight: 600;
	}

	@media (hover: hover) and (pointer: fine) {
		button:hover {
			background: var(--bg-glass);
		}
	}
</style>
