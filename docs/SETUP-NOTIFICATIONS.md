# Setting up notification delivery

What to create, where to put it, and what works before it exists. Written 18 Aug 2026, when the
dispatcher landed with email live and push and WhatsApp waiting on credentials.

The design decisions behind all of this are in `NOTIFICATIONS.md`. This file is only the setup.

## Where things stand

| Channel | State | Blocked on |
| :-- | :-- | :-- |
| In-app inbox | Live | nothing |
| Email | Live, but only reaches the Resend account owner | a verified sending domain |
| Push | Written, reports itself unconfigured | a Firebase project |
| WhatsApp | Written, reports itself unconfigured | Meta verification, which needs the domain live |

A channel with no credentials returns `unconfigured`, which is deliberately distinct from `failed`
so that a channel nobody has switched on yet does not look like an outage in the logs.

## 1. Resend, for email

The API key is already in `apps/web/.env.local` and a test send has been confirmed. Two things are
still outstanding.

**Verify the sending domain.** Until this is done, `onboarding@resend.dev` only delivers to the
Resend account owner, so email to real students silently goes nowhere.

1. Resend → Domains → Add domain → `matricmate.com.pk`
2. It shows SPF, DKIM and DMARC records. Add all three in Cloudflare.
3. **Set each one to "DNS only", not proxied.** A proxied mail record fails authentication with no
   error anywhere, and the mail lands in spam.
4. Once it is verified, change `EMAIL_FROM` to something on that domain, e.g.
   `MatricMate <no-reply@matricmate.com.pk>`.

**Point Supabase's own mail at it.** Supabase's built-in sender is rate limited to a handful of
messages an hour and is not for production. Once the domain is verified: Supabase dashboard →
Project Settings → Authentication → SMTP Settings → enable custom SMTP, host `smtp.resend.com`,
port `465`, username `resend`, password the Resend API key.

## 2. Firebase, for push

Free, no card, and we enable Cloud Messaging only so nothing else in Firebase can start charging.

1. <https://console.firebase.google.com> → **Add project** → name it `MatricMate`.
2. Turn **Google Analytics off** when it offers. Nothing here uses it and it adds another consent
   flow to the setup.
3. **Add an Android app.** The package name must be exactly:

   ```
   pk.matricmate.app
   ```

   Nickname and SHA-1 can be left blank; SHA-1 is only needed for Google sign-in, which we do not
   use. Download the **`google-services.json`** it offers and send it over.
4. **Project settings → Service accounts → Generate new private key.** This downloads a JSON file.
   It is a credential: send it the same way you would a password, and not in a chat window.
5. **Project settings → Cloud Messaging → Web configuration → Generate key pair.** Copy the key
   that appears. This is the VAPID key, and it is what lets the website send push as well as the
   app.

From the service account JSON, three values become environment variables: `project_id`,
`client_email` and `private_key`.

## 3. Vercel environment variables

Add under Project → Settings → Environment Variables, for **Production and Preview** both.

**Now, for email:**

| Name | Value |
| :-- | :-- |
| `RESEND_API_KEY` | the key from Resend |
| `EMAIL_FROM` | `MatricMate <onboarding@resend.dev>` until the domain is verified, then the real address |

**After Firebase:**

| Name | Value |
| :-- | :-- |
| `FIREBASE_PROJECT_ID` | `project_id` from the service account JSON |
| `FIREBASE_CLIENT_EMAIL` | `client_email` from the same file |
| `FIREBASE_PRIVATE_KEY` | `private_key` from the same file, newlines and all |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | the web push key pair from step 5 |

`FIREBASE_PRIVATE_KEY` is the one that goes wrong. It is a multi-line PEM block. Paste it complete,
including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines. Vercel keeps the
newlines; if a value ever arrives with literal `\n` in it instead, the code has to convert them
back, so it is worth checking the first time.

Already set and not to be touched: `CRON_SECRET`, `ANTHROPIC_API_KEY`, the Supabase keys, the
Safepay keys.

## 4. Email confirmation at sign-up

Both apps already have a "confirm your email" screen, and both can send the mail again for one that
never arrived. Neither has ever appeared, because **Supabase currently has email confirmation
turned off**, which is why all existing accounts show as confirmed: they were auto-confirmed at
sign-up rather than by anyone clicking a link.

To turn it on: Supabase dashboard → Authentication → Sign In / Providers → Email → enable **Confirm
email**.

Do the SMTP step first. With confirmation on and the built-in sender still in place, sign-ups start
failing quietly the moment the hourly limit is reached.

Existing accounts are unaffected: all of them are already confirmed and stay that way.

## What is deliberately not here

**SMS.** The most expensive channel, the most paperwork (a sender name needs an NTN with
"MatricMate" as the registered trade name, plus two to four weeks), and the most regulated. In
Pakistan WhatsApp reaches the same person for a similar price. See `NOTIFICATIONS.md` §2 if it is
ever revisited.

**Phone number sign-in.** Considered and rejected: it puts the SMS provider inside the login path,
so a provider outage stops anyone creating an account. The number we collect is a contact detail on
the profile, never an identifier, which is what lets us add WhatsApp later without touching how
anybody signs in.
