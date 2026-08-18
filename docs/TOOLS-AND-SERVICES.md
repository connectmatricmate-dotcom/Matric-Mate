# MatricMate · Required tools and services

Every account and service needed to run the Android app and the website. Prices taken from each
provider's own pricing page on 10 Aug 2026. Rupee figures use Rs 278 = $1.

This is the complete list. Nothing is left out, and section 6 names the tools we deliberately do
not use so the question does not come back later.

## 1. The total

| | Cost |
| :-- | --: |
| One-time setup | **Rs 25,450** |
| Fixed monthly | **about Rs 18,200** |
| Per payment and per use | see section 5 |

## 2. Required accounts

Two lines below changed on 18 Aug and are worth reading before budgeting: SMS and WhatsApp are no
longer used at all, and Vercel does not need to be Pro because the scheduled jobs moved to
Supabase, which is already paid for. Push and email cost nothing at this size.


| Service | What it is for | Cost | Owner |
| :-- | :-- | --: | :-- |
| Google Play Console | Publishing the Android app | $25 one-time | Client |
| Expo EAS, Starter plan | Building the app, over-the-air updates | $19/mo | Client |
| Vercel | Hosting the website | Hobby today, Pro if crons ever return to it | Client |
| Supabase Pro | Database, accounts, file storage, **and all scheduled jobs** | $25/mo | Client |
| Domain `matricmate.com.pk` | The web address | ~Rs 1,750/yr | Client |
| Cloudflare | DNS | Free | Client |
| Firebase (Cloud Messaging only) | Push notifications, Android and web | Free, no card | Client · **live since 18 Aug** |
| Anthropic (Claude) | The AI tutor | Per use | Client |
| Safepay | Taking payments | Per payment | Client |
| ~~SMS aggregator (SendPK)~~ | Not used. Dropped 18 Aug with phone sign-in | Rs 0 | n/a |
| Resend | Sending email | Free to 3,000/mo, then $20/mo | Client · **key live, domain unverified** |
| ~~WhatsApp Business API~~ | Built and removed 18 Aug at the client's request | Rs 0 | n/a |
| GitHub | Code storage | Free | Us, transferred at handover |
| Sentry | Crash reporting | Free | Either |
| UptimeRobot | Downtime alerts | Free | Either |

## 3. Mobile app

### Google Play Console · $25 one-time

No renewal. Three things come with it that are not about money:

- **Twelve testers for fourteen unbroken days** before the app can go to production. If a tester
  drops out and rejoins, the days do not add up across the gap.
- **Testers must actually open the app**, not just install it. Google added this check in April
  2026 and rejects production requests where the twelve names never used it.
- **A government photo ID** matching the name on the Google Payments profile. No D-U-N-S number is
  needed for a personal account, that is an organisation requirement.

Pakistani banks often block international card payments by default, so the card needs international
transactions enabled before the $25 charge will go through.

### Expo EAS, Starter plan · $19/month

Compiles the APK and delivers over-the-air updates. **The free tier does not suit this project.**
It allows one build at a time at the lowest queue priority, and release-day builds sit waiting for
an hour or more. It also caps over-the-air updates at 1,000 users a month, which a launched app
passes quickly.

Starter fixes both: high-priority queue, faster build machines, 3,000 over-the-air users, and $45
of build credit a month, which covers about 45 Android builds against the free tier's 15.

### Firebase · free

Push notifications from the app, which the client has confirmed he wants. Free in 2026 with no
message limit and no credit card, on Google's free plan. We enable Cloud Messaging only, so nothing
else in Firebase can start charging. Expo requires a Firebase project for Android push, there is no
way around it.

Two files come from it: a service account key (secret, kept out of the code) and
`google-services.json` (not secret).

Two limits worth knowing. Adding push means a new version of the app, because it is a native change
that cannot be delivered over the air. And it only reaches students who installed the app and
allowed notifications, so it can never be the only channel for something that matters, such as a
renewal reminder.

### App signing · free, but ownership matters

Expo holds the upload key, Google holds the app signing key. If the upload key is ever lost it is
recoverable through a reset in Play Console, taking a day or two.

The client must permanently keep admin ownership of **the Google Play Console account** and **the
Expo account**. Those two are the real single points of failure, not the key itself.

### Play Store listing assets · free to host, someone must produce them

Already built and in the repo: app icon, adaptive icon, splash screen, notification icon, favicon,
wordmark, and the social preview images.

Still needed:

| Asset | Requirement |
| :-- | :-- |
| Store icon | 512x512 PNG, under 1024 KB |
| Feature graphic | 1024x500, no transparency, mandatory |
| Screenshots | 2 to 8, 1080x1920 works |
| Short description | 80 characters |
| Full description | 4,000 characters |
| Privacy policy | A public URL |
| Account deletion page | A public URL that deletes an account without the app installed. Mandatory because the app has accounts, and it does not exist yet. |

Three forms inside Play Console: Data Safety, IARC content rating, and the ads declaration, which
for us is "no ads".

The app already targets Android 16, which Google requires from 31 August 2026, so no work is
needed there.

## 4. Website and backend

### Vercel Pro · $20/month

Hosts the website. **The free plan cannot be used.** Vercel's terms restrict it to non-commercial
use and specifically name processing payments as commercial. One seat is enough, and the included
allowances are far beyond our traffic.

### Supabase Pro · $25/month

Database, student accounts, and file storage, shared by both apps. **The free plan cannot be used
in production**, because it pauses a project after seven days of inactivity, so a quiet week means
students open the app to an error. It also has no backups.

Pro gives 8 GB database, 100 GB storage, 250 GB transfer, 100,000 monthly users, daily backups, and
no pausing. Hosted in Mumbai, the closest region to Pakistan.

The $25 covers the standard database size. Moving to a larger one costs more, but nothing at our
scale requires it.

### Domain · about Rs 1,750/year

`matricmate.com.pk`, on a two-year term. The client holds the registrar login.

### Cloudflare · free

DNS pointing at Vercel. The free plan covers it fully.

### Resend · free, $20/month if outgrown

Payment receipts, invoices, and anything a student wants a written record of. Still needed even
though students sign up with a phone number rather than an email address. Free covers 3,000 emails
a month; $20 buys 50,000. Supabase's own sender is limited to two emails an hour and is not meant
for real users.

### Sentry and UptimeRobot · free

Sentry reports crashes from both apps, 5,000 errors a month free. UptimeRobot alerts if the site
goes down, 50 monitors free. Neither is strictly required to run, but without them nobody finds out
about a problem before a student reports it.

## 5. Costs that move with usage

### Safepay · no setup fee, no monthly fee

Their published rates:

- Domestic cards: **2.9% + Rs 30**
- International cards: 2.9% + 0.3% extra
- Raast, which is how JazzCash and Easypaisa arrive: **1.5%**
- Chargeback: Rs 3,000 per dispute

The Rs 30 flat fee is heavy on a small payment:

| Plan | Price | By card | By Raast |
| :-- | --: | --: | --: |
| Monthly | Rs 1,000 | Rs 59 (5.9%) | Rs 15 (1.5%) |
| 3 months | Rs 2,700 | Rs 108 (4.0%) | Rs 40 (1.5%) |
| Yearly | Rs 9,000 | Rs 291 (3.2%) | Rs 135 (1.5%) |

At 500 monthly subscribers that is Rs 29,500 in card fees against Rs 7,500 on Raast for the same
revenue. Raast should stay the default option on checkout, and the longer plans are worth
promoting because the flat Rs 30 spreads out.

### Anthropic, the AI tutor · about Rs 1 per question

The largest cost that grows with students.

| | Monthly |
| :-- | --: |
| 100 premium students, about 6 questions a day | Rs 17,500 |
| 500 premium students, about 6 questions a day | Rs 87,500 |
| 500 premium students all using the full 20 a day | Rs 292,000 |

The 20-question daily limit is what keeps this affordable. Without it, AI alone would reach 58% of
revenue. Caching repeated context cuts the realistic figure by roughly 40%.

### SMS · Rs 5,000 a year plus per message

Students sign up with a phone number and a password, so a verification code has to reach them at
signup and at password reset. That makes SMS part of signing in, not an optional extra, and it means
**the app cannot create accounts if the SMS provider is down**. Detail and reasoning in
`NOTIFICATIONS.md`.

| | |
| :-- | --: |
| Sender name registration, one-time | Rs 5,000 |
| Sender name, annual | Rs 5,000 |
| First top-up | about Rs 10,000 |
| Sign-in code | Rs 4.70 to 4.80 each |
| Ordinary branded message | Rs 3.80 to 3.90 each |

Codes cost more than ordinary messages, not less. Registration needs an FBR NTN, CNIC and a stamped
letterhead, takes two to four weeks, and a registered company is not required. Full detail in
`NOTIFICATIONS.md`.

### WhatsApp Business API · about Rs 3.50 per message

Used only for renewal reminders, roughly Rs 1,750 a month at 500 subscribers. Business verification
needs SECP or sole-proprietor documents and a live website. Full detail in `NOTIFICATIONS.md`.

### Supabase transfer, if audio downloads grow

Audio is about 20 MB per chapter across both mediums. Offline downloads pull whole files, so 500
students downloading twenty chapters each is around 200 GB a month against the 250 GB included.
Beyond that it is $0.09 per GB.

## 6. Tools we do not use

| Not used | Why |
| :-- | :-- |
| SMS gateway | Same price per message as WhatsApp, plus Rs 5,000 setup and Rs 5,000 a year, needs a PTA short code, and the brand name does not display on some networks. |
| Twilio and other international SMS | About Rs 132 per message to Pakistan, roughly 34 times a local provider. |
| Apple Developer Program | $99 a year. The contract is Android only. |
| Bunny.net CDN | Was for video, which is out of scope. Audio fits inside Supabase. |
| Stripe, PayPal | Do not serve Pakistani merchants for this. |
| Google Play Billing | Play would take 15 to 30%. Selling on the website is permitted and free of that cut. |
| Render, Railway, a VPS | Nothing to run. Supabase already is the backend. |

## 7. Total cost at three sizes

| | 100 paying | 500 paying | 2,000 paying |
| :-- | --: | --: | --: |
| Revenue | Rs 100,000 | Rs 500,000 | Rs 2,000,000 |
| Fixed services | Rs 18,200 | Rs 18,200 | Rs 18,200 |
| AI tutor | Rs 10,500 | Rs 54,000 | Rs 216,000 |
| Safepay | Rs 4,000 | Rs 19,000 | Rs 75,000 |
| WhatsApp | Rs 350 | Rs 1,750 | Rs 7,000 |
| Sign-in codes | Rs 100 | Rs 525 | Rs 2,100 |
| Extra transfer | Rs 0 | Rs 0 | Rs 15,000 |
| **Total** | **Rs 33,000** | **Rs 93,000** | **Rs 333,000** |
| Share of revenue | 33% | 19% | 17% |

Cost falls as a share of revenue as students are added, because the fixed Rs 18,200 spreads out.
The figure that decides everything is AI usage per student, which the daily limit controls.

Two things the table does not show. Sign-in codes assume students have passwords; sending a code on
every login instead would cost Rs 51,250 a month at 2,000 students rather than Rs 2,100. And every
**free** student also costs a sign-in code at signup while generating no revenue, so the real code
bill follows total signups, not paying ones.

## 8. Account ownership

**Every account under the client's email, with us added as a member.** Nothing to migrate at
handover, and no bill lands on the wrong card.

The Google Play Console account is the one that cannot easily be moved later, so it must be created
under the right identity the first time.

## 9. Keys and where they go

No secret is stored in the code. Anything marked secret must never carry a `NEXT_PUBLIC_` or
`EXPO_PUBLIC_` prefix, because those ship to the user's phone and are readable.

**Website, set in Vercel**

| Name | Secret |
| :-- | :-- |
| `NEXT_PUBLIC_SUPABASE_URL` | no |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no |
| `SUPABASE_SECRET_KEY` | yes |
| `SAFEPAY_ENV` | no |
| `SAFEPAY_MERCHANT_API_KEY` | yes |
| `SAFEPAY_SECRET_KEY` | yes |
| `SAFEPAY_WEBHOOK_SECRET` | yes |
| `NEXT_PUBLIC_SITE_URL` | no |
| `NEXT_PUBLIC_ALLOW_INDEXING` | no |
| `ANTHROPIC_API_KEY` | yes |
| `RESEND_API_KEY` | yes |
| `CRON_SECRET` | yes |

**Mobile app, set in EAS**

| Name | Secret |
| :-- | :-- |
| `EXPO_PUBLIC_SUPABASE_URL` | no |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no |
| `EXPO_PUBLIC_SITE_URL` | no |

## 10. Running the project locally

```bash
node -v              # 22 or newer
npm install          # from the repo root
npm run check        # lint, typecheck and build, all three packages
npm run web          # website on localhost:3000
npm run mobile:go    # scan the QR code with Expo Go on Android
npm run android:log  # native crash logs over adb
```

Two `.env.local` files are needed, one in `apps/web` and one in `apps/mobile`, holding the keys in
section 9. Neither is stored in git.

## Figures we could not confirm

- How long Google takes to verify a personal developer identity. No published number.
- How long an upload key reset takes. Reported as one to two days.
- Whether a failed EAS build uses up build credit.
- Whether Pakistani cards work reliably for Meta's WhatsApp billing.
