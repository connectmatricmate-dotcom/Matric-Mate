# MatricMate — dev, update and release playbook

Expo project: `@matricmate/matricmate` (owner account `matricmate`, project id in `app.json` →
`extra.eas.projectId`). Android package: `pk.matricmate.app`.

Three ways to see the app, in increasing permanence:

| Need | Use | Rebuild needed? |
| :---- | :---- | :---- |
| I'm editing code and want it live on my phone right now | **Expo Go + dev server** | no |
| Client should get the latest JS without reinstalling | **EAS Update (OTA)** | no |
| Native change, new dependency, or Play Store release | **EAS Build** | yes |

---

## 1. Live on your phone while developing (no APK)

Phone and computer must be on the same Wi-Fi.

```bash
cd apps/mobile
npm start                 # or: npx expo start --lan
```

On the phone: install **Expo Go** from the Play Store, open it, and either scan the QR shown in the
terminal or tap *Enter URL manually* and type the `exp://<your-ip>:8081` address the terminal prints.
Save the file, the phone reloads. Shake the phone for the dev menu.

If the phone can't reach the computer (guest Wi-Fi, AP isolation), use a tunnel instead:

```bash
npx expo start --tunnel   # routes via ngrok; works across networks
```

Expo Go is enough for this project because we use no custom native modules. If that changes, build a
**development build** once (`eas build -p android --profile development`) and use it in place of
Expo Go — same live-reload workflow.

## 2. Push changes to the client's installed app (OTA)

The APK from the `preview` profile listens on the **preview** channel. Any JavaScript, style,
content or asset change can be delivered without a new APK:

```bash
cd apps/mobile
EAS_NO_VCS=1 npx eas-cli update --branch preview --message "Fix chapter list spacing"
```

The client's app picks it up on next launch (Expo checks for updates on startup). Verify what's live:

```bash
npx eas-cli update:list --branch preview
```

**What OTA cannot do:** add or upgrade native dependencies, change app icon/splash/permissions, or
change `app.json` native config. Those need a new build. Updates only reach builds whose
`runtimeVersion` matches — our policy is `appVersion`, so bumping `version` in `app.json` cuts off
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
**Back it up before the first Play Store release** — losing it means you can never update that
listing again:

```bash
npx eas-cli credentials -p android      # → download keystore, store somewhere safe
```

## 4. Play Store path (when M5 approaches)

1. **Create the Play Console account** ($25 one-time) and complete identity verification — this can
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
   teenagers — expect the *Families* policy questions).

## 5. Connect the GitHub repo to Expo (optional, enables cloud-triggered builds)

Repo: `https://github.com/connectmatricmate-dotcom/Matric-Mate`

This is a web-UI flow — it can't be done from the CLI: expo.dev → project **matricmate** →
*GitHub* → **Connect** → install the Expo GitHub App on the `connectmatricmate-dotcom` account and
pick the `Matric-Mate` repo → set base directory to `apps/mobile`.

Once connected, builds can be triggered from a branch or commit instead of uploading the working
directory, and EAS Workflows can build on push.

## Current state

- `preview` build (APK, OTA-enabled, channel `preview`) — first build in progress.
- `production` profile ready but not yet built; no Play Console account yet.
- Version `0.1.0`, versionCode managed remotely by EAS (initialised at 1).
