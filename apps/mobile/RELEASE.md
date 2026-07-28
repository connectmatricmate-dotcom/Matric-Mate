# MatricMate, dev, update and release playbook

Expo project: `@matricmate/matricmate` (owner account `matricmate`, project id in `app.json` →
`extra.eas.projectId`). Android package: `pk.matricmate.app`.

## Two apps, two audiences

Both install side by side on the same phone, different package names, so they never clash.

| | **MatricMate Dev** (us) | **MatricMate** (client) |
| :---- | :---- | :---- |
| Build profile | `development` | `preview` |
| Package | `pk.matricmate.app.dev` | `pk.matricmate.app` |
| Purpose | live reload while coding | a stable app to review |
| Gets changes | instantly from the dev server | when we publish an OTA update |
| Rebuild needed | only for native changes | only for native changes |

Why not Expo Go: the Play Store's Expo Go is still on SDK 54 while this project is on SDK 57 (Expo
was awaiting store approval at the SDK 57 release), so Expo Go refuses to open the project. The
development build is our own client, matched to our SDK, immune to that permanently.

---

## 1. Live coding on your phone (development build)

Install **MatricMate Dev** once from the `development` build link. After that:

```bash
cd apps/mobile
npx expo start --dev-client        # phone and computer on the same Wi-Fi
```

Open MatricMate Dev, tap the dev-server entry (or scan the QR). Save a file → the phone reloads in
about a second. Shake the phone for the dev menu (reload, element inspector, performance monitor).

If the phone can't reach the computer (guest Wi-Fi, AP isolation):

```bash
npx expo start --dev-client --tunnel
```

Rebuild MatricMate Dev only when native config changes, a new native dependency, icon, splash,
permission or app.json native field. Pure JS/TS, styling and content changes never need a rebuild.

## 2. Ship a batch of changes to the client (OTA)

The client's APK (`preview` profile) listens on the **preview** channel. Work accumulates locally;
when a chunk is worth showing, publish it in one go, the client reopens the app and it's there.

```bash
cd apps/mobile
EAS_NO_VCS=1 npx eas-cli update --branch preview \
  --message "Study module: chapter reader, audio player, offline downloads"
```

Then message the client what's new. Their app fetches the update on next launch (Expo checks on
startup; if the download isn't finished in time it applies on the launch after).

Check what's live, and to whom:

```bash
npx eas-cli update:list --branch preview     # published updates
npx eas-cli channel:view preview             # which branch the channel points at
```

Good practice: publish one update per milestone or per demo, with a message that reads like a
changelog entry, those messages are the only record the client sees.

**What OTA cannot do:** add or upgrade native dependencies, change app icon/splash/permissions, or
change `app.json` native config. Those need a new build. Updates only reach builds whose
`runtimeVersion` matches, our policy is `appVersion`, so bumping `version` in `app.json` cuts off
older installs deliberately.

Rollback:

```bash
npx eas-cli update:rollback --branch preview
```

## 3. Build

```bash
# installable APK for the client / internal testers
EAS_NO_VCS=1 npx eas-cli build -p android --profile preview

# Play Store bundle (.aab), version code auto-increments
EAS_NO_VCS=1 npx eas-cli build -p android --profile production
```

`EAS_NO_VCS=1` is only needed while building from a directory EAS can't read as a git checkout;
once the GitHub repo is connected to the Expo project (see below) builds can run from a git ref.

Credentials: the Android keystore is generated and stored by Expo (`Build Credentials ZC_p-FE1JT`).
**Back it up before the first Play Store release**, losing it means you can never update that
listing again:

```bash
npx eas-cli credentials -p android      # → download keystore, store somewhere safe
```

## 4. Play Store path (when M5 approaches)

1. **Create the Play Console account** ($25 one-time) and complete identity verification, this can
   take several days, so start early.
2. ⚠️ **New personal Play accounts must run a closed test with 12+ testers for 14 days** before
   production access is granted. Plan this ~3 weeks before the launch date. Testers can be recruited
   from the client's circle; invite them from Play Console → Testing → Closed testing.
3. Build the bundle: `eas build -p android --profile production`.
4. First upload must be done by hand in Play Console (creates the listing). After that, automate:
   - Play Console → Setup → API access → create a **service account** with *Release manager* role,
     download its JSON key.
   - Save it outside the repo, point `eas.json` → `submit.production.android.serviceAccountKeyPath`
     at it, then `eas submit -p android --profile production`, or build with `--auto-submit`.
5. Store listing needs: app name, short + full description, 512×512 icon, feature graphic
   1024×500, at least 2 phone screenshots, privacy policy URL (lives on the landing page), content
   rating questionnaire, data safety form, and a target audience declaration (this app targets
   teenagers, expect the *Families* policy questions).

## 5. Connect the GitHub repo to Expo (optional, enables cloud-triggered builds)

Repo: `https://github.com/connectmatricmate-dotcom/Matric-Mate`

This is a web-UI flow, it can't be done from the CLI: expo.dev → project **matricmate** →
*GitHub* → **Connect** → install the Expo GitHub App on the `connectmatricmate-dotcom` account and
pick the `Matric-Mate` repo → set base directory to `apps/mobile`.

Once connected, builds can be triggered from a branch or commit instead of uploading the working
directory, and EAS Workflows can build on push.

## Current state

- `preview` build (APK, OTA-enabled, channel `preview`), first build in progress.
- `production` profile ready but not yet built; no Play Console account yet.
- Version `0.1.0`, versionCode managed remotely by EAS (initialised at 1).
