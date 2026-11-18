<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ProgressRow } from '#lib/domain/progress.ts';

	let { title, rows, kind }: { title: string; rows: ProgressRow[]; kind: 'benchmarks' | 'lifts' } = $props();
</script>

<section aria-label={title}>
	<h2>{title}</h2>
	<ul>
		{#each rows as row (row.id)}
			<li>
				<a class="row" href={kind === 'lifts'
						? resolve('/progress/lifts/[id]', { id: row.id })
						: resolve('/progress/benchmarks/[id]', { id: row.id })}>
					<span class="name">{row.name}</span>
					{#if row.conflicted}
						<span class="marker" title="Sources disagree on a result"
							><span class="visually-hidden">Sources disagree</span></span
						>
					{/if}
					<span class="best num">{row.best}</span>
				</a>
			</li>
		{/each}
	</ul>
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
	}

	h2 {
		margin: 0 8px 8px;
		font-size: 15px;
		font-weight: 400;
		letter-spacing: 0;
		color: var(--text-muted);
	}

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

	.name {
		flex: 1;
		font-size: 17px;
	}

	.marker {
		align-self: center;
		width: 6px;
		height: 6px;
		border: 1px solid var(--text-muted);
		border-radius: 50%;
	}

	.best {
		font-size: 16px;
		font-weight: 500;
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
