import CalorieCore
import Foundation
import XCTest

@testable import Calorie

@MainActor
final class CalorieLocalSaveTests: XCTestCase {
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
        await model.log(food, servings: 1, meal: .lunch, at: model.selectedDate)
        XCTAssertTrue(model.isQuickLogPresented)
        XCTAssertNotEqual(model.message, "Synthetic bowl added.")
        XCTAssertTrue(model.document.foodEntries.isEmpty)
        try FileManager.default.removeItem(at: blocker)
        await model.log(food, servings: 1, meal: .lunch, at: model.selectedDate)
        let reloaded = try await store.load()
        XCTAssertFalse(model.isQuickLogPresented)
        XCTAssertEqual(reloaded.foodEntries.map(\.foodName), ["Synthetic bowl"])
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
        let client = LocalSaveNoAccountClient()
        let model = AppModel(store: CalorieStore(fileURL: root.appending(path: "journal.json")),
                             accountClient: client,
                             syncStore: SyncIntentStore(fileURL: root.appending(path: "sync.json")))
        await model.load()
        let callsAfterLocalLoad = await client.restoreCount
        XCTAssertTrue(model.hasLoadedDocument)
        XCTAssertFalse(model.isLoading)
        XCTAssertEqual(callsAfterLocalLoad, 0)
        await model.restoreAccountAndSync()
        let callsAfterAccountRestore = await client.restoreCount
        XCTAssertEqual(callsAfterAccountRestore, 1)
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
        AppModel(store: store, accountClient: LocalSaveNoAccountClient(),
                 syncStore: SyncIntentStore(fileURL: root.appending(path: "sync.json")))
    }
}

private actor LocalSaveNoAccountClient: NativeAccountServing {
    private(set) var restoreCount = 0
    var googleStartURL: URL { URL(string: "https://example.com")! }

    func restoreAccount() async throws -> CalorieAccount? {
        restoreCount += 1
        return nil
    }
    func exchangeGoogleHandoff(_: String) async throws -> CalorieAccount { throw CancellationError() }
    func signInWithApple(_: AppleIdentityPayload) async throws -> CalorieAccount { throw CancellationError() }
    func linkApple(_: AppleIdentityPayload) async throws -> CalorieAccount { throw CancellationError() }
    func cloudExport() async throws -> Data { Data() }
    func apply(_: SyncIntent) async throws {}
    func signOut() async {}
    func deleteAccount() async throws {}
}
