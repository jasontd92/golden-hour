import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('static/manifest.webmanifest', 'utf8'));
const pngSize = (file: string) => {
	const png = readFileSync(file);
	return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
};

describe('web app manifest', () => {
	it('installs as a standalone app in the page background colour', () => {
		expect(manifest).toMatchObject({
			name: 'Golden Hour',
			display: 'standalone',
			start_url: '/',
			theme_color: '#06090b',
			background_color: '#06090b'
		});
	});

	it('ships every icon at the size it declares, with 192, 512 and a maskable one', () => {
		const icons = manifest.icons as { src: string; sizes: string; purpose?: string }[];
		for (const icon of icons) expect(pngSize(`static${icon.src}`), icon.src).toBe(icon.sizes);
		expect(icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
		expect(icons.some((i) => i.purpose === 'maskable')).toBe(true);
		expect(pngSize('static/apple-touch-icon.png')).toBe('180x180');
	});
});
