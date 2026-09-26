import CalorieCore
import Foundation
import PersonalSyncKit
import XCTest
@testable import Calorie

@MainActor
final class CalorieSyncCommitTests: XCTestCase {
    func testMirrorSnapshotCoversEverySyncableEntityWithFlatRecordTypes() async throws {
        let f = try CommitFixture()
        defer { f.cleanup() }
        await f.model.load()
        let food = Food(
            name: "Mirror bowl", servingName: "1 bowl",
            nutrients: Nutrients(calories: 400, protein: 20, carbohydrates: 40, fat: 10, fibre: 6)
        )
        await f.model.addCustomFood(food)
        await f.model.log(food, servings: 1, meal: .lunch, at: f.model.selectedDate)
        await f.model.addWater(500)

        let records = try await f.model.mirrorRecords()
        let names = Set(records.map(\.name))
        XCTAssertTrue(names.contains("food-\(food.id.uuidString.lowercased())"))
        XCTAssertEqual(names.filter { $0.hasPrefix("entry-") }.count, 1)
        XCTAssertEqual(names.filter { $0.hasPrefix("water-") }.count, 1)
        XCTAssertTrue(names.contains("profile-\(CalorieMirrorNaming.profileID)"))
        XCTAssertTrue(names.contains("theme-\(CalorieMirrorNaming.themeID)"))
        XCTAssertTrue(names.contains("cyclecontext-\(CalorieMirrorNaming.cycleContextID)"))

        let entry = try XCTUnwrap(records.first { $0.name.hasPrefix("entry-") })
        let fields = try XCTUnwrap(
            JSONSerialization.jsonObject(with: try XCTUnwrap(entry.payload)) as? [String: Any]
        )
        XCTAssertEqual(fields["recordType"] as? String, "foodEntry")
        XCTAssertEqual(fields["meal"] as? String, "Lunch")
        XCTAssertEqual(fields["foodName"] as? String, "Mirror bowl")
        XCTAssertNotNil(fields["timestamp"], "Hub-facing payloads carry the entity's ISO timestamp")
    }

    func testDisappearedEntitiesEmitTombstonesFromTheSharedLedger() async throws {
        let f = try CommitFixture()
        defer { f.cleanup() }
        await f.model.load()
        await f.model.addWater(300)
        let water = try XCTUnwrap(f.model.document.waterEntries.first)
        // First pass stamps the water record into the shared ledger.
        _ = try await f.runtime.synchronize(
            records: { try await f.model.mirrorRecords() },
            apply: { _ in }
        )
        // The deletion commits through the same apply path a pulled tombstone
        // takes, leaving the stamped name behind without its entity.
        try await f.model.commitMirrorRecords([
            MirrorRecord(name: "water-\(water.id.uuidString.lowercased())", modifiedAt: .now, payload: nil),
        ])
        let records = try await f.model.mirrorRecords()
        XCTAssertEqual(
            records.first(where: { $0.name == "water-\(water.id.uuidString.lowercased())" })?.isDeleted,
            true,
            "A stamped entity that left the journal must tombstone or the delete never travels"
        )
    }

    func testPulledRecordsApplyAcrossEveryEntityKindAndReplayIdempotently() async throws {
        let f = try CommitFixture()
        defer { f.cleanup() }
        var seeded = CalorieDocument()
        seeded.profile.onboardingComplete = true
        try await f.store.save(seeded)
        await f.model.load()

        let records = try CaloriePullFixture.records()
        try await f.model.commitMirrorRecords(records)
        try await f.model.commitMirrorRecords(records)

        XCTAssertEqual(f.model.document.foods.map(\.name), ["Pulled oats"])
        XCTAssertEqual(f.model.document.foodEntries.map(\.foodName), ["Pulled oats"])
        XCTAssertEqual(f.model.document.waterEntries.map(\.millilitres), [750])
        XCTAssertEqual(f.model.document.weightEntries.map(\.kilograms), [70.5])
        XCTAssertEqual(f.model.document.routines.map(\.name), ["Evening routine"])
        XCTAssertEqual(f.model.document.routineCheckIns.count, 1)
        XCTAssertEqual(f.model.document.goalCycleSessions?.map(\.kind), [.cut])
        XCTAssertEqual(f.model.document.profile.name, "Remote profile")
        XCTAssertEqual(f.model.document.cycle.typicalCycleDays, 28)
        XCTAssertEqual(f.model.document.theme, .dark)
        XCTAssertEqual(f.model.document.dailyNotes["2026-09-01"], "Pulled note")
        let persisted = try await f.store.load()
        XCTAssertEqual(persisted.foods.map(\.name), ["Pulled oats"])
        XCTAssertEqual(persisted.dailyNotes["2026-09-01"], "Pulled note")
    }

    func testPulledTombstonesRemoveEntitiesButNeverSingletons() async throws {
        let f = try CommitFixture()
        defer { f.cleanup() }
        await f.model.load()
        await f.model.addWater(600)
        let water = try XCTUnwrap(f.model.document.waterEntries.first)
        let profileBefore = f.model.document.profile

        try await f.model.commitMirrorRecords([
            MirrorRecord(name: "water-\(water.id.uuidString.lowercased())", modifiedAt: .now, payload: nil),
            MirrorRecord(name: "profile-\(CalorieMirrorNaming.profileID)", modifiedAt: .now, payload: nil),
            MirrorRecord(name: "theme-\(CalorieMirrorNaming.themeID)", modifiedAt: .now, payload: nil),
        ])

        XCTAssertTrue(f.model.document.waterEntries.isEmpty)
        XCTAssertEqual(f.model.document.profile, profileBefore, "A tombstone must never blank the profile")
        XCTAssertEqual(f.model.document.theme, .system, "A tombstone must never blank the appearance setting")
    }

    func testForeignRecordNamesNeverTouchTheDocument() async throws {
        let f = try CommitFixture()
        defer { f.cleanup() }
        await f.model.load()
        let before = f.model.document

        try await f.model.commitMirrorRecords([
            MirrorRecord(name: "hub-session", modifiedAt: .now, payload: Data("{}".utf8)),
            MirrorRecord(name: UUID().uuidString.lowercased(), modifiedAt: .now, payload: Data("{}".utf8)),
        ])
        XCTAssertEqual(f.model.document, before)
        let fileURL = await f.store.fileURL
        XCTAssertFalse(
            FileManager.default.fileExists(atPath: fileURL.path),
            "Records the journal does not own must not write it to disk"
        )
    }

    func testUnboundJournalDoesNotClaimApproval() async throws {
        let f = try CommitFixture()
        defer { f.cleanup() }
        var conflicted = CalorieDocument()
        conflicted.syncState = .conflict
        conflicted.cloudAccountID = "owner-1"
        try await f.store.save(conflicted)
        await f.model.load()
        // With no signed-in session there is nothing to approve against — and
        // approval must stay blocked rather than binding a nil owner.
        XCTAssertFalse(f.model.needsAccountApproval)
        XCTAssertFalse(f.model.isBoundToDifferentAccount)
        await f.model.approveCloudAccount()
        let stored = try await f.store.load()
        XCTAssertEqual(stored.cloudAccountID, "owner-1")
    }
}

@MainActor
private final class CommitFixture {
    let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
    let store: CalorieStore
    let runtime: MirrorRuntime
    let transport: FakeTransport
    let model: AppModel

    init() throws {
        store = CalorieStore(fileURL: root.appending(path: "journal.json"))
        transport = FakeTransport()
        runtime = MirrorRuntime(
            transports: [transport],
            store: MirrorBookkeepingStore(fileURL: root.appending(path: "sync/mirror.json"))
        )
        let identity = PersonalIdentityClient(
            baseURL: URL(string: "https://identity.invalid")!,
            tokenStore: MemoryBearerStore()
        )
        model = AppModel(
            store: store,
            mirror: PersonalMirrorConnection(
                identity: identity,
                runtime: runtime,
                account: PersonalAccountModel(
                    identity: identity,
                    callbackScheme: "calorie",
                    identityURL: URL(string: "https://identity.invalid")!
                )
            ),
            legacyJournal: nil
        )
    }

    func cleanup() {
        try? FileManager.default.removeItem(at: root)
    }
}

private actor FakeTransport: MirrorTransport {
    nonisolated let id = "fake"
    private(set) var remote: [MirrorRecord] = []

    func availability() -> MirrorAvailability { .available }
    func pull(since _: Data?) -> MirrorPullPage {
        MirrorPullPage(records: remote, nextToken: Data("1".utf8))
    }
    func push(_ records: [MirrorRecord]) throws {
        for record in records {
            remote.removeAll { $0.name == record.name }
            remote.append(record)
        }
    }
    func setRemote(_ records: [MirrorRecord]) { remote = records }
}

private actor MemoryBearerStore: PersonalBearerTokenStore {
    private var token: String?
    func load() -> String? { token }
    func save(_ token: String) { self.token = token }
    func delete() { token = nil }
}

private enum CaloriePullFixture {
    static let foodID = "11111111-1111-4111-8111-111111111111"
    static let entryID = "22222222-2222-4222-8222-222222222222"
    static let waterID = "33333333-3333-4333-8333-333333333333"
    static let weightID = "44444444-4444-4444-8444-444444444444"
    static let routineID = "55555555-5555-4555-8555-555555555555"
    static let checkInID = "66666666-6666-4666-8666-666666666666"
    static let cycleID = "77777777-7777-4777-8777-777777777777"

    static func records() throws -> [MirrorRecord] {
        let at = Date(timeIntervalSince1970: 1_790_000_000)
        func payload(_ json: String) -> Data { Data(json.utf8) }
        return [
            MirrorRecord(name: "food-\(foodID)", modifiedAt: at, payload: payload(#"{"recordType":"food","id":""# + foodID + #"","name":"Pulled oats","servingName":"1 bowl","servingGrams":60,"nutrients":{"calories":380,"protein":12,"carbohydrates":66,"fat":7,"fibre":9},"isFavorite":true,"isArchived":false,"isCustom":true}"#)),
            MirrorRecord(name: "entry-\(entryID)", modifiedAt: at, payload: payload(#"{"recordType":"foodEntry","id":""# + entryID + #"","foodID":""# + foodID + #"","foodName":"Pulled oats","meal":"Breakfast","timestamp":"2026-09-01T08:00:00Z","servings":1,"nutrients":{"calories":380,"protein":12,"carbohydrates":66,"fat":7,"fibre":9}}"#)),
            MirrorRecord(name: "water-\(waterID)", modifiedAt: at, payload: payload(#"{"recordType":"waterEntry","id":""# + waterID + #"","timestamp":"2026-09-01T09:00:00Z","millilitres":750}"#)),
            MirrorRecord(name: "weight-\(weightID)", modifiedAt: at, payload: payload(#"{"recordType":"weightEntry","id":""# + weightID + #"","date":"2026-09-01T07:00:00Z","kilograms":70.5}"#)),
            MirrorRecord(name: "routine-\(routineID)", modifiedAt: at, payload: payload(#"{"recordType":"routine","id":""# + routineID + #"","name":"Evening routine","period":"Evening","isArchived":false}"#)),
            MirrorRecord(name: "checkin-\(checkInID)", modifiedAt: at, payload: payload(#"{"recordType":"checkIn","id":""# + checkInID + #"","routineID":""# + routineID + #"","date":"2026-09-01T21:00:00Z"}"#)),
            MirrorRecord(name: "goalcycle-\(cycleID)", modifiedAt: at, payload: payload(#"{"recordType":"goalCycle","id":""# + cycleID + #"","kind":"cut","goal":"lose_gentle","startOn":"2026-09-01","createdAt":"2026-09-01T00:00:00Z","updatedAt":"2026-09-01T00:00:00Z"}"#)),
            MirrorRecord(name: "profile-\(CalorieMirrorNaming.profileID)", modifiedAt: at, payload: payload(#"{"recordType":"profile","name":"Remote profile","goal":"Maintain","activity":"Moderate","waterTargetMillilitres":2500}"#)),
            MirrorRecord(name: "cyclecontext-\(CalorieMirrorNaming.cycleContextID)", modifiedAt: at, payload: payload(#"{"recordType":"cycleContext","enabled":true,"typicalCycleDays":28}"#)),
            MirrorRecord(name: "theme-\(CalorieMirrorNaming.themeID)", modifiedAt: at, payload: payload(#"{"recordType":"theme","theme":"Dark"}"#)),
            MirrorRecord(name: "note-2026-09-01", modifiedAt: at, payload: payload(#"{"recordType":"dailyNote","date":"2026-09-01","text":"Pulled note"}"#)),
        ]
    }
}
