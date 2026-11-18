<script lang="ts">
	import type { Snippet } from 'svelte';
	import { showsView, type View } from './viewport.svelte.ts';

	let { only, page = false, children }: { only: View; page?: boolean; children: Snippet } = $props();
</script>

{#if showsView(only)}
	<div class="view" class:page data-view={only} data-desk-page={page && only === 'desk' ? '' : undefined}>
		{@render children()}
	</div>
{/if}

<style>
	.page {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
</style>
