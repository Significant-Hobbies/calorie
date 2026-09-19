import CalorieCore
import CryptoKit
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

    func testPulledDailyNoteTombstoneRemovesTheDateKey() async throws {
        let f = try CommitFixture()
        defer { f.cleanup() }
        await f.model.load()
        let key = "2026-09-01"
        try await f.model.commitMirrorRecords([
            MirrorRecord(
                name: "note-\(key)",
                modifiedAt: .now,
                payload: Data(#"{"recordType":"dailyNote","date":"2026-09-01","text":"Keep"}"#.utf8)
            )
        ])
        XCTAssertEqual(f.model.document.dailyNotes[key], "Keep")
        try await f.model.commitMirrorRecords([
            MirrorRecord(name: "note-\(key)", modifiedAt: .now, payload: nil)
        ])
        XCTAssertNil(f.model.document.dailyNotes[key])
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

    func testMismatchedRecordNameAndPayloadRejectsTheWholeBatch() async throws {
        let f = try CommitFixture()
        defer { f.cleanup() }
        await f.model.load()
        let remoteID = "33333333-3333-4333-8333-333333333333"
        let nameID = "44444444-4444-4444-8444-444444444444"
        let before = f.model.document
        do {
            try await f.model.commitMirrorRecords([
                MirrorRecord(
                    name: "water-\(nameID)",
                    modifiedAt: .now,
                    payload: Data((#"{"recordType":"waterEntry","id":""# + remoteID + #"","timestamp":"2026-09-01T09:00:00Z","millilitres":750}"#).utf8)
                )
            ])
            XCTFail("A record whose payload ID disagrees with its name must be rejected")
        } catch {
            XCTAssertEqual(f.model.document, before)
            XCTAssertFalse(f.model.document.waterEntries.contains { $0.millilitres == 750 })
        }
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

    // MARK: - Approval

    func testApproveBindsVerifiedAccountAndSurvivesReopen() async throws {
        let f = try AccountFixture()
        defer { f.cleanup() }
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")
        XCTAssertEqual(f.model.account?.userID, "user-1")
        XCTAssertTrue(f.model.needsAccountApproval)

        await f.model.approveCloudAccount()

        XCTAssertEqual(f.model.document.cloudAccountID, "user-1")
        XCTAssertFalse(f.model.isApprovalPresented)
        let observed159 = try await f.runtime.boundOwnerID()
        XCTAssertEqual(observed159, "user-1")
        let observed160 = try await f.store.load().cloudAccountID
        XCTAssertEqual(observed160, "user-1")

        let reopened = AppModel(store: f.store, mirror: f.mirror, legacyJournal: nil)
        await reopened.load()
        XCTAssertEqual(reopened.document.cloudAccountID, "user-1")
        XCTAssertFalse(reopened.needsAccountApproval)
    }

    func testApproveRejectsMismatchedBoundRuntimeOwner() async throws {
        let f = try AccountFixture()
        defer { f.cleanup() }
        try await f.runtime.bindOwner("owner-other")
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")

        await f.model.approveCloudAccount()

        XCTAssertNil(f.model.document.cloudAccountID, "A foreign runtime owner must block the claim")
        XCTAssertEqual(f.model.accountNotice, "This connection is already approved under a different account. Sign in to that account to sync.")
        let observed179 = try await f.runtime.boundOwnerID()
        XCTAssertEqual(observed179, "owner-other")
        let observed180 = try await f.store.load().cloudAccountID
        XCTAssertNil(observed180)
    }

    func testApproveRejectsUnreadableBookkeepingWithoutMutating() async throws {
        let f = try AccountFixture()
        defer { f.cleanup() }
        try FileManager.default.createDirectory(
            at: f.bookkeepingURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data("not-json".utf8).write(to: f.bookkeepingURL)
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")

        await f.model.approveCloudAccount()

        XCTAssertNil(f.model.document.cloudAccountID)
        XCTAssertEqual(f.model.message, "Could not connect this journal to your account. Your local journal is unchanged.")
    }

    func testApproveNeverReassignsForeignDocumentOwner() async throws {
        let f = try AccountFixture()
        defer { f.cleanup() }
        var foreign = CalorieDocument()
        foreign.cloudAccountID = "owner-2"
        foreign.syncState = .synced
        try await f.store.save(foreign)
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")
        XCTAssertTrue(f.model.isBoundToDifferentAccount)

        await f.model.approveCloudAccount()

        XCTAssertEqual(f.model.document.cloudAccountID, "owner-2")
        let observed214 = try await f.store.load().cloudAccountID
        XCTAssertEqual(observed214, "owner-2")
        XCTAssertEqual(f.model.accountNotice, "This connection is already approved under a different account. Sign in to that account to sync.")
        let observed216 = try await f.runtime.boundOwnerID()
        XCTAssertNil(observed216)
    }

    func testApproveFailedSaveLeavesJournalUnchangedAndRetries() async throws {
        let f = try AccountFixture()
        defer { f.cleanup() }
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")
        try f.breakJournalSave()

        await f.model.approveCloudAccount()

        XCTAssertNil(f.model.document.cloudAccountID)
        XCTAssertEqual(f.model.message, "Could not connect this journal to your account. Your local journal is unchanged.")
        let observed230 = try await f.runtime.boundOwnerID()
        XCTAssertNil(observed230)

        try f.repairJournalSave()
        await f.model.approveCloudAccount()

        XCTAssertEqual(f.model.document.cloudAccountID, "user-1")
        let observed236 = try await f.runtime.boundOwnerID()
        XCTAssertEqual(observed236, "user-1")
    }

    func testApproveKeepsCommittedOwnerWhenBookkeepingSaveFails() async throws {
        let f = try AccountFixture()
        defer { f.cleanup() }
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")
        // A regular file where the bookkeeping directory must be created lets
        // the load succeed (no file yet) but makes the durable owner write fail.
        try FileManager.default.createDirectory(at: f.root, withIntermediateDirectories: true)
        try Data("blocked".utf8).write(to: f.bookkeepingURL.deletingLastPathComponent())

        await f.model.approveCloudAccount()

        XCTAssertEqual(f.model.document.cloudAccountID, "user-1", "The durable claim already saved")
        let observed252 = try await f.store.load().cloudAccountID
        XCTAssertEqual(observed252, "user-1")
        XCTAssertEqual(
            f.model.message,
            "Journal connected on this device, but the sync approval could not be saved. Connect again to finish.",
            "The durable approval succeeded, so the copy must not claim the journal is unchanged"
        )
        let observed258 = try await f.runtime.boundOwnerID()
        XCTAssertNil(observed258)

        // Removing the obstruction makes the same-account retry finish.
        try FileManager.default.removeItem(at: f.bookkeepingURL.deletingLastPathComponent())
        await f.model.approveCloudAccount()
        let observed263 = try await f.runtime.boundOwnerID()
        XCTAssertEqual(observed263, "user-1")
        XCTAssertEqual(
            f.model.accountNotice,
            "Journal connected. Your records now merge privately across iCloud and Significant Hobbies."
        )
    }

    func testApproveRejectsIdentityChangedSinceDisplay() async throws {
        let f = try AccountFixture()
        defer { f.cleanup() }
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")

        // The verified session now resolves to a different account than the one
        // the approval sheet displayed — nothing may be claimed.
        StubURLProtocol.userIDsByToken["token-1"] = "user-2"
        await f.model.approveCloudAccount()
        XCTAssertNil(f.model.document.cloudAccountID)
        let observed281 = try await f.runtime.boundOwnerID()
        XCTAssertNil(observed281)

        // And a vanished session refuses approval outright.
        StubURLProtocol.userIDsByToken["token-1"] = "user-1"
        try? await f.tokenStore.delete()
        await f.model.approveCloudAccount()
        XCTAssertEqual(f.model.accountNotice, "Sign in again to connect this journal.")
        XCTAssertNil(f.model.document.cloudAccountID)
    }

    // MARK: - Legacy import

    func testLegacyImportMergesOnceAndWritesMarker() async throws {
        let legacy = FakeLegacyJournal()
        legacy.exportResult = .success(LegacyExportFixture.data())
        let f = try AccountFixture(legacyJournal: legacy)
        defer { f.cleanup() }
        try await f.store.save(boundDocument(for: "user-1"))
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")

        await f.model.syncNow()

        XCTAssertTrue(f.model.document.foods.contains(where: { $0.name == "Legacy oats" }))
        XCTAssertEqual(legacy.exportCalls, 1)
        XCTAssertEqual(f.markerFilenames().count, 1, "Exactly one hashed marker should exist")

        await f.model.syncNow()
        XCTAssertEqual(legacy.exportCalls, 1, "The marker must stop repeat imports in the same process")
    }

    func testLegacyImportCompletionSurvivesMarkerFailureDeletionAndReopen() async throws {
        let gate = AsyncGate()
        let legacy = FakeLegacyJournal()
        legacy.exportResult = .success(LegacyExportFixture.data())
        legacy.exportGate = gate
        let f = try AccountFixture(legacyJournal: legacy)
        defer { f.cleanup() }
        try await f.store.save(boundDocument(for: "user-1"))
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")
        let sync = Task { await f.model.syncNow() }
        await gate.waitUntilWaiting()
        let key = SHA256.hash(data: Data("user-1".utf8)).map { String(format: "%02x", $0) }.joined()
        let marker = f.root.appending(path: "legacy-import-\(key).done")
        try FileManager.default.createDirectory(at: marker, withIntermediateDirectories: true)
        await gate.open()
        await sync.value
        let imported = try XCTUnwrap(f.model.document.foods.first { $0.name == "Legacy oats" })
        XCTAssertEqual(f.model.document.legacyImportedAccountIDs, ["user-1"])
        try FileManager.default.removeItem(at: marker)
        try await f.model.commitMirrorRecords([
            MirrorRecord(name: "food-\(imported.id.uuidString.lowercased())", modifiedAt: .now, payload: nil),
        ])
        await f.model.syncNow()
        let reopened = AppModel(store: f.store, mirror: f.mirror, legacyJournal: legacy)
        await reopened.load()
        await reopened.syncNow()
        XCTAssertEqual(legacy.exportCalls, 1)
        XCTAssertFalse(reopened.document.foods.contains { $0.id == imported.id })
    }

    func testLegacyImportCompletionDoesNotSkipAnotherAccountAfterReset() async throws {
        let legacy = FakeLegacyJournal()
        legacy.exportResult = .success(LegacyExportFixture.data())
        let f = try AccountFixture(legacyJournal: legacy)
        defer { f.cleanup() }
        try await f.store.save(boundDocument(for: "user-1"))
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")
        await f.model.syncNow()
        await f.model.resetLocalData()
        await f.switchAccount(userID: "user-2", token: "token-2")
        await f.model.approveCloudAccount()
        XCTAssertEqual(legacy.exportCalls, 2)
        XCTAssertEqual(f.model.document.legacyImportedAccountIDs, ["user-2"])
    }

    func testSavedLocalEditInvalidatesAnOlderMirrorSnapshot() async throws {
        let f = try AccountFixture()
        defer { f.cleanup() }
        await f.model.load()
        let pass = f.model.makeMirrorPass()
        await f.model.addWater(250)
        let saved = f.model.document
        let savedOnDisk = try await f.store.load()
        do {
            try await f.model.commitMirrorRecords([], pass: pass)
            XCTFail("An old snapshot must retry after a saved edit")
        } catch {}
        XCTAssertEqual(f.model.document, saved)
        let reopened = try await f.store.load()
        XCTAssertEqual(reopened, savedOnDisk)
    }

    func testSignOutInvalidatesAnOlderMirrorPassBeforeLatePullCanCommit() async throws {
        let f = try AccountFixture()
        defer { f.cleanup() }
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")
        let pass = f.model.makeMirrorPass()

        await f.model.signOut()

        do {
            try await f.model.commitMirrorRecords([], pass: pass)
            XCTFail("A pass captured before sign-out must not commit after the identity transition")
        } catch {
            XCTAssertNil(f.model.account)
        }
    }

    func testLegacyImportAccountSwitchDuringFetchIsRejected() async throws {
        let gate = AsyncGate()
        let legacy = FakeLegacyJournal()
        legacy.exportResult = .success(LegacyExportFixture.data())
        legacy.exportGate = gate
        let f = try AccountFixture(legacyJournal: legacy)
        defer { f.cleanup() }
        try await f.store.save(boundDocument(for: "user-1"))
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")

        let sync = Task { await f.model.syncNow() }
        await gate.waitUntilWaiting()
        await f.switchAccount(userID: "user-2", token: "token-2")
        await gate.open()
        await sync.value

        XCTAssertFalse(
            f.model.document.foods.contains(where: { $0.name == "Legacy oats" }),
            "An export that resolves under a different session must never be applied"
        )
        XCTAssertEqual(f.model.document.syncState, .failed)
        XCTAssertEqual(f.markerFilenames().count, 0)
    }

    func testLegacyImportFailedFetchMarksFailedAndRetries() async throws {
        let legacy = FakeLegacyJournal()
        let f = try AccountFixture(legacyJournal: legacy)
        defer { f.cleanup() }
        try await f.store.save(boundDocument(for: "user-1"))
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")

        await f.model.syncNow()

        XCTAssertEqual(f.model.document.syncState, .failed, "A failed import is not a sync receipt")
        XCTAssertNil(f.model.document.lastSyncedAt)
        XCTAssertEqual(legacy.exportCalls, 1)
        XCTAssertEqual(f.markerFilenames().count, 0)

        legacy.exportResult = .success(LegacyExportFixture.data())
        await f.model.syncNow()

        XCTAssertTrue(f.model.document.foods.contains(where: { $0.name == "Legacy oats" }))
        XCTAssertEqual(legacy.exportCalls, 2, "A failed import must be retried in the same process")
    }

    func testLegacyImportFailedSaveRetriesAndReopenHonoursMarker() async throws {
        let legacy = FakeLegacyJournal()
        legacy.exportResult = .success(LegacyExportFixture.data())
        let f = try AccountFixture(legacyJournal: legacy)
        defer { f.cleanup() }
        try await f.store.save(boundDocument(for: "user-1"))
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")
        try f.breakJournalSave()

        await f.model.syncNow()

        XCTAssertEqual(legacy.exportCalls, 1)
        XCTAssertEqual(f.markerFilenames().count, 0, "No marker may be written before the durable commit")
        XCTAssertFalse(f.model.document.foods.contains(where: { $0.name == "Legacy oats" }))

        try f.repairJournalSave()
        await f.model.syncNow()

        XCTAssertTrue(f.model.document.foods.contains(where: { $0.name == "Legacy oats" }))
        XCTAssertEqual(legacy.exportCalls, 2, "A failed commit must be retried in the same process")
        XCTAssertEqual(f.markerFilenames().count, 1)

        let reopened = AppModel(store: f.store, mirror: f.mirror, legacyJournal: legacy)
        await reopened.load()
        XCTAssertTrue(reopened.document.foods.contains(where: { $0.name == "Legacy oats" }))
        await reopened.syncNow()
        XCTAssertEqual(legacy.exportCalls, 2, "The durable marker survives reopen")
    }

    func testLegacyImportPreservesInFlightLocalEdits() async throws {
        let gate = AsyncGate()
        let legacy = FakeLegacyJournal()
        legacy.exportResult = .success(LegacyExportFixture.data())
        legacy.exportGate = gate
        let f = try AccountFixture(legacyJournal: legacy)
        defer { f.cleanup() }
        try await f.store.save(boundDocument(for: "user-1"))
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")

        let sync = Task { await f.model.syncNow() }
        await gate.waitUntilWaiting()
        await f.model.addWater(300)
        await gate.open()
        await sync.value

        XCTAssertEqual(f.model.document.waterEntries.map(\.millilitres), [300], "Edits made during the fetch merge in")
        XCTAssertTrue(f.model.document.foods.contains(where: { $0.name == "Legacy oats" }))
    }

    func testLegacyImportCannotCommitIntoSameOwnerReplacement() async throws {
        let gate = AsyncGate()
        let legacy = FakeLegacyJournal()
        legacy.exportResult = .success(LegacyExportFixture.data())
        legacy.exportGate = gate
        let f = try AccountFixture(legacyJournal: legacy)
        defer { f.cleanup() }
        try await f.store.save(boundDocument(for: "user-1"))
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")

        let sync = Task { await f.model.syncNow() }
        await gate.waitUntilWaiting()

        var replacement = boundDocument(for: "user-1")
        replacement.foods = [Food(
            name: "Replacement oats",
            servingName: "1 bowl",
            nutrients: Nutrients(calories: 410)
        )]
        let replacementData = try await f.store.export(replacement)
        await f.model.prepareImport(replacementData)
        XCTAssertTrue(f.model.isImportConfirmationPresented)
        await f.model.confirmImport()

        await gate.open()
        await sync.value

        XCTAssertEqual(f.model.document.foods.map(\.name), ["Replacement oats"])
        XCTAssertEqual(legacy.exportCalls, 1)
    }

    func testResetInvalidatesLegacyMarkerBeforeMirrorUpload() async throws {
        let legacy = FakeLegacyJournal()
        legacy.exportResult = .success(LegacyExportFixture.data())
        let f = try AccountFixture(legacyJournal: legacy)
        defer { f.cleanup() }
        try await f.store.save(boundDocument(for: "user-1"))
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")
        await f.transport.setAvailability(.unavailable("offline"))

        await f.model.syncNow()

        XCTAssertEqual(legacy.exportCalls, 1)
        XCTAssertTrue(f.model.document.foods.contains { $0.name == "Legacy oats" })
        XCTAssertEqual(f.markerFilenames().count, 1)
        let remoteBeforeReset = await f.transport.remoteRecords()
        XCTAssertTrue(remoteBeforeReset.isEmpty)

        await f.model.resetLocalData()

        XCTAssertTrue(f.model.document.foods.isEmpty)
        XCTAssertEqual(f.markerFilenames().count, 0)

        await f.model.approveCloudAccount()

        XCTAssertEqual(legacy.exportCalls, 2)
        XCTAssertTrue(f.model.document.foods.contains { $0.name == "Legacy oats" })
        XCTAssertEqual(f.markerFilenames().count, 1)
    }

    func testLegacyImportMarkerCannotEscapeJournalDirectory() async throws {
        let legacy = FakeLegacyJournal()
        legacy.exportResult = .success(LegacyExportFixture.data())
        let f = try AccountFixture(legacyJournal: legacy)
        defer { f.cleanup() }
        let hostile = "../outside"
        try await f.store.save(boundDocument(for: hostile))
        await f.model.load()
        await f.signIn(userID: hostile, token: "token-1")

        await f.model.syncNow()

        let names = f.markerFilenames()
        XCTAssertEqual(names.count, 1)
        let name = try XCTUnwrap(names.first)
        XCTAssertTrue(name.hasPrefix("legacy-import-"), name)
        XCTAssertTrue(name.hasSuffix(".done"), name)
        let key = name.dropFirst("legacy-import-".count).dropLast(".done".count)
        XCTAssertEqual(key.count, 64)
        XCTAssertTrue(key.allSatisfy(\.isHexDigit), "The marker key is a hash, never the raw account ID")
        XCTAssertFalse(
            FileManager.default.fileExists(
                atPath: f.root.appending(path: "legacy-import-../outside.done").path
            ),
            "The raw-ID marker path must never be written"
        )
    }

    func testLegacyImportHonoursSafeCompatMarkerOnly() async throws {
        let legacy = FakeLegacyJournal()
        legacy.exportResult = .success(LegacyExportFixture.data())
        let f = try AccountFixture(legacyJournal: legacy)
        defer { f.cleanup() }
        try await f.store.save(boundDocument(for: "safe-user_1"))
        // An old build's raw-ID marker still counts for IDs that are
        // filesystem-safe anyway.
        try FileManager.default.createDirectory(at: f.storeDirectory, withIntermediateDirectories: true)
        try Data("{}".utf8).write(to: f.storeDirectory.appending(path: "legacy-import-safe-user_1.done"))
        await f.model.load()
        await f.signIn(userID: "safe-user_1", token: "token-1")

        await f.model.syncNow()

        XCTAssertEqual(legacy.exportCalls, 0)
    }

    // MARK: - Sync outcome

    func testFailedTransportMarksFailureAndPreservesLastSuccess() async throws {
        let f = try AccountFixture()
        defer { f.cleanup() }
        try await f.store.save(boundDocument(for: "user-1"))
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")

        await f.model.syncNow()
        let firstSyncedAt = try XCTUnwrap(f.model.document.lastSyncedAt)
        XCTAssertNotEqual(f.model.document.syncState, .failed)

        await f.transport.setAvailability(.unavailable("offline"))
        await f.model.syncNow()

        XCTAssertEqual(f.model.document.syncState, .failed)
        XCTAssertEqual(
            f.model.document.lastSyncedAt,
            firstSyncedAt,
            "A failed pass must not stamp a new success receipt"
        )
    }

    func testCloudDeletionFailsClosedWhenMirrorIsUnavailable() async throws {
        let f = try AccountFixture()
        defer { f.cleanup() }
        try await f.store.save(boundDocument(for: "user-1"))
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")
        await f.transport.setAvailability(.unavailable("offline"))

        await f.model.deleteCloudAccount()

        XCTAssertEqual(f.model.document.cloudAccountID, "user-1")
        XCTAssertEqual(f.model.document.syncState, .synced)
        XCTAssertEqual(
            f.model.message,
            "Could not finish deleting the cloud account. Nothing was removed from this device."
        )
    }

    func testCloudDeletionWithNoMirrorDoesNotClaimSuccessOrClearLocalOwner() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = CalorieStore(fileURL: root.appending(path: "journal.json"))
        var bound = CalorieDocument()
        bound.cloudAccountID = "user-1"
        bound.syncState = .synced
        try await store.save(bound)
        let model = AppModel(store: store, mirror: nil, legacyJournal: nil)
        await model.load()

        await model.deleteCloudAccount()

        XCTAssertEqual(model.document.cloudAccountID, "user-1")
        XCTAssertEqual(model.message, "Cloud account deletion is unavailable until an authoritative remote deletion is supported. Your journal and account are unchanged.")
        let restored = try await store.load()
        XCTAssertEqual(restored.cloudAccountID, "user-1")
    }

    func testCloudDeletionNeverDeletesUnknownRemoteRecords() async throws {
        let f = try AccountFixture()
        defer { f.cleanup() }
        try await f.store.save(boundDocument(for: "user-1"))
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")
        let unknown = MirrorRecord(
            name: "water-99999999-9999-4999-8999-999999999999",
            modifiedAt: .now,
            payload: Data(#"{"recordType":"waterEntry","id":"99999999-9999-4999-8999-999999999999","timestamp":"2026-09-01T09:00:00Z","millilitres":750}"#.utf8)
        )
        await f.transport.setRemote([unknown])

        await f.model.deleteCloudAccount()

        XCTAssertEqual(f.model.document.cloudAccountID, "user-1")
        let remote = await f.transport.remoteRecords()
        XCTAssertEqual(remote.map(\.name), [unknown.name])
    }

    func testUnreadableBookkeepingMarksSyncFailed() async throws {
        let f = try AccountFixture()
        defer { f.cleanup() }
        try await f.store.save(boundDocument(for: "user-1"))
        try FileManager.default.createDirectory(
            at: f.bookkeepingURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data("not-json".utf8).write(to: f.bookkeepingURL)
        await f.model.load()
        await f.signIn(userID: "user-1", token: "token-1")

        await f.model.syncNow()

        XCTAssertEqual(f.model.document.syncState, .failed)
        XCTAssertNil(f.model.document.lastSyncedAt)
    }

    func testSyncWithoutAccountRecordsLocalOnly() async throws {
        let f = try AccountFixture()
        defer { f.cleanup() }
        // A journal that was synced under an account reports local-only once
        // no current account exists — even when the transport pass succeeded.
        try await f.store.save(boundDocument(for: "user-1"))
        await f.model.load()

        await f.model.syncNow()

        XCTAssertEqual(f.model.document.syncState, .localOnly)
    }

    // MARK: - Import replacement

    func testConfirmImportKeepsJournalWhenBookkeepingResetFails() async throws {
        let f = try AccountFixture()
        defer { f.cleanup() }
        await f.model.load()
        var replacement = CalorieDocument()
        replacement.foods.append(Food(
            name: "Imported meal", servingName: "1 plate",
            nutrients: Nutrients(calories: 500, protein: 30, carbohydrates: 40, fat: 15, fibre: 5)
        ))
        let data = try await f.store.export(replacement)
        await f.model.prepareImport(data)
        XCTAssertTrue(f.model.isImportConfirmationPresented)

        // Forget must delete the bookkeeping file; a read-only directory makes
        // that throw, which must abort the replace rather than swallow it.
        try FileManager.default.createDirectory(
            at: f.bookkeepingURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data("{}".utf8).write(to: f.bookkeepingURL)
        try FileManager.default.setAttributes(
            [.posixPermissions: 0o555],
            ofItemAtPath: f.bookkeepingURL.deletingLastPathComponent().path
        )

        await f.model.confirmImport()

        XCTAssertFalse(f.model.document.foods.contains(where: { $0.name == "Imported meal" }),
                       "A failed bookkeeping reset must not be followed by replacement")
        XCTAssertNotNil(f.model.importPreview)
        XCTAssertEqual(f.model.message, "Could not prepare the journal replacement. Your current journal was kept.")

        try FileManager.default.setAttributes(
            [.posixPermissions: 0o755],
            ofItemAtPath: f.bookkeepingURL.deletingLastPathComponent().path
        )
        await f.model.confirmImport()
        XCTAssertTrue(f.model.document.foods.contains(where: { $0.name == "Imported meal" }))
        XCTAssertNil(f.model.importPreview)
    }

    private func boundDocument(for userID: String) -> CalorieDocument {
        var document = CalorieDocument()
        document.cloudAccountID = userID
        document.syncState = .synced
        return document
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
    private var availabilityResult: MirrorAvailability = .available

    func availability() -> MirrorAvailability { availabilityResult }
    func setAvailability(_ value: MirrorAvailability) { availabilityResult = value }
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
    func remoteRecords() -> [MirrorRecord] { remote }
}

/// Fixture with a real `PersonalIdentityClient` and `PersonalAccountModel`
/// backed by a memory token store and an ephemeral `URLProtocol` — sessions
/// are verified through the same network path production uses.
@MainActor
private final class AccountFixture {
    let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
    let store: CalorieStore
    let runtime: MirrorRuntime
    let transport: FakeTransport
    let tokenStore: MemoryBearerStore
    let accountModel: PersonalAccountModel
    let mirror: PersonalMirrorConnection
    let model: AppModel

    init(legacyJournal: (any LegacyCalorieServing)? = nil) throws {
        store = CalorieStore(fileURL: root.appending(path: "journal.json"))
        transport = FakeTransport()
        runtime = MirrorRuntime(
            transports: [transport],
            store: MirrorBookkeepingStore(fileURL: root.appending(path: "sync/mirror.json"))
        )
        tokenStore = MemoryBearerStore()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        let identity = PersonalIdentityClient(
            baseURL: URL(string: "https://identity.invalid")!,
            session: URLSession(configuration: configuration),
            tokenStore: tokenStore
        )
        accountModel = PersonalAccountModel(
            identity: identity,
            callbackScheme: "calorie",
            identityURL: URL(string: "https://identity.invalid")!
        )
        mirror = PersonalMirrorConnection(
            identity: identity,
            runtime: runtime,
            account: accountModel
        )
        model = AppModel(store: store, mirror: mirror, legacyJournal: legacyJournal)
    }

    var storeDirectory: URL { root }
    var journalURL: URL { root.appending(path: "journal.json") }
    var bookkeepingURL: URL { root.appending(path: "sync/mirror.json") }

    /// Saves a bearer token and restores the model session through the stubbed
    /// session endpoint — the same two steps production sign-in ends with.
    func signIn(userID: String, token: String) async {
        StubURLProtocol.userIDsByToken[token] = userID
        try? await tokenStore.save(token)
        await accountModel.restore()
    }

    /// Moves the saved session to a different account, as a sign-out plus
    /// sign-in on another identity would.
    func switchAccount(userID: String, token: String) async {
        StubURLProtocol.userIDsByToken[token] = userID
        try? await tokenStore.save(token)
        await accountModel.restore()
    }

    /// Makes every durable journal write throw while the in-memory document
    /// stays loaded, by turning the journal path into a directory.
    func breakJournalSave() throws {
        try? FileManager.default.removeItem(at: journalURL)
        try FileManager.default.createDirectory(at: journalURL, withIntermediateDirectories: true)
    }

    func repairJournalSave() throws {
        try FileManager.default.removeItem(at: journalURL)
    }

    func markerFilenames() -> [String] {
        (try? FileManager.default.contentsOfDirectory(atPath: root.path))?
            .filter { $0.hasPrefix("legacy-import-") && $0.hasSuffix(".done") } ?? []
    }

    func cleanup() {
        StubURLProtocol.userIDsByToken = [:]
        try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: root.appending(path: "sync").path)
        try? FileManager.default.removeItem(at: root)
    }
}

/// Ephemeral protocol stubbing only the identity endpoints the fixtures call;
/// the token in the `Authorization` header selects which account the session
/// resolves to, so switching tokens switches verified accounts.
private final class StubURLProtocol: URLProtocol {
    nonisolated(unsafe) static var userIDsByToken: [String: String] = [:]

    override class func canInit(with _: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let url = request.url ?? URL(string: "https://identity.invalid")!
        var status = 200
        var body = Data("{}".utf8)
        if url.path.hasSuffix("api/personal-platform/session") {
            let token = request.value(forHTTPHeaderField: "Authorization")?
                .replacingOccurrences(of: "Bearer ", with: "") ?? ""
            if let userID = Self.userIDsByToken[token] {
                body = Data(
                    (#"{"userId":""# + userID + #"","email":"test@example.com","appleSubject":null}"#).utf8
                )
            } else {
                status = 401
                body = Data(#"{"message":"unauthorized"}"#.utf8)
            }
        }
        let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

/// A gate a suspended fake can wait on so a test controls exactly when a held
/// network response lands.
private actor AsyncGate {
    private var isOpen = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func wait() async {
        if isOpen { return }
        await withCheckedContinuation { waiters.append($0) }
    }

    /// Resolves once a waiter is actually suspended inside `wait`, so the test
    /// knows the export is genuinely in flight.
    func waitUntilWaiting() async {
        while waiters.isEmpty, !isOpen { await Task.yield() }
    }

    func open() {
        isOpen = true
        let pending = waiters
        waiters = []
        for waiter in pending { waiter.resume() }
    }
}

private final class FakeLegacyJournal: LegacyCalorieServing, @unchecked Sendable {
    var exportResult: Result<Data, Error> = .failure(LegacyCalorieError.missingSession)
    var exportGate: AsyncGate?
    private(set) var exportCalls = 0

    func cloudExport() async throws -> Data {
        exportCalls += 1
        await exportGate?.wait()
        return try exportResult.get()
    }

    func deleteData() async throws {}
}

private enum LegacyExportFixture {
    static func data() -> Data {
        Data(#"""
        {
          "schema": "calorie-journal-backup",
          "version": 2,
          "generatedAt": "2026-09-01T00:00:00Z",
          "profile": {
            "displayName": "Legacy",
            "activityLevel": "moderate",
            "goal": "maintain",
            "waterTargetMl": 2500
          },
          "foods": [
            {
              "id": "legacy-food-1",
              "name": "Legacy oats",
              "servingMode": "serving",
              "unitLabel": "1 bowl",
              "defaultAmount": 60,
              "calories": 380,
              "carbsG": 66,
              "proteinG": 12,
              "fibreG": 9,
              "favourite": true
            }
          ],
          "entries": [],
          "waterEntries": [],
          "medications": [],
          "medicationCheckIns": [],
          "weights": [],
          "cycleSessions": []
        }
        """#.utf8)
    }
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
