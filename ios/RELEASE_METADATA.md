# Calorie iOS release draft

App Store Connect app ID: `6801238805`. Build `1.0.0 (3)` was accepted for
TestFlight processing on 2026-08-16.

## Identity

- Name: Calorie
- Bundle ID: `com.significanthobbies.calorie`
- Version: `1.0.0`
- Build: `3`
- SKU: `calorie-ios-1`
- Primary language: English (U.S.)
- Category: Health & Fitness
- Minimum iOS: 17.0
- Copyright: `2026 Sarthak Agrawal`
- License: Apple's standard EULA
- Content rights: all bundled copy, artwork, and sample food content is owned or licensed for distribution

## Store copy

**Subtitle**
A journal that shows its work

**Promotional text**
Log familiar food in seconds, see four nutrients and useful timing, and keep every estimate transparent.

**Description**
Calorie is a small, private food journal for the moments right after you eat. Record calories, protein, carbohydrates, fat, fibre, water, weight check-ins, and simple medication routines without punitive scores or streak pressure.

Daily targets can be entered manually or estimated with a published equation profile. Every timing suggestion names its recorded inputs and rule, and clearly remains an estimate—not medical advice.

Logging works locally without an account. Optionally connect an existing Calorie journal and reconcile cloud and device records with an explicit preview. Sign in with Apple can be linked later as another way to open the same journal. Review days and weeks, meal timing, trends, familiar and custom foods, and export your journal whenever you choose.

**Keywords**
food journal,calories,protein,macros,nutrition,meal log,water,timing,weight

## URLs

- Support: `https://calorie.significanthobbies.com`
- Privacy: `https://calorie.significanthobbies.com/privacy`

## Privacy draft

- Tracking: none
- Third-party advertising: none
- Local nutrition and routine data: remains on device in local-only mode
- Optional cloud mode: account identifier, name, email or Apple relay address, nutrition journal, water, weight, and routine check-ins are linked to the account for app functionality
- Sign in with Apple: uses Apple's stable provider identifier; email equality is not used for account ownership
- Medication routines: names and daily boolean check-ins only; no dosage or medical advice
- App Store Connect draft: disclose name, email address, user ID, Health,
  Fitness, and Other User Content as linked to the user and used only for
  optional app functionality; confirm against the current questionnaire before
  TestFlight review
- IDFA: not used

## Age rating draft

- Made for Kids: No
- In-app parental controls or age assurance: None
- Unrestricted web access, broadly distributed user-generated content, social
  media, messaging/chat, and advertising: No
- Health or Wellness Topics: Yes — calorie tracking, nutrition estimates, and
  routine check-ins
- Medical or Treatment Information: None — the app records user-named routines
  but gives no dosage, diagnosis, or treatment guidance
- Violence, sexuality or nudity, profanity, horror, drugs, alcohol, gambling,
  contests, and loot boxes: None

Confirm the rating produced by App Store Connect's current questionnaire.

## Regulated medical device declaration

- Regulated medical device in the EU/EEA, UK, or U.S.: No
- Use statement or medical-device safety information: Not applicable

## Review notes draft

The app can be used without an account. A fresh journal contains reusable food templates but no fabricated personal meals, water, weight, routines, or notes. Existing web users choose **Connect existing Calorie data**, authenticate with Google once, and then choose cloud, device, or merge. Apple sign-in is an optional additional login for that same journal. Medication is limited to user-named routines and a daily checkbox; the app does not store dosage or provide medication guidance.

## Screenshots and release

- iPhone 6.9-inch portrait: `ios/artifacts/app-store/iphone-6.9/today.jpg`,
  `quick-log.jpg`, `foods.jpg`, `progress.jpg`, and `you.jpg`
- iPad 13-inch portrait: `ios/artifacts/app-store/ipad-13/today.jpg`,
  `quick-log.jpg`, `foods.jpg`, `progress.jpg`, and `you.jpg`
- Each iPhone image is `1320 × 2868`; each iPad image is `2064 × 2752`.
  Every store image has no alpha channel and uses an accepted screenshot size.
- Dark Mode and accessibility evidence are retained separately and are not in the default store sequence
- The target is universal, so both the iPhone and iPad sequences are required
- App previews: omit for version 1.0
- Release: manual
