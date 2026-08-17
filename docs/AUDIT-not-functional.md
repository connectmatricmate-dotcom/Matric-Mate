# What is not real yet

Everything in both apps that a student can see or press today and that does not
do what it appears to do. Written 17 Aug 2026, after the Urdu release, the
payment rework and the AI fixes.

Method: searched for unfinished markers, controls whose whole handler is a
toast, settings that are stored but never read, links to routes that do not
exist, and tables that nothing ever writes to. Then checked the live database
for placeholder rows. Findings are grouped by how much they cost the client.

**The good news first**, because it narrows the list. There are no TODO or
FIXME markers anywhere in either app. No dead links: every route both apps
navigate to exists. All 157 chapters have published notes, MCQs, flashcards,
blanks and short questions in both mediums. All 4,283 MCQs are well formed: no
bad option counts, no out-of-range answers, no duplicate options, no missing
explanations. No orphaned rows. Downloads write real files. Past papers and
topper scripts point at 32 real fbise.edu.pk URLs. XP, streak, weekly stats,
weak topics and the report card all compute from real answers.

---

## 1. A sample teacher is on both dashboards

The clearest one, and the most visible, because the client asked for this
section specifically.

The `certificates` table holds exactly one row:

```
teacher: "Sample Teacher"
title:   "Physics · Government Model School, Islamabad"
bio:     "A sample entry so the roster can be previewed. Real teacher
          verifications replace this once certificates arrive."
```

Both dashboards show the "Teacher verifications" card whenever the count is
above zero, so every student sees it and can open it onto a fictional teacher
at a real-sounding school. The card was written to appear only once real
certificates exist; the sample row defeats that.

**Options:** delete the row, so the card correctly hides until real
verifications arrive. Or replace it with a real one. Either is minutes of work.
What should not stay is a fabricated teacher presented as a verification, which
is exactly the kind of thing the earlier audit was about.

## 2. Today's plan does not travel between devices

The plan itself is deterministic, so a student sees the same tasks on their
phone and their laptop. The ticks are not: `planDone` is the one piece of study
state that never syncs. Everything else does (answers, results, sections read,
cards known, active days, and XP, which is recomputed from them).

Tick three tasks on the phone, open the laptop, and all three are unticked.

**Fix:** add `plan_done` to the sync queue and the hydrate reader, alongside
the five kinds already there. It follows an established pattern in
`packages/core/src/sync.ts`, so it is small.

## 3. Four controls that do nothing when pressed

All on Android. Each shows a toast and changes nothing.

| Control | Where | What happens |
| :-- | :-- | :-- |
| Dark mode | Settings | Toggle never latches, toast says "coming soon" |
| Study reminder | Settings | Toggle never latches, toast says "coming soon" |
| Streak alerts | Settings | Toggle never latches, toast says "coming soon" |
| Terms and privacy | Settings | Toast; the website has a real /terms page |

The toggles are honest in that they refuse to latch, so nobody is told a
setting is on when it is off. They are still four rows that lead nowhere.

Terms is the odd one out: the page exists on the website, so this is a missing
link rather than a missing feature.

## 4. Report card sharing works on the web and not on Android

The same screen, two different behaviours.

- **Web:** the WhatsApp button opens a real share with a composed summary of
  the month; Save as PDF calls the print dialog. Both work.
- **Android:** both buttons show a toast and do nothing.

This is the parity gap most likely to be noticed, because the report card is
the screen built for showing a parent.

**Fix:** `expo-sharing` for the share, and either `expo-print` or the same
summary text through the share sheet for the PDF.

## 5. Notification inbox can only ever hold payments

The table allows four kinds: `streak`, `reminder`, `report`, `payment`. Only
`payment` is ever written, by the webhook. So the inbox is real, and works, but
three quarters of what it was designed for never arrives. There are five rows
in it today, all payments.

Tied to item 3: streak and reminder notifications need scheduling to exist
before they can be delivered, and `expo-notifications` is not installed.

## 6. Settings that are stored and never read

`reminders`, `streakAlerts` and `reminderTime` persist correctly and are read
by nothing except the controls that set them. `dark` is read by nothing at all,
not even a control.

Harmless in itself, but it means the settings screen implies four capabilities
the app does not have.

## 7. Dead code left by the paywall

The mobile dashboard still branches on `!state.premium.active` to show the
free-tier notice. Unpaid accounts are now redirected to `/upgrade` before the
tabs render, so that branch can no longer execute. Worth removing so the next
person does not maintain it.

The `account.whatsapp` and `account.whatsappToast` strings are also now unused:
neither app renders a WhatsApp row any more. Support is email only, on both, and
the copy elsewhere no longer promises otherwise.

---

## Deliberately not built

Not defects. Recording them so they are not rediscovered as bugs.

- **Punjab Board** is offered at onboarding and marked "coming soon". Only
  FBISE content exists.
- **No free tier.** Every account needs a plan; the paywall is the client's
  decision, not an omission.
- **The Android app cannot take a payment.** Google Play requires its own
  billing for in-app digital purchases, so the app copies a link to the website
  instead. The trade-off is written up in `LockedNotice.tsx`.
- **Audio for five Class 9 chapters** was missing because those chapters had no
  text when the audio ran. Filled: 314 published tracks now, every chapter in
  both mediums, none with a missing file or zero length.

---

## Suggested order

1. **The sample certificate.** Fabricated content in front of every student,
   and a one-line fix.
2. **Report card share and PDF on Android.** A visible promise that does
   nothing, on the screen meant for parents.
3. **Today's plan syncing.** Silent, and it undermines "one account, every
   device".
4. **The four dead controls.** Either build them or take them out; a settings
   screen of things that do not work costs trust on every visit.
5. **Streak and reminder notifications**, which is the largest piece and the
   only one needing a new dependency.
