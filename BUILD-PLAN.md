# Matric Mate — Build Plan (internal, v1 — 19 Jul 2026)

> The engineering source of truth for HOW we build. Client-facing docs in `docs/` describe scope;
> the contract milestones (`contract/contract-milestones.md`) are the binding deliverables.
> Grounding: the client's voice-note brief (`reference/client-brief-transcript.md`) — what Adnan
> actually asked for — plus the Upwork job post.

## 0. What the client actually wants (from the voice note)

Apex-style per-chapter flow: **full chapter → flashcards → podcast/audio → MCQs → library**.
English + Urdu medium, board-wise, Science & Arts groups. An AI layer that tracks *how much the
student studied today and their correct-answer rate*. Android + Web first, iOS later. **Low,
predictable server cost** and no issues under concurrent users (he asked about this twice).
Referral/commission dashboard (he'll detail later). Separate landing page. A design that is
"thoda sa hatke" (distinctive). Correct Urdu voice-over (paid TTS acceptable).

Constraints: **$1,852 total, ~10.5 weeks, solo AI-assisted dev, M1 due 1 Aug.** Every decision
below optimizes for reuse, few moving parts, and low run-cost.

## 1. Headline decisions (deltas vs the old docs)

1. **ONE universal Expo app = the native Android app AND the responsive student web app.**
   Expo Router + React Native Web + NativeWind renders the same screens natively on Android and as
   a real responsive web app. Stage B's "web app" milestone then reuses ~90% of Stage A instead of
   rebuilding every screen in Next.js — that is the only way M6–M10 fit in 4.5 weeks / $626.
   Next.js remains for the **landing page** and **admin CMS** (where it belongs). The job post
   prefers Next.js "but we are open to your recommendation" — this is the recommendation.
2. **Backend = Supabase only during Stage A.** Postgres + Auth + Storage + RLS + **Edge Functions**
   (AI proxy with quotas, Safepay webhook). No custom API server, nothing to operate. The admin
   app joins in Stage B.
3. **The M1 "clickable prototype" is a self-contained HTML design-spec app** (built 19 Jul —
   `prototype/index.html`, 56 screens: full mobile app + student web + landing + admin CMS, with
   per-screen behavior notes and milestone tags). Together with `docs/DESIGN-SPEC.md` it replaces
   Figma/wireframes; the Expo app implements it screen by screen. **Everything stays local** —
   deliver to Adnan by sending the single `index.html` file (opens in any browser, full-screen
   app feel on his phone); no hosting/publishing unless the user explicitly asks.
   The real Expo app (M1 deliverable b) then ships onboarding + auth + navigation + browse.
4. **Cut from MVP** (add back only when justified):
   - **Bunny.net** — audio files are small; Supabase Storage (CDN-backed) is fine until bandwidth
     says otherwise. No video in MVP (client's own call).
   - **Cloudflare** — Vercel + Supabase already give TLS/CDN/DDoS basics.
   - **Auto-recurring billing** — PK wallets don't do clean recurring; MVP = monthly re-payment
     via Safepay checkout + entitlement expiry reminders (push). Honest and simple.
   - **Admin CMS before M7** — content is seeded via scripts + Supabase Studio until the CMS
     milestone; a `review_status` column gives review-before-publish from day one.
   - **Referral build** — future phase per job post; we only reserve attribution in the schema
     (`referred_by_code` on profiles) so history exists when it's built.
   - **Phone OTP at M1** — email + password first; SMS OTP needs a provider/cost decision
     (PK SMS rates); propose to client as a follow-up.
5. **AI = Claude Haiku 4.5 by default** (tutor chat + MCQ generation; Batch API for pre-generation
   into a review queue), escalate to Sonnet 4.6 only if quality demands. **Hard per-user daily
   quotas** in an `ai_usage` table, enforced in the Edge Function; curriculum context via prompt
   caching. This is the client's cost-anxiety answered structurally.
6. **Audio**: client-provided files preferred; otherwise **pre-generated** Azure TTS (`ur-PK` +
   English) per chapter, stored once — zero runtime TTS cost. Player: `expo-audio`; offline
   downloads via `expo-file-system`. Urdu text uses **Noto Nastaliq Urdu** (test on device early —
   Nastaliq rendering is a classic trap).
7. **Push = expo-notifications + Expo Push Service** (needs Firebase FCM V1 credentials by M4 —
   Expo handles delivery; we never touch raw FCM APIs).

## 2. Monorepo layout (Turborepo + pnpm, scaffolded at repo root)

```
apps/
  app/        # Expo — Android + web student app (Stage A → exported to web in M6)
  admin/      # Next.js — CMS + review workflow (M7)
  landing/    # Next.js/static — marketing site (M6)
packages/
  core/       # types, zod schemas, domain logic (XP, streaks, progress, quotas)
  db/         # Supabase client + generated types + queries
  config/     # shared eslint/ts/nativewind presets
supabase/     # migrations, seed (FBISE Class 9), edge functions (ai-tutor, mcq-gen, safepay-webhook)
```

## 3. Data model v1

- **Curriculum:** `boards` → `mediums` (en/ur) → `class_levels` → `subjects` (group: science/arts)
  → `chapters`. Chapter is the content unit (Apex pattern): `chapter_sections` (notes, markdown),
  `flashcards`, `mcqs` (options, answer, explanation, difficulty), `audio_tracks`. All content rows
  carry `review_status` (draft/review/published) + `medium`.
- **Users:** `profiles` (class, board, medium, subjects[], `referred_by_code` nullable), roles.
- **Activity:** `attempts` (mcq, correct, confidence?, duration), `study_events` (append-only —
  powers "how much did they study today"), `xp_events`, `chapter_progress`; streaks derived.
- **AI:** `ai_chats`, `ai_messages`, `ai_usage` (per user/day quota), `generated_mcqs` (review queue).
- **Billing:** `subscriptions` (status, valid_till), `payments` (Safepay refs).
- **RLS:** students read only `published` content; write only their own activity rows.

## 4. Milestone execution map (contract dates)

| # | Due | Build |
| :- | :- | :--- |
| M1 | 1 Aug | Monorepo scaffold; design system (distinctive brand, dark mode, Urdu typography); ALL screens as navigable mocks; Supabase schema + FBISE-9 seed (subjects + chapter lists); real auth (email+pw) + real curriculum browse; EAS APK on Adnan's phone + web preview link |
| M2 | 12 Aug | Chapter reader (notes, en/ur), audio player + downloads, offline cache (SQLite + files); content ingestion scripts; first real chapters loaded |
| M3 | 17 Aug | MCQ practice + timed exams + results/XP, flashcards, AI tutor chat (streaming Edge Function, quotas), AI MCQ generation → review queue |
| M4 | 22 Aug | Progress dashboards (accuracy, activity, streaks, chapter %, weak topics), Safepay checkout + webhook + gating, push notifications, cross-device sync verification |
| M5 | 29 Aug | Polish, store listing assets, **Play submission** (see risk #1 — closed testing must start ~2 wks earlier), launch |
| M6 | 5 Sep | Landing page live; student app **web export** deployed + web auth QA |
| M7 | 12 Sep | Admin CMS: curriculum manager, content/MCQ/flashcard editors, audio upload, review→publish workflow, AI-generated review queue |
| M8 | 19 Sep | Remaining practice types: fill-blanks, short questions (model answers), past papers — shared components, both platforms |
| M9 | 26 Sep | Report card (monthly, shareable), AI study planner ("Today's Plan"), weak-topic test generator |
| M10 | 30 Sep | Web subscription flow, QA sweep, documentation, handover prep |

## 5. Run-cost impact

Supabase free→$25/mo, Vercel free/hobby, EAS free tier (or local builds), Claude bounded by quotas,
Azure TTS one-off per content batch, **no Bunny/Cloudflare bills**. Launch run-cost ≈ **Rs 0–15k/mo**
until real user growth (old docs estimated Rs 33–90k). Directly answers the client's top concern.

## 6. Top risks

1. **Google Play 14-day / 12-tester rule.** Personal Play Console accounts (post-Nov-2023) must run
   a closed test with 12+ testers for 14 days BEFORE production access. M5 (29 Aug) is at risk
   unless the Play account is created **now** and a closed-testing build is up by ~8 Aug.
   Mitigations: create account this week; recruit 12 testers (client's circle); or use an
   organization account (needs D-U-N-S — its own lead time). **Raise with Adnan immediately.**
2. **Safepay merchant onboarding** (KYC, ~1–2 wks) — needed by M4 (22 Aug). Client must apply now.
   Fallback: manual activation by admin + bank transfer for the first weeks.
3. **Content dependency** — M2 needs at least 1–2 real chapters by ~5 Aug. Fallback: seed from
   FBISE model textbooks and swap when client content arrives.
4. **Urdu rendering** — Noto Nastaliq on Android + web; test on a real device in week 1.
5. **RN-web quirks** — stick to standard primitives + NativeWind; build the web export in CI from
   week 1 so drift is caught immediately.

## 7. Needed from client/user (accounts on client's Google where sensible)

**Now:** Supabase project, Expo account, private GitHub repo (owner: us until handover),
**Google Play Console ($25 — start verification + closed-testing plan)**, Safepay merchant
application, FBISE-9 chapter lists (or approve syllabus-derived seed).
**Resolved 19 Jul:** name = **MatricMate**; client-supplied logo received — palette, usage rules
and all app-ready assets (icon, adaptive icon, splash, favicons, notification icon) in
`docs/assets/brand/` (see `BRAND.md`). **By M2/M3:** Anthropic API key, first real content, audio files or TTS
go-ahead. **By M4:** Firebase project (push credentials), Safepay live keys.
