import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const root = path.resolve(import.meta.dirname, '..');

export function ciPlaywrightImage(workflow: string): string {
	const image = (parse(workflow) as { jobs?: { e2e?: { container?: { image?: unknown } } } }).jobs?.e2e?.container?.image;
	if (typeof image !== 'string') throw new Error('ci.yml has no jobs.e2e.container.image');
	return image;
}

export function pinnedPnpm(packageJson: string): string {
	const pin = (JSON.parse(packageJson) as { packageManager?: unknown }).packageManager;
	if (typeof pin !== 'string' || !/^pnpm@\d+\.\d+\.\d+$/.test(pin)) throw new Error('package.json packageManager must pin pnpm@x.y.z');
	return pin;
}

const containerOnly = ['node_modules', '.svelte-kit', '.vercel', 'build'];

export function dockerArgs(image: string, pnpm: string, repo: string, tty: boolean, playwrightArgs: string[] = []): string[] {
	return [
		'run',
		'--rm',
		...(tty ? ['-t'] : []),
		'--ipc=host',
		'-e',
		'CI=true',
		'-e',
		'HOME=/root',
		'-v',
		`${repo}:/work`,
		...containerOnly.flatMap((dir) => ['-v', `/work/${dir}`]),
		'-w',
		'/work',
		image,
		'sh',
		'-c',
		`npm install -g --silent ${pnpm} && pnpm install --frozen-lockfile && pnpm test:e2e "$@"`,
		'sh',
		...playwrightArgs
	];
}

export function forwardedArgs(argv: string[]): string[] {
	return argv[0] === '--' ? argv.slice(1) : argv;
}

if (import.meta.main) {
	if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
		console.error('e2e:local needs Docker running (docker info failed); start Docker and retry.');
		process.exit(1);
	}
	const image = ciPlaywrightImage(readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8'));
	const pnpm = pinnedPnpm(readFileSync(path.join(root, 'package.json'), 'utf8'));
	console.log(`e2e:local: ${image}, ${pnpm}`);
	const { status } = spawnSync('docker', dockerArgs(image, pnpm, root, Boolean(process.stdout.isTTY), forwardedArgs(process.argv.slice(2))), { stdio: 'inherit' });
	process.exit(status ?? 1);
}
