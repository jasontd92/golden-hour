import type { LogRecord } from '#lib/domain/log.ts';
import { newLogEntry } from './entry.ts';
import { restSeconds, wallClock, type Rest } from './rest.ts';
import { loggedAt, nextLabel, type LogStep } from './steps.ts';
import type { LogStore } from './store.ts';

export interface FlowDeps {
	store: () => Promise<LogStore>;
	deviceId: () => string;
	recallRest: () => Rest | undefined;
	keepRest: (rest: Rest | undefined) => void;
	saved: () => void;
	now?: () => Date;
}

export class LogFlow {
	index = $state(0);
	reps = $state(0);
	rpe = $state<number | undefined>();
	note = $state('');
	saved = $state<LogRecord | undefined>();
	restEndsAt = $state<number | undefined>();
	ready = $state(false);
	readonly sessionDate: string;
	readonly steps: readonly LogStep[];
	readonly #deps: FlowDeps;
	#busy = false;

	constructor(sessionDate: string, steps: readonly LogStep[], deps: FlowDeps) {
		this.sessionDate = sessionDate;
		this.steps = steps;
		this.#deps = deps;
		this.#show(0);
	}

	get step(): LogStep | undefined {
		return this.steps[this.index];
	}

	get next(): string | undefined {
		return nextLabel(this.steps, this.index);
	}

	#now = () => (this.#deps.now ?? wallClock)();

	#show(index: number, saved?: LogRecord, restEndsAt?: number): void {
		this.index = index;
		this.saved = saved;
		this.restEndsAt = restEndsAt;
		this.reps = saved?.reps ?? this.steps[index]?.reps ?? 0;
		this.rpe = saved?.rpe;
		this.note = saved?.note ?? '';
	}

	async resume(): Promise<void> {
		const records = (await (await this.#deps.store()).entries()).filter((r) => r.sessionDate === this.sessionDate);
		const logged = loggedAt(this.steps, records);
		const firstOpen = logged.findIndex((record) => !record);
		const lastIndex = (firstOpen === -1 ? this.steps.length : firstOpen) - 1;
		const last = logged[lastIndex];
		const rest = this.#deps.recallRest();
		const resting = last && rest?.entryId === last.id ? rest.endsAt : undefined;
		if (last && (resting !== undefined || firstOpen === -1)) this.#show(lastIndex, last, resting);
		else this.#show(Math.max(0, firstOpen));
		this.ready = true;
	}

	less(): void {
		this.reps = Math.max(0, this.reps - 1);
	}

	more(): void {
		this.reps += 1;
	}

	async done(): Promise<void> {
		const step = this.step;
		if (!step || this.saved || this.#busy) return;
		this.#busy = true;
		try {
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
		} finally {
			this.#busy = false;
		}
	}

	async undo(): Promise<void> {
		const saved = this.saved;
		if (!saved || this.#busy) return;
		this.#busy = true;
		try {
			await (await this.#deps.store()).undo(saved.id, this.#now());
			this.#deps.keepRest(undefined);
			this.saved = undefined;
			this.restEndsAt = undefined;
			this.#deps.saved();
		} finally {
			this.#busy = false;
		}
	}

	advance(): void {
		if (!this.saved || !this.next) return;
		this.#deps.keepRest(undefined);
		this.#show(this.index + 1);
	}
}
