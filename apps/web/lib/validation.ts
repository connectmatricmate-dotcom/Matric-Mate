/**
 * One validation rule per field, shared by the form and (later) the server
 * action, so a user never round-trips to learn "min 6 characters".
 */

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateName(v: string) {
  return v.trim().length >= 2 ? null : 'Enter your full name.';
}

export function validateEmail(v: string) {
  if (!v.trim()) return 'Enter your email.';
  return EMAIL_RE.test(v.trim()) ? null : 'Use an email like hassan.ali@gmail.com.';
}

export function validatePassword(v: string) {
  return v.length >= 6 ? null : 'At least 6 characters.';
}

export function validateMobile(v: string) {
  const digits = v.replace(/\D/g, '');
  return /^(92)?0?3\d{9}$/.test(digits) ? null : 'Enter an 11-digit number, like 03001234567.';
}

/**
 * To E.164, which is what Safepay and every SMS gateway want.
 *
 * Students type 03001234567, sometimes 0300-1234567, occasionally +92 300…
 * All of them mean the same number, so normalise once here rather than let
 * three formats loose in the database.
 */
export function toE164(v: string) {
  const digits = v.replace(/\D/g, '').replace(/^92/, '').replace(/^0/, '');
  return `+92${digits}`;
}

export function validateCardNumber(v: string) {
  const digits = v.replace(/\D/g, '');
  if (digits.length < 13) return 'Enter the 16 digits on the front of the card.';
  // Luhn, catches a mistyped digit before the payment page ever sees it.
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0 ? null : 'That card number doesn’t look right, check the digits.';
}

export function validateExpiry(v: string) {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(v.trim());
  if (!m) return 'Use MM/YY, like 09/28.';
  const month = Number(m[1]);
  if (month < 1 || month > 12) return 'Months run from 01 to 12.';
  const now = new Date();
  const expiry = new Date(2000 + Number(m[2]), month, 0, 23, 59, 59);
  return expiry >= now ? null : 'That card has expired.';
}

export function validateCvc(v: string) {
  return /^\d{3,4}$/.test(v.trim()) ? null : 'The 3 digits on the back of the card.';
}

export const isFormValid = (...errors: (string | null)[]) => errors.every((e) => e === null);
