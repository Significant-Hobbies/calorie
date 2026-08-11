# Calorie iOS release draft

Preparation only. No App Store Connect record has been created.

## Identity

- Name: Calorie
- Bundle ID: `com.significanthobbies.calorie`
- Version: `1.0.0`
- Build: `1`
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

Logging works locally without an account. Optionally connect an existing Calorie journal, link Sign in with Apple, and reconcile cloud and iPhone records with an explicit preview. Review days and weeks, meal timing, trends, familiar and custom foods, and export your journal whenever you choose.

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
- App Store Connect draft: disclose contact info, user ID, and health/fitness journal data as linked to the user and used only for optional app functionality; confirm against the current questionnaire before TestFlight review
- IDFA: not used

## Age rating draft

- Made for Kids: No
- Violence, sexual content, profanity, drugs, alcohol, gambling, horror: None
- Medical or treatment claims: nutritional estimates only; the app is not medical advice
- User-generated content, messaging, unrestricted web access: None

Confirm the rating produced by App Store Connect's current questionnaire.

## Review notes draft

The app can be used without an account. A fresh journal contains reusable food templates but no fabricated personal meals, water, weight, routines, or notes. Existing web users choose **Connect existing Calorie data**, authenticate with Google once, link Apple explicitly, and then choose cloud, iPhone, or merge. Medication is limited to user-named routines and a daily checkbox; the app does not store dosage or provide medication guidance.

## Screenshots and release

- iPhone 6.9-inch portrait: `today.png`, `quick-log.png`, `foods.png`, `progress.png`, and `you.png`
- Each store image is `1206 × 2622`, an accepted 6.9-inch screenshot size
- Dark Mode and accessibility evidence are retained separately and are not in the default store sequence
- iPad screenshots: not required; the target is iPhone only
- App previews: omit for version 1.0
- Release: manual
