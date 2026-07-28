# Matric Mate (AI Edutech App)

AI-powered exam-prep app for Pakistani students — **FBISE Class 9 first** (Class 10 + Punjab Board
later). Native **Android app first (React Native/Expo), then web (Next.js)**, one Turborepo
monorepo, Supabase backend, Claude AI tutor, Safepay payments.

**Status (19 Jul 2026):** Upwork contract signed 18 Jul ($1,852, 10 milestones, client: Adnan).
**Milestone 1 active & funded ($278, due 1 Aug 2026):** clickable prototype + mobile app on the
client's phone — onboarding + auth + navigation + curriculum browse.

## Layout

| Path | What it is |
| :---- | :---- |
| `apps/mobile/` | **The actual app** — one Expo codebase running as the native Android app and the web app (46 screens, mock data). See its own `README.md`. |
| `BUILD-PLAN.md` | **Internal engineering plan (source of truth for HOW we build)** — revised stack, milestone execution map, risks |
| `prototype/index.html` | **Clickable prototype — all 56 screens** (mobile app, student web, landing, admin CMS) with spec notes + milestone tags; pairs with `docs/DESIGN-SPEC.md` |
| `docs/DESIGN-SPEC.md` | Design spec & screen inventory — tokens, navigation model, per-screen behavior/states, open design decisions D1–D10 |
| `docs/` | Client-facing deliverable docs: **Scoping & MVP Definition**, **SOW**, **Technical Feasibility & Architecture** (latest versions, 19 Jul 2026) |
| `docs/assets/` | Extracted assets — `matric-mate-referral-diagram.png` (the referral system-flow diagram embedded in the SOW) |
| `contract/` | Upwork job post (`contract-description.md`), milestone tracker (`contract-milestones.md`), and `credentials.md` (**private**) |
| `reference/` | Background & research: client voice-note brief (`client-brief-transcript.md`), `apexbeat-teardown.md` + `apex-capture/` screenshots + `crawl-scripts/` (Playwright recon of the reference app), `templates/` (doc templates) |

The repo root is kept clean for the app monorepo (milestone 1 onwards).

## Doc status (updated 19 Jul 2026)

All three docs in `docs/` were updated to match the signed contract: **mobile-first (Android only,
iOS future phase)**, ~11-week schedule with Upwork due dates, M1 = $278 incl. clickable prototype,
referral/dual-medium/Class-9-first marked resolved. **Note:** if the master copies live in Google
Docs, mirror these edits there — the local files are the updated source.

**Still needs the client's answer** (tracked in scoping doc §11): payments entity (Safepay vs
Stripe-via-foreign-entity), TTS voice-over in/out, video in Study in/out ("no video for now" vs
M7 wording), confidence slider in/out (job post says in, verified diagram says out — settle
before M3).
