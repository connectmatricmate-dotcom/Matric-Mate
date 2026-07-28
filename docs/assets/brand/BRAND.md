# MatricMate — Brand Assets & Palette

Name confirmed by client (19 Jul 2026): **MatricMate** (one word, capital M twice in-app copy;
the logo wordmark renders "Matricmate" — fine in the mark, but written text uses **MatricMate**).
Logo is client-supplied AI-generated art (`logo-original.jpg`, 1408×768) — treated as the brand
source; all assets below are cut/derived from it. A vector redraw is a later nice-to-have,
not an MVP task.

## Palette (sampled from the logo)

| Token | Hex | Use |
| :---- | :---- | :---- |
| `teal` (primary) | `#096A8B` | Primary actions, active tab, links, progress |
| `ink` | `#0F5064` | Headings, outlines, dark surfaces |
| `orange` (accent) | `#F29329` | CTAs, highlights, XP/streaks, "mate" |
| `paper` | `#FAFBF7` | App background (light), splash/icon bg |
| `gray` | `#7E7E7E` | Secondary text |

Dark mode: derive surfaces from `ink` (e.g. #0A3745 range), keep `orange` as accent.

## Typography

- Latin: rounded sans matching the logo's letterforms — **Baloo 2** (headings) + **Nunito** (body), Google Fonts.
- Urdu: **Noto Nastaliq Urdu** (test rendering on a real Android device early).

## Assets

| File | Purpose |
| :---- | :---- |
| `logo-original.jpg` | Client-supplied source (keep pristine) |
| `monogram.png` | MM mark with students, transparent, trimmed (390×~290) |
| `wordmark.png` | "Matricmate" + cap/bulb, transparent |
| `lockup.png` | Wordmark + tagline "YOUR 9th & 10th STUDY MATE" (landing/marketing only — tagline is unreadable at small sizes) |
| `icon-1024.png` | App icon (monogram on `paper`) — Play Store + iOS-ready square |
| `adaptive-foreground.png` | Android adaptive icon foreground (transparent; pair with `paper` `#FAFBF7` background color in app config) |
| `splash-icon.png` | Splash composition (monogram over wordmark, transparent 1024²; splash bg = `paper`) |
| `favicon-512.png`, `favicon-192.png` | Web/PWA favicons |
| `notification-icon-96.png` | Android notification silhouette (white, transparent bg) |

## Usage rules

- App icon & favicons: **monogram only** — never the full lockup (tagline/detail dies at small sizes).
- In-app header: `wordmark.png` or text "MatricMate" in Baloo 2 (`teal` "Matric" + `orange` "mate" mirrors the logo).
- Tagline only on the landing page and store listing.
- Backgrounds behind the monogram: `paper` or white; avoid mid-teal (outline contrast drops).
