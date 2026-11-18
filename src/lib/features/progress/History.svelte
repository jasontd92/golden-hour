<script lang="ts">
	import { resolve } from '$app/paths';
	import type { HistoryRow } from '#lib/domain/progress.ts';

	let { name, rows }: { name: string; rows: HistoryRow[] } = $props();
</script>

<div class="column">
	<header>
		<a class="back" href={resolve('/progress')}>Progress</a>
		<h1>{name}</h1>
	</header>
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
						<p class="conflict">{row.conflict}</p>
					{/if}
				</li>
			{/each}
		</ol>
	</main>
</div>

<style>
	.column {
		max-width: 480px;
		margin: 0 auto;
	}

	header {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 24px 24px 20px;
	}

	.back {
		align-self: flex-start;
		min-height: 44px;
		display: flex;
		align-items: center;
		color: var(--text-muted);
		font-size: 15px;
		text-decoration: none;
	}

	h1 {
		font-size: 34px;
		line-height: 1.08;
	}

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
		margin: 0;
	}
</style>
