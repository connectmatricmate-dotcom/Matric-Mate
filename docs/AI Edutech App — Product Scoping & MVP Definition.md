# AI Edutech App — Product Scoping & MVP Definition

**Source of truth:** the client's verified app-flow diagram (AI Edutech App — 9th & 10th Board Exam Preparation). This doc matches that flow exactly. Companion docs: `AI Edutech App — Technical Feasibility & Architecture.md` (stack, PKR cost, timeline). One scope doc covers **both web and native mobile (Android only — iOS is a future phase)** — they share one monorepo, one backend; the **native mobile app is built first, then the web app** (the shared backend is stood up during the mobile stage). **Content:** the **client provides all source material** (courses, chapter content, videos, notes, MCQs, past papers). We ingest and structure it; the app's AI augments it.

## 1\. Document Purpose

**AI Edutech App** is a complete exam-preparation platform for **9th & 10th class** students (**Punjab Board & FBISE**). It offers, in one app: AI tutoring, chapter-wise learning (video \+ notes), MCQs, flashcards, fill-in-the-blanks, short questions, past papers, tests, AI-generated study plans, and progress tracking — on **Android and Web** (iOS in a later phase).

**The MVP delivers the full verified flow:** Onboarding → Study (Learning) → Practice & Test → AI Tutor → Progress & Reports → Profile & Settings.

## 2\. Target User (Primary)

- **Students** in **Class 9 & 10**, **Punjab Board \+ FBISE**. Mobile-first, exam-focused, price-sensitive.  
- **Parents** — view progress and shareable report cards (analytics for students & parents).

**User mindset:** "I want to study my chapters, practise every question type, ask the AI when I'm stuck, and see exactly where I'm weak before the exam."

## 3\. The Problem

- **Passive revision** — re-reading textbooks with no active practice or feedback.  
- **Limited practice** — not enough MCQs, short questions, fill-in-the-blanks, or past papers mapped to the exact chapter.  
- **No weak-area feedback** — students can't see what they've mastered vs. what needs work.  
- **Scattered resources** — learning, practice, past papers, and help live in different places.  
- **No help when stuck** — no instant, step-by-step doubt solving.

## 4\. Value Proposition

"We believe **9th & 10th class students (Punjab Board & FBISE)** will choose **AI Edutech App** because it lets them **learn each chapter, practise every question type, get instant AI help, and see exactly where they're weak — all in one app**, unlike **textbooks and scattered free resources**, which **give content without practice, feedback, or guidance**."

## 5\. Top User Pain Points (Ranked)

1. **"I just re-read and forget."** → Chapter-wise study (video \+ notes) \+ active practice.  
2. **"I need more practice."** → MCQs, fill-in-the-blanks, short questions, flashcards, past papers.  
3. **"I get stuck and have no one to ask."** → AI Tutor (24/7 doubt solving, step-by-step).  
4. **"I don't know where I'm weak."** → AI progress analyzer, weak topics, report card.  
5. **"I can't plan my study."** → AI study planner (daily plan, "Today's Plan").

## 6\. User Roles & Personas

### Persona A: The Student (Primary)

- **Goals:** Learn chapters, practise all question types, clear doubts, track progress, pass the board exam.  
- **Success:** Completes daily plan tasks, takes tests, sees weak topics improve.

### Persona B: The Parent

- **Goals:** See the student's progress and monthly report card.  
- **Success:** Receives/views a shareable report card and performance summary.

### Persona C: The Content Admin (Internal)

- **Goals:** Ingest and manage the **client-provided** content (chapters, videos, MCQs, past papers) and keep the catalogue current. Works in the web admin/CMS.

## 7\. Platform Coverage (one doc, both platforms)

Built from one Turborepo monorepo with a shared backend; the **native Android app ships first, then the web app** reuses the shared backend.

| Capability | Web | Android | iOS | Admin (web only) |
| :---- | :---: | :---: | :---: | :---: |
| Student app (all six flows below) | ✓ | ✓ | later | — |
| Content admin / CMS (ingest client content) | — | — | — | ✓ |
| Marketing landing page (separate) | ✓ | — | — | — |

## 8\. App Flow & Screens (matches the verified diagram)

**1\. Onboarding Flow** Splash → Welcome → **Choose Class** (9th / 10th) → **Select Board** (Punjab Board / FBISE) → **Select Subjects** (Mathematics, Physics, Chemistry, Biology, English, Urdu, Islamiat) → **Create Account** (Full name, Email / Phone, Password) → **Subscription** (Premium — Rs 1,000/month) → **Dashboard (Home)**.

**2\. Study Flow (Learning)** Subjects → **Chapters** (chapter list per subject) → **Chapter Content** (tabs: Learn / Notes / Examples; lessons \+ exercises with video) → **Lesson Content** (key concepts \+ **"Ask AI"** explanation).

**3\. Practice & Test Flow** Practice Home (MCQs · Fill in the Blanks · Short Questions · Flashcards · Past Papers) → **MCQs** (topic-wise & mixed) → **MCQ Result** (correct/incorrect \+ explanation \+ **XP**) → **Test Result** (score, %, Review Answers).

**4\. AI Tutor Flow** AI Tutor Home (Ask a Doubt · Explain a Topic · Solve a Question · Concept Clarification) → **Ask Doubt** → **AI Explanation** (step-by-step, "Was this helpful?") → **Solve Question**.

**5\. Progress & Reports Flow** Progress Overview (overall % \+ per-subject %) → **Performance** (accuracy, tests taken, questions solved, trend chart) → **Weak Topics** (per subject, with %) → **Report Card** (monthly grade, shareable).

**6\. Profile & Settings** Profile (Edit Profile, Subscription, Payment History, Notifications, Help & Support, Logout) → Settings (Dark Mode, Notifications, Study Reminders, Language, Clear Cache, About, Version).

**Main navigation (bottom bar):** Home · Study · Practice · AI Tutor · Progress · Profile.

## 9\. MVP Feature Scope (Must-Haves)

| Feature | User Goal | Notes |
| :---- | :---- | :---- |
| Onboarding (class → board → subjects → account → subscription) | Get set up and into my plan fast | Punjab Board \+ FBISE; subjects per client content |
| Dashboard / Home | See today's plan and continue learning | "Today's Plan" tasks, Continue Learning, Quick Actions |
| Chapter-wise study (video \+ notes \+ examples) | Learn each chapter | Learn / Notes / Examples tabs; video lessons \+ exercises (client-provided) |
| AI explanation inside lessons ("Ask AI") | Understand a concept on the spot | AI tutor embedded in lesson content |
| MCQs (topic-wise & mixed) | Practise questions | Instant correct/incorrect \+ explanation \+ XP |
| Fill in the Blanks | Practise recall | Question type |
| Short Questions | Practise written answers | Question type (model answers / AI-assisted) |
| Flashcards | Revise with active recall | Smart flashcards |
| Past Papers | Practise real board papers | Client-provided board papers |
| Tests | Take a graded test | Score, %, XP, Review Answers |
| AI Tutor (24/7) | Ask doubts, explain, solve, clarify | Step-by-step, "Was this helpful?" |
| AI Test Generator | Get tests on my weak areas | Personalized tests based on weak topics |
| AI Study Planner | Get a daily study plan | "Today's Plan", daily tasks |
| Progress & analytics | See overall \+ per-subject progress | Accuracy, tests taken, questions solved, trends |
| Weak topics | Know what to fix | AI identifies weak topics per subject |
| Report card | See a monthly grade I can share | Monthly grade, shareable to parents |
| Subscription \+ payments | Subscribe to unlock everything | **Rs 1,000/month**; cards \+ JazzCash \+ EasyPaisa (Safepay) |
| Profile & Settings | Manage my account & app | Edit profile, payment history, dark mode, reminders, language, etc. |
| Push notifications | Get study reminders | FCM (web \+ Android) |
| Content admin / CMS | (Internal) Ingest & manage client content | Chapters, videos, MCQs, past papers |
| Landing page (separate) | Learn about the app & sign up | Distinct marketing site |
| Android \+ Web (mobile first; iOS in a later phase), offline, sync | Use on phone & web, even offline | One monorepo; offline mode; real-time sync across devices |

## 10\. Out of Scope (Not Building)

- **Mind-map** — dropped by client.  
- **Per-question confidence slider** — the verified flow tracks accuracy / weak topics / XP, not confidence calibration (so it's not built).  
- **AI writing/owning the core content** — the client provides all source material; AI only augments (tutor, test generation, study plan, flashcards).  
- **Community / leaderboard** — not in the verified flow.

## 11\. Open Questions — To Confirm With Client

These were in the **original verbal brief** but are **not shown in the verified diagram**. Status as of contract signing (18 Jul 2026):

**Resolved:**

- **Dual medium (English \+ Urdu content)** — **in**: *Medium* is a level of the curriculum hierarchy (Board → Medium → Class → Subject → Chapter, per the job post).  
- **Referral \+ commission** — **in scope**: admin-approved referrers with code/QR attribution and a real-time referral dashboard — full spec in SOW §6.14.  
- **iOS timing** — **future phase**, not in this contract (Android \+ Web only; same codebase makes it a later add).  
- **Launch scope** — **FBISE Class 9 first**; Class 10 \+ other boards are a later expansion (per the job post).

**Still open — confirm with client:**

1. **Audio voice-over (TTS).** Client-provided **audio lessons with in-app player are in scope** (job post); whether **TTS-generated** Urdu/English voice-over is also needed is unconfirmed (if so, it's an add-on — see feasibility doc).  
2. **Payments entity.** Is the business **Pakistan-registered** (→ Safepay: cards \+ JazzCash \+ EasyPaisa) or is a **UK/US entity** available (→ Stripe possible)? Needed to finalise billing.  
3. **Video in the study module.** Job post says the video library is a later phase ("no video for now"), but some Study wording still mentions video — confirm.  
4. **Confidence slider on MCQs.** Required by the job post, excluded by the verified diagram — confirm before the practice milestones (M3/M8).

