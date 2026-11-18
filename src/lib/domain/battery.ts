export const testBattery: readonly string[] = [
	'crossfit-total',
	'strict-pullups-max',
	'max-l-sit',
	'run-400m',
	'run-10k',
	'assault-bike-2mi',
	'row-5k',
	'grace',
	'fran',
	'diane',
	'amanda',
	'cindy',
	'jason-cunningham'
];

const rank = new Map<string, number>(testBattery.map((id, index) => [id, index]));

export function batteryRank(id: string): number | undefined {
	return rank.get(id);
}
