import CalorieCore
import Foundation
import XCTest

@testable import Calorie

@MainActor
final class CalorieLocalSaveTests: XCTestCase {
    func testOverflowingExistingMetricsAreDroppedWithoutRewritingSidecar() throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let now = Date()
        let timeZone = TimeZone.current
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let components = calendar.dateComponents([.year, .month, .day], from: now)
        let date = String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
        let file = root.appending(path: "interaction-metrics.json")

        let counterReport = LocalInteractionReport(
            coverageStartedAtISO: "2026-10-26T00:00:00Z",
            updatedAtISO: "2026-10-26T00:00:00Z",
            timeZoneIdentifier: timeZone.identifier,
            days: [LocalInteractionDay(date: date, counters: [LocalInteractionEvent.logFormOpened.rawValue: Int.max])]
        )
        let encoder = JSONEncoder()
        let counterData = try encoder.encode(counterReport)
        try counterData.write(to: file)
        let counterStore = LocalInteractionMetricsStore(fileURL: file)
        counterStore.record(.logFormOpened, now: now, timeZone: timeZone)
        XCTAssertEqual(try Data(contentsOf: file), counterData)

        let durationReport = LocalInteractionReport(
            coverageStartedAtISO: "2026-10-26T00:00:00Z",
            updatedAtISO: "2026-10-26T00:00:00Z",
            timeZoneIdentifier: timeZone.identifier,
            days: [LocalInteractionDay(
                date: date,
                counters: [LocalInteractionEvent.logSaved.rawValue: 1],
                durationTotalsSeconds: [LocalInteractionDuration.logFormElapsed.rawValue: Double.greatestFiniteMagnitude],
                durationSamples: [LocalInteractionDuration.logFormElapsed.rawValue: 1]
            )]
        )
        let durationData = try encoder.encode(durationReport)
        try durationData.write(to: file)
        let durationStore = LocalInteractionMetricsStore(fileURL: file)
        durationStore.record(.logSaved, elapsedSeconds: Double.greatestFiniteMagnitude, now: now, timeZone: timeZone)
        XCTAssertEqual(try Data(contentsOf: file), durationData)
    }

    func testConcurrentQuickLogSavesBothPersistAndAreMeasured() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = CalorieStore(fileURL: root.appending(path: "journal.json"))
        let model = makeModel(store: store, root: root)
        await model.load()
        let firstFood = Food(name: "Synthetic bowl", servingName: "1 bowl",
                             nutrients: Nutrients(calories: 300, protein: 20, carbohydrates: 40, fibre: 5))
        let secondFood = Food(name: "Synthetic snack", servingName: "1 serving",
                              nutrients: Nutrients(calories: 120, protein: 3, carbohydrates: 18, fibre: 2))

        async let first = model.log(firstFood, servings: 1, meal: .lunch, at: model.selectedDate)
        async let second = model.log(secondFood, servings: 1, meal: .snack, at: model.selectedDate)
        let outcomes = await (first, second)

        XCTAssertTrue(outcomes.0)
        XCTAssertTrue(outcomes.1)
        let reloaded = try await store.load()
        XCTAssertEqual(Set(reloaded.foodEntries.map(\.foodName)), [firstFood.name, secondFood.name])
        let metrics = try loadMetrics(root)
        XCTAssertEqual(interactionCount(.logSaved, in: metrics), 2)
        XCTAssertEqual(interactionCount(.logSaveFailed, in: metrics), 0)
    }

    func testInjectedJournalDefaultsMetricsToSiblingSidecar() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let journalURL = root.appending(path: "journal.json")
        let metricsURL = root.appending(path: "interaction-metrics-v1.json")
        let model = AppModel(store: CalorieStore(fileURL: journalURL), mirror: nil, legacyJournal: nil)
        await model.load()

        let food = Food(name: "Synthetic bowl", servingName: "1 bowl",
                        nutrients: Nutrients(calories: 300, protein: 20, carbohydrates: 40, fibre: 5))
        let saved = await model.log(food, servings: 1, meal: .lunch, at: model.selectedDate)
        XCTAssertTrue(saved)

        XCTAssertTrue(FileManager.default.fileExists(atPath: metricsURL.path))
        let report = try JSONDecoder().decode(LocalInteractionReport.self, from: Data(contentsOf: metricsURL))
        XCTAssertEqual(interactionCount(.logSaved, in: report), 1)
    }

    func testFailedFoodSaveRetainsSheetAndReportsFailureUntilRetry() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let blocker = root.appending(path: "blocked")
        try Data("not a directory".utf8).write(to: blocker)
        let store = CalorieStore(fileURL: blocker.appending(path: "journal.json"))
        let model = makeModel(store: store, root: root)
        await model.load()
        model.isQuickLogPresented = true
        let food = Food(name: "Synthetic bowl", servingName: "1 bowl",
                        nutrients: Nutrients(calories: 300, protein: 20, carbohydrates: 40, fibre: 5))
        let failedSave = await model.log(food, servings: 1, meal: .lunch, at: model.selectedDate)
        XCTAssertFalse(failedSave)
        XCTAssertTrue(model.isQuickLogPresented)
        XCTAssertNotEqual(model.message, "Synthetic bowl added.")
        XCTAssertTrue(model.document.foodEntries.isEmpty)
        try FileManager.default.removeItem(at: blocker)
        let successfulSave = await model.log(food, servings: 1, meal: .lunch, at: model.selectedDate)
        XCTAssertTrue(successfulSave)
        let reloaded = try await store.load()
        XCTAssertFalse(model.isQuickLogPresented)
        XCTAssertEqual(reloaded.foodEntries.map(\.foodName), ["Synthetic bowl"])
        let metrics = try loadMetrics(root)
        XCTAssertEqual(metrics.projectId, "calorie")
        XCTAssertEqual(interactionCount(.logSaveFailed, in: metrics), 1)
        XCTAssertEqual(interactionCount(.logSaved, in: metrics), 1)
        XCTAssertTrue(metrics.days.allSatisfy { Set($0.counters.keys).isSubset(of: Set(LocalInteractionEvent.allCases.map(\.rawValue))) })
    }

    func testEntryEditSaveIsMeasuredAfterCommit() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let model = makeModel(store: CalorieStore(fileURL: root.appending(path: "journal.json")), root: root)
        await model.load()
        let food = Food(name: "Private fixture food", servingName: "1 serving",
                        nutrients: Nutrients(calories: 100, protein: 4, carbohydrates: 10, fibre: 2))
        _ = await model.log(food, servings: 1, meal: .lunch, at: .now)
        let entry = try XCTUnwrap(model.document.foodEntries.first)
        let editSaved = await model.update(entry, servings: 2, meal: .dinner, timestamp: entry.timestamp)
        XCTAssertTrue(editSaved)

        let metrics = try loadMetrics(root)
        XCTAssertEqual(interactionCount(.entryEditSaved, in: metrics), 1)
        let sidecarText = String(decoding: try Data(contentsOf: metricsURL(root)), as: UTF8.self)
        XCTAssertFalse(sidecarText.contains("Private fixture food"))
        XCTAssertFalse(sidecarText.contains(entry.id.uuidString))
        let reportObject = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(sidecarText.utf8)) as? [String: Any])
        XCTAssertEqual(Set(reportObject.keys), ["schemaVersion", "projectId", "coverageStartedAtISO", "updatedAtISO", "timeZoneIdentifier", "days"])
        let days = try XCTUnwrap(reportObject["days"] as? [[String: Any]])
        XCTAssertEqual(Set(try XCTUnwrap(days.first).keys), ["date", "counters", "durationTotalsSeconds", "durationSamples"])
    }

    func testMetricsSidecarFailureDoesNotBlockJournalSave() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let blocker = root.appending(path: "metrics-blocker")
        try Data("not a directory".utf8).write(to: blocker)
        let store = CalorieStore(fileURL: root.appending(path: "journal.json"))
        let model = AppModel(
            store: store,
            mirror: nil,
            legacyJournal: nil,
            interactionMetrics: LocalInteractionMetricsStore(fileURL: blocker.appending(path: "metrics.json"))
        )
        await model.load()
        let food = Food(name: "Fixture", servingName: "1 serving",
                        nutrients: Nutrients(calories: 100, protein: 4, carbohydrates: 10, fibre: 2))
        let logged = await model.log(food, servings: 1, meal: .lunch, at: .now)
        XCTAssertTrue(logged)
        let savedJournal = try await store.load()
        XCTAssertEqual(savedJournal.foodEntries.count, 1)
    }

    func testConcurrentWaterEntriesBothPersist() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = CalorieStore(fileURL: root.appending(path: "journal.json"))
        let model = makeModel(store: store, root: root)
        await model.load()
        async let first: Void = model.addWater(250)
        async let second: Void = model.addWater(400)
        _ = await (first, second)
        let reloaded = try await store.load()
        XCTAssertEqual(reloaded.waterEntries.count, 2)
        XCTAssertEqual(model.document.waterEntries.count, 2)
    }

    func testFailedLoadPreservesUnreadJournalAgainstLaterEdits() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let file = root.appending(path: "journal.json")
        let original = Data("unreadable retained food journal".utf8)
        try original.write(to: file)
        let model = makeModel(store: CalorieStore(fileURL: file), root: root)
        await model.load()
        await model.addWater(250)
        XCTAssertEqual(try Data(contentsOf: file), original)
    }

    func testFailedEditDeleteAndUndoPreserveCommittedEntry() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let file = root.appending(path: "journal.json")
        let backup = root.appending(path: "retained.json")
        let store = CalorieStore(fileURL: file)
        let model = makeModel(store: store, root: root)
        await model.load()
        let food = Food(name: "Synthetic bowl", servingName: "1 bowl",
                        nutrients: Nutrients(calories: 300, protein: 20, carbohydrates: 40, fibre: 5))
        await model.log(food, servings: 1, meal: .lunch, at: model.selectedDate)
        let entry = try XCTUnwrap(model.document.foodEntries.first)
        try FileManager.default.moveItem(at: file, to: backup)
        try FileManager.default.createDirectory(at: file, withIntermediateDirectories: true)
        let edited = await model.update(entry, servings: 2, meal: .dinner, timestamp: entry.timestamp)
        XCTAssertFalse(edited)
        let metrics = try loadMetrics(root)
        XCTAssertEqual(interactionCount(.entryEditSaveFailed, in: metrics), 1)
        XCTAssertEqual(model.document.foodEntries, [entry])
        await model.delete(entry)
        XCTAssertNil(model.lastDeletedEntry)
        XCTAssertEqual(model.document.foodEntries, [entry])
        try FileManager.default.removeItem(at: file)
        try FileManager.default.moveItem(at: backup, to: file)
        await model.delete(entry)
        XCTAssertEqual(model.lastDeletedEntry, entry)
        XCTAssertTrue(model.document.foodEntries.isEmpty)
        try FileManager.default.moveItem(at: file, to: backup)
        try FileManager.default.createDirectory(at: file, withIntermediateDirectories: true)
        await model.undoDelete()
        XCTAssertEqual(model.lastDeletedEntry, entry)
        XCTAssertTrue(model.document.foodEntries.isEmpty)
        XCTAssertNotNil(model.saveError)
        try FileManager.default.removeItem(at: file)
        try FileManager.default.moveItem(at: backup, to: file)
        await model.undoDelete()
        XCTAssertNil(model.lastDeletedEntry)
        XCTAssertNil(model.saveError)
        let reloaded = try await store.load()
        XCTAssertEqual(reloaded.foodEntries.map(\.id), [entry.id])
    }

    func testConfirmedBackupRecoversUnreadJournalAndAllowsLogging() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let file = root.appending(path: "journal.json")
        let original = Data("unreadable retained food journal".utf8)
        try original.write(to: file)
        let store = CalorieStore(fileURL: file)
        let model = makeModel(store: store, root: root)
        await model.load()
        XCTAssertFalse(model.hasLoadedDocument)
        let backup = try await store.export(.starter)
        await model.prepareImport(backup)
        XCTAssertTrue(model.isImportConfirmationPresented)
        XCTAssertEqual(try Data(contentsOf: file), original)
        await model.confirmImport()
        XCTAssertTrue(model.hasLoadedDocument)
        XCTAssertNil(model.importPreview)
        await model.addWater(250)
        let reloaded = try await store.load()
        XCTAssertEqual(reloaded.waterEntries.count, 1)
    }

    func testLocalLoadDoesNotCallOptionalAccountService() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let model = AppModel(
            store: CalorieStore(fileURL: root.appending(path: "journal.json")),
            mirror: nil,
            legacyJournal: nil,
            interactionMetrics: LocalInteractionMetricsStore(fileURL: root.appending(path: "interaction-metrics.json"))
        )
        await model.load()
        XCTAssertTrue(model.hasLoadedDocument)
        XCTAssertFalse(model.isLoading)
        XCTAssertNil(model.account)
        await model.restoreAccountAndSync()
        XCTAssertNil(model.account, "A local-only journal never reaches an account service")
    }

    func testBackdatedOneOffEditUpdatesNutrientsAndSurvivesReload() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = CalorieStore(fileURL: root.appending(path: "journal.json"))
        let model = makeModel(store: store, root: root)
        await model.load()
        let yesterday = try XCTUnwrap(Calendar.current.date(byAdding: .day, value: -1, to: model.selectedDate))
        let food = Food(name: "Synthetic one-off", servingName: "1 bowl",
                        nutrients: Nutrients(calories: 300, protein: 20, carbohydrates: 40, fibre: 5))
        await model.log(food, servings: 1, meal: .lunch, at: yesterday)
        XCTAssertTrue(model.selectedEntries.isEmpty)
        let entry = try XCTUnwrap(model.document.foodEntries.first)
        let saved = await model.update(entry, servings: 2, meal: .dinner, timestamp: yesterday)
        XCTAssertTrue(saved)
        let reloaded = try await store.load()
        XCTAssertTrue(reloaded.entries(on: model.selectedDate).isEmpty)
        XCTAssertEqual(reloaded.totals(on: yesterday).calories, 600)
        XCTAssertEqual(reloaded.totals(on: yesterday).protein, 40)
        XCTAssertEqual(reloaded.totals(on: yesterday).fibre, 10)
        XCTAssertEqual(reloaded.foodEntries.first?.meal, .dinner)
    }

    private func makeModel(store: CalorieStore, root: URL) -> AppModel {
        AppModel(
            store: store,
            mirror: nil,
            legacyJournal: nil,
            interactionMetrics: LocalInteractionMetricsStore(fileURL: metricsURL(root))
        )
    }

    private func metricsURL(_ root: URL) -> URL {
        root.appending(path: "interaction-metrics.json")
    }

    private func loadMetrics(_ root: URL) throws -> LocalInteractionReport {
        try JSONDecoder().decode(LocalInteractionReport.self, from: Data(contentsOf: metricsURL(root)))
    }

    private func interactionCount(_ event: LocalInteractionEvent, in report: LocalInteractionReport) -> Int {
        report.days.reduce(0) { $0 + ($1.counters[event.rawValue] ?? 0) }
    }

}
