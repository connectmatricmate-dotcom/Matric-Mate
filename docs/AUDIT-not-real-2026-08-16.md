# Audit · what is static, fake, or non-functional (16 Aug 2026)

Covers both apps and the marketing site. Every item below was read in the source; the ones marked
**verified** were additionally confirmed by running a query or reading the exact lines.

---

## 1. Blockers: a user cannot do the thing, or we say something untrue about money

| # | What | Where | Detail |
| :-- | :-- | :-- | :-- |
| 1.1 | **New students cannot choose Class 10** (verified) | `apps/mobile/app/onboarding/class.tsx:32-36`, `apps/web/components/onboarding/ChooseClass.tsx:35-39` | The card is hardcoded `disabled` with a "Class 10 comes after the Class 9 launch" toast, although `GRADE_10_READY` is now `true` and all 70 SSC-II chapters plus audio are live. Only existing accounts can reach Class 10, via Settings, which costs them a full progress wipe and a 7-day cooldown. |
| 1.2 | **Arts students can never finish signup** (verified) | `apps/web/components/onboarding/ChooseSubjects.tsx:22,26,48`, `apps/mobile/app/onboarding/subjects.tsx:51` | Choosing Arts sets `picked = ['cs']` and the only Arts elective offered is Computer Science, but Continue needs two. The button stays disabled reading "Pick two" forever. The only escape is to claim to be a Science student. |
| 1.3 | **Checkout will tell paying customers no money is being taken** (verified) | `apps/web/components/commerce/CheckoutForm.tsx:139,228`; `strings.ts:180,197` | The copy branches on `isConfigured` (are Safepay keys present) and not on `SAFEPAY_ENV`. Sandbox keys are present today, so the wording happens to be true. The day production keys go in, `live` stays true and the page still says "Test payment: no real money moves in this preview" directly above the pay button. |
| 1.4 | **Delete-account page describes a control that does not exist** (verified) | `apps/web/app/delete-account/page.tsx:33-36` | "Sign in, open Profile, then Settings, then Delete account." There is no delete control in either app, and `/account/settings` now redirects to `/account`. This is a Play Store compliance page. |
| 1.5 | **Four pages tell users to cancel; there is no cancel control** (verified) | `app/page.tsx:80`, `app/pricing/page.tsx:42`, `app/terms/page.tsx:29`, `app/refunds/page.tsx:15` vs `SubscriptionView.tsx:104` | The subscription screen deliberately omits cancel (plans are one-off, nothing recurs) and says so in a comment. The marketing copy was never updated to match. |
| 1.6 | **A price and payment methods are rendered inside the Android app** | `strings.ts:816` shown at `apps/mobile/app/account/help.tsx:10` | FAQ 1: "Profile → Subscription → Renew now. JazzCash, Easypaisa or card. Rs 1,000 for a month." `packages/core/src/billing.ts:19-24` exists specifically to prevent this, and the navigation path it describes does not exist. Play policy risk. |
| 1.7 | **Payments are in sandbox** (verified) | `apps/web/.env.local` `SAFEPAY_ENV=sandbox` | No real money can move until this is switched and live keys are set in Vercel. |

---

## 2. Fabricated data presented as real

| # | What | Where |
| :-- | :-- | :-- |
| 2.1 | Landing page confidence statistics, animated with a count-up so they read as live data: "Certain 91%, said 96×", "Fairly sure 68%, 74×", "Guess 39%, 41×", plus the pull-quote "When you say you're certain, you're right 91% of the time". | `apps/web/app/page.tsx:289-313` |
| 2.2 | Landing page report card: fixed month "June", overall A−, per-subject grades, "22 active days", "9 tests". | `apps/web/app/page.tsx:396-437` |
| 2.3 | Two contradictory popularity claims, both invented: "Most students pick monthly" on the homepage, "Most students pick this" on the 3-month plan on `/pricing`. | `app/page.tsx:456`, `lib/plans.ts:42` |
| 2.4 | The "genuine board paper" excerpt is authored mock content headed "FEDERAL BOARD SSC-I EXAMINATION / PHYSICS · 2025". Its own source file is titled MOCK CONTENT. | `app/page.tsx:341-366`, `packages/core/src/content.ts:1,634-638` |
| 2.5 | **Website invents your study time** (verified): `questions × 1.6 + sections × 4` minutes, shown as "1h 16m" in the greeting and as a "study time" KPI. Nothing times a session. Worse, questions are filtered to 7 days but sections are all-time, inside a line that says "this week". Mobile was already fixed to show real active days. | `DashboardView.tsx:47`, `ProgressView.tsx:27,52` |
| 2.6 | **Wrong exam weightage on Maths** (verified in the database): math-1 "Matrices and Determinants" displays "30% of the paper · 41 marks" while its own blurb says the current syllabus does not test it. math-2 shows 53%, math-3 shows 17%. These are the three domain rollups (Numbers and Algebra, Geometry, Information Handling) mis-assigned to chapters 1, 2, 3 by number. | `data/fbise/chapters.json`, ingested by `scripts/ingest-content.mjs:207` |
| 2.7 | **Weightage coverage is patchy** (verified): Class 9 has weights on 3/17 maths, 1/8 Pak Studies, 0/7 Islamiyat, 3/8 Urdu, 3/8 English, 16/20 Chemistry. Class 10 is complete except English, Islamiyat and Urdu, which have none. The client specifically asked for this feature. | `chapters.exam_share` |
| 2.8 | "FBISE papers from 2019 onwards" and the in-app "FBISE 2019–2025" tile. The catalogue holds 2023, 2024 and 2025 only, nine papers. | `app/page.tsx:332`, `strings.ts:408` |

---

## 3. Features the UI promises that do not exist

| # | What | Where |
| :-- | :-- | :-- |
| 3.1 | **The notification inbox can never fill** (verified). The bell, the unread badge, the screen and "mark all read" all exist, but nothing in either app ever creates a notification. The empty state promises "We'll remind you about your plan, streaks and report card". | `apps/mobile/src/store/app.tsx:146`, `apps/web/lib/persisted-store.ts:87`, `strings.ts:282` |
| 3.2 | Study reminder and streak alert toggles are pinned off with a "coming soon" toast; the sub-line still advertises "Daily · 7:00 PM", a hardcoded default with no editor. `expo-notifications` is not even a dependency. | `AccountView.tsx:196-221`, `apps/mobile/app/account/index.tsx:194,201` |
| 3.3 | Dark mode toggle, pinned off. `settings.dark` is stored and read by nothing. | `AccountView.tsx:227`, `apps/mobile/app/account/index.tsx:183` |
| 3.4 | **Mobile Share and Save-as-PDF buttons do nothing but toast a lie**: "Share sheet sends the card as an image" and "Opening the print dialog". No share API, no print module. The web versions are real. | `apps/mobile/app/insights/report.tsx:106,109` |
| 3.5 | "Parents can view a shared card without an account" and the FAQ that repeats it. There is no public shared-card route; web sharing opens WhatsApp with a plain-text line of grades. | `strings.ts:728,822`, `ReportCard.tsx:100-109` |
| 3.6 | WhatsApp support is promised in roughly eight places (footer, pricing, terms, refunds, delete-account, help). There is no number, no `wa.me` link, and no phone number is ever collected at signup. Refunds and deletion both ask for "the mobile number on the account". | `SiteFooter.tsx:69`, `app/pricing/page.tsx:47`, `app/terms/page.tsx:49,54`, `app/refunds/page.tsx:38,45` |
| 3.7 | "We remind you two days before your plan ends" appears on pricing, terms, checkout and the subscription screen. There is no cron, no email provider and no scheduled job. | `app/pricing/page.tsx:30,120`, `strings.ts:773` |
| 3.8 | The Android app is sold on every marketing page ("offline downloads in the Android app", "one account across both") with **no download link, badge or APK anywhere**. | `app/page.tsx:50,64,76`, `app/pricing/page.tsx:23,24,42` |
| 3.9 | Chat thumbs up/down set local state and toast "Noted, we'll improve this answer". Nothing is recorded anywhere. | `ChatScreen.tsx:262-289`, `apps/mobile/app/tutor/chat.tsx` |
| 3.10 | Payment history rows toast the Safepay reference for two seconds instead of showing it; the footnote says you can quote it to support. No receipt view or invoice. | `PaymentsView.tsx:73`, `strings.ts:784` |
| 3.11 | The timed test claims "one pause allowed" and "the timer keeps running if you leave". Neither is implemented; leaving and returning restarts the clock at 30:00, and a refresh destroys the session. | `ExamIntro.tsx:86,98`, `ExamScreen.tsx:53-56` |
| 3.12 | Terms row in Android settings toasts an internal engineering note, "Legal pages ship with the landing page", instead of opening the terms that do exist on the web. | `apps/mobile/app/account/index.tsx:228` |

---

## 4. Wrong or inconsistent numbers

| # | What | Where |
| :-- | :-- | :-- |
| 4.1 | **AI quota is stated three ways**: 50 on the homepage, 20 in the pricing comparison table, 20 in the plan perks rendered on the checkout page itself. The truth is 50. The checkout number is the legally operative promise. | `app/page.tsx:469`, `app/pricing/page.tsx:21`, `lib/plans.ts:85` |
| 4.2 | **Double XP is displayed but not credited on the website** (verified). The result screen shows `base × 2` for a timed test; the store adds the un-multiplied total. Mobile applies the multiplier correctly, so the two apps disagree. | `ResultScreen.tsx:28-30` vs `lib/store.tsx:156,174`; mobile `app.tsx:487` |
| 4.3 | Chapter progress can exceed 100%. When `sectionCount` is 0 the divisor collapses to 1, so five read sections render as "350% complete", and that value averages into "Syllabus covered". | `packages/core/src/domain.ts:161-171` |
| 4.4 | A free account sees the AI ring as "0/0" and the message "Your plan includes 50 a day", because the copy keys off `limit === 0`. | `apps/mobile/app/(tabs)/tutor.tsx:68-72,121-131` |
| 4.5 | AI cost notes hardcode the number 50 rather than the account's real limit. | `AiTestScreen.tsx:146`, `PaperScreen.tsx:74`, `apps/mobile/app/tutor/ai-test.tsx:155`, `paper.tsx:64` |
| 4.6 | Two support addresses, one with a wrong domain: `help@matricmate.pk` on most pages, `help@matricmate.com.pk` on refunds and delete-account. The mobile "report a problem" button mails a third address, `connect.matricmate@gmail.com`. | `SiteFooter.tsx:63`, `app/refunds/page.tsx:38`, `apps/mobile/app/account/help.tsx:47` |
| 4.7 | Subscription screen hardcodes Rs 750 in "from Rs X a month" instead of deriving it from the plans. | `SubscriptionView.tsx:112` |

---

## 5. Content gaps

| # | What |
| :-- | :-- |
| 5.1 | **Seven Class-9 chapters are hidden** (verified): English 5, 6, 7, 8 and Urdu 6, 7, 8 sit at `draft`. English shows 4 of 8 chapters, Urdu 5 of 8. Their English text exists in the database but was never published, and no Urdu version was written. |
| 5.2 | Five Class-9 chapters are published but deliberately empty (math 1, 10, 13, urd 4, 5), labelled "Not on the Class 9 paper". By design. |
| 5.3 | **Past papers and topper scripts are Class-9 only** and are not filtered by grade, so a Class-10 student is shown SSC-I papers as theirs. `fbisePastPapers()` hardcodes `classLevel === 9`. |
| 5.4 | The "Not on the Class 9 paper" pill and the welcome slide "for FBISE Class 9" are shown to Class-10 students. |
| 5.5 | Every offline/bundled fallback is Class-9 data. A Class-10 student on a slow connection is silently served the Class-9 catalogue. |
| 5.6 | Urdu-medium students get English notes on every server-rendered page, because the medium lives in module state that only the client sets. The banner "Urdu notes for every chapter are on the way" then shows on effectively every chapter, even where Urdu exists in the database. |

---

## 6. Silent fallbacks that fabricate a working app

| # | What | Where |
| :-- | :-- | :-- |
| 6.1 | Any live query that errors, returns empty, or takes over 4 seconds silently falls back to bundled sample content, logged only in development. In production nothing records that it happened. | `packages/core/src/db.ts:193,217,229` |
| 6.2 | **Bundled MCQs answered offline are synced as real attempts**, permanently polluting weak-topic analytics with `phy-3` rows. | `db.ts:576-585` |
| 6.3 | On the bundled fallback every chapter reports zero sections, MCQs and cards, so `hasStudyMaterial()` is false and a paying subscriber is told the entire product is empty. | `content.ts:206-216`, `domain.ts:47` |
| 6.4 | `primeAllContent` fetches chapters without the count aggregates and overwrites good counts with zeros; it runs unawaited at module load, so it can cause 6.3 on a perfectly good connection. | `db.ts:336-341` |
| 6.5 | **Two bundled chapters credit progress to the wrong chapter** (verified): Chemistry 3's sections carry `chem-2-*` ids and Biology 3's carry `bio-4-*`. | `content.ts:486,539` |
| 6.6 | The server-side content cache is keyed without grade or user, so a cached Class-9 chapter list can be served to a Class-10 request, bypassing the RLS grade filter. | `db.ts:160,355` |
| 6.7 | A failed sync write is dropped and logged only in development, so a student can silently lose answers. | `sync.ts:159-164` |

---

## 7. Prototype language still shipping

| # | What | Where |
| :-- | :-- | :-- |
| 7.1 | "Typical reply time **in the live app**: under two hours" in both help screens. | `strings.ts:826` |
| 7.2 | "In the live app the AI writes fresh questions… and an admin approves them" on the AI test screen. No admin approves anything; generation publishes directly by the client's instruction. | `strings.ts:676` |
| 7.3 | The public Terms page states "in the sandbox environment no real money moves". | `app/terms/page.tsx:15` |
| 7.4 | "Reset app data" is keyed `account.resetDemo` and sits in production settings, wiping server history. | `AccountView.tsx:238` |
| 7.5 | The audio footnote claims "This chapter has a full recording in both mediums" whenever any single track exists, so it can send a student to a medium that was never recorded. Audio is machine text-to-speech throughout, described as "recorded" and "narration". | `strings.ts:366`, `scripts/generate-audio.mjs` |
| 7.6 | "This copy of the app was built before audio support was added" is permanently mounted on the legacy player. | `strings.ts:370` |

---

## 8. Smaller, still visible

- **"Today's plan" never resets** (verified). Task ids carry no date and `planDone` is never cleared, so it reads "3/3 done" every day forever. Its labels invent quantities: "15 min" for every chapter, "10 cards" for a deck of any size.
- The plan can schedule the five chapters the app knows are empty, and for a Class-10 student defaults to the Class-9 id `phy-1`.
- **Blank reader for locked chapters on the web**: no entitlement check, so the article area renders nothing at all, the pager says "Section 1 of 1", and Finish still toasts "Progress saved".
- Locked practice tiles on mobile are silent dead taps, while locked chapters correctly open an explanation sheet.
- The dashboard bypasses the paywall entirely: quick actions and plan tasks push straight into sessions that then dead-end on a bare toast.
- "Fill in the blanks" and "Short questions" are recorded as attempt *topics*, so they appear in Weak Topics as if they were syllabus topics, and switching language forks them into duplicates.
- Editing class, medium or subjects from the profile drops the user into the onboarding wizard, which does not preload their current values and overwrites their subject list with the science defaults, then ends on the dashboard with no way back.
- That path also bypasses `switchClass`, so it skips the server check, the cooldown and the history wipe that the warning sheet promises.
- The profile footnote says "Your old progress is kept" while the class-switch sheet correctly says everything is cleared.
- Settings never sync: avatar, language, medium and font size live only in local storage, so a second device loses them, against the "one account, both surfaces" promise.
- `/onboarding` and `/certificates` are not route-protected; a signed-out visitor can walk the wizard and see the app shell.
- Board choice is a click-through: Punjab is disabled everywhere while onboarding advertises "BISE Lahore, Rawalpindi and others".
- No Open Graph image, so every WhatsApp share of the site is a bare link.
- Marketing pages and error screens are English only, while the homepage advertises a Roman-Urdu interface.
- The landing page audio sample has no error handler; if the file or env var is missing the play button silently does nothing.
- Certificates contains exactly one row, the watermarked "Sample Teacher" dummy.
- Fourteen accounts exist in the production database, most of them test junk; `demo@matricmate.pk` has no plan, so anyone testing with it hits the paywall.
- Dead code worth deleting: `api.pay()` (a mock Safepay that mints fake references and grants 30 days), `mockTutor`, `XP.streakDay` (never awarded), `TestResult.attemptIds` (always empty), `CAN_SELL_IN_APP` and `GRADES` (zero call sites), and roughly twenty orphaned i18n strings.
- Streak days are computed on UTC boundaries, so a Pakistani student studying after midnight is credited to the previous day.

---

## Suggested order of work

1. Class 10 at signup, and the Arts dead end. Both block real students today.
2. Checkout wording keyed to `SAFEPAY_ENV`, plus the delete-account and cancel instructions. Money and store compliance.
3. The price and payment methods inside the Android FAQ.
4. Landing-page fabrications: statistics, report card, popularity pills, "papers from 2019", the mock paper excerpt.
5. The 20-vs-50 quota, double XP, and the invented study time.
6. Maths weightage, and the missing weights on Islamiyat, Urdu and English.
7. Notifications, reminders and the toast-only share buttons: either build them or remove the promises.
8. The seven hidden Class-9 chapters, and grade-awareness for past papers and toppers.
