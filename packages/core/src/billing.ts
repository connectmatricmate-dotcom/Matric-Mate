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
 *   · no checkout, plan picker, price, or Buy/Upgrade/Subscribe control
 *   · no link, deep link or WebView to a payment or pricing page
 *   · no payment links in push notifications
 *   · plain, non-tappable text may name the website, nothing more
 */

/** Named so the intent survives future edits: nothing may be sold here. */
export const CAN_SELL_IN_APP = false;

/** Mentioned as plain text only, never a link, never a button. */
export const BILLING_SITE = 'matricmate.pk';

/**
 * The one address a student is told to write to.
 *
 * It lived in two places and they disagreed: the website's help page offered
 * help@matricmate.pk while the Android app opened a draft to the Gmail
 * account. A student who mailed the wrong one got silence, which is worse than
 * either address on its own. This is the mailbox that certainly exists. Point
 * it at help@matricmate.pk here, in this one line, once that domain is
 * receiving mail.
 */
export const SUPPORT_EMAIL = 'connect.matricmate@gmail.com';

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
