<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<nav aria-label="Main">
	<a href={resolve('/')} aria-current={page.route.id === '/' ? 'page' : undefined}>Plan</a>
	<a href={resolve('/progress')} aria-current={page.route.id?.startsWith('/progress') === true ? 'page' : undefined}>Progress</a>
</nav>

<style>
	nav {
		height: 56px;
		flex: none;
		padding: 0 48px;
		display: flex;
		align-items: center;
		gap: 28px;
		font-size: 15px;
	}

	a {
		color: var(--text-muted);
		text-decoration: none;
		transition: color 100ms ease;
	}

	[aria-current='page'] {
		color: var(--text-primary);
		font-weight: 600;
	}

	@media (hover: hover) and (pointer: fine) {
		a:hover {
			color: var(--text-primary);
		}
	}
</style>
