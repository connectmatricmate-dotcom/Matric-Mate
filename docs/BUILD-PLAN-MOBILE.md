# MatricMate · Mobile build plan (deep) · v2, 30 Jul 2026

Scope: `apps/mobile` (Expo SDK 57, Android first) plus the backend work its milestones require.
Contract milestones M1 to M5, $1,226, due 1 Aug to 29 Aug. Companion: `BUILD-PLAN-WEB.md`,
root `BUILD-PLAN.md` for the cross-cutting picture, `PAYMENTS-AND-PLAY-COMPLIANCE.md` for what the
Android app may never do (no price, no buy button, no payment link; consumption only).

Ground rules that already exist and must not regress:

- Entitlement is server truth. The phone reads `entitlements` under RLS, caches per-user in
  AsyncStorage, treats past `valid_till` as inactive. Nothing on the phone can grant.
- All copy lives in `packages/core/src/i18n/strings.ts`, one Roman Urdu register (aap + karein).
- `npm run check` green is the definition of done for every task below.
- JS-only changes ship over the air: `cd apps/mobile && npx eas-cli update --channel preview
  --environment preview -m "msg"`. New native deps require a version bump plus a new build.

## M1 · Prototype + app on client's phone (due 1 Aug) · STATUS: DONE, submit it

Everything contracted for M1 exists: onboarding, real Supabase auth, navigation, curriculum browse,
APK on the client's phone.

**Change request, 10 Aug: sign-in moves from email to phone number.** This was in the original job
post and was carried as an open question; Adnan has now settled it. See M1.5 below. It is a change
to delivered work, not new scope, and it does not reopen the milestone.

Remaining before submitting the milestone:

1. Client confirmation that APK build `9c05f0de` signs in on a real device (link in `handoff.md`).
2. Send Adnan the APK link plus `prototype/index.html` (the 56-screen clickable spec) as files.
   Nothing gets hosted; repo rule.
3. Known M1 debts to disclose honestly: content is sample FBISE data from
   `packages/core/src/content.ts`, not client content; study progress is device-local until M2.

## M1.5 · Phone number sign-in (change request, 10 Aug)

Students sign up with a phone number and a password. No email field anywhere in signup. **Decided
and locked**, with the reasoning in `docs/NOTIFICATIONS.md`.

Two decisions that are settled and should not be reopened:

- **We stay on Supabase.** No auth provider ships with a Pakistani SMS company built in, so moving
  to Clerk, Auth0, Appwrite or Firebase would land on the same wiring job after weeks of rework.
  Supabase's **Send SMS Hook** is generally available on the Pro plan and hands the code to our own
  function, which is about twenty lines.
- **Phone plus a password, not a code on every login.** A code goes out at signup to prove the
  number is real, and again on password reset. Sending one on every login would cost Rs 51,250 a
  month at 2,000 students against Rs 2,100, for the same student experience.

Tasks:

1. **Send SMS Hook** as a Supabase Edge Function: verify the webhook signature, compose the message
   text (this hook is also the only way to control the wording, which Pakistani branded SMS rules
   require), and call the SMS provider. Return a retryable status if the provider is down.
2. **Phone entry** on both apps. Students type `03001234567`; storage is `+923001234567`. The
   conversion happens once, on the way in. The `profiles.phone` column already exists and is
   validated, but nothing writes to it yet.
3. **Password reset, built by hand.** Supabase has no phone equivalent of its email reset. It is
   three calls: send a code, verify it to get a session, then set the new password.
4. **Abuse protection.** CAPTCHA on signup and on code requests, keep the per-user cooldown, and add
   a per-number limit inside the hook, which Supabase does not provide. Every code is real money, so
   an unprotected endpoint is a way to spend ours. If web auth calls go through our own server,
   enable the forwarding header or every student looks like one computer.
5. **Migrate the existing accounts.** While email sign-in still works, add a phone to each account
   and verify it. This keeps the same user ID and all their data. Only then turn email off. Doing it
   the other way round can lock those accounts out, so test on a throwaway project first.
6. **Sweep for email assumptions.** For a phone-only account the email field is empty. Check every
   screen showing the signed-in identity, every database rule or trigger referring to email, and
   anything that mails the account address.

Acceptance: a new student signs up with a phone number, receives a code, sets a password, and signs
in on a second device. An existing account keeps its data and its progress.

## M2 · Study module + offline (due 12 Aug)

Goal: real content served from Postgres, readable offline, with reading progress that survives
reinstall and follows the account.

Already done: reader UI, audio player (`expo-audio`, real narrations for the Dynamics sample),
downloads screen UI, chapter/section screens, Urdu medium rendering (Nastaliq), text-size setting.

Tasks, in order:

1. **Content schema migration** (`supabase/migrations/0004_content.sql`): `subjects`, `chapters`,
   `chapter_sections`, `flashcards`, `mcqs`, `audio_tracks`, all with `medium` ('en'|'ur') and
   `review_status` ('draft'|'review'|'published'). RLS: students SELECT published rows only.
   Keep ids compatible with the current static ids (`phy-3`, `phy3-f1`) so screens do not change.
2. **Ingestion script** (`scripts/ingest-content.mjs`): reads the existing static content out of
   `packages/core/src/content.ts` and upserts it, so day one the DB equals today's app. Then accepts
   client content as markdown/CSV drops in `content/` (gitignored). Runs with the service key from
   `apps/web/.env.local`.
3. **Fetch layer in core** (`packages/core/src/api.ts`): replace the static lookups with functions
   that take a Supabase client (both apps pass their own). Keep the current static data as the
   offline/dev fixture behind the same function signatures. Screens keep calling `api.getChapter`
   etc. through `useAsync`; no screen rewrites.
4. **Offline downloads for real**: `expo-file-system` for audio + a JSON snapshot of the chapter
   (sections, flashcards, mcqs) per downloaded chapter; `downloads` screen shows true MB from disk;
   reader and player prefer the local copy; delete removes files. Audio uploads move to Supabase
   Storage (`audio/` bucket, public read of published rows only via signed URLs or public bucket,
   decide by file sensitivity: lectures are not sensitive, public bucket is fine).
5. **Study-state sync, part 1** (the pattern for everything later): server tables
   `read_sections(user_id, section_id, chapter_id, read_at)` and `profiles.last_chapter_id/
   last_section_index` (or a `study_state` row). Write-through from the store with an offline
   queue in AsyncStorage (flush on reconnect, exactly the entitlement-cache pattern in
   `src/store/auth.tsx`). On sign-in on a new device, hydrate from server before seeding demo data,
   and stop seeding demo data for accounts that have any server state.
6. Client content: chase at least 2 real chapters by 5 Aug (user does this). Fallback stays the
   FBISE-derived sample, clearly labelled by `common.demoNote`.

Acceptance: airplane mode after download = chapter fully usable; reinstall + sign-in restores
reading position; a row flipped to `review_status='draft'` disappears from the app; check green.

## M3 · Practice + tests + AI tutor (due 17 Aug)

Already done: every practice UI (MCQ with confidence, timed exam, flashcards, blanks, short
questions, papers), results/XP/streak logic in `packages/core/src/domain.ts`, tutor chat UI with
quota UI. All of it local and mock.

Tasks:

1. **Attempts/results sync** (`0005_activity.sql` if not already in 0001: `attempts`,
   `test_results`, `cards_known`, append-only): same offline-queue pattern as M2.5. Derived stats
   (streak, accuracy, weak topics) keep computing client-side from synced rows; no server compute yet.
2. **Real AI tutor**: a server proxy, NOT keys in the app. Next.js route
   `apps/web/app/api/ai/tutor/route.ts` (Vercel already hosts our server; an Edge Function adds a
   second deploy pipeline for no gain). Auth: Supabase JWT from the app in the Authorization
   header, verified server-side. Model `claude-haiku-4-5-20251001`, streaming SSE, prompt-cached
   curriculum context per chapter. Quota: `ai_usage(user_id, day, used)` incremented
   transactionally server-side; 5 free / 20 premium (already the app's copy). The mobile chat
   screen swaps `api.askTutor` for the streaming call; keep the mock as offline fallback.
3. **AI MCQ generation** (`/api/ai/generate-mcqs`): batch per weak topic into `generated_mcqs`
   with `review_status='review'`; the AI-test screen consumes only rows a human approved (admin
   approves in web M7; until then, approve via Supabase Studio).
4. Needs from client: Anthropic API key (user adds to Vercel env as `ANTHROPIC_API_KEY`).

Acceptance: tutor answers stream on a phone with quotas enforced server-side (curl with a second
account cannot exceed its quota); attempts survive reinstall; AI test only serves approved MCQs.

## M4 · Progress + payments + push + sync (due 22 Aug)

Already done and live: the entire payments stack (web checkout, webhook + gateway confirm,
entitlement, invoices, mobile read-only display with Check again). Progress dashboards exist on
device-local data; M2/M3 sync makes them account-true automatically.

Tasks:

1. **Push notifications**, confirmed by the client and free to run: `expo-notifications` + Expo Push
   Service. Needs a Firebase project and an FCM V1 service account uploaded to EAS (client's Google
   account, their action). Firebase Cloud Messaging has no message limit and needs no card; we
   enable Cloud Messaging only, so nothing there can start charging. Adding the native module means
   a version bump to 0.3.0 and a new APK, it cannot ship over the air. Store
   `expo_push_tokens(user_id, token, platform)`.
2. **Renewal reminder job**: Vercel cron (`apps/web/app/api/cron/reminders/route.ts`, protected by
   `CRON_SECRET`) selects entitlements expiring in 2 days. This makes the app's own promise
   ("we remind you two days before") true.

   **Note the consequence of phone sign-in: there is no email address for most students.** The
   reminder goes by push first, because it is free, and falls back to WhatsApp for anyone who has
   notifications turned off or never granted permission. Email only applies to the few accounts
   that have one. Do not write this job assuming `user.email` exists.
3. **Streak reminder** (settings toggle already exists): same cron, respects
   `settings.streakAlerts`, which must therefore sync to `profiles`/`user_settings` (small table,
   same queue pattern).
4. Cross-device verification script: sign in on two devices, verify attempts/progress converge.

Acceptance: a plan expiring in 2 days produces a real notification on the phone; progress numbers
identical on two devices signed into one account.

## M5 · Polish + Play submission + launch (due 29 Aug)

The critical path is not code, it is Google's clock:

1. **Play Console closed testing: 12+ testers for 14 consecutive days before production access**
   (personal accounts). Back-count from 29 Aug: the closed-testing build must be live by 8 to
   10 Aug with testers enrolled. The account ($25) and D-U-N-S question must be settled THIS WEEK.
   This was flagged in v1 and is now urgent. User/client action; nothing in code unblocks it.
2. Production build: `eas build --profile production` (app-bundle, channel `production`,
   autoIncrement already configured). Create the production OTA policy: only tested commits get
   `eas update --channel production`.
3. Store listing: screenshots (Pixel + small phone), feature graphic, descriptions in the app's
   register; privacy policy + terms as real pages on the web app (also required by Play's Data
   safety form: declare Supabase auth data, no ads, no selling).
4. Hygiene before any external user: rotate the Supabase service key and Safepay secrets (user
   said he would; verify), delete `demo@matricmate.pk`, re-run the RLS spot checks, turn Sentry or
   `expo-insights` on for crash visibility (decide one; sentry-expo is heavier but real).
5. Device matrix pass: one low-RAM Android 10 to 12 phone (the user's older-phones worry), fonts,
   safe areas with hardware buttons, offline behavior.

Acceptance: app in closed testing track, listing complete, crash reporting live, no demo
credentials in production data.

## Standing risks (mobile)

- Play 14-day rule is the only hard external deadline; everything else flexes.
- Expo Go native drift: guarded by the `mobile · deps` check; never add a native dependency
  without a version bump and rebuild (see `handoff.md` for the worklets incident).
- Content dependency on the client from M2 onward; the fallback content is already shippable.
- **Sign-in now depends on the SMS provider.** If they are down, nobody can create an account. Email
  sign-in never had that dependency. This argues for the best-documented provider over the cheapest,
  and for the hook returning a retryable status rather than failing the signup outright.
- The branded sender name takes two to four weeks to clear. This need not block launch: a shared
  pre-approved sender works the same day at Rs 4.00 and we switch when ours is approved.
