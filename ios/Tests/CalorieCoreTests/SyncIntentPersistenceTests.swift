import XCTest
@testable import CalorieCore

final class SyncIntentPersistenceTests: XCTestCase {
    func testFailedCompactionPreservesThePriorIntent() async throws {
        try await withBlockedWrite { store, before in
            do {
                try await store.enqueue(.upsertWaterEntry(WaterEntry(
                    id: Self.waterID, timestamp: Self.timestamp, millilitres: 500)))
                XCTFail("The blocked write must fail")
            } catch { }
            let pending = try await store.pending()
            XCTAssertEqual(pending, before)
        }
    }

    func testFailedAcknowledgementRetainsPendingWork() async throws {
        try await withBlockedWrite { store, before in
            do {
                try await store.complete(try XCTUnwrap(before.first?.id))
                XCTFail("The blocked write must fail")
            } catch { }
            let pending = try await store.pending()
            XCTAssertEqual(pending, before)
        }
    }

    func testFailedClearRetainsPendingWork() async throws {
        try await withBlockedWrite { store, before in
            do {
                try await store.removeAll()
                XCTFail("The blocked write must fail")
            } catch { }
            let pending = try await store.pending()
            XCTAssertEqual(pending, before)
        }
    }

    func testUnreadableQueueKeepsFailingUntilRepaired() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let file = root.appending(path: "intents.json")
        let original = Data("unread synthetic queue".utf8)
        try original.write(to: file)
        let store = SyncIntentStore(fileURL: file)
        for _ in 0..<2 {
            do {
                _ = try await store.pending()
                XCTFail("An unread queue must not become an empty queue on retry")
            } catch { }
        }
        do {
            try await store.enqueue(.deleteFoodEntry(UUID()))
            XCTFail("An unread queue must not be overwritten by a new edit")
        } catch { }
        XCTAssertEqual(try Data(contentsOf: file), original)
        let repaired = SyncIntentStore(fileURL: root.appending(path: "repaired.json"))
        try await repaired.enqueue(.upsertWaterEntry(WaterEntry(
            id: Self.waterID, timestamp: Self.timestamp, millilitres: 250)))
        let expected = try await repaired.pending()
        try Data(contentsOf: root.appending(path: "repaired.json")).write(to: file)
        let retry = try await store.pending()
        XCTAssertEqual(retry.map(\.id), expected.map(\.id))
        XCTAssertEqual(retry.map(\.operation), expected.map(\.operation))
    }

    private func withBlockedWrite(
        _ exercise: (SyncIntentStore, [SyncIntent]) async throws -> Void
    ) async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let file = root.appending(path: "intents.json")
        let backup = root.appending(path: "retained.json")
        let store = SyncIntentStore(fileURL: file)
        try await store.enqueue(.upsertWaterEntry(WaterEntry(
            id: Self.waterID, timestamp: Self.timestamp, millilitres: 250)))
        let before = try await store.pending()
        let bytes = try Data(contentsOf: file)
        try FileManager.default.moveItem(at: file, to: backup)
        try FileManager.default.createDirectory(at: file, withIntermediateDirectories: false)
        try await exercise(store, before)
        XCTAssertEqual(try Data(contentsOf: backup), bytes)
        try FileManager.default.removeItem(at: file)
        try FileManager.default.moveItem(at: backup, to: file)
        let reopened = try await SyncIntentStore(fileURL: file).pending()
        XCTAssertEqual(reopened.map(\.id), before.map(\.id))
        XCTAssertEqual(reopened.map(\.operation), before.map(\.operation))
        try await store.complete(try XCTUnwrap(before.first?.id))
        let final = try await SyncIntentStore(fileURL: file).pending()
        XCTAssertTrue(final.isEmpty)
    }

    private static let waterID = UUID(uuidString: "11111111-1111-1111-1111-111111111111")!
    private static let timestamp = Date(timeIntervalSince1970: 1_700_000_000)
}
