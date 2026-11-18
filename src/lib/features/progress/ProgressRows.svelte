<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProgressRow } from '#lib/domain/progress.ts';
	import ConflictMarker from './ConflictMarker.svelte';

	let {
		rows,
		kind,
		label,
		allCount
	}: { rows: ProgressRow[]; kind: 'benchmarks' | 'lifts'; label?: string; allCount?: number } = $props();
</script>

<ul aria-label={label}>
	{#each rows as row (row.id)}
		<li>
			<a class="row" href={kind === 'lifts'
					? resolve('/progress/lifts/[id]', { id: row.id })
					: resolve('/progress/benchmarks/[id]', { id: row.id })}>
				<span class="name">{row.name}</span>
				{#if row.conflicted}
					<ConflictMarker />
				{/if}
				<span class="best num">{row.best}</span>
			</a>
		</li>
	{/each}
	{#if allCount !== undefined}
		<li>
			<a class="row all" href={kind === 'lifts' ? resolve('/progress/lifts') : resolve('/progress/benchmarks')}>
				<span class="name">All<span class="visually-hidden"> {kind}</span></span>
				<span class="best num">{allCount}</span>
			</a>
		</li>
	{/if}
</ul>

<style>
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: flex;
		align-items: baseline;
		gap: 10px;
		min-height: 52px;
		padding: 15px 8px 0;
		border-top: 1px solid var(--border-glass);
		color: var(--text-primary);
		text-decoration: none;
		user-select: none;
		-webkit-user-select: none;
		transition: transform var(--press-duration) var(--ease-out);
	}

	.row:active {
		transform: scale(0.98);
	}

	.all {
		color: var(--text-muted);
	}

	.name {
		flex: 1;
		font-size: 17px;
	}

	.best {
		font-size: 16px;
		font-weight: 500;
	}

	.all .best {
		font-weight: 400;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
