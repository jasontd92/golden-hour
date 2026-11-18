import type { LogRecord, SessionRecord } from '#lib/domain/log.ts';
import type { PlanSession } from '#lib/domain/plan.ts';
import { newLogEntry, newSessionLog } from './entry.ts';
import { restSeconds, wallClock, type Rest } from './rest.ts';
import { defaultSessionRpe, maxRpe, minRpe, readScore, scoredPrescription, scoreText, type ScoredPrescription } from './session-step.ts';
import { loggedAt, logSteps, nextLabel, type LogStep } from './steps.ts';
import type { LogStore } from './store.ts';

export interface FlowDeps {
	store: () => Promise<LogStore>;
	deviceId: () => string;
	recallRest: () => Rest | undefined;
	keepRest: (rest: Rest | undefined) => void;
	saved: () => void;
	now?: () => Date;
}

export const sessionStepLabel = 'Session';

export class LogFlow {
	index = $state(0);
	reps = $state(0);
	rpe = $state<number | undefined>();
	note = $state('');
	saved = $state<LogRecord | undefined>();
	restEndsAt = $state<number | undefined>();
	sessionRpe = $state(0);
	score = $state('');
	savedSession = $state<SessionRecord | undefined>();
	ready = $state(false);
	readonly sessionDate: string;
	readonly steps: readonly LogStep[];
	readonly scored: ScoredPrescription | undefined;
	readonly #defaultRpe: number;
	readonly #deps: FlowDeps;
	#busy = false;
	#existing: SessionRecord | undefined;

	constructor(session: PlanSession, deps: FlowDeps) {
		this.sessionDate = session.date;
		this.steps = logSteps(session);
		this.scored = scoredPrescription(session);
		this.#defaultRpe = defaultSessionRpe(session);
		this.#deps = deps;
		this.#show(0);
	}

	get step(): LogStep | undefined {
		return this.steps[this.index];
	}

	get onSession(): boolean {
		return this.index === this.steps.length;
	}

	get next(): string | undefined {
		if (this.onSession) return undefined;
		return nextLabel(this.steps, this.index) ?? sessionStepLabel;
	}

	get scoreInvalid(): boolean {
		return this.scored !== undefined && readScore(this.score, this.scored) === 'invalid';
	}

	#now = () => (this.#deps.now ?? wallClock)();

	#show(index: number, saved?: LogRecord, restEndsAt?: number): void {
		this.index = index;
		this.saved = saved;
		this.restEndsAt = restEndsAt;
		this.reps = saved?.reps ?? this.steps[index]?.reps ?? 0;
		this.rpe = saved?.rpe;
		this.note = saved?.note ?? '';
		this.savedSession = undefined;
		this.sessionRpe = this.#defaultRpe;
		this.score = '';
	}

	#showSession(existing = this.#existing): void {
		this.#show(this.steps.length);
		this.savedSession = existing?.deletedAt ? undefined : existing;
		this.sessionRpe = existing?.rpe ?? this.#defaultRpe;
		this.score = existing?.score ? scoreText(existing.score) : '';
		this.note = existing?.note ?? '';
	}

	async resume(): Promise<void> {
		const store = await this.#deps.store();
		const records = (await store.entries()).filter((r) => r.sessionDate === this.sessionDate);
		this.#existing = await store.sessionOn(this.sessionDate);
		const sessionLog = this.#existing?.deletedAt ? undefined : this.#existing;
		const logged = loggedAt(this.steps, records);
		const firstOpen = logged.findIndex((record) => !record);
		const lastIndex = (firstOpen === -1 ? this.steps.length : firstOpen) - 1;
		const last = logged[lastIndex];
		const rest = this.#deps.recallRest();
		const resting = last && rest?.entryId === last.id ? rest.endsAt : undefined;
		if (last && resting !== undefined && !sessionLog) this.#show(lastIndex, last, resting);
		else if (firstOpen === -1) this.#showSession();
		else this.#show(Math.max(0, firstOpen));
		this.ready = true;
	}

	less(): void {
		this.reps = Math.max(0, this.reps - 1);
	}

	more(): void {
		this.reps += 1;
	}

	easier(): void {
		this.sessionRpe = Math.max(minRpe, this.sessionRpe - 1);
	}

	harder(): void {
		this.sessionRpe = Math.min(maxRpe, this.sessionRpe + 1);
	}

	async #guarded(work: () => Promise<void>): Promise<void> {
		if (this.#busy) return;
		this.#busy = true;
		try {
			await work();
		} finally {
			this.#busy = false;
		}
	}

	async done(): Promise<void> {
		if (this.onSession) return this.#doneSession();
		const step = this.step;
		if (!step || this.saved) return;
		await this.#guarded(async () => {
			const note = this.note.trim();
			const entry = newLogEntry(
				{
					sessionDate: this.sessionDate,
					blockIndex: step.blockIndex,
					prescriptionIndex: step.prescriptionIndex,
					setIndex: step.setIndex,
					movement: step.movement,
					reps: this.reps,
					...(step.load === undefined ? {} : { load: step.load }),
					...(this.rpe === undefined ? {} : { rpe: this.rpe }),
					...(note ? { note } : {})
				},
				this.#deps.deviceId(),
				this.#now()
			);
			const record = await (await this.#deps.store()).save(entry);
			const endsAt = Date.parse(record.loggedAt) + restSeconds * 1000;
			this.#deps.keepRest({ sessionDate: this.sessionDate, entryId: record.id, endsAt });
			this.saved = record;
			this.restEndsAt = endsAt;
			this.#deps.saved();
		});
	}

	async #doneSession(): Promise<void> {
		const score = this.scored ? readScore(this.score, this.scored) : undefined;
		if (this.savedSession || score === 'invalid') return;
		await this.#guarded(async () => {
			const note = this.note.trim();
			const sessionLog = newSessionLog(
				{
					sessionDate: this.sessionDate,
					rpe: this.sessionRpe,
					...(score ? { score } : {}),
					...(note ? { note } : {})
				},
				this.#deps.deviceId(),
				this.#now()
			);
			this.savedSession = this.#existing = await (await this.#deps.store()).saveSession(sessionLog);
			this.#deps.keepRest(undefined);
			this.#deps.saved();
		});
	}

	async undo(): Promise<void> {
		const saved = this.savedSession ?? this.saved;
		if (!saved) return;
		await this.#guarded(async () => {
			await (await this.#deps.store()).undo(saved.id, this.#now());
			this.#deps.keepRest(undefined);
			this.saved = undefined;
			this.savedSession = undefined;
			this.restEndsAt = undefined;
			this.#deps.saved();
		});
	}

	advance(): void {
		if (!this.saved || this.onSession) return;
		this.#deps.keepRest(undefined);
		if (this.index + 1 === this.steps.length) this.#showSession();
		else this.#show(this.index + 1);
	}
}
