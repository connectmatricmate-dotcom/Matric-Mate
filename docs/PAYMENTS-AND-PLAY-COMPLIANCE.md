# Payments, and why the two apps behave differently

One product, two surfaces, two very different sets of rules. This is the record
of what was decided and why, so nobody has to rediscover it.

---

## The constraint in one paragraph

Google Play forbids an app distributed through Play from selling digital content
through anything except Play Billing, and forbids **steering**: no prices, no
plan pickers, no "Upgrade" buttons, no tappable links to a checkout. Play
Billing itself is not an option here, because Pakistan is cards-only on Play,
which would cut off the JazzCash and Easypaisa wallets most students actually
use. So MatricMate takes the reader-app route that Netflix and Spotify take:
**the Android app never sells anything, and the website sells everything.**

---

## What lives where

| | Android | Web |
| :-- | :-- | :-- |
| Sign up | **Yes** | Yes |
| Log in | Yes | Yes |
| Free tier, in full | Yes | Yes |
| Prices | **Never** | Yes |
| Plan picker, checkout | **Never** | Yes |
| Cancel, renew, receipts | Status only, no amounts | Yes |
| Locked chapters | Shown, plain locked state | Shown, with an Upgrade route |

### Why sign-up stays in the Android app

This is where copying Netflix exactly would be wrong. Netflix removed sign-up
because a Netflix account with no subscription can do nothing, so a sign-up
would be a dead end.

MatricMate's free tier is a real product: one full chapter per subject, 5 MCQs a
day, 5 AI questions a day. A student who finds the app on Play can sign up, get
genuine value the same evening, and upgrade later. A free account is not a
digital purchase, so Play permits it. Sending students to a laptop to make a
free account would cost most of the Android funnel for no compliance benefit.

### How a student on Android actually upgrades

`LockedNotice` is the only place the Android app may discuss plans, and it does
three permitted things:

1. Says what is locked.
2. Names the website as **plain, non-tappable text**.
3. Offers "Email me the link", which **opens nothing**. It asks the server to
   send an email. Contacting a customer outside the app is explicitly allowed,
   and it beats Netflix's dead end because we do the typing for them.

There is no `Linking.openURL`, no WebView, and no price anywhere in the APK.
Both were audited and two leaks were removed: an "Upgrade" pill on the profile
screen, and rupee amounts in the receipt list.

**Anyone adding to the Android app: run this before you ship.**

```bash
grep -rn "Rs \|price\|upgrade\|checkout\|openURL\|Linking" apps/mobile/app apps/mobile/src --include=*.tsx
```

---

## Safepay

Checkout runs on Safepay's **hosted page**, so a card is entered on Safepay's
domain and never touches ours. That keeps MatricMate out of PCI scope, and it is
why the checkout screen no longer asks for card details.

### The flow, every step verified against the sandbox

1. `POST /order/v1/init` returns a tracker, `track_…`. Amount in **rupees**.
2. Redirect to `/checkout/pay/?env=…&beacon=<tracker>&redirect_url=…&cancel_url=…`
3. Safepay POSTs back with the tracker, a reference and an HMAC-SHA256
   signature, which `/checkout/return` verifies in constant time.

### Two traps, both hit and both fixed

**The trailing slash.** `/checkout/pay` without it silently fails; the checkout
app validates its own location with `/\/pay\//`. The older `/components` path
now 301s to Safepay's marketing site, which is a baffling way to fail because
the redirect looks deliberate.

**v1 versus v3 trackers.** `/order/payments/v3/` is the Payments 2.0 endpoint,
and its tracker is stamped with `intent: CYBERSOURCE` and a next action of
`PAYER_AUTH_SETUP`, because 2.0 expects the *merchant* to drive 3-D Secure from
its own UI. Handing that tracker to the hosted page gives **"Tracker is in an
invalid state"**. Hosted checkout needs the v1 tracker, whose `intent` is empty
so the page can pick the rail after the payer chooses. Note the units differ
too: **v1 takes rupees, v3 takes paisa.** A hundredfold error either way.

### Only cards appear at checkout, and that is an account setting

```
GET /order/payments/v2/capabilities?tracker=<tracker>
{ "CARD":        { "enabled": false },
  "CYBERSOURCE": { "enabled": true  },
  "PAYFAST":     { "enabled": true, "data": [] } }
```

The checkout page renders `wallets = easypaisa || payfast || abhi`. `EASYPAISA`
is absent from this account entirely, and `PAYFAST` is enabled with **no methods
provisioned**. Nothing in our code restricts this.

**Superseded 30 Jul 2026, see the Raast section at the end of this file.** We
asked support to enable the wallets and the answer was that there is nothing to
enable: Safepay has no direct JazzCash or Easypaisa rails at all, on any
account. Wallets exist only as Raast, Raast has no sandbox, and this
capabilities response is what a sandbox account permanently looks like. The
diagnosis above (account provisioning, not code) was right; the assumed remedy
(a support toggle) never existed.

### Testing the redirect back: not over plain http

Safepay's checkout runs on HTTPS and returns the payer with a form POST. A
browser will not submit a form from an HTTPS page to `http://localhost`: that is
mixed content, and Chrome drops it with no visible error, so the symptom is
simply "it never comes back".

Two ways round it:

```bash
npm run dev:https --workspace apps/web   # local HTTPS, self-signed cert
```

or test against the deployed HTTPS URL, which is what a student will use anyway.
The redirect URL follows the deployment automatically, so nothing needs editing.

Also worth checking in the Safepay dashboard: some merchant accounts require
return URLs to be registered before they will be honoured.

---

## Subscriptions: supported by Safepay, deliberately not used

They work. A real plan was created in the sandbox to prove it:

```
POST /client/plans/v1/          header: X-SFPY-MERCHANT-SECRET
{ "name": "...", "currency": "PKR", "amount": 100000,   // paisa
  "interval": "MONTH", "interval_count": 1,
  "type": "RECURRING", "product": "SERVICE" }

→ plan_54681aaa-fbac-4cfa-89ac-0c268edb2e16
```

Checkout has a matching `/checkout/subscribe/` route, and
`/client/subscriptions/v1/…` covers find, update, pause, resume and cancel.

**The blocker is gone.** `/checkout/subscribe/` needs `plan_id` and
`auth_token`, and the auth token now exists: checkout mints a guest session for
every payment, and each student has a stored Safepay customer.

**It is still not used, and that is the decision, not an omission.** Auto-renew
would make the app's own promise false. Every screen and both languages say "no
automatic charge, we remind you two days before it ends and you renew yourself",
and a Pakistani student on a shared family card loses more trust to one surprise
debit than auto-renew wins back in retention.

`subscribeUrl()` was written, verified against the sandbox, and then deleted
rather than left lying around: unused code that can charge people is a liability.
The contract is recorded here so rebuilding it is an afternoon, not a week.

**Also worth knowing before promising auto-renew:** only cards can be
auto-debited. JazzCash and Easypaisa have no merchant-initiated debit, so a
wallet customer must always renew by hand. Auto-renew is therefore a card-only
feature, not a universal one, and the app's current promise of "no automatic
charge, we remind you two days before" is a reasonable default for this market.

**If it is ever revived:** offer it as a choice at checkout, defaulted off, and
only to card payers. It cannot be universal, and a default-on recurring charge
would contradict the copy in both apps.

---

## The webhook, which is the only thing that grants Premium

### Setting it up in the Safepay dashboard

Webhooks are off until you turn them on: **Developers → Endpoints → enable**,
then add an endpoint.

| Field | Value |
| :-- | :-- |
| URL | `https://matric-mate-web.vercel.app/api/webhooks/safepay` |
| Events | `payment.succeeded`, `payment.failed`, `payment.refunded`, `authorization.succeeded`, `authorization.reversed`, `void.succeeded` |

Copy the endpoint's **signing secret** into `SAFEPAY_WEBHOOK_SECRET`, locally
and in Vercel. It is **not** the merchant secret key: Safepay signs each webhook
with a secret belonging to that endpoint.

### How it verifies

`HMAC-SHA512` of the **raw** request body, hex, in `X-SFPY-SIGNATURE`, compared
in constant time. The raw text matters: parsing and re-serialising changes key
order and whitespace, and the signature stops matching for no visible reason.

### Why the payment row is written before the student leaves

Nothing in a Safepay payment says who paid. `/api/checkout` therefore writes a
`pending` row keyed on the tracker, with the user id taken **from the session,
never from the request body**, and the price looked up from `PLANS` by id,
**never from the body**. The webhook joins back to that row. It is also the
trail to check when a student says they paid and access did not arrive.

### Redelivery must not extend the plan

Webhooks are at-least-once, Safepay retries on any non-2xx, and a single payment
emits more than one success-shaped event (`authorization.succeeded` then
`payment.succeeded`).

The first version of this handler extended the plan on every one of them: three
deliveries turned a three-month plan into nine, and posted three receipts. The
handler now stops if the payment is already `paid`. A genuine second purchase
carries a different tracker, so it is unaffected.

Verified: three deliveries, including two different event types, produce one
grant, one expiry date and one receipt.

### What a bad signature does

Returns 401 and changes nothing. Tested with no signature and with a forged one.
An unknown tracker returns 200 and grants nothing, because retrying it forever
would help no one.

---

## The one rule that must not be broken

`/checkout/return` proves that Safepay redirected the browser here. It does
**not** prove money settled, and anyone can type the URL. So it grants nothing:
it carries the tracker across to the success page, which reads the payment row
under the student's own session and reports what the database says.

The webhook is the only writer of `entitlements`, and the table has no write
policy at all, so nothing else *can* write it. The success page shows a waiting
state while the webhook is in flight, because the browser usually beats it back
by a second or two, and telling a student who has just paid that something went
wrong would be both wrong and alarming.

## Accounts: one login, created in either place

Checked against the policy in July 2026, because the answer decides the shape of
both apps.

Google's Payments policy says it in as many words: *"Google Play allows any app
to be consumption-only, even if it is part of a paid service. For example, a
user could log in when the app opens and access content paid for somewhere
else."* It also permits limited plain text with no link, its own example being
*"You can purchase this book directly on our website."* That is exactly what
LockedNotice renders.

Pakistan has no way out of that, and this was worth confirming rather than
assuming:

| Programme | Where it applies |
| :-- | :-- |
| External payment links | Japan |
| Alternative / user-choice billing | India, South Korea, EEA |
| Free link-outs after the US court order | United States |

None of them reach Pakistan, so consumption-only is not the careful option, it
is the only compliant one.

**Sign-up is allowed in the Android app, and we do it.** The policy governs
selling, not account creation, and a free account is not a purchase. Copying
Netflix's refusal to let anyone register in-app would be copying a decision that
only works because everyone already knows what Netflix is. Nobody knows
MatricMate, and in Pakistan the APK is the discovery surface, so a dead end
there is a lost student.

There is a colder reason too. An account is an email address, and email is the
only channel Play permits for telling someone about a plan they could buy on the
website. No account means no compliant way to ever reach them.

**Entitlement is read, never written, by the phone.** `entitlements` is
select-only under RLS for the student it belongs to, which was verified against
the live database: a signed-in client updating its own row changes nothing, and
reading another student's returns an empty array rather than an error. The app
also treats a past `valid_till` as inactive regardless of the `active` column,
because nothing runs at midnight to flip it.

So the compliance posture and the payment architecture are the same fact stated
twice: the Android app cannot sell, and it cannot grant. Only the webhook can.

## Wallets are Raast, and Raast is production-only (Safepay support, 30 Jul 2026)

Safepay's answer to the missing JazzCash and Easypaisa options, verbatim in effect:

- Easypaisa and JazzCash are supported **only through Raast**, never as direct wallet rails.
- **Raast is not available in sandbox at all.** The sandbox stays card-only forever; there is
  nothing to enable and nothing more to test there.
- Raast is unlocked by creating a **production account and completing the onboarding form**;
  after approval the Raast options appear.

What this changes:

1. Production onboarding is no longer an M10 task, it is the **only wallet test environment**.
   Start it immediately; the first wallet payment anyone sees will be a real one, so budget a
   Rs 100 smoke-test session right after approval.
2. The hosted checkout should surface Raast without code changes once the account has it (the
   page reads rails from the account's capabilities; their own bundle already carries an IBFT
   rail). Verify with the capabilities probe against a production tracker on day one.
3. Unanswered by support and still needed: wallet-vs-card MDR at low volume, KYC document
   checklist, lead time from approval to Raast being live, and whether the KYC application can
   name the final domain before it is live. Follow-up sent.
4. Fallback path, in order of evidence available: **Paymob Pakistan** reportedly exposes
   JazzCash and Easypaisa as separate integration IDs with a testable sandbox (verify by opening
   one; account creation is a user action), which would give a tested direct-wallet flow before
   go-live. PayFast remains the second candidate (docs were unreadable to us, 403). Either sits
   behind lib/gateway at roughly one day of provider work. Decide after Safepay answers whether a
   wallet-only payer with no bank account can complete a Raast payment; if the answer is no,
   Safepay cannot serve this product and the decision makes itself.

