#!/usr/bin/env python3
"""Build normalized/ from raw/ + curated/. Raw is never modified; rerun any time.

Outputs
  normalized/workouts.json   catalog: one entry per distinct workout (curated + SugarWOD)
  normalized/results.jsonl   one line per performance, with canonical numeric score
  normalized/lifts.json      rep-max evidence per lift (SugarWOD load rows + snapshot)
  normalized/REPORT.md       counts, recurring workouts, conflicts, gaps to label
"""
import csv, json, re, collections, datetime as dt
from pathlib import Path

ROOT = Path(__file__).parent
RAW, CUR, OUT = ROOT / "raw", ROOT / "curated", ROOT / "normalized"
OUT.mkdir(exist_ok=True)

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

def parse_time(s):
    """'7:10' -> 430, '1:04.95' -> 64.95, '53:13:00' (Sheets h:m:s misread) -> 3193."""
    s = str(s).strip()
    m = re.fullmatch(r"(\d+):(\d{2})(?::(\d{2}))?(\.\d+)?", s)
    if not m:
        return None
    a, b, c, frac = m.groups()
    if c is not None and c == "00":          # Sheets turned mm:ss into hh:mm:00
        return int(a) * 60 + int(b)
    if c is not None:
        return int(a) * 3600 + int(b) * 60 + int(c)
    return int(a) * 60 + int(b) + (float(frac) if frac else 0)

def canonical(score, stype):
    """Return (value, unit). rounds_reps -> rounds + reps/1000 so it sorts; keep raw too."""
    if score is None:
        return None, None
    s = str(score).strip()
    if stype in ("time",):
        return parse_time(s), "s"
    if stype == "rounds_reps":
        m = re.fullmatch(r"(\d+)\s*\+\s*(\d+)", s)
        if m:
            return int(m[1]) + int(m[2]) / 1000, "rounds.reps"
        return (float(s), "rounds") if re.fullmatch(r"\d+(\.\d+)?", s) else (None, None)
    if re.fullmatch(r"-?\d+(\.\d+)?", s):
        return float(s), {"load_lb": "lb", "reps": "reps", "seconds": "s", "points": "pts"}.get(stype, None)
    return None, None

# ---------- vocab ----------
VOCAB = json.load(open(CUR / "movements.json"))["movements"]
for v in VOCAB:
    v["_re"] = [re.compile(p) for p in v["match"]]

def tag_movements(text):
    if not text:
        return []
    t = " " + text.lower() + " "
    found = []
    for v in VOCAB:
        for rx in v["_re"]:
            m = rx.search(t)
            if m:
                found.append(v["id"])
                t = t[: m.start()] + " " * (m.end() - m.start()) + t[m.end():]   # consume span
                # consume further occurrences of the same movement too
                t = rx.sub(lambda x: " " * len(x.group(0)), t)
                break
    return found

def summarize_tags(mov_ids):
    by = {v["id"]: v for v in VOCAB}
    pats = sorted({p for i in mov_ids for p in by[i]["pattern"].split("+")})
    mods = "".join(sorted({by[i]["modality"] for i in mov_ids}, key="MGW".index))
    home = all(by[i]["home"] for i in mov_ids) if mov_ids else None
    return pats, mods, home

# ---------- workouts ----------
GIRLS = {"angie","annie","barbara","chelsea","cindy","diane","elizabeth","fran","grace","helen","isabel","jackie","karen","linda","mary","nancy","nicole","amanda","eva","kelly","lynne","grettel","ingrid","marguerita","candy","maggie","hope","gwen","megan"}
HEROES = {"murph","dt","jt","the-chief","hall","zeus","klepto","the-standard","michael","nate","badger","randy","josh","jason-cunningham"}

curated_w = {w["id"]: w for w in json.load(open(CUR / "workouts.json"))}
alias = {}
for w in curated_w.values():
    for a in [w["name"]] + w.get("aliases", []):
        alias[slug(a)] = w["id"]

def resolve(title):
    s = slug(title)
    return alias.get(s, s)

def guess_kind(wid, row):
    base = wid.split("-")[0]
    if wid in GIRLS or base in GIRLS and len(wid.split("-")) == 1:
        return "girl"
    if wid in HEROES:
        return "hero"
    if re.match(r"(open|agoq|games)-", wid):
        return "competition"
    if row.get("barbell_lift") or (row.get("score_type") == "Load" and re.search(r"\d+x\d+|1x1|\d-\d-\d|rm\b|for load", (row["title"] + row["description"]).lower())):
        return "strength"
    return "class_wod"

STYPE = {"Load": "load_lb", "Rounds + Reps": "rounds_reps", "Reps": "reps", "Other / Text": "text", "Checkbox": "checkbox", "": "time"}

workouts = {k: dict(v, sources=list(v.get("sources", []))) for k, v in curated_w.items()}
results = []

rows = list(csv.DictReader(open(RAW / "sugarwod" / "workouts_export_2026-11-17.csv")))
for i, r in enumerate(rows, start=2):
    wid = resolve(r["title"])
    date = dt.datetime.strptime(r["date"], "%m/%d/%Y").date().isoformat()
    sets = json.loads(r["set_details"]) if r["set_details"] else []
    stype = STYPE.get(r["score_type"], "text")
    if stype == "time" and not (sets and "mins" in sets[0] or "secs" in (sets[0] if sets else {})):
        stype = "text" if r["score_type"] == "" and not sets else stype
    w = workouts.get(wid)
    if w is None:
        w = workouts[wid] = {"id": wid, "name": r["title"], "kind": guess_kind(wid, r), "descriptions": [],
                             "score": {"type": stype, "better": "lower" if stype == "time" else "higher"},
                             "sources": []}
    if r["description"] and r["description"] not in w.setdefault("descriptions", []):
        w["descriptions"].append(r["description"])
    if "raw/sugarwod/workouts_export_2026-11-17.csv" not in w["sources"]:
        w["sources"].append("raw/sugarwod/workouts_export_2026-11-17.csv")
    st = w["score"]["type"]
    val, unit = canonical(r["best_result_display"], st) if st != "load_lb" else (float(r["best_result_raw"] or 0) or None, "lb")
    if st == "time" and val is None and r["best_result_raw"].isdigit():
        val, unit = float(r["best_result_raw"]), "s"
    results.append({
        "workout": wid, "date": date, "date_precision": "day",
        "score_display": r["best_result_display"], "value": val, "unit": unit,
        "rx": r["rx_or_scaled"].lower(), "pr_flag": bool(r["pr"]),
        "barbell_lift": slug(r["barbell_lift"]) or None, "sets": sets or None,
        "notes": r["notes"] or None, "source": f"sugarwod#row{i}",
    })

for c in json.load(open(CUR / "results.json")):
    w = workouts[c["w"]]
    st = w["score"]["type"]
    val, unit = canonical(c.get("score"), st)
    if st == "load_lb" and c.get("score"):
        val, unit = float(c["score"]), "lb"
    results.append({
        "workout": c["w"], "date": c.get("date"), "date_precision": c.get("prec", "day"),
        "date_text": c.get("date_text"), "score_display": c.get("score"), "value": val, "unit": unit,
        "rx": c.get("rx"), "detail": c.get("detail"), "splits": c.get("splits"), "location": c.get("loc"),
        "test_round": c.get("round"), "notes": c.get("notes"), "duplicate_of": c.get("dup_of"),
        "conflict": c.get("conflict"), "source": c["src"],
    })

# ---------- tagging ----------
for w in workouts.values():
    text = " ".join(filter(None, [w["name"], w.get("description")] + w.get("descriptions", [])))
    mov = tag_movements(text)
    pats, mods, home = summarize_tags(mov)
    w["tags"] = {"movements": mov, "patterns": pats, "modality": mods, "home_ok_auto": home, "tag_source": "auto"}

# ---------- lifts ----------
lifts = collections.defaultdict(list)
for r in results:
    if r.get("barbell_lift") and r["value"]:
        lifts[r["barbell_lift"]].append({"date": r["date"], "load": r["value"], "reps": None, "source": r["source"]})
snap = json.load(open(CUR / "sugarwod_snapshot_2026-11-17.json"))
for m in snap["barbell_maxes_lb"]:
    for k in ("1RM", "2RM", "3RM", "5RM"):
        if k in m:
            lifts[m["lift"]].append({"date": None, "load": m[k], "reps": int(k[0]), "source": "sugarwod-snapshot-2026-11-17", "note": m.get("note")})

# ---------- write ----------
results.sort(key=lambda r: (r["date"] or "0000", r["workout"]))
json.dump(sorted(workouts.values(), key=lambda w: w["id"]), open(OUT / "workouts.json", "w"), indent=1)
with open(OUT / "results.jsonl", "w") as f:
    for r in results:
        f.write(json.dumps({k: v for k, v in r.items() if v not in (None, [], {})}) + "\n")
json.dump(lifts, open(OUT / "lifts.json", "w"), indent=1)

# ---------- report ----------
by_w = collections.defaultdict(list)
for r in results:
    by_w[r["workout"]].append(r)
kinds = collections.Counter(w["kind"] for w in workouts.values())
recurring = sorted(((k, len(v)) for k, v in by_w.items() if len({x["date"] or x.get("date_text") for x in v}) >= 2 and workouts[k]["kind"] != "strength"), key=lambda x: -x[1])
untagged = [w["id"] for w in workouts.values() if not w["tags"]["movements"] and w["kind"] not in ("test",)]
missing = [f'{w["id"]}: {w["definition_status"]}' for w in workouts.values() if w.get("definition_status")]
conflicts = [r for r in results if r.get("conflict")]
nulls = [r for r in results if r["value"] is None and r.get("score_display")]
dates = sorted(r["date"] for r in results if r["date"])
L = [f"# Data build report", "",
     f"- {len(workouts)} workouts, {len(results)} results, dated {dates[0]} → {dates[-1]}",
     f"- workout kinds: {dict(kinds)}",
     f"- lifts with rep-max evidence: {len(lifts)}", "",
     "## Definition problems", *[f"- {m}" for m in missing], "",
     "## Recurring (≥2 dated results, non-strength): comparison anchors", *[f"- {k} ({n})" for k, n in recurring], "",
     "## Conflicts between sources (kept, not resolved)", *[f"- {r['workout']} {r['date']}: {r['conflict']}" for r in conflicts], "",
     f"## Scores that did not parse to a number ({len(nulls)})", *[f"- {r['workout']} {r['date']}: {r['score_display']!r}" for r in nulls[:40]], "",
     f"## Untagged workouts: no movement matched ({len(untagged)})", *[f"- {u}" for u in sorted(untagged)], ""]
open(OUT / "REPORT.md", "w").write("\n".join(L))
print("\n".join(L[:6]))
