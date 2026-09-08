import XCTest
@testable import Calorie
import CalorieCore
import PersonalSyncKit

final class NativeAccountTests: XCTestCase {
    @MainActor
    func testLegacyAndDifferentOwnerQueuesRequireChoiceAndNeverReplayAutomatically() async throws {
        for owner in [nil, "another-owner"] as [String?] {
            let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
            defer { try? FileManager.default.removeItem(at: directory) }
            let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
            let queue = SyncIntentStore(fileURL: directory.appending(path: "sync.json"))
            var local = CalorieDocument.starter
            local.cloudAccountID = owner
            local.syncState = .pending
            try await store.save(local)
            try await queue.enqueue(.deleteFoodEntry(UUID()))
            let client = StubNativeAccountClient(exportData: Data(Self.cloudExport.utf8))
            let model = AppModel(store: store, accountClient: client, syncStore: queue)
            await model.load()
            await model.restoreAccountAndSync()
            let appliedBeforeChoice = await client.applyRequestCount
            let queuedBeforeChoice = try await queue.pending()
            XCTAssertEqual(appliedBeforeChoice, 0)
            XCTAssertEqual(queuedBeforeChoice.count, 1)
            XCTAssertEqual(model.document.foods, local.foods)
            XCTAssertEqual(model.document.cloudAccountID, owner)
            XCTAssertTrue(model.isReconciliationPresented)

            await model.reconcileJournal(.keepCloud)
            let remaining = try await queue.pending()
            XCTAssertTrue(remaining.isEmpty, "Discard stale operations before adopting another account")
            XCTAssertEqual(model.document.cloudAccountID, "synthetic-owner")
            XCTAssertEqual(model.document.foods.map(\.name), ["Cloud oats"])
            let reopened = AppModel(store: store, accountClient: client, syncStore: queue)
            await reopened.load()
            await reopened.restoreAccountAndSync()
            XCTAssertEqual(reopened.document.cloudAccountID, "synthetic-owner")
            XCTAssertFalse(reopened.isReconciliationPresented)
        }
    }

    @MainActor
    func testLateCloudResponseAfterSignOutCannotReplaceLocalJournal() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let queue = SyncIntentStore(fileURL: directory.appending(path: "sync.json"))
        var local = CalorieDocument.starter
        local.cloudAccountID = "synthetic-owner"
        local.syncState = .synced
        try await store.save(local)
        let client = StubNativeAccountClient(exportData: Data(Self.cloudExport.utf8))
        let model = AppModel(store: store, accountClient: client, syncStore: queue)
        await model.load()
        await model.restoreAccountAndSync()
        let expectedFoods = model.document.foods
        await client.setExportData(Data(Self.cloudExport.replacingOccurrences(of: "Cloud oats", with: "Late old-account oats").utf8))
        await client.holdNextExport()
        let sync = Task { await model.syncNow() }
        await client.waitUntilExportHeld()
        await model.signOut()
        await client.releaseExport()
        await sync.value
        XCTAssertNil(model.account)
        XCTAssertEqual(model.document.foods, expectedFoods)
        XCTAssertEqual(model.document.syncState, .localOnly)
        let persisted = try await store.load()
        XCTAssertEqual(persisted.foods, expectedFoods)
        XCTAssertEqual(persisted.syncState, .localOnly)
    }

    @MainActor
    func testOldQueueReceiptCannotAcknowledgeWorkAfterAnotherAccountConnects() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let queue = SyncIntentStore(fileURL: directory.appending(path: "sync.json"))
        var local = CalorieDocument.starter
        local.cloudAccountID = "synthetic-owner"
        local.syncState = .synced
        try await store.save(local)
        let client = StubNativeAccountClient(exportData: Data(Self.cloudExport.utf8))
        let model = AppModel(store: store, accountClient: client, syncStore: queue)
        await model.load()
        await model.restoreAccountAndSync()
        try await queue.enqueue(.deleteFoodEntry(UUID()))
        let original = try await queue.pending()
        await client.holdNextApply()
        let sync = Task { await model.syncNow() }
        await client.waitUntilApplyHeld()
        await model.signOut()
        await client.setUserID("synthetic-second-owner")
        await model.restoreAccountAndSync()
        await client.releaseApply()
        await sync.value
        let remaining = try await queue.pending()
        XCTAssertEqual(remaining.map(\.id), original.map(\.id))
        XCTAssertEqual(model.account?.userID, "synthetic-second-owner")
        XCTAssertEqual(model.document.cloudAccountID, "synthetic-owner")
        XCTAssertEqual(model.document.syncState, .conflict)
        XCTAssertTrue(model.isReconciliationPresented)
    }

    @MainActor
    func testKeepingOrMergingDeviceJournalRebuildsQueueForChosenAccount() async throws {
        for choice in [JournalReconciliationChoice.keepIPhone, .merge] {
            let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
            defer { try? FileManager.default.removeItem(at: directory) }
            let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
            let queue = SyncIntentStore(fileURL: directory.appending(path: "sync.json"))
            var local = CalorieDocument.starter
            local.cloudAccountID = "previous-owner"
            local.syncState = .pending
            try await store.save(local)
            try await queue.enqueue(.deleteFoodEntry(UUID()))
            let staleIDs = Set(try await queue.pending().map(\.id))
            let client = StubNativeAccountClient(exportData: Data(Self.cloudExport.utf8))
            let model = AppModel(store: store, accountClient: client, syncStore: queue)
            await model.load()
            await model.restoreAccountAndSync()
            await client.holdNextApply()
            await model.reconcileJournal(choice)
            await client.waitUntilApplyHeld()
            let rebuilt = try await queue.pending()
            XCTAssertFalse(rebuilt.isEmpty)
            XCTAssertTrue(staleIDs.isDisjoint(with: rebuilt.map(\.id)))
            XCTAssertEqual(model.document.cloudAccountID, "synthetic-owner")
            let persisted = try await store.load()
            XCTAssertEqual(persisted.cloudAccountID, "synthetic-owner")
            // Invalidate the replay before releasing the synthetic server reply.
            await model.signOut()
            await client.releaseApply()
            for _ in 0..<100 where model.isSyncing { await Task.yield() }
            XCTAssertFalse(model.isSyncing)
        }
    }

    func testJournalWithoutOwnershipFieldDecodesAndOwnershipRoundTrips() throws {
        let encoder = JSONEncoder()
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: encoder.encode(CalorieDocument.starter)) as? [String: Any])
        json.removeValue(forKey: "cloudAccountID")
        var document = try JSONDecoder().decode(CalorieDocument.self, from: JSONSerialization.data(withJSONObject: json))
        XCTAssertNil(document.cloudAccountID)
        document.cloudAccountID = "stable-owner"
        let reopened = try JSONDecoder().decode(CalorieDocument.self, from: encoder.encode(document))
        XCTAssertEqual(reopened.cloudAccountID, "stable-owner")
    }

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
        let store = KeychainBearerTokenStore(service: service, account: "test-bearer")

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
        await model.restoreAccountAndSync()

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
        local.cloudAccountID = "synthetic-owner"
        local.syncState = .synced
        try await store.save(local)
        let client = StubNativeAccountClient(exportData: Data(Self.cloudExport.utf8))
        let model = AppModel(store: store, accountClient: client, syncStore: syncStore)

        await model.load()
        await model.restoreAccountAndSync()

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
        local.cloudAccountID = "synthetic-owner"
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
        await model.restoreAccountAndSync()
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
        local.cloudAccountID = "synthetic-owner"
        local.syncState = .synced
        try await store.save(local)
        let client = StubNativeAccountClient(exportData: Data(Self.cloudExport.utf8))
        let model = AppModel(store: store, accountClient: client, syncStore: syncStore)
        await model.load()
        await model.restoreAccountAndSync()
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
        local.cloudAccountID = "synthetic-owner"
        local.syncState = .synced
        try await store.save(local)
        let client = StubNativeAccountClient(exportData: Data(Self.cloudExport.utf8))
        let model = AppModel(store: store, accountClient: client, syncStore: syncStore)
        await model.load()
        await model.restoreAccountAndSync()
        var profile = model.document.profile
        profile.waterTargetMillilitres += 250

        await model.updateProfile(profile)
        XCTAssertEqual(model.document.profile.waterTargetMillilitres, profile.waterTargetMillilitres)
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: .seconds(3))
        while await client.exportRequestCount < 2, clock.now < deadline {
            try await Task.sleep(for: .milliseconds(10))
        }
        let applyRequestCount = await client.applyRequestCount
        let exportRequestCount = await client.exportRequestCount

        XCTAssertEqual(applyRequestCount, 1)
        XCTAssertEqual(exportRequestCount, 2)
    }

    @MainActor
    func testFailedSyncQueueCannotOverwriteCommittedLocalChange() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let blocker = directory.appending(path: "blocked")
        let syncStore = SyncIntentStore(fileURL: blocker.appending(path: "sync.json"))
        var local = CalorieDocument.starter
        local.cloudAccountID = "synthetic-owner"
        local.syncState = .synced
        try await store.save(local)
        let client = StubNativeAccountClient(exportData: Data(Self.cloudExport.utf8))
        let model = AppModel(store: store, accountClient: client, syncStore: syncStore)
        await model.load()
        await model.restoreAccountAndSync()
        try Data("not a directory".utf8).write(to: blocker)
        var profile = model.document.profile
        profile.waterTargetMillilitres += 250
        let saved = await model.updateProfile(profile)
        XCTAssertTrue(saved, "The local journal committed even though its outbox failed")
        XCTAssertEqual(model.document.syncState, .conflict)
        await model.syncNow()
        let reloaded = try await store.load()
        XCTAssertEqual(reloaded.profile.waterTargetMillilitres, profile.waterTargetMillilitres)
        XCTAssertTrue(model.isReconciliationPresented)
        XCTAssertEqual(reloaded.syncState, .conflict)

        // Recover a journal left pending by an earlier build whose outbox
        // never reached disk. Restoring an account must not discard it.
        var interrupted = reloaded
        interrupted.syncState = .pending
        try await store.save(interrupted)
        let reopened = AppModel(store: store, accountClient: client,
                                syncStore: SyncIntentStore(fileURL: blocker.appending(path: "sync.json")))
        await reopened.load()
        await reopened.restoreAccountAndSync()
        XCTAssertEqual(reopened.document.profile.waterTargetMillilitres, profile.waterTargetMillilitres)
        XCTAssertEqual(reopened.document.syncState, .conflict)
        XCTAssertTrue(reopened.isReconciliationPresented)

        var backup = reopened.document
        backup.profile.waterTargetMillilitres += 250
        backup.syncState = .synced
        let data = try await store.export(backup)
        await reopened.prepareImport(data)
        await reopened.confirmImport()
        XCTAssertFalse(reopened.isImportConfirmationPresented)
        XCTAssertEqual(reopened.document.syncState, .conflict)
        await reopened.syncNow()
        let imported = try await store.load()
        XCTAssertEqual(imported.profile.waterTargetMillilitres, backup.profile.waterTargetMillilitres)
        XCTAssertTrue(reopened.isReconciliationPresented)
    }

    @MainActor
    func testSignOutClearsPrivateCachedServerState() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let syncStore = SyncIntentStore(fileURL: directory.appending(path: "sync.json"))
        var local = CalorieDocument.starter
        local.cloudAccountID = "synthetic-owner"
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
        await model.restoreAccountAndSync()
        let cachedBeforeSignOut = await cache.cachedValue()

        XCTAssertNotNil(cachedBeforeSignOut)

        await model.signOut()
        let cachedAfterSignOut = await cache.cachedValue()

        XCTAssertNil(cachedAfterSignOut)
        XCTAssertNil(model.account)
        XCTAssertEqual(model.document.syncState, .localOnly)
    }

    @MainActor
    func testUnclaimedAppleAccountReturnsToGoogleRecoveryWithoutChangingLocalJournal() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let syncStore = SyncIntentStore(fileURL: directory.appending(path: "sync.json"))
        var local = CalorieDocument.starter
        local.profile.manualCalorieTarget = 2_345
        try await store.save(local)
        let client = UnclaimedAppleAccountClient()
        let model = AppModel(store: store, accountClient: client, syncStore: syncStore)
        await model.load()
        await model.restoreAccountAndSync()

        await model.completeAppleSignIn(
            AppleIdentityPayload(
                identityToken: "identity-token",
                nonce: "nonce"
            )
        )

        XCTAssertNil(model.account)
        XCTAssertEqual(model.document.profile.manualCalorieTarget, 2_345)
        XCTAssertEqual(model.document.syncState, .localOnly)
        XCTAssertTrue(model.message?.contains("not linked") == true)
        XCTAssertTrue(model.accountNotice?.contains("Google first") == true)
        let didSignOut = await client.didSignOut
        XCTAssertTrue(didSignOut)
    }

    @MainActor
    func testRecoveredGoogleAccountStaysConnectedUntilAppleIsLinked() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let store = CalorieStore(fileURL: directory.appending(path: "journal.json"))
        let syncStore = SyncIntentStore(fileURL: directory.appending(path: "sync.json"))
        var local = CalorieDocument.starter
        local.profile.manualCalorieTarget = 2_345
        try await store.save(local)
        let client = RestoredUnlinkedGoogleAccountClient()
        let model = AppModel(store: store, accountClient: client, syncStore: syncStore)

        await model.load()
        await model.restoreAccountAndSync()

        XCTAssertEqual(model.account?.email, "owner@example.com")
        XCTAssertEqual(model.account?.hasApple, false)
        XCTAssertEqual(model.document.profile.manualCalorieTarget, 2_345)
        XCTAssertEqual(model.document.syncState, .localOnly)
        XCTAssertTrue(model.message?.contains("Add Sign in with Apple") == true)
        XCTAssertTrue(model.accountNotice?.contains("Existing Calorie account connected") == true)
        let didSignOut = await client.didSignOut
        XCTAssertFalse(didSignOut)
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
    func journal(for userID: String) async throws -> any NativeJournalServing { self }

    private var userID = "synthetic-owner"
    func setUserID(_ value: String) { userID = value }
    private var shouldHoldApply = false
    private var applyRelease: CheckedContinuation<Void, Never>?
    private var applyWaiter: CheckedContinuation<Void, Never>?
    func holdNextApply() { shouldHoldApply = true }
    func waitUntilApplyHeld() async {
        if applyRelease != nil { return }
        await withCheckedContinuation { applyWaiter = $0 }
    }
    func releaseApply() { applyRelease?.resume(); applyRelease = nil }
    var exportData: Data
    private(set) var exportRequestCount = 0
    private(set) var applyRequestCount = 0
    private var shouldHoldExport = false
    private var exportRelease: CheckedContinuation<Void, Never>?
    private var exportWaiter: CheckedContinuation<Void, Never>?
    func holdNextExport() { shouldHoldExport = true }
    func waitUntilExportHeld() async {
        if exportRelease != nil { return }
        await withCheckedContinuation { exportWaiter = $0 }
    }
    func releaseExport() { exportRelease?.resume(); exportRelease = nil }

    init(exportData: Data) {
        self.exportData = exportData
    }

    var googleStartURL: URL { URL(string: "https://example.com/google")! }

    func restoreAccount() async throws -> CalorieAccount? {
        CalorieAccount(userID: userID, name: "Cloud owner", email: "owner@example.com", providers: ["google"])
    }

    func exchangeGoogleHandoff(_: String) async throws -> CalorieAccount {
        CalorieAccount(userID: userID, name: "Cloud owner", email: "owner@example.com", providers: ["google"])
    }

    func signInWithApple(_: AppleIdentityPayload) async throws -> CalorieAccount {
        CalorieAccount(userID: userID, name: "Cloud owner", email: "owner@example.com", providers: ["apple"])
    }

    func linkApple(_: AppleIdentityPayload) async throws -> CalorieAccount {
        CalorieAccount(userID: userID, name: "Cloud owner", email: "owner@example.com", providers: ["apple", "google"])
    }

    func cloudExport() async throws -> Data {
        exportRequestCount += 1
        let result = exportData
        if shouldHoldExport {
            shouldHoldExport = false
            await withCheckedContinuation {
                exportRelease = $0
                exportWaiter?.resume()
                exportWaiter = nil
            }
        }
        return result
    }
    func setExportData(_ data: Data) { exportData = data }
    func apply(_: SyncIntent) async throws {
        applyRequestCount += 1
        if shouldHoldApply {
            shouldHoldApply = false
            await withCheckedContinuation {
                applyRelease = $0
                applyWaiter?.resume()
                applyWaiter = nil
            }
        }
    }
    func signOut() async {}
    func deleteAccount() async throws {}
}

private actor UnclaimedAppleAccountClient: NativeAccountServing {
    func journal(for userID: String) async throws -> any NativeJournalServing { self }

    private(set) var didSignOut = false

    var googleStartURL: URL { URL(string: "https://example.com/google")! }

    func restoreAccount() async throws -> CalorieAccount? { nil }
    func exchangeGoogleHandoff(_: String) async throws -> CalorieAccount {
        CalorieAccount(userID: "synthetic-owner", name: "Cloud owner", email: "owner@example.com", providers: ["google"])
    }
    func signInWithApple(_: AppleIdentityPayload) async throws -> CalorieAccount {
        CalorieAccount(userID: "synthetic-owner", name: "Cloud owner", email: "owner@example.com", providers: ["apple"])
    }
    func linkApple(_: AppleIdentityPayload) async throws -> CalorieAccount {
        CalorieAccount(userID: "synthetic-owner", name: "Cloud owner", email: "owner@example.com", providers: ["apple", "google"])
    }
    func cloudExport() async throws -> Data {
        throw NativeAccountError.http(
            status: 403,
            code: "CALORIE_LINK_REQUIRED",
            message: "Link the existing Calorie account with Sign in with Apple once."
        )
    }
    func apply(_: SyncIntent) async throws {}
    func signOut() async { didSignOut = true }
    func deleteAccount() async throws {}
}

private actor RestoredUnlinkedGoogleAccountClient: NativeAccountServing {
    func journal(for userID: String) async throws -> any NativeJournalServing { self }

    private(set) var didSignOut = false

    var googleStartURL: URL { URL(string: "https://example.com/google")! }

    func restoreAccount() async throws -> CalorieAccount? {
        CalorieAccount(userID: "synthetic-owner", name: "Cloud owner", email: "owner@example.com", providers: ["google"])
    }
    func exchangeGoogleHandoff(_: String) async throws -> CalorieAccount {
        CalorieAccount(userID: "synthetic-owner", name: "Cloud owner", email: "owner@example.com", providers: ["google"])
    }
    func signInWithApple(_: AppleIdentityPayload) async throws -> CalorieAccount {
        CalorieAccount(userID: "synthetic-owner", name: "Cloud owner", email: "owner@example.com", providers: ["apple"])
    }
    func linkApple(_: AppleIdentityPayload) async throws -> CalorieAccount {
        CalorieAccount(userID: "synthetic-owner", name: "Cloud owner", email: "owner@example.com", providers: ["apple", "google"])
    }
    func cloudExport() async throws -> Data {
        throw NativeAccountError.http(
            status: 403,
            code: "CALORIE_LINK_REQUIRED",
            message: "Link the existing Calorie account with Sign in with Apple once."
        )
    }
    func apply(_: SyncIntent) async throws {}
    func signOut() async { didSignOut = true }
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
