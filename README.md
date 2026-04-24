# FastLog

Intermittent fasting + hydration tracker. Expo SDK 55, React Native, TypeScript strict, Supabase backend.

See [`CLAUDE.md`](./CLAUDE.md) for project architecture, design system, and conventions.

---

## Quick start

```bash
npm install
npm run ios       # dev build on simulator or connected iPhone
npm run android   # dev build on connected Android device
```

Copy `.env.example` → `.env` and fill in the Supabase / RevenueCat / PostHog keys before first run.

---

## Bundle identifiers

| Platform | ID |
|---|---|
| iOS app | `com.fastlog.app` |
| iOS widget extension | `com.fastlog.app.widgets` |
| iOS App Group | `group.com.fastlog.app` |
| **Android package** | **`com.vectolis.fastlog`** |

The Android package **must** be `com.vectolis.fastlog` — that's what the Play Store listing was registered with. Play will reject any upload whose package doesn't match. Source of truth is `app.config.ts`.

---

## Android local build

### 1. Prerequisites (one-time)

- **JDK 17** (JDK 21 breaks the Android Gradle Plugin — don't use it):
  ```bash
  brew install openjdk@17
  echo 'export JAVA_HOME=/opt/homebrew/opt/openjdk@17' >> ~/.zshrc
  echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.zshrc
  source ~/.zshrc
  java -version   # expect 17.x
  ```
- **Android SDK** at `~/Library/Android/sdk` (install via Android Studio).
  ```bash
  export ANDROID_HOME=~/Library/Android/sdk
  ```
- **Upload keystore** at `~/keystores/fastlog/upload.jks` (never commit; must be the same keystore used for the first Play Store upload — Play rejects builds signed with a different key).

### 2. `credentials.json`

At the repo root (gitignored):

```json
{
  "android": {
    "keystore": {
      "keystorePath": "/Users/<you>/keystores/fastlog/upload.jks",
      "keystorePassword": "...",
      "keyAlias": "...",
      "keyPassword": "..."
    }
  }
}
```

The `plugins/withEasBuildGradle` config plugin reads this file during `expo prebuild` and writes `android/app/eas-build.gradle` with the signing config — so the same file works for both local gradle builds and EAS cloud builds.

### 3. Build

```bash
npm run android:aab     # Play Store bundle → android/app/build/outputs/bundle/release/app-release.aab
npm run android:apk     # testable install  → android/app/build/outputs/apk/release/app-release.apk
```

Both scripts run `expo prebuild --platform android --clean` first, so `android/` is always regenerated from `app.config.ts` — don't edit `android/` by hand, it gets overwritten.

### 4. Upload to Play Console

1. Google Play Console → your FastLog app → **Internal testing** (or whichever track).
2. **Create new release** → upload `app-release.aab`.
3. Play will check the package name (`com.vectolis.fastlog`), signing key, and version code. If it complains about the key, you signed with the wrong keystore — the one at `~/keystores/fastlog/upload.jks` must match the first ever upload.

### 5. Install APK on a device for smoke-testing

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## iOS local build

```bash
npx expo run:ios --device   # signed dev build on connected iPhone
```

For App Store builds, use EAS:
```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production --latest
```

`eas.json` has the production profile wired up; Apple Team ID / App Store Connect IDs still need filling in under `submit.production.ios`.

---

## Supabase

- Dashboard: https://supabase.com/dashboard/project/yimxfuxwgtkkbglveglp
- Migrations live in `supabase/migrations/`. Apply via the SQL editor or `supabase migration up`.
- Edge Functions live in `supabase/functions/`. Deploy with `supabase functions deploy <name> --no-verify-jwt`.
- Function secrets (`WEBHOOK_SECRET`, `EXPO_ACCESS_TOKEN`, etc.): Dashboard → Edge Functions → Secrets.
- Vault secrets (`edge_url`, `webhook_secret`) live in `vault.secrets` — seeded by migration 006. Rotate with `update vault.secrets set secret = '...' where name = ...`.

See `CLAUDE.md` for the full multi-device sync architecture (Realtime + scheduled_pushes + pg_cron).

---

## Scripts reference

| Command | What it does |
|---|---|
| `npm start` | Expo dev server |
| `npm run ios` / `npm run android` | Dev build on device |
| `npm run android:prebuild` | Regenerate `android/` from `app.config.ts` |
| `npm run android:apk` | Signed release APK |
| `npm run android:aab` | Signed release AAB |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint on `.ts/.tsx` |
| `npm run brand:assets` | Regenerate icon / splash from brand source |

---

## Troubleshooting Android builds

**"Your APK or Android App Bundle needs to have the package name com.vectolis.fastlog"**
Check `app.config.ts:31` — Android `package` must be `com.vectolis.fastlog`. After fixing, run `npm run android:aab` again (it prebuilds clean, so no manual `android/` cleanup needed).

**"app-release.aab signed with wrong key"**
Play Store has a signing-key fingerprint on file from your first upload. You must sign every subsequent upload with the same keystore. Verify `~/keystores/fastlog/upload.jks` is that keystore. Do NOT generate a new one.

**Gradle fails with `Unsupported class file major version`**
You're on JDK 21 (or later). Switch to JDK 17 via the env vars above.

**`expo prebuild` wipes my custom edits to `android/`**
That's by design — `android/` is a generated folder. Put permanent changes in a config plugin under `plugins/` (see `plugins/withEasBuildGradle/` for a pattern).

**Build succeeds but app crashes on launch with native module error**
After any native dependency change (e.g. adding `expo-task-manager`, removing it, etc.) you need a fresh prebuild + install. `npm run android:apk` handles the prebuild; then reinstall via `adb install -r ...`.
