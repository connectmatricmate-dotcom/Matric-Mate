# {{PROJECT_NAME}} — Tech Stack

The stack and how the universal patterns map onto this app. **Build conventions live in the companion docs — follow them:**
- **`Next.js + Supabase Best Practices.md`** — how to build (layouts, streaming, skeletons, caching, `getUser()`, leaf fetching, motion, affordances, forms).
- **`QUALITY-AND-SECURITY-CHECKLIST.md`** — what to verify before "done" (incl. the three security guards).
- **`Supabase Realtime Guide.md`** — broadcast pattern, *if* you add live data.

---

## 1. Stack

| Layer | Choice | Notes |
| :-- | :-- | :-- |
| Framework | **Next.js 16** (App Router) + **React 19** | Server Components by default |
| Language | **TypeScript** | `tsc --noEmit` is part of "done" |
| Styling | **Tailwind CSS** + **shadcn/ui** | |
| Database | **Supabase Postgres** {{+ extensions, e.g. PostGIS}} | |
| Auth | **Supabase Auth** via `@supabase/ssr` | `getUser()` on the server, never `getSession()` |
| Hosting | **Vercel** | long jobs as background/cron |
| {{Project-specific}} | {{e.g. MapLibre + MapTiler / charts / AI SDK}} | browser-only libs → dynamic `{ ssr: false }` |
| Data sources | {{...}} | see `BUILD-REFERENCE.md` |

---

## 2. How this app applies the Best-Practices doc

| Pattern | How it maps here |
| :-- | :-- |
| Layouts don't re-render | {{what lives in the `(app)` layout vs page}} |
| Streaming + Suspense + skeletons | {{which sections stream}} |
| Opt-in caching | {{what's cacheable + the `cacheTag` / `revalidateTag` trigger}} |
| `getUser()` on server | {{auth model — gated or open}} |
| Leaf-level fetching | {{which panels fetch their own slice}} |
| Realtime | {{used? if not, say "static data — no realtime"}} |
| Long jobs | {{any cron/background pipeline — pattern + cadence}} |

---

## 3. Environment variables

| Var | Scope | Purpose |
| :-- | :-- | :-- |
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client | Browser-safe key |
| `SUPABASE_SECRET_KEY` | server only | Admin/RLS-bypass (cron/background) |
| `CRON_SECRET` | server only | Gates cron/background routes |
| {{...}} | | {{your keys}} |

---

## 4. Definition of "done"

Run `QUALITY-AND-SECURITY-CHECKLIST.md` on every change. Plus app-specific: {{the things unique to this app that must be true}}.
