<script lang="ts">
	import LogSet from '#lib/features/log/LogSet.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.session.title} · Golden Hour</title>
</svelte:head>

{#key data.session.date}
	<LogSet session={data.session} />
{/key}
