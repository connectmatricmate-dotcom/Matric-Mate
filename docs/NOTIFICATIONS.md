# MatricMate · Sign-in and messaging requirements

Phone number sign-in, plus SMS, WhatsApp and email messaging. What each one needs, what it costs,
and what has to be built. Researched 10 Aug 2026 against Supabase's documentation, the providers'
own pricing pages, and PTA sources.

## Short answer

**All of it works in Pakistan.** Nothing here is blocked by regulation or by any provider refusing
Pakistani businesses. The cost is paperwork and lead time, not technology.

Three separate vendors are needed, and they cannot be collapsed into one: an SMS aggregator, Meta
for WhatsApp, and an email sender.

## 1. Phone number sign-in

### It is supported, and we can use a cheap Pakistani SMS provider

Supabase supports phone as the only identifier, with no email at all. The important question was
whether we could send the verification code through a Pakistani provider, because Supabase's
built-in options are Twilio, Vonage, MessageBird and TextLocal, and Twilio charges about Rs 132 per
message to Pakistan against roughly Rs 4.75 locally.

**We can.** Supabase's **Send SMS Hook** is generally available, works on the Pro plan we are
already paying for, and hands the code to our own function instead of a built-in provider. Our
function receives the user and the six-digit code, composes the message text, and calls whichever
Pakistani provider we choose.

That hook is also the **only** way to control the wording of the message, which we need anyway,
because Pakistani branded SMS has content rules and we want the text in the student's own language.

### The one decision that has to be made first

"Sign up with a phone number" can mean two things, and the difference is large:

| At 2,000 students | Code on every login | Phone plus a password |
| :-- | --: | --: |
| Signup codes | Rs 1,850/mo | Rs 1,850/mo |
| Login codes | Rs 49,400/mo | Rs 0 |
| **Total** | **Rs 51,250/mo** | **Rs 2,100/mo** |

Verification codes go through a dedicated short code, the most expensive SMS type in Pakistan at
about Rs 4.75 each, and roughly 1.3 messages are sent per successful verification once resends are
counted.

**Recommendation: phone number plus a password.** A code is sent once at signup to prove the number
is real, and again if the student forgets their password. The student still signs up with a phone
number and never sees an email field, which is what was asked for, but the bill does not grow every
time someone opens the app.

### What has to be built

| Item | Why |
| :-- | :-- |
| Send SMS Hook function | Routes the code to a Pakistani provider and sets the message wording |
| Phone entry with +92 handling | Students type `03001234567`, storage needs `+923001234567` |
| Forgot-password flow, by hand | Supabase has no phone equivalent of its email reset. It has to be assembled: send a code, verify it, then set the new password |
| CAPTCHA on signup and code requests | Every code costs real money, so an unprotected endpoint is a way to spend ours |
| Per-number sending limit inside the hook | Supabase limits per user and per hour, but not per destination number |
| Phone field in the profile | The column already exists and is validated, but nothing writes to it |
| Consent checkbox | Required before any WhatsApp message, and for SMS opt-out rules |
| Per-channel notification settings | Students must be able to turn each channel off |

### What breaks, and has to be changed

- **Password reset.** The existing email reset does not apply. There is no phone equivalent, it must
  be built from three separate calls.
- **Anything reading the user's email.** For a phone-only account that field is empty. Any screen
  showing "signed in as", any database rule or trigger referring to email, and anything sending mail
  to the account address all need checking.
- **Magic links** do not exist for phone. That feature is gone.
- **Existing accounts.** A handful of real accounts exist, including ours. The safe path is to add a
  phone to each while email sign-in still works, which keeps the same user ID and all their data,
  and only then turn email off. Turning email off first may lock those accounts out, so it must be
  tested on a throwaway project before touching the live one.
- **Social sign-in later.** Google sign-in matches people by email. A phone-only student who later
  uses Google would get a second, separate account.

### Abuse protection, which is now a money question

Supabase allows 30 codes per hour across the whole project by default, and one per user per minute.
Both are adjustable. The 30 per hour is the real spending backstop, and it should not be raised
without CAPTCHA in place first.

One trap: if the website sends auth requests through its own server rather than straight from the
browser, every student looks like the same computer to Supabase and one person can exhaust the
limit for everyone. A forwarding header fixes it and has to be switched on.

### Availability

With phone sign-in, **the SMS provider becomes part of logging in**. If they go down, nobody can
create an account. This is a real dependency that email sign-in did not have, and it argues for
choosing the best-documented provider rather than the cheapest.

## 2. SMS

### Provider

**SendPK** is the recommendation: real published API documentation, transparent pricing, self-serve
signup, and it accepts sole proprietors. RoboSMS is a reasonable fallback. The mobile operators'
own corporate SMS products are quote-only with no public API and are a poor fit.

Twilio and other international services are not viable: about Rs 132 per message against Rs 3.85
locally, and the sender name gets replaced en route.

### Documents needed

**A registered company is not required.** A sole proprietorship can get a branded sender name. What
is needed:

- Application form on **business letterhead, signed and stamped**
- **CNIC**, front and back
- **FBR NTN certificate**, or an SECP certificate, or a Chamber of Commerce document

**The catch that causes rejections:** the sender name must match the business name on the NTN. If
the NTN is registered only in a personal name, an application for "MatricMate" is likely to be
queried or refused. A sole-proprietor NTN can carry a trade name, so registering "MatricMate" as
the trade name before applying avoids this.

### The sender name

Eleven characters maximum, letters and numbers only, nothing that looks like a web address.
**"MatricMate" is ten characters and fits.**

Jazz and Zong display the name as text. Ufone and the former Telenor network have historically
shown a number instead, so some students may not see the brand. Worth confirming with the provider
at signup. Note that Telenor merged into Ufone's parent company on 1 July 2026, so there are now
three operator groups to register with rather than four.

### Two registrations, not one

A sender name cannot be used for both service messages and marketing. Sending "your plan expires
tomorrow" and "new mock test available" under the same name needs **two separate registrations**.

### Opt-outs

Pakistan has a national Do Not Call register, and since July 2022 promotional SMS must carry an
opt-out and only go to people who agreed to receive it. The provider screens against the register,
but the responsibility for not spamming sits with us. Service messages a student triggered
themselves are treated differently from marketing.

### Cost

| | |
| :-- | --: |
| Branded SMS | Rs 3.80 to 3.90 each |
| Verification code SMS (short code) | Rs 4.70 to 4.80 each |
| Sender name, one-time | Rs 5,000 |
| Sender name, annual | Rs 5,000 |
| Minimum top-up | about Rs 10,000 |

Note that verification codes cost **more** than ordinary branded SMS, not less.

### Lead time

Two to four weeks for the branded name, and it can go live on one network before another. Providers
quote between 14 days and 30 working days.

**This does not have to block anything.** SendPK offers a shared, pre-approved sender at Rs 4.00 to
4.10 that works the same day. We can launch on that and switch to "MatricMate" when it clears.

## 3. WhatsApp

Used for renewal reminders and payment confirmations, where reaching the student actually protects
revenue.

**What is needed:**

- Meta Business account
- Business verification: SECP certificate or sole-proprietor documents, FBR NTN, and a live website
  whose footer shows the same legal name
- A phone number that has never been used on ordinary WhatsApp, and cannot be reused afterwards
- Display name approval, matching the verified business name
- Message templates approved in advance
- Explicit consent from each student before any message

**Cost:** about Rs 3 to 4.50 per service message, Rs 13 to 14 for anything promotional. No monthly
fee if we use Meta directly.

**Two practical points.** Meta bills in US dollars and some Pakistani cards fail, in which case a
local reseller charging around $10 a month accepts JazzCash and Easypaisa. And Meta is making some
currently-free message types chargeable from 1 October 2026, so nothing should be budgeted as free
after that date.

**Lead time:** one to three weeks for verification, and it needs the domain live first.

## 4. Email

Still needed even without email sign-in: payment receipts, invoices, and anything a student wants a
written record of.

**Provider: Resend.** Free for 3,000 messages a month, $20 for 50,000. No restriction on Pakistani
senders or a `.com.pk` domain.

**What is needed:** a verified sending domain, which means SPF, DKIM and DMARC records on
`matricmate.com.pk`. Every mail record must be set to "DNS only" in Cloudflare rather than proxied,
or authentication fails silently.

## 5. What the client must provide

| Item | Needed for |
| :-- | :-- |
| FBR NTN, with "MatricMate" as the registered trade name | SMS sender name, WhatsApp verification |
| CNIC, front and back | SMS sender name |
| Business letterhead with a stamp | SMS application form |
| SECP certificate, if the business is registered | WhatsApp verification, alternative to NTN for SMS |
| A phone number never used on WhatsApp | WhatsApp business number |
| A card that works internationally, or willingness to use a local reseller | Meta billing |
| Decision: password, or code on every login | Determines whether SMS costs Rs 2,100 or Rs 51,250 a month |

## 6. Costs

**One-time**

| | |
| :-- | --: |
| SMS sender name registration | Rs 5,000 |
| First SMS top-up | Rs 10,000 |

**Recurring**

| | |
| :-- | --: |
| SMS sender name, annual | Rs 5,000/yr |
| Email (Resend) | Free, $20/mo above 3,000 messages |
| WhatsApp | No fixed fee |
| Supabase phone auth | No extra charge |

**Per use, at 2,000 students**

| | Monthly |
| :-- | --: |
| Sign-in codes, with passwords | Rs 2,100 |
| Sign-in codes, without passwords | Rs 51,250 |
| WhatsApp renewal reminders | Rs 7,000 |
| Notification SMS, if sent to everyone | Rs 7,700 per message sent to all |
| Email | Free at this volume |

That last line is worth reading twice. One SMS to every student costs about Rs 7,700, while the
same message by email costs nothing. SMS should carry things that must arrive, not routine updates.

## 7. Vendor count

Three, and they cannot be merged:

| Vendor | Channel |
| :-- | :-- |
| SendPK or similar | SMS, including sign-in codes |
| Meta, direct or through a local reseller | WhatsApp |
| Resend | Email |

## Not confirmed

Stated plainly rather than guessed:

- Whether Ufone and the former Telenor network display a text sender name or substitute a number.
  Confirm with the provider at signup.
- The exact hours during which promotional SMS may be sent. A 9am to 9pm window is widely repeated
  but traces back to a single source and may be describing India's rule. Get it in writing.
- Whether SendPK and BulkSMS.com.pk are the same company. Their pricing pages are identical.
- SendPK's own site quotes two different sender-name fees. Get the figure in writing before paying.
- The exact phone number format Supabase sends to the hook, with or without the leading plus. Needs
  testing with a real +92 number.
- Whether Pakistani cards work reliably for Meta's billing.
