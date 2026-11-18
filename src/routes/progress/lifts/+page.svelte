<script lang="ts">
	import ProgressList from '#lib/features/progress/ProgressList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Lifts · Golden Hour</title>
</svelte:head>

<ProgressList title="Lifts · 1 rep max" rows={data.rows} kind="lifts" />
