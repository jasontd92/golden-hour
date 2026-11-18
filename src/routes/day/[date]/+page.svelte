<script lang="ts">
	import { monthDay, weekdayName } from '#lib/domain/calendar.ts';
	import SessionView from '#lib/features/today/SessionView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.session.title} · Golden Hour</title>
</svelte:head>

{#key data.session.date}
	<SessionView session={data.session} dayLabel="{weekdayName(data.session.date)}, {monthDay(data.session.date)}" />
{/key}
