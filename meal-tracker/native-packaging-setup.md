# Native Packaging Setup

EatLog uses Capacitor to package the existing Vite application for iOS and Android.

## App identity

- App name: `EatLog`
- App ID / bundle ID: `com.albinaushakova.eatlog`
- Web output directory: `dist`

The app ID is permanent once an app is published. Confirm it before creating production records in App Store Connect and Google Play Console.

## Prerequisites

- A supported Node.js version for the installed Capacitor release
- npm
- Android Studio and Android SDK for Android
- macOS and Xcode for iOS

## First local setup

The native folders are generated locally because they contain tool-generated Xcode and Gradle projects.

```bash
cd meal-tracker
npm install
npm run build
npm run cap:add:android
npm run cap:add:ios
```

After `npm install`, commit the updated `package-lock.json` before merging this setup PR.

## Normal development workflow

After changing the web app:

```bash
npm run cap:sync
```

Open a platform project:

```bash
npm run cap:open:android
npm run cap:open:ios
```

Or build, sync, and open in one command:

```bash
npm run native:android
npm run native:ios
```

## Native behavior

- The app loads the bundled `dist` build and does not depend on the production website to launch.
- The PWA service worker is registered only in a browser, not inside the native Capacitor WebView.
- `viewport-fit=cover` is enabled so existing CSS safe-area variables work on modern iPhones.
- Public support and privacy pages remain hosted at:
  - `https://eatlog-tracker.vercel.app/support`
  - `https://eatlog-tracker.vercel.app/privacy`

## Before store submission

1. Generate and inspect `android/` and `ios/` locally.
2. Run the app on at least one physical Android device and one physical iPhone.
3. Verify localStorage survives app restarts and upgrades.
4. Verify CSV export, clipboard access, external links, and the ChatGPT handoff.
5. Replace generated launcher assets with the final store icon set.
6. Configure signing in Android Studio and Xcode.
7. Run `release-qa-checklist.md` for both platforms.
