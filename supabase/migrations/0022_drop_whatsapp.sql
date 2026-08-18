-- WhatsApp is not part of the product.
--
-- It was built as a fourth delivery channel yesterday: an adapter, a consent
-- timestamp, an optional number on the profile and a switch in both apps. The
-- client has since decided against it. Notifications are the in-app inbox,
-- push and email, and nothing else.
--
-- The consent column goes because consent is the only thing it recorded and
-- there is now nothing to consent to. It holds no rows: nobody ever agreed to
-- a channel that never sent a message.

alter table public.profiles drop column if exists whatsapp_opt_in;

-- profiles.phone stays. It predates this by a long way (0003), it is not the
-- WhatsApp number, and dropping a column with real values in it to tidy up a
-- feature that never shipped is the wrong trade. Nothing writes to it now.
comment on column public.profiles.phone is
  'Contact number, optional, +92 format. Not collected by either app at present and never an identifier: sign-in is by email.';
