# What we need from you, and why the timing matters

Everything on this page is blocked on someone outside the project: a regulator, Google, or a bank.
None of it can be rushed once started, and none of it starts until you do it. The development work
is ahead of these, so these are now what decides the launch date.

Ordered by how long the wait is, not by how important they are.

---

## 1. SMS sender name · 2 to 4 weeks

**What:** register a branded SMS sender ID (for example `MatricMate`) so verification codes arrive
from a name rather than a random number.

**Why it blocks:** students sign up with a phone number, not an email. No sender name means no
verification codes, which means no signup at all.

**Why now:** this is the longest wait on the whole project and nothing else depends on the clock
starting. Every day it is not filed is a day added to launch.

**What is needed:** the SMS provider applies to the PTA on your behalf, and they will ask for the
FBISE NTN carrying the trade name "MatricMate", your CNIC, a stamped letterhead request, and a
business bank account.

---

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

## 3. Domain · a few days, but two things wait on it

**What:** buy and point the domain.

**Why it blocks two things:** Safepay's KYC is per-website, so production payments cannot be
approved until the real site is live at the real address. And `BILLING_SITE` currently reads
`matricmate.pk`, which we do not own; it ships inside the Android app, so it has to be right before
the next build.

**What is needed:** the domain purchased and DNS access shared.

---

## 4. Safepay production account · after the domain

**What:** sign up and complete KYC at `https://getsafepay.pk/signup`.

**Why it waits:** their review looks at the live website, so doing it before the domain resolves
means doing it twice.

**What is needed:** the same document set as the SMS sender name, plus the business address and a
real WhatsApp number for the site footer. **We will not invent those two.** Safepay's website review
checks them, and `help@matricmate.pk` currently points at a domain nobody owns.

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
