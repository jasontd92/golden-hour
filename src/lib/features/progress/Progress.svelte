<script lang="ts">
	import type { ProgressRow } from '#lib/domain/progress.ts';
	import ProgressRows from './ProgressRows.svelte';

	let { benchmarks, lifts }: { benchmarks: ProgressRow[]; lifts: ProgressRow[] } = $props();
</script>

<header>
	<h1>Progress</h1>
</header>
<main>
	<ProgressRows title="Benchmarks" rows={benchmarks} kind="benchmarks" />
	<ProgressRows title="Lifts · 1 rep max" rows={lifts} kind="lifts" />
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
</style>
