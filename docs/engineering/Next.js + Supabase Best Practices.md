# Next.js 16 + Supabase Best Practices

**Read this before writing any UI code.** These are the patterns that fix the problems teams hit again and again: pages stuck on a blank screen until all data loads, headers/sidebars getting rebuilt on every navigation, buttons with no loading feedback, no skeletons, no caching.

This isn't theory — it's the exact 2026 App Router patterns for Next.js 16 + React 19 + `@supabase/ssr` v0.7+. Follow them. The examples use a neutral domain (an authenticated app with a shell, a few streamed panels, and a "saved items" feature) — map them onto your app.

---

## 1. Layout composition — never rebuild static UI

**The mistake:** Putting header / sidebar / shell inside every page component. When the user navigates, the entire shell re-renders, loses state (scroll position, open menus), and re-fetches data it didn't need to re-fetch.

**The fix:** Use Next.js layouts. **Layouts do NOT re-render on navigation between their child pages.** This is the single most important App Router pattern.

### Pattern

```
app/
├── layout.tsx                       # ROOT — html/body, fonts, providers, global CSS
└── (app)/
    ├── layout.tsx                   # APP SHELL — sidebar, header
    │                                # ↑ This renders ONCE. Never re-renders when child page changes.
    ├── page.tsx                     # /             — home
    ├── items/[id]/page.tsx          # /items/123    — detail
    ├── saved/page.tsx               # /saved
    └── settings/page.tsx            # /settings
```

### Rules

1. **Anything that's the same across multiple pages goes in `layout.tsx`, not in the page.** Sidebar, header, footer — all in `app/(app)/layout.tsx`. The children prop is where each page slots in.

2. **Layouts are Server Components by default.** They can `async / await` data — perfect for fetching the current user or anything every page needs.

3. **Don't duplicate the shell.** If you find yourself importing `<Sidebar />` in `page.tsx`, you've done it wrong — the layout already rendered it. The page should only render *page-specific* content.

4. **Layouts preserve client state across navigations.** Open a dropdown in the sidebar, navigate to `/saved`, come back — dropdown is still open. That's the layout doing its job.

5. **Route groups (parens, e.g. `(app)`) don't affect the URL** — they just group pages that share a layout. `/login` is in `app/(auth)/login/page.tsx` but the URL is `/login`, not `/(auth)/login`.

### Example: app shell layout

```tsx
// app/(app)/layout.tsx — Server Component, renders once across all app routes
import { Suspense } from "react";
import { Sidebar } from "@/components/app/sidebar";
import { Header } from "@/components/app/header";
import { UserMenu } from "@/components/app/user-menu";
import { UserMenuSkeleton } from "@/components/app/skeletons";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex">
      <Sidebar />                                {/* Renders ONCE, persists across navigation */}
      <div className="flex-1 flex flex-col">
        <Header>
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />                         {/* Streams in independently */}
          </Suspense>
        </Header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
```

---

## 2. Streaming + Suspense — show something within 100ms

**The mistake:** Page is blank until ALL data loads. User sees nothing for 3 seconds, then everything appears at once. Feels broken.

**The fix:** Use Suspense boundaries around each data-dependent section. The static shell (header, sidebar, section titles) paints immediately, and each section streams in independently as its data arrives.

### Two levels of streaming

**Level 1 — Route-level skeleton (`loading.tsx`):** the file `app/(app)/loading.tsx` automatically wraps the route in a Suspense boundary. While the page is loading, the user sees the skeleton instantly — including the layout (sidebar, header) which is already there.

```tsx
// app/(app)/loading.tsx
import { HomePageSkeleton } from "@/components/app/skeletons";

export default function Loading() {
  return <HomePageSkeleton />;
}
```

**Level 2 — Per-section Suspense:** inside the page itself, wrap each independently-fetched section in its own `<Suspense>` so they stream in one at a time. Fast sections appear first; slow sections show their skeleton until ready.

```tsx
// app/(app)/page.tsx — Server Component
import { Suspense } from "react";
import { SummaryPanel } from "@/components/app/summary-panel";
import { ActivityPanel } from "@/components/app/activity-panel";
import { ItemsPanel } from "@/components/app/items-panel";
import {
  SummaryPanelSkeleton,
  ActivityPanelSkeleton,
  ItemsPanelSkeleton,
} from "@/components/app/skeletons";

export default function Home() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Suspense fallback={<SummaryPanelSkeleton />}>
        <SummaryPanel />
      </Suspense>
      <Suspense fallback={<ActivityPanelSkeleton />}>
        <ActivityPanel />
      </Suspense>
      <Suspense fallback={<ItemsPanelSkeleton />}>
        <ItemsPanel />
      </Suspense>
    </div>
  );
}
```

### Rules

1. **Every data-bound section gets its own `<Suspense>`.** If you await data inside a component without wrapping it in Suspense, the entire parent waits — defeating the purpose of streaming.

2. **Fetch data INSIDE the component that needs it, not in the parent.** Server components can fetch their own data in parallel. Don't prop-drill data down — let each leaf component fetch what it needs.

3. **Wrong pattern (blocking):**
   ```tsx
   // ❌ Bad — page waits for all 3 queries before any render
   export default async function Page() {
     const summary = await getSummary();
     const activity = await getActivity();
     const items = await getItems();
     return <div>{/* render all 3 */}</div>;
   }
   ```

4. **Right pattern (streaming):**
   ```tsx
   // ✅ Good — each section streams independently
   export default function Page() {
     return (
       <>
         <Suspense fallback={<SummarySkeleton />}><Summary /></Suspense>
         <Suspense fallback={<ActivitySkeleton />}><Activity /></Suspense>
         <Suspense fallback={<ItemsSkeleton />}><Items /></Suspense>
       </>
     );
   }
   // Each child does its own `await getXxx()` internally
   ```

5. **Static parts (titles, section headers, panel chrome) paint immediately** — they're not behind Suspense. The user sees the page structure within ~100ms, then content fills in.

---

## 3. Skeletons — make them feel real

**The mistake:** Generic "Loading..." text or a single spinner in the middle of a blank section. Feels like the app is broken.

**The fix:** Skeleton shapes that match the actual content's layout. The user's eye anchors to the structure, perceives progress, doesn't feel jarred when content swaps in.

### Rules

1. **Skeleton dimensions should match the real content's dimensions.** Same row count, same column widths, same height. If your panel is 320px tall with content, the skeleton is 320px tall too — no layout shift when content arrives.

2. **Use a shimmer animation.** A subtle moving gradient signals "actively loading" vs "broken." All skeletons share the same `Skeleton` primitive.

3. **One skeleton primitive, many compositions.** Don't reinvent the shimmer for each section. One `<Skeleton className="h-4 w-32" />` building block, composed differently per section.

### The primitive

```tsx
// components/ui/skeleton.tsx
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-stone-200/50", className)}
      {...props}
    />
  );
}
```

```css
/* globals.css — for a fancier shimmer */
@keyframes shimmer {
  100% { transform: translateX(100%); }
}
```

### Composing per-section skeletons

```tsx
// components/app/skeletons.tsx
import { Skeleton } from "@/components/ui/skeleton";

export function SummaryPanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-md border p-4 space-y-3">
      <Skeleton className="h-3 w-24" />               {/* Title */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />            {/* Label */}
          <Skeleton className="h-4 w-16" />            {/* Value */}
        </div>
      ))}
    </div>
  );
}
```

**Keep all section skeletons in one file (`components/app/skeletons.tsx`)** — easy to find, easy to keep in sync with the real components.

---

## 4. Button loading states — use `useFormStatus`

**The mistake:** Click "Save" → button does nothing visible → user clicks again → duplicate submissions, confusion.

**The fix:** Every server-action button shows pending state. React 19's `useFormStatus` is the canonical way.

### Pattern: SubmitButton component

```tsx
// components/ui/submit-button.tsx — reusable, drop into any form
"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
// `Spinner` is whatever icon component your design system provides.

export function SubmitButton({
  children,
  pendingChildren,
  ...props
}: {
  children: React.ReactNode;
  pendingChildren?: React.ReactNode;
} & React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? (
        <>
          <Spinner className="size-4 animate-spin mr-2" />
          {pendingChildren ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
```

### Usage

```tsx
// app/(app)/saved/page.tsx — Server Component
import { addItem } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";

export default function SavedPage() {
  return (
    <form action={addItem}>
      <input name="label" required />
      <SubmitButton pendingChildren="Adding...">Add item</SubmitButton>
    </form>
  );
}
```

```ts
// app/(app)/saved/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addItem(formData: FormData) {
  const label = formData.get("label") as string;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  // Re-validate server-side (the security boundary), then derive the owner
  // from the SESSION — never from the request body.
  await supabase.from("saved_items").insert({ label, user_id: user.id });
  revalidatePath("/saved");
}
```

### Rules

1. **`useFormStatus` must be in a CHILD of the `<form>`, not the form itself.** That's why `SubmitButton` is its own component.
2. **Every server-action form gets a `SubmitButton`.** Don't reach for `useState` + `onClick` + manual loading state when `useFormStatus` is built for this.
3. **For non-form mutations (toggles, single-click actions), use `useActionState`** to get pending state at the component level:

```tsx
"use client";
import { useActionState } from "react";

function DeleteButton({ id }: { id: string }) {
  const [, formAction, pending] = useActionState(deleteItem.bind(null, id), null);
  return (
    <form action={formAction}>
      <button disabled={pending}>{pending ? "Deleting..." : "Delete"}</button>
    </form>
  );
}
```

---

## 5. Optimistic updates — make it feel instant

**The mistake:** Click "Save" → spinner for 500ms → item appears. Feels sluggish.

**The fix:** React 19's `useOptimistic` — show the change immediately, then reconcile with the server response. If the server fails, React automatically rolls back.

### Pattern

```tsx
"use client";
import { useOptimistic } from "react";
import { addItem } from "./actions";
import { SubmitButton } from "@/components/ui/submit-button";

type Item = { id: string; label: string; pending?: boolean };

export function SavedClient({ initial }: { initial: Item[] }) {
  const [optimisticItems, addOptimistic] = useOptimistic(
    initial,
    (state, newItem: Item) => [...state, { ...newItem, pending: true }]
  );

  async function handleAdd(formData: FormData) {
    const label = formData.get("label") as string;
    addOptimistic({ id: crypto.randomUUID(), label });
    await addItem(formData);  // server action — if it throws, optimistic is rolled back
  }

  return (
    <>
      <form action={handleAdd}>
        <input name="label" required />
        <SubmitButton>Add</SubmitButton>
      </form>
      <ul>
        {optimisticItems.map(i => (
          <li key={i.id} className={i.pending ? "opacity-50" : ""}>{i.label}</li>
        ))}
      </ul>
    </>
  );
}
```

### When to use

- **Use `useOptimistic`** for fast UX wins: add/remove from a list, settings toggles, anything where the operation is very likely to succeed.
- **Don't use it** for operations where failure is meaningful (payment, irreversible deletes). For those, show pending state + clear feedback.
- **Caveat:** rollback only happens if the action *throws*. If it returns an error object instead, the optimistic state sticks. So your server action either succeeds or throws — no silent error returns.

---

## 6. Caching — opt in deliberately

Next.js 16 caching is **opt-in**. Nothing is cached by default. You decide what to cache, for how long, and how to invalidate.

### Three knobs to know

**`use cache` directive** — cache an async function's result.

```ts
// lib/data/config.ts
import { unstable_cacheLife as cacheLife } from "next/cache";

export async function getAppConfig() {
  "use cache";
  cacheLife("days");                  // config rarely changes
  // ... read from a config table
}
```

**`cacheLife`** — how long. Names: `seconds`, `minutes`, `hours`, `days`, `weeks`, `max`. Or custom: `cacheLife({ stale: 60, revalidate: 300, expire: 3600 })`.

**`cacheTag`** — invalidate by tag.

```ts
import { unstable_cacheTag as cacheTag } from "next/cache";

export async function getItem(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`item:${id}`);
  // ... DB read
}

// elsewhere, after a write:
import { revalidateTag } from "next/cache";
revalidateTag(`item:${id}`);     // invalidate just this item's cache
```

### What to cache

- **Config / lookup tables, formatter helpers** → `cacheLife("days")` or `"max"` — rarely change.
- **A list page (current page of results)** → `cacheLife("minutes")` + `cacheTag("items")` — invalidate on write.
- **Per-item detail data that changes slowly** → `cacheLife("hours")` + `cacheTag(\`item:${id}\`)`.
- **Live, frequently-changing, or realtime-driven data** → DON'T cache — it's faster to read fresh (or subscribe to changes) than to invalidate.
- **Per-user data** → don't cache on a shared key; if you must, put the user id in the key.

### Rules

1. **Don't cache user-specific data on shared keys.** Per-user caches need the user ID in the key (or just don't cache them).
2. **Don't cache realtime-driven data.** A broadcast is faster than any cache invalidation cycle.
3. **`cacheLife("max")` for truly static data** (config, format helpers).
4. **Always pair `cacheLife` with `cacheTag` for invalidatable data** — otherwise the only way to clear it is to wait for `expire`.

---

## 7. Supabase Auth — get user, not session, on the server

**The mistake:** Using `supabase.auth.getSession()` on the server to check if a user is authenticated. **This is documented as unsafe.** The session cookie isn't validated — anyone could forge it.

**The fix:** Always use `supabase.auth.getUser()` on the server. It validates the auth cookie with the Supabase server before returning.

```ts
// ✅ Always use this pattern on the server
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");
```

```ts
// ❌ Never use getSession() on the server for auth checks
const { data: { session } } = await supabase.auth.getSession();  // UNSAFE on server
```

### Rules

1. **Server: `getUser()` always.**
2. **Client: either works** — but `getUser()` is fine if you're already paying for one round-trip.
3. **`proxy.ts` must call `updateSession()` from `lib/supabase/middleware.ts`** — without it, the session expires and the app behaves weirdly.
4. **API keys:** Supabase is migrating from `anon` / `service_role` keys to `sb_publishable_xxx` / `sb_secret_xxx`. Old keys work through end of 2026, but if you're starting fresh, use the new format (this starter does).

---

## 8. Data fetching — fetch at the leaf, not the root

**The mistake:** Fetch everything in the top-level page component, prop-drill it through 5 layers of components.

**The fix:** Server Components can each fetch their own data in parallel. Let leaves fetch what they need.

### Pattern

```tsx
// ❌ Bad — page is the data fetcher, props drilled
export default async function Page() {
  const summary = await getSummary();
  const activity = await getActivity();
  return <Layout summary={summary} activity={activity} />;
}
```

```tsx
// ✅ Good — each leaf fetches its own data, runs in parallel, streams independently
export default function Page() {
  return (
    <>
      <Suspense fallback={<SummarySkeleton />}><SummaryPanel /></Suspense>
      <Suspense fallback={<ActivitySkeleton />}><ActivityPanel /></Suspense>
    </>
  );
}

async function SummaryPanel() {
  const summary = await getSummary();  // its own fetch
  return <div>{/* ... */}</div>;
}

async function ActivityPanel() {
  const activity = await getActivity();  // its own fetch, parallel to SummaryPanel
  return <div>{/* ... */}</div>;
}
```

### Deduplication

If two components both call `getItem("123")` during the same render, you'll do the DB read twice — wasteful. Wrap shared readers in `React.cache`:

```ts
import { cache } from "react";

export const getItem = cache(async (id: string) => {
  // ... DB read
});
```

Now any number of components can call `getItem("123")` during one render — the DB is hit once.

---

## 9. Common mistakes — patterns to AVOID

The mistakes this doc exists to prevent:

| Mistake | Fix |
|---|---|
| ❌ Header/sidebar inside every page component | ✅ Put them in `layout.tsx`. Layouts don't re-render on navigation. |
| ❌ `await` all data at top of page → blank until everything loads | ✅ Suspense around each section + skeleton fallback. Streaming, not blocking. |
| ❌ Generic "Loading..." spinner in the middle of a section | ✅ Layout-matching skeleton with shimmer. Same dimensions as real content. |
| ❌ `onClick={async () => {…}}` with `useState` for pending state | ✅ Server action via `<form action={…}>` + `<SubmitButton>` using `useFormStatus`. |
| ❌ A mutation button takes 500ms to reflect the change | ✅ `useOptimistic` — show the change instantly, reconcile after. |
| ❌ Repeatedly fetching the same data on every page navigation | ✅ Layout-level data fetching for shared data, `use cache` for static-ish data. |
| ❌ `getSession()` on the server to check auth | ✅ Always `getUser()` on the server — the only validated check. |
| ❌ `"use client"` on the whole page so one widget can be interactive | ✅ Keep page server-side, isolate the interactive widget into its own small Client Component. |
| ❌ Polling every 5 seconds to "refresh" data | ✅ Supabase broadcast — see `Supabase Realtime Guide.md`. |
| ❌ Prop-drilling fetched data through 4 component layers | ✅ Let each leaf component fetch its own data via Server Component `await`. |
| ❌ Single global `loading.tsx` that shows "Loading..." for the entire page | ✅ Route-level `loading.tsx` (instant) + per-section `<Suspense>` (granular). |
| ❌ A heavy browser-only widget imported at the top of a Server Component | ✅ Dynamic import with `{ ssr: false }` inside a Client Component wrapper (§15). |

---

## 10. Verification checklist (before claiming any UI page is done)

- [ ] Hard-refresh the page. The layout (sidebar, header) appears within 100ms — not after a delay.
- [ ] Each data section shows its skeleton during loading, replaced smoothly by real content. No layout shift on swap.
- [ ] Navigate to another page in the same layout group. Sidebar / header do NOT flash or re-render — they persist.
- [ ] Click a form-submit button. It shows pending state ("Adding...", spinner, disabled) until the action completes.
- [ ] Throttle the network (Chrome → Network → "Slow 3G"). The page is usable section-by-section, not blank-then-everything.
- [ ] Lighthouse Performance score ≥ 90 (test on production, not dev).
- [ ] No console errors on initial render or navigation.
- [ ] If you use realtime: open two tabs, trigger the change in tab 1, watch tab 2 update without refresh.
- [ ] Each loading moment uses the pattern that fits its wait (§11) — skeleton for sections, inline spinner for buttons, optimistic for list-style actions. No spinner where a skeleton belongs.
- [ ] Motion is calm and communicative (§12): ~200ms ease-out, no bouncy/decorative animation, and `prefers-reduced-motion` is respected (toggle it in dev tools and confirm animations stop).

If any of these fail, the section isn't done. Don't move on.

---

## 11. Loading & feedback — the right indicator for the context

§2–§5 each cover one loading pattern. The mistake is reaching for one of them everywhere — a spinner where a whole section is loading, or a blocking spinner on an action that should feel instant. Match the indicator to the *kind of wait*:

| Pattern | Use when | Where it applies | Covered in |
|---|---|---|---|
| **Skeleton screen** | A whole page or large section is loading — layout is known, data is coming (the feed pattern: IG / LinkedIn / YouTube). | The app's main routes + every data panel. | §2, §3 |
| **Progress bar** | The duration is *knowable* — uploads, downloads, installs, multi-step jobs. A spinner here makes people think it's stuck. | Rare. Only a long UI-triggered job would justify one. | — |
| **Inline spinner** | A small, contained action — a clicked button, one section refreshing. Just "we're working on it." | Form-submit buttons (`SubmitButton`). Scoped to the control — never blocks the page. | §4 |
| **Optimistic (no loader)** | Instant-feeling actions that almost always succeed; roll back on failure (the IG "heart turns red immediately" pattern). | Add/remove from a list, settings toggles. | §5 |

### Rules

- **Default a section to a skeleton, not a spinner.** A spinner in the middle of a section throws away the layout information you already have.
- **Default an action to optimistic** when it's very likely to succeed and cheaply reversible. Fall back to an inline spinner only when failure is meaningful (§5).
- **Never block the whole page** on one action's pending state — keep the indicator on the control that triggered it.
- **No bare "Loading…" text** anywhere (already a §3 rule — restated because it's the most common regression).

---

## 12. Motion — it must communicate, or cut it

**Motion's job is to signal state, structure, or intent.** If an animation isn't communicating something, remove it. The Figma is the visual source of truth — follow its motion where it specifies any; these defaults fill the gaps.

### Rules

- **One pattern:** ~200ms transitions on the **ease-out** curve, with a tiny **scale shift on press** (a button compresses ~1 frame). Modals / sheets slide in over ~200ms ease-out.
- **No** bouncy / jelly spring overshoot, confetti, or stacked / overlapping animations — users read those as "the page broke."
- **`prefers-reduced-motion` is non-negotiable** — every transition and animation must be disabled (or reduced to a plain opacity fade) for users who ask for less motion. This includes the §3 skeleton shimmer.
- **Litmus test:** if the animation needs explaining, it's decoration — cut it.

### Pattern

```css
/* globals.css — the reduced-motion guard. Non-negotiable; wrap the whole app. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

```tsx
// A button that compresses one frame on press — communicates the click, nothing more.
<button className="transition-transform duration-200 ease-out active:scale-[0.98]">
  Save
</button>
```

---

## 13. Interaction affordances — make clickable things look and behave clickable

The basics that are trivial to skip and instantly make a UI feel broken or "AI-built." **Every interactive element must signal that it's interactive.**

- **`cursor: pointer` on everything clickable** — buttons, links, tabs, toggles, clickable cards/rows, sidebar items, icon-buttons. Don't assume the browser does it: a clickable `<div>`/`<span>` never gets a pointer, and resets often strip it from `<button>` too. Add `cursor-pointer` (Tailwind). **Disabled** controls get `cursor-not-allowed` + `disabled:` styling — never a plain arrow that looks active.
- **Visible hover state** — every clickable element changes on hover (background, colour, or underline). If hover does nothing, it doesn't read as clickable.
- **Keyboard focus** — a visible `focus-visible:` ring on every interactive element (don't remove outlines without replacing them); Tab order must reach every control.
- **Hit area** — clickable targets ≥ ~40px; don't make a 12px icon the only hit target.
- **Press feedback** — pair with the §12 `active:scale-[0.98]` press cue.

```tsx
// Clickable element checklist, in one line of Tailwind:
<button className="cursor-pointer hover:bg-[var(--bg-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors">
```

**Review check (every UI change):** hover every CTA, link, tab, row, and icon-button — does the cursor become a pointer, does it visibly respond, and can you reach + see it with keyboard Tab? Disabled = `not-allowed`. Any "looks clickable but the cursor stays an arrow" is a fix.

---

## 14. Forms — placeholders, preserved state, gated submits, mirrored validation

Forms are where "AI-built" UIs leak basic mistakes. Standards for **every** form:

- **Placeholder on every input — including password / confirm.** Show the expected format or a hint (`"At least 10 characters"`). A box with only a label reads as unfinished.
- **Validate on the frontend too — mirror the server rule.** The server action is the security boundary (always validate there), but the client MUST apply the *same* rule (email format, min length, match) so the user learns it instantly. **Never make them submit and round-trip to discover "password needs 10 characters."** Keep the rule in one shared module and import it on both sides.
- **Gate the submit CTA** — `disabled` until the relevant fields are non-empty AND valid (with `disabled:cursor-not-allowed`, §13). No submitting an obviously-invalid form.
- **Preserve what the user typed on a failed submit.** React 19 form actions **reset uncontrolled inputs** after submission — so on a wrong-password error the fields clear, which is hostile. Use **controlled inputs** (`useState` + `value`/`onChange`) so values survive the error.
- **Transient errors auto-dismiss** — an inline error banner clears itself after ~7s (and re-shows on a new failed submit), `role="alert"` for screen readers. Don't leave a stale error pinned forever.
- **Affordances deep-link correctly** — an "Open email" button opens the recipient's **inbox**, never a `mailto:` compose window.

**Review check:** every input has a placeholder; the CTA is disabled until valid; a failed submit keeps the entered values; client validation matches the server rule (no backend-only errors for things the UI could catch); error banners auto-clear.

---

## 15. Heavy / browser-only widgets — charts, maps, editors

Some libraries (charting, maps, rich-text editors) touch `window` and can't render on the server. Treat them as isolated client islands.

- **Dynamic import with `{ ssr: false }` inside a Client Component wrapper** — never import them at the top of a Server Component (it breaks the build / hydration).
  ```tsx
  "use client";
  import dynamic from "next/dynamic";
  const Chart = dynamic(() => import("./chart"), { ssr: false, loading: () => <ChartSkeleton /> });
  ```
- **One wrapper, reused everywhere** — put the library config in a single component so a change applies app-wide; don't re-configure it per use.
- **Keep the page a Server Component** — only the widget island is `"use client"`. The page still streams; the widget gets a shape-matched skeleton (§3) as its `loading` fallback.
- **Theme via CSS variables**, resolved at runtime — never hard-code a hex into a chart/map so it follows light/dark.
- **Always give the user a way to read the data.** A chart with no axis *and* no hover readout is decoration, not information. Provide axes, a hover tooltip, or both.

---

## 16. Responsive & density

Layout, spacing, and density are **design decisions** — your `DESIGN-SYSTEM.md` (ingested from the Figma) is the source of truth. A few engineering rules hold regardless:

- **The shell is responsive; build mobile deliberately.** Decide the approach up front — mobile-first (`sm:`/`lg:` add desktop) or desktop-down (`max-lg:` strip back to mobile) — and keep it consistent. If a desktop layout is already approved, prefer **additive** `max-lg:`/`lg:hidden` changes so you can't regress it.
- **One navigation source of truth.** A desktop sidebar and a mobile drawer/bottom-bar should render the **same** nav list — don't fork it.
- **Don't crush dense content on small screens.** Step grid column counts down (`grid-cols-4` → `max-lg:grid-cols-2`), let wide tables scroll, stack side rails under the main column.
- **Spend contrast on the data, not the chrome.** Low-contrast borders/labels, readable values. Numeric columns: monospace + `tabular-nums`, right-aligned, so digits line up.
- **Consume semantic tokens, never raw hex** (see `DESIGN-SYSTEM.md`) — that's what keeps dark mode and rebrands free.

---

## Reference

- [Next.js 16 streaming guide](https://nextjs.org/docs/app/guides/streaming)
- [Next.js loading.tsx file convention](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
- [Next.js 16 cacheComponents](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
- [Next.js 16 Cache Components official blog post](https://nextjs.org/blog/next-16)
- [Supabase SSR for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [React `useOptimistic` reference](https://react.dev/reference/react/useOptimistic)
- [React `useFormStatus` reference](https://react.dev/reference/react-dom/hooks/useFormStatus)
- [React `useActionState` reference](https://react.dev/reference/react/useActionState)
