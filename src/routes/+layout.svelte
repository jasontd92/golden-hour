<script lang="ts">
	import '@fontsource-variable/geist';
	import '@fontsource-variable/geist-mono';
	import '#lib/ui/tokens.css';
	import { page } from '$app/state';
	import { keepSyncing } from '#lib/features/log/effects.svelte.ts';
	import { trackToday } from '#lib/ui/clock.svelte.ts';
	import { appUpdate, watchServiceWorker } from '#lib/ui/service-worker.svelte.ts';
	import DeskNav from '#lib/ui/DeskNav.svelte';
	import TabBar from '#lib/ui/TabBar.svelte';
	import UpdatePrompt from '#lib/ui/UpdatePrompt.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	trackToday();
	watchServiceWorker();
	keepSyncing();

	const midSession = $derived(page.url.pathname.startsWith('/log'));
</script>

<div class="shell" class:mid-session={midSession}>
	{#if !midSession}<div data-view="desk"><DeskNav /></div>{/if}
	{@render children()}
	{#if !midSession}<div data-view="phone"><TabBar /></div>{/if}
	{#if appUpdate.ready && !midSession}<UpdatePrompt />{/if}
</div>

<style>
	.shell {
		--tab-bar-height: 48px;
		--shell-width: 100%;
		width: 100%;
		max-width: var(--shell-width);
		margin-inline: auto;
		min-height: calc(100dvh - var(--safe-top) - var(--safe-bottom));
		padding-bottom: calc(var(--tab-bar-height) + 12px);
		display: flex;
		flex-direction: column;
	}

	.mid-session {
		padding-bottom: 0;
	}

	@media (min-width: 768px) {
		.shell {
			--shell-width: 430px;
		}
	}

	@media (min-width: 1024px) {
		.shell:has(:global([data-desk-page])) {
			--shell-width: none;
			height: 100dvh;
			min-height: 0;
			padding-bottom: 0;
		}

		.shell :global([data-view='phone']) {
			display: none;
		}
	}

	@media (width < 1024px) {
		.shell :global([data-view='desk']) {
			display: none;
		}
	}
</style>
