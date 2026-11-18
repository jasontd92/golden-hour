<script lang="ts">
	import type { HistoryRow } from '#lib/domain/progress.ts';
	import ConflictMarker from './ConflictMarker.svelte';
	import DetailHeader from './DetailHeader.svelte';

	let { name, rows }: { name: string; rows: HistoryRow[] } = $props();
</script>

<DetailHeader title={name} />
<main>
	<ol aria-label="{name} results">
		{#each rows as row, index (index)}
			<li>
				<div class="when">
					<span class="date">{row.date}</span>
					<span class="source">{row.source}</span>
				</div>
				<span class="score num">{row.score}</span>
				{#if row.conflict}
					<p class="conflict"><ConflictMarker />{row.conflict}</p>
				{/if}
			</li>
		{/each}
	</ol>
</main>

<style>
	main {
		padding: 0 16px 32px;
	}

	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
		padding: 12px 8px;
		border-top: 1px solid var(--border-glass);
	}

	.when {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.date {
		font-size: 17px;
	}

	.source,
	.conflict {
		font-size: 13px;
		color: var(--text-muted);
	}

	.score {
		font-size: 16px;
		font-weight: 500;
	}

	.conflict {
		flex-basis: 100%;
		display: flex;
		gap: 8px;
		margin: 0;
	}
</style>
