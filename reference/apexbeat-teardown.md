# Apexbeat (apexbeat.ai) — Full Product Teardown

> **Why this document exists.** The client wants an EdTech app for **FBISE 9th & 10th**
> students built **on the model of Apexbeat**. Apexbeat is a medical (MBBS) exam-prep
> platform. This is a complete, hands-on teardown of what Apexbeat actually does, how it is
> structured, how it works technically, and how it makes money — captured by logging into a
> live account and walking every screen. The last section maps each Apex feature onto the
> client's FBISE brief so we know exactly what to build.

- **Analysed:** 2026-06-09, live, logged-in (Pro account: *Imran Rasheed*, Allama Iqbal Medical College).
- **Method:** Headless Chromium (Playwright) drove the real site — login → crawl all routes →
  interactive drill-downs (AI chat, MCQ solving, exam, flashcards, study content). Screenshots
  + extracted text + network capture are in `apex-capture/` (see the index at the end).
- **One-line summary:** Apexbeat = *"AI‑Powered MBBS Mastery"* — an **AI-driven, adaptive,
  curriculum-mapped study + question-bank + exam platform** for Pakistani medical students,
  web + mobile, subscription-based, with gamification and a faculty/monitoring angle.

---

## Table of contents
1. [Positioning & company](#1-positioning--company)
2. [Platforms](#2-platforms)
3. [Information architecture (the content hierarchy)](#3-information-architecture)
4. [Section-by-section teardown](#4-section-by-section-teardown)
5. [The per-topic learning flow (the "pattern" to copy)](#5-the-per-topic-learning-flow)
6. [The AI / adaptive layer](#6-the-ai--adaptive-layer)
7. [Gamification & engagement](#7-gamification--engagement)
8. [Monetization model](#8-monetization-model)
9. [Technical architecture (how it's built)](#9-technical-architecture)
10. [Curriculum & content inventory (captured)](#10-curriculum--content-inventory)
11. [What maps to the FBISE project](#11-what-maps-to-the-fbise-project)
12. [Gaps / things to confirm](#12-gaps--things-to-confirm)
13. [Screenshot & data index](#13-screenshot--data-index)

---

## 1. Positioning & company

- **Brand / promise:** "Apexbeat" — hero line **"Stop memorising. Start understanding."**
  Tagline: *"the MBBS platform built for Pakistani students."*
- **Product title (meta):** *"ApexBeat – AI-Powered MBBS Mastery."*
- **Company (footer):** *"Apexbeat is a product of dpfi UK (Innovative School of Future
  Technologies Limited)."*
- **Public site sections:** Courses, Tools, Pricing, Blog, Contact, Login, "Join Now for Free",
  "Book a Demo". Blog posts are AI-themed ("AI-Powered Adaptive Medical Learning Platform",
  "Why is an AI Tutor helpful for medical students?").
- **Two audiences hinted in the footer:**
  - *Students* — Topic Summaries, Interactive Mind Maps, Flash Cards, Audio Podcasts.
  - *Faculty / institutions* — **Faculty Tools, Monitoring Reports, Curriculum Alignment**
    (i.e. an institutional/admin tier that monitors student performance — directly relevant
    to the client's "3-step dashboard" idea).

## 2. Platforms

- **Web app** (what we analysed) — a single-page app at `apexbeat.ai`.
- **Mobile apps** — Google Play + App Store badges on the landing page (so iOS + Android exist).
- The app is **content-gated by the logged-in user's institution** ("Allama Iqbal Medical College")
  and **year** — curriculum and available material change per user.

## 3. Information architecture

The entire product hangs off one hierarchy:

```
User (belongs to a Medical College, a Year, and a Study Mode)
└── Year (Year 1 … Year 5)
    └── Module          e.g. "Cardiovascular-1", "Endocrinology and Reproduction-I"
        └── Subject      e.g. Anatomy, Physiology, Biochemistry, Histology, Pathology…
            └── Topic / content bundle:
                ├── Module Overview (text summary)
                ├── Learning Objectives
                ├── Flashcards        (flip cards, ~100 per topic)
                ├── Mindmap           (interactive node map)
                ├── Quiz / MCQs       (clinical-vignette questions)
                ├── Audio Podcast     (listen to the topic)
                └── My Notes          (personal notes, per topic)
```

Two **Study Modes** switch how the hierarchy is presented:
- **Modular** — browse by Module → Subject (what's shown above).
- **Year-wise** — browse by year/class (toggled via "Change" on the Study panel; set per user in Settings).

Primary navigation (left sidebar, every authenticated page):
`Dashboard · Realtime MCQs · Study · Topic Audios · Practice · Exam Papers · Take Exam · PLAB ·
Community · Soft Skills · Reference Books · Subscription · Settings` — plus a persistent
**"Chat with AI"** button in the header and a floating **Feedback** widget.

## 4. Section-by-section teardown

### 4.1 Authentication
- Login accepts **email *or* username** + password (placeholder "Enter Email or Username").
- JWT-style: an `auth_token` is stored in `localStorage`; an httpOnly `refreshToken` cookie is set
  on `apexbeat.ai` (access/refresh pattern). reCAPTCHA is present for bot protection.

### 4.2 Dashboard (`/dashboard`) — the analytics home
Four view tabs: **Modular · Practice Questions · Exam Papers · Real Time MCQs**. Widgets:
- **Plan banner** — "You're on Pro… Manage your plan."
- **Quiz Performance** — donut of **Correct / Incorrect / No-Answer %**, plus
  **System: 43% vs User: 52%** (system-predicted vs user-rated confidence). "Based on 44 subjects
  and 2032 questions."
- **Subject Attempts** — % attempted per subject (e.g. *Cardiovascular-II 58.42%*) and a list of
  **Unattempted** subjects (0%).
- **Study Calendar** — month grid of study activity.
- **Today's activity** — counters: **MCQs Attempted, Flashcards Viewed, Audio/Podcast Listened,
  Mindmaps Viewed**.
- **Performance Trends** — line chart of **Accuracy %, System Confidence %, User Confidence %**
  over **7 / 30 / 90 days**, filterable by module/subject.

### 4.3 Study (`/study`) — the modular learning hub
- Right panel: topic search, Study-Mode toggle, **Year** dropdown, **Module** dropdown,
  "Available topics" (colored subject chips), and **My notes**.
- Pick Year → Module → a **grid of Subject cards** (Anatomy, Embryology, Histology, Physiology,
  Biochemistry, Pharmacology, Pathology, Community Medicine, Behavioral Sciences, Gynecology…).
  Each card shows quick stats (Questions, Podcast, Flashcards, Mindmap) and **progress % / status
  ("Not Started")**.
- Open a card → the **topic content view** (see §5).

### 4.4 Topic Audios (`/audios`)
- Same Year/Module gating; surfaces the **audio/podcast** version of each topic so students can
  listen instead of read. ("Audio Podcast Listened" is a tracked daily metric.)

### 4.5 Practice (`/practice`)
- Module/subject-gated **MCQ practice** over the curated bank (distinct from the on-demand AI
  generator). Mirrors the Study selector; practice questions are drawn from the selected topic.

### 4.6 Realtime MCQs (`/realtime-mcqs`) — on-demand AI question generator
- A **chat-style generator**. Right "Filters" panel: **Year, Module, Subject(s), MCQ Type
  (NONE / USMLE / MBBS / PLAB / FCPS), Difficulty (Easy / Medium / Hard)**, and a free-text
  **Prompt** ("e.g. can you generate 2 MCQs as per my selected filters").
- "Generate MCQs" streams questions into the thread as **clinical vignettes** with A–D options,
  e.g. *"A 45-year-old male with uncontrolled diabetes… which segment of the nephron reabsorbs
  nearly all filtered glucose?"*. Progress shown as **"Question 1/3 · 0/3 answered"**, with
  **Back/Next**, **Copy**, and a **usage quota** ("100% usage remaining").
- Generated sets are **saved** ("Recently Generated") and can be **re-attempted**.

### 4.7 Exam Papers (`/exam-papers`) & Take Exam (`/take-exam`)
- **Exam Papers** = browse module exam papers; **Take Exam** = sit them.
- Year → Module → **"Available Samples"** (Sample 1–5 per module), shown as paper cards.
- Opening a sample shows a start screen: e.g. **"98 Questions · Cardiovascular-1 Exam · Year 1 ·
  Sample 1 · 49 mins · The exam is timed and tracks your confidence for each question · Start Exam."**
- **In-exam UI:** "Question 1 / 98" + progress bar, vignette + A–D options, a **countdown timer**,
  **Next** / **Finish**, **My notes**, and crucially a **confidence slider (Guess ↔ Confident)**
  under every question. That self-rating is what feeds the *User Confidence %* analytics.

### 4.8 PLAB (`/plab`)
- A **system-wise** question bank for the UK PLAB licensing exam. Pick a body system:
  *Cardiovascular, Respiratory, ENT, Rheumatology, Anatomy, Nephrology, Obs & Gynae, Oncology,
  Ophthalmology, Orthopaedics, Paediatrics, Psychiatry, Surgery* → practice PLAB-style MCQs.

### 4.9 Community (`/community`) — social learning
- A **discussion forum**: posts have a title, body/question, **replies count, views count, and
  hashtags** (e.g. `#Lungs`, `#bones`). Actions: **New Post**, **Search**.
- **Daily assignment** ("today's assignment") and a **leaderboard** (community-admin driven).
- **My Streak** widget: current streak, best streak, weekly day grid, last study date,
  "5 days to beat your record!".

### 4.10 Soft Skills (`/soft-skills`)
- **"Coming Soon" — "Powered by PAB."** Placeholder for a future soft-skills track.

### 4.11 Reference Books (`/resources/reference-books`)
- A **curated textbook library** grouped by subject (16 subjects), each listing the standard
  reference texts with author/edition/publisher/year — e.g. *Snell's Clinical Anatomy*,
  *Guyton & Hall Physiology*, *Lippincott Biochemistry*, *Robbins Pathology*, *Katzung
  Pharmacology*, *Park's Community Medicine*, *Davidson's Medicine*, *Bailey & Love Surgery*,
  *Nelson Pediatrics*. (Reference/citation layer, not full e-books.)

### 4.12 Subscription (`/subscription`) — see §8.

### 4.13 Settings (`/settings`)
- **About you:** First/Last name, Email, **Phone (+92)**, Username, City, **Medical college**,
  **Study year (1–5)**, **Study mode (Year-wise / Modular)** → "Save profile".
- **Security:** set new password. Logout.

### 4.14 Chat with AI (global) — the AI tutor
- Full chat page reachable from every screen. **Thinking mode: Simple / Standard / Deep.**
- Ask anything; answers are branded **"Apex AI"** with a **Copy** button; supports **follow-ups**
  ("Ask a follow-up…", Enter to send / Shift+Enter newline).
- **Recent Sessions** history — *"up to 30 recent"* saved chats; "New chat" to reset.
- (Verified live: it correctly answered a cardiac-physiology question.)

## 5. The per-topic learning flow

This is the exact "pattern inside a chapter" the client referred to. Opening a Subject card under
a Module (e.g. **Year 2 → Endocrinology & Reproduction‑I → Anatomy**) loads a single topic page:

- **Left / main:** **Module Overview** (a written summary of the topic) + **Learning Objectives**
  (a bulleted "after studying this you should be able to…" list).
- **Right: "Study Tools"** — a stack of content tools for that topic:
  - **Mindmap** — interactive node/branch concept map.
  - **Flashcards** — flip cards: a question on the front, **"Reveal Answer"** to flip;
    counter like **"1 / 100 Total Flashcards"**, **keyboard arrow navigation**, a
    **Favorite Flashcards** collection, and **Recent Topics**.
  - **Quiz** — the topic's MCQs.
  - **Audio Podcast** — the spoken version of the topic.
- **My Notes** — pin personal notes to the topic.
- **Progress tracking** — each topic carries a % complete and a status (Not Started → …).

So Apex's chapter unit = **Summary/Overview + Objectives + Flashcards + Mindmap + MCQ Quiz +
Audio Podcast + Notes + progress**. (The client's plan: keep Flashcards, Podcast, MCQs, add
audio/video library; **drop Mindmap**.)

## 6. The AI / adaptive layer

Apex's "AI" is not one feature; it's woven through the product:

1. **AI MCQ generation (Realtime MCQs)** — generates fresh clinical-vignette MCQs to order, by
   year/module/subject, exam style (USMLE/MBBS/PLAB/FCPS), difficulty, and a natural-language prompt.
2. **AI Tutor (Chat with AI)** — a Q&A chatbot with Simple/Standard/Deep "thinking" depth and
   session memory; branded "Apex AI".
3. **Confidence calibration (the core adaptive signal)** — for every exam/quiz question the
   student sets a **Guess↔Confident** slider. The platform compares the student's **User
   Confidence %** against its own **System Confidence %** and their **Accuracy %**. The dashboard
   trends all three over 7/30/90 days. This is the "AI reading the student's mind / how well they
   actually know it" mechanic — surfacing over-confidence and weak areas.
4. **Engagement/journey analytics** — the backend continuously tracks sessions, page views,
   engagement and "journey" events (see §9), which power the per-subject attempted/unattempted
   breakdowns, study calendar, streaks and trends.
5. **Adaptive Learning** — sold as an unlimited Pro feature (recommends what to study next based
   on the above).

## 7. Gamification & engagement

- **Streaks** — current vs best streak, weekly grid, "X days to beat your record".
- **Daily assignment** — a "today's assignment" pushed via the community-admin layer.
- **Leaderboard** — community ranking.
- **Community forum** — posts, replies, views, hashtags.
- **Progress %** on every topic; **Today's activity** counters on the dashboard.
- **Favorites** (flashcards) and **My Notes** for retention.

## 8. Monetization model

- **Single Pro plan:** **Rs 6,000 / month** (struck-through **Rs 8,335**, "Limited offer"),
  **one-time payment, no auto-renewal** (you pay per month manually; "Active · Expires Jan 1").
- **Pro unlocks (all "Unlimited"):** Summaries, Flash Cards, Mind Maps, MCQs, Adaptive Learning,
  Audio Podcast, Exam Papers, **AI Chatbot (fair-usage)**, Personal Notes.
- **Payment methods:** **JazzCash**, **Pay Online (Card)** = **Stripe (live)**, **EasyPaisa**,
  **Manual Transfer** (+ "Report an issue"). A **wallet** and **discount/promo codes** exist.
- **Currency:** prices in **PKR**, with a live **USD→PKR** conversion (≈278.25) via an internal
  `currency/convert` endpoint.
- **"View History"** of payments.

> Take-away for our build: subscription billing must support **local Pakistani rails
> (JazzCash/EasyPaisa/bank transfer) + card**, monthly manual renewal, promo codes, and a wallet —
> *not* just Stripe auto-subscriptions.

## 9. Technical architecture

**Frontend**
- **Next.js (App Router / React Server Components)** + React. Evidence: `X-Powered-By: Next.js`,
  `x-nextjs-cache: HIT`, `x-nextjs-prerender: 1`, RSC/Next-Router `Vary` headers, `_next/*` assets.
- Served by **nginx/1.28.3 on Ubuntu** (self-hosted / VPS, prerendered + heavily cached — not a
  serverless/Vercel deploy).

**Backend (custom REST API at `apexbeat.ai/api/…`)** — observed endpoints (IDs masked):
- **Auth/user:** `GET /api/auth/profile`, `/api/user/dashboard`, `/api/user/usage-stats`,
  `/api/user/filter-options`, `/api/user/study-mode`, `/api/user/me/streak` (GET + `PATCH`).
- **Content/curriculum:** `/api/topics/modular/modules`, `/api/topics/modular/search`,
  `/api/topics/subjects`, `/api/topics/recent`.
- **AI:** `/api/ai-assistant/generated-mcqs` (the Realtime MCQ generator).
- **Community:** `/api/posts`, `/api/community-admin/assignments/today`,
  `/api/community-admin/assignments/leaderboard` (note the **admin** namespace).
- **Payments:** `/api/payment/subscription`, `/api/payment/user/wallet`,
  `/api/discount/active`, `/api/discount/used`, `/api/currency/convert`.
- **Analytics/telemetry (heavy):** `POST /api/analytics/session`,
  `/api/analytics/track/page-view`, `/api/analytics/track/engagement`,
  `/api/analytics/track/journey` — fired on every navigation; this is the data spine behind the
  dashboards, streaks and confidence trends.

**Auth:** JWT access token (`localStorage.auth_token`) + httpOnly `refreshToken` cookie.
**Payments:** Stripe (live `pk_live_…`) + local gateways. **Analytics:** Google Analytics
(`_ga…`), Facebook Pixel (`_fbp`), plus the in-house analytics above. **Bot protection:** Google
reCAPTCHA.

**Inferred shape:** SPA (Next.js) ⇄ a separate REST API service (token auth) ⇄ a database, with
an **admin/faculty** back office (community-admin, monitoring reports, curriculum alignment), an
**LLM integration** for MCQ generation + chat, **audio (TTS/podcast) assets**, and **multi-gateway
billing**. (Exact DB / LLM provider not exposed client-side.)

## 10. Curriculum & content inventory (captured)

- **Years:** 1–5.
- **Year 1 modules:** Cardiovascular-1 · Foundation-1 · Hemopoietic and Lymphatic Module ·
  Musculoskeletal and locomotion · Respiratory-I.
- **Year 2 modules:** Endocrinology and Reproduction-I · GIT · Head and Neck and Special Senses ·
  Inflammation · Neurosciences · Renal-I.
- **Subjects seen:** Anatomy, Embryology, Histology, Physiology, Biochemistry, Microbiology,
  Pharmacology, Pathology, Community Medicine, Behavioral Sciences, Medicine, Forensic Medicine,
  Family Medicine, Ophthalmology, ENT, Surgery, Obstetrics & Gynaecology, Paediatrics.
- **PLAB systems:** Cardiovascular, Respiratory, ENT, Rheumatology, Anatomy, Nephrology, Obs &
  Gynae, Oncology, Ophthalmology, Orthopaedics, Paediatrics, Psychiatry, Surgery.
- **MCQ exam styles:** USMLE · MBBS · PLAB · FCPS. **Difficulty:** Easy · Medium · Hard.
- **Content per topic (example, real):** ~100 flashcards, a written overview + objectives, a
  mindmap, a quiz, and an audio podcast.
- **Exam papers:** ~5 "Samples" per module; a sample ≈ **98 questions / 49 minutes**, timed,
  confidence-tracked.

## 11. What maps to the FBISE project

| Apexbeat feature | Client's FBISE app requirement | Notes for our build |
|---|---|---|
| Year → Module → Subject → Topic | **Board → Medium (English/Urdu) → Class (9/10) → Subject → Chapter** | Swap the medical hierarchy for FBISE board/medium/class. Add **board-wise** + **English/Urdu medium** + **Science/Arts** dimensions. |
| Modular / Year-wise study modes | Class-wise (9th, 10th) browsing | "Year-wise" ≈ class-wise; keep it simple (class → subject → chapter). |
| Per-topic: Overview + Objectives | "full chapter first" | Chapter reading/summary view. |
| **Flashcards** | **Keep flashcards** | Core. Q→Reveal flip cards, favorites, keyboard nav. |
| **Mindmap** | **Dropped by client** | Don't build (saves effort). |
| **Audio Podcast** per topic | "podcast" | Needs **TTS for Urdu + English** (client's voice-over requirement). |
| **MCQs** (bank + AI Realtime) | "MCQs" | Keep curated bank + optionally AI generation. |
| Audio Topics / (no video yet) | "audio library / video library" | Apex has audio; **video library is new** for our build. |
| Exam Papers (timed, confidence slider) | (implied / value-add) | The **confidence slider** is the cheap, high-impact AI signal — recommend keeping. |
| Dashboard: accuracy + System vs User confidence, streaks | **AI tracks "how much studied today + correct-answer rate"** | This is literally the client's AI requirement — replicate the confidence/accuracy/activity analytics. |
| Chat with AI (Apex AI tutor) | (not explicitly requested) | Optional value-add; client mainly wants the tracking + voice-over. |
| Footer "Faculty Tools / Monitoring Reports" + community-admin | **3-step dashboard (user → viewer → referrer-via-link) + commission** | Apex already has an admin/monitoring tier; our build needs **role tiers + referral links + commission payout**, which Apex's referral side we did **not** see (build fresh). |
| Subscription: PKR, JazzCash/EasyPaisa/Card/Manual, promo, wallet | Monetization + "charges" | Reuse the **local-rails billing** model. |
| Landing page (separate marketing site) | **Separate landing page outside the app** | Same as Apex (apexbeat.ai marketing site ≠ the app). |
| Next.js + nginx + REST API + LLM + TTS + multi-gateway billing | "server cost, concurrent users, performance" | Informs our infra/cost estimate. |

## 12. Gaps / things to confirm

- **Referral / commission flow not visible** — Apex's footer implies faculty/monitoring, but the
  client's **3-tier referral + commission** model was not exposed in this account. We design that
  fresh (it's the least-defined part of the brief).
- **Video library** — Apex surfaces **audio** podcasts; a **video** library is a *new* requirement.
- **Soft Skills** is "Coming Soon" in Apex (nothing to copy there).
- **Mobile apps** exist but were not analysed (web only here). Client wants **Android + Web first**.
- **Landing page** screenshot is partial (heavy lazy-loaded animations didn't all render headless);
  structure/positioning captured from hero + footer.
- **Exact LLM provider, DB, and admin back-office** are server-side and not observable from the client.
- Some modular content shows 0-counts for this specific account/college (content is provisioned
  per institution); the **feature shells are all real and populated** where we drilled in
  (e.g., 100 flashcards, 98-question exams).

## 13. Screenshot & data index

All under `apex-capture/` (full-page PNGs + extracted-text JSON):

**Auth & shell:** `00-landing.png` (marketing), `01-login-page.png`, `03-after-login.png` (dashboard).
**Top-level pages:** `pg-dashboard*`, `pg-realtime-mcqs*`, `pg-study*`, `pg-audios*`,
`pg-practice*`, `pg-exam-papers*`, `pg-take-exam*`, `pg-plab*`, `pg-community*`, `pg-soft-skills*`,
`pg-reference-books*`, `pg-subscription*`, `pg-settings*`.
**Interactive drills:** `x-chat-open/answer.png` & `d-chat-answer.png` (AI tutor),
`x-realtime-q1/answer.png` (AI MCQ solving), `x-takeexam-papers.png` + `d-exam-sample-open.png` +
`d-exam-inprogress.png` (timed exam + confidence slider),
`x-study-Year_2-…-cards.png` + `d-study-…-cards.png` (subject grid),
`d-study-topic-open.png` (topic: overview/objectives + Study Tools),
`d-study-tab-Flashcards.png` (flashcard viewer).
**Data:** `_crawl-summary.json`, `post-login-nav.json`, `login-inputs.json`, per-page `pg-*.json`.
**Capture scripts (re-runnable):** `scripts/recon-login.mjs`, `scripts/crawl.mjs`,
`scripts/deep-dive.mjs`, `scripts/final-drill.mjs`, `scripts/net-probe.mjs`.

> Session note: a saved login session lives in `apex-capture/state.json`. It will expire; re-run
> `scripts/recon-login.mjs` to refresh, then any other script.
