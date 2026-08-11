import XCTest
@testable import CalorieCore

final class CalorieCoreTests: XCTestCase {
    func testManualTargetsRemainManual() throws {
        let profile = Profile(manualCalorieTarget: 2_250, manualMacroTargets: nil)
        let result = try XCTUnwrap(TargetCalculator.targets(for: profile))

        XCTAssertFalse(result.isEstimate)
        XCTAssertEqual(result.target.calories, 2_250)
        XCTAssertTrue(result.detail.contains("entered directly"))
    }

    func testNoEstimatePathDoesNotFabricateTarget() {
        let profile = Profile(manualCalorieTarget: nil, manualMacroTargets: nil)
        XCTAssertNil(TargetCalculator.targets(for: profile))
    }

    func testPublishedEstimateShowsWorking() throws {
        let profile = Profile(
            age: 30,
            heightCentimetres: 175,
            weightKilograms: 72,
            goal: .maintain,
            activity: .moderate,
            equationProfile: .mifflinMaleConstant,
            manualCalorieTarget: nil,
            manualMacroTargets: nil
        )
        let result = try XCTUnwrap(TargetCalculator.targets(for: profile))

        XCTAssertTrue(result.isEstimate)
        XCTAssertTrue(result.detail.contains("Mifflin–St Jeor"))
        XCTAssertGreaterThan(result.target.protein, 0)
    }

    func testServingScaleAndDailyTotals() throws {
        var document = CalorieDocument.sample
        let food = try XCTUnwrap(document.foods.first)
        let date = Date(timeIntervalSince1970: 100_000)
        document.foodEntries = []

        document.log(food: food, servings: 1.5, meal: .lunch, at: date)

        XCTAssertEqual(document.entries(on: date).count, 1)
        XCTAssertEqual(document.totals(on: date).calories, food.nutrients.calories * 1.5, accuracy: 0.001)
    }

    func testRoutineToggleDoesNotStoreDosage() throws {
        var document = CalorieDocument.sample
        let routine = try XCTUnwrap(document.routines.first)
        let date = Date(timeIntervalSince1970: 100_000)

        document.toggleRoutine(routine.id, on: date)
        XCTAssertTrue(document.isRoutineComplete(routine.id, on: date))
        document.toggleRoutine(routine.id, on: date)
        XCTAssertFalse(document.isRoutineComplete(routine.id, on: date))
    }

    func testDeleteAndUndoRestoreSameEntry() throws {
        var document = CalorieDocument.sample
        let entry = try XCTUnwrap(document.foodEntries.first)

        let removed = try document.deleteEntry(entry.id)
        XCTAssertFalse(document.foodEntries.contains(where: { $0.id == entry.id }))
        document.restoreEntry(removed)
        XCTAssertTrue(document.foodEntries.contains(where: { $0.id == entry.id }))
    }

    func testPersistenceRestoresOfflineJournal() async throws {
        let url = FileManager.default.temporaryDirectory
            .appending(path: UUID().uuidString)
            .appending(path: "journal.json")
        let store = CalorieStore(fileURL: url)
        var document = CalorieDocument.sample
        let date = Date(timeIntervalSince1970: 100_000)
        document.foodEntries = document.foodEntries.map { entry in
            var copy = entry
            copy.timestamp = date
            return copy
        }
        document.waterEntries = [WaterEntry(timestamp: date, millilitres: 1_000)]

        try await store.save(document)
        let restored = try await store.load()

        XCTAssertEqual(restored, document)
    }

    func testGuidanceNamesInputsAndDisclaimsEstimate() throws {
        let food = try XCTUnwrap(CalorieDocument.sample.foodEntries.first)
        let now = food.timestamp.addingTimeInterval(7_200)
        let items = GuidanceEngine.items(entries: [food], now: now)

        XCTAssertTrue(items[0].explanation.contains(food.foodName))
        XCTAssertTrue(items[0].explanation.contains("estimate"))
        XCTAssertTrue(items[1].explanation.contains("not a medical rule"))
    }

    func testWeightCycleAndNoteRemainVersionedLocalState() throws {
        let date = Date(timeIntervalSince1970: 200_000)
        var document = CalorieDocument.sample
        document.weightEntries = [WeightEntry(date: date, kilograms: 71.8)]
        document.cycle = CycleContext(enabled: true, latestPeriodStart: date, typicalCycleDays: 29)
        document.dailyNotes = [DateKey.string(date): "Recovery felt steady."]

        let data = try JSONEncoder().encode(document)
        let restored = try JSONDecoder().decode(CalorieDocument.self, from: data)

        XCTAssertEqual(restored.weightEntries.first?.kilograms, 71.8)
        XCTAssertEqual(restored.cycle.typicalCycleDays, 29)
        XCTAssertEqual(restored.dailyNotes[DateKey.string(date)], "Recovery felt steady.")
    }
}
