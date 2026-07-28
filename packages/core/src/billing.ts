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
