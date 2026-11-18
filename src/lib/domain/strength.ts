export const plateStepLb = 5;
export const trainingMaxPct = 0.85;

// why: binary floats land some products just under a step (175 × 0.7 = 122.49999999999999 rounds to 125).
const epsilon = 1e-9;

export function floorToPlate(load: number): number {
	return Math.floor(load / plateStepLb + epsilon) * plateStepLb;
}

export function roundToPlate(load: number): number {
	return Math.round(load / plateStepLb + epsilon) * plateStepLb;
}

export function trainingMax(oneRm: number, pct = trainingMaxPct): number {
	return floorToPlate(oneRm * pct);
}

export function wendlerSet(trainingMaxLb: number, pct: number): number {
	return roundToPlate(trainingMaxLb * pct);
}

export function estimatedOneRm(load: number, reps: number): number {
	return Math.round(load * reps * 0.0333 + load);
}
