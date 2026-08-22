import CalorieCore
import PersonalSyncKit
import XCTest

@testable import Calorie

final class CalorieOnboardingTests: XCTestCase {
    func testEmptyJournalPresentsOnboarding() {
        XCTAssertTrue(
            CalorieOnboardingPolicy.shouldPresent(
                completed: false,
                hasLocalActivity: false,
                cloudActivityCount: 0
            )
        )
    }

    func testExistingLocalOrCloudActivityBypassesOnboarding() {
        XCTAssertFalse(
            CalorieOnboardingPolicy.shouldPresent(
                completed: false,
                hasLocalActivity: true,
                cloudActivityCount: 0
            )
        )
        XCTAssertFalse(
            CalorieOnboardingPolicy.shouldPresent(
                completed: false,
                hasLocalActivity: false,
                cloudActivityCount: 2
            )
        )
    }

    func testCompletedAndForcedPoliciesStayExplicit() {
        XCTAssertFalse(
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

    func testTargetPlansDistinguishManualEstimateAndUnset() {
        let manual = Nutrients(calories: 2_000, protein: 100, carbohydrates: 240, fibre: 28)
        XCTAssertEqual(CalorieOnboardingTargetPlan.manual(manual), .manual(manual))
        XCTAssertNotEqual(CalorieOnboardingTargetPlan.estimateLater, .later)
    }

    @MainActor
    func testCompletionUsesTheRealStoreAndLeavesSkippedTargetsUnset() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let model = AppModel(
            store: store,
            accountClient: NoAccountClient(),
            syncStore: SyncIntentStore(fileURL: directory.appending(path: "sync.json"))
        )
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
        let model = AppModel(
            store: store,
            accountClient: NoAccountClient(),
            syncStore: SyncIntentStore(fileURL: directory.appending(path: "sync.json"))
        )
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

private actor NoAccountClient: NativeAccountServing {
    var googleStartURL: URL { URL(string: "https://example.com")! }

    func restoreAccount() async throws -> CalorieAccount? { nil }
    func exchangeGoogleHandoff(_: String) async throws -> CalorieAccount { throw CancellationError() }
    func signInWithApple(_: AppleIdentityPayload) async throws -> CalorieAccount { throw CancellationError() }
    func linkApple(_: AppleIdentityPayload) async throws -> CalorieAccount { throw CancellationError() }
    func cloudExport() async throws -> Data { Data() }
    func apply(_: SyncIntent) async throws {}
    func signOut() async {}
    func deleteAccount() async throws {}
}
