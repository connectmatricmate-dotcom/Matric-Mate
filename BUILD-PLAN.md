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
3. **Backend is Supabase + Next.js API routes.** Auth, RLS, entitlements and payments are LIVE. The
   Safepay webhook is a Next route; the planned AI proxy will be too. One Supabase Edge Function is
   now in the picture, the Send SMS Hook in point 4; everything else stays a Next route.
4. **Sign-in is by phone number, not email** (client decision, 10 Aug, settling a question carried
   from the original job post). Phone plus a password, with a verification code at signup and at
   password reset only. **We stay on Supabase**: no auth provider ships with a Pakistani SMS company
   built in, so switching would repeat the same wiring job after weeks of rework, and Supabase's
   Send SMS Hook routes the code to a local provider in about twenty lines. Sending a code on every
   login instead would cost Rs 51,250 a month at 2,000 students against Rs 2,100. Detail in
   `docs/NOTIFICATIONS.md`, tasks in the mobile plan under M1.5.
5. **Payments were pulled forward from M10 into the mobile stage** and work end to end in
   sandbox: hosted Safepay checkout behind a neutral `apps/web/lib/gateway/` seam, HMAC webhook,
   gateway confirm on return (Safepay has never delivered a webhook here; the confirm makes access
   independent of them), idempotent grants, real invoices. The Android app stays consumption-only
   (`docs/PAYMENTS-AND-PLAY-COMPLIANCE.md`); subscriptions deliberately unused (no auto-charge,
   and the copy promises none).
6. **Quality gate exists:** `npm run check` = 8 checks (lint + typecheck for core/mobile/web, an
   Expo dependency-drift check, and the web production build). Green is the definition of done.
7. **Delivery pipeline exists:** EAS builds (v0.2.0 APK shipped to the client) plus OTA channel
   `preview` for JS-only changes; Vercel auto-deploys web from `main`. EAS server environments
   hold the EXPO_PUBLIC keys, because cloud builds never see the gitignored `.env.local`.
8. **Design-system facts:** Lucide icons on both apps, one Roman Urdu register everywhere
   (aap + karein), safe-area breathing room, fixed-geometry rows and two-script toggles, real
   ElevenLabs narrations for the sample chapter.

## 2. Milestone status (contract dates unchanged)

| # | Due | Deliverable | Status 30 Jul |
| :- | :- | :--- | :--- |
| M1 | 1 Aug | Prototype + app on phone: onboarding, auth, nav, browse | **Done.** Real auth, APK on device. Sign-in moves from email to phone as a change request; see mobile plan M1.5 |
| M2 | 12 Aug | Study module + offline | UI done; needs content-from-DB, real offline files, reading-progress sync |
| M3 | 17 Aug | Practice + tests + AI tutor (mobile) | All practice UIs done on local data; needs attempts sync + real AI proxy with quotas |
| M4 | 22 Aug | Progress + payments + push + sync | Payments DONE early; dashboards done on local data; needs push (FCM, client confirmed, free) + reminder cron. Reminders cannot assume an email address any more |
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
   Fallback: Paymob (sandbox-testable direct wallets, to verify) or PayFast, either behind the
   existing gateway seam at about one day.
3. **Client content** for M2: at least 2 real chapters by ~5 Aug. Fallback: the shipped FBISE
   sample, honestly labelled.
4. **Key hygiene before any external user**: rotate the Supabase service key and Safepay secrets
   (they passed through chat during the build), delete `demo@matricmate.pk`, re-run RLS checks.
5. **Expo Go native drift**: guarded by the `mobile · deps` check. Native dependencies require a
   version bump plus a rebuild, never OTA.

## 5. Needed from client/user, by date

- **This week:** Google Play Console account ($25) + 12 tester emails; Safepay production onboarding form submitted (Raast has no sandbox, so this is the only
  wallet test environment); key rotation done.
- **This week, new:** SMS sender-name registration, because sign-in now depends on it. Needs an FBR
  NTN with "MatricMate" as the registered trade name, a CNIC front and back, and a stamped
  letterhead. Two to four weeks to clear, so it starts now. A registered company is not required.
- **By 5 Aug:** first 2 real chapters (text plus any audio), or approve the sample as M2 content.
- **By 10 Aug:** Anthropic API key (into Vercel as `ANTHROPIC_API_KEY`, server-only, never
  EXPO_PUBLIC or NEXT_PUBLIC).
- **By 15 Aug:** Firebase project + FCM V1 service account for push (M4).
- **By M10:** live Safepay keys, go-live approval. Domain is settled: `matricmate.com.pk`.

## 6. Run-cost picture

Superseded by `docs/TOOLS-AND-SERVICES.md`, which prices every service against the providers' own
pages. Headline: **Rs 25,450 one-time and about Rs 18,200 a month fixed**, plus usage. The free
tiers no longer hold, and each for a specific reason: Vercel's licence bars commercial use, Supabase
Free pauses after a week idle and has no backups, and the EAS free tier queues release builds for
an hour and caps over-the-air updates at 1,000 users.

Usage cost is dominated by the AI tutor at about Rs 1 a question, which the daily quota exists to
cap. At 500 paying students the all-in figure is roughly Rs 93,000 a month against Rs 500,000
revenue, and the share of revenue falls as students are added.
