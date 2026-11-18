import type { SessionScore } from '#lib/domain/log.ts';
import { isHardSession, type PlanSession } from '#lib/domain/plan.ts';
import { formatScore, parseScore } from '#lib/domain/score.ts';

export type ScoredType = 'time' | 'rounds_reps';

export interface ScoredPrescription {
	blockIndex: number;
	prescriptionIndex: number;
	type: ScoredType;
}

const scoredKinds = { amrap: 'rounds_reps', forTime: 'time' } as const;

export function scoredPrescription(session: PlanSession): ScoredPrescription | undefined {
	for (const [blockIndex, block] of session.blocks.entries()) {
		for (const [prescriptionIndex, p] of block.prescriptions.entries()) {
			if (p.kind === 'amrap' || p.kind === 'forTime') return { blockIndex, prescriptionIndex, type: scoredKinds[p.kind] };
		}
	}
	return undefined;
}

// why: Seiler's session-RPE bands (1–4 easy, 7+ hard) give a starting point the athlete nudges, like reps start at the prescription
export const defaultSessionRpe = (session: PlanSession) => (isHardSession(session) ? 7 : 4);

export const minRpe = 1;
export const maxRpe = 10;

const sixtyOrMore = (text: string) => text.split(':').slice(1).some((field) => Number(field) >= 60);
const repsOverflow = (text: string) => Number(text.split('+')[1] ?? 0) >= 1000;

export function readScore(text: string, scored: ScoredPrescription): SessionScore | undefined | 'invalid' {
	const trimmed = text.trim();
	if (!trimmed) return undefined;
	const parsed = parseScore(trimmed, scored.type);
	if (!parsed) return 'invalid';
	if (scored.type === 'time' ? sixtyOrMore(trimmed) : repsOverflow(trimmed)) return 'invalid';
	return { ...scored, value: parsed.value };
}

export const scoreText = (score: SessionScore) => formatScore(score.value, score.type);

export function clockDigits(text: string): string {
	const digits = text.replace(/\D/g, '').replace(/^0+/, '').slice(0, 4);
	if (!digits) return '';
	const padded = digits.padStart(3, '0');
	return `${Number(padded.slice(0, -2))}:${padded.slice(-2)}`;
}

export const scoreField: Record<ScoredType, { label: string; placeholder: string; inputmode: 'numeric' | 'tel'; hint: string }> = {
	time: { label: 'Time', placeholder: '0:00', inputmode: 'numeric', hint: 'Use m:ss' },
	rounds_reps: { label: 'Rounds + reps', placeholder: '5+12', inputmode: 'tel', hint: 'Use rounds+reps' }
};
