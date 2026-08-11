# Content pipeline · FBISE Class 9

How curriculum content gets from the board's website into the app, and what state it is in today.

```
fbise.edu.pk ──► content/fbise/     ──► data/fbise/      ──► Postgres    ──► the apps
   24 PDFs        pdf + text            9 JSON files         draft rows      published rows
                  gitignored, 173 MB    committed, 264 KB
```

Three commands, each safe to re-run:

```bash
npm run content:fetch      # download the PDFs, extract their text
npm run content:build      # parse the text into data/fbise/*.json
npm run content:ingest -- --dry-run   # show what would be written
npm run content:ingest                # write it to Supabase
```

## Which FBISE document is authoritative

There are two per subject and they disagree, so this matters.

- **Curriculum PDFs** under `notifications/ssc/` are the **2006** national curriculum, organised
  into numbered units. FBISE staples a cover page onto each one that names the units the Class 9
  paper is set from. That cover page is the best chapter list available anywhere.
- **Assessment Frameworks** under `ModelPaper/2025/` are built on the **National Curriculum of
  Pakistan 2022-23**, organised into lettered domains. FBISE's own notification says papers are now
  set from these, so for learning outcomes the framework wins.

The pipeline uses each for what it is good at: unit names from the cover page, outcomes from the
framework. Both are recorded in every output file with the exact path and a SHA-256, because the
board reissues these documents silently.

**SSC-I is Class 9. SSC-II is Class 10.** The folders mix them.

## What an outcome carries

Each SLO comes out with three things beyond its text, and all three change what we generate:

- **`code`**, e.g. `P-09-B-30`. Every generated note, question and flashcard points back at the
  outcome it was written for. That is what makes the content auditable and what stops a generator
  from drifting into whatever the model finds interesting.
- **`assessment`**: `summative` is on the exam, `formative` is taught but not examined. Roughly a
  quarter of the curriculum is formative, and writing exam questions for it wastes money and
  student time.
- **`cognitive`**: `knowledge`, `understanding` or `application`. The board sets papers to a
  30/50/20 split across the three, so this decides what kind of question an outcome deserves, not
  just whether it gets one.

`assessment: null` means the source table merged that column across a whole content area and we
genuinely do not know. It is **not** the same as formative. Treat it as unknown and include it.

## Where it stands

| Subject | Outcomes | Examinable | Unit list | Notes |
| --- | --- | --- | --- | --- |
| Physics | 141 | 129 | 9 units | clean |
| Chemistry | 167 | 154 | 8 units | domains unnamed in source |
| Biology | 83 | 80 | 9 units | domains unnamed in source |
| Mathematics | 61 | 46 | 17 units | see the numbering note below |
| Pakistan Studies | 35 | 6 | 4 units | assessment column merged, mostly unknown |
| English | 56 | 31 | none | organised by competency, not chapters |
| Computer Science | 18 | 17 | 6 units | few but broad outcomes, detail is in bullets |
| Urdu | 31 | 25 | none | transcribed by hand, skills not chapters |
| Islamiyat | 54 | 54 | 7 strands | transcribed by hand |

**646 outcomes across all nine subjects.**

### Urdu and Islamiyat were transcribed, not parsed

Their PDFs draw the right glyphs and report the wrong code points, so every extractor returns
scrambled text and no parser setting fixes it. Reversing it recovers some words and mangles others.
Four documents were tried and all four fail. But the pages render perfectly legibly, so they were
read off the rendered images by hand into `data/fbise/urd.json` and `data/fbise/isl.json`.
`content:build` detects those two files and leaves them alone rather than overwriting them.

Three things that transcription found, which no parser would have:

- **Urdu's listening and speaking skills are wholly formative.** The board assesses them in class
  and neither ever appears on the annual paper. Writing exam questions for them would waste a
  student's time. The examinable subject is reading, writing and grammar.
- **Urdu has no chapters.** It is five مہارتیں (skills), each with benchmarks. The app should
  present it as skills to practise, not chapters to read.
- **Tarjuma Quran is a separate 50 mark paper**, not part of Islamiyat compulsory. Islamiyat itself
  is 100 marks over 3 hours, with a compulsory 20 mark MCQ section. Its 7 strands carry paper rules
  worth respecting: strand 6 takes no MCQs at all, and the Asma-e-Husna get exactly two.

Islamiyat publishes no SLO codes, only strands and topics, so the codes in `isl.json` are ours and
`codeSource: "assigned"` says so on the file. Never show them to a student as board codes.
`data/fbise/isl-asma-ul-husna.json` holds the 37 names with their meanings, which is a finished
flashcard deck needing no generation at all.

## Corrections this made to the app

The chapter lists in `packages/core/src/content.ts` were approximations and three were wrong:

- **Mathematics had 10 chapters; FBISE examines 17.** Parallelograms and Triangles, Line and Angle
  Bisectors, Sides and Angles of a Triangle, Ratio and Proportion, Pythagoras' Theorem, Theorems
  Related with Area and Practical Geometry were all missing.
- **Pakistan Studies had 6 chapters; FBISE examines 4.** Constitution and Government, Economy of
  Pakistan, and Population and Society are Class 10.
- **Islamiyat had 6 chapters; FBISE examines 7 strands.**
- **Computer Science had a different board's syllabus**: Problem Solving, Binary System, Designing
  Website. The FBISE units are Fundamentals of Computer, Fundamentals of Operating System, Office
  Automation, Data Communication, Computer Networks, and Computer Security and Ethics.

**Mathematics numbering.** Class 9 and Class 10 share one numbering, so Class 9 is units 1-7, 14,
15, 17-23 and 29. Our chapter list is positional, and the board's number is kept alongside it in
`chapters.board_unit` and in `data/fbise/math.json`. A student looking for "Unit 22 Pythagoras"
needs to recognise it.

## One thing the board got wrong

`M-09-A-01` in the Mathematics framework reads "Explain, with examples, that civilizations
throughout history have systematically studied living things", filed under the content area "Real
Numbers". That is a Biology outcome in the Mathematics document. It is reproduced as printed rather
than quietly corrected, because the parse should match the source. Skip it when generating.

## Review status

Nothing generated reaches a student without a person passing it.

- `subjects` and `chapters` are structure and the structure is the board's, so `--publish` writes
  them as published.
- Everything with prose in it goes in as **`draft`** and no RLS policy will serve it. The database
  gate is `review_status = 'published'` and nothing else. There is no insert or update policy on
  any content table at all: ingestion runs under the service role, which bypasses RLS. A student
  who could write an MCQ could write its answer key too.

## Where the apps read from

Both apps now read content from Postgres through `packages/core/src/db.ts`, with the bundled
content in `packages/core/src/content.ts` as the fallback. No screen changed: they all still call
`api.getChapter` and friends, which is what that seam was for.

Reads degrade in three steps, and never to a blank screen: live rows, then the last good answer,
then the bundle. A student on two bars gets a chapter, not a spinner.

Medium is app state rather than a per-call argument. It is set once from the profile with
`setContentMedium`, and Urdu falls back to English **per resource**, so a translated chapter whose
flashcards are not translated yet still reads in Urdu.

`npm run db:migrate` applies the schema (there is no Supabase CLI on this machine and the direct
database host is IPv6-only, so it goes through the Mumbai pooler). `npm run content:verify` proves
the round trip: that every column `db.ts` names in a string still exists, and that a signed-out
visitor can reach nothing. A renamed column is not a type error anywhere, it is an empty list
quietly swallowed by the fallback, so it needs a real query to catch.

## What is not done

- **Generation, and this is the one that matters.** `content:verify` reports **0 published sections
  and 0 published questions**, so the apps still render the bundled sample. The outcomes are in
  place; the notes, questions, flashcards and short questions written against them are not. That is
  a one-off Claude pass, costed in the low thousands of rupees, and it lands as draft. Until it
  runs, the plumbing is real and the content is not.
- **Urdu medium for the other seven subjects** is not blocked. Schema, ingestion and fetch layer all
  carry `medium` already; the Urdu content is written by the generator, not extracted.
- **Mapping outcomes to chapters.** `curriculum_slos.chapter_id` is null everywhere. The board's
  2022-23 domains do not line up one-to-one with the 2006 units, so this needs a human pass rather
  than a fuzzy match that would look right and be wrong.
- **Past papers**, deferred by the client.
