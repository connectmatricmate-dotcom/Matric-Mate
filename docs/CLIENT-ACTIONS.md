# What we need from you, and why the timing matters

Everything on this page is blocked on someone outside the project: a regulator, Google, or a bank.
None of it can be rushed once started, and none of it starts until you do it. The development work
is ahead of these, so these are now what decides the launch date.

Ordered by how long the wait is, not by how important they are.

---

## 1. SMS sender name · NO LONGER NEEDED

Struck on 18 Aug. We are not sending SMS, and we are not using phone numbers to sign in, so there
is nothing to register and nothing to pay for. Notifications reach students three ways instead:
inside the app, as a push notification on their phone, and by email. All three are built and
working, and between them they cost nothing per message.

Do not start this process. If somebody has already begun it, it can be abandoned with no loss.

## 2. Google Play testing · 14 continuous days, plus recruiting

**What:** Google requires **12 testers** who **actually open the app** for **14 continuous days**
before a new developer account can publish publicly.

**Why it blocks:** the app cannot go on the Play Store until this is served. It is a wall, not a
queue you can pay to skip.

**Why now:** the 14 days run in parallel with development for free, or in series with launch if you
leave it. Twelve real people who will open an app daily takes longer to arrange than it sounds.

**What is needed:** a Google Play Console developer account, and 12 people with Google accounts
willing to install and open the app each day for two weeks.

---

## 3. Domain · a few days, and FOUR things now wait on it

**What:** buy and point the domain.

**Why it blocks four things now.** Safepay's KYC is per-website, so production payments cannot be
approved until the real site is live at the real address. `BILLING_SITE` reads `matricmate.pk`,
which we do not own, and it ships inside the Android app, so it has to be right before the next
build. Email cannot reach a single real student until the domain is verified in Resend, because
the test sender only delivers to the account owner. And Supabase email confirmation cannot be
switched on until that same verification is done, since its built-in sender is rate limited to a
handful of messages an hour and fails silently past that.

That last pair is the live cost: receipts, report cards and password resets all wait on it.

**What is needed:** the domain purchased and DNS access shared.

---

## 4. Safepay production account · after the domain

**What:** sign up and complete KYC at `https://getsafepay.pk/signup`.

**Why it waits:** their review looks at the live website, so doing it before the domain resolves
means doing it twice.

**What is needed:** CNIC, FBR NTN, and a business letterhead, plus the business address and a real
WhatsApp number for the site footer. **We will not invent those two.** Safepay's website review
checks them.

One related decision while you are here: every support address in both apps and on all four legal
pages now reads from a single constant, `SUPPORT_EMAIL` in `packages/core/src/billing.ts`. It
currently points at the Gmail account, because that mailbox certainly exists and
`help@matricmate.pk` does not yet. Say the word once the domain receives mail and it is a one line
change.

---

## 5. Content review · a few hours of a teacher's time

**What:** somebody who teaches FBISE Class 9 reads roughly twenty questions per subject.

**Why it matters:** the app now holds **2202 questions across all nine subjects**, written against
the board's own learning outcomes and checked automatically for structure: four distinct options, a
valid answer key, an explanation on every question. What no automatic check can do is tell whether
an explanation is *true*. A well-written, confident, wrong explanation passes every test we have.

This is not a full review and should not be. Twenty questions per subject is enough to catch a
systematic problem, which is the kind that matters. It is the single highest-value few hours anyone
could spend on this product before students see it.

---

## Not blocked on you

For completeness, so you know what we are doing meanwhile: study progress syncing to the server,
offline downloads, and the AI tutor. None of those need anything from you.
