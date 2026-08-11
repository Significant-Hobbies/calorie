# Calorie for iPhone and iPad

A native SwiftUI nutrition journal for iOS 17 and later. It uses Apple frameworks only, keeps daily logging useful offline, and exposes the inputs and rule behind each estimate.

## Local checks

```bash
./scripts/check.sh
```

## Personal-team archive

```bash
CALORIE_ARCHIVE_PATH=/private/tmp/Calorie.xcarchive ./scripts/archive.sh
```

The script is locked to personal team `8F7LXHTJZR`, verifies the local signature, and contains no upload step.

## Device-only checks before submission

- Complete one-handed iPhone logging plus the primary journal, account, and data-transfer flows on physical iPhone and iPad hardware.
- Verify largest Dynamic Type, VoiceOver chart summaries, Light/Dark/System, and Reduce Motion on hardware.
- Verify Sign in with Apple on a physical device, Google-to-native callback, Keychain persistence, relay-email linking, airplane-mode reconciliation, credential revocation, and account deletion after the optional Worker configuration is enabled.
- Confirm final screenshots, support/privacy URLs, age rating, nutrition/medical disclaimers, and App Privacy answers in App Store Connect before upload.
