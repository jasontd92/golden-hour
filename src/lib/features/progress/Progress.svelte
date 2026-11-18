<script lang="ts">
	import type { ProgressRow } from '#lib/domain/progress.ts';
	import ProgressRows from './ProgressRows.svelte';

	let {
		benchmarks,
		lifts,
		benchmarkCount,
		liftCount
	}: { benchmarks: ProgressRow[]; lifts: ProgressRow[]; benchmarkCount: number; liftCount: number } = $props();
</script>

<header>
	<h1>Progress</h1>
</header>
<main>
	<section aria-label="Benchmarks">
		<h2>Benchmarks</h2>
		<ProgressRows rows={benchmarks} kind="benchmarks" allCount={benchmarkCount} />
	</section>
	<section aria-label="Lifts · 1 rep max">
		<h2>Lifts · 1 rep max</h2>
		<ProgressRows rows={lifts} kind="lifts" allCount={liftCount} />
	</section>
</main>

<style>
	header {
		padding: 24px 24px 20px;
	}

	h1 {
		font-size: 34px;
		line-height: 1.08;
	}

	main {
		display: flex;
		flex-direction: column;
		gap: 28px;
		padding: 0 16px 32px;
	}

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
</style>
