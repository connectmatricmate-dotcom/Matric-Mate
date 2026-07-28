# Quality & Security Checklist — the definition of "done"

The bar every change clears before it ships. The **Best Practices** doc explains *how* to build; this is *what to verify*. Run it on your own work (and on anyone's you review). The security section catches the three mistakes AI coding tools repeat on nearly every feature — don't skip it.

---

## 1. Loading & feedback — the RIGHT indicator for the context

The mistake is one loading pattern everywhere. Match the indicator to the *kind of wait*:

| Pattern | Use when |
| :-- | :-- |
| **Skeleton screen** | A whole page/section is loading — layout known, data coming. Must **match the real shape** — never a generic spinner or "Loading…" text. |
| **Progress bar** | Duration is *knowable* — uploads, downloads, installs, multi-step jobs. (A spinner here reads as "stuck.") |
| **Inline spinner** | A small contained action — a clicked button, one section refreshing. Scoped to the control; never blocks the page. |
| **Optimistic UI (no loader)** | Instant-feeling actions that almost always succeed (like / save / toggle) — update immediately (`useOptimistic`), roll back + toast on failure. |

**Check:** is each loading moment using the pattern that fits its wait — not a spinner where a skeleton belongs, not a blocked page where an optimistic update belongs?

## 2. Motion — it must communicate, or cut it

- Motion confirms an action / signals state, structure, or intent. If it isn't communicating, remove it.
- One pattern: **~200ms, ease-out**, a tiny **scale-on-press**; modals/sheets/drawers slide ~200ms ease-out.
- **No** bouncy/jelly overshoot, confetti, or stacked/overlapping animations — they read as "the page broke."
- **`prefers-reduced-motion` is non-negotiable** — wrap every transition/animation (incl. skeleton shimmer) so it's disabled for users who ask for less motion. Accessibility, not optional.
- Litmus: "if the animation needs explaining, it's decoration — cut it."

## 3. Interaction affordances (the "basic AI miss")

Coding agents constantly ship elements that *look* clickable but don't *behave* clickable. Hover + Tab through every screen:

- **`cursor: pointer`** on every clickable thing (buttons, links, tabs, toggles, clickable rows/cards, icon-buttons). A clickable `<div>` never gets it by default; resets often strip it from `<button>` too. **Disabled = `cursor: not-allowed`.**
- **Visible hover state** on every clickable element; **keyboard `focus-visible` ring** reachable by Tab; **hit area ≥ ~40px**.

**Check:** hover every CTA/link/tab/row/icon-button — pointer cursor? visible hover? focus ring on Tab? Any "looks clickable, cursor stays an arrow" is a fix.

## 4. Forms

- **Placeholder** on every input (incl. password/confirm).
- **Submit CTA disabled** until fields are non-empty + valid.
- **Failed submit preserves typed values** (controlled inputs — React 19 form actions reset uncontrolled ones).
- **Client validation mirrors the server rule** — no backend-only errors for things the UI could catch.
- **Transient error banners auto-dismiss** (~7s).
- **"Open email" → inbox**, not a `mailto:` compose.
- A clear **no-results / empty state** for any search or filter.

## 5. Security — the three guards (check on EVERY feature, first)

AI coding tools repeat the same three holes on nearly every feature. Check all three before anything else.

**Guard 1 — Validation runs on the BACKEND, not just the frontend.**
A front-end check (a form rejecting bad input) is *UX only* — a user can open the request and POST the same data straight to your server action / API route, skipping the UI entirely. Every **mutating server action and every route re-validates its inputs server-side** — shape, type, allowed values — ideally with `zod`, independent of any client check. An `<input pattern>` or a disabled button is **never** the security boundary. **BLOCKING** if a server action or route uses client-supplied data without its own server-side validation.

**Guard 2 — Secrets live in `.env`, never inline, never pasted into a prompt.**
Every key read via `process.env.*` — never a literal string in committed source. **No secret ever carries a `NEXT_PUBLIC_` prefix.** The secret/admin key (`SUPABASE_SECRET_KEY`) is **server-only** — never imported into anything that reaches the browser bundle (only `lib/supabase/admin.ts`). New keys go into `.env*` **by hand** — never typed into a chat/prompt. **BLOCKING** if a secret is a literal in source, a secret gets a `NEXT_PUBLIC_` prefix, or the admin client is imported into a client component.

**Guard 3 — Authorization: every feature checks WHO may see/do WHAT.**
The classic AI miss: an endpoint returns a record without checking the requester actually *owns* it (IDOR / broken access control). (a) Every protected reader/route resolves the user with **`getUser()` server-side** (never `getSession()`); unauthenticated requests are refused/redirected by `proxy.ts`. (b) RLS scopes per-user rows to the owner, **and** the server action derives the owner id from the **authenticated session** — never from a `user_id` in the request body/params (never trust client-supplied identity). (c) Background/cron/webhook routes stay behind `CRON_SECRET` (or equivalent); user-facing routes behind the session. (d) For any *new* feature, state plainly **who may access it and when access must be denied** — and a request lacking that identity is rejected (test it). **BLOCKING** if identity comes from the request instead of the session, or a protected/per-user resource lacks an ownership check.

## 6. The rest of the safe-to-ship gate

- **User-data isolation (RLS)** on every per-user table — verify a second user can't read the first's rows. Cross-tenant leakage = BLOCKING.
- **Every API route is gated or intentionally public** — no accidental world-open *write*. Missing guard = BLOCKING.
- **No raw/interpolated SQL, no unescaped HTML** — go through the Supabase client (parameterized); let React escape output. Flag any `dangerouslySetInnerHTML` or string-built SQL.
- **No secrets in committed code**; the admin/secret key never ships to the browser.
- **Error states are designed** — an `error.tsx` boundary + per-section graceful failure; no white screen, no raw stack shown to the user.
- **DB indexes on hot queries** once tables exist and grow (latest-per-key, time-range, foreign keys used in joins).
- **Rollback is platform-native** — on Vercel, promote the prior deploy. Nothing custom to build.

---

## Definition of done

`tsc --noEmit` clean · `build` green · lint silent · the loading / motion / affordance / form checks pass for any UI touched · the **three security guards** pass for any feature touched · error + empty states exist. Then it's done.
