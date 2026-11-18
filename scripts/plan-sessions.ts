import {
	bikeFamily,
	bikeSecondsPerMile,
	bodyCompWeeks,
	bound,
	checkpointWeeks,
	clock,
	deloadWeeks,
	easyRunRange,
	evolutionWeeks,
	familyOccurrence,
	fullWeek,
	holidayWeeks,
	isBWeek,
	liftWeek,
	longRunMinutes,
	lSitAccumulation,
	mainSets,
	mondayFamily,
	mondayGirl,
	pullUpSetReps,
	pushUpLadder,
	qualityB,
	scaleRounds,
	secondsPerMile10k,
	sessionDate,
	supplementalSets,
	trainingMaxesFor,
	weekLayout,
	weeklyRunCap,
	baseWeekRunMinutes,
	type Girl,
	type LiftWeek,
	type MainLift,
	type PlanInputs,
	type Rounding,
	type Slot
} from '#lib/domain/evolution.ts';
import type { MovementId } from '#lib/domain/movements.ts';
import type { Block, BlockKind, MovementWork, PlanSession, PlanWeek, Prescription } from '#lib/domain/plan.ts';

interface Week {
	inputs: PlanInputs;
	week: number;
	z1Minutes: number;
}

type SessionBody = Pick<PlanSession, 'title' | 'why' | 'blocks'> & { location?: PlanSession['location'] };

const block = (
	name: string,
	kind: BlockKind,
	minutes: number,
	prescriptions: Prescription[],
	options: { hard?: boolean; notes?: string } = {}
): Block => ({
	name,
	kind,
	minutes,
	hard: options.hard ?? false,
	prescriptions,
	...(options.notes ? { notes: options.notes } : {})
});

const text = (value: string): Prescription => ({ kind: 'freeText', text: value });
const warmUp = (value: string, minutes = 10) => block('Warm-up', 'warmup', minutes, [text(value)]);
const coolDown = (value = 'Easy walk · stretch') => block('Cool-down', 'cooldown', 5, [text(value)]);
const fixed = (movement: MovementId, sets: number, reps: number, load?: number): Prescription => ({
	kind: 'fixedSets',
	movement,
	sets,
	reps,
	...(load === undefined ? {} : { load })
});
const steady = (movement: MovementId, minutes: number): Prescription => ({ kind: 'steady', movement, minutes });
const forTime = (movements: MovementWork[], rounds = 1, timeCapMinutes?: number): Prescription => ({
	kind: 'forTime',
	rounds,
	...(timeCapMinutes === undefined ? {} : { timeCapMinutes }),
	movements
});
const intervals = (rounds: number, restSeconds: number, movements: MovementWork[]): Prescription => ({
	kind: 'intervals',
	rounds,
	restSeconds,
	movements
});
const descending = (reps: number[], a: MovementWork, b: MovementWork): MovementWork[] =>
	reps.flatMap((n) => [{ ...a, reps: n }, { ...b, reps: n }]);

const hr = (inputs: PlanInputs, low: number, high = low) => {
	const max = inputs.tests.hrMax?.value;
	if (max === undefined) return low === high ? `HR <${low * 100}% max` : `HR ${low * 100}–${high * 100}% max`;
	return low === high ? `HR <${bound(low * max, 'down')}` : `HR ${bound(low * max, 'up')}–${bound(high * max, 'down')}`;
};
const p10 = (inputs: PlanInputs) => secondsPerMile10k(inputs.tests.run10kSeconds.value);
const pace = (secondsPerMile: number, direction: Rounding) => `${clock(secondsPerMile, direction)}/mi`;
const easyNote = (inputs: PlanInputs) => `${pace(p10(inputs) + 75, 'up')} or slower · ${hr(inputs, 0.75)} · RPE ≤3`;

const liftNames: Record<MainLift, string> = { back_squat: 'Back squat', shoulder_press: 'Shoulder press', deadlift: 'Deadlift' };
const liftMinutes = (lift: LiftWeek, short: boolean) =>
	lift.phase === 'leader' ? (short ? 15 : 20) : lift.phase === 'anchor' ? 15 : lift.phase === 'tmTest' ? 14 : 10;

function liftNotes(lift: LiftWeek): string | undefined {
	if (lift.phase === 'tmTest') return 'Fewer than 3 reps at 100% → TM −10%';
	if (lift.phase !== 'anchor') return undefined;
	if (lift.cycleWeek === 2) return 'Rep goal: leave one in the tank. Optional joker: +5–10% for 1–3 reps';
	return lift.cycleWeek === 3 ? 'PR set. Optional joker: +5–10% for 1–3 reps' : 'PR set: stop a rep before a grind';
}

function liftBlock({ inputs, week }: Week, lift: MainLift, afterRun = false, extraNote?: string): Block {
	const phase = liftWeek(week);
	const trainingMax = trainingMaxesFor(week, inputs)[lift];
	const sets = (s: ReturnType<typeof mainSets>): Prescription[] =>
		s.length === 0 ? [] : [{ kind: 'percentSets', lift, trainingMax, sets: s }];
	const notes = [extraNote, liftNotes(phase)].filter(Boolean).join('. ');
	return block(
		liftNames[lift],
		'strength',
		liftMinutes(phase, afterRun || lift === 'shoulder_press'),
		[...sets(mainSets(phase)), ...sets(supplementalSets(phase, afterRun))],
		{ notes }
	);
}

function liftWhy(week: number): string {
	const phase = liftWeek(week);
	switch (phase.phase) {
		case 'leader':
			return 'Leader block: 5s at every step and 5 × 5 at the first weight build volume, with no PR set.';
		case 'anchor':
			return phase.cycleWeek === 2
				? 'Anchor block: heavier triples build toward next week’s PR set.'
				: 'Anchor block: the last set is a PR set.';
		case 'deload':
			return 'Deload week: light 5s and half the conditioning, so the next block starts fresh.';
		case 'tmTest':
			return 'Training-max test: a max-rep set at 100% checks the TM before the last Anchor.';
		case 'retest':
			return '';
	}
}

const pullUps = (inputs: PlanInputs) => pullUpSetReps(inputs.tests.strictPullUps.value);

interface Metcon {
	name: string;
	minutes: number;
	prescription: Prescription;
	notes?: string;
}

function couplet(week: number, inputs: PlanInputs): Metcon {
	const designs: [number, MovementWork[]][] = [
		[5, [{ movement: 'push_up', reps: 10 }, { movement: 'db_snatch', reps: 10, load: 35 }]],
		[5, [{ movement: 'pull_up', reps: pullUps(inputs) }, { movement: 'push_press', reps: 10, load: 75 }]],
		[4, [{ movement: 'burpee', reps: 10 }, { movement: 'db_snatch', reps: 12, load: 45 }]],
		[5, [{ movement: 'pull_up', reps: pullUps(inputs) }, { movement: 'push_up', reps: 12 }]]
	];
	const [rounds, movements] = designs[familyOccurrence(week)] ?? designs[0]!;
	return { name: 'Couplet', minutes: 12, prescription: forTime(movements, scaleRounds(rounds, week), 10) };
}

function intervalMetcon(name: string, week: number, design: [number, number, number, MovementWork], notes: string): Metcon {
	const [rounds, restSeconds, workSeconds, work] = design;
	const scaled = scaleRounds(rounds, week);
	return {
		name,
		minutes: Math.ceil((scaled * (workSeconds + restSeconds)) / 60) + 2,
		prescription: intervals(scaled, restSeconds, [work]),
		notes
	};
}

const phosphagenDesigns: [number, number, number, MovementWork][] = [
	[10, 45, 15, { movement: 'bike', seconds: 15 }],
	[8, 30, 10, { movement: 'power_clean', reps: 3, load: 135 }],
	[10, 30, 10, { movement: 'burpee', reps: 5 }],
	[8, 45, 15, { movement: 'bike', seconds: 15 }]
];
const glycolyticDesigns: [number, number, number, MovementWork][] = [
	[5, 120, 60, { movement: 'burpee', seconds: 60 }],
	[6, 90, 45, { movement: 'db_snatch', seconds: 45, load: 35 }],
	[5, 120, 60, { movement: 'run', meters: 300 }],
	[5, 120, 60, { movement: 'burpee', seconds: 60 }]
];

const sameAsBefore = 'Same standard as before';
const girlMetcons: Record<Girl, Metcon> = {
	grace: {
		name: 'Grace',
		minutes: 10,
		prescription: forTime([{ movement: 'clean_and_jerk', reps: 30, load: 135 }]),
		notes: sameAsBefore
	},
	fran: {
		name: 'Fran',
		minutes: 10,
		prescription: forTime(descending([21, 15, 9], { movement: 'thruster', reps: 1, load: 95 }, { movement: 'pull_up', reps: 1 })),
		notes: 'Same pull-up style and load as before'
	},
	diane: {
		name: 'Diane',
		minutes: 12,
		prescription: forTime(descending([21, 15, 9], { movement: 'deadlift', reps: 1, load: 225 }, { movement: 'hspu', reps: 1 })),
		notes: sameAsBefore
	}
};

function mondayMetcon(week: number, inputs: PlanInputs): Metcon {
	const occurrence = familyOccurrence(week);
	switch (mondayFamily(week)) {
		case 'phosphagen':
			return intervalMetcon('Sprint intervals', week, phosphagenDesigns[occurrence]!, 'All out every round');
		case 'glycolytic':
			return intervalMetcon('Intervals', week, glycolyticDesigns[occurrence]!, 'Hold the same output every round');
		case 'girl':
			return girlMetcons[mondayGirl(week)!];
		default:
			return couplet(week, inputs);
	}
}

const familyWhy = {
	couplet: 'The couplet is the week’s first hard session: short, fast, upper-body biased.',
	phosphagen: 'All-out efforts with long rest train the phosphagen pathway.',
	glycolytic: 'Hard 30–120 s efforts at 1:2 rest train the glycolytic pathway.',
	girl: 'A benchmark Girl after squats: compare it only with other in-plan Girls.'
} as const;

const familyTitle = { couplet: 'couplet', phosphagen: 'sprints', glycolytic: 'intervals' } as const;

function squatDay(ctx: Week): SessionBody {
	const { week, inputs } = ctx;
	const family = mondayFamily(week) ?? 'couplet';
	const metcon = mondayMetcon(week, inputs);
	return {
		title: `Squat + ${family === 'girl' ? metcon.name : familyTitle[family]}`,
		why: `${liftWhy(week)} ${familyWhy[family]}`,
		blocks: [
			warmUp('General warm-up · 3 × 5 box jumps'),
			liftBlock(ctx, 'back_squat'),
			block(metcon.name, 'metcon', metcon.minutes, [metcon.prescription], { hard: true, notes: metcon.notes }),
			block('Single-leg', 'strength', 8, [fixed('lunge', 3, 10)], { notes: 'Reps per leg' }),
			coolDown()
		]
	};
}

function gymnasticsSkill(inputs: PlanInputs): Block {
	const lSit = lSitAccumulation(inputs.tests.lSitSeconds.value);
	const dips = inputs.tests.ringDips;
	const lSitWork = intervals(lSit.rounds, 30, [{ movement: 'l_sit', seconds: lSit.seconds }]);
	return dips
		? block('Gymnastics', 'skill', 8, [lSitWork, fixed('dip', 4, pullUpSetReps(dips.value))])
		: block('Gymnastics', 'skill', 8, [lSitWork], { notes: 'Then ring dips: 4 sets of half your max' });
}

function gymnasticsMaxes(inputs: PlanInputs, pushUps: boolean): Prescription[] {
	const dips = inputs.tests.ringDips;
	return [
		intervals(1, 0, [{ movement: 'l_sit', seconds: inputs.tests.lSitSeconds.value }]),
		dips ? fixed('dip', 1, dips.value) : { kind: 'maxReps', movement: 'dip' },
		...(pushUps ? [fixed('push_up', 1, pushUpLadder[0])] : [])
	];
}

const maxesNote = (inputs: PlanInputs, then: string) =>
	`One max L-sit hold, then ${inputs.tests.ringDips ? 'one unbroken set of ring dips' : 'max unbroken ring dips'}${then}`;

const checkpointMaxes = (inputs: PlanInputs) =>
	block('Gymnastics maxes', 'skill', 8, gymnasticsMaxes(inputs, true), {
		notes: maxesNote(inputs, `, then max push-ups · ladders: push-ups ${pushUpLadder.join('/')}, L-hold to 3:00`)
	});

const bodyComp = block('Body comp', 'warmup', 1, [text('Fasted, before eating: weight · tape')]);

const submaxBlock = (inputs: PlanInputs, first?: string) =>
	block('Submax run', 'conditioning', 30, [steady('run', 30)], {
		notes: `${first ?? ''}Treadmill 1% · ${pace(inputs.submaxPaceSecondsPerMile, 'up')} fixed · log avg HR and RPE`
	});
const z1Run = ({ inputs, z1Minutes }: Week) =>
	block('Z1 run', 'conditioning', z1Minutes, [steady('run', z1Minutes)], { notes: easyNote(inputs) });

function pressDay(ctx: Week): SessionBody {
	const checkpoint = checkpointWeeks.has(ctx.week);
	const measured = bodyCompWeeks.has(ctx.week);
	const why = checkpoint
		? 'Press, then the checkpoint: the submax at November’s pace (a lower HR means aerobic gain) and gymnastics maxes against the ladders.'
		: 'Press and gymnastics skill, then an easy Z1 run between two hard days.';
	return {
		title: checkpoint ? 'Press + checkpoint tests' : 'Press + Z1 run',
		why: measured ? `Monthly body comp, fasted, on the same weekday as November’s. ${why}` : why,
		blocks: [
			...(measured ? [bodyComp] : []),
			warmUp('General warm-up · 3 × 5 plyo push-ups', 6),
			liftBlock(ctx, 'shoulder_press'),
			...(checkpoint ? [submaxBlock(ctx.inputs), checkpointMaxes(ctx.inputs)] : [gymnasticsSkill(ctx.inputs), z1Run(ctx)])
		]
	};
}

function pullUpBlock({ week, inputs }: Week): Block {
	const anchor = liftWeek(week).phase === 'anchor';
	return block('Pull-ups', 'strength', anchor ? 14 : 10, [
		fixed('pull_up', anchor ? 8 : 5, pullUps(inputs)),
		fixed('ring_row', anchor ? 3 : 2, 10)
	], { notes: 'Strict, from a dead hang' });
}

function qualityADay(ctx: Week): SessionBody {
	const odd = !isBWeek(ctx.week);
	const p = p10(ctx.inputs);
	const run = odd
		? block('3 × 10 min', 'conditioning', 34, [intervals(3, 120, [{ movement: 'run', seconds: 600 }])], {
				hard: true,
				notes: `${clock(p + 15, 'up')}–${pace(p + 20, 'down')} · ${hr(ctx.inputs, 0.85, 0.9)} ceiling`
			})
		: block('4 × 8 min', 'conditioning', 38, [intervals(4, 120, [{ movement: 'run', seconds: 480 }])], {
				hard: true,
				notes: `${clock(p, 'up')}–${pace(p + 15, 'down')} · hold rep 1’s pace through rep 4 · ${hr(ctx.inputs, 0.9).replace('<', '~')}`
			});
	return {
		title: 'Threshold intervals',
		why: odd
			? 'Threshold reps with the pace as a ceiling, never faster. Pull-up sets at half your max build toward 20.'
			: 'Longer threshold reps: hold rep 1’s pace through rep 4. Pull-up sets at half your max build toward 20.',
		blocks: [warmUp('5 min easy jog · drills · 4 strides', 8), run, pullUpBlock(ctx), coolDown()]
	};
}

function easyDay(ctx: Week): SessionBody {
	const { week, inputs } = ctx;
	const bikeWeek = !isBWeek(week);
	const holiday = holidayWeeks.has(week);
	const reason = bikeWeek
		? 'Easy day before the deadlift: nothing harder than Z1.'
		: 'Easy Z1 flow before the long session.';
	return {
		title: bikeWeek ? 'Z1 run + gymnastics' : 'Z1 bike + gymnastics',
		why: holiday
			? 'Thursday’s easy session, a day early for the holiday, so the day before the deadlift stays easy. Quality A is skipped, not doubled; its pull-up sets move here, after the max set.'
			: `${reason} The max pull-up set resets next week’s sets.`,
		blocks: [
			bikeWeek
				? z1Run(ctx)
				: block('Z1 bike', 'conditioning', 25, [steady('bike', 25)], { notes: `RPE ≤4 · ${hr(inputs, 0.75)}` }),
			block('Gymnastics', 'skill', 10, [fixed('hspu', 3, 5)], { notes: 'Pike or box HSPU until strict wall HSPU is solid' }),
			block('Pull-up max', 'skill', 3, [fixed('pull_up', 1, inputs.tests.strictPullUps.value)], {
				notes: 'One unbroken strict set to failure'
			}),
			...(holiday ? [pullUpBlock(ctx)] : [])
		]
	};
}

function bikeIntervals({ week, inputs }: Week): Block {
	const secondsPerMile = bikeSecondsPerMile(inputs.tests.bike2MileSeconds.value);
	const miles = (seconds: number) => bound(seconds / secondsPerMile, 'up', 0.01).toFixed(2);
	if (bikeFamily(week) === 'phosphagen') {
		const rounds = scaleRounds(10, week);
		return block('Bike sprints', 'conditioning', Math.ceil(rounds) + 2, [intervals(rounds, 45, [{ movement: 'bike', seconds: 15 }])], {
			hard: true,
			notes: `All out · each ≥${miles(15)} mi`
		});
	}
	const rounds = scaleRounds(6, week);
	return block('Bike intervals', 'conditioning', rounds * 3 + 2, [intervals(rounds, 120, [{ movement: 'bike', seconds: 60 }])], {
		hard: true,
		notes: `Each ≥${miles(60)} mi`
	});
}

function speedRun({ week, inputs }: Week): Block {
	const p400 = inputs.tests.run400Seconds.value / 400;
	const mile = inputs.tests.mileSeconds?.value;
	const pMile = mile === undefined ? undefined : mile / 1609;
	switch (qualityB(week)) {
		case 'bombolini':
			return block('Bombolini', 'conditioning', 22, [
				intervals(3, 300, [{ movement: 'run', meters: 500 }, { movement: 'run', meters: 200 }, { movement: 'run', meters: 100 }])
			], {
				hard: true,
				notes: `200 m is a jog · no faster than: 500 m ${pMile === undefined ? 'midway between mile and 400 pace' : clock(250 * (pMile + p400), 'up')}, 100 m ${clock(100 * p400, 'up')}`
			});
		case 'ladder':
			return block('Ladder', 'conditioning', 38, [
				intervals(3, 0, [600, 400, 300, 200].map((meters) => ({ movement: 'run' as const, meters })))
			], {
				hard: true,
				notes: `Rest 2:00/1:30/1:00/0:30 · 800 m jog between rounds · no faster than ${pMile === undefined ? '0.925 × mile pace' : [600, 400, 300, 200].map((m) => clock(m * 0.925 * pMile, 'up')).join('/')}`
			});
		default:
			return block('Mile time trial', 'conditioning', 10, [forTime([{ movement: 'run', meters: 1609 }])], {
				hard: true,
				notes: 'Even effort, all out · log peak HR'
			});
	}
}

function fridayDay(ctx: Week): SessionBody {
	const { week } = ctx;
	const early = holidayWeeks.has(week) ? ', a day early for the holiday' : '';
	if (!isBWeek(week)) {
		return {
			title: 'Deadlift + bike',
			why: `Deadlift, then bike intervals after the lift${early}. The bike uses the pathway Monday didn’t.`,
			blocks: [warmUp('General warm-up · 3 × 5 broad jumps'), liftBlock(ctx, 'deadlift'), bikeIntervals(ctx), coolDown()]
		};
	}
	const speed = qualityB(week);
	const titles = { bombolini: 'Bombolini', ladder: 'Ladder', mileTimeTrial: 'Mile TT' } as const;
	return {
		title: `${titles[speed ?? 'mileTimeTrial']} + deadlift`,
		why:
			speed === 'mileTimeTrial'
				? `Mile checkpoint${early}: it resets the speed paces. Deadlift follows with lighter supplemental work.`
				: 'Speed first while fresh, then deadlift with lighter supplemental work. Paces are ceilings: never faster.',
		blocks: [
			warmUp('5 min easy jog · drills · 4 strides'),
			speedRun(ctx),
			liftBlock(ctx, 'deadlift', true, 'Broad jumps 3 × 5 first'),
			coolDown()
		]
	};
}

function longRunDay({ week, inputs }: Week): SessionBody {
	const minutes = longRunMinutes(week, inputs.tests.run10kSeconds.value) ?? 0;
	return {
		title: 'Long run',
		why: deloadWeeks.has(week)
			? 'Deload week: the long run drops 20%. Easy means easy.'
			: 'The long Z1 run builds the aerobic base. Easy means easy: slower is fine.',
		blocks: [
			block('Long run', 'conditioning', minutes, [steady('run', minutes)], { notes: easyNote(inputs) }),
			coolDown('Walk · calf and hip stretch')
		]
	};
}

const testWarmUp = warmUp('General warm-up · build to test effort', 15);
function retestDay(slot: Slot, inputs: PlanInputs): SessionBody {
	const test = (name: string, minutes: number, prescriptions: Prescription[], notes?: string, kind: BlockKind = 'metcon') =>
		block(name, kind, minutes, prescriptions, { hard: true, notes });
	switch (slot) {
		case 'crossfitTotal':
			return {
				title: 'CrossFit Total + pull-ups',
				why: 'The retest opens with the CrossFit Total, done to November’s standard.',
				blocks: [
					testWarmUp,
					test('CrossFit Total', 40, [fixed('back_squat', 1, 1), fixed('shoulder_press', 1, 1), fixed('deadlift', 1, 1)], 'Up to 3 attempts per lift', 'strength'),
					test('Strict pull-ups', 5, [fixed('pull_up', 1, inputs.tests.strictPullUps.value)], 'One unbroken strict set to failure', 'skill'),
					coolDown()
				]
			};
		case 'submaxAndGymnastics':
			return {
				title: 'Submax + gymnastics tests',
				why: 'Body comp and the submax run under November’s conditions, then the max L-sit and ring dips.',
				blocks: [
					submaxBlock(inputs, 'Body comp first: fasted weight, tape. '),
					test('Gymnastics tests', 10, gymnasticsMaxes(inputs, false), maxesNote(inputs, ''), 'skill')
				]
			};
		case 'run400Grace':
			return {
				title: '400 m + Grace',
				why: 'The 400 pairs with Friday’s mile for the fatigue factor. Grace follows after at least 20 minutes.',
				blocks: [
					testWarmUp,
					test('400 m', 5, [forTime([{ movement: 'run', meters: 400 }])], 'Same surface as before · log peak HR', 'conditioning'),
					test('Grace', 25, [girlMetcons.grace.prescription], 'At least 20 min after the 400 · same standard as before'),
					coolDown()
				]
			};
		case 'bike2Mile':
			return {
				title: '2-mile bike',
				why: 'The 2-mile assault bike sets peak HR and the bike pace for the next evolution.',
				blocks: [
					testWarmUp,
					test('2-mile bike', 8, [forTime([{ movement: 'bike', meters: 3219 }])], 'Log peak HR', 'conditioning'),
					coolDown()
				]
			};
		case 'mileCindy':
			return {
				title: 'Mile + Cindy',
				why: 'The mile completes the 400–mile pair. Cindy follows after at least 20 minutes.',
				blocks: [
					testWarmUp,
					test('Mile', 10, [forTime([{ movement: 'run', meters: 1609 }])], 'Even effort, all out · log peak HR', 'conditioning'),
					test('Cindy', 40, [{ kind: 'amrap', minutes: 20, movements: [{ movement: 'pull_up', reps: 5 }, { movement: 'push_up', reps: 10 }, { movement: 'air_squat', reps: 15 }] }], 'At least 20 min after the mile'),
					coolDown()
				]
			};
		case 'cunningham':
			return {
				title: 'Jason Cunningham',
				why: 'The long loaded test, done as in 2023.',
				blocks: [
					testWarmUp,
					test('Jason Cunningham', 45, [
						forTime([{ movement: 'run', meters: 200 }, { movement: 'bear_complex', reps: 3, load: 115 }, { movement: 'burpee', reps: 4 }], 10),
						forTime([{ movement: 'front_squat', reps: 26, load: 115 }, { movement: 'deadlift', reps: 38, load: 115 }, { movement: 'run', meters: 1609 }])
					], 'Burpees over the bar · the second part follows round 10'),
					coolDown()
				]
			};
		case 'run10k':
			return {
				title: '10k',
				why: 'The 10k anchors the next evolution’s paces. Its last 20 minutes’ HR is the threshold proxy.',
				blocks: [testWarmUp, test('10k', 55, [forTime([{ movement: 'run', meters: 10000 }])], 'Log avg HR over the last 20 min', 'conditioning'), coolDown()]
			};
		case 'amanda':
			return {
				title: 'Amanda',
				why: 'Amanda at the rec center, for the muscle-ups.',
				location: 'rec',
				blocks: [
					testWarmUp,
					test('Amanda', 15, [forTime(descending([9, 7, 5], { movement: 'muscle_up', reps: 1 }, { movement: 'squat_snatch', reps: 1, load: 135 }))], sameAsBefore),
					coolDown()
				]
			};
		case 'row5k':
			return {
				title: 'Row 5k',
				why: 'The row 5k at the rec center, the long test on a third machine.',
				location: 'rec',
				blocks: [testWarmUp, test('Row 5k', 22, [forTime([{ movement: 'row', meters: 5000 }])], undefined, 'conditioning'), coolDown()]
			};
		case 'fran':
			return {
				title: 'Fran',
				why: 'Fran comes the day after the row this time, not after rest: read the comparison with that in mind.',
				blocks: [testWarmUp, test('Fran', 10, [girlMetcons.fran.prescription], girlMetcons.fran.notes), coolDown()]
			};
		case 'diane':
			return {
				title: 'Diane',
				why: 'Diane moves to Saturday this time: read the comparison with that in mind.',
				blocks: [testWarmUp, test('Diane', 12, [girlMetcons.diane.prescription], sameAsBefore), coolDown()]
			};
		default:
			throw new Error(`${slot} is not a retest slot`);
	}
}

function trainingDay(slot: Slot, ctx: Week): SessionBody {
	switch (slot) {
		case 'squat':
			return squatDay(ctx);
		case 'press':
			return pressDay(ctx);
		case 'qualityA':
			return qualityADay(ctx);
		case 'easy':
			return easyDay(ctx);
		case 'friday':
			return fridayDay(ctx);
		case 'longRun':
			return longRunDay(ctx);
		default:
			return retestDay(slot, ctx.inputs);
	}
}

function buildWeek(ctx: Week): PlanWeek {
	return weekLayout(ctx.week).map(({ day, slot }) => {
		const { title, why, location = 'home', blocks } = trainingDay(slot, ctx);
		return { date: sessionDate(ctx.inputs.firstMonday, ctx.week, day), week: ctx.week, title, why, location, blocks };
	});
}

const runsIn = (p: Prescription) =>
	p.kind === 'steady' ? p.movement === 'run' : 'movements' in p && p.movements.some((m) => m.movement === 'run');

export const weeklyRunMinutes = (sessions: PlanWeek) =>
	sessions
		.flatMap((s) => s.blocks)
		.filter((b) => b.kind === 'conditioning' && b.prescriptions.some(runsIn))
		.reduce((total, b) => total + b.minutes, 0);

const z1Count = (sessions: PlanWeek) => sessions.flatMap((s) => s.blocks).filter((b) => b.name === 'Z1 run').length;

export function generatePlan(inputs: PlanInputs): PlanWeek[] {
	let lastFullWeek = baseWeekRunMinutes;
	return Array.from({ length: evolutionWeeks }, (_, i) => {
		const week = i + 1;
		const draft = buildWeek({ inputs, week, z1Minutes: easyRunRange.max });
		const count = z1Count(draft);
		if (count === 0) {
			if (fullWeek(week)) lastFullWeek = weeklyRunMinutes(draft);
			return draft;
		}
		const others = weeklyRunMinutes(draft) - count * easyRunRange.max;
		const fit = Math.floor((weeklyRunCap(lastFullWeek) - others) / count);
		const z1Minutes = Math.max(easyRunRange.min, Math.min(easyRunRange.max, fit));
		const sessions = buildWeek({ inputs, week, z1Minutes });
		if (fullWeek(week)) lastFullWeek = weeklyRunMinutes(sessions);
		return sessions;
	});
}
