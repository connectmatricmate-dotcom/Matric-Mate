# Deployment

Two services, and nothing else: **Vercel** for the website, **Supabase** for the backend. The
Android app keeps going through EAS and is unaffected by everything on this page.

The repo is ready for both. What follows is the click-by-click, in the order to do it.

---

## Before you start

Create both accounts under **Adnan's email**, and add yourself as a member. Two reasons: at handover
there is nothing to migrate, and the monthly bill never lands on your card. Both services need an
international card once you leave the free tier.

---

# Part 1 · Vercel

## What to click

1. **vercel.com → Add New → Project → Import Git Repository**
   Pick `connectmatricmate-dotcom/Matric-Mate`.

   If the repo does not appear, the Vercel GitHub app has not been installed on it yet. Vercel shows
   an "Adjust GitHub App Permissions" link; the repo **owner** account has to approve it. Since the
   repo lives under `connectmatricmate-dotcom` and the Vercel account is Adnan's, you may have to
   approve from the GitHub side while logged in as `connectmatricmate-dotcom`.

2. **Configure Project.** Only one setting is not the default:

   | Setting | Value |
   | :-- | :-- |
   | Framework Preset | Next.js *(detected)* |
   | **Root Directory** | **`apps/web`** ← change this |
   | Build Command | leave default |
   | Output Directory | leave default |
   | Install Command | leave default |
   | Node.js Version | **22.x** |

3. **Root Directory → "Include files outside of the Root Directory in the Build Step" must be ON.**

   This one matters. The website imports `@matricmate/core`, which lives in `packages/core`, outside
   `apps/web`. With this off the build fails with a module-not-found on the very first deploy. It is
   on by default when Vercel detects a monorepo, but check it.

4. **Environment Variables: none.** The prototype runs on mock data. Leave the section empty and
   deploy. `apps/web/.env.example` lists everything that arrives later and what each one is for.

5. **Deploy.**

## After the first deploy

- **Production branch is `main`.** Every push to `main` redeploys production. Every other branch and
  every pull request gets its own preview URL, which is the good way to show the client a change
  before it is live.
- **The site is invisible to Google on purpose.** `robots.txt` returns `Disallow: /` and every page
  carries `noindex`, because right now the chapters are samples and the checkout takes no money.
  Being indexed in that state means Google's first impression of MatricMate is a demo, and "no real
  payment is taken" ends up in a search snippet under the brand name.

  **To turn indexing on at launch:** add `NEXT_PUBLIC_ALLOW_INDEXING` = `true` in Project → Settings
  → Environment Variables (Production only), and redeploy. That is the whole change.

- **Custom domain.** Project → Settings → Domains → add `matricmate.pk`. Vercel prints the DNS
  records to add at the registrar. Once it resolves, also set `NEXT_PUBLIC_SITE_URL` to
  `https://matricmate.pk` so link previews on WhatsApp point at the right place.

## The one thing that will cost money

**Vercel's Hobby tier is licensed for non-commercial use only.** It is fine for a prototype the
client is reviewing. The moment MatricMate takes a real payment, the project has to be on **Pro,
$20/month**. Worth telling Adnan now rather than at launch.

---

# Part 2 · Supabase

Nothing in the app talks to Supabase yet, so there is no rush. Create it when we start the backend
milestone. When you do:

## What to click

1. **supabase.com → New Project**, inside an organisation owned by Adnan's account.

2. | Setting | Value |
   | :-- | :-- |
   | Name | `matricmate` |
   | Region | **South Asia (Mumbai) · `ap-south-1`** |
   | Database password | generate a strong one |

3. **Save the database password immediately, in a password manager.** Supabase shows it once. You
   can reset it later, but that means updating it everywhere it is used.

## Why the region is the one irreversible choice

A Supabase project's region is fixed when you create it. Changing it later is a dump and restore of
the whole database. Mumbai is the closest to Pakistan, which is the call you made.

**Vercel must be told to match.** Once Supabase exists, add this to `apps/web/vercel.json`:

```json
"regions": ["bom1"]
```

`bom1` is Vercel's Mumbai region. If the server functions sit in the United States while the
database sits in Mumbai, every single query crosses two oceans and nothing else we optimise will
make any difference. Region selection works on Hobby too, so this is not a reason to upgrade. The
real reason is licensing: Vercel's Fair Use terms restrict Hobby to non-commercial use, and taking
a payment crosses that line. See `TOOLS-AND-SERVICES.md`.

## What to send me, and what never to send

| | |
| :-- | :-- |
| **Safe to paste in chat** | Project URL (`https://xxxx.supabase.co`) and the **publishable / anon key**. These ship inside the browser bundle by design. Row Level Security is what protects the data, not the secrecy of that key. |
| **Never paste anywhere** | The **service role / secret key** and the **database password**. The service key ignores Row Level Security entirely: anyone holding it can read and change every student's data. Put it straight into Vercel's environment variables yourself, marked Production, and into Supabase Edge Function secrets. I do not need to see it. |

## How I will apply database changes

I write plain SQL files into `supabase/migrations/`, you review the diff like any other code, and
apply them one of two ways:

- **Dashboard:** SQL Editor → paste → Run. Simplest, no setup.
- **CLI:** `npx supabase link` once, then `npx supabase db push` for each change.

That way no credentials pass through chat and every schema change is in git.

---

# Part 3 · Safepay

Checkout runs on Safepay's **hosted page**, so a card is entered on Safepay's
domain and never touches ours. That keeps MatricMate out of PCI scope. It also
means the checkout screen does not ask for card details, which is not a
simplification: it is what a student will actually see.

The flow, verified against the sandbox and corrected twice since this doc was
first written (an earlier version of this section described the v3 endpoint and
the /components URL; both are the broken path, kept here only as a warning):

1. `POST /order/v1/init` with the merchant API key returns a tracker (amounts
   in whole rupees). Never `/order/payments/v3/`: that tracker family is for
   Payments 2.0 custom checkouts and the hosted page rejects it with
   "Tracker is in an invalid state".
2. The browser goes to `/checkout/pay/?beacon=<tracker>&…&webhooks=true`. The
   trailing slash and the `webhooks=true` are both load-bearing: without the
   flag the payer finishes on a dead "Close" dialog and never returns. The old
   `/components` path 301s to Safepay's marketing site.
3. The page sends the payer back to `/checkout/return` as a GET carrying
   `order_id` and `tracker` and **no signature**, which is normal. A signature
   is verified only when one is present.
4. The return page asks Safepay directly what happened
   (`confirmWithGateway`, guarded by owner and amount checks) and the
   **webhook** (`/api/webhooks/safepay`, HMAC-SHA512 of the raw body,
   idempotent grants) settles independently. Whichever lands first wins;
   the second is a no-op.

Payment methods: the sandbox is **card-only, permanently**. JazzCash and
Easypaisa exist on Safepay only as **Raast** rails, and Raast has no sandbox;
it appears after production onboarding. See PAYMENTS-AND-PLAY-COMPLIANCE.md.

## Environment variables

Add these in Vercel alongside the others. With no keys, checkout says plainly
that payments are not configured on the deployment; there is no mock fallback.

| Name | Value | Environments |
| :-- | :-- | :-- |
| `SAFEPAY_ENV` | `sandbox` | Production + Preview |
| `SAFEPAY_MERCHANT_API_KEY` | the `sec_…` key | Production + Preview |
| `SAFEPAY_SECRET_KEY` | the 64-character hex key | Production + Preview |
| `SAFEPAY_WEBHOOK_SECRET` | shared secret from the dashboard webhook page | Production + Preview |

Going live is not just swapping keys: set `SAFEPAY_ENV=production`, swap both
keys for the live pair, register the production webhook endpoint in Safepay's
dashboard and put its new shared secret in Vercel, then make one real Rs 100
payment end to end before telling anyone it works.

# Part 4 · What we are deliberately not using

| | Why not |
| :-- | :-- |
| **Render / Railway / Fly** | They host long-running services. We do not have one: the backend is Postgres plus three small functions, which is what Supabase already is. Render's free tier also spins down when idle, so the first student to open the app in an hour waits about a minute. |
| **Netlify** | Same job as Vercel, weaker Next.js App Router support. |
| **A VPS** | Cheapest on paper. You then own patching, backups, TLS renewal and uptime, forever, and it is the hardest thing to hand to a client. |
| **Cloudflare, Bunny.net** | Vercel and Supabase already give CDN, TLS and DDoS basics. Revisit **only** if audio bandwidth becomes the biggest line on the bill, which is the realistic risk: every offline download pulls a whole file. Supabase Pro includes 250 GB egress a month, which is a long way off. |

---

# Part 5 · Building the Android APK

Two ways to build. Both produce the same artifact from the same `eas.json`
profile and the same environment variables; only the machine differs.

Use the **preview** profile for anything you send to a person: it produces an
installable `.apk`. The **production** profile produces an `.aab`, which is the
Play Store upload format and cannot be sideloaded onto a phone.

## Locally, with no queue

```bash
npm run apk                  # preview .apk, into builds/
npm run apk -- --production  # production .aab
```

The script checks the toolchain before it starts, because a missing JDK
otherwise surfaces as a Gradle error several minutes in. First run downloads
Gradle and is slow; later runs are much faster. The artifact lands in `builds/`
named after the profile and the commit, so two builds are never confused. That
folder is gitignored: a 100 MB binary must not reach the repo.

### One-time setup

```bash
sudo apt install -y openjdk-17-jdk
```

Then the Android SDK, either through Android Studio or the command line tools
alone (https://developer.android.com/studio#command-line-tools-only, unzipped
into `~/Android/Sdk/cmdline-tools/latest`):

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

Nothing needs exporting: the script looks in `~/Android/Sdk`, which is where
`sdkmanager` installs by default, and passes the paths to Gradle itself. Budget
about 500 MB and twenty minutes once. `npm run apk` names anything still
missing.

### Node

Expo's local build plugin logs through bunyan, which loads `dtrace-provider`,
whose native binding does not build on Node 23 or newer. It fails before any
build work starts, and eas reports it as an empty non-zero exit with no output,
which tells you nothing about the cause.

The build therefore runs on Node 22 while everything else in the repo stays on
whatever you have. `npm run apk` picks a suitable version out of nvm on its own;
if there is none it says so. Install one with `nvm install 22`.

If you hit the dtrace error after a failed run on a newer Node, the broken
native build is cached: `rm -rf ~/.npm/_npx` and run again.

### Gradle memory

The generated Android project caps Gradle's Metaspace at 512 MB, which this
build blows through: the symptom is a failure deep into the build with
"Metaspace" under a Kotlin or lint task. The fix lives in
`~/.gradle/gradle.properties` (already written on this machine), which
outranks the per-project file that EAS regenerates on every run:

```
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1536m -Dfile.encoding=UTF-8
kotlin.daemon.jvmargs=-Xmx2g -XX:MaxMetaspaceSize=1g
```

Two more first-run facts: Gradle installs its own NDK and SDK platform
versions regardless of what sdkmanager preinstalled, and a build interrupted
mid-download can leave a stub NDK directory that fails later runs with "did
not have a source.properties file". Delete the offending
`~/Android/Sdk/ndk/<version>` directory and run again.

## In the cloud

```bash
cd apps/mobile
npx eas-cli build --profile preview --platform android
```

Same result, no local toolchain, but the free tier queues and the wait is not
predictable. Worth it for a one-off; not worth it when iterating.

## Environment variables

These live on the Expo account, not in this repo, and both build routes read
them from there. Set for `development`, `preview` and `production`:

| Name | Visibility |
| :-- | :-- |
| `EXPO_PUBLIC_SUPABASE_URL` | Plain text |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Plain text |
| `EXPO_PUBLIC_SITE_URL` | Plain text |

Plain text, not Secret. Anything prefixed `EXPO_PUBLIC_` is compiled into the
APK and can be read out of it by anyone, so marking it Secret protects nothing
and only risks the build not seeing it. A service-role key or an AI provider key
must never be set here for the same reason.

With these unset the build still succeeds, and the app then shows "Supabase keys
are missing from this build" and no real content. That failure looks like a code
bug and is not one, so check here first.

# Running costs

| | Free tier | Paid | Needed by |
| :-- | :-- | :-- | :-- |
| Vercel | Hobby, non-commercial only | **$20/mo** Pro | First real payment taken |
| Supabase | Pauses after 7 days idle | **$25/mo** Pro | Launch: gives daily backups and no pausing |
| EAS | Free tier is fine | n/a | n/a |
| Claude API | n/a | usage-based, capped by the per-student daily quota | AI tutor milestone |

**Roughly $45/month once live**, plus AI usage. Nothing until then.

The Supabase free-tier pause is worth knowing about early: leave a demo project alone for a week and
it goes to sleep, so the client opens the link and sees an error. Not a problem while we are still
on mock data, since the website does not touch Supabase at all yet.
