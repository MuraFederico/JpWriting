# JpWriting

Hiragana writing practice: write the kana for the romaji shown, in the correct stroke order, with the correct stroke endings (tome / hane / harai).

## Develop

```
npm install
npx expo start        # scan the QR code with Expo Go (same Wi-Fi)
npx expo start --web  # browser
npm run check         # typecheck + logic self-check
```

Stroke data comes from [KanjiVG](https://kanjivg.tagaini.net) (CC BY-SA 3.0). The stroke endings are hand-labelled in `scripts/build-hiragana.mjs`. After editing them, run `npm run build-data` to regenerate `src/hiragana.json`.

## Releases

Pushing a tag like `v1.0.0` or `1.0.0`, or publishing a Release with a new tag on the website, builds a signed Android APK and an unsigned iPhone `.ipa` and attaches both to the GitHub Release (`.github/workflows/release.yml`).

### Android APK

One-time setup: create a signing key. Every release must use this same key, otherwise Android refuses the update and you'd have to uninstall, which deletes your practice history. Keep the keystore file and its password safe, outside the repo.

In **Git Bash** (OpenSSL ships with Git for Windows, no Java needed), in a folder outside the repo:

```bash
# MSYS_NO_PATHCONV stops Git Bash from turning "/CN=..." into a Windows path
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 10000 -subj "/CN=JpWriting"
openssl pkcs12 -export -inkey key.pem -in cert.pem -name jpwriting -out jpwriting-release.keystore  # asks for the password
rm key.pem cert.pem                                  # key.pem is the unprotected private key
base64 -w0 jpwriting-release.keystore | clip         # copies it to the clipboard as text
```

With Java installed, `keytool -genkeypair -v -storetype PKCS12 -keystore jpwriting-release.keystore -alias jpwriting -keyalg RSA -keysize 2048 -validity 10000` does the same.

Add these repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the clipboard content from above |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
| `ANDROID_KEY_ALIAS` | `jpwriting` |
| `ANDROID_KEY_PASSWORD` | the same password (PKCS12 keystores use one password) |

Release:

```
git tag v1.0.0
git push origin v1.0.0
```

### iPhone .ipa (AltStore / SideStore)

The `.ipa` is unsigned, so no Apple Developer account or secrets are needed. [AltStore](https://altstore.io) or [SideStore](https://sidestore.io) signs it with your own free Apple ID when installing:

1. Install AltStore (with AltServer on your PC) or SideStore on the iPhone, following their setup guide. On Windows, AltServer needs iTunes and iCloud downloaded from apple.com, not the Microsoft Store versions.
2. Download `JpWriting-<version>.ipa` from the Release on the iPhone, then open it with AltStore / SideStore (or use "+" → pick the file).
3. Updates: install the newer `.ipa` the same way; progress is kept.

Free Apple ID limits: the app must be refreshed every 7 days (AltStore does it automatically when AltServer is reachable on the same Wi-Fi; SideStore refreshes on the phone), and at most 3 sideloaded apps at a time. AltStore PAL (the EU marketplace) can't install self-signed apps; use classic AltStore or SideStore.

macOS build minutes are free for public repositories; for private ones they count 10× against the monthly allowance.

### Web / iPhone (GitHub Pages)

Every push to `master` publishes the web version (`.github/workflows/pages.yml`). One-time setup: Settings → Pages → Source: **GitHub Actions**. Free GitHub plans only offer Pages for public repositories.

On iPhone, open `https://<user>.github.io/<repo>/` in Safari, then Share → **Add to Home Screen**. On the web, progress is stored in the browser, so use Settings → Export to back it up.
