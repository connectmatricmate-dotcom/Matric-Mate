# MatricMate — app (Android + web)

One Expo/React Native codebase that ships as the **native Android app** and the **responsive web
app**. This is the milestone‑1 build: every screen is real, navigable and interactive, running on a
**mock data layer** instead of a backend.

## Run it

```bash
npm install
npm run web        # opens the web app at http://localhost:8081
npm start          # dev server; press 'a' for Android, or scan the QR with Expo Go
npm run lint       # TypeScript check (tsc --noEmit)
npm run export:web # production web bundle → dist/
```

To view the production web build locally: `cd dist && python3 -m http.server 8099`.

## What's real vs mocked

| Real | Mocked (M2+) |
| :---- | :---- |
| Every screen, navigation, layouts (phone + web sidebar) | No server — data comes from `src/core/content.ts` |
| Onboarding, sign‑up/sign‑in validation, session persistence | Auth is local (any email + 6‑char password) |
| MCQ engine, Pakka‑meter confidence, XP, streaks | AI tutor returns canned step‑by‑step answers |
| Progress, weak topics, confidence‑vs‑accuracy analytics | Safepay payment is simulated (no charge) |
| Timed exams, flashcards, blanks, short questions | Audio player transport is simulated |
| Offline downloads list, quotas, premium gating | Push notifications not wired |

State persists to AsyncStorage (localStorage on web), so progress survives reloads. Settings →
**Reset demo data** clears it.

## Architecture

```
app/                      Expo Router routes (file = screen)
  index.tsx               splash + auth gate
  welcome, login, signup, forgot, paywall, pay
  onboarding/             class → board → medium → subjects
  (tabs)/                 Home · Study · Practice · AI Tutor · Progress
  learn/                  subject → chapter → reader / audio / downloads
  session/                setup, mcq, exam, flashcards, blanks, shortq, papers, result, review
  tutor/                  chat, ai-test
  insights/               performance, weak, report
  account/                profile, edit, subscription, payments, settings, help
src/
  theme.ts                design tokens (from the client's logo — see docs/assets/brand/BRAND.md)
  components/ui.tsx       shared UI kit; every screen composes these
  components/Icon.tsx     icon set (react-native-svg)
  core/content.ts         MOCK FBISE Class 9 content
  core/api.ts             MOCK API — the single seam to replace with Supabase
  core/domain.ts          XP, streaks, progress, weak topics, quotas (pure functions)
  store/app.tsx           app state + persistence
  store/session.ts        the active practice/exam session
```

**The Supabase swap (M2) touches one file:** `src/core/api.ts`. Each function becomes a query or an
Edge Function call; screens don't change. `core/domain.ts` is pure so the same rules can later run
server‑side.

## Design source of truth

`docs/DESIGN-SPEC.md` (screen inventory, states, open decisions D1–D10) and the click‑through
prototype at `prototype/index.html`. Brand tokens and assets: `docs/assets/brand/`.

## See it on your phone, build it, ship it

See **[RELEASE.md](./RELEASE.md)** for the full playbook. Short version:

```bash
npm start                                                   # Expo Go on your phone, live reload
EAS_NO_VCS=1 npx eas-cli update --branch preview -m "..."   # push JS changes to installed apps (no rebuild)
EAS_NO_VCS=1 npx eas-cli build -p android --profile preview # new installable APK
```

Expo project: `@matricmate/matricmate`. The `preview` APK listens on the `preview` update channel,
so content and UI changes reach the client without reinstalling.

## Known gaps in this build

- Dark mode toggle is present but the dark palette ships with M5 polish.
- Urdu‑medium chapter text shows a placeholder note; real Urdu content comes from the client.
- Chapters 7+ are marked Premium purely to demonstrate locking.
- Content beyond Physics 1–4, Chemistry 2 and Biology 4 is generated from chapter/topic names.
