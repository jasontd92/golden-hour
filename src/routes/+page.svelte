<script lang="ts">
	import Today from '#lib/features/today/Today.svelte';
	import { clock } from '#lib/ui/clock.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const logHref = (date: string) => `/log/${date}`;
</script>

<svelte:head>
	<title>Golden Hour</title>
</svelte:head>

<Today plan={data.plan} today={clock.today} startHref={data.startEnabled ? logHref : undefined} />
