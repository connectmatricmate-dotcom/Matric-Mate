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
provisioned**. Nothing in our code restricts this, so it cannot be fixed in
code: the wallet rails have to be switched on for the merchant, usually by
Safepay support for a sandbox account. Ask them to enable JazzCash and Easypaisa
and quote that capabilities response.

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

## Subscriptions: supported, deliberately not shipped yet

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

**Why it is not in the prototype.** The subscribe route needs an auth token,
which means a Safepay **customer** per student, and a customer id has nowhere to
live until Supabase exists. Shipping it now would mint a throwaway customer on
every checkout, pollute the merchant account, and be impossible to reconcile.

**Also worth knowing before promising auto-renew:** only cards can be
auto-debited. JazzCash and Easypaisa have no merchant-initiated debit, so a
wallet customer must always renew by hand. Auto-renew is therefore a card-only
feature, not a universal one, and the app's current promise of "no automatic
charge, we remind you two days before" is a reasonable default for this market.

**The plan for the payments milestone:** card pays via a subscription and renews
itself; wallet pays once and gets a reminder. Both write entitlement from the
webhook, never from the return URL.

---

## The one rule that must not be broken

`/checkout/return` proves that Safepay redirected the browser here. It does
**not** prove money settled, and anyone can type the URL. Until the webhook
writes entitlement server-side, the Premium flag it sets lives in one browser
and is a prototype convenience, which the success page says out loud.

When Supabase lands: the webhook becomes the only thing that grants Premium, and
the return page becomes what it should always have been, a receipt.
