<script lang="ts">
	import { appUpdate } from './service-worker.svelte.ts';
</script>

<button type="button" class="update" onclick={appUpdate.apply}>Update ready · Reload</button>

<style>
	.update {
		position: fixed;
		left: 50%;
		bottom: calc(var(--tab-bar-height) + max(var(--safe-bottom), 8px) + 12px);
		translate: -50% 0;
		min-height: 44px;
		padding: 0 18px;
		border: 1px solid var(--border-glass);
		border-radius: 999px;
		background: var(--bg-glass);
		backdrop-filter: blur(var(--blur));
		-webkit-backdrop-filter: blur(var(--blur));
		font-size: 15px;
		transition:
			transform var(--press-duration) var(--ease-out),
			opacity 200ms var(--ease-out);

		@starting-style {
			opacity: 0;
		}
	}
</style>
