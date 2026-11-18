# Evolution 5: DRAFT for coach review

Synthesized by the moderator from the final POSITIONs in `team/positions/`. Labels used below:
- **[MOD]**: the moderator's own synthesis, not a coach's source.
- **[INF-x]**: an inference flagged by coach x.

## Revision 2026-11-18 (overnight, pending athlete review)
Made by the moderator under the CEO's overnight delegation. Coaches were represented from their profiles and positions only. Each change can be reversed on its own.
1. **Battery:** Kong is King is replaced by Jason Cunningham, and Launchpad is dropped with no replacement. Every other test stays. The coverage matrix and reasons are in §A1 [MOD].
2. **This round:** Sat 11/21 is now Cunningham (was Kong) and Sat 11/28 is now rest (was Launchpad) (§A2) [MOD].
3. **Hard-session cap:** §C already settles it. The cap counts every non-easy session in any modality, metcons included (Seiler FINAL #metcons; accepted in the FIRST, Hinshaw, Wendler and Glassman FINAL positions). The wording is clarified; nothing else changes.
4. **Holiday weeks 3 and 4:** Christmas and New Year's Day are off. Friday's session moves to Thursday, Thursday's easy session moves to Wednesday, and that week's Quality A is skipped, not doubled (§C) [MOD, under §H3 (FIRST)].
5. **Run-time base:** a holiday-shortened week does not lower the base for the weekly +10% rule (§F) [MOD].
6. **Retest, weeks 16–17:** with Launchpad out, the battery takes 11 test days plus 1 rest day, so it fits the 12 days available. In week 17 the rest day moves from Thursday to Friday to keep Fran and Diane ≥48h apart (§A3) [MOD].
7. **Encoding gaps closed:** Quality B order is Bombolini in weeks 2 and 10, ladder in weeks 6 and 14. The odd-week bike family is whichever pathway Monday didn't use (§C) [MOD].
8. **Open questions:** the athlete's Nov 16 decisions answer double days, the HR monitor and Amanda. Item 1 settles Kong and Launchpad. One question remains in `open-questions.md`.

Athlete decisions (Nov 16):
- The long session is run first, then deadlift (~70–75 min); after review it moves from Thursday to Friday (Bare's fix).
- Has a wrist HR watch; RPE is used as a cross-check.
- Amanda is tested at the rec center.
- A 1-mile time trial is added.

## A. Benchmark battery and test windows

### A1. Battery and coverage (revised 2026-11-18)
The columns use the coaches' own taxonomies:
- **Run, Bike, Row, G, W:** Glassman's M/G/W modalities (§5, Template Table 2). Run, bike and row stay separate because "every movement is unique" (Hinshaw §3).
- **Str:** the CFT lifts (Wendler §6).
- **Phos, Glyc, Oxid:** phosphagen under ~10 s, glycolytic up to ~2 min, oxidative beyond several minutes (Glassman §4.4).
- **Z1, Z2, Z3:** Seiler's three zones (Seiler §5). They line up with FIRST's long, tempo and speed paces (FIRST §5) and with Hinshaw's aerobic-threshold, LT and VO2max stimuli (Hinshaw §5).
- **FF:** the 400 + mile pair (Hinshaw §6).

History is the number of rows in `data/normalized/results.jsonl` (some are one test logged in two sources) and the latest date.

| Test | History | Run | Bike | Row | G | W | Str | Phos | Glyc | Oxid | Z1 | Z2 | Z3 | FF | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CrossFit Total | 10; 2026-11 | | | | | ● | ● | ● | | | | | | | Keep |
| Strict pull-ups | 7; 2026-11 | | | | ● | | | | | | | | | | Keep |
| Max L-sit | 5; 2025-08 | | | | ● | | | | | | | | | | Keep |
| Max ring dips | new 11/17 | | | | ● | | | | | | | | | | Keep (Glassman ladder) |
| 30-min submax run | new 11/17 | ● | | | | | | | | ● | ● | | | | Keep (Seiler) |
| 400 m | 4; 2024-02 | ● | | | | | | | ● | | | | | ● | Keep |
| Mile TT | new | ● | | | | | | | | | | | ● | ● | Keep (athlete, Nov 16) |
| 10k | 5; 2025-08 | ● | | | | | | | | ● | | ● | | | Keep |
| 2-mile assault bike | 3; 2025-08 | | ● | | | | | | ● | | | | ● | | Keep |
| Row 5k | 4; 2023-08 | | | ● | | | | | | ● | | ● | | | Keep |
| Grace | 7; 2024-02 | | | | | ● | | | ● | | | | | | Keep |
| Fran | 2; 2025-08 | | | | ● | ● | | | ● | | | | | | Keep |
| Diane | 4; 2024-02 | | | | ● | ● | | | ● | | | | | | Keep |
| Amanda | 2; 2024-02 | | | | ● | ● | | | ● | | | | | | Keep (rec center) |
| Cindy | 5; 2023-08 | | | | ● | | | | | ● | | | | | Keep |
| Kong is King | 1; definition lost | ? | ? | ? | ? | ? | | | | ● | | | | | **Replace** with Cunningham |
| Jason Cunningham | 2; 2023-08 | ● | | | ● | ● | | | | ● | | | | | **Add** in Kong's place |
| Launchpad | 3; not comparable | | | | ● | | | | ● | | | | | | **Drop** |
| Body comp | new 11/17 | | | | | | | | | | | | | | Keep (Bare §4.11; a measure, not a modality) |

After the change, every column still has at least one test.
- **Zones:** the zone marks for max-effort tests are [MOD], read from their duration. Two have a source: the 10k's last-20-min HR is the threshold proxy (Seiler #benchmarks, [INFERENCE]), and the submax is Z1 (Seiler).
- **400 m:** Glassman's #benchmarks list puts the 400 under phosphagen. At ~65 s it is glycolytic by his own §4.4 durations, so the matrix follows §4.4 [MOD]. Phosphagen therefore rests on the CFT alone.
- **Kong is King → Jason Cunningham** [MOD].
  - Kong's definition is lost (REPORT, 2026-11-17).
  - Oxidative is still covered by the 10k, row 5k and Cindy. Without Kong, though, no test puts load (W) at the long end of the curve. Glassman defines fitness as work capacity "across broad time and modal domains" and says to "blur distinctions between 'cardio' and strength training" (Glassman §4.1, §4.11). The reading that this needs a long loaded test is [MOD].
  - Cunningham has a full definition and two results (38:00 → 36:40, 2023). It can be done at home, and it was already done inside the Aug 2023 test window (08-11).
  - Cost: a hero WOD the athlete does once a year becomes twice a year. If that's unwanted, the fallback is Benchmark Anaerobic (6 results, 45-min AMRAP) with its 800 m on the treadmill, so the course is fixed.
- **Launchpad dropped, not replaced** [MOD].
  - Its version was never fixed, and REPORT says its three results aren't comparable, so it has no usable history.
  - Its cell (bodyweight G, glycolytic) is covered by Cindy, Fran and Amanda.
  - Nothing comparable is lost, and dropping it frees the day the retest needs (§A3).
- **Not added:** Bare's own test, a half-marathon TT in his 16-week plan (Bare §6, [SECONDARY]). His position asks only to keep the battery and add body comp, and the 10k already covers long running with five results.

### A2. This round (Nov 16–30, 2026)
Spacing rules applied:
- ≥48h between the 400, mile, 10k and row 5k
- 400 and mile on separate days; mile ≥48h before the 10k
- Girls ≥48h apart
- Diane not adjacent to the 10k or bike test
- 10k and Cunningham ≥2 days after the CFT
- submax test first and fresh
- Thanksgiving (Thu Nov 26) is a rest day
- session RPE logged every test day

| Date | Tests |
|---|---|
| Mon 11/16 | CFT ✓ (255/160/335 = 750), strict pull-ups ✓ (13) |
| Tue 11/17 | AM body comp (fasted weight + tape); 30-min submax treadmill @ P10(Aug-25)+75 s/mi, 1% grade, avg HR + RPE; max L-sit; max ring dips |
| Wed 11/18 | 400 m (track/treadmill, same surface as before; record peak HR) → ≥20 min → Grace |
| Thu 11/19 | 2-mile assault bike (peak HR) |
| Fri 11/20 | 1-mile TT (peak HR) → ≥20 min → Cindy |
| Sat 11/21 | Jason Cunningham, 115 lb (replaces Kong is King) |
| Mon 11/23 | 10k (avg HR of last 20 min = threshold-HR proxy) |
| Tue 11/24 | Rec center: Amanda |
| Wed 11/25 | Rec center: Row 5k |
| Thu 11/26 | REST (Thanksgiving) |
| Fri 11/27 | Fran |
| Sat 11/28 | REST (Launchpad dropped) |
| Mon 11/30 | Diane |

Week 0 (Dec 1–5): 4 Z1 runs, ~135 min total, plus mobility (see §C). **Week 1 starts Mon Dec 7.** Holiday weeks 3 and 4: see §C.

### A3. Retest (weeks 16–17, Mar 22 – Apr 3, 2027)
Same tests, same spacing rules and same order as §A2 [MOD]. §A2 runs over 15 calendar days because Thanksgiving falls inside it. Weeks 16–17 have 12 training days, which hold the 11 test days plus 1 rest day.

| Day | Week 16 | Week 17 |
|---|---|---|
| Mon | CFT + strict pull-ups | 10k |
| Tue | Body comp; submax; max L-sit; max ring dips | Rec center: Amanda |
| Wed | 400 m → ≥20 min → Grace | Rec center: Row 5k |
| Thu | 2-mile assault bike | Fran |
| Fri | Mile TT → ≥20 min → Cindy | REST |
| Sat | Jason Cunningham | Diane |

- Week 17 moves the rest day from Thursday to Friday. That keeps Fran and Diane ≥48h apart, since Sunday is never a training day.
- Two tests change context: Fran comes the day after the row 5k instead of after a rest day, and Diane moves from Monday to Saturday. Read those two comparisons with that in mind.
- The §C hard-session cap doesn't apply in test windows. The spacing rules above govern them [MOD].

## B. Derived inputs (live formulas in the sheet)
**Lifts**
- TM = FLOOR(0.85 × tested 1RM, 5). From today: squat 215, press 135, DL **280** (corrects Wendler's 285).

**Running**
- P10 = T10k / 6.214 (s/mi).
- P400 = T400 / 400 and Pmile = Tmile / 1609 (s/m).
- FF_run = ln(Tmile / T400) / ln(4.02) − 1. Target 20–22% (Hinshaw).

**Heart rate**
- HRmax = highest peak HR from the 400, mile and bike tests.
- Threshold HR = avg HR over the last 20 min of the 10k.

**Bike**
- P_bike = T2mi / 2 per mile, for hard bike intervals only (Hinshaw).

## C. Weekly template (Mon–Sat; Sunday always off) — REVISED after review (Bare's fix)
At most 3 non-easy sessions per week, scored by session RPE 30 min after: 1–4 easy, 5–6 Z2, 7+ hard (Seiler). The cap counts every session in any modality: runs, metcons, bike intervals. Each session counts once (Seiler FINAL #metcons; accepted by FIRST, Hinshaw, Wendler and Glassman). Hard days are Mon/Wed/Fri, each followed by an easy day. There are 4 runs every week.

**Even weeks are "B-weeks"** (they hold the speed run and the mile retests in weeks 4/8/12). **Odd weeks are "bike weeks".**

| Day | Session | Hard count |
|---|---|---|
| Mon | 10–15 jumps → **Squat** 5/3/1 + FSL → **hard couplet**, upper/G-biased, 2–10 min (family rotation, §E) | 1 |
| Tue | 10–15 jumps or plyo push-ups → **Press** 5/3/1 + FSL → G skill (L-sit accumulation, handstand/HSPU, ring dips) → **Z1 run** 25–35 min | – |
| Wed | **Quality A run**. Odd weeks: 3×10 min / 2 min @ P10+15..20 s/mi, ceiling 85–90% HRmax. Even weeks: 4×8 min / 2 min @ P10+0..15, rep-1 pace held through rep 4, ~90% HRmax. Then pull-up sets. | 2 |
| Thu | Easy only, since DL follows [INF-wendler]. B-weeks: Z1 flow at RPE ≤4 (assault bike + easy calisthenics) + G skill + weekly strict pull-up AMRAP. Bike weeks: **Z1 run** 25–35 min (the 4th run) + G skill + pull-up AMRAP. | – |
| Fri, B-weeks | **Quality B run first**: Bombolini in weeks 2 and 10, Froning ladder in weeks 6 and 14 [MOD order]; weeks 4/8/12 are a mile TT instead. Then **Deadlift** 5/3/1 + **FSL 3×5**, with lower-body assistance cut. The long session (~70–75 min). | 3 |
| Fri, bike weeks | 10–15 jumps → **Deadlift** 5/3/1 + FSL (5×5 Leader / 3×5 Anchor) → **bike intervals after the lift** (Wendler): phosphagen 10–30 s at 1:3 or glycolytic 30–120 s at 1:2, distance targets from P_bike. The bike family is the pathway Monday didn't use: phosphagen in weeks 3/7/11/15 (Monday glycolytic), glycolytic in weeks 1/5/9/13 (Monday couplet) [MOD: keeps both interval pathways in each bike week, Glassman §4.4] → hinge/glute assistance if time allows | 3 |
| Sat | **Long Z1 run** at ≥ P10+75, HR <75% HRmax / RPE ≤3. Hinge day sits nearest the long run (Bare). | – |

Week 0 (Dec 1–5): 4 Z1 runs, ~135 min total, as the base for the weekly +10% rule (FIRST).

**Holiday weeks** [MOD, under §H3]. Christmas (Fri Dec 25, week 3) and New Year's Day (Fri Jan 1, week 4) are off. In both weeks:
- Friday's session moves to Thursday: DL + bike in week 3, mile TT + DL in week 4.
- Thursday's easy session moves to Wednesday, so the day before the DL stays easy (§H2).
- Wednesday's Quality A is skipped, not doubled (§H3, FIRST). Each week has 2 hard sessions (Mon, Thu) and 3 runs.

Every other layout breaks a rule. DL on Thursday after Quality A on Wednesday breaks §H2. Quality A on Tuesday is a hard run the day after squat. Dropping the long run breaks the next week's Frandsen cap. If the athlete trains on the holiday, the normal template stands.

## D. Strength (Wendler, with Bare and Glassman accepted)
**Cycle layout**
- Leader: weeks 1–3 and 4–6.
- Week 7: deload, 40/50/60% × 5.
- Anchor: weeks 8–10.
- Week 11: TM test, 70/80/90% × 5, then 100% TM for reps. Fewer than 3 reps → TM −10%.
- Anchor: weeks 12–14.
- Week 15: deload, which opens the retest window.
- Weeks 16–17: retest, laid out in §A3. Evo 5 is 17 weeks including the retest [MOD].

**Leader**
- 5's PRO: wk1 65/75/85 × 5, wk2 70/80/90 × 5, wk3 75/85/95 × 5.
- FSL 5×5 at the first-set %.

**Anchor**
- 5/3/1: wk1 65/75/85 × 5/5/5+ (PR set), wk2 70/80/90 × 3/3/3+, wk3 75/85/95 × 5/3/1+ (PR set).
- Jokers (+5–10%, 1–3 reps) only in cycle-weeks 2–3, on strong days, never missing reps.
- Jumps/throws (10–15 contacts) before EVERY main lift: box or broad jumps on squat/DL days; plyo push-ups or box jumps on press day [INF-wendler, no med ball].
- FSL 3×5.

**Progression**
- After each 3-week cycle: TM +10 lb squat/DL, +5 lb press.
- The increase applies only if every rep was clean; otherwise hold the TM.
- No recalculation of TMs mid-evolution.

**Assistance (10–15 min after the lift)**
- One push, one pull and one single-leg/core movement, mostly gymnastics couplets.
- Reps per category: 25–50 in Leader, 50–100 in Anchor.
- Push: DB press, ring dips, push-ups.
- Pull: pull-up sets + ring rows.
- Quad-dominant single-leg work early in the week; hinge/glute work on Friday, nearest the long run (Bare).
- No isolation work inside the hour. Bench is optional, outside the hour.

**Gymnastics** [INF-glassman schemes]
- **Pull-ups:** sets of FLOOR(0.5 × latest strict max), 50–100 reps per session filled with ring rows. The weekly strict AMRAP resets the max. Kipping only in NON-benchmark metcons, and only once the strict max is ≥15.
- **Every Girl (in-plan and at retest) is done to exactly the standard recorded before:** same pull-up style, same loads (Fran 95, Grace 135, Diane 225) (Glassman). In-plan Girls come after squat sets, so compare them only with other in-plan Girls.
- **Ring dips:** same scheme.
- **Muscle-up substitute** once 15 pull-ups / 15 dips: strict chest-to-bar + deep ring dips.
- **L-sit:** accumulate 3 × max in sets of 0.5–0.75 × max.
- **Handstand:** wall holds → pike/box HSPU → strict wall HSPU.
- **Ladders:** pull-ups 20/25/30, dips 20/30/40/50, push-ups 50/75/100, L-hold to 3:00.

## E. Monday hard-slot family rotation (Glassman)
Four-week cycle; exercises vary within each family; home equipment only.

| Week of cycle | Family |
|---|---|
| 1 | Couplet for time, 2–10 min |
| 2 | Phosphagen intervals, work:rest 1:3 |
| 3 | Glycolytic intervals, work:rest 1:2 |
| 4 | A Girl, no special prep: wk4 Grace, wk8 Fran, wk12 Diane |

- Deload and TM-test weeks (7, 11, 15): scaled, ~half.
- Ramp: half volume/intensity in weeks 1–2 (Glassman); new conditioning ramps over weeks 1–3 (Wendler).
- Repeating older WODs inside a family is welcome but not required.
- In odd weeks Friday is already bike intervals, so Monday's interval families use run, G or W elements, not the bike [INF-glassman].

## F. Running progression
- **Long run:** wk1 = MIN(60 min, 1.1 × 10k time), then +5 min/wk up to 90 min.
  - Each run ≤110% of the longest in the prior 30 days (Frandsen).
  - Weekly run time ≤ +10% (Bare). A holiday-shortened week (§C) doesn't lower the base: the next week is capped against the last full week [MOD: the rule limits ramp-ups, and returning to a prior level isn't one].
  - Deload weeks: −20%.
- **Speed paces:**
  - Bombolini = 3 × [500 m / 200 m jog / 100 m], no rest inside a set, 5 min between sets. 500 m = midpoint of 500 × Pmile and 500 × P400; 100 m ≤ 100 × P400.
  - Ladder = 3 × [600/400/300/200 m with 2:00/1:30/1:00/0:30 rest], 800 m easy jog between rounds.
  - Ladder reps = distance × 0.925 × Pmile [INF-hinshaw].
  - All speed targets are ceilings: never run faster.
  - Speed paces reset after each mile retest (weeks 4/8/12).
- **Threshold/easy paces** stay anchored to this round's 10k for the whole evolution.

## G. Checkpoints (end of weeks 4, 8, 12)
- **Mile TT** → FF_run (Hinshaw).
- **Submax test**: Tuesday's Z1 run becomes the 30-min submax at the same fixed pace; lower HR = aerobic gain (Seiler).
- **Strength**: e1RM from Anchor PR sets (wt × reps × 0.0333 + wt) in weeks 8–10 and 12–14 (Wendler).
- **Gymnastics**: max strict pull-ups (weekly AMRAP), max ring dips, max L-sit, max push-ups, against the ladders (Glassman).
- **Body comp**: monthly in weeks 1/5/9/13, plus the MacroFactor trend (Bare).

**End targets [MOD]**
- CFT: +50 (squat +20, DL +20, press +10). That is about half the programmed TM gain, which matches the athlete's realized rate in Ev2.
- Mile: IF(FF_run > 0.215, MAX(0.95 × Tmile, T400 × 4.02^1.215), 0.95 × Tmile) [INF-hinshaw]. The second term is Hinshaw's "optimal mile" at 21.5% FF, so the target can't outrun what the 400 supports (Hinshaw; Froning's ~5% in 12 weeks was a mile result).
- 10k: × 0.95 [MOD].
- Pull-ups: 13 → 20 (wk4 +1, wk8 +3, wk12 +5, wk16 +7).

## H. Week-to-week adaptation rules
1. Count non-easy sessions by session RPE. If a 4th is coming, downgrade Friday to Z1 flow or skill (Seiler/Wendler).
2. Nothing harder than Z1 the day before squat or DL [INF-wendler: his literal rule is 'never do conditioning the day before lower body lifting']. No hard run the day after heavy squat/DL (Bare/FIRST/Seiler/Hinshaw). No hard metcon the day before a speed run (Hinshaw).
3. Never double up a missed session; skip it and move on (FIRST).
4. Poor sleep or soreness: cut assistance first and keep the main + FSL sets. Swap a run for the bike if needed. Easy means easy (Bare/Seiler).
5. Any ground-out or missed rep: hold the TM for the next cycle. Week 11 TM test: fewer than 3 reps → TM −10% (Wendler).
6. 4×8: if rep-1 pace can't be held through rep 4, start the next 4×8 5 s/mi slower [MOD]. Mirror: if rep 4 is at or faster than rep 1, average HR ≤ ~90% HRmax and session RPE ≤8, start the next 4×8 5 s/mi faster; 3×10 likewise while HR ≤90% HRmax [INF-seiler].
7. HR vs RPE disagree on an easy run: take the slower of the two. Wrist HR lags, so RPE rules short efforts [MOD].
8. The pull-up set size updates each week from Thursday's AMRAP.
9. The submax checkpoint is run under identical conditions each time: treadmill, 1% grade, the 11/17 fixed pace, similar time of day (Seiler).
10. The week-1 long run passes Frandsen's 30-day rule only because the 11/23 10k falls inside that window; if the retest moves, recheck it (FIRST).
