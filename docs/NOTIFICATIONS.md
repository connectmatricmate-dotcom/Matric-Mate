# MatricMate · Notification channels in Pakistan

Research and decision record, 6 Aug 2026. Client asked for SMS, WhatsApp and email notifications.
Rates verified against provider pricing pages that day; anything not confirmed on a primary source is
marked. Rupee figures use Rs 278 = $1.

## The short version

Email and push cover almost everything MatricMate needs, and both are effectively free at our scale.
WhatsApp is worth paying for at exactly one moment: the renewal reminder. SMS is not worth buying at
all right now, and it is the only channel with a registration fee and an annual renewal.

## Cost per 1,000 messages, delivered to a Pakistani user

| Channel | Cost per 1,000 | Setup cost | Notes |
| :-- | --: | :-- | :-- |
| Push (FCM) | Rs 0 | Rs 0 | App users only, and only if they allow notifications |
| Email (Resend) | Rs 0 to 111 | Rs 0 | Free to 3,000/month, then $20/month covers 50,000 |
| WhatsApp utility | Rs 2,800 to 4,450 | Rs 0 platform fee | Meta Cloud API direct, no reseller markup |
| WhatsApp marketing | Rs 13,100 to 13,900 | Rs 0 platform fee | Anything promotional, roughly 3x utility |
| SMS, local aggregator | Rs 3,850 | Rs 5,000 once, Rs 5,000/yr | Branded sender, needs NTN and CNIC paperwork |
| SMS, Twilio and similar | Rs 131,600 | Rs 0 | Verified on Twilio's and Plivo's own Pakistan pages |

The last row is not a typo. International CPaaS routes into Pakistan cost roughly 34 times a local
aggregator, and Twilio's own Pakistan guide warns that our sender name can be silently replaced with
a random short code because it is not registered locally. International SMS is off the table.

The gap that actually decides the architecture is the one between rows 2 and 3: a WhatsApp message
costs around a thousand times an email. Every message we can honestly deliver by email or push
should go by email or push.

## What each channel is for

**Push (FCM).** Study reminders, streaks, "your test starts in 10 minutes". Free and unlimited.
Already planned for M4. Reaches only app users who granted permission, so it can never be the
channel for anything commercially important.

**Email.** The default for everything transactional: password reset, email confirmation, the
"email me the link" flow in the mobile app, payment receipts, and the monthly report card link.
Recommended provider is **Resend**: 3,000/month free permanently, $20/month for 50,000, an official
Supabase custom-SMTP guide, and an official Vercel Marketplace integration. It is the only provider
on Supabase's supported list that combines a permanent free tier with immediate production access
and no manual approval queue.

This is also a live bug, not just a nice-to-have. Supabase's built-in email sender is capped at
**2 messages per hour** and Supabase's own docs say it is for demos and team testing only. Password
reset is effectively broken for real users until custom SMTP is configured.

**WhatsApp.** Worth its cost only where reach directly protects revenue, which in practice means the
subscription expiry reminder, and arguably the payment confirmation. Use Meta's **Cloud API
directly**: there is no platform fee and no reseller markup, so we pay Meta the per-message rate and
nothing else.

**SMS.** Skip for now. It costs about the same per message as WhatsApp, adds Rs 5,000 setup plus
Rs 5,000 a year, needs a PTA-allocated short code behind the brand name, and delivers a worse
experience. Telenor and Ufone historically show a short code instead of the brand name, so
"MatricMate" is not even guaranteed to appear. The only thing that would justify it is phone-number
login with SMS OTP, which we do not have and should avoid adding.

## What we already get for free, and should not accidentally pay for

The report card is the clearest example. `components/screens/ReportCard.tsx` already shares it
through **WhatsApp's own share sheet**, which the student taps. That satisfies the landing page's
promise that the report "arrives on WhatsApp like any other message" at zero cost and with no API,
no template approval and no opt-in requirement. Only switch it to a pushed API message if the client
specifically wants it delivered without the student doing anything.

Applying the same test to every planned notification leaves a very small paid surface:

| Job | Channel | Cost |
| :-- | :-- | :-- |
| Password reset, email confirm | Email | Free |
| "Email me the link" to checkout | Email | Free |
| Payment receipt | Email, optionally WhatsApp | Free, or Rs 3.50 |
| Expiry reminder, 2 days before | WhatsApp, email fallback | Rs 3.50 each |
| Monthly report card | WhatsApp share sheet, already built | Free |
| Study reminders, streaks | Push | Free |

At 500 paying users on monthly plans that is roughly **Rs 1,750 to 3,500 a month**, inside the
Rs 0 to 15k run-cost ceiling the client cares about. The same volume on SMS would cost about the
same per message but add the setup and annual fees and look worse.

## Play Store position

Unchanged and already documented in `PAYMENTS-AND-PLAY-COMPLIANCE.md`: Google Play forbids linking
to external payment from **inside the Android app**, and explicitly permits reaching the same user
by email, SMS or WhatsApp outside it. WhatsApp's own Commerce Policy restricts completing a
transaction inside the chat thread, not linking out to our website. So a WhatsApp or email message
carrying a checkout link is compliant on both sides. This is the whole reason the "email me the
link" flow exists.

## What Meta charges, and the deadline that matters

Pakistan rates after Meta's 1 April 2026 increase, triangulated across sources that agree within
about 30 percent. Confirm the exact figure in WhatsApp Manager once the account exists.

- Utility: $0.010 to $0.016 per delivered message
- Authentication: same as utility
- Marketing: $0.047 to $0.050
- Service messages, meaning free-form replies inside the 24 hour window: free today

**On 1 October 2026 that last line goes away.** Service messages become chargeable, and utility
templates sent inside an open service window lose their free status too. Meta publishes final rates
by 1 September 2026. This lands squarely in our launch window, so budget on the assumption that
nothing is free after 1 October.

A second change is still rolling out: messaging limits are now pooled across the whole Business
Portfolio rather than per number, and Meta is collapsing the old 2k and 10k daily tiers so a
verified business jumps straight to a 100,000/day baseline.

## Setup requirements, and who has to do them

WhatsApp Cloud API is the long pole. It is a client action, in the same category as the Play Console
account, and it should start now.

1. **Meta Business Portfolio** in the business's legal name.
2. **Business verification**: SECP registration certificate or sole-proprietor documents, FBR NTN,
   and a live website whose footer shows the same legal name and address. Reported turnaround ranges
   from one day to thirty; 1 to 3 weeks is the realistic planning assumption.
3. **Display name approval**: the WhatsApp display name must match the verified legal entity and
   appear on the website. Promotional names such as "Best Exam Prep" get rejected.
4. **A dedicated phone number** that has never been used on consumer WhatsApp, and cannot be reused
   afterwards.
5. **A billable card.** Meta bills in USD. Some Pakistani cards fail here, which is the main reason
   local resellers exist. If it blocks us, a local reseller advertising 0 percent markup costs about
   $10 a month and accepts JazzCash and Easypaisa.

This chains onto the domain purchase already in flight: verification wants a live site at the
business's own domain, so `matricmate.com.pk` should be resolving before we file.

**PTA risk worth designing around.** PTA warned in May and June 2026 that WhatsApp accounts tied to
inactive, unregistered or non-biometrically-verified SIMs may be blocked. If the business number
sits on a SIM that lapses, the notification channel dies with it. Verifying the number as a landline
over a voice call avoids the biometric SIM regime entirely, and is the safer choice.

## Opt-in, which we do not currently collect

Meta requires explicit permission, tied to our business name, before any template message. A single
opt-in is enough and it does not have to say the word WhatsApp, but it has to be real. Sending
without it produces blocks, blocks lower the quality rating, and a low rating now throttles the
whole Business Portfolio rather than one number.

We do not collect this today. Signup takes name, email and password only. Adding WhatsApp means
adding an optional phone field plus a consent checkbox, and storing both.

## Recommended build order

1. **Resend for email, this week.** Unblocks password reset, which is currently capped at 2 an hour,
   plus the "email me the link" flow that today only shows a toast and sends nothing. Free.
2. **A `lib/notify/` seam**, built the same way `lib/gateway/` was built for payments: one interface,
   swappable channel implementations, no route or component naming a vendor. Start with email only.
   Adding WhatsApp later then costs an implementation, not a rewrite.
3. **FCM push in M4**, as already planned.
4. **WhatsApp Cloud API before launch.** Start business verification immediately because of the lead
   time, and use it only for expiry reminders and payment confirmations as Utility templates.
5. **SMS: not now.** Revisit only if phone login is added, or if measurement shows renewal reminders
   failing to reach a meaningful share of users.

## Domain and deliverability groundwork

Independent of provider choice, on `matricmate.com.pk` with Cloudflare DNS:

- SPF, DKIM and DMARC on a dedicated sending subdomain such as `mail.matricmate.com.pk`, keeping the
  root domain's reputation separate.
- Exactly one SPF record, under 10 DNS lookups. Two records is a hard failure.
- DKIM at 2048 bits.
- DMARC starting at `p=none` with a reporting address, tightened later.
- **Every mail record set to DNS only, the grey cloud, never proxied.** A proxied CNAME-based DKIM
  record fails silently with no error at creation time. This is the most common Cloudflare mistake.
- No dedicated IP. Those pay off above roughly 200,000 emails a month, and below that they hurt,
  because there is not enough volume to build a reputation.

Gmail's bulk sender rules bite at 5,000 messages a day to personal Gmail addresses. We are far below
that, so one-click unsubscribe is not required for transactional mail, but SPF and DKIM are required
of every sender regardless of volume.

## Open items

- Exact Pakistan per-message rates: confirm in WhatsApp Manager, sources vary by up to 30 percent.
- Meta's post 1 October 2026 service message rate: not published until 1 September 2026.
- Whether the client's card works with Meta's USD billing.
- Whether the client has SECP registration or is operating as a sole proprietor, which changes the
  verification documents.
