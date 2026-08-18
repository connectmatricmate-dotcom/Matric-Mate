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

## 3. Four controls that do nothing when pressed · FIXED

All were on Android. Each showed a toast and changed nothing.

| Control | Now |
| :-- | :-- |
| Dark mode | A real theme on both apps. Second palette in core, getters on Android, variable overrides on the web. |
| Study reminder | Latches, syncs to the account, and is read by the evening job that writes the nudge. |
| Streak alerts | Same, and outranks the plain reminder when a streak is actually at risk. |
| Terms and privacy | Opens the website's /terms. No price and no checkout on that page, so it stays inside the Play rules. |

One thing was worse on the website than on Android: its reminder switches
latched and persisted, so they looked on while doing nothing, which is the
trust problem the Android side had deliberately avoided by refusing to latch.

Account deletion was missing from both, which Play requires to be reachable
from inside the product. Both settings screens link to /delete-account now.

## 4. Report card sharing works on the web and not on Android

The same screen, two different behaviours.

- **Web:** the WhatsApp button opens a real share with a composed summary of
  the month; Save as PDF calls the print dialog. Both work.
- **Android:** both buttons show a toast and do nothing.

This is the parity gap most likely to be noticed, because the report card is
the screen built for showing a parent.

**Fix:** `expo-sharing` for the share, and either `expo-print` or the same
summary text through the share sheet for the PDF.

## 5. Notification inbox can only ever hold payments · FIXED, and it was worse than this

This entry understated it. The inbox did not merely lack three of its four
kinds: **neither app had ever read the table at all.** Both stores initialised
`notifications` to an empty array and no code path filled it, so the five
payment receipts sitting in the database had never been shown to anyone. Every
student saw "No notifications yet", including the ones who had paid.

Now: hydration reads the rows, marking them read is written through instead of
being undone by the next load, a broadcast trigger (migration 0020) brings one
in live, and the account row shows the unread count so the screen is findable.

All four kinds are written. `payment` by the webhook, `report` by the nightly
coach job when it writes a new card, `streak` and `reminder` by a new evening
job at 14:00 UTC (19:00 in Karachi), which is why the reminder time reads
7:00 PM. One nudge per student per night, in their own language, and only for
students who have studied in the last fortnight.

Still open: these are in-app inbox items, not phone push. Real push needs
`expo-notifications` and a rebuild.

## 6. Settings that are stored and never read · FIXED

All four are read now. They also moved off the device and onto the account
(`profiles.settings`, which existed since the first migration and had never
been written), because they describe the person rather than the screen: the
same student saw the reminder switches on in one app and off in the other, and
turning the lights off on a phone should not have to be done again on a laptop.

`profiles.settings` had no reader and no writer before this.

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

Last checked 18 Aug 2026, against the database and the code rather than from
memory. Items 2 to 6 of the numbered sections above are done, and phone push
shipped the same day.

### Ours to finish

1. **The sample certificate.** Still there, one row, "Sample Teacher · Physics ·
   Government Model School, Islamabad". Fabricated content in front of every
   student. Production data, so it is the client's call whether to delete the
   row or replace it with a real reviewer.
2. **Web push.** Android registers, receives and routes taps. The browser half
   needs a service worker, which this app does not have yet. The
   `NEXT_PUBLIC_FIREBASE_*` variables are already set for it.
3. **A picker for the reminder time.** Stored, synced, displayed, and the
   evening job really does run at the hour it names, but nothing can change it,
   so every student reads 7:00 PM.
4. **Tidy-up.** The mobile dashboard still branches on `!state.premium.active`
   for a notice an unpaid account can no longer reach, and six strings are
   orphaned: `account.whatsapp`, `account.whatsappToast`, `account.darkToast`,
   `account.termsToast`, `lang.englishHint`, `lang.urduHint`.

### Blocked on the client

5. **Verify `matricmate.com.pk` in Resend.** Until then the test sender only
   reaches the Resend account owner, so email to real students goes nowhere.
   Each DNS record must be "DNS only" in Cloudflare, never proxied.
6. **Turn on Supabase email confirmation, after pointing SMTP at Resend.** Both
   apps already have the screen and can resend. In the other order, sign-ups
   fail silently the moment the shared sender's hourly limit is hit.
7. **`help@matricmate.pk`.** One constant, `SUPPORT_EMAIL` in
   `packages/core/src/billing.ts`, currently the Gmail account because that
   mailbox certainly exists. One line to move it.
8. **WhatsApp.** Needs Meta business verification, which needs the domain live,
   plus a number never used on ordinary WhatsApp. The adapter and the consent
   record are already built.
9. **White on orange, green and red** fails AA in the *light* theme: 2.4:1,
   3.4:1 and 4.0:1. Pre-existing, untouched, because changing it moves a look
   the client has approved. Worth raising rather than deciding for them.

### Credentials to rotate

10. **The Anthropic key**, exposed in chat twice and still outstanding.
11. **The Firebase service account key**, printed to a terminal on 18 Aug while
    checking the env file. Key id `551b31697a…`. Create the replacement first,
    then delete the old one.
12. **The Resend key**, pasted into chat when it was handed over.

### Not verified by looking

13. **Dark mode on a real screen**, either app. It typechecks, builds, the
    tokens are in the compiled CSS and the server sets `data-theme` on the
    first byte. Nobody has looked at it.
14. **The notification icon on the built APK.** The asset is correct and the
    plugin is wired; the rendering has not been seen.
