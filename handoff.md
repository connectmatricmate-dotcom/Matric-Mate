# Handoff · MatricMate session state

Local working note for the next agent. Do NOT commit this file: repo rule says assistant files stay
out of git (see root CLAUDE.md, "Assistant files stay local"). Read root `CLAUDE.md` and
`apps/web/CLAUDE.md` before touching anything; they carry hard rules (no em dashes anywhere, no AI
attribution in commits, git identity is preconfigured, never use `gh` for git operations here).

## 1. Goal

Ship MatricMate (FBISE Class 9 exam prep, client Adnan via Upwork) as a working prototype on two
surfaces from one repo: `apps/mobile` (Expo SDK 57 Android APK + Expo Go) and `apps/web`
(Next.js 16 on Vercel, https://matric-mate-web.vercel.app). This session took it from "static
prototype with mock auth" to: real Supabase auth on both apps, a working Safepay sandbox payment
flow with server-side entitlement, real invoices, one Roman Urdu register across all copy, Lucide
icons, safe-area and geometry fixes, real ElevenLabs narrations, and a shareable v0.2.0 APK.

## 2. Current State

Working and verified:

- Repo is clean, everything pushed. HEAD = `239dacf` ("Put the Supabase keys where cloud builds can
  see them") on `main`, in sync with origin.
- `npm run check` passes all 8 checks (lint + typecheck for core/mobile/web, mobile dep-drift
  check, web production build).
- **Final shareable APK (auth works, everything baked in):** build `9c05f0de`, direct download:
  https://expo.dev/artifacts/eas/dC_bN9EfT7bC1CfOpOOG7jhBT-VgoJD8UcVr-Whn3D4.apk
  Runtime 0.2.0, channel `preview`. This is THE link for the user/Adnan. Older links (build
  `10afb2c8` and earlier) had broken auth on first launch; they self-heal via OTA but stop sharing them.
- OTA pipeline works: `eas update --channel preview --environment preview -m "..."` from
  `apps/mobile`. JS-only changes need NO rebuild. Latest update group `3ba0e2ef` carries the env fix.
- Web auth, checkout, webhook + gateway-confirm, entitlement, payment history: all real and tested
  against live Supabase (project `aueallnkfhipyneqtllp`). The user's own account
  (chharoonali786@gmail.com) is premium, plan `year`, till 2027-07-24, from a real sandbox payment.
- EAS server environments (development/preview/production) now hold
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SITE_URL`;
  `eas.json` build profiles are pinned to their environments.

Half-done / not started (the known big gap):

- **Study-state sync**: attempts, results, reading progress, downloads, plan ticks, cards known,
  chat threads, notifications still live in localStorage (web) / AsyncStorage (mobile). Postgres
  tables exist in `supabase/migrations/0001_init.sql` but nothing writes to them. Flagged to the
  user repeatedly; not yet commissioned.
- "Email me the link" button in mobile `LockedNotice` only shows a toast; nothing sends (needs an
  email provider such as Resend). User was told.
- JazzCash/Easypaisa absent from Safepay checkout: account-side provisioning, not code.
  Capabilities API shows `CARD:false, CYBERSOURCE:true, PAYFAST:true(data:[]), no EASYPAISA`.
  User must ask Safepay support to enable wallet instruments.

Broken right now: nothing known. The last user-reported bug ("undefined is not a function" on
mobile sign-in in the APK) is fixed at `239dacf`; user has not yet re-confirmed on device.

## 3. Files In Play (this session's footprint, all committed and pushed)

Mobile (`apps/mobile/`):
- `src/lib/supabase.ts` · Supabase client; URL polyfill first import; never throws at module scope;
  deep `unusable()` proxy that rejects readable when keys missing.
- `src/store/auth.tsx` · new AuthProvider: session, entitlement (server truth, cached per-user in
  AsyncStorage, expiry computed client-side), signIn/signUp/signOut/reset/updateName/refresh.
- `src/store/app.tsx` · mock signIn/subscribe removed; overlays auth user + entitlement onto
  `state.user`/`state.premium` so screens didn't change.
- `app/login.tsx`, `app/signup.tsx`, `app/forgot.tsx` · real Supabase auth screens.
- `app/index.tsx` · splash gate waits for both hydration and auth loading.
- `app/account/{index,edit,subscription,settings}.tsx` · real signOut, profile rename to `profiles`
  row, "Check again" entitlement refresh, plan+billing section in settings.
- `app/onboarding/medium.tsx` · duplicate Nastaliq title removed.
- `app/(tabs)/index.tsx` · clock read once (`useState(() => Date.now())`), quick-tile min height.
- `app/session/{setup,mcq,flashcards}.tsx`, `app/insights/performance.tsx`, `app/tutor/chat.tsx` ·
  hook-correctness fixes from first lint run (render-time adjustment, lazy Animated.Value, etc).
- `src/core/useAsync.ts` · rewritten: string key deps, derived `loading`, `reload` via counter.
- `src/components/ui.tsx` · Seg fixed-height + overflow clip, no elevation on selected segment;
  Kpi height floor; Skeleton/ToastHost lazy Animated values; Screen adds breathing room past
  safe-area insets (topGap/bottomGap).
- `src/components/LanguageToggle.tsx` · rebuilt: Latin "Urdu" label, radius+bg+clip on pressable.
- `src/components/Icon.tsx` · Lucide (`lucide-react-native`), `Record<IconName, LucideIcon>` map.
- `index.js` · custom entry: URL polyfill before everything + global startup error logger.
- `eas.json` · profiles pinned to EAS environments; `app.json` · v0.2.0, schema fixes.
- `assets/audio/dynamics-{en,ur}.mp3` · regenerated with ElevenLabs (Alice EN, Reva Urdu).

Web (`apps/web/`):
- `lib/gateway/{index,types,safepay,safepay-api}.ts` · provider seam: startCheckout, verify/parse
  webhook, parseReturn, getPaymentStatus (reads `/order/v1/{tracker}`); all Safepay vocabulary
  behind this boundary. `safepay-customer.ts` deleted (orphan records).
- `lib/payments.ts` · `confirmWithGateway()` (settle on return; guards: row exists, owner matches,
  amount matches) + existing idempotent `markPaidAndGrant`.
- `app/api/checkout/route.ts` · goes through gateway; phone requirement removed.
- `app/api/webhooks/safepay/route.ts` · thin: verify → parse → act; raw body preserved.
- `app/checkout/{page,return,success}` · server-driven login gate (accountEmail), unsigned return
  is normal, success page confirms with gateway, `force-dynamic`.
- `lib/supabase/middleware.ts` · `/checkout/return` public inside protected branch (cross-site POST
  carries no cookie).
- `lib/safe-path.ts` + `app/(auth)/actions.ts` + `app/auth/callback/route.ts` · open-redirect guard
  (`/\` and `//` and whitespace refused); signup handles no-session (email confirmation) case.
- `components/auth/SignUpForm.tsx` · check-inbox state.
- `lib/store.tsx` / `lib/persisted-store.ts` · premium never persisted to localStorage; refreshed
  every load/auth change; expiry rule; sign-out resets; `refreshPremium` action; mock signIn
  removed, `setName` added.
- `components/screens/{PaymentsView,SubscriptionView,EditProfile,SettingsView}.tsx` · real invoices
  from `payments` table, Check again button, real profile rename, plan+billing section.
- `components/commerce/CheckoutForm.tsx` · no phone field; names the account premium lands on.
- `components/ui/primitives.tsx` · Icon → `lucide-react` (Check aliased CheckGlyph); Kpi height floor.
- `components/app/{Page,Shell}.tsx` · CardGrid cells stretch; named Settings link in sidebar.
- `components/screens/DashboardView.tsx` · quick-tile Link passes h-full.

Shared / root:
- `packages/core/src/i18n/strings.ts` · entire `ur` dictionary rewritten in one register
  (aap+karein, jaari/mein/nahi/zaban spellings, English loanwords kept); placeholder parity
  machine-verified against `en`. Hassan Ali placeholder.
- `packages/core/src/{api,domain}.ts` · tum-register lines converted to aap; mock auth deleted.
- `packages/core/src/icons.ts` · names only (`ICON_NAMES`, `IconName`, `SUBJECT_ICON`); path data gone.
- `packages/core/eslint.config.mjs` (new), `apps/mobile/eslint.config.js` (new).
- `scripts/check.mjs` (new) · the 8-check runner. `scripts/android-crashlog.sh` (new) · adb logcat
  helper; adb lives at `~/.local/share/android-platform-tools/adb`.
- Root `package.json` · `overrides` pin react/react-dom 19.2.3 + worklets 0.10.0 + reanimated 4.5.0;
  scripts `check`, `mobile:go`, `mobile:tunnel`, `android:log`.
- `docs/PAYMENTS-AND-PLAY-COMPLIANCE.md` · subscriptions decision, accounts/consumption-only
  reasoning, country table. `docs/URDU-COPY-REVIEW.md` · full string inventory (historical
  reference; the register has since been rewritten).

## 4. Changes Made (decisions, in order of importance)

- Entitlement is server truth everywhere; only the Safepay webhook or `confirmWithGateway` can
  grant; clients (both apps) can only SELECT their own row (RLS verified empirically).
- Payments settle on return via authenticated gateway lookup because **no Safepay webhook has ever
  been delivered** to this endpoint; webhook remains the fast path.
- Consumption-only Android app (Google Play): no price/link/buy in APK; in-app signup IS allowed
  (policy quote in compliance doc). Subscriptions deliberately not used (no auto-charge promise).
- One register for Roman Urdu ("tutor texting his class group"); toggles say "Urdu" in Latin;
  the only Nastaliq in chrome is landing "English & اردو medium" (user-protected).
- Icons: Lucide on both apps behind the existing `Icon name=` API.
- Version 0.2.0 separates runtimes so the old 0.1.0 APK can never receive mismatched OTA JS.
- npm workspaces quirk: `npm install` does NOT retro-apply overrides; stale lockfile entries must be
  deleted from `package-lock.json` (or the copies rm'd) before reinstall. Happened twice.

## 5. What I Tried That Failed (do not repeat)

- **Expo Go crash hunting by hypothesis**: the URL-polyfill fix was real but not the crash. The
  actual killer was transitive `react-native-worklets` 0.10.3 JS vs Expo Go's 0.10.0 native
  (SIGSEGV in `libworklets.so`, found only via `adb logcat` tombstone). Lesson: for silent native
  crashes, go straight to `npm run android:log`; do not iterate guesses.
- **Safepay guest session / `auth_token` to pin payer email on hosted checkout**: does nothing in
  payment mode; the page reads `auth_token` only in the subscribe flow (verified in their bundle).
  Email cannot be prefilled on hosted checkout, full stop. Sending payer fields on `/order/v1/init`
  is silently ignored (tested four shapes).
- **`source=custom` on hosted checkout**: not in Safepay's enum; post-payment you land on a dead
  "Close" dialog. `webhooks=true` is what makes the page redirect back. Their return is a GET with
  order_id+tracker and NO signature; do not treat missing signature as suspicious.
- **@sfpy/node-core SDK**: only wraps `/order/payments/v3` (the wrong tracker family for hosted
  checkout) and has no webhook verification. Do not adopt it for the hosted flow.
- **Waiting for Safepay webhooks**: never arrived, ever. Don't build anything that depends on them
  as the only path.
- **Shallow Proxy fallback for a missing Supabase client**: produced "undefined is not a function"
  in the client APK. Fallbacks must survive arbitrary chain depth and reject readable on await.
- **Assuming EAS builds see `.env.local`**: they never do (gitignored). All EXPO_PUBLIC config must
  live in EAS server environments, and updates must pass `--environment`.
- **`eas update` output filtered through grep**: swallowed a hard failure once (`--environment`
  required in non-interactive mode) and I reported success wrongly. Always check
  `eas update:list --branch preview` after publishing.
- **prettier on mobile files**: repo has no prettier config; it rewrote quote style. Don't run it.
- **`urdu()`/Nastaliq inside fixed-height controls with per-script line heights**: two-height pills.
  One fixed lineHeight for both scripts, `includeFontPadding:false`, clip on the pressable.

## 6. Open Questions / Assumptions

- User has NOT yet confirmed the final APK (`9c05f0de`) signs in on his Pixel. Assume unverified
  until he says so; the fix chain is committed but device confirmation is the missing proof.
- Email confirmation is OFF in Supabase (verified empirically); signup goes straight in. If the
  user turns it on, flows already handle it (check-inbox states exist).
- Web on Vercel: user manages env vars there himself; `SAFEPAY_WEBHOOK_SECRET` was probed present
  (webhook returns 401 not 500). `NEXT_PUBLIC_SITE_URL` may still be localhost in Vercel;
  `lib/site.ts` guards this by falling back to the Vercel URL.
- Shared keys in `apps/web/.env.local` (Supabase service role, Safepay secrets): user said he will
  rotate them. Not rotated yet as far as known. Demo account `demo@matricmate.pk / MatricMate2026`
  may still exist; delete before launch.
- Assumption baked into copy: plans never auto-charge (no subscriptions). Any future auto-renew
  work must revisit copy in both languages plus `docs/PAYMENTS-AND-PLAY-COMPLIANCE.md`.
- `handoff.md` and the user's screenshots (`image*.png`) are untracked on purpose; leave them out
  of git.

## 7. Next Steps (ordered)

1. Get user confirmation that APK `9c05f0de` signs up/logs in on-device (or capture proof yourself:
   `npm run android:log` with his phone on USB/wireless debugging, then drive the login).
2. Study-state sync (the big remaining milestone): move attempts/results/readSections/planDone/
   downloads/cardsKnown/threads/notifications from local storage to the existing Postgres tables,
   mobile and web, with offline cache semantics like `store/auth.tsx` uses for entitlement.
3. Wire "Email me the link" (mobile LockedNotice) to a real sender (Resend) or soften its copy so
   it stops claiming an email was sent.
4. Chase Safepay support (user does this) to enable JazzCash/Easypaisa; message to send them is in
   the session notes: capabilities shows PAYFAST enabled with empty data, CARD false, EASYPAISA absent.
5. Before client handover: rotate shared keys, delete the demo account, re-run the RLS spot checks.
6. Nice-to-have: replace the `?` resolver miss in the drift sweep (expo-symbols) if the sweep is
   ever scripted into check.mjs.

## 8. How to Resume

Open this file, then run `git log --oneline -15` and `npm run check` from the repo root (expect all
8 green). The three files that explain the architecture fastest are `apps/mobile/src/store/auth.tsx`
(mobile identity/entitlement), `apps/web/lib/gateway/index.ts` (payment seam), and
`packages/core/src/i18n/strings.ts` (all copy, both languages). Mobile dev loop:
`npm run mobile:go -- --clear` and scan with Expo Go SDK 57; native crash triage:
`npm run android:log`. OTA after any JS-only mobile change:
`cd apps/mobile && npx eas-cli@latest update --channel preview --environment preview -m "msg"`,
then verify with `update:list --branch preview`. Web deploys itself on push to main. The current
shareable APK link is in section 2; anything older is superseded.
