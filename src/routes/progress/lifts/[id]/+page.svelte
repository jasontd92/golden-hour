<script lang="ts">
	import History from '#lib/features/progress/History.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.name} · Golden Hour</title>
</svelte:head>

<History name={data.name} rows={data.rows} />
