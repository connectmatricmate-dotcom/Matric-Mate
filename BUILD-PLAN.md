# MatricMate · Build Plan · v2, 30 Jul 2026

> Engineering source of truth for HOW we build. Contract deliverables live in
> `contract/contract-milestones.md`; scope docs in `docs/`. This file is the index and the honest
> status; the depth lives in two companion plans:
>
> - **`docs/BUILD-PLAN-MOBILE.md`** · milestones M1 to M5, task-level, with acceptance criteria
> - **`docs/BUILD-PLAN-WEB.md`** · milestones M6 to M10, task-level, with acceptance criteria
>
> v1 (19 Jul) is superseded. Where this file and reality disagree, git history wins.

## 1. What changed since v1 (decisions that are now facts)

1. **Two apps, not one universal app.** v1 planned a single Expo app exported to web. Built
   reality: `apps/mobile` (Expo SDK 57, Android + Expo Go) and `apps/web` (Next.js 16 on Vercel,
   https://matric-mate-web.vercel.app) sharing `packages/core` (content, domain rules, i18n,
   tokens, icon names, billing policy). Parity is enforced by shared copy keys and the shared
   core, not by one codebase.
2. **npm workspaces, not Turborepo/pnpm.** One root lockfile; root `overrides` pin react 19.2.3,
   worklets 0.10.0, reanimated 4.5.0 (Expo Go compatibility; a transitive drift here segfaulted
   the app natively and cost a day).
3. **Backend is Supabase + Next.js API routes, no Edge Functions.** Auth, RLS, entitlements and
   payments are LIVE. The Safepay webhook is a Next route; the planned AI proxy will be too. A
   second serverless pipeline earned nothing.
4. **Payments were pulled forward from M10 into the mobile stage** and work end to end in
   sandbox: hosted Safepay checkout behind a neutral `apps/web/lib/gateway/` seam, HMAC webhook,
   gateway confirm on return (Safepay has never delivered a webhook here; the confirm makes access
   independent of them), idempotent grants, real invoices. The Android app stays consumption-only
   (`docs/PAYMENTS-AND-PLAY-COMPLIANCE.md`); subscriptions deliberately unused (no auto-charge,
   and the copy promises none).
5. **Quality gate exists:** `npm run check` = 8 checks (lint + typecheck for core/mobile/web, an
   Expo dependency-drift check, and the web production build). Green is the definition of done.
6. **Delivery pipeline exists:** EAS builds (v0.2.0 APK shipped to the client) plus OTA channel
   `preview` for JS-only changes; Vercel auto-deploys web from `main`. EAS server environments
   hold the EXPO_PUBLIC keys, because cloud builds never see the gitignored `.env.local`.
7. **Design-system facts:** Lucide icons on both apps, one Roman Urdu register everywhere
   (aap + karein), safe-area breathing room, fixed-geometry rows and two-script toggles, real
   ElevenLabs narrations for the sample chapter.

## 2. Milestone status (contract dates unchanged)

| # | Due | Deliverable | Status 30 Jul |
| :- | :- | :--- | :--- |
| M1 | 1 Aug | Prototype + app on phone: onboarding, auth, nav, browse | **Done, submit now.** Real auth, APK on device; awaiting client sign-in confirmation |
| M2 | 12 Aug | Study module + offline | UI done; needs content-from-DB, real offline files, reading-progress sync |
| M3 | 17 Aug | Practice + tests + AI tutor (mobile) | All practice UIs done on local data; needs attempts sync + real AI proxy with quotas |
| M4 | 22 Aug | Progress + payments + push + sync | Payments DONE early; dashboards done on local data; needs push (FCM) + reminder cron |
| M5 | 29 Aug | Polish + Play submission | **At risk on Google's 14-day closed-testing clock, not on code**; account needed this week |
| M6 | 5 Sep | Landing + web auth | ~90% done early; needs legal pages + analytics; indexing stays off until M10 |
| M7 | 12 Sep | Admin CMS + study from DB | Not started; the only genuinely new surface; lives at `/admin` inside apps/web |
| M8 | 19 Sep | Practice types on web | UI done; needs DB wiring + study-state sync |
| M9 | 26 Sep | AI tutor + report cards (web) | Chat UI done; shares the mobile M3 AI route; parent-shareable report page is new |
| M10 | 30 Sep | Subscription + QA + web go-live | Sandbox payments done; remaining = live keys, wallets, key rotation, hardening |

## 3. The one big technical gap

**Study-state sync.** Attempts, results, reading progress, downloads, plan ticks, cards known,
chat threads and notifications are still device-local (AsyncStorage / localStorage). Identity and
entitlement already follow the account; study data does not. The pattern to copy is
`apps/mobile/src/store/auth.tsx`: server truth, per-user local cache, offline queue, hydrate on
sign-in. Build it once in `packages/core` for both apps (mobile plan M2.5 and M3.1, web plan M8.2).

## 4. Top risks, reordered by urgency

1. **Play Console closed testing** (12 testers, 14 days, personal accounts) back-counts from
   29 Aug to a testing build live by ~8 Aug. Account and testers are client actions; raise daily.
2. **Safepay production**: wallets come only via Raast, and Raast has no sandbox (support,
   30 Jul), so production onboarding is the only place wallet flows can be tested at all. KYC
   must start immediately; wallet UX gets verified with real Rs 100 payments after approval.
   Fallback: a PayFast provider behind the existing gateway seam, budgeted at one day.
3. **Client content** for M2: at least 2 real chapters by ~5 Aug. Fallback: the shipped FBISE
   sample, honestly labelled.
4. **Key hygiene before any external user**: rotate the Supabase service key and Safepay secrets
   (they passed through chat during the build), delete `demo@matricmate.pk`, re-run RLS checks.
5. **Expo Go native drift**: guarded by the `mobile · deps` check. Native dependencies require a
   version bump plus a rebuild, never OTA.

## 5. Needed from client/user, by date

- **This week:** Google Play Console account ($25) + 12 tester emails; Safepay production onboarding form submitted (Raast has no sandbox, so this is the only
  wallet test environment); key rotation done.
- **By 5 Aug:** first 2 real chapters (text plus any audio), or approve the sample as M2 content.
- **By 10 Aug:** Anthropic API key (into Vercel as `ANTHROPIC_API_KEY`, server-only, never
  EXPO_PUBLIC or NEXT_PUBLIC).
- **By 15 Aug:** Firebase project + FCM V1 service account for push (M4).
- **By M10:** domain decision (matricmate.pk was the working name), live Safepay keys, go-live
  approval.

## 6. Run-cost picture

Supabase free tier holds; Vercel hobby holds; EAS free tier holds (15 to 45 minute build queues
are the price); AI cost bounded by server-side quotas on Claude Haiku; narration TTS was a one-off
(the ElevenLabs key is already discarded). Launch run-cost still ≈ Rs 0 to 15k/mo until real
growth, which remains the client's top concern answered structurally.
