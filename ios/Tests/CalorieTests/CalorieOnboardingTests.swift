import CalorieCore
import PersonalSyncKit
import XCTest

@testable import Calorie

final class CalorieOnboardingTests: XCTestCase {
    func testSyncStatusUsesHumanLanguageForEveryState() {
        XCTAssertEqual(CalorieSyncStatusCopy.text(for: .localOnly, pendingCount: 0), "On this device")
        XCTAssertEqual(CalorieSyncStatusCopy.text(for: .pending, pendingCount: 1), "1 change waiting")
        XCTAssertEqual(CalorieSyncStatusCopy.text(for: .pending, pendingCount: 3), "3 changes waiting")
        XCTAssertEqual(CalorieSyncStatusCopy.text(for: .synced, pendingCount: 0), "Up to date")
        XCTAssertEqual(CalorieSyncStatusCopy.text(for: .conflict, pendingCount: 0), "Choice required")
        XCTAssertEqual(CalorieSyncStatusCopy.text(for: .failed, pendingCount: 0), "Sync needs attention")
    }

    func testAccountCopyIsAppleFirstLocalFirstAndCustomerFacing() {
        XCTAssertTrue(CalorieAccountCopy.unsignedOverview.contains("without an account"))
        XCTAssertTrue(CalorieAccountCopy.unsignedOverview.contains("Sign in with Apple"))
        XCTAssertTrue(CalorieAccountCopy.googleRecovery.contains("Previously connected"))
        XCTAssertTrue(CalorieAccountCopy.googleRecovery.contains("Google"))
        XCTAssertTrue(CalorieAccountCopy.connectedOverview.contains("iCloud"))
        XCTAssertTrue(CalorieAccountCopy.connectedOverview.contains("Significant Hobbies"))

        let customerFacingCopy = [
            CalorieAccountCopy.unsignedOverview,
            CalorieAccountCopy.googleRecovery,
            CalorieAccountCopy.connectedOverview,
            CalorieAccountCopy.appleLinked,
            CalorieAccountCopy.appleLinkPrompt,
            CalorieAccountCopy.onboardingLocalFirst,
            CalorieAccountCopy.existingAccountConnected,
            CalorieAccountCopy.accountJournalReplacement,
        ].joined(separator: " ").lowercased()

        for implementationTerm in ["cloudflare", "d1", "identity matching", "on the web", "web history", "web journal"] {
            XCTAssertFalse(customerFacingCopy.contains(implementationTerm))
        }
    }

    func testEmptyJournalPresentsOnboarding() {
        XCTAssertTrue(
            CalorieOnboardingPolicy.shouldPresent(
                completed: false,
                hasLocalActivity: false,
                cloudActivityCount: 0
            )
        )
    }

    func testExistingLocalOrCloudActivityReceivesIllustratedOnboardingOnce() {
        XCTAssertTrue(
            CalorieOnboardingPolicy.shouldPresent(
                completed: false,
                hasLocalActivity: true,
                cloudActivityCount: 0
            )
        )
        XCTAssertTrue(
            CalorieOnboardingPolicy.shouldPresent(
                completed: false,
                hasLocalActivity: false,
                cloudActivityCount: 2
            )
        )
    }

    func testCompletedAndForcedPoliciesStayExplicit() {
        XCTAssertTrue(
            CalorieOnboardingPolicy.shouldPresent(
                completed: true,
                hasLocalActivity: false,
                cloudActivityCount: 0,
                forced: true
            )
        )
        XCTAssertTrue(
            CalorieOnboardingPolicy.shouldPresent(
                completed: false,
                hasLocalActivity: true,
                cloudActivityCount: 3,
                forced: true
            )
        )
    }

    @MainActor
    func testExistingJournalSeesIllustratedOnboardingUntilDismissed() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let model = AppModel(store: store, mirror: nil, legacyJournal: nil)
        await model.load()
        XCTAssertTrue(model.shouldPresentCalorieOnboarding(completed: false))
        XCTAssertFalse(model.shouldPresentCalorieOnboarding(completed: true))
    }

    func testTargetPlansDistinguishManualEstimateAndUnset() {
        let manual = Nutrients(calories: 2_000, protein: 100, carbohydrates: 240, fibre: 28)
        XCTAssertEqual(CalorieOnboardingTargetPlan.manual(manual), .manual(manual))
        XCTAssertNotEqual(CalorieOnboardingTargetPlan.estimateLater, .later)
    }

    @MainActor
    func testExploreFirstPersistsUnsetTargetsWithoutLoggingFood() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let model = AppModel(store: store, mirror: nil, legacyJournal: nil)
        await model.load()

        XCTAssertNil(model.document.profile.manualCalorieTarget)
        XCTAssertNil(model.document.profile.manualMacroTargets)
        XCTAssertNil(model.targetExplanation)

        let saved = await model.completeExploringFirst()
        let persisted = try await store.load()

        XCTAssertTrue(saved)
        XCTAssertTrue(persisted.foodEntries.isEmpty)
        XCTAssertNil(persisted.profile.manualCalorieTarget)
        XCTAssertNil(persisted.profile.manualMacroTargets)
        XCTAssertTrue(persisted.profile.onboardingComplete == true)

        let reloaded = AppModel(store: store, mirror: nil, legacyJournal: nil)
        await reloaded.load()
        XCTAssertNil(reloaded.targetExplanation)
        let food = Food(name: "Fixture meal", servingName: "1 serving", nutrients: Nutrients(calories: 400))
        await reloaded.log(food, servings: 1, meal: .lunch, at: reloaded.selectedDate)
        let afterLogging = try await store.load()
        XCTAssertEqual(afterLogging.foodEntries.map(\.foodName), ["Fixture meal"])
        XCTAssertNil(TargetCalculator.targets(for: afterLogging.profile))
    }

    @MainActor
    func testExplorePreservesStoredTargetChoicesAndEntries() async throws {
        let formerDefaults = Nutrients(calories: 2_100, protein: 120, carbohydrates: 250, fat: 70, fibre: 28)
        let profiles = [
            Profile(manualCalorieTarget: 2_100, manualMacroTargets: formerDefaults),
            Profile(manualCalorieTarget: 1_900),
            Profile(age: 30, heightCentimetres: 170, weightKilograms: 70, equationProfile: EquationProfile.allCases[0]),
        ]
        for profile in profiles {
            let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
            let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
            var original = CalorieDocument.starter
            original.profile = profile
            original.log(
                food: Food(name: "Existing fixture meal", servingName: "1 serving", nutrients: Nutrients(calories: 400)),
                servings: 1, meal: .lunch, at: Date(timeIntervalSince1970: 1_700_000_000)
            )
            try await store.save(original)
            let model = AppModel(store: store, mirror: nil, legacyJournal: nil)
            await model.load()
            let expectedTargets = TargetCalculator.targets(for: original.profile)
            let saved = await model.completeExploringFirst()
            let persisted = try await store.load()
            var expectedProfile = profile
            expectedProfile.onboardingComplete = true

            XCTAssertTrue(saved)
            XCTAssertEqual(persisted.profile, expectedProfile)
            XCTAssertEqual(persisted.foodEntries, original.foodEntries)
            XCTAssertEqual(TargetCalculator.targets(for: persisted.profile), expectedTargets)
        }
    }

    @MainActor
    func testCompletionUsesTheRealStoreAndLeavesSkippedTargetsUnset() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let model = AppModel(store: store, mirror: nil, legacyJournal: nil)
        await model.load()
        let food = Food(
            name: "First apple",
            servingName: "1 apple",
            nutrients: Nutrients(calories: 95, protein: 0.5, carbohydrates: 25, fibre: 4)
        )

        let saved = await model.completeOnboarding(
            configuration: CalorieOnboardingConfiguration(units: "metric", targets: .later),
            food: food,
            servings: 1,
            meal: .snack,
            saveFood: false
        )
        let persisted = try await store.load()

        XCTAssertTrue(saved)
        XCTAssertEqual(persisted.foodEntries.map(\.foodName), ["First apple"])
        XCTAssertFalse(persisted.foods.contains(where: { $0.name == "First apple" }))
        XCTAssertNil(persisted.profile.manualCalorieTarget)
        XCTAssertNil(persisted.profile.manualMacroTargets)
        XCTAssertTrue(persisted.profile.onboardingComplete == true)
    }

    @MainActor
    func testManualAndReusablePathPersistsBothChoices() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let model = AppModel(store: store, mirror: nil, legacyJournal: nil)
        await model.load()
        let targets = Nutrients(calories: 2_000, protein: 110, carbohydrates: 230, fibre: 30)
        let food = Food(
            name: "Home bowl",
            servingName: "1 bowl",
            nutrients: Nutrients(calories: 500, protein: 25, carbohydrates: 65, fibre: 9),
            isCustom: true
        )

        let saved = await model.completeOnboarding(
            configuration: CalorieOnboardingConfiguration(units: "metric", targets: .manual(targets)),
            food: food,
            servings: 1,
            meal: .lunch,
            saveFood: true
        )
        let persisted = try await store.load()

        XCTAssertTrue(saved)
        XCTAssertEqual(persisted.profile.manualMacroTargets, targets)
        XCTAssertTrue(persisted.foods.contains(where: { $0.name == "Home bowl" }))
        XCTAssertEqual(persisted.totals(on: model.selectedDate).calories, 500)
    }
}
