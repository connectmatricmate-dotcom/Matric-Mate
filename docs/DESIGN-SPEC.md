# MatricMate — Design Spec & Screen Inventory (v1, 19 Jul 2026)

> This document + the clickable prototype (`prototype/index.html`) together replace Figma/wireframes.
> Every screen in the prototype has an id (`#screen-id` deep link) matching this spec. The Expo app
> implements this spec screen by screen; milestone tags (M1–M10) map to `contract/contract-milestones.md`.

## 1. Product, audience, voice

- **Product:** exam-prep app for FBISE Class 9 (then 10 / Punjab Board). Chapter-wise notes, audio
  lessons, flashcards, MCQs, timed exams, past papers, AI tutor, progress analytics, Rs 1,000/mo.
- **Users:** students 13–16, mobile-first, low-end Android common (design for 360dp width, light
  APK, offline); parents (report card viewing); content admin (web).
- **Voice:** clean English UI; **code-switched Roman Urdu only at emotional moments** — celebration
  ("Shabash! 🔥"), streaks, and the confidence control. Never in navigation, settings, errors.
- **Signature element:** the **Pakka-meter** — 3-step confidence pick on every MCQ:
  `Tukka 🎲` (guess) / `Thora sure` / `Pakka ✓` (certain). Stored per attempt; powers the
  confidence-vs-accuracy analytics (contract requirement). Copy rule: answers first, confidence
  second tap, then Check.

## 2. Design tokens

| Token | Value | Use |
| :---- | :---- | :---- |
| `teal` | `#096A8B` | primary actions, active nav, links, selection |
| `ink` | `#0F5064` | headings, body text, dark surfaces |
| `ink-2` | `#517682` | secondary text |
| `paper` | `#FAFBF7` | app background |
| `card` | `#FFFFFF` | cards/surfaces (border `#E4EAE6`, radius 16) |
| `teal-tint` | `#E9F2F5` | selected/back­grounds of teal elements |
| `orange` | `#F29329` | XP, streaks, progress fills, primary CTA moments |
| `orange-tint` | `#FDF1E1` | badges, plan highlights |
| `green` | `#2E9E5B` / tint `#E7F5EC` | correct |
| `red` | `#D9534F` / tint `#FBECEB` | wrong, destructive |

- **Type:** Baloo 2 (display: screen titles, numbers, tab labels), Nunito (body/UI), Noto Nastaliq
  Urdu (Urdu content, `lang="ur" dir="rtl"`, line-height ≥ 2). Scale: 26/20/17/15/13/11.
- **Shape/space:** radius 16 (cards) / 12 (inputs) / 999 (pills); spacing grid 4; touch targets ≥ 44dp.
- **Elevation:** border + `0 6px 20px rgba(15,80,100,.07)`; no heavy shadows.
- **Motion:** 180–240ms ease-out; one orchestrated moment per flow (streak pulse on first dashboard
  load, typing stream in AI chat, result count-up). `prefers-reduced-motion` → none.
- **Dark mode (M5 polish):** surfaces from ink family (`#0B2E3A` bg, `#0F3D4C` card), orange unchanged.

## 3. Navigation model

- **5 bottom tabs:** Home · Study · Practice · AI Tutor · Progress. **Profile lives in the header
  avatar** (top-right on every tab root). ⚠️ The verified diagram shows 6 tabs; 6 is over the mobile
  ergonomic limit — confirm this change with client (decision `D1`).
- Tab roots keep their own stacks (back never crosses tabs). Android back = stack pop → exits from
  tab root. Deep links: `matricmate://chapter/{id}` etc. mirror prototype anchors.
- Global patterns: pull-to-refresh on roots; offline banner slides under header; premium-locked
  rows show a lock and open the paywall sheet; every screen has loading (skeleton), empty, error,
  offline states per §7.

## 4. Screen inventory

Phone screens unless marked (web). Milestone = when it ships functional (all exist in prototype now).

| # | id | Screen | Flow | Milestone |
| -: | :---- | :---- | :---- | :---- |
| 1 | `splash` | Splash | Onboarding | M1 |
| 2 | `welcome` | Welcome carousel (3 slides) | Onboarding | M1 |
| 3 | `ob-class` | Choose class | Onboarding | M1 |
| 4 | `ob-board` | Choose board | Onboarding | M1 |
| 5 | `ob-medium` | Choose medium | Onboarding | M1 |
| 6 | `ob-subjects` | Choose group & subjects | Onboarding | M1 |
| 7 | `signup` | Create account | Onboarding | M1 |
| 8 | `login` | Log in | Onboarding | M1 |
| 9 | `forgot` | Reset password | Onboarding | M1 |
| 10 | `paywall` | Premium plan | Onboarding | M4 |
| 11 | `pay-method` | Pay with Safepay (card/JazzCash/EasyPaisa) | Onboarding | M4 |
| 12 | `pay-done` | Payment success | Onboarding | M4 |
| 13 | `dash` | Dashboard (Home) | Home | M1 nav / M4 live |
| 14 | `notifs` | Notifications | Home | M4 |
| 15 | `subjects` | Subjects | Study | M1 |
| 16 | `chapters` | Chapters (per subject) | Study | M1 |
| 17 | `chapter` | Chapter home (sections hub) | Study | M2 |
| 18 | `reader` | Notes reader (+ Ask AI sheet) | Study | M2 |
| 19 | `audio` | Audio lesson player | Study | M2 |
| 20 | `downloads` | Downloads / offline manager | Study | M2 |
| 21 | `practice` | Practice home | Practice | M3 |
| 22 | `p-setup` | Session setup | Practice | M3 |
| 23 | `mcq` | MCQ question + Pakka-meter | Practice | M3 |
| 24 | `mcq-fb` | MCQ feedback (correct/wrong) | Practice | M3 |
| 25 | `flash` | Flashcards | Practice | M3 |
| 26 | `blanks` | Fill in the blanks | Practice | M8 |
| 27 | `shortq` | Short questions (self-mark) | Practice | M8 |
| 28 | `papers` | Past papers | Practice | M8 |
| 29 | `paper-view` | Paper viewer | Practice | M8 |
| 30 | `exam-intro` | Timed exam rules | Practice | M3 |
| 31 | `exam` | Timed exam session | Practice | M3 |
| 32 | `result` | Result (score/XP) | Practice | M3 |
| 33 | `review` | Review answers | Practice | M3 |
| 34 | `ai-home` | AI Tutor home | AI | M3 |
| 35 | `ai-chat` | AI chat (streaming) | AI | M3 |
| 36 | `ai-test` | AI test generator | AI | M9 |
| 37 | `prog` | Progress overview | Progress | M4 |
| 38 | `perf` | Performance analytics | Progress | M4 |
| 39 | `weak` | Weak topics | Progress | M4 |
| 40 | `report` | Report card (shareable) | Progress | M9 |
| 41 | `profile` | Profile | Profile | M1 shell / M4 live |
| 42 | `edit-profile` | Edit profile | Profile | M4 |
| 43 | `subscription` | Manage subscription | Profile | M4 |
| 44 | `payments` | Payment history | Profile | M4 |
| 45 | `settings` | Settings | Profile | M2 |
| 46 | `help` | Help & support | Profile | M5 |
| 47 | `states` | UI states gallery (skeleton/empty/error/offline) | System | M1 |
| 48 | `web-dash` | Student web app — dashboard (web) | Web | M6 |
| 49 | `web-reader` | Student web app — reader (web) | Web | M6 |
| 50 | `landing` | Marketing landing page (web) | Web | M6 |
| 51 | `adm-login` | Admin — login (web) | Admin | M7 |
| 52 | `adm-dash` | Admin — overview (web) | Admin | M7 |
| 53 | `adm-curriculum` | Admin — curriculum tree (web) | Admin | M7 |
| 54 | `adm-editor` | Admin — chapter content editor (web) | Admin | M7 |
| 55 | `adm-mcq` | Admin — MCQ bank + AI review queue (web) | Admin | M7 |
| 56 | `adm-students` | Admin — students & subscriptions (web) | Admin | M7 |

## 5. Screen specs

### Onboarding

- **`splash`** — monogram + wordmark on paper; auto-advances (prototype: tap). Behavior: checks
  session → `dash` if logged in, else `welcome`. No spinner unless >1s.
- **`welcome`** — 3 slides: (1) "Poori tayyari, one app" — chapters/notes/audio; (2) practice —
  MCQs/flashcards/past papers; (3) AI tutor 24/7. Dots + Next; "Skip" → `ob-class`; "Already have
  an account? Log in". Slide art = brand illustration crops.
- **`ob-class`** — cards `Class 9` (active) / `Class 10` (Coming soon, disabled chip). Selection
  fills card teal-tint + check. CTA "Continue". Progress dots (step 1/4) under header.
- **`ob-board`** — `FBISE` (active) / `Punjab Board` (Coming soon). Same pattern.
- **`ob-medium`** — `English medium` / `اردو میڈیم` (card label rendered in Nastaliq). Sets content
  language default (UI stays English). Note: changeable later in Settings.
- **`ob-subjects`** — group toggle `Science / Arts` (segmented control) filters the grid; compulsory
  subjects pre-checked & locked (English, Urdu, Islamiyat, Pak Studies*, Math); electives per group
  (Science: Physics, Chemistry, Biology, Computer Science). Min 6 to continue; counter in CTA
  ("Continue with 8 subjects"). *Confirm exact FBISE-9 compulsory list with client content (D2).
- **`signup`** · Full name, **phone number**, Password (show/hide). Terms line plus a consent
  checkbox for SMS and WhatsApp. CTA "Create account". Secondary: "Log in". States: inline
  validation on blur; duplicate-account error banner. **No email field** (D3, settled 10 Aug).
  Students type `03001234567`; storage is `+923001234567`. A verification code follows.
- **`verify`** · six-digit code entry, resend with a cooldown, "Change number" back-link. Sits
  between signup and the app, and again in the middle of the password reset.
- **`login`** · phone + password, "Forgot password?", CTA. Error: "Wrong number or password."
- **`forgot`** · phone input, then the `verify` screen, then a new-password screen. There is no
  reset link and no inbox: the code arrives by SMS.
- **`paywall`** — hero: everything unlocked list (6 rows with icons); price card **Rs 1,000/month**
  (orange highlight "Most popular" if multiple plans later); trial copy "First 3 days free" (D4 —
  confirm trial with client); CTA "Start Premium"; ghost "Not now" (goes to limited free mode —
  free tier = browse + 5 MCQs/day + 5 AI msgs/day, D5). Restore/já subscribed link.
- **`pay-method`** — Safepay sheet: segmented `Card / JazzCash / EasyPaisa`; card = number/expiry/cvc
  fields; wallets = phone number field + instruction line "Approve the request in your JazzCash
  app". Pay CTA shows amount. Failure state: red banner + retry.
- **`pay-done`** — success check animation, "Premium active till 19 Aug", CTA "Let's start" → `dash`.

### Home

- **`dash`** — header: avatar (→`profile`), greeting "Salam, Ahmed 👋", streak flame `🔥 6` (→`prog`),
  bell (→`notifs`, dot when unread). Sections: **Today's Plan** card (progress "3/8 done", next 3
  tasks as checkable rows with subject chips, "See full plan"); **Continue learning** (last chapter,
  resume position, progress bar); **Quick actions** grid (MCQs, Flashcards, Ask AI, Past papers);
  **This week** mini-stats (accuracy %, questions, minutes). Free users: slim upgrade banner above
  tabs. Offline: banner + cached content still tappable. Plan generated daily by AI (M9; static till).
- **`notifs`** — grouped Today/Earlier; types: reminder (bell), streak (flame), report (card),
  payment (receipt). Empty state: "No notifications yet — we'll nudge you when it matters."

### Study

- **`subjects`** — search field; subject cards (icon, chapters count, progress ring, "Continue"
  chapter subtitle). Urdu subject title in Nastaliq. Premium-locked subjects (free tier) show lock.
- **`chapters`** — subject header (progress ring, medium toggle EN/اردو for dual-medium content);
  chapter rows: number badge, title (+ Urdu title), meta "12 MCQs · Audio · Notes", progress bar,
  states: done (green check), in-progress (bar), locked (premium). FAB: "Chapter test".
- **`chapter`** — hero: chapter number/title, progress %, XP earned; section list (the Apex
  pattern): **Notes** (→`reader`), **Audio lesson** (→`audio`, duration), **Flashcards** (count),
  **Practice MCQs** (count, best score), **Past-paper questions** (count); CTA "Continue where I
  left". Download toggle top-right (→ offline; shows size ~2 MB).
- **`reader`** — reading surface on paper bg; sticky mini-header (chapter, progress % as thin bar);
  content blocks: headings, paras, definition callout (teal-tint), formula block, figure with
  caption; **medium toggle** EN/اردو flips content (Urdu = RTL Nastaliq); footer bar: prev section ·
  section 2/6 · next. **Ask AI**: floating button opens bottom sheet with selected-text context,
  suggestion chips ("Explain simply", "Give an example", "اردو میں سمجھائیں"), mini-chat inline
  (full chat → `ai-chat`). Font-size stepper in overflow. Scroll position saved (resume).
- **`audio`** — artwork (chapter card), title, subject; scrubber with elapsed/total; controls:
  −15s / play / +15s; speed chip (1.0×→1.25×→1.5×); background-play note; **Download** button with
  downloaded state; up-next list (other sections). Mini-player persists over tab roots while playing.
- **`downloads`** — storage summary bar ("142 MB of downloads"); per-subject groups with chapters
  (size, delete swipe); CTA "Download current chapter pack"; empty state invites downloading for
  offline; auto-cleanup note in caption.

### Practice

- **`practice`** — mode cards: MCQs, Flashcards, Fill in the blanks, Short questions, Past papers,
  **Timed exam** (orange accent), **AI test — from my weak topics** (sparkle icon, M9). Each card:
  one-line description + count available. Recent sessions list below.
- **`p-setup`** — configure sheet: subject picker (chips), chapter multi-select (or "Mixed — all
  studied chapters"), count segmented (10/20/50), for exams: duration (15/30/60 min). CTA "Start —
  20 questions". Remembers last config.
- **`mcq`** — top: close ✕, progress "7/20" bar, subject chip. Question (supports formula/figure);
  4 options (A–D cards); on select → **Pakka-meter appears** (3 segments: Tukka 🎲 / Thora sure /
  Pakka ✓) → **Check answer** CTA enables. No timer in practice mode. Overflow: report question,
  bookmark.
- **`mcq-fb`** — option cards recolor (green correct / red chosen-wrong); verdict row: "Sahi jawab!
  +10 XP" or "Ghalat — no tension"; **explanation card** (why + related concept link → `reader`);
  Pakka-meter echo ("You said Pakka — is concept ko dobara dekh lo" when confident-wrong — the
  memorable coaching moment); CTAs: Next question · Ask AI about this.
- **`flash`** — card stack: front (term/question), tap flips (3D flip, 240ms) to back (answer);
  swipe right "Yaad hai ✓" / left "Repeat 🔁"; progress "12/30" + deck bar; end state: recap
  (known/repeat counts) + "Review repeats" CTA. Spaced-repeat note in spec: repeats resurface first
  next session (simple SM-lite, M3).
- **`blanks`** — sentence with blank chip; answer via 4 word-bank chips (tap to fill, tap to undo);
  Check → correct/wrong states inline; same footer pattern as MCQ.
- **`shortq`** — question card; "Think, then reveal" → model answer card (client-provided) +
  marking points list; self-mark segmented: "Got it / Partially / Missed" (feeds weak topics);
  next. Optional "Type your answer" textarea (kept, AI feedback later phase).
- **`papers`** — filter chips (year, session Annual/Supply); paper cards: "FBISE 2025 Annual —
  Physics", meta (marks, duration), actions: Practice as exam (→`exam-intro`) · View paper
  (→`paper-view`); downloaded badge.
- **`paper-view`** — paper page view (sectioned Q1, Q2…), zoom note, "Practice this paper" CTA.
- **`exam-intro`** — rules card: 20 questions · 30 minutes · no pause · XP ×2; past best; CTA
  "Start exam". Cheating-lite note: leaving app pauses timer max once (spec-level, D6).
- **`exam`** — timer pill top-center (turns orange <2 min, pulses <30s); question area as `mcq`
  but **no Pakka-meter, no instant feedback**; bottom: question palette dots (answered/flagged/
  current); flag toggle; Submit sheet (unanswered count warning).
- **`result`** — score dial (SVG, count-up), "16/20 — 80%", grade chip, XP earned (+capped bonus),
  accuracy vs your average, weakest topic callout ("Turning Effect — 2/5") with "Study now" →
  `chapter`; CTAs: Review answers · Done. Confetti burst once (reduced-motion: none).
- **`review`** — list grouped Wrong first (red left-border) then Correct; each row expands to
  mini feedback card (your answer, correct answer, explanation, Ask AI link); filter chips
  All/Wrong/Flagged.

### AI Tutor

- **`ai-home`** — quota ring in header ("14/20 today", teal→orange as it depletes — cost control
  made visible, D7 sets exact quotas); action cards: **Ask a doubt** (keyboard+camera icons),
  **Explain a topic** (picker → chat pre-filled), **Solve a question** (camera-first), **Concept
  clarification**; Recent chats list (subject chip, first line, time); footer note "AI can make
  mistakes — verify with your book."
- **`ai-chat`** — chat: user bubbles right (teal), AI left (card) with **step-by-step blocks**
  (numbered steps, formula rows), typing/streaming indicator; message actions: 👍👎 ("Was this
  helpful?"), copy, "اردو میں" (re-explain in Urdu); context chip at top when launched from a
  lesson ("Ch 3 · Dynamics"); composer: text field, camera, mic (mic = later phase, shown
  disabled, D8); quota banner state at 0: "Daily limit reached — resets 12 AM" + upgrade CTA
  (free tier). Safety: refuses non-study topics (spec note).
- **`ai-test`** — weak topics pre-checked list (from analytics, each with accuracy %), count +
  difficulty segmented, "Generate my test" → generating state (skeleton, ~5s) → `exam-intro`
  variant labeled "AI test — focus: your weak topics".

### Progress

- **`prog`** — overall ring (68%), streak calendar strip (last 14 days, flame on active), stats
  row (questions, accuracy, minutes, tests); per-subject progress bars (tap → `perf` filtered);
  weak topics preview (top 3, → `weak`); report card teaser (grade chip, → `report`).
- **`perf`** — segmented range (Week/Month/All); line chart accuracy-over-time (SVG); bar chart
  questions/day; **Confidence vs accuracy** card — the Pakka-meter payoff: 3 rows (Pakka/Thora/
  Tukka) each "said × right %" with insight line ("When you say Pakka you're right 91% — trust
  yourself!"); tests table (date, score, review link).
- **`weak`** — per subject accordion; topic rows: name, accuracy % (red<50/orange<70), question
  count, CTAs "Study" (→`chapter`) / "Practice 10" (→`mcq` prefiltered). Empty state (new user):
  "Practice a bit first — we'll find your weak spots."
- **`report`** — monthly card styled like a school report: month, overall grade (A−), per-subject
  rows (grade + trend arrow), attendance-style stats (active days, questions, tests), teal/orange
  official-ish border, MatricMate stamp; CTAs: **Share as image** (WhatsApp-first), Download PDF;
  month switcher. Parent-facing: no login needed to view shared image (D9).

### Profile & system

- **`profile`** — identity card (avatar, name, "Class 9 · FBISE · English medium", edit →
  `edit-profile`); Premium status card (active till date → `subscription`); XP + level row; menu:
  Payment history, Downloads, Notifications, Settings, Help & support, Log out (confirm dialog).
- **`edit-profile`** — avatar picker (preset cartoon avatars, no photo upload needed M4), name,
  class/board/medium (changing resets plan warning), subjects re-pick entry.
- **`subscription`** — current plan card, renew date, **payment method**, Renew now CTA (manual
  monthly re-pay flow — no auto-recurring, matches BUILD-PLAN), cancel flow (confirm + reason
  chips), free-tier state variant.
- **`payments`** — receipt rows (date, amount, method icon, status chip); empty state; tap →
  receipt detail sheet (ref no for support).
- **`settings`** — groups: Appearance (Dark mode toggle — dark preview note), Content (Content
  medium EN/UR, Font size), Notifications (Study reminders toggle + time picker row, Daily plan,
  Streak alerts), Storage (Clear downloads, cache size), About (version, terms, privacy). Language
  of UI itself stays English (D10 — Urdu UI later).
- **`help`** — FAQ accordions (subscription, offline, AI limits); Contact on WhatsApp CTA (deep
  link, support hours); report a problem form (category + text).
- **`states`** — gallery demonstrating global patterns: skeleton loading set, empty, error+retry,
  offline banner, toast, premium-lock sheet — the reference for every screen's edge states.

### Web (M6) & Admin (M7)

- **`web-dash`** — student web layout: left sidebar (logo, 5 nav items + profile bottom), content
  = same dashboard cards in 2-column grid; top bar with search + streak. Demonstrates the
  responsive strategy: same components, sidebar instead of tabs, content max-width 1040.
- **`web-reader`** — reader with sticky left chapter outline, content column (680px), right Ask-AI
  panel docked (instead of bottom sheet).
- **`landing`** — hero: wordmark, headline "Board exams, sorted." + Urdu subline, phone mockup
  (dashboard screenshot), CTAs (Play Store badge, "Use on web"); social proof strip; features
  3-up (Study/Practice/AI); how-it-works 3 steps; pricing card (Rs 1,000/mo, trial); FAQ; footer.
  Single page, anchors only.
- **`adm-login`** — plain email+password card on ink background, "Admin only" note.
- **`adm-dash`** — KPI tiles (students, active today, premium, MRR est.), signups line chart,
  content pipeline widget (drafts/in review/published), recent AI-generated MCQs awaiting review.
- **`adm-curriculum`** — 3-pane: tree (Board→Medium→Class→Subject→Chapter) with drag-order
  affordance; chapter list; right details (status chips draft/review/published, counts). "Add
  chapter" modal pattern.
- **`adm-editor`** — chapter editor: sections list left; markdown-ish editor center (toolbar:
  heading, bold, formula, image, callout); right meta panel (medium tabs EN/UR — dual-medium
  authoring, audio upload row with duration, review status dropdown, Save/Publish CTAs; publish
  requires review status = approved).
- **`adm-mcq`** — table (question snippet, chapter, difficulty, source chip Human/AI, status);
  filters; bulk approve; row → editor drawer (question, options, correct, explanation);
  **AI review queue** tab: AI-generated items with Approve / Fix / Reject, rejection reasons.
- **`adm-students`** — table (name, class, medium, joined, last active, plan status, actions);
  subscription panel: activate manually (bank-transfer fallback per BUILD-PLAN), extend, refund
  note; search + export CSV.

## 6. Cross-cutting behavior

- **Offline:** banner pattern; Study/downloaded content + cached MCQs work offline; attempts queue
  and sync (conflict = last-write, server clock); AI/exams need connection (clear inline notice).
- **States:** every list screen ships skeleton → content/empty/error(retry); never blank screens.
- **Premium gating:** free tier (D5) = browse all, 1 chapter fully open per subject, 5 MCQs + 5 AI
  messages/day; lock rows open paywall sheet (never dead-end).
- **Quotas:** AI daily quota visible (`ai-home` ring); server-enforced; resets midnight PKT.
- **XP:** MCQ correct +10 (Pakka bonus +2 — honesty incentive: Tukka-correct gets +5), exam ×2,
  streak day +20. Level thresholds ×500. (Tune later; keep integers.)
- **Urdu:** Nastaliq everywhere Urdu content renders; RTL containers; numerals stay Latin; test on
  low-end Android (font size ≥17 for Nastaliq legibility).
- **Accessibility:** 44dp targets, AA contrast (teal on white passes; orange only on ink/white at
  ≥17px bold), focus visible on web, reduced-motion kills confetti/pulse/flip (fade instead).
- **Analytics events (min):** `onboard_step`, `lesson_open`, `audio_play`, `mcq_answer`
  (with confidence), `exam_submit`, `ai_message`, `paywall_view`, `subscribe_success`, `share_report`.

## 7. Open design decisions for client

| # | Question | Prototype assumes |
| :- | :---- | :---- |
| D1 | 5 tabs + profile in header (vs 6 in diagram)? | 5 tabs |
| D2 | Exact FBISE-9 compulsory/elective subject list | Science group default |
| D3 | Phone OTP timing | **Settled 10 Aug: phone + password, code at signup and reset only** |
| D4 | Free trial (3 days)? | Shown |
| D5 | Free tier limits | 1 chapter/subject + 5 MCQs + 5 AI msgs/day |
| D6 | Exam anti-cheat strictness | Soft (pause once) |
| D7 | AI daily quotas per tier | 20 premium / 5 free |
| D8 | Voice input in AI chat | Deferred (icon disabled) |
| D9 | Report card share = public image link? | Image share, no login |
| D10 | Urdu UI translation | English UI at launch |
