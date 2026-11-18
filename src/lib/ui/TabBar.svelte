<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const weekRoutes: ReadonlySet<string | null> = new Set(['/week', '/day/[date]']);
	const links = [
		{ label: 'Today', href: resolve('/'), current: () => page.route.id === '/' },
		{ label: 'Week', href: resolve('/week'), current: () => weekRoutes.has(page.route.id) }
	];
</script>

<nav aria-label="Main">
	{#each links as link (link.label)}
		<a href={link.href} aria-current={link.current() ? 'page' : undefined}>{link.label}</a>
	{/each}
	<span aria-disabled="true">Progress</span>
</nav>

<style>
	nav {
		position: fixed;
		inset: auto 0 0;
		max-width: var(--shell-width, none);
		margin-inline: auto;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		padding: 4px calc(var(--safe-right) + 8px) max(var(--safe-bottom), 8px) calc(var(--safe-left) + 8px);
		background: color-mix(in srgb, var(--bg-base) 72%, transparent);
		backdrop-filter: blur(var(--blur)) saturate(180%);
		-webkit-backdrop-filter: blur(var(--blur)) saturate(180%);
	}

	a,
	span {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--tab-bar-height);
		color: var(--text-muted);
		font-size: 13px;
		text-decoration: none;
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
	}

	a {
		transition: transform var(--press-duration) var(--ease-out);
	}

	a:active {
		transform: scale(0.97);
	}

	[aria-current='page'] {
		color: var(--text-primary);
		font-weight: 600;
	}

	span {
		opacity: 0.5;
	}
</style>
