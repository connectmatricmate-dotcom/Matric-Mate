-- A student's mobile number.
--
-- Three things need it and none of them work without it:
--
--   * Safepay rejects both the customer and the guest-session calls without a
--     phone number, and the guest session is what pins the payer's email at
--     checkout so it cannot be changed on the payment page.
--   * JazzCash and Easypaisa are keyed on a mobile number.
--   * The app promises a renewal reminder two days before a plan ends, and in
--     Pakistan that arrives on WhatsApp, not by email.
--
-- Stored in E.164 (+923001234567) because that is what Safepay and every SMS
-- gateway expect. Students type 03001234567; the conversion happens once, on
-- the way in, so nothing downstream has to guess which format it is holding.

alter table public.profiles
  add column if not exists phone text
  check (phone is null or phone ~ '^\+92\d{10}$');

comment on column public.profiles.phone is
  'Mobile number in E.164, e.g. +923001234567. Collected at first checkout.';
