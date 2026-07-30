# MatricMate · Web build plan (deep) · v2, 30 Jul 2026

Scope: `apps/web` (Next.js 16 App Router, Vercel, https://matric-mate-web.vercel.app): the student
web app, the landing page, checkout (the only place money moves), and, at M7, the admin CMS.
Contract milestones M6 to M10, $626, due 5 Sep to 30 Sep. Much of this stage was pulled forward
during the mobile stage, so these milestones are lighter than their dates suggest; the real work
left is content-from-DB, the admin CMS, the AI backend, and go-live hardening.

Ground rules that already exist and must not regress:

- `apps/web/CLAUDE.md` is binding: server components by default, `getUser()` never `getSession()`,
  streaming + skeletons, tokens only, every UI task starts with the frontend-design skill.
- Payments go through the provider seam `lib/gateway/` only. No route or component may import
  Safepay vocabulary directly; swapping provider (PayFast is the live fallback if Safepay never
  enables wallets) must stay an afternoon.
- Entitlement: never persisted to localStorage, refreshed on every load and auth change, expired
  `valid_till` counts as inactive, sign-out resets. Only the webhook or `confirmWithGateway` grant.
- The client store is a cache, never a doorman: anything that gates access decides server-side.

## M6 · Foundation + landing + onboarding + auth (due 5 Sep) · STATUS: ~90% pulled forward

Already live: landing page (hero demo, audio sample, Roman Urdu copy), full auth (signup, login,
reset via `/auth/callback`, open-redirect guard), onboarding, all app screens, favicons + OG
images, security headers, robots off until launch.

Remaining tasks:

1. **Legal pages for real**: `/terms` and `/privacy` as actual content pages (Play Store and
   checkout both point at them). Plain language, both mediums eventually; English first.
2. **SEO pass held behind the flag**: metadata is done; keep `NEXT_PUBLIC_ALLOW_INDEXING` false
   until M10 go-live. Add sitemap entries for legal pages.
3. **Analytics**: enable Vercel Web Analytics (zero-config) so the client sees traffic at handover.
4. Housekeeping: user fixes `NEXT_PUBLIC_SITE_URL` in Vercel env (the `lib/site.ts` guard makes
   this cosmetic, but tidy it).

Acceptance: milestone demo is just the live URL plus auth round-trip on a phone browser.

## M7 · Curriculum + admin CMS + study from DB (due 12 Sep)

The one genuinely new surface. Decision (supersedes v1's separate `apps/admin`): the CMS lives
inside `apps/web` under `/admin`, because auth, UI kit, Supabase clients and deploy already exist
there, and a second Next app is pure overhead at this budget.

Tasks:

1. **Roles**: migration `profiles.role` ('student'|'admin', default student). RLS stays
   student-scoped; admin reads/writes go through server actions using the service client AFTER a
   server-side role check (`requireAdmin()` helper in `lib/supabase/admin.ts`). proxy.ts adds
   `/admin` to PROTECTED plus a role gate in the admin layout.
2. **Curriculum manager**: CRUD for subjects → chapters → sections/flashcards/MCQs/audio, driven
   by the M2 content schema (`0004_content.sql`, see the mobile plan). List + editor pattern with
   the existing UI kit; markdown editor for sections (plain textarea + preview, nothing fancy).
3. **Review workflow**: every content row carries `review_status`; editors save as draft, a
   Publish action flips to published (students only ever see published, enforced by RLS, already
   the rule). Audit column `updated_by`.
4. **Audio upload**: direct upload to Supabase Storage from the admin (signed upload URL from a
   server action), writes the `audio_tracks` row.
5. **AI review queue**: table view of `generated_mcqs` with approve/reject; approved rows become
   real `mcqs`. This closes the loop M3 (mobile) opened.
6. **Study screens switch to DB**: the same `packages/core` fetch layer the mobile app adopts in
   M2; web screens already call `api.*` through the store, so this is wiring, not rebuilding.

Acceptance: client can add a chapter with sections and MCQs, publish it, and see it appear in both
apps without a deploy; an unpublished draft is invisible to students even via curl.

## M8 · Practice & tests on web (due 19 Sep) · STATUS: UI done, needs data

MCQs, fill-blanks, short questions, flashcards, past papers, timed tests all exist as screens with
parity to mobile. Tasks:

1. Point them at DB content (falls out of M7.6).
2. **Study-state sync on web**: adopt the same server tables + offline queue the mobile app gets
   in M2/M3 (attempts, results, read sections, cards known, plan ticks). The web store
   (`lib/persisted-store.ts`) keeps localStorage as cache only, same rule as premium today.
3. Past papers: real client PDFs into Storage, viewer keeps its zoom/download notes honest.

Acceptance: answer 10 MCQs on the phone app, open the website, dashboard and weak topics agree.

## M9 · AI tutor + AI features + report cards (due 26 Sep)

1. **Tutor on web**: same `/api/ai/tutor` route the mobile app uses (built in mobile M3), consumed
   by the existing chat screen with streaming; quotas shared because they live server-side.
2. **AI study planner**: "Today's plan" already computes locally in `packages/core/buildPlan`;
   keep the local heuristic, optionally season with weak-topic rows from the server. Do not spend
   AI tokens where a deterministic function already satisfies the contract line.
3. **Weak-topic test generator**: reuse `/api/ai/generate-mcqs` + approved-only consumption.
4. **Report card**: monthly aggregate from synced attempts; shareable as a public tokenized page
   (`/report/[token]`, no auth, no PII beyond first name) so parents need no account; PDF via
   browser print stylesheet, not a PDF library.

Acceptance: parent opens a shared report link on WhatsApp with no account; tutor quota shared
across devices.

## M10 · Subscription + QA + web go-live (due 30 Sep) · payments already work, this is hardening

Already done ahead of schedule: checkout, webhook (HMAC-SHA512, idempotent), gateway confirm on
return, entitlement, invoices, plan gating on both apps, sandbox end-to-end proof.

Tasks:

1. **Go live with Safepay**: production merchant keys (client's KYC must be finished; chase now,
   this is the M10 long pole), `SAFEPAY_ENV=production`, live webhook endpoint registered, new
   shared secret in Vercel, one real Rs 100 test payment end to end.
2. **Wallets = Raast, production only** (Safepay support, 30 Jul): JazzCash/Easypaisa arrive
   solely via Raast, and Raast does not exist in sandbox, so the sandbox stays card-only and
   wallet flows can only ever be tested in production. Consequence: task 1 starts NOW, and the
   first action after approval is a capabilities probe plus a Rs 100 Raast smoke test from a real
   Easypaisa/JazzCash app. In parallel, while KYC is in flight, open a Paymob Pakistan sandbox
   (reported to expose JazzCash/Easypaisa as separate, sandbox-testable integrations) so the
   fallback is evidence, not a guess. Either alternative sits behind `lib/gateway` at about one
   day. Both wallets are Raast participants, so the deciding questions are now UX friction (how
   many steps, does the payer return to our site) and lead time from KYC approval to Raast live,
   both asked of Safepay on 30 Jul.
3. **Security sweep before indexing**: rotate every shared key (Supabase service, Safepay,
   anything in `.env.local` the user pasted in chat), delete demo accounts, re-run RLS spot checks
   (scripts exist in session history; recreate as `scripts/rls-check.mjs` and add to check.mjs as a
   manual profile), confirm webhook rejects unsigned (401) in production.
4. **Go-live switches**: `NEXT_PUBLIC_ALLOW_INDEXING=true`, custom domain if the client bought one
   (matricmate.pk was the working name), Vercel analytics on, uptime ping.
5. **QA sweep + handover docs**: device/browser matrix, `docs/DEPLOYMENT.md` refreshed, admin
   walkthrough for Adnan (10-minute Loom-style doc or written).

Acceptance: a stranger can pay real rupees on the live site and get premium on their phone within
one app reopen; all keys rotated; indexing on.

## Standing risks (web)

- Safepay production KYC and wallet enablement are client-blocking and slow; start both now.
- Admin CMS is the only unbuilt surface; keep it boring (tables + forms from the existing kit).
- Study-state sync is shared plumbing for M8/M9; build it once in core with the offline queue, not
  twice per app.
- Budget honesty: M7 to M10 total $448; the pulled-forward payments work is the margin that makes
  the CMS affordable. Spend it there, not on polish the contract never bought.
