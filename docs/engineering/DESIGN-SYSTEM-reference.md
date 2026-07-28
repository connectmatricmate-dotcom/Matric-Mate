# MacroPulse — Design System (Source of Truth)

> **What this is.** The canonical, code-facing record of MacroPulse's design tokens and rules, extracted **directly from the Figma design-system pages** via the Figma MCP. The Figma is the visual source of truth; this doc is its machine-readable translation so we implement tokens **once** (into `app/globals.css` + Tailwind 4 `@theme`) and reuse them everywhere. Components reference **semantic tokens only** — never raw hex, never primitives.
>
> **Source file:** `https://www.figma.com/design/8P2nLOyVmF63Vu6K5ezmCK/MacroPulse`
> **How it's built:** page-by-page. Each Figma node Haroon shares is fetched via MCP (`get_design_context` + `get_variable_defs` + `get_metadata`), then folded into this doc. See the ingestion log below.

---

## Page ingestion log

| # | Figma node | DS section | Status |
|---|---|---|---|
| 1 | `99-2` — "01 — Color" | §2–4 Color (5 ramps, semantic tokens, do/don'ts) | ✅ ingested |
| 2 | `106-2` — "02 — Typography" | §1 Typography (3 families, 16 type roles, rules) | ✅ ingested |
| 3 | `107-2` — "03 — Spacing" | §5 Spacing (4px scale, inset/gap/stack, rules) | ✅ ingested |
| 4 | `107-233` — "04 — Elevation" | §6 Elevation (6 shadows, rules) | ✅ ingested |
| 5 | `107-311` — "05 — Radius" | §7 Radius (7 corner tokens, rules) | ✅ ingested |
| 6 | `109-2` — "06 — Components / KPI" | §8 Components → KPI tiles | ✅ ingested |
| 7 | `110-2` — "07 — Components / AI Panel" | §8.2 Brief card · chat bubbles · chip | ✅ ingested |
| 8 | `111-2` — "08 — Components / Chrome" | §8.3 Status pills · headers · rail items | ✅ ingested |
| 9 | `111-140` — "09 — Components / Lists" | §8.4 Watchlist · movers · time-range | ✅ ingested |
| 10 | `123-2` — "10 — Components / Buttons" | §8.5 Buttons (3 variants × 3 sizes × 5 states) | ✅ ingested |
| 11 | `129-23` — "11 — Components / Inputs" | §8.6 Inputs / form fields | ✅ ingested |
| 12 | `176-41` — "12 — Components / Icons" | §8.7 Icons (Hugeicons, 41) | ✅ ingested |

**All 12 design-system pages ingested.** ✅ 5 foundations (Color, Typography, Spacing, Elevation, Radius) + 7 component families (KPI tiles, AI panel, Chrome/nav, Lists, Buttons, Inputs, Icons).

> Figma's own headers declare system size: Color = **5 ramps · 56 primitives · 68 semantic tokens**; Typography = **3 families · 16 type roles**; Spacing = **4px base · 18 primitives · 16 semantic insets/gaps/stacks**.

---

## 0. Token architecture (the one rule that governs everything)

Three layers, strict direction of reference:

```
PRIMITIVES  →  SEMANTIC TOKENS  →  COMPONENTS
(raw values)   (aliases primitives)  (consume semantic only)
```

- **Primitives** = the raw ramps (`neutral`, `teal`, `amber`, `green`, `red`). Never referenced by a component directly.
- **Semantic tokens** = intent-named aliases (`text.primary`, `accent.primary.bg`, `gain.text`, `status.live`). This is the **only** layer components touch.
- **Why:** a dark mode or a rebrand ships by **repointing the semantic aliases**, not by editing components. (Verbatim from the Figma: _"Semantic tokens alias the primitives so a dark mode or a rebrand ships by repointing aliases, not editing components."_)

**Build rule:** if you're about to type a hex code or a `teal-500` primitive in a component, stop — use the semantic token (or add a missing one to this doc first).

---

## 1. Typography

> **3 families · 16 type roles · tabular figures everywhere.** _"IBM Plex — Sans for UI and body, Mono for tickers and code, Serif for editorial moments (the AI brief, mainly). Numeric UI uses tabular figures so columns of values align on the decimal point."_

### Type families

| Family | Token | Role | Weights | Coverage |
|---|---|---|---|---|
| **IBM Plex Sans** | `font-sans` | UI · body · headings · values | Regular · Medium · SemiBold | 14 of 16 roles |
| **IBM Plex Serif** | `font-serif` | Editorial · brief headings only | Regular | 1 role (`brief-heading`) |
| **IBM Plex Mono** | `font-mono` | Tickers · code · timestamps | Regular · SemiBold | 1 role (`ticker`) |

- **Loading (designer's intent):** _"Self-hosted via `next/font/local` — no Google Fonts dependency"_ (IBM Plex is OFL-licensed). ⚠️ **Note vs CLAUDE.md:** CLAUDE.md says "use `next/font/google`." IBM Plex is on Google Fonts so either works, but the Figma explicitly calls for self-hosting (avoids the runtime Google dependency + a layout-shift class). Flagging for Haroon — low-stakes, recommend honoring the Figma (self-host) unless told otherwise.

### Type scale — 16 roles (use the role; never compose ad-hoc)

Spec format `family · size/line-height · weight · [tabular]`. The `Font()` column is the exact token value from Figma; the Tailwind column is the implementation recipe.

| Role token | Spec | letter-spacing | Tailwind recipe | Sample |
|---|---|---|---|---|
| `type/role/value-hero` | Sans · 36/40 · 600 · tabular | -1 (`tracking-tight`) | `text-4xl font-semibold tracking-tight tabular-nums` | `$230.12` |
| `type/role/h1` | Sans · 30/36 · 600 | -1 (`tracking-tight`) | `text-3xl font-semibold tracking-tight` | Display heading |
| `type/role/value-large` | Sans · 24/32 · 600 · tabular | -1 | `text-2xl font-semibold tabular-nums` | `5,327.11` |
| `type/role/h2` | Sans · 24/32 · 600 | 0 | `text-2xl font-semibold` | Section heading |
| `type/role/value` | Sans · 20/28 · 600 · tabular | 0 | `text-xl font-semibold tabular-nums` | `5,327.11` |
| `type/role/value-small` | Sans · 18/24 · 600 · tabular | 0 | `text-lg font-semibold tabular-nums` | `5,327.11` |
| `type/role/brief-heading` | **Serif** · 18/26 · 400 | 0 | `font-serif text-lg` | Morning brief |
| `type/role/h3` | Sans · 18/26 · 600 | 0 | `text-lg font-semibold` | Subsection |
| `type/role/brief-body` | Sans · 15/24 · 400 | 0 | `text-[15px] leading-6` | Equities edged lower today. |
| `type/role/label-section` | Sans · 14/20 · 600 | 0 | `text-sm font-semibold` | Markets Snapshot |
| `type/role/body` | Sans · 14/20 · 400 | 0 | `text-sm` | The quick brown fox jumps. |
| `type/role/button` | Sans · 14/20 · 500 | 0 | `text-sm font-medium` | Open the desk |
| `type/role/ticker` | **Mono** · 13/18 · 600 | 0 | `font-mono text-[13px] font-semibold` | `AAPL · BTC · TSLA` |
| `type/role/delta` | Sans · 13/18 · 500 · tabular | 0 | `text-[13px] font-medium tabular-nums` | `+0.43%  -0.18%` |
| `type/role/body-sm` | Sans · 12/18 · 400 | 0 | `text-xs` | as of 14:42 ET |
| `type/role/label` | Sans · 11/14 · 500 · UPPERCASE | 0.06em | `text-[11px] font-medium uppercase tracking-wider` | MARKETS SNAPSHOT |

> **Tabular figures** apply to every numeric role (`value*`, `delta`, and any number in body). `tabular-nums` is non-negotiable on data.

### Type rules

1. **✅ DO — Serif only on AI-brief headings.** Plex Serif is reserved for the `brief-heading` role. Everywhere else (settings sections, page headings) uses Plex Sans SemiBold.
2. **✅ DO — tabular figures on every number.** `tabular-nums` prevents decimal jitter in column-aligned values. Use it everywhere a number lives.
3. **🚫 DON'T — compose ad-hoc type.** Always reach for an existing role token. If a screen needs a size the system lacks, **file a new role** — don't inline-style a one-off (`✗ fontSize: 17, weight: 550`).

---

## 2. Color — Primitive ramps

> 5 ramps, 56 stops total. **AA = passes WCAG AA for text on white** (Figma marks stops 600+ as AA-safe for text). Components must not use these directly — they exist so semantic tokens can alias them.

### `neutral` — 12 stops · text, borders, backgrounds, surfaces
| Stop | Hex | AA on white |
|---|---|---|
| 0 | `#FFFFFF` | — |
| 50 | `#FAFAFA` | — |
| 100 | `#F5F5F5` | — |
| 200 | `#E5E5E5` | — |
| 300 | `#D4D4D4` | — |
| 400 | `#A3A3A3` | — |
| 500 | `#737373` | ✅ AA |
| 600 | `#525252` | ✅ AA |
| 700 | `#404040` | ✅ AA |
| 800 | `#262626` | ✅ AA |
| 900 | `#171717` | ✅ AA |
| 950 | `#0A0A0A` | ✅ AA |

### `teal` — 11 stops · primary accent · links · focus rings
| Stop | Hex | AA on white |
|---|---|---|
| 50 | `#F0FDFA` | — |
| 100 | `#CCFBF1` | — |
| 200 | `#99F6E4` | — |
| 300 | `#5EEAD4` | — |
| 400 | `#2DD4BF` | — |
| 500 | `#14B8A6` | — |
| 600 | `#0D9488` | — |
| 700 | `#0F766E` | ✅ AA |
| 800 | `#115E59` | ✅ AA |
| 900 | `#134E4A` | ✅ AA |
| 950 | `#042F2E` | ✅ AA |

### `amber` — 10 stops · secondary accent · TODAY pill · stale state
| Stop | Hex | AA on white |
|---|---|---|
| 50 | `#FFFBEB` | — |
| 100 | `#FEF3C7` | — |
| 200 | `#FDE68A` | — |
| 300 | `#FCD34D` | — |
| 400 | `#FBBF24` | — |
| 500 | `#F59E0B` | — |
| 600 | `#D97706` | — |
| 700 | `#B45309` | ✅ AA |
| 800 | `#92400E` | ✅ AA |
| 900 | `#78350F` | ✅ AA |

### `green` — 8 stops · gain · LIVE status · positive deltas
| Stop | Hex | AA on white |
|---|---|---|
| 50 | `#F0FDF4` | — |
| 100 | `#DCFCE7` | — |
| 200 | `#BBF7D0` | — |
| 300 | `#86EFAC` | — |
| 400 | `#4ADE80` | — |
| 500 | `#22C55E` | — |
| 600 | `#16A34A` | — |
| 700 | `#15803D` | ✅ AA |

### `red` — 8 stops · loss · errors · offline status
| Stop | Hex | AA on white |
|---|---|---|
| 50 | `#FEF2F2` | — |
| 100 | `#FEE2E2` | — |
| 200 | `#FECACA` | — |
| 300 | `#FCA5A5` | — |
| 400 | `#F87171` | — |
| 500 | `#EF4444` | — |
| 600 | `#DC2626` | ✅ AA |
| 700 | `#B91C1C` | ✅ AA |

---

## 3. Color — Semantic tokens

> **The only color layer components consume.** Each row gives the token, its value, the **Tailwind utility** and **CSS variable** names exactly as specified in the Figma, and usage. Where the Figma didn't print an explicit code name (the bg/border tokens), the name is inferred from the same pattern and flagged — confirm when the relevant page is ingested.

### Text — 5 tokens (foreground on light surfaces)
| Token | Hex | Tailwind | CSS var | Usage | Contrast |
|---|---|---|---|---|---|
| `text.primary` | `#171717` | `text-text-primary` | `--text-primary` | Headings, values, default body | AAA |
| `text.secondary` | `#404040` | `text-text-secondary` | `--text-secondary` | Body, secondary labels | AAA |
| `text.tertiary` | `#737373` | `text-text-tertiary` | `--text-tertiary` | Captions, timestamps, helper text | AA |
| `text.disabled` | `#A3A3A3` | `text-text-disabled` | `--text-disabled` | Disabled state **only** — fails AA for body | — |
| `text.inverse` | `#FFFFFF` | `text-text-inverse` | `--text-inverse` | On dark / accent fills | — |

### Accent — brand color, used sparingly
| Token | Hex | Tailwind | CSS var | Usage | Contrast |
|---|---|---|---|---|---|
| `accent.primary.bg` | `#14B8A6` | `bg-accent-primary` | `--accent-primary-bg` | Filled buttons, focus rings, active states | — |
| `accent.primary.text` | `#0F766E` | `text-accent-primary` | `--accent-primary-text` | Links, accent text on white | AA |
| `accent.primary.bg-subtle` | `#F0FDFA` | `bg-accent-primary-subtle` ⚠️ | `--accent-primary-bg-subtle` ⚠️ | Subtle accent fill / hover wash | — |
| `accent.secondary.bg` | `#F59E0B` | `bg-accent-secondary` | `--accent-secondary-bg` | TODAY pill, AI-thinking indicator (scarce) | — |
| `accent.secondary.text` | `#B45309` | `text-accent-secondary` ⚠️ | `--accent-secondary-text` ⚠️ | Secondary-accent text | AA |
| `accent.secondary.bg-subtle` | `#FFFBEB` | `bg-accent-secondary-subtle` ⚠️ | `--accent-secondary-bg-subtle` ⚠️ | Subtle amber wash | — |

### Direction — gain / loss (always paired with a ▲▼ glyph — see do/don'ts)
| Token | Hex | Tailwind | CSS var | Usage | Contrast |
|---|---|---|---|---|---|
| `gain.text` | `#15803D` | `text-gain` | `--gain-text` | Positive deltas — `green.700` (post-audit fix) | AA |
| `gain.bg` | `#F0FDF4` | `bg-gain` ⚠️ | `--gain-bg` ⚠️ | Positive-delta background wash | — |
| `gain.border` | `#22C55E` | `border-gain` ⚠️ | `--gain-border` ⚠️ | Positive-delta border | — |
| `loss.text` | `#DC2626` | `text-loss` | `--loss-text` | Negative deltas — `red.600` | AA |
| `loss.bg` | `#FEF2F2` | `bg-loss` ⚠️ | `--loss-bg` ⚠️ | Negative-delta background wash | — |
| `loss.border` | `#EF4444` | `border-loss` ⚠️ | `--loss-border` ⚠️ | Negative-delta border | — |

### Status — Live / Closed / Stale / Offline indicator dots
| Token | Hex | Tailwind | CSS var | Usage |
|---|---|---|---|---|
| `status.live` | `#22C55E` | `bg-status-live` | `--status-live` | Active polling, green dot |
| `status.closed` | `#A3A3A3` | `bg-status-closed` | `--status-closed` | Market closed, gray dot |
| `status.stale` | `#F59E0B` | `bg-status-stale` | `--status-stale` | Refresh slow, amber dot |
| `status.offline` | `#EF4444` | `bg-status-offline` | `--status-offline` | Network/AI offline, red dot |

### Background & border surfaces (from page-1 variable defs; code names inferred ⚠️)
| Token | Hex | CSS var | Usage |
|---|---|---|---|
| `bg.canvas` | `#FAFAFA` | `--bg-canvas` ⚠️ | App canvas / page background |
| `bg.surface` | `#FFFFFF` | `--bg-surface` ⚠️ | Card / panel surface |
| `bg.surface-raised` | `#FAFAFA` | `--bg-surface-raised` ⚠️ | Raised/nested surface |
| `bg.subtle` | `#F5F5F5` | `--bg-subtle` ⚠️ | Subtle fill (input, hover row) |
| `border.subtle` | `#E5E5E5` | `--border-subtle` ⚠️ | Hairline borders (neutral.200) |
| `border.default` | `#D4D4D4` | `--border-default` ⚠️ | Default/stronger borders (neutral.300) |

---

## 4. Color — in-context rules (hold across every screen)

1. **✅ DO — pair direction with a glyph.** Never rely on color alone for gain/loss. Use `▲ +0.43%` / `▼ -0.18%` / `— 0.00pp`. Passes a color-blindness check at a glance.
2. **✅ DO — use `teal.700` for accent *text*.** On white, only `teal.700+` passes AA. `teal.500` is for **fills with white text on top**, not for text itself. (e.g. a "View archive →" link is `teal.700`.)
3. **🚫 DON'T — reuse amber for status.** Amber belongs to **TODAY pills and AI-thinking only**. `status.stale` is the **single** place amber appears on a status dot.

---

## 5. Spacing — 4px base

> **4px base unit · 18 primitives · 16 semantic insets/gaps/stacks.** Components consume the **semantic** layer (inset / gap / stack) — never raw `space.*` primitives. The primitive scale defines the rhythm; the semantic layer says where to use it. The primitive scale maps 1:1 onto Tailwind's default spacing (also 4px-based), so `space.4` = Tailwind `p-4`/`gap-4` = 16px — **no custom spacing config needed.**

### Primitive scale (Tailwind step = px; never bound to components directly)

| Token | Tailwind | px | | Token | Tailwind | px |
|---|---|---|---|---|---|---|
| `space.0_5` | `0.5` | 2 | | `space.6` | `6` | 24 |
| `space.1` | `1` | 4 | | `space.8` | `8` | 32 |
| `space.1_5` | `1.5` | 6 | | `space.10` | `10` | 40 |
| `space.2` | `2` | 8 | | `space.12` | `12` | 48 |
| `space.3` | `3` | 12 | | `space.16` | `16` | 64 |
| `space.4` | `4` | 16 | | `space.20` | `20` | 80 |
| `space.5` | `5` | 20 | | `space.24` | `24` | 96 |

> 18 primitives total; the 14 above are the ones exposed on the Spacing page (plus the two half-steps `0_5`/`1_5` from variable defs). Intermediate steps (`7`, `14`, etc.) follow the same `×4px` rule if needed.

### Semantic spacing — what components actually consume

**Inset** — component padding (equal top/right/bottom/left):
| Token | px | aliases |
|---|---|---|
| `inset.xs` | 4 | `space.1` |
| `inset.sm` | 8 | `space.2` |
| `inset.md` | 16 | `space.4` |
| `inset.lg` | 20 | `space.5` |
| `inset.xl` | 24 | `space.6` |

**Gap** — spacing between siblings in a horizontal/vertical auto-layout (flex/grid `gap`):
| Token | px | aliases |
|---|---|---|
| `gap.xs` | 4 | `space.1` |
| `gap.sm` | 8 | `space.2` |
| `gap.md` | 12 | `space.3` |
| `gap.lg` | 16 | `space.4` |
| `gap.xl` | 24 | `space.6` |

**Stack** — vertical rhythm between section blocks:
| Token | px | aliases |
|---|---|---|
| `stack.sm` | 8 | `space.2` |
| `stack.md` | 12 | `space.3` |
| `stack.lg` | 16 | `space.4` |
| `stack.xl` | 24 | `space.6` |
| `stack.2xl` | 32 | `space.8` |

### Spacing rules

1. **✅ DO — use semantic, not primitive.** Reach for `inset.md` / `gap.lg` / `stack.xl`. The primitive scale is the library; semantics are the shelves.
2. **✅ DO — stick to the 4px rhythm.** Every value is a multiple of 4. Off-grid spacing breaks vertical rhythm and reads as accidental.
3. **🚫 DON'T — inline arbitrary values.** If a layout needs spacing the system lacks, add a token — don't hardcode `18 / 22 / 28 / 36`.

> **Radius** (observed on page 1, not yet a formal token page): `3px` · `4px` · **`6px` (dominant — cards/swatches)** · `10px`. Reconcile if a Radius/Elevation page is ingested.

### Density scale (global dial)

> **One token-level lever for "fit more on a standard screen"** (Nima's request). The root font-size in `app/globals.css` (`html { font-size: … }`) scales **every rem-based type and spacing utility proportionally** — Tailwind's spacing scale is rem-based, so `p-4` / `gap-6` / `text-xl` all scale together and every screen (incl. the section tabs) inherits it. Tune the single value rather than re-tightening per screen.
>
> | Value | Base | Effect |
> |---|---|---|
> | `100%` | 16px | stock |
> | **`93.75%`** | **15px** | **current — ~6% denser** |
> | `87.5%` | 14px | ~12% denser |
>
> ⚠️ Arbitrary-px utilities (`text-[11px]`, `w-[72px]`, chart height props) do **not** scale with this — they're literal px. They're mostly micro-labels + structural widths, so the dial still densifies the bulk (padding, gaps, headline type). If a stronger pass is wanted, prefer bumping this dial over hand-tightening components.

---

## 6. Elevation (shadows)

> **6 soft drop shadows · light theme · no glows.** _"A small, restrained shadow ramp. Light theme means drops, not glows. Most surfaces stay flat; shadows are functional, not decorative."_ The Tailwind class names match Tailwind's default shadow scale, but the exact values below are the tokens — match them in `@theme` if defaults drift.

| Token | Tailwind | CSS `box-shadow` | Used for |
|---|---|---|---|
| `shadow.xs` | `shadow-xs` | `0 1px 2px 0 rgb(0 0 0 / .04)` | Default tile resting state |
| `shadow.sm` | `shadow-sm` | `0 1px 3px 0 rgb(0 0 0 / .06), 0 1px 2px 0 rgb(0 0 0 / .04)` | Hovered tiles · AI brief card |
| `shadow.md` | `shadow-md` | `0 4px 6px 0 rgb(0 0 0 / .06), 0 2px 4px 0 rgb(0 0 0 / .04)` | Popovers · dropdowns |
| `shadow.lg` | `shadow-lg` | `0 10px 15px 0 rgb(0 0 0 / .08), 0 4px 6px 0 rgb(0 0 0 / .05)` | Floating specimens · toasts |
| `shadow.xl` | `shadow-xl` | `0 20px 25px 0 rgb(0 0 0 / .10), 0 10px 10px 0 rgb(0 0 0 / .05)` | Modals · drawers |
| `shadow.inner` | `shadow-inner` | `inset 0 1px 2px 0 rgb(0 0 0 / .04)` | Input wells (rare) |

**Rules:** ✅ **Pair shadow with hover** — tiles get `shadow.xs` at rest, `shadow.sm` on hover; that 1-step lift is the affordance. ✅ **Heavier shadow = higher z** — popovers `md`, modals `xl`; weight signals stacking depth. 🚫 **No glows in light theme** — soft drops only; saturated/colored shadows make a financial UI look like a game UI.

---

## 7. Radius

> **7 corner tokens · buttons 6 · tiles 8 · cards 10 · modals 14 · pills full.** _"Restrained corner ramp. Components map to a specific radius — don't pick at the screen level."_
>
> ⚠️ **These Tailwind names are remapped from Tailwind defaults** (the Figma's `rounded` = 6px, not Tailwind's default 4px). The build **must** override `--radius-*` in `@theme` (see appendix) — otherwise `rounded-md` etc. render at the wrong size.

| Token | Tailwind | px | Used for |
|---|---|---|---|
| `radius.none` | `rounded-none` | 0 | Tables · data grids |
| `radius.sm` | `rounded-sm` | 4 | Small inputs · checkboxes |
| `radius.default` | `rounded` | 6 | Buttons · badges · inputs |
| `radius.md` | `rounded-md` | 8 | KPI tiles · cards |
| `radius.lg` | `rounded-lg` | 10 | AI brief card · feature cards |
| `radius.xl` | `rounded-xl` | 14 | Modals · drawers |
| `radius.pill` | `rounded-full` | 9999 | Status pills · chips |

---

## 8. Components

> Components are token-bound: every color, type, and spacing value references a semantic or component token — never a raw value. The first component family ingested is the KPI tile (the dashboard's substrate).

### 8.1 KPI tiles — `<KPITile variant=… />`

> **5 components · the substrate of the dashboard.** _"Every tile is one component family with token-bound colors, type, and spacing. Pick the variant that matches the metric's data shape."_

| Variant | Component | Size | Use | Contains |
|---|---|---|---|---|
| **A** | `<KPITile variant="A" />` | 220×140 | Daily-traded — equities, crypto, indices | label · value · delta · **sparkline** · timestamp |
| **B** | `<KPITile variant="B" />` | 220×108 | Slow cadence — monthly FRED, quarterly GDP | label · value · delta · **source caption** |
| **C — Hero** | `<KPITile variant="C" chart={…} />` | 460×228 (**spans 2 grid cols**) | Featured composite — Yield Curve, Market Breadth | label · value · delta · **embedded chart/gauge** · timestamp |
| **Ribbon** | `<KPIRibbonTile />` | 120×76 | Sticky top-of-canvas **ticker strip** | label · value · delta (compact) |
| **Mobile Ritual** | `<MobileRitualTile />` | 160×96 | Phone ritual screen (`/ritual`) | label · value · delta · **large tap target** |

> Examples: `<KPITile variant="A" label="S&P 500" value="5,327.11" delta="+0.43%" />` · `<KPITile variant="B" label="CPI YoY" value="3.4%" />` · `<KPIRibbonTile label="VIX" value="13.88" delta="-0.04" />` · `<MobileRitualTile label="BTC" value="68,124" delta="+1.02%" />` · `<KPITile variant="C" label="Yield Curve" value="-0.42%" delta="+4bp" chart={curveData} />`

**Anatomy — 6 parts, each bound to a type role + token:**
| # | Part | Type role | Token / recipe |
|---|---|---|---|
| 1 | Label | `type/role/label` | `text-[11px] uppercase tracking-wider`, color `text.tertiary` (`#737373`) |
| 2 | Value | `type/role/value` | `text-xl font-semibold tabular-nums`, color `text.primary` (`#171717`) |
| 3 | Delta | `type/role/delta` + glyph | `text-[13px] font-medium tabular-nums`, `gain.text`/`loss.text` + ▲▼ |
| 4 | Sparkline | — | `chart.line.gain/loss/default`, 1px stroke, colored by period direction |
| 5 | As-of | `type/role/body-sm` | `text-xs text-text-tertiary` |
| 6 | Container | — | `kpi-tile` bg + border + shadow → `rounded-md p-4 shadow-xs` |

**KPI-tile component tokens:**
| Token | Value | Aliases |
|---|---|---|
| `kpi-tile/bg` | `#FFFFFF` | `bg.surface` |
| `kpi-tile/border` | `#E5E5E5` | `border.subtle` |
| `kpi-tile/label-color` | `#737373` | `text.tertiary` |
| `kpi-tile/value-color` | `#171717` | `text.primary` |
| `kpi-tile/padding` | `16` | `inset.md` / `p-4` |
| `kpi-tile/radius` | `8` | `radius.md` / `rounded-md` |
| container shadow | `shadow.xs` (rest) → `shadow.sm` (hover) | |

**Tile rules:** ✅ **Pair delta with glyph** — every delta gets ▲/▼/— ; color is supplementary, never the primary signal. ✅ **Always show as-of** — every tile carries a timestamp; data freshness is a heuristic-eval criterion, never hide it. 🚫 **Don't inline-style** — use the component; if a layout needs a new look, add a variant to the system rather than overriding fills/sizes on an instance.

> **New tokens surfaced on pages 4–6** (folded into the appendix): `accent.primary.border` `#14B8A6` (teal.500 — accent borders/focus rings); chart line colors `chart.line.gain` `#16A34A` (green.600), `chart.line.default` `#0D9488` (teal.600), `chart.line.loss` `#DC2626` (red.600 — confirmed page 9).

### 8.2 AI panel — `<BriefCard>` · `<ChatBubble>` · `<SuggestedChip>`

> **9 components · the right column of every dashboard.** _"The brief card is pinned at top; chat bubbles stream below; suggested chips regenerate after each assistant turn. The whole column is auto-layout vertical."_

**Brief card — 4 states** (`<BriefCard state=… />`), pinned top, renders the AM/PM synthesis paragraph:
| State | Behavior | Usage |
|---|---|---|
| `default` | Live brief published today. **TODAY pill** in amber. Paragraph in `brief-body` (Plex Sans 15). | `<BriefCard state="default" brief={data} />` |
| `generating` | Cron fired, paragraph not ready — **skeleton bars with shimmer**. | `<BriefCard state="generating" />` |
| `failed` | Cron error — previous brief shown with **retry indicator** beneath. | `<BriefCard state="failed" previous={prev} />` |
| `firstTime` | Owner just deployed, no brief yet — **instructional copy** until 7:30 ET. | `<BriefCard state="firstTime" />` |

> Brief tokens: `brief/padding` 24 (`inset.xl`), `brief/radius` 10 (`radius.lg`), `brief/bg` `#FFF`, `brief/badge-bg` `#FFFBEB` (accent.secondary.bg-subtle), `brief/badge-text` `#B45309` (accent.secondary.text). Heading = `type/role/brief-heading` (**serif**); body = `type/role/brief-body`.

**Chat surface** (`<ChatBubble role=… />` + `<SuggestedChip>`):
| Bubble | Align / style | Usage |
|---|---|---|
| `role="user"` | Right-aligned · teal-subtle bg `#F0FDFA` · text `#171717` | `<ChatBubble role="user">…</ChatBubble>` |
| `role="assistant"` | Left-aligned · gray bg `#F5F5F5` · **streams tokens** | `<ChatBubble role="assistant">…</ChatBubble>` |
| `state="thinking"` | Three **pulsing dots** while first token loads | `<ChatBubble role="assistant" state="thinking" />` |
| `state="error"` | Stream interrupted · `loss.bg` + inline retry link · text `#DC2626` | `<ChatBubble role="assistant" state="error" onRetry={fn} />` |
| `<SuggestedChip>` | 3 regenerate after each assistant turn; click → sends as next user message | `<SuggestedChip>{question}</SuggestedChip>` |

> Bubble tokens: `bubble/padding` 16 (`inset.md`), `bubble/radius` 8 (`radius.md`).

**AI-panel rules:** ✅ **Brief in serif, chat in sans** — Plex Serif only on the brief heading (the editorial cue); chat/chips are sans. ✅ **Always show as-of timestamp** — brief shows "As of 7:32 ET"; bubbles get a `YOU · 7:34` / `DESK · 7:34` micro-label. 🚫 **Don't auto-scroll mid-stream** — let the reader follow at their own pace; auto-scroll is a financial-reading anti-pattern.

> **Desk masthead controls — one bordered-chip family.** The AI desk's masthead actions (sunrise / expand / regenerate / close) are a **single visual family**: all bordered icon-chips, differentiated by **colour weight, not by style** (one filled/accent, the rest neutral) — never a mix of chip + bare-icon + filled-button. Hierarchy comes from colour, the shape is shared, so the cluster reads as one control group.

---

### 8.3 Chrome & navigation — `<StatusPill>` · `<SectionHeader>` · `<PageHeader>` · `<RailItem>`

> **8 components · appear on every screen.** _"Status pills carry data freshness, headers carry context, rail items carry navigation."_

**Status pills — 4 variants** (`<StatusPill state=… />`), always a **dot + uppercase label**:
| State | Dot / fill | Meaning |
|---|---|---|
| `live` | Green dot · `gain.bg` · `gain.text` | Active polling |
| `closed` | Neutral dot (`status.closed`) | Outside US market hours |
| `stale` | Amber dot (`status.stale`) | >5 min since refresh |
| `offline` | Red dot (`status.offline`) | Browser offline or AI unreachable |

> Pill tokens: `pill/px` 8, `pill/py` 2, `pill/radius` full (`rounded-full`). Label = `type/role/label`.

**Headers:**
- `<SectionHeader title="Markets Snapshot" />` — sits above each anchored canvas section; **hairline bottom border**; hide-toggle on the right.
- `<PageHeader backHref="/" action={<AddToWatchlist />} />` — on `/detail`, `/archive`, `/settings`; **← Dashboard back link** on the left, **action button** on the right.

**Left rail item — 2 states** (`<RailItem href=… [active]>`):
| State | Style | Usage |
|---|---|---|
| default | Text-secondary, hover `bg.subtle` | `<RailItem href="/macro">Macro / US</RailItem>` |
| active | Accent-subtle bg **+ 3px teal marker bar** on the left | `<RailItem href="/macro" active>Macro / US</RailItem>` |

> Rail-item tokens: `text` `#404040`, `text-active` `#171717`, `px` 16, `py` 10, `radius` 6, `marker` `#14B8A6` (teal.500), `bg-active` `#F0FDFA`.

**Chrome rules:** ✅ **Pair dot with label** — 6px dot + uppercase label, never the dot alone. ✅ **Active = bar + bg** — rail active has BOTH a 3px marker bar AND a subtle bg fill, not one or the other. 🚫 **Don't repurpose status** — status pills carry data freshness; general "tag"/"category" chips need their own component.

---

### 8.4 Lists & interactive — `<WatchlistRow>` · `<TopMoversRow>` · `<TimeRangeSelector>`

> **3 components.** _"Watchlist is polymorphic across asset types; movers is a fixed 10-row list; time-range is a segmented selector used on /detail pages."_

| Component | Anatomy | Notes |
|---|---|---|
| `<WatchlistRow>` | drag handle · type icon · **symbol (mono)** · label · value · delta · sparkline · remove | **Polymorphic** across equity / etf / crypto / commodity / macro. `<WatchlistRow type="equity" symbol="TSLA" value="182.45" delta="-2.10%" />` |
| `<TopMoversRow>` | rank · symbol · name · value · delta · sparkline | **Stocks-only**, 10 per category (mcap / gainers / losers). `<TopMoversRow rank={1} symbol="NVDA" name="NVIDIA Corp." value="928.14" delta="+4.21%" />` |
| `<TimeRangeSelector>` | 8 segments · 1D → MAX | Default **1Y for tradeables, 5Y for macro**. Active segment fills `accent-primary-bg-subtle` + `accent-primary-text`. Keyboard: `1-8` selects, `← →` cycles. `<TimeRangeSelector value="1Y" onChange={setRange} />` |

> ⚠️ **Time-range scope flag:** the Figma shows **8 segments incl. 1D**, but PROJECT-BRIEF locks drill-down to daily granularity → **1M / 6M / YTD / 1Y / 5Y / MAX (no 1D/5D)**. Reconcile which segments actually ship before building this control — likely 6, not 8. (Raised with Haroon.)

**List rules:** ✅ **Mono on symbols** — tickers use Plex Mono SemiBold, names use Plex Sans; don't mix inside one column. ✅ **Tabular figures on values** — every value column is `tabular-nums` so decimals align across rows. 🚫 **Don't truncate names quietly** — ellipsize AND show a hover tooltip with the full name; silent truncation is data loss.

---

### 8.5 Buttons — `<Button variant=… size=… />`

> **3 variants · 3 sizes · 5 states · icon-left / icon-right / loading.** _"One Primary variant for the screen's main job, Secondary for cancel/dismiss, Ghost for navigation and tertiary actions. Never more than one Primary per screen."_

**Variants:**
| Variant | Style | Use |
|---|---|---|
| `primary` | Filled accent (`accent-primary`) | The screen's main job. **Max one per surface.** `<Button variant="primary">Open the desk</Button>` |
| `secondary` | Outline only | Cancel · dismiss · alternate. `<Button variant="secondary">Cancel</Button>` |
| `ghost` | No bg until hover | Navigation links, tertiary actions. `<Button variant="ghost">View archive</Button>` |

**Sizes:**
| Size | Height | Text | Padding | Use |
|---|---|---|---|---|
| `sm` | 32 | 12px | 6 / 12 | Dense table rows |
| `md` (default) | 40 | 14px | 10 / 16 (`px-4 py-2.5`) | Standard |
| `lg` | 48 | 16px | 12 / 20 | Hero / CTA moments |

**States:**
| State | Spec |
|---|---|
| default | `bg = accent-primary` |
| hover | `bg = accent-primary-hover` (teal.600 `#0D9488`), **100ms transition** |
| focus | Outline 2px teal.500 + 2px offset → `focus-visible:ring-2 ring-focus-ring` |
| disabled | 50% opacity, `cursor-not-allowed`, no interaction → `disabled:opacity-50` |
| loading | **Three pulsing dots**, disabled while pending → `<Button loading>…</Button>` |

**Icons:** `iconLeft` precedes label (for "create" actions), `iconRight` follows (for "continue"); same rules across all variants. Icon = **12×12, 1.5 stroke, round caps, color matches label**.

**Anatomy:** label = `type/role/button` (`text-sm font-medium`); container = `btn-primary.bg + radius.default` → `rounded px-4 py-2.5`; padding = `space.4` horiz / `space.2_5` vert; focus ring = `focus.ring`, 2px outline + offset.

**Button rules:** ✅ **Max one Primary per screen** — if you need two main jobs, the screen does too much. ✅ **Verb in the label** — "Open the desk", "Add to watchlist", "Cancel" — never "OK"/"Submit"/"Click here". 🚫 **Don't use Primary for cancel** — cancel/dismiss are Secondary or Ghost; filling them teal makes them look like the intended action.

> Button tokens: `accent.primary.bg-hover` `#0D9488` (teal.600), `focus.ring` `#14B8A6` (teal.500), `radius.default` 6, `space.2_5` = 10px (`py-2.5`).

---

### 8.6 Inputs & form fields — `<Input type=… />` · `<Select>` · `<Textarea>`

> **6 input types · 4 states · optional left/right icons · helper/error text.** _"Always wrap in a Form Field (label + input + helper) for accessibility."_

**Types:** `text` (freeform short text, no icons) · `email` (envelope icon left, mobile email keyboard) · `password` (lock icon left, eye toggle right for show/hide) · `search` (search icon left; used in /settings to add watchlist items) · `select` (chevron right, dropdown; settings AI tone / refresh prefs) · `textarea` (multi-line; AI-panel ask input + longer settings notes, e.g. `<Textarea placeholder="Ask the desk…" rows={3} />`).

**States:**
| State | Spec |
|---|---|
| default | `bg.surface`, `border.default` → `border border-border-default` |
| focus | 2px focus ring → `focus:ring-2 ring-focus-ring` |
| error | Red border + alert icon right → `border-loss-border` + helper text below |
| disabled | 50% opacity, `bg.subtle`, not focusable → `disabled:opacity-50` |

**Form Field anatomy** (always wrap an `<Input>`): ① **Label** — `type/role/body` medium (`text-sm font-medium`), always present. ② **Input** — uses semantic bg/border tokens. ③ **Helper text** — `type/role/body-sm` tertiary (`text-xs text-text-tertiary`), optional. ④ **Error text** — `body-sm` in `loss.text`, *replaces* helper when `state=error`. ⑤ **Required** — red `loss-text` asterisk after the label (no inline "required" word).

**Input rules:** ✅ **Always label inputs** — visible `<Label>` or `aria-label`; a placeholder is not a label (it vanishes on focus). ✅ **Error has a reason** — don't just redden the border; pair with helper text saying what's wrong AND how to fix it. 🚫 **Don't disable as a "lock"** — disabled means "not applicable right now," not "wait for permission"; for a wait, show a loading state on the submit button.

---

### 8.7 Icons — Hugeicons (stroke-rounded)

> **41 icons · stroke-rounded 1.5 · sized 16 / 20 / 24.** _"One vocabulary across every screen — installed via the Hugeicons Figma plugin, cloned per use, and recolored to semantic text tokens."_
>
> ⚠️ **Dependency flag for Haroon:** the design standardizes on **Hugeicons** (`stroke-rounded` family), not lucide (shadcn's default). Implementation needs the `hugeicons-react` package (or exported SVGs). That's a new npm dependency not in the locked stack — get the OK before adding. **The whole icon set is one library; don't cherry-pick from another.**

**Sizes** (pick by neighboring text — roughly 1.1× the text size):
| Size | Stroke | Use |
|---|---|---|
| 16px | 1.25 | 12–13pt body · dense rows · in-field icons (mail in email field, view toggle, chevrons) |
| 20px | 1.4 | 14–16pt body · standard buttons · list rows |
| 24px | 1.5 | 18pt+ headers · page titles · empty states |

**Color** — bound to semantic **text** tokens; recolor strokes after cloning: `text.primary` (active/current page) · `text.secondary` (default/hover) · `text.tertiary` (disabled/helper/placeholder leading icons) · `accent.primary.text` (active accent) · `loss.text` (errors/validation) · `gain.text` (success/positive).

**The 41-icon vocabulary:**
`attachment` · `mail-01` · `notification-01` · `lock-password` · `add-01` · `search-01` · `cancel-01` · `view` · `view-off` · `user` · `grid-view` · `arrow-expand` · `delete-02` · `refresh-04` · `arrow-down-01` · `arrow-right-02` · `arrow-down-02` · `checkmark-badge-01` · `arrow-vertical` · `arrow-up-01` · `arrow-up-02` · `arrow-left-02` · `check-list` · `files-01` · `chart-03` · `chart` · `waterfall-down-01` · `chart-average` · `chart-bar-line` · `chart-bar-big` · `home-01` · `chart-candle` · `chart-candlestick` · `dollar-01` · `alert-02` · `setting-07` · `sliders-horizontal` · `chart-no-axes-combined` · `sliders-vertical` · `tick-01` · `checkmark-square-01`

**Icon rules:** ✅ **Size to neighbor text** (16/20/24 ≈ 1.1× the text). ✅ **Recolor to a semantic token** — cloned Hugeicons inherit near-black; repoint every stroke. 🚫 **Don't mix outline with solid** — stay in `stroke-rounded`. 🚫 **Don't decorate purely** — if an icon adds no information (category cue, action hint, state badge), drop it; text alone is fine.

---

## 9. Dark theme (semantic re-point)

> Dark mode is a **re-point of the semantic CSS variables** (token architecture §0) — components never change, they already consume semantic tokens. Toggle `data-theme="dark"` on `<html>` and the values below swap. **Extracted from the Figma dashboard-dark screen** (`node 569-2` — the canonical dark node as of 2026-06-02, superseding the retired `460-2`/`514-2`; the values below are the original derivation and are **pending re-derivation** from `569-2`), which only remapped the **core** bg/text/border set; tokens the designer left at their light values are **⚠ derived here** for dark-contrast (lighter accent/direction/chart colors) and should be confirmed when full dark screens exist. Default theme = **light** (Figma default). No-flash: a `theme` cookie is read in the root layout and written to `<html data-theme>` server-side; the toggle updates both cookie + attribute.

| Semantic token | Light | Dark | Source |
|---|---|---|---|
| `bg.canvas` | neutral-50 | **neutral-950** `#0a0a0a` | Figma |
| `bg.surface` | neutral-0 | **neutral-900** `#171717` | Figma |
| `bg.surface-raised` | neutral-50 | **`#1f1f1f`** | ⚠ derived |
| `bg.subtle` | neutral-100 | **neutral-800** `#262626` | Figma |
| `text.primary` | neutral-900 | **neutral-50** `#fafafa` | Figma |
| `text.secondary` | neutral-700 | **neutral-300** `#d4d4d4` | Figma |
| `text.tertiary` | neutral-500 | neutral-500 (same) | Figma |
| `text.disabled` | neutral-400 | **neutral-600** `#525252` | ⚠ derived |
| `text.inverse` | neutral-0 | **neutral-950** `#0a0a0a` | Figma |
| `border.subtle` | neutral-200 | **neutral-800** `#262626` | Figma |
| `border.default` | neutral-300 | **neutral-700** `#404040` | Figma |
| `border.strong` | neutral-500 | **neutral-600** `#525252` | Figma (new token — add to light too) |
| `accent.primary.bg` | teal-500 | teal-500 (same) | Figma |
| `accent.primary.text` | teal-700 | **teal-400** `#2dd4bf` | ⚠ derived (contrast) |
| `accent.primary.bg-subtle` | teal-50 | **teal-950** `#042f2e` | ⚠ derived |
| `accent.primary.bg-hover` | teal-600 | **teal-400** | ⚠ derived |
| `accent.secondary.text` | amber-700 | **amber-400** `#fbbf24` | ⚠ derived |
| `gain.text` | green-700 | **green-500** `#22c55e` | ⚠ derived |
| `gain.bg` | green-50 | **`#0c2a1a`** | ⚠ derived |
| `loss.text` | red-600 | **red-500** `#ef4444` | ⚠ derived |
| `loss.bg` | red-50 | **`#2a1414`** | ⚠ derived |
| `chart.line.{gain,loss,default}` | 600 | **green-500 / red-500 / teal-400** | ⚠ derived |
| `warning` | amber-600 | **amber-400** | ⚠ derived |
| `focus-ring`, `*.border`, `status.*` | — | unchanged | — |

The implementation is the `[data-theme="dark"]` block in Appendix A / `app/globals.css`.

---

## Appendix A — Code translation (drop-in reference — implement during the build phase)

> This is the canonical translation of the tokens above for **Tailwind CSS 4 + `app/globals.css`**. Tailwind 4 defines theme in CSS via `@theme`, not `tailwind.config.ts`. Primitives live as plain custom properties; semantic tokens alias them; `@theme inline` exposes the **semantic** layer to utilities so a rebrand/dark-mode = repoint the `--*` aliases only. **Do not paste this into the repo yet** — it lands when we build the shell (Phase 3). Kept here so it's written once and stays in sync with the tables above.

```css
/* app/globals.css */
@import "tailwindcss";

:root {
  /* ── PRIMITIVES (raw — never used by components directly) ── */
  --neutral-0:#fff;   --neutral-50:#fafafa; --neutral-100:#f5f5f5; --neutral-200:#e5e5e5;
  --neutral-300:#d4d4d4; --neutral-400:#a3a3a3; --neutral-500:#737373; --neutral-600:#525252;
  --neutral-700:#404040; --neutral-800:#262626; --neutral-900:#171717; --neutral-950:#0a0a0a;

  --teal-50:#f0fdfa; --teal-100:#ccfbf1; --teal-200:#99f6e4; --teal-300:#5eead4;
  --teal-400:#2dd4bf; --teal-500:#14b8a6; --teal-600:#0d9488; --teal-700:#0f766e;
  --teal-800:#115e59; --teal-900:#134e4a; --teal-950:#042f2e;

  --amber-50:#fffbeb; --amber-100:#fef3c7; --amber-200:#fde68a; --amber-300:#fcd34d;
  --amber-400:#fbbf24; --amber-500:#f59e0b; --amber-600:#d97706; --amber-700:#b45309;
  --amber-800:#92400e; --amber-900:#78350f;

  --green-50:#f0fdf4; --green-100:#dcfce7; --green-200:#bbf7d0; --green-300:#86efac;
  --green-400:#4ade80; --green-500:#22c55e; --green-600:#16a34a; --green-700:#15803d;

  --red-50:#fef2f2; --red-100:#fee2e2; --red-200:#fecaca; --red-300:#fca5a5;
  --red-400:#f87171; --red-500:#ef4444; --red-600:#dc2626; --red-700:#b91c1c;

  /* ── SEMANTIC (alias primitives — the only layer components touch) ── */
  --text-primary:var(--neutral-900);   --text-secondary:var(--neutral-700);
  --text-tertiary:var(--neutral-500);  --text-disabled:var(--neutral-400);
  --text-inverse:var(--neutral-0);

  --accent-primary-bg:var(--teal-500);        --accent-primary-text:var(--teal-700);
  --accent-primary-bg-subtle:var(--teal-50);  --accent-primary-bg-hover:var(--teal-600);
  --focus-ring:var(--teal-500);
  --accent-secondary-bg:var(--amber-500);     --accent-secondary-text:var(--amber-700);
  --accent-secondary-bg-subtle:var(--amber-50);

  --gain-text:var(--green-700);  --gain-bg:var(--green-50);  --gain-border:var(--green-500);
  --loss-text:var(--red-600);    --loss-bg:var(--red-50);    --loss-border:var(--red-500);

  --status-live:var(--green-500);   --status-closed:var(--neutral-400);
  --status-stale:var(--amber-500);  --status-offline:var(--red-500);

  --bg-canvas:var(--neutral-50);  --bg-surface:var(--neutral-0);
  --bg-surface-raised:var(--neutral-50);  --bg-subtle:var(--neutral-100);
  --border-subtle:var(--neutral-200);  --border-default:var(--neutral-300);
  --accent-primary-border:var(--teal-500);

  /* chart line colors (sparklines / series) */
  --chart-line-gain:var(--green-600);  --chart-line-loss:var(--red-600);
  --chart-line-default:var(--teal-600);

  --warning:var(--amber-600);  /* #d97706 — warning text/icon */
}

@theme inline {
  /* expose SEMANTIC tokens to utilities: bg-accent-primary, text-gain, etc. */
  --color-text-primary:var(--text-primary);
  --color-text-secondary:var(--text-secondary);
  --color-text-tertiary:var(--text-tertiary);
  --color-text-disabled:var(--text-disabled);
  --color-text-inverse:var(--text-inverse);
  --color-accent-primary:var(--accent-primary-bg);
  --color-accent-primary-text:var(--accent-primary-text);
  --color-accent-secondary:var(--accent-secondary-bg);
  --color-gain:var(--gain-text);
  --color-loss:var(--loss-text);
  --color-status-live:var(--status-live);
  --color-status-closed:var(--status-closed);
  --color-status-stale:var(--status-stale);
  --color-status-offline:var(--status-offline);
  --color-bg-canvas:var(--bg-canvas);
  --color-bg-surface:var(--bg-surface);
  --color-border-subtle:var(--border-subtle);

  --color-chart-line-gain:var(--chart-line-gain);
  --color-chart-line-loss:var(--chart-line-loss);
  --color-chart-line-default:var(--chart-line-default);
  --color-accent-primary-border:var(--accent-primary-border);
  --color-accent-primary-hover:var(--accent-primary-bg-hover);
  --color-focus-ring:var(--focus-ring);
  --color-border-default:var(--border-default);

  /* RADIUS — must override Tailwind defaults (Figma scale is shifted up) */
  --radius-sm:4px;   /* rounded-sm  · small inputs, checkboxes */
  --radius:6px;      /* rounded     · buttons, badges, inputs  */
  --radius-md:8px;   /* rounded-md  · KPI tiles, cards         */
  --radius-lg:10px;  /* rounded-lg  · AI brief, feature cards  */
  --radius-xl:14px;  /* rounded-xl  · modals, drawers          */

  /* ELEVATION (matches Tailwind defaults closely; pin if they drift) */
  --shadow-xs:0 1px 2px 0 rgb(0 0 0 / .04);
  --shadow-sm:0 1px 3px 0 rgb(0 0 0 / .06), 0 1px 2px 0 rgb(0 0 0 / .04);
  --shadow-md:0 4px 6px 0 rgb(0 0 0 / .06), 0 2px 4px 0 rgb(0 0 0 / .04);
  --shadow-lg:0 10px 15px 0 rgb(0 0 0 / .08), 0 4px 6px 0 rgb(0 0 0 / .05);
  --shadow-xl:0 20px 25px 0 rgb(0 0 0 / .10), 0 10px 10px 0 rgb(0 0 0 / .05);

  /* fonts — self-hosted via next/font/local (IBM Plex, OFL) */
  --font-sans:"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono:"IBM Plex Mono", ui-monospace, monospace;
  --font-serif:"IBM Plex Serif", ui-serif, serif;
}
```

> **Type roles** (§1) and **semantic spacing** (inset/gap/stack, §5) are best implemented as small utility/component classes or a `cva` recipe rather than raw `@theme` color slots — spacing primitives already map onto Tailwind's default scale, and the type roles compose existing Tailwind utilities (see each role's "Tailwind recipe" column).

> ⚠️ markers in the tables above flag token code-names **inferred** from the Figma's naming pattern (the Figma only printed explicit Tailwind/CSS-var names for the text/accent/direction/status swatches). Reconcile inferred names if a later DS page prints them.

---

## Appendix B — Open flags for Haroon (raised during ingestion)

These came up while reading the design system against `CLAUDE.md` / `PROJECT-BRIEF.md`. None block documentation; all need a call before/at build time:

1. **Hugeicons dependency** (§8.7) — design standardizes on Hugeicons `stroke-rounded`, not lucide. Needs `hugeicons-react` (or exported SVGs) — a new npm dependency outside the locked stack. Get the OK.
2. **Fonts: self-host vs `next/font/google`** (§1) — Figma says self-host IBM Plex via `next/font/local`; CLAUDE.md says `next/font/google`. Both work; recommend honoring the Figma (self-host avoids the Google dependency + a layout-shift class).
3. **Time-range segments** (§8.4) — Figma shows 8 segments incl. 1D, but PROJECT-BRIEF locks daily-only data → `1M / 6M / YTD / 1Y / 5Y / MAX` (likely 6, no 1D/5D). Confirm which ship.
4. **Radius needs custom `@theme`** (§7) — the Figma's `rounded-*` names are shifted up from Tailwind defaults (`rounded` = 6px). The override block in Appendix A is mandatory or corners render wrong.
5. **Inferred token code-names** (⚠️ in §3) — bg/border code-names were inferred from the naming pattern; reconcile if a later/edited DS page prints them explicitly.

---

_Status: **all 12 design-system pages ingested** (`99-2`, `106-2`, `107-2`, `107-233`, `107-311`, `109-2`, `110-2`, `111-2`, `111-140`, `123-2`, `129-23`, `176-41`). This doc is the token + component source of truth; screen-level compositions belong in `docs/SCREENS.md` (created in Phase 3). Re-fetch a node via Figma MCP and update the matching section if the design changes._
