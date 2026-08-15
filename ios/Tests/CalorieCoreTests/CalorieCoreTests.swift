import XCTest
@testable import CalorieCore

final class CalorieCoreTests: XCTestCase {
    func testFreshJournalHasFoodsButNoPretendPersonalHistory() {
        XCTAssertFalse(CalorieDocument.starter.foods.isEmpty)
        XCTAssertTrue(CalorieDocument.starter.foodEntries.isEmpty)
        XCTAssertTrue(CalorieDocument.starter.waterEntries.isEmpty)
        XCTAssertTrue(CalorieDocument.starter.weightEntries.isEmpty)
        XCTAssertTrue(CalorieDocument.starter.routines.isEmpty)
    }

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

    func testCloudExportMapsCurrentJournalWithoutInventingFat() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(secondsFromGMT: 0))
        let snapshot = try CloudJournalMapper.decode(
            Data(Self.cloudExport.utf8),
            calendar: calendar
        )

        XCTAssertEqual(snapshot.document.profile.name, "Sarthak")
        XCTAssertEqual(snapshot.counts.foodEntries, 1)
        XCTAssertEqual(snapshot.document.foodEntries.first?.foodName, "Greek yoghurt")
        XCTAssertEqual(snapshot.document.foodEntries.first?.meal, .snack)
        XCTAssertEqual(snapshot.document.foodEntries.first?.nutrients.fat, 0)
        XCTAssertEqual(snapshot.document.foods.first?.isPackaged, true)
        XCTAssertEqual(snapshot.document.foods.first?.labels, ["breakfast", "high-protein"])
        XCTAssertEqual(snapshot.document.foodEntries.first?.isPackaged, true)
        XCTAssertEqual(snapshot.document.foodEntries.first?.labels, ["breakfast"])
        XCTAssertEqual(snapshot.document.weightEntries.first?.kilograms, 72.4)
        XCTAssertEqual(snapshot.document.profile.weightKilograms, 72.4)
        XCTAssertEqual(snapshot.document.weightEntries.count, 2)
        XCTAssertEqual(snapshot.document.syncState, .synced)
    }

    func testJournalMergeKeepsUniqueCloudAndIPhoneRecords() throws {
        let cloud = try CloudJournalMapper.decode(Data(Self.cloudExport.utf8))
        var local = CalorieDocument()
        local.foods = [Food(name: "Paneer bowl", servingName: "1 bowl", nutrients: Nutrients(calories: 500))]
        local.foodEntries = [
            FoodEntry(
                foodID: local.foods[0].id,
                foodName: local.foods[0].name,
                meal: .lunch,
                timestamp: Date(timeIntervalSince1970: 1_700_040_000),
                servings: 1,
                nutrients: local.foods[0].nutrients
            ),
        ]

        let merged = CloudJournalMapper.reconcile(local: local, cloud: cloud, choice: .merge)

        XCTAssertEqual(merged.foods.count, 2)
        XCTAssertEqual(merged.foodEntries.count, 2)
        XCTAssertEqual(merged.syncState, .pending)
    }

    func testKeepCloudPreservesFieldsTheCloudCannotRepresent() throws {
        let cloud = try CloudJournalMapper.decode(Data(Self.cloudExport.utf8))
        var local = CalorieDocument()
        local.theme = .dark
        local.profile.weightKilograms = 71.5
        local.profile.manualMacroTargets = Nutrients(calories: 2_100, protein: 140, carbohydrates: 230, fat: 65, fibre: 30)
        local.dailyNotes = ["2026-08-11": "Keep this private note."]
        local.cycle = CycleContext(enabled: true, latestPeriodStart: Date(timeIntervalSince1970: 1_700_000_000), typicalCycleDays: 29)
        local.foods = cloud.document.foods.map { food in
            var copy = food
            copy.nutrients.fat = 12
            return copy
        }
        local.foodEntries = cloud.document.foodEntries.map { entry in
            var copy = entry
            copy.meal = .snack
            copy.nutrients.fat = 9
            return copy
        }

        let reconciled = CloudJournalMapper.reconcile(local: local, cloud: cloud, choice: .keepCloud)

        XCTAssertEqual(reconciled.theme, .dark)
        XCTAssertEqual(reconciled.profile.weightKilograms, 72.4)
        XCTAssertEqual(reconciled.profile.manualMacroTargets?.protein, 140)
        XCTAssertEqual(reconciled.dailyNotes["2026-08-11"], "Keep this private note.")
        XCTAssertEqual(reconciled.cycle.typicalCycleDays, 29)
        XCTAssertEqual(reconciled.foods.first?.nutrients.fat, 12)
        XCTAssertEqual(reconciled.foodEntries.first?.meal, .snack)
        XCTAssertEqual(reconciled.foodEntries.first?.nutrients.fat, 9)
        XCTAssertEqual(reconciled.syncState, .synced)
    }

    func testSyncIntentsSurviveRelaunchAndCompactSnapshots() async throws {
        let fileURL = FileManager.default.temporaryDirectory
            .appending(path: UUID().uuidString)
            .appending(path: "sync-intents.json")
        let deletedID = UUID()
        let firstStore = SyncIntentStore(fileURL: fileURL)
        try await firstStore.enqueue(.deleteFoodEntry(deletedID))
        try await firstStore.enqueue(.snapshot(CalorieDocument.sample))
        var newer = CalorieDocument.sample
        newer.foodEntries = []
        try await firstStore.enqueue(.snapshot(newer))

        let restored = try await SyncIntentStore(fileURL: fileURL).pending()

        XCTAssertEqual(restored.count, 2)
        XCTAssertEqual(restored.first?.operation, .deleteFoodEntry(deletedID))
        XCTAssertEqual(restored.last?.operation, .snapshot(newer))
    }

    func testJournalDiffQueuesOnlyChangedCloudRecords() throws {
        let cloud = try CloudJournalMapper.decode(Data(Self.cloudExport.utf8)).document
        var local = cloud
        let water = WaterEntry(timestamp: Date(timeIntervalSince1970: 1_800_000_000), millilitres: 400)
        local.waterEntries.append(water)
        local.dailyNotes["2026-08-16"] = "Device-only note"
        local.theme = .dark

        XCTAssertEqual(CloudJournalDiff.operations(from: cloud, to: local), [.upsertWaterEntry(water)])
    }

    func testGranularSyncIntentsCompactByRecord() async throws {
        let fileURL = FileManager.default.temporaryDirectory
            .appending(path: UUID().uuidString)
            .appending(path: "sync-intents.json")
        let store = SyncIntentStore(fileURL: fileURL)
        let id = UUID()
        try await store.enqueue(.upsertWaterEntry(WaterEntry(id: id, timestamp: .now, millilitres: 250)))
        try await store.enqueue(.upsertWaterEntry(WaterEntry(id: id, timestamp: .now, millilitres: 500)))

        let pending = try await store.pending()

        XCTAssertEqual(pending.count, 1)
        guard case let .upsertWaterEntry(entry) = pending[0].operation else {
            return XCTFail("Expected the latest water upsert.")
        }
        XCTAssertEqual(entry.millilitres, 500)
    }

    func testProfileIntentCompactionKeepsTheOriginalCloudBaseline() async throws {
        let fileURL = FileManager.default.temporaryDirectory
            .appending(path: UUID().uuidString)
            .appending(path: "sync-intents.json")
        let store = SyncIntentStore(fileURL: fileURL)
        let original = Profile(name: "Original")
        var renamed = original
        renamed.name = "Renamed"
        var retargeted = renamed
        retargeted.waterTargetMillilitres = 3_000
        try await store.enqueue(.updateProfile(before: original, after: renamed))
        try await store.enqueue(.updateProfile(before: renamed, after: retargeted))

        let pending = try await store.pending()

        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending.first?.operation, .updateProfile(before: original, after: retargeted))
    }

    private static let cloudExport = #"""
    {
      "schema": "calorie-journal-backup",
      "version": 2,
      "generatedAt": "2026-08-11T10:00:00.000Z",
      "profile": {
        "userId": "owner-1",
        "displayName": "Sarthak",
        "units": "metric",
        "ageYears": 30,
        "genderIdentity": null,
        "equationProfile": "male",
        "heightCm": 175,
        "activityLevel": "moderate",
        "goal": "maintain",
        "targetWeightKg": null,
        "manualCalorieTarget": 2100,
        "manualCalorieRange": [2000, 2200],
        "wakeTime": "07:00",
        "sleepHours": 8,
        "fastingThresholdHours": 12,
        "waterTargetMl": 2500,
        "dailyActionOrder": ["food", "water", "weight", "creatine"],
        "dailyActionHidden": [],
        "onboardingComplete": true
      },
      "foods": [{
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "Greek yoghurt",
        "servingMode": "per_unit",
        "unitLabel": "bowl",
        "defaultAmount": 1,
        "calories": 410,
        "carbsG": 48,
        "proteinG": 29,
        "fibreG": 7,
        "favourite": true,
        "lastUsedAt": 1700000000000,
        "archivedAt": null,
        "isPackaged": true,
        "labels": ["breakfast", "high-protein"]
      }],
      "entries": [{
        "id": "22222222-2222-4222-8222-222222222222",
        "foodId": "11111111-1111-4111-8111-111111111111",
        "foodName": "Greek yoghurt",
        "amount": 1,
        "unitLabel": "bowl",
        "calories": 410,
        "carbsG": 48,
        "proteinG": 29,
        "fibreG": 7,
        "eatenAt": 1700000000000,
        "isPackaged": true,
        "labels": ["breakfast"]
      }],
      "waterEntries": [{"id":"33333333-3333-4333-8333-333333333333","amountMl":750,"drankAt":1700035200000}],
      "medications": [{"id":"44444444-4444-4444-8444-444444444444","name":"Morning routine","schedule":"morning","createdAt":1700000000000,"archivedAt":null}],
      "medicationCheckIns": [{"id":"55555555-5555-4555-8555-555555555555","medicationId":"44444444-4444-4444-8444-444444444444","takenOn":"2026-08-11","takenAt":1700035200000}],
      "weights": [
        {"id":"66666666-6666-4666-8666-666666666666","weightKg":72.4,"recordedAt":1700035200000},
        {"id":"77777777-7777-4777-8777-777777777777","weightKg":73.1,"recordedAt":1699948800000}
      ],
      "cycleSessions": []
    }
    """#
}
