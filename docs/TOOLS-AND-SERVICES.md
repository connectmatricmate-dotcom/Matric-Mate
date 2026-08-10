# MatricMate · Tools, services and running costs

Complete list of every account, service and tool needed to take the Android app and the website
live, what each one costs, and who has to create it. Researched and price-checked on 10 Aug 2026
against the providers' own pricing pages. Rupee figures use Rs 278 = $1.

Nothing here is optional-but-unlisted. If a service is not on this page, we are not using it, and
section 7 lists the ones we deliberately rejected so the question does not come back later.

## How to read this

Every line says three things: **who** creates the account, **when** it is first needed, and whether
the cost is **one-time**, **fixed monthly**, or **usage-based**. Usage-based is the only category
that grows with the number of students, and section 8 models it at three sizes.

Order follows the build: mobile first (milestones 1 to 5, launch 29 Aug), then web (milestones 6 to
10, launch 30 Sep), then the backend both apps share.

## 1. The bill, in one table

| | Cost | Type | First needed |
| :-- | --: | :-- | :-- |
| Google Play Console | $25 | one-time | Now, blocks launch |
| Domain `matricmate.com.pk` | ~Rs 1,750/yr | yearly | In progress |
| Vercel Pro | $20/mo | fixed | First real payment |
| Supabase Pro | $25/mo | fixed | Mobile launch |
| Expo / EAS | Rs 0 | free tier | Already in use |
| Firebase (push) | Rs 0 | free tier | Milestone 4 |
| Cloudflare (DNS) | Rs 0 | free tier | At domain cutover |
| GitHub | Rs 0 | free tier | Already in use |
| Sentry, UptimeRobot | Rs 0 | free tier | Recommended at launch |
| Resend (email) | Rs 0 to $20/mo | free then fixed | Milestone 4 |
| Safepay | 1.5% to 5.9% per payment | usage | At go-live |
| Claude API (AI tutor) | ~Rs 1 per question | usage | Milestone 3 |
| WhatsApp Cloud API | ~Rs 3.50 per message | usage | Optional, M4 |

**Fixed cost once live: $45/month, about Rs 12,500.** Everything else is either free, one-time, or
moves with revenue and usage.

## 2. Mobile app

### 2.1 Google Play Console · $25 one-time · client creates

The only unavoidable one-time fee, and the item most likely to delay launch. No renewal.

What matters beyond the fee:

- **Twelve testers, fourteen continuous days.** A personal developer account cannot publish to
  production until twelve testers have been opted in and the app has been in closed testing for
  fourteen unbroken days. The number changed from twenty to twelve in December 2024. If a tester
  drops out and rejoins, their days do not add up across the gap.
- **New since April 2026: testers must actually use the app.** Google now checks engagement, not
  just installs. Twelve people who install and never open it can get the production request
  rejected. Tell the testers to open it a few times over the fortnight.
- **Identity verification:** a government photo ID matching the name on the Google Payments
  profile. **No D-U-N-S number is needed** for a personal account, that is an organisation-only
  requirement. Turnaround is reported as a few days, though Google does not publish a figure.
- **Pakistan card friction:** Pakistani banks often block international card transactions by
  default, which can make the $25 charge fail. Ask the bank to enable international transactions
  before trying. This is a widely reported practical issue rather than a Google restriction.
- **Payouts** to Pakistani bank accounts are supported, verified by small test deposits. We do not
  need this unless we ever sell through Play billing, which we deliberately do not.

**Deadline maths:** fourteen days of testing back-counted from the 29 Aug milestone means the
closed-testing build must be live and enrolled by roughly 8 to 10 Aug. This is the tightest date
in the whole project and it is a client action.

### 2.2 Expo and EAS · free · already in use

Builds the APK and ships over-the-air updates. The free tier covers us:

| | Free tier | Our usage |
| :-- | :-- | :-- |
| Android builds | 15/month | 5 to 15, fits |
| Build concurrency | 1 | fine |
| Queue priority | low | 15 to 60 min waits at peak |
| OTA update users | 1,000/month | few hundred at launch |
| Bandwidth | 100 GiB | nowhere near |

The only real cost of the free tier is **waiting**. Release-day builds can sit in the queue for an
hour during North American peak hours. The paid Starter tier is $19/month and buys priority plus a
build credit. **My recommendation: stay free and plan builds a day ahead.** Revisit only if OTA
users pass 1,000, which means real growth and a good problem.

### 2.3 Firebase Cloud Messaging · free · client's Google account

Push notifications (milestone 4). Confirmed still completely free in 2026 with no message limit,
on the free Spark plan, no credit card. We only enable Cloud Messaging, nothing else in Firebase,
so nothing there can start charging.

Two credentials are needed, and both come from the client's Google account:

1. **FCM V1 service account JSON**, uploaded to EAS. This is a secret and stays out of the repo.
2. **`google-services.json`**, referenced from the app config. Contains no secrets.

Expo still requires a Firebase project for Android push as of SDK 57. There is no way around it.

### 2.4 App signing · free · but the ownership matters most

EAS generates and holds the Android upload keystore. Google holds the separate app signing key
under Play App Signing, which every new app is enrolled in automatically.

**If the upload keystore is ever lost it is recoverable**, because of that enrolment: request an
upload key reset in Play Console, generate a new key, submit the certificate. Reported turnaround
is one to two business days. The old horror story about losing a keystore meaning a brand new
listing applies only to apps published before August 2021, not to us.

What the client must keep, forever:

- Admin ownership of the **Google Play Console account**. This is the real single point of failure.
- Ownership of the **Expo account** holding the credentials.
- Optionally, an exported copy of the keystore and its passwords, stored somewhere safe and never
  committed to git. This is cheap insurance that removes the reset wait.

### 2.5 Play Store listing assets · free, but someone has to make them

Already done and in the repo: app icon, adaptive icon (background, foreground, monochrome), splash
screen, notification icon, favicon, wordmark, and the web OG and Twitter images.

Still to produce before submission:

| Asset | Spec |
| :-- | :-- |
| Hi-res store icon | 512x512 PNG with alpha, under 1024 KB |
| Feature graphic | 1024x500 JPEG or PNG, no alpha, mandatory |
| Phone screenshots | 2 to 8 of them, 1080x1920 works |
| Short description | 80 characters |
| Full description | 4,000 characters |
| Privacy policy URL | required, must be publicly reachable |

Plus three forms inside Play Console: the **Data Safety** declaration (must list every SDK that
touches data, including Supabase and Sentry), the **IARC content rating** questionnaire, and the
**ads declaration** (ours is "no ads").

**One standing requirement we must not miss:** because the app has accounts, Play requires both an
in-app account deletion path and a **web URL that deletes an account without installing the app**.
That URL does not exist yet and needs building on the website.

**Good news on the deadline everyone else is scrambling for:** from 31 Aug 2026 all submissions
must target Android 16 (API 36). Expo SDK 57 already defaults to `targetSdkVersion` 36, so we
comply with no code change. Verified against Expo's SDK 57 documentation.

## 3. Website

### 3.1 Vercel · $20/month · client creates, we get added

Hosts the website. **The free Hobby plan cannot legally be used here.** Vercel's Fair Use terms,
updated 29 July 2026, restrict Hobby to non-commercial personal use and define commercial use as
including "any method of requesting or processing payment from visitors of the site". The moment
MatricMate takes one real rupee, the project must be on Pro.

Pro is $20/month per member and includes 1 TB of transfer, 10 million edge requests and 1 million
function invocations, all far beyond our scale. One seat is enough.

Note the timing: because mobile users pay through the web checkout, **Pro is needed from the mobile
launch on 29 Aug, not from the website launch on 30 Sep.**

Correction to our own `docs/DEPLOYMENT.md`: it says choosing the Mumbai region requires Pro. That
is no longer true, Vercel opened region selection to all plans. Pro is still required, but for the
commercial-use reason above. I will fix that line.

### 3.2 Domain · about Rs 1,750/year · client owns

`matricmate.com.pk`, being bought through the `domain.pk` reseller on a two-year term. The client
should hold the registrar login, not us.

### 3.3 Cloudflare · free · client creates

DNS only, sitting in front of Vercel. The free plan covers this completely. Every mail-related
record must be set to "DNS only" (grey cloud) rather than proxied, or email authentication fails
silently.

## 4. Shared backend

### 4.1 Supabase · $25/month · client creates

Database, authentication, file storage. Serves both apps.

**The free tier cannot be used in production for one specific reason: it pauses a project after
seven days of inactivity.** A quiet week means students open the app to an error. It also has no
backups. Both are unacceptable once real students depend on it.

| | Free | Pro |
| :-- | :-- | :-- |
| Database | 500 MB | 8 GB |
| File storage | 1 GB | 100 GB |
| Egress | 5 GB | 250 GB |
| Monthly active users | 50,000 | 100,000 |
| Daily backups | no | yes, 7 days |
| Pauses when idle | after 7 days | never |

**A billing trap worth knowing:** the $25 includes a $10 compute credit that exactly covers the
default Micro instance, so a normal project is a flat $25. If the database ever needs to move up to
Small, that is $5 more; Medium is $60 more. We have no reason to move above Micro at this scale,
but this is the usual reason people report surprise Supabase bills.

**The number to watch is egress, not storage.** I measured the shipped audio: narration runs about
130 kbps, so a full chapter in both mediums is roughly 20 MB, and the whole Class 9 curriculum
lands between 1.5 and 3 GB. Storage is fine. But every offline download pulls a whole file, so 500
students downloading twenty chapters each is about 200 GB a month, close to the 250 GB Pro
allowance. Overage is $0.09/GB. If audio downloads take off, a media CDN becomes the cheaper answer
(see section 7).

Region is South Asia (Mumbai), the closest to Pakistan, and it cannot be changed after creation.

### 4.2 Safepay · no fixed cost, percentage per payment · client's merchant account

Their pricing is public and there is no setup fee and no monthly fee. What we pay per successful
payment:

- **Domestic cards: 2.9% + Rs 30**
- International cards: 2.9% + 0.3% extra
- **Raast, which is how JazzCash and Easypaisa arrive: 1.5%**
- Instant payouts: 1.5% of the payout
- Chargeback: Rs 3,000 per dispute

That Rs 30 flat fee lands hard on a small ticket, and it changes how we should present checkout:

| Plan | Price | Card fee | Raast fee |
| :-- | --: | --: | --: |
| Monthly | Rs 1,000 | Rs 59 (5.9%) | Rs 15 (1.5%) |
| 3 months | Rs 2,700 | Rs 108 (4.0%) | Rs 40 (1.5%) |
| Yearly | Rs 9,000 | Rs 291 (3.2%) | Rs 135 (1.5%) |

At 500 monthly subscribers that is Rs 29,500 a month in card fees against Rs 7,500 on Raast, for
identical revenue. **Two conclusions: keep Raast as the visually default payment method, and push
the longer plans, where the flat Rs 30 amortises away.**

### 4.3 Claude API (the AI tutor) · usage-based · client's API key

**This is the largest running cost in the product and the one that scales fastest.** Using Claude
Haiku 4.5 at $1 per million input tokens and $5 per million output, a single tutor question costs
about Rs 1.

| Scenario | Monthly |
| :-- | --: |
| 100 premium students, ~6 questions a day | Rs 17,500 |
| 500 premium students, ~6 questions a day | Rs 87,500 |
| 500 premium students all maxing the 20/day quota | Rs 292,000 |

At 500 subscribers the revenue is Rs 500,000, so realistic usage puts AI at about 17% of revenue
while the worst case would take 58%. **The 20-question daily cap is not a product feature, it is
the cost ceiling**, and it must be enforced server-side where no client can raise it. Prompt
caching on the system and syllabus prefix cuts the realistic figure by roughly 40%, to about
Rs 54,000, and we should build it in from the start.

The key belongs in Vercel's environment variables as `ANTHROPIC_API_KEY`, server-side only. It must
never carry a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` prefix, which would ship it to every phone.

### 4.4 Resend (email) · free, then $20/month · client creates

Password resets, payment receipts, the "email me the link" flow, and expiry reminders. Free tier is
3,000 emails a month permanently, which covers launch; $20/month buys 50,000 if we outgrow it.

This is also a live bug, not just a future need: Supabase's built-in email sender is capped at
**two messages an hour** and their own docs say it is for demos only. Password reset does not
genuinely work for real users until this is configured.

### 4.5 WhatsApp Business Cloud API · about Rs 3.50 per message · optional

Covered in full in `docs/NOTIFICATIONS.md`. Worth paying for at exactly one moment, the renewal
reminder, which is roughly Rs 1,750 a month at 500 subscribers. Business verification takes one to
three weeks and needs SECP or sole-proprietor documents plus a live website, so it starts after the
domain resolves. Meta is making some currently-free message types chargeable on 1 October 2026.

## 5. Free tools already in use

No account or cost, listed for completeness so the picture is genuinely whole.

| Tool | What it does |
| :-- | :-- |
| GitHub | Code hosting, private repo, free |
| Node.js 22+ and npm | Build toolchain |
| Expo Go (Android app) | Testing on a real phone without a build |
| Android platform-tools (adb) | Crash log capture, `npm run android:log` |
| VS Code or any editor | Free |
| Vercel Web Analytics | Free, one switch at go-live |
| Google Search Console | Free, after indexing is turned on |

## 6. Recommended, free

| Tool | Free tier | Why |
| :-- | :-- | :-- |
| Sentry | 5,000 errors/month, 1 user | Know a student hit a crash before they tell you |
| UptimeRobot | 50 monitors, 5-minute checks | Know the site is down before the client does |

Sentry has an official Next.js SDK and an Expo config plugin, so both apps report into one place.
Its free tier is single-user, which is fine for us. If a second person ever needs access,
Highlight.io gives 15 seats free.

## 7. Deliberately not used, and why

So nobody proposes these later and wonders whether we forgot them.

| Not using | Why |
| :-- | :-- |
| SMS gateway | Costs about the same per message as WhatsApp, plus Rs 5,000 setup and Rs 5,000/year, needs a PTA short code, and the brand name does not even display on some networks. See `NOTIFICATIONS.md`. |
| Twilio or any international SMS | About Rs 132 per SMS to Pakistan, roughly 34 times a local provider, and the sender name gets replaced. |
| Apple Developer Program | $99/year. iOS is a future phase, not in this contract. An iOS build would not need a Mac, EAS compiles on its own. |
| Bunny.net CDN | In the original scope for video. Video is deferred, and audio currently fits inside Supabase. Revisit if audio egress approaches 250 GB a month. |
| Stripe, PayPal | Do not serve Pakistani merchants for this use case. |
| Google Play Billing | Deliberately avoided. Play takes 15 to 30%; we sell on the web instead, which policy explicitly permits. |
| Render, Railway, Fly, a VPS | Nothing to run. The backend is Postgres plus a few functions, which Supabase already is. |
| Dedicated email IP | Pays off above roughly 200,000 emails a month. We are 10x below that, and it would hurt. |

## 8. Total cost, three scenarios

**One-time, before launch**

| | |
| :-- | --: |
| Google Play Console | $25 (Rs 6,950) |
| Domain, 2 years | Rs 3,500 |
| **Total** | **about Rs 10,500** |

**Fixed monthly, from mobile launch**

| | |
| :-- | --: |
| Vercel Pro | $20 |
| Supabase Pro | $25 |
| Everything else on free tiers | $0 |
| **Total** | **$45, about Rs 12,500** |

**Adding usage, at three sizes**

| | 100 paying | 500 paying | 2,000 paying |
| :-- | --: | --: | --: |
| Revenue | Rs 100,000 | Rs 500,000 | Rs 2,000,000 |
| Fixed infrastructure | Rs 12,500 | Rs 12,500 | Rs 12,500 |
| AI tutor (realistic use, cached) | Rs 10,500 | Rs 54,000 | Rs 216,000 |
| Safepay (mixed card and Raast) | Rs 4,000 | Rs 19,000 | Rs 75,000 |
| WhatsApp reminders | Rs 350 | Rs 1,750 | Rs 7,000 |
| Possible Supabase egress overage | Rs 0 | Rs 0 | Rs 15,000 |
| **Total cost** | **Rs 27,000** | **Rs 87,000** | **Rs 325,000** |
| **As % of revenue** | 27% | 17% | 16% |

The shape is healthy: cost as a share of revenue falls as students are added, because the fixed
$45 spreads out. The number that decides everything is AI usage per student, which is exactly what
the daily quota controls.

## 9. Who should own each account

**Every account should be created under the client's email, with us added as a member.** Two
reasons: at handover there is nothing to migrate, and no bill ever lands on the wrong card.

| Account | Owner | Notes |
| :-- | :-- | :-- |
| Google Play Console | Client | Cannot be transferred easily. Must be right first time. |
| Google account for Firebase | Client | Same account is fine |
| Vercel | Client | Add us as a member |
| Supabase | Client | Add us as a member |
| Safepay merchant | Client | KYC is in their legal name |
| Domain registrar | Client | |
| Cloudflare | Client | |
| Anthropic API | Client | Their card, their usage |
| Resend | Client | |
| Expo | Either | Holds build credentials, hand over at the end |
| GitHub | Currently ours | Transfer or add the client at handover |

## 10. Keys and where each one lives

Read from the code, not from memory. No secret is ever committed; `.env.local` is gitignored.

**Vercel environment variables (website)**

| Name | Secret | Purpose |
| :-- | :-- | :-- |
| `NEXT_PUBLIC_SUPABASE_URL` | no | Backend address |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no | Browser-safe key, protected by row-level security |
| `SUPABASE_SECRET_KEY` | **yes** | Bypasses row-level security. Server only. |
| `SAFEPAY_ENV` | no | `sandbox` or `production` |
| `SAFEPAY_MERCHANT_API_KEY` | **yes** | |
| `SAFEPAY_SECRET_KEY` | **yes** | |
| `SAFEPAY_WEBHOOK_SECRET` | **yes** | Verifies webhooks are genuinely from Safepay |
| `NEXT_PUBLIC_SITE_URL` | no | Changes at domain cutover |
| `NEXT_PUBLIC_ALLOW_INDEXING` | no | Stays `false` until go-live |

Arriving with later milestones: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, and the
WhatsApp token and phone number ID. All server-side secrets.

**EAS environment variables (mobile), set per environment for development, preview and production**

| Name | Purpose |
| :-- | :-- |
| `EXPO_PUBLIC_SUPABASE_URL` | Backend address |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe key |
| `EXPO_PUBLIC_SITE_URL` | Where subscription links point |

Anything with an `EXPO_PUBLIC_` or `NEXT_PUBLIC_` prefix ships to the user's device and is readable.
Never give a real secret one of those prefixes.

**Gap to fix:** there is no `.env.example` in the repo, and `.gitignore`'s `.env.*` rule would
silently ignore one if added. A new developer therefore has no checked-in list of required keys.
Worth adding the file plus a `!.env.example` exception.

## 11. Local setup for any future developer

```bash
node -v            # needs 22 or newer
npm install        # from the repo root, one lockfile for all three packages
npm run check      # 8 checks: lint, typecheck and build for core, mobile and web
npm run web        # website at localhost:3000
npm run mobile:go  # scan the QR with Expo Go on Android
npm run android:log  # native crash logs over adb
```

Two `.env.local` files are needed, one in `apps/web` and one in `apps/mobile`, using the tables in
section 10. Neither is in git.

## 12. What the client needs to do, in order

| When | Action | Blocks |
| :-- | :-- | :-- |
| **Immediately** | Create Google Play Console, pay $25, enable international transactions on the card first | The whole Play launch |
| **Immediately** | Recruit 12 testers and brief them to actually open the app during the fortnight | 14-day clock, latest start 8 to 10 Aug |
| **Immediately** | Start Safepay production onboarding | Every real payment, and all wallet testing |
| Finish the domain purchase | Paste Cloudflare's nameservers into the reseller | Domain cutover, WhatsApp verification |
| Before mobile launch | Create Vercel and Supabase, upgrade both to paid | Legal use and no idle pausing |
| By ~10 Aug | Provide an Anthropic API key | AI tutor, milestone 3 |
| By ~15 Aug | Create the Firebase project, generate the FCM service account | Push notifications, milestone 4 |
| Before any real user | Write the privacy policy, provide the account-deletion URL | Play submission |
| Before any real user | Rotate every key shared during development, delete the demo account | Security |

## Things I could not verify

Stated plainly rather than guessed:

- Exact Play identity-verification turnaround for individuals. Google publishes no figure; a few
  days is the common report.
- Exact upload-key-reset turnaround. Estimates range from one to two business days.
- Whether a failed EAS build consumes the free build quota. Not documented.
- Whether Pakistani bank cards reliably work for Meta's WhatsApp billing.
- PayFast and Paymob merchant rates. PayFast is roughly 3% per third-party sources; Paymob
  publishes nothing. Safepay's figures above are from their own public pricing page.
