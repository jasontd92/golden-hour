<script lang="ts">
	import Progress from '#lib/features/progress/Progress.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Progress · Golden Hour</title>
</svelte:head>

<Progress benchmarks={data.benchmarks} lifts={data.lifts} />
