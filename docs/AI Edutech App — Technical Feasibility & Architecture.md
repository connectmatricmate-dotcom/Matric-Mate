# AI Edutech App — Technical Feasibility & Architecture

## 1\. Project Scope

An **AI-powered exam-prep app for 9th & 10th class** (**Punjab Board \+ FBISE**), built to the verified six-flow design.

- **Curriculum:** Board (Punjab / FBISE) → Class (9 / 10\) → Subject → Chapter → Lesson. Subjects per client content (diagram shows Mathematics, Physics, Chemistry, Biology, English, Urdu, Islamiat).  
- **Study (Learning):** chapter content with **Learn / Notes / Examples** tabs, **video lessons** \+ exercises, and an embedded **"Ask AI"** explanation.  
- **Practice & Test:** **MCQs** (topic-wise & mixed), **Fill-in-the-Blanks**, **Short Questions**, **Flashcards**, **Past Papers**, and **graded tests** (score, %, XP, review answers).  
- **AI layer:** AI Tutor (24/7 doubt solving, explain, solve, concept clarification), AI Test Generator (weak-area-based), AI Progress Analyzer (weak topics \+ plan), AI Study Planner (daily "Today's Plan"), AI Flashcards.  
- **Progress & Reports:** overall \+ per-subject progress, performance analytics, weak topics, shareable monthly **report card** (students & parents).  
- **Platforms:** **native Android & Web** from one codebase (**mobile app first, then web**; iOS is a future phase), with **offline mode** and **real-time sync**.  
- **Commercial:** Premium **Rs 1,000/month**; local payment rails (cards \+ JazzCash \+ EasyPaisa).  
- **Plus:** a separate marketing **landing page**, push notifications, and a content **admin/CMS** to ingest the client-provided material.  
- **Not built (per verified flow):** mind-map; per-question confidence slider (progress tracks accuracy / weak topics / XP instead).  
- **Pending confirmation:** Urdu/English **audio voice-over (TTS)** and the **payments entity** (see §8). *(Resolved: referral/commission is in scope — SOW §6.14; dual-medium is in — Medium is a curriculum level; iOS is a future phase.)*

## 2\. Architecture

**Content (client-supplied):** the client provides chapters, video lessons, notes, MCQs, fill-in-the-blanks, short questions, and past papers → we **ingest and structure** them into the curriculum; structured data in **Postgres**, **video/media on Bunny.net** (CDN). *(Optional: Azure TTS audio if voice-over is confirmed.)*

**Runtime:**

1. **Both clients — the Next.js web app and the React Native (Expo) native app — call the same API.** Media (video) streams from **Bunny CDN**, never through the origin.  
2. Attempts, test results, XP, and activity events are written to **Postgres**; these power progress, weak topics, and report cards.  
3. **AI tutor, test generation, and study plans** call **Claude** server-side (per-user quota \+ caching).  
4. **Subscriptions** via **Safepay**; webhooks update entitlement. **Push** via **FCM**.  
5. Static assets \+ API behind **Cloudflare**; video behind **Bunny**. Mobile keeps an **offline cache** and **syncs** across devices.

The origin server does only light JSON work — heavy bytes (video) and static content are offloaded to CDNs, which is what makes the concurrency requirement cheap to meet (§7).

## 3\. Recommended Tech Stack

| Layer | Choice | Rationale |
| :---- | :---- | :---- |
| Web app \+ API \+ Admin | **Next.js (App Router, TypeScript)** | Full web app \+ REST/tRPC API \+ content-admin/CMS in one deployable |
| **Mobile — native Android**  | **React Native \+ Expo (EAS)** | True native, one cross-platform codebase (Android only; iOS future phase); shares TS \+ monorepo with web |
| Shared code | **Turborepo monorepo** | Types / API client / validation / domain logic shared by web \+ mobile |
| Database \+ Auth \+ Storage | **PostgreSQL (Supabase)** | Postgres \+ Auth (email/phone \+ password) \+ Storage \+ row-level security |
| AI tutor (runtime) | **Claude Sonnet 4.6** | Doubt solving, explanations, solve-a-question |
| AI test gen / flashcards / study plan | **Claude Haiku 4.5** | Cheap, high-volume generation from the client's content |
| Video \+ media delivery | **Bunny.net** (Stream \+ Storage \+ CDN) | Cheap, offloads heavy video bandwidth from the origin |
| Payments | **Safepay** (cards \+ JazzCash \+ EasyPaisa) | PK-registered businesses can onboard (Stripe can't — §7) |
| Push notifications | **Firebase Cloud Messaging (FCM)** | Free, web \+ Android |
| CDN / edge / WAF | **Cloudflare** | Caching, TLS, DDoS protection |
| Hosting (origin) | **Vercel** (launch) → **Hetzner VPS** (scale) | Ship fast, migrate for cost later |
| Analytics | **In-house event tracking → Postgres** | Powers progress, weak topics, report cards |
| Audio TTS *(optional)* | **Azure Neural TTS** (`ur-PK` \+ English) | Only if voice-over is confirmed (§8) |

## 4\. Services & Pricing (Verified — June 2026, in PKR)

| Domain | Provider | Cost (PKR) | Notes |
| :---- | :---- | :---- | :---- |
| AI tutor (runtime) | **Claude Sonnet 4.6** | ≈ Rs 835 in / Rs 4,170 out per 1M tokens (cache reads ≈ 0.1×) | Scales with usage; per-user quota |
| AI test gen / flashcards / study plan | **Claude Haiku 4.5** (Batch −50%) | ≈ Rs 278 in / Rs 1,390 out per 1M (→ Rs 139 / Rs 695 batched) | From client-provided content |
| Database \+ Auth \+ Storage | **Supabase** | **Rs 0 → ≈ Rs 6,950/mo** (Pro) | Free tier early; Pro \= 8 GB DB, 100 GB storage, 100k MAU |
| Video \+ media storage/CDN | **Bunny.net** | Storage ≈ Rs 2.8/GB·mo; **CDN ≈ Rs 1.4/GB**; Stream encode ≈ Rs 278/1,000 min | Main usage-scaling cost is video bandwidth |
| Hosting (origin) | **Vercel Pro** *or* **Hetzner VPS** | ≈ Rs 5,560/mo (Vercel) / ≈ Rs 4,450/mo (Hetzner CPX31) | Either runs Next.js comfortably |
| CDN / WAF | **Cloudflare** | Rs 0 (Free) → ≈ Rs 5,560/mo (Pro) | DDoS \+ caching \+ TLS |
| Mobile builds \+ OTA | **Expo EAS** | Free tier → from ≈ Rs 27,500/mo only at high build volume | Cloud Android builds \+ OTA; local builds free |
| Push notifications | **Firebase FCM** | **Free** | Unlimited push |
| Payments | **Safepay** (or PayFast) | **\~2–3% per transaction (MDR)**, no fixed monthly | Cards \+ JazzCash \+ EasyPaisa |
| Play Store (one-time) | Google Play | **≈ Rs 6,950 one-time** |  |
| Domain | — | ≈ Rs 2,800–4,200/yr | Landing \+ app domains |
| Audio TTS *(optional)* | **Azure Neural TTS** | ≈ Rs 4,170 / 1M chars (only if confirmed) | `ur-PK` Urdu \+ English neural |

**Estimated monthly run-cost at launch (≈1k–5k active users):** **≈ Rs 33,000–90,000/mo** \+ payment processing (\~2–3% of revenue). The main scaling driver is **video bandwidth** (cheap on Bunny).

**One-time content cost:** **≈ Rs 0** — the **client provides all source content**; we ingest and structure it. *(Only optional cost: Azure TTS voice-over if confirmed, ≈ Rs 4,170 per 1M characters of narration.)*

## 5\. Build Complexity

Medium overall. Large in **surface area** (full six-flow app on two platforms), not in novel difficulty.

| Component | Complexity |
| :---- | :---- |
| Onboarding (class / board / subjects / account / subscription) | Low–Medium |
| Curriculum \+ content ingestion \+ admin CMS | Medium |
| Study (video lessons \+ Learn/Notes/Examples \+ "Ask AI") | Medium |
| MCQ engine \+ graded tests (score / XP / explanations / review) | Medium |
| Fill-in-the-Blanks \+ Short Questions | Low–Medium |
| Flashcards | Low |
| Past Papers | Low–Medium |
| AI tutor (streaming) | Medium |
| AI test generator / study planner / flashcards | Medium |
| Progress, weak topics, report card | Medium |
| Subscription \+ Safepay (cards \+ wallets) \+ webhooks | Medium |
| Auth (email/phone \+ password) | Low–Medium |
| **Native mobile app** (React Native/Expo, built first — stands up the shared backend) | Medium–High |
| Shared monorepo (types / API / domain logic) | Low–Medium |
| Push (FCM) | Low |
| Offline mode \+ cross-device sync | Medium |
| Video player \+ media | Low–Medium |
| Landing page (separate) | Low |
| Deployment \+ CI \+ CDN | Low–Medium |

## 6\. Rough Time Estimate

**\~11 weeks total (18 Jul → 30 Sep 2026 — locked by the signed Upwork milestones)**, incl. testing/QA, AI-assisted, delivered in **two sequential stages: the native mobile app first (\~6 weeks, → 29 Aug), then the web app (\~4.5 weeks, → 30 Sep).** The mobile stage stands up the **shared backend** (monorepo \+ Supabase \+ curriculum \+ auth) alongside the native UI; the web stage (Next.js) then **reuses that backend and monorepo** for the web UI, admin CMS, and landing page. The **client supplies content in parallel**, so content is not a build bottleneck.  
**Stage A — Native mobile app (\~6 weeks, 18 Jul → 29 Aug; builds the shared backend):**

| Phase | Due (2026) | Scope |
| :---- | :---- | :---- |
| M1. Clickable prototype \+ mobile foundation | 1 Aug | **Clickable prototype of the full app** (all screens, navigable); RN/Expo app installable on device: onboarding \+ auth \+ navigation \+ curriculum browse; monorepo \+ Supabase foundation |
| M2. Study \+ offline | 12 Aug | Study module (notes/"Ask AI") \+ offline cache |
| M3. Practice \+ AI tutor | 17 Aug | Practice & tests \+ AI tutor on mobile |
| M4. Progress \+ payments \+ push \+ sync | 22 Aug | Progress/report cards; Safepay; FCM push; cross-device sync |
| M5. Polish \+ store launch | 29 Aug | Native polish; Play Store submission; launch |

**Stage B — Web app (\~4.5 weeks, → 30 Sep; reuses the backend):**

| Phase | Due (2026) | Scope |
| :---- | :---- | :---- |
| W1. Web foundation \+ Landing \+ Onboarding | 5 Sep | Next.js web app on the existing backend; web onboarding \+ auth; **live landing page** |
| W2. Curriculum \+ CMS \+ Study | 12 Sep | Admin CMS; ingest client content; chapter study (Learn/Notes/Examples \+ "Ask AI") on web |
| W3. Practice & Tests | 19 Sep | MCQs (topic/mixed), fill-in-the-blanks, short questions, flashcards, past papers, graded tests (score/XP/explanations/review) on web |
| W4. AI layer \+ Progress | 26 Sep | AI tutor, test generator, study planner, flashcards; progress, weak topics, shareable report card on web |
| W5. Payments \+ push \+ QA \+ web launch | 30 Sep | Safepay (cards \+ JazzCash \+ EasyPaisa) at Rs 1,000/mo, webhooks; FCM push; QA; web go-live |

**Payment milestones** for the two stages are in the SOW (§15) — front-loaded, mobile first then web.

**Fast-follow / later:** anything confirmed from §8 (audio voice-over, dual-medium content, referral/commission).

**Estimate assumes:** scope locked before each stage; **client content supplied in parallel**; API/service accounts (Supabase, Anthropic, Safepay, Bunny, Firebase, Expo EAS, Google Play) provisioned before the phase that needs them; testing/QA included in each phase; review feedback within 2–3 business days; no mid-build provider/scope changes.

## 7\. Technical Constraints

1. **Client provides all source content** (chapters, videos, notes, MCQs, past papers) — content is **not** a build bottleneck; we ingest and structure it.  
2. **Stripe is not available to Pakistan-registered businesses.** Card acceptance goes through a local PSP (**Safepay/PayFast**) or requires a foreign (UK/US) entity. JazzCash/EasyPaisa are PK-only rails regardless.  
3. **Video bandwidth is the main usage-scaling cost** — kept cheap via **Bunny CDN** (\~Rs 1.4/GB); video never streams through the origin server.  
4. **Concurrency is met by offloading** — video via Bunny, static/API caching via Cloudflare, DB connection pooling. The origin only does light JSON work, so it serves thousands of concurrent users for this read-heavy workload. AI endpoints get **per-user quotas** \+ caching.  
5. **Web and native app share logic, not UI** — both TypeScript on one monorepo, but React Native renders native components, so screens are built once per platform (budgeted in §6).  
6. **iOS is built from the same Expo codebase** — adds Apple's ≈ Rs 27,500/yr account, App Store review, and device testing (fast-follow, not a rebuild).  
7. **Testing/QA is budgeted in** each phase (web: Playwright \+ unit; mobile: Jest \+ RN Testing Library \+ device E2E).  
8. **Audio voice-over (TTS) is optional** — only built if confirmed. Authentic Pakistani Urdu is available via **Azure `ur-PK`** (Google offers only Indian Urdu; ElevenLabs lists no Urdu); audio would be pre-generated per lesson (zero runtime latency/cost).

## 8\. Open Items Requiring Client Confirmation

**Resolved by the verified diagram / client:** content source (**client provides all**), pricing (**Rs 1,000/mo**), boards (**Punjab \+ FBISE**), classes (**9 & 10**), design (**per the diagram**), and the full feature/question-type set.

**Resolved since contract signing (18 Jul 2026):** build order (**mobile first, then web** — per the Upwork milestones), **iOS** (future phase, not in this contract), **referral/commission** (in scope — specced in SOW §6.14), **dual-medium** (in — Medium is a level of the curriculum hierarchy), launch scope (**FBISE Class 9 first**; Class 10 \+ other boards later).

**Still open:**

1. **Payments entity** — Pakistan-registered (→ Safepay: cards \+ JazzCash \+ EasyPaisa) or a UK/US entity (→ Stripe)?  
2. **Audio / Urdu voice-over (TTS)** — client-provided audio lessons are in scope (per the job post); whether TTS-generated voice-over is also needed is unconfirmed.  
3. **Video in the study module** — the job post defers the video library to a later phase ("no video for now"), but Study/M7 wording still mentions video — confirm with client.  
4. **Confidence slider** — required in the job post, excluded by the verified diagram/SOW — confirm before the practice milestones (M3/M8).

## 9\. Summary

The project is **technically feasible end-to-end** and matches the client's verified flow. Every external capability is available at commodity prices: strong **AI** for the tutor / test generator / study planner (Claude), cheap **video delivery** (Bunny), **local payments** (Safepay — the realistic substitute for Stripe, which can't onboard PK businesses), and free **push** (FCM). The recommended stack — a **Turborepo monorepo** running **Next.js** (web \+ API \+ admin) and **React Native / Expo** (native Android; iOS later), on **Supabase \+ Cloudflare**, with media on Bunny and AI on Claude — is standard, buildable by one AI-assisted developer, and scales cleanly.

Because the **client supplies all content**, the usual content bottleneck is removed: the main investment is **build time** (\~11 weeks per the signed milestones — mobile first, then web), and run-cost is modest (**≈ Rs 33,000–90,000/mo**, driven mainly by media bandwidth). Once the remaining §8 items are confirmed — especially the **payments entity** — scope is fully locked and the build proceeds in the phases above.

### Pricing sources (verified June 2026; converted at ≈ Rs 278 / US$1, the rate billed by each provider)

- Claude model pricing — Anthropic (Haiku 4.5 US$1/US$5, Sonnet 4.6 US$3/US$15 per 1M; Batch −50%).  
- [Bunny.net Stream](https://bunny.net/pricing/stream/) / [Storage](https://bunny.net/pricing/storage/) / [CDN](https://bunny.net/pricing/cdn/) — \~US$0.005/GB.  
- Pakistan gateways & Stripe availability — [Payoneer guide](https://www.payoneer.com/resources/business/guide-to-payment-gateways-in-pakistan/), [xStak](https://www.xstak.com/blog/payment-gateways-in-pakistan) (Stripe unsupported for PK-registered businesses; MDR \~2–3.5%).  
- [Azure AI Speech pricing](https://azure.microsoft.com/en-us/pricing/details/speech/) — neural TTS US$15/1M chars; `ur-PK` voices (only relevant if audio is confirmed).  
- USD→PKR ≈ 278.35 on 9 June 2026 ([exchangerates.org.uk](https://www.exchangerates.org.uk/USD-PKR-spot-exchange-rates-history-2026.html)).  
- Supabase / Vercel / Hetzner / Google Play — standard published list prices.

