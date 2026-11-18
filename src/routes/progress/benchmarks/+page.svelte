<script lang="ts">
	import ProgressList from '#lib/features/progress/ProgressList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Benchmarks · Golden Hour</title>
</svelte:head>

<ProgressList title="Benchmarks" rows={data.rows} kind="benchmarks" />
