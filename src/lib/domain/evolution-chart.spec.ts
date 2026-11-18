import { describe, expect, it } from 'vitest';
import { chartX, chartY, evolutionChart, weeksSince } from './evolution-chart.ts';
import { targetPoints } from './targets.ts';

const base = { firstMonday: '2026-12-07', today: '2026-12-09', targets: [], trainingMaxes: [] };

describe('evolutionChart', () => {
	it('starts at week 0 from the latest result before the plan and plots results during it', () => {
		const chart = evolutionChart({
			...base,
			better: 'higher',
			observations: [
				{ date: '2025-08-15', value: 13 },
				{ date: '2026-11-16', value: 13 },
				{ date: '2026-12-31', value: 15 }
			],
			targets: targetPoints('benchmark', 'strict-pullups-max', 13)
		});
		expect(chart?.logged).toEqual([
			{ week: 0, value: 13 },
			{ week: weeksSince('2026-12-07', '2026-12-31'), value: 15 }
		]);
		expect(chart?.targets.map((t) => t.value)).toEqual([14, 16, 18, 20]);
		expect(chart?.plan[0]).toEqual({ week: weeksSince('2026-12-07', '2026-12-31'), value: 15 });
		expect(chart?.todayWeek).toBeCloseTo(2 / 7);
	});

	it('draws a lift plan as the training-max step line', () => {
		const chart = evolutionChart({
			...base,
			better: 'higher',
			observations: [{ date: '2026-11-16', value: 255 }],
			trainingMaxes: [
				{ week: 1, value: 215 },
				{ week: 2, value: 215 }
			]
		});
		expect(chart?.plan).toEqual([
			{ week: 0, value: 215 },
			{ week: 1, value: 215 },
			{ week: 1, value: 215 },
			{ week: 2, value: 215 }
		]);
	});

	it('flips time scores so up is better', () => {
		const time = evolutionChart({ ...base, better: 'lower', observations: [{ date: '2025-08-01', value: 394 }, { date: '2026-12-20', value: 283 }] });
		const reps = evolutionChart({ ...base, better: 'higher', observations: [{ date: '2025-08-01', value: 10 }] });
		expect(time?.upIsBetter).toBe(false);
		expect(reps?.upIsBetter).toBe(true);
		if (!time) throw new Error('chart');
		const [low, high] = time.domain;
		expect(chartY(time, low, 100)).toBe(0);
		expect(chartY(time, high, 100)).toBe(100);
		expect(chartX(17, 340)).toBe(340);
	});

	it('has nothing to draw without results or a plan, and no today line outside the plan', () => {
		expect(evolutionChart({ ...base, better: 'higher', observations: [] })).toBeUndefined();
		const after = evolutionChart({ ...base, today: '2027-06-01', better: 'higher', observations: [{ date: '2026-01-01', value: 1 }] });
		expect(after?.todayWeek).toBeUndefined();
	});

	it('puts round ticks around every value', () => {
		const chart = evolutionChart({ ...base, better: 'higher', observations: [{ date: '2026-11-01', value: 213 }, { date: '2026-12-21', value: 257 }] });
		expect(chart?.ticks).toEqual([200, 250, 300]);
		const single = evolutionChart({ ...base, better: 'higher', observations: [{ date: '2026-11-16', value: 255 }] });
		expect(single?.ticks).toEqual([240, 260]);
	});
});

describe('targetPoints', () => {
	it('applies the plan’s end targets to the baseline', () => {
		expect(targetPoints('benchmark', 'crossfit-total', 750)).toEqual([{ week: 16, value: 800 }]);
		expect(targetPoints('lift', 'shoulder-press', 160)).toEqual([{ week: 16, value: 170 }]);
		expect(targetPoints('benchmark', 'run-10k', 3193)).toEqual([{ week: 17, value: 3033 }]);
		expect(targetPoints('benchmark', 'fran', 394)).toEqual([]);
	});
});
