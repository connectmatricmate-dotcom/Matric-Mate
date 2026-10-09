/**
 * Where the money goes while plans are switched on by hand.
 *
 * The student sends the price to any one of these, then the screenshot to the
 * WhatsApp number, and the admin switches Premium on. The website shows all of
 * it and so does the email a request sends.
 *
 * Website only, like the prices in lib/plans.ts and for the same reason: the
 * Android app must never show a way to pay (packages/core/src/billing.ts), so
 * shared code is the wrong home for these.
 */

export type PayAccount = {
  /** The wallet or bank, as students know it. */
  method: string;
  /** The name the account is held in, which the sender's app shows before they confirm. */
  title: string;
  number: string;
};

export const PAY_ACCOUNTS: PayAccount[] = [
  { method: 'JazzCash', title: 'Adnan Zafar', number: '03156969779' },
  { method: 'Easypaisa', title: 'Adnan Zafar', number: '03334646853' },
  { method: 'BankIslami', title: 'AAZ Devops Ventures', number: '310539397400001' },
  { method: 'UBL', title: 'Adnan Zafar', number: '0659274376553' },
  { method: 'Bank Alfalah', title: 'Adnan Zafar', number: '00821007991139' },
];

/** The WhatsApp number the payment screenshot goes to, as it is read out. */
export const PAY_WHATSAPP = '+92 315 6969779';

/** The accounts as plain lines, for an email or a WhatsApp message. */
export const accountLines = (): string => PAY_ACCOUNTS.map((a) => `${a.method}: ${a.number} (${a.title})`).join('\n');

/**
 * A wa.me link to the payments number with the message written: who is
 * paying and for what, so the screenshot can be matched to an account
 * without a conversation.
 */
export function whatsappLink(message: string): string {
  return `https://wa.me/${PAY_WHATSAPP.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}
