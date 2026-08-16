import XCTest
@testable import Calorie
import CalorieCore

final class NativeAccountTests: XCTestCase {
    func testNonceIsRandomAndUsesASHA256Digest() {
        let first = AppleNonce.make()
        let second = AppleNonce.make()

        XCTAssertEqual(first.count, 32)
        XCTAssertNotEqual(first, second)
        XCTAssertEqual(AppleNonce.digest(first).count, 64)
        XCTAssertNotEqual(AppleNonce.digest(first), first)
    }

    func testSessionRoundTripsOnlyThroughAnIsolatedKeychainItem() async throws {
        let service = "com.significanthobbies.calorie.tests.\(UUID().uuidString)"
        let store = KeychainSessionStore(service: service, account: "test-bearer")

        let initial = try await store.load()
        XCTAssertNil(initial)
        try await store.save("private-session-token")
        let saved = try await store.load()
        XCTAssertEqual(saved, "private-session-token")
        try await store.delete()
        let deleted = try await store.load()
        XCTAssertNil(deleted)
    }

    func testProfilePatchPreservesRequiredCloudFieldsForManualLocalProfiles() throws {
        let before = Profile(age: nil, heightCentimetres: nil, manualCalorieTarget: 2_100)
        var after = before
        after.waterTargetMillilitres = 3_000
        var body: [String: Any] = [
            "ageYears": 30,
            "heightCm": 175,
            "waterTargetMl": 2_500,
        ]

        try NativeProfilePatch.apply(from: before, to: after, body: &body)

        XCTAssertEqual(body["ageYears"] as? Int, 30)
        XCTAssertEqual(body["heightCm"] as? Int, 175)
        XCTAssertEqual(body["waterTargetMl"] as? Int, 3_000)
    }

    func testProfilePatchRejectsRemovingACloudRequiredField() {
        let before = Profile(age: 30, heightCentimetres: 175)
        var after = before
        after.age = nil
        var body: [String: Any] = ["ageYears": 30, "heightCm": 175]

        XCTAssertThrowsError(try NativeProfilePatch.apply(from: before, to: after, body: &body))
    }

    func testServerStateCacheReusesFreshValueAndRevalidatesStaleValue() async throws {
        let snapshot = try CloudJournalMapper.decode(Data(Self.cloudExport.utf8))
        let freshLoader = QueryLoader(snapshot: snapshot)
        let freshCache = ServerStateQueryCache<CloudJournalSnapshot>(staleAfter: 60)

        let first = try await freshCache.value { try await freshLoader.load() }
        let second = try await freshCache.value { try await freshLoader.load() }
        let freshRequestCount = await freshLoader.requestCount

        XCTAssertEqual(first.source, .network)
        XCTAssertEqual(second.source, .cache)
        XCTAssertEqual(freshRequestCount, 1)

        let staleLoader = QueryLoader(snapshot: snapshot)
        let staleCache = ServerStateQueryCache<CloudJournalSnapshot>(staleAfter: 0)
        _ = try await staleCache.value { try await staleLoader.load() }
        _ = try await staleCache.value { try await staleLoader.load() }
        let staleRequestCount = await staleLoader.requestCount

        XCTAssertEqual(staleRequestCount, 2)
    }

    func testServerStateCacheDeduplicatesConcurrentRequests() async throws {
        let snapshot = try CloudJournalMapper.decode(Data(Self.cloudExport.utf8))
        let loader = QueryLoader(snapshot: snapshot, delay: .milliseconds(50))
        let cache = ServerStateQueryCache<CloudJournalSnapshot>()

        async let first = cache.value { try await loader.load() }
        async let second = cache.value { try await loader.load() }
        let (firstResult, secondResult) = try await (first, second)
        let requestCount = await loader.requestCount

        XCTAssertEqual([firstResult.value, secondResult.value], [snapshot, snapshot])
        XCTAssertEqual(requestCount, 1)
    }

    func testServerStateCacheInvalidationAndClearingRequireARefetch() async throws {
        let snapshot = try CloudJournalMapper.decode(Data(Self.cloudExport.utf8))
        let loader = QueryLoader(snapshot: snapshot)
        let cache = ServerStateQueryCache<CloudJournalSnapshot>()

        _ = try await cache.value { try await loader.load() }
        await cache.invalidate()
        _ = try await cache.value { try await loader.load() }
        let invalidatedRequestCount = await loader.requestCount
        XCTAssertEqual(invalidatedRequestCount, 2)

        await cache.clear()
        let clearedValue = await cache.cachedValue()
        XCTAssertNil(clearedValue)
        _ = try await cache.value { try await loader.load() }
        let clearedRequestCount = await loader.requestCount
        XCTAssertEqual(clearedRequestCount, 3)
    }

    @MainActor
    func testRestoredGoogleAccountCanReconcileWithoutApple() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let syncStore = SyncIntentStore(fileURL: directory.appending(path: "sync.json"))
        try await store.save(.starter)
        let client = StubNativeAccountClient(exportData: Data(Self.cloudExport.utf8))
        let model = AppModel(store: store, accountClient: client, syncStore: syncStore)

        await model.load()

        XCTAssertEqual(model.account?.providers, ["google"])
        XCTAssertEqual(model.document.syncState, .conflict)
        XCTAssertTrue(model.isReconciliationPresented)
    }

    @MainActor
    func testAuthenticatedLoadPullsLatestCloudJournal() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let syncStore = SyncIntentStore(fileURL: directory.appending(path: "sync.json"))
        var local = CalorieDocument.starter
        local.syncState = .synced
        try await store.save(local)
        let client = StubNativeAccountClient(exportData: Data(Self.cloudExport.utf8))
        let model = AppModel(store: store, accountClient: client, syncStore: syncStore)

        await model.load()

        XCTAssertEqual(model.document.foods.map(\.name), ["Cloud oats"])
        XCTAssertEqual(model.document.syncState, .synced)
        XCTAssertNotNil(model.document.lastSyncedAt)
        XCTAssertTrue(model.guidance.first(where: { $0.id == "sleep" })?.explanation.contains("22:00") == true)
        XCTAssertFalse(model.isReconciliationPresented)
    }

    @MainActor
    func testForegroundRefreshPullsChangesMadeByTheWebsite() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let syncStore = SyncIntentStore(fileURL: directory.appending(path: "sync.json"))
        var local = CalorieDocument.starter
        local.syncState = .synced
        try await store.save(local)
        let client = StubNativeAccountClient(exportData: Data(Self.cloudExport.utf8))
        let model = AppModel(
            store: store,
            accountClient: client,
            syncStore: syncStore,
            cloudQuery: ServerStateQueryCache(staleAfter: 0)
        )
        await model.load()
        let changed = Self.cloudExport.replacingOccurrences(of: "Cloud oats", with: "Website oats")
        await client.setExportData(Data(changed.utf8))

        await model.refreshFromCloud()

        XCTAssertEqual(model.document.foods.map(\.name), ["Website oats"])
    }

    @MainActor
    func testForegroundRefreshReusesFreshStateAndExplicitSyncRevalidates() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let syncStore = SyncIntentStore(fileURL: directory.appending(path: "sync.json"))
        var local = CalorieDocument.starter
        local.syncState = .synced
        try await store.save(local)
        let client = StubNativeAccountClient(exportData: Data(Self.cloudExport.utf8))
        let model = AppModel(store: store, accountClient: client, syncStore: syncStore)
        await model.load()
        let changed = Self.cloudExport.replacingOccurrences(of: "Cloud oats", with: "Website oats")
        await client.setExportData(Data(changed.utf8))

        await model.refreshFromCloud()
        let freshExportRequestCount = await client.exportRequestCount

        XCTAssertEqual(model.document.foods.map(\.name), ["Cloud oats"])
        XCTAssertEqual(freshExportRequestCount, 1)

        await model.syncNow()
        let refreshedExportRequestCount = await client.exportRequestCount

        XCTAssertEqual(model.document.foods.map(\.name), ["Website oats"])
        XCTAssertEqual(refreshedExportRequestCount, 2)
    }

    @MainActor
    func testConnectedMutationInvalidatesThenRevalidatesCloudState() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let syncStore = SyncIntentStore(fileURL: directory.appending(path: "sync.json"))
        var local = CalorieDocument.starter
        local.syncState = .synced
        try await store.save(local)
        let client = StubNativeAccountClient(exportData: Data(Self.cloudExport.utf8))
        let model = AppModel(store: store, accountClient: client, syncStore: syncStore)
        await model.load()
        var profile = model.document.profile
        profile.waterTargetMillilitres += 250

        await model.updateProfile(profile)
        let applyRequestCount = await client.applyRequestCount
        let exportRequestCount = await client.exportRequestCount

        XCTAssertEqual(applyRequestCount, 1)
        XCTAssertEqual(exportRequestCount, 2)
    }

    @MainActor
    func testSignOutClearsPrivateCachedServerState() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let syncStore = SyncIntentStore(fileURL: directory.appending(path: "sync.json"))
        var local = CalorieDocument.starter
        local.syncState = .synced
        try await store.save(local)
        let client = StubNativeAccountClient(exportData: Data(Self.cloudExport.utf8))
        let cache = ServerStateQueryCache<CloudJournalSnapshot>()
        let model = AppModel(
            store: store,
            accountClient: client,
            syncStore: syncStore,
            cloudQuery: cache
        )
        await model.load()
        let cachedBeforeSignOut = await cache.cachedValue()

        XCTAssertNotNil(cachedBeforeSignOut)

        await model.signOut()
        let cachedAfterSignOut = await cache.cachedValue()

        XCTAssertNil(cachedAfterSignOut)
        XCTAssertNil(model.account)
        XCTAssertEqual(model.document.syncState, .localOnly)
    }

    private static let cloudExport = #"""
    {
      "schema": "calorie-journal-backup",
      "version": 2,
      "generatedAt": "2026-08-16T00:00:00.000Z",
      "profile": {
        "displayName": "Cloud owner",
        "ageYears": 30,
        "equationProfile": "male",
        "heightCm": 175,
        "activityLevel": "moderate",
        "goal": "maintain",
        "manualCalorieTarget": 2100,
        "wakeTime": "06:00",
        "sleepHours": 8,
        "fastingThresholdHours": 14,
        "waterTargetMl": 2500
      },
      "foods": [{
        "id": "1C067674-001A-4C22-A14F-7CAAEAFBB531",
        "name": "Cloud oats",
        "servingMode": "per_unit",
        "unitLabel": "1 bowl",
        "defaultAmount": 1,
        "calories": 400,
        "carbsG": 60,
        "proteinG": 20,
        "fibreG": 8,
        "favourite": true,
        "archivedAt": null
      }],
      "entries": [],
      "waterEntries": [],
      "medications": [],
      "medicationCheckIns": [],
      "weights": [],
      "cycleSessions": []
    }
    """#
}

private actor StubNativeAccountClient: NativeAccountServing {
    var exportData: Data
    private(set) var exportRequestCount = 0
    private(set) var applyRequestCount = 0

    init(exportData: Data) {
        self.exportData = exportData
    }

    var googleStartURL: URL { URL(string: "https://example.com/google")! }

    func restoreAccount() async throws -> CalorieAccount? {
        CalorieAccount(name: "Cloud owner", email: "owner@example.com", providers: ["google"])
    }

    func exchangeGoogleHandoff(_: String) async throws -> CalorieAccount {
        CalorieAccount(name: "Cloud owner", email: "owner@example.com", providers: ["google"])
    }

    func signInWithApple(_: AppleIdentityPayload) async throws -> CalorieAccount {
        CalorieAccount(name: "Cloud owner", email: "owner@example.com", providers: ["apple"])
    }

    func linkApple(_: AppleIdentityPayload) async throws -> CalorieAccount {
        CalorieAccount(name: "Cloud owner", email: "owner@example.com", providers: ["apple", "google"])
    }

    func cloudExport() async throws -> Data {
        exportRequestCount += 1
        return exportData
    }
    func setExportData(_ data: Data) { exportData = data }
    func apply(_: SyncIntent) async throws { applyRequestCount += 1 }
    func signOut() async {}
    func deleteAccount() async throws {}
}

private actor QueryLoader {
    let snapshot: CloudJournalSnapshot
    let delay: Duration?
    private(set) var requestCount = 0

    init(snapshot: CloudJournalSnapshot, delay: Duration? = nil) {
        self.snapshot = snapshot
        self.delay = delay
    }

    func load() async throws -> CloudJournalSnapshot {
        requestCount += 1
        if let delay { try await Task.sleep(for: delay) }
        return snapshot
    }
}
