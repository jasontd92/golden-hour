<script lang="ts">
	import { resolve } from '$app/paths';

	let { title }: { title: string } = $props();
</script>

<header>
	<a class="back" href={resolve('/progress')}>Progress</a>
	<h1>{title}</h1>
</header>

<style>
	header {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 24px 24px 20px;
	}

	.back {
		align-self: flex-start;
		min-height: 44px;
		display: flex;
		align-items: center;
		color: var(--text-muted);
		font-size: 15px;
		text-decoration: none;
	}

	h1 {
		font-size: 34px;
		line-height: 1.08;
	}
</style>
