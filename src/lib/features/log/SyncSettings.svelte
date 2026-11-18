<script lang="ts">
	import { logSync, useSyncToken } from './effects.svelte.ts';

	let token = $state('');

	function save(event: SubmitEvent) {
		event.preventDefault();
		if (!token.trim()) return;
		useSyncToken(token);
		token = '';
	}
</script>

<div class="screen">
	<header>
		<h1>Sync</h1>
		<p><span class="num">{logSync.pending}</span> {logSync.pending === 1 ? 'set' : 'sets'} waiting to sync</p>
	</header>
	<form onsubmit={save}>
		<input
			type="password"
			bind:value={token}
			autocomplete="off"
			aria-label="Sync token"
			placeholder={logSync.hasToken ? 'Token saved on this device' : 'Sync token'}
		/>
		<button type="submit">Save</button>
	</form>
</div>

<style>
	.screen {
		display: flex;
		flex-direction: column;
	}

	header {
		padding: 24px 24px 28px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	h1 {
		font-size: 34px;
		line-height: 1.08;
	}

	p {
		margin: 0;
		font-size: 15px;
		color: var(--text-muted);
	}

	form {
		padding: 0 16px;
		display: flex;
		gap: 8px;
	}

	input {
		flex: 1;
		min-width: 0;
		min-height: 48px;
		padding: 0 14px;
		background: var(--bg-glass);
		border: 1px solid var(--border-glass);
		border-radius: 12px;
		color: var(--text-primary);
	}

	button {
		min-height: 48px;
		padding: 0 18px;
		border-radius: 12px;
		background: var(--bg-glass);
		border: 1px solid var(--border-glass);
		color: var(--text-primary);
		font-weight: 600;
	}
</style>
