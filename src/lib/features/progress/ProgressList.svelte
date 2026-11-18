<script lang="ts">
	import type { ProgressRow } from '#lib/domain/progress.ts';
	import DetailHeader from './DetailHeader.svelte';
	import ProgressRows from './ProgressRows.svelte';

	let { title, rows, kind }: { title: string; rows: ProgressRow[]; kind: 'benchmarks' | 'lifts' } = $props();
</script>

<DetailHeader {title} />
<main>
	<ProgressRows {rows} {kind} label={title} />
</main>

<style>
	main {
		padding: 0 16px 32px;
	}
</style>
