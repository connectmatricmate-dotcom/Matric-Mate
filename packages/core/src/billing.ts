/**
 * MatricMate does not sell anything inside the Android app. Ever.
 *
 * Google Play requires Play Billing for in-app digital subscriptions and forbids
 * leading users to any other payment method from inside the app. The programmes
 * that allow external billing (User Choice / Billing Choice) do not cover
 * Pakistan, and Play Billing in Pakistan accepts cards only, no JazzCash or
 * EasyPaisa, which is where our students' money actually is.
 *
 * So the app is consumption-only, the way Netflix is: it logs in, checks
 * entitlement, and shows locked content plainly. Buying happens on the Next.js
 * web app, and every prompt to buy reaches the student outside the app, via
 * WhatsApp, SMS or email, which Play explicitly permits.
 *
 * Rules this file exists to enforce (breaking them risks suspension, not just a
 * failed review):
 *   · no checkout, plan picker, price, or Buy/Upgrade/Subscribe/Renew control
 *   · no link, copied link, deep link or WebView to a payment or pricing page
 *   · the website may be NAMED in plain text ("plans are on matricmate.co"),
 *     never linked. Google allows exactly this for an app that sells nothing
 *     itself: "For services and products that are consumption only ...,
 *     developers may choose to provide additional information about
 *     purchasing options without direct links", with "Go to our website to
 *     upgrade your subscription to Premium" as its own example (Play Console
 *     Help, Understanding Google Play's Payments policy, checked 25 Sep 2026).
 *     The Android wording lives under plansWhere.* and the plan notices.
 *   · no price anywhere in the app, not even in plain text; prices, and the
 *     button that signs a student in on the plans page, are for email only
 *     (lib/notify on the website), which is outside the app
 *   · a locked screen says it is locked; a student whose plan has ended meets
 *     the paused screen (app/paused.tsx), which names the website and can
 *     Check again
 * This file used to forbid naming the website at all, which was stricter than
 * the policy and left a student who only had the app with no way to find out
 * how to continue. Checked 15 Sep 2026: the external-links programme (billing
 * choice), which would allow an actual link, covers the UK, the EEA and the US
 * only, not Pakistan.
 */

/** Named so the intent survives future edits: nothing may be sold here. */
export const CAN_SELL_IN_APP = false;

/** The website's name, as plain text only: where plans are (plansWhere.*) and the staff signpost. Never as a link on Android: see the rules above. */
export const BILLING_SITE = 'matricmate.co';

/**
 * The one address a student is told to write to.
 *
 * It lived in two places and they disagreed once, and a student who mailed the
 * wrong one got silence, which is worse than either address on its own. So it
 * is one line, here.
 *
 * matricmate.co receives mail through ImprovMX, which forwards connect@ (and a
 * catch-all for anything else at the domain) into the Gmail inbox the client
 * reads, and replies go back out as connect@ through Resend. Verified end to
 * end with a real message before this changed: pointing students at an address
 * that does not yet receive would have been worse than the Gmail one.
 */
export const SUPPORT_EMAIL = 'connect@matricmate.co';

/**
 * The team's WhatsApp number, as it is read out.
 *
 * The website gives it as where the payment screenshot goes. The Android app
 * opens a chat with it from the paused screen, with a message that says only
 * that the student wants to upgrade their account: no price and no way to pay
 * goes with it, and the person who answers explains the rest.
 */
export const SUPPORT_WHATSAPP = '+92 315 6969779';

/** A wa.me link to a number, with the message already written. */
export const whatsappUrl = (number: string, text: string): string =>
  `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

/**
 * Who is behind the site, in the words a payment gateway checks for.
 *
 * PayFast will not review a merchant whose website does not name a local
 * office and a phone number, and a student deciding whether to send money is
 * asking the same question the reviewer is. One place, both apps, so the
 * answer cannot drift the way SUPPORT_EMAIL once did.
 *
 * Empty strings render nothing rather than a placeholder: a wrong address on
 * a payments page is worse than a missing one, and this file is not the place
 * to invent a business's details.
 */
export const BUSINESS: {
  name: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  hours: string;
} = {
  /** Legal or trading name of the merchant, as it will read on a bank statement. */
  name: 'MatricMate',
  /** Street address of the office, one line. */
  address: 'Office No 4, Friends Arcade, Street 87, G-13/1',
  city: 'Islamabad',
  country: 'Pakistan',
  /** Reachable during support hours, in local format. */
  phone: '051 8778600',
  hours: '10am to 10pm, Monday to Saturday',
};
