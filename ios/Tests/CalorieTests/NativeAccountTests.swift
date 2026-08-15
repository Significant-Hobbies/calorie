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
        let model = AppModel(store: store, accountClient: client, syncStore: syncStore)
        await model.load()
        let changed = Self.cloudExport.replacingOccurrences(of: "Cloud oats", with: "Website oats")
        await client.setExportData(Data(changed.utf8))

        await model.refreshFromCloud()

        XCTAssertEqual(model.document.foods.map(\.name), ["Website oats"])
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

    func cloudExport() async throws -> Data { exportData }
    func setExportData(_ data: Data) { exportData = data }
    func apply(_: SyncIntent) async throws {}
    func signOut() async {}
    func deleteAccount() async throws {}
}
