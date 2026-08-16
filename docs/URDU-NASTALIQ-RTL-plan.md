# Urdu in Nastaliq, and a right-to-left app

Research for the client's request: when Urdu is the app language, the app should be written in real
Urdu, in Nastaliq, and laid out right to left. Written 16 Aug 2026, after the language merge landed.

Nothing in here is built yet. It is a survey of what exists, what is missing, and what each piece
costs, so the work can be approved in stages instead of all at once.

---

## What already works

Worth knowing before reading the cost estimates, because it is most of the hard part.

**The study material is already real Urdu.** Every Urdu-medium row in the database is in Urdu script,
not Roman: chapter sections, MCQs, flashcards and short questions all sampled 200 of 200 in Urdu
script. Nothing needs regenerating and no model spend is involved.

**Both apps already render Nastaliq.** The website loads Noto Nastaliq Urdu as a web font and the
Android app bundles it through `@expo-google-fonts/noto-nastaliq-urdu`. There is an `Ur` component in
each app, a `ScriptText` that picks the face from the text itself, and a shared `isUrduScript()` test
in `packages/core`. The reader, the AI answers, subject names, list bullets and quote bars already
flip to Nastaliq and right-to-left per element when the text is Urdu.

So the question is not "can we render Nastaliq". It is "what is still in Roman, and what does the
page layout do around it".

---

## Gap 1 · The app's own words are Roman Urdu

All 727 Urdu interface strings in `packages/core/src/i18n/strings.ts` are Roman: "Jaari rakhein",
"Ho gaya", "Cancel karein". Not one is in Urdu script. That is roughly 3,800 words across 22 groups
(onboarding, billing, the reader, the tutor, settings, and so on).

This is the client's actual complaint. A student on an Urdu account reads Nastaliq notes inside a
Roman-Urdu app.

**Cost:** small in money, real in review time. The translation itself is one model pass over about
3,800 words, well under a dollar on the client's key. The work is in the checking.

**How I would do it.** Translate group by group rather than in one shot, with a fixed glossary so the
same idea keeps the same word everywhere (one word for "chapter", one for "practice", one for
"streak"). Technical and brand terms stay in Latin the way Pakistani classrooms actually write them:
FBISE, MCQ, PDF, XP, English, WhatsApp. Then a machine check that every one of the 727 keys still
exists, that the 123 strings carrying `{name}` `{n}` `{chapter}` placeholders still carry exactly the
same ones, and that no em dash crept in. The i18n layer falls back to English per key, so a missed
key degrades to English rather than showing a raw `account.settingsTitle` to a student.

The part I cannot automate is judgement: exam-prep copy for fourteen-year-olds should read like a
Pakistani teacher wrote it, not like a translation. I would put the finished Urdu in front of the
client, or anyone who reads Urdu, before it ships.

**Two decisions the client should make:**

1. **Digits.** `۱۲۳` or `123`? Pakistani schoolbooks and boards use Latin digits for marks and
   numbers, and 38 strings contain digits. My recommendation is Latin digits, and it is also the
   cheaper answer, since scores, timers and prices all come from code.
2. **Loanwords.** Urdu speech in Pakistan is full of English: "practice", "test", "download".
   Formal Urdu would say "مشق", "امتحان", "ڈاؤن لوڈ". I would keep everyday app words in the register
   students actually speak and reserve formal Urdu for headings and instructions, but this is the
   client's call about how the product should sound.

---

## Gap 2 · Subject and chapter names are still English

In Urdu mode a student sees Nastaliq notes under an English heading, because the names were never
translated:

| | Has an Urdu name | Total |
| :-- | --: | --: |
| Subjects | 2 | 9 |
| Chapters | 22 | 157 |

The 22 are Islamiat and Urdu, whose names are natively Urdu anyway. Physics, Chemistry, Biology,
Maths, English, Pakistan Studies and Computer Science have no Urdu name at all, and neither do their
135 chapters.

The database columns already exist (`subjects.urdu_name`, `chapters.urdu_title`) and both apps
already prefer them when the language is Urdu. So this is a content job, not a code job: translate
135 chapter titles and 7 subject names, review them, write them in. Chapter titles are board
terminology, so they should follow the FBISE Urdu-medium textbooks rather than being freely
translated.

Without this, the Nastaliq work will still look half-finished on every subject and chapter screen.

---

## Gap 3 · The AI is explicitly told to write Roman Urdu

Three places, and the first is a single line:

- `apps/web/app/api/ai/coach/route.ts:79` instructs the model, in as many words, *"Write in Roman
  Urdu, technical terms in English."* That is the weekly coach card on both dashboards.
- `apps/web/app/api/ai/tutor/route.ts:133` tells the tutor to match the student's register, "if they
  write in Urdu or Roman Urdu, answer in the same register". So an Urdu-account student who types in
  Roman gets Roman back.
- `apps/web/app/api/ai/check-answer/route.ts:57` marks short answers "in the same language the
  student wrote in", with the same effect.

The fix is to pin these to the account language rather than to what the student happened to type:
on an Urdu account, answer in Urdu script, keep technical terms in Latin. It is three prompt edits
and it is the cheapest visible win in this whole document. The answers already render in Nastaliq
once they arrive in Urdu script, because the markdown renderer detects the script itself.

---

## Gap 4 · The layout does not mirror

This is the only genuinely structural piece.

Today the two apps flip individual pieces of Urdu text to right-to-left. The page around that text
stays left-to-right: the back arrow, the sidebar, the row chevrons, the progress bars, the tab bar.

One thing to get out of the way first, because it changes what to worry about. Real Urdu is
**shorter** than the Roman Urdu it replaces, not longer. On a hand-translated sample of the twenty
most common UI strings, the character count drops to 0.82 of the Roman. So horizontal overflow is not
the risk. The risk is vertical: Nastaliq needs roughly twice the leading of Latin and its ink hangs
below the baseline, so anything with a fixed height clips the descenders. There are not many, and
they are all in the shared primitives:

- `apps/mobile/src/components/ui.tsx:1046`, the segmented control, `height: 36` with
  `overflow: 'hidden'`. This is the language switch itself, so its own Urdu label would be the first
  thing to clip. The `overflow: 'hidden'` is also the pattern behind the blank example boxes we fixed
  on Android last week, so it wants removing here too.
- `apps/mobile/src/components/ui.tsx:900`, the tab bar, `height: 72` for icon plus label.
- `apps/mobile/src/components/ui.tsx:590` and `:603`, `lineHeight: 36` pinned on text.
- `apps/web/components/ui/controls.tsx:273`, a 26px pill, and `primitives.tsx:506`, a 42px control.

Everything else uses `minHeight`, which grows. So the fix is a handful of primitives, not a sweep.

### The website: mostly free, then a mechanical sweep

Setting `dir="rtl"` on the page makes the browser do most of the work. Flexbox rows reverse, grid
columns reverse, `text-align: start` follows, scrollbars move. The two-column shell in
`components/app/Page.tsx` is a CSS grid, so the work column and the rail swap sides on their own.

What does not follow automatically is anything written as a physical direction rather than a logical
one. A count of the whole web app:

| | Uses |
| :-- | --: |
| `border-l` / `border-r` | 88 |
| `text-left` / `text-right` | 17 |
| `ml-` / `mr-` / `pl-` / `pr-` | 14 |
| `left-` / `right-` | 16 |

About 135 class names, each with a direct logical equivalent in Tailwind v4 (`border-s`, `text-start`,
`ms-`, `start-`). That is a mechanical sweep with a real risk of over-applying it: a left border that
means "this quote is indented" should flip, a left border that means "this column divider" should
not. It needs reading, not sed.

Two things the sweep will not catch:

- **The root element is hardcoded.** `apps/web/app/layout.tsx:97` renders `<html lang="en">` with no
  `dir`. The language currently lives in `localStorage`, which the server cannot read, so the first
  paint would be left-to-right and would visibly flip after hydration on every cold load. The fix is
  to write the language to a cookie when it changes and read that cookie in the root layout. Small,
  but it has to be done or the flip is visible on every page load.
- **The Nastaliq font is deliberately not preloaded** (`layout.tsx:39-45`), because at 240KB it was
  wrong to push on English students who never render an Urdu glyph. Once the entire interface is
  Nastaliq for an Urdu student, that font becomes render-critical: with `display: swap` they would
  read a flash of the system Naskh, in the wrong shapes, then watch the whole page reflow. Preload
  needs to become conditional on the same cookie.

### The Android app: the harder half, but a small surface

React Native has a built-in switch, `I18nManager.forceRTL(true)`, which flips row layouts and swaps
left/right padding across the whole app. **I recommend not using it**, for three reasons:

1. It only takes effect after the app restarts. A student tapping "Urdu" in Settings would have the
   app relaunch under them.
2. It is a known weak spot in Expo. There are several open Expo issues where `I18nManager.isRTL`
   keeps reporting false under Continuous Native Generation even after RTL is forced in both the
   native and JS layers, which is exactly our build setup.
3. It is global and sticky, and it flips things that should not flip along with the things that
   should.

The alternative is to thread the direction through explicitly, from the language we already store,
and the audit says that is cheap here because the app is built from shared primitives rather than
hand-rolled rows. 45 of 49 screens compose from `components/ui`, with 119 uses of the shared `Row`
and `Item` against only 30 hand-rolled row layouts. Teach the primitives to mirror and most screens
follow for free.

The explicit surface across the whole Android app is small: 41 `textAlign`, 11 chevron icons that
point the wrong way, 9 `left:`/`right:` absolute positions, 6 border sides, 5 margins and paddings.
It also works on the web build of the same codebase, where `I18nManager` is unreliable, and it
switches instantly with no restart.

### What mirroring should *not* do

Worth agreeing up front, because getting this wrong looks worse than not mirroring at all. Numbers,
percentages, scores, timers, prices and the Latin technical terms stay left-to-right inside the
Urdu line. That is not a bug, it is how Urdu is written. Progress bars are a judgement call: I would
fill them from the right in Urdu, since they read as a line of text, but a clock icon or a chart axis
should not be mirrored.

---

## What I recommend, in order

Each stage is worth shipping on its own, and each one is visible to the client.

**Stage A · The three AI prompts.** Half an hour. Removes the one place the app is literally
instructed to write Roman Urdu, and the tutor is the feature the client demos.

**Stage B · The 727 interface strings.** The main event, and the client's actual complaint. Needs the
two decisions above (digits, loanwords) before it starts, and a human read of the finished Urdu
before it ships.

**Stage C · Subject and chapter names.** 7 subjects and 135 chapter titles, following the FBISE
Urdu-medium textbooks. Without it, stage B still leaves English headings over Urdu notes.

**Stage D · Right-to-left layout.** The website first, since `dir="rtl"` does most of it, then the
Android app through the shared primitives. This is the one that needs real screen-by-screen checking
on a device, all 49 mobile screens and 51 web routes, and it is where the schedule risk lives.

My suggestion is to do A now, get the client's answers on digits and loanwords, then B and C
together so the client sees one complete Urdu app rather than half-translated screens, and treat D as
its own milestone.

