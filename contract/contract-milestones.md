# AI Edutech App · Upwork Contract & Milestones

> Snapshot of the live Upwork contract (as of **Sat, 19 Jul 2026**). Job post: `contract-description.md` (same folder).
> Companion docs: Scoping / SOW / Feasibility in `../docs/`. Product name: **Matric Mate**.

## Contract summary

| Field | Value |
| :---- | :---- |
| Type | Fixed-price |
| Total project price | **$1,852.00** (≈ Rs 515,000 at ≈ Rs 278/US$1) |
| Funds in escrow | $278.00 (milestone 1) |
| Milestones paid | 0 ($0.00) |
| Milestones remaining | 10 ($1,852.00) |
| Client | **Adnan** |
| Freelancer account | **Mati Ul** |
| Contract created & M1 funded | Sat, 18 Jul 2026 |
| Current action | Start milestone 1 and submit work by **Sat, 1 Aug 2026** |

## Milestones (10)

**Ordering is a client decision:** the original plan (feasibility doc / SOW) was **web first, then mobile**. When the contract was created, the client (Adnan) said no: **mobile first (Android only), then web**. So milestones 1–5 = native Android app (maps to SOW Stage B M1–M5), milestones 6–10 = web (maps to Stage A W1–W5). Consequence: there is no pre-built web backend to reuse, so the backend gets stood up during the mobile stage instead.

| # | Deliverable | Amount | Due (2026) | Status |
| :-: | :---- | ---: | :---- | :---- |
| 1 | Clickable prototype + mobile app on client's phone: onboarding + auth + navigation + browse | $278.00 | Aug 1 | **Active & funded** |
| 2 | Study module + offline | $185.00 | Aug 12 | Not started |
| 3 | Practice & tests + AI tutor (mobile) | $285.00 | Aug 17 | Not started |
| 4 | Progress + payments + push + sync | $239.00 | Aug 22 | Not started |
| 5 | Polish + Play Store submission + launch | $239.00 | Aug 29 | Not started |
| 6 | Foundation + live landing page + onboarding + auth (web) | $178.00 | Sep 5 | Not started |
| 7 | Curriculum + admin CMS + Study (video / notes / "Ask AI") | $85.00 | Sep 12 | Not started |
| 8 | Practice & Test (MCQs, fill-blanks, short Q, flashcards, past papers, tests) | $85.00 | Sep 19 | Not started |
| 9 | AI Tutor + AI features + Progress & report cards | $139.00 | Sep 26 | Not started |
| 10 | Subscription (Safepay) + push + QA + web go-live | $139.00 | Sep 30 | Not started |

**Sum check:** $278 + 185 + 285 + 239 + 239 + 178 + 85 + 85 + 139 + 139 = **$1,852** ✓

## Stage totals

- **Mobile stage (1–5):** $1,226 · 18 Jul → 29 Aug (≈ 6 weeks incl. Play Store launch)
- **Web stage (6–10):** $626 · → 30 Sep (≈ 4.5 weeks incl. web go-live)

## Timeline log

- **Sat, 18 Jul 2026:** Adnan created the milestone; Adnan activated and funded milestone 1 ($278).

## Divergences to keep in mind (job post vs. our docs)

The Upwork job post (`contract-description.md`) narrows/changes the doc scope: **FBISE Class 9 only** at MVP (Class 10 + other boards later); **audio lessons in, video library future-phase**; **confidence slider + confidence analytics required** (verified diagram/SOW had it out of scope); curriculum hierarchy includes **Medium** (Board → Medium → Class → Subject → Chapter, i.e. dual English/Urdu medium is in); **phone OTP auth**; admin **content review before publish**; **AI usage quotas** required.

**19 Jul 2026:** the three docs in `../docs/` were updated to the signed reality (mobile-first Android-only, ~11-wk Upwork schedule, M1 $278 incl. clickable prototype, referral/dual-medium/Class-9-first resolved). **Still to reconcile with Adnan before the affected milestones:** video in Study (M2/M7), confidence slider (M3/M8), TTS voice-over, payments entity (M4).

**10 Aug 2026, resolved:** **phone OTP vs email + password** is settled. Sign-in is by phone number with a password, no email field at signup, matching what the job post originally asked for. A verification code goes out at signup and at password reset only, not on every login, which is the difference between roughly Rs 2,100 and Rs 51,250 a month at 2,000 students. We stay on Supabase; its Send SMS Hook routes the code through a Pakistani provider. Adnan also confirmed he wants SMS, WhatsApp and email messaging, and push notifications from the mobile app. Detail in `../docs/NOTIFICATIONS.md`, tasks in the mobile plan under M1.5.

This is a change to delivered M1 work rather than new scope, and it does not reopen the milestone. It does add a client dependency: the SMS sender name needs an FBR NTN carrying the trade name "MatricMate", and takes two to four weeks to clear.
