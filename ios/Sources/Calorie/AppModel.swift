import CalorieCore
import CryptoKit
import Foundation
import Observation
import PersonalSyncKit
import SwiftUI

@MainActor
@Observable
final class AppModel {
    private var storeGeneration = UUID()
    private var isReplacingStore = false
    private(set) var document: CalorieDocument = .starter
    var selectedDate = Date.now
    var selectedTab = 0
    var isLoading = true
    private(set) var hasLoadedDocument = false
    private(set) var isSaving = false
    private var localWriteWaiters: [CheckedContinuation<Void, Never>] = []
    var isQuickLogPresented = false
    var message: String?
    private(set) var saveError: String?
    var lastDeletedEntry: FoodEntry?
    var importPreview: CalorieDocument?
    var isImportConfirmationPresented = false
    var isApprovalPresented = false
    private(set) var isAccountWorking = false
    private(set) var accountNotice: String?
    private(set) var pendingSyncCount = 0
    private(set) var isSyncing = false
    private(set) var forceCalorieOnboarding = false

    private let store: CalorieStore
    private let mirror: PersonalMirrorConnection?
    private let legacyJournal: (any LegacyCalorieServing)?
    private var activeLocalMutations = 0
    private var localMutationRevision = 0
    private var syncRequestedAfterMutation = false

    var account: CalorieAccount? { mirror?.account.session.map(CalorieAccount.init) }
    var accountModel: PersonalAccountModel? { mirror?.account }

    /// Signed in but the journal is not bound to this account yet — either it
    /// was never connected, or a legacy build left it in `conflict` waiting
    /// for the retired journal-choice sheet.
    var needsAccountApproval: Bool {
        guard let userID = account?.userID else { return false }
        return document.cloudAccountID == nil
            || (document.syncState == .conflict && document.cloudAccountID == userID)
    }

    var isBoundToDifferentAccount: Bool {
        guard let userID = account?.userID, let bound = document.cloudAccountID else { return false }
        return bound != userID
    }

    init(
        store: CalorieStore = CalorieStore(),
        mirror: PersonalMirrorConnection? = AppModel.makeMirrorConnection(),
        legacyJournal: (any LegacyCalorieServing)? = LegacyCalorieJournal()
    ) {
        self.store = store
        self.mirror = mirror
        self.legacyJournal = legacyJournal
        if ProcessInfo.processInfo.arguments.contains("--progress-demo") { selectedTab = 1 }
        if ProcessInfo.processInfo.arguments.contains("--foods-demo") { selectedTab = 2 }
        if ProcessInfo.processInfo.arguments.contains("--you-demo") { selectedTab = 3 }
    }

    var preferredColorScheme: ColorScheme? {
        switch document.theme {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }

    var selectedEntries: [FoodEntry] { document.entries(on: selectedDate) }
    var selectedTotals: Nutrients { document.totals(on: selectedDate) }
    var targetExplanation: TargetExplanation? { TargetCalculator.targets(for: document.profile) }
    var dailyScoreTargets: DailyScoreTargets {
        let nutrientTargets = targetExplanation?.target
        let activeCycle = document.goalCycleSessions?
            .filter { $0.endOn == nil }
            .max { $0.updatedAt < $1.updatedAt }
        return DailyScoreTargets(
            calorieRange: activeCycle?.calorieRange,
            calorieTarget: nutrientTargets?.calories,
            proteinTarget: activeCycle?.proteinRange?.first ?? nutrientTargets?.protein,
            fibreTarget: nutrientTargets?.fibre
        )
    }
    var guidance: [GuidanceItem] {
        GuidanceEngine.items(
            entries: selectedEntries,
            now: .now,
            bedtimeHour: preferredBedtimeHour,
            fastingThresholdHours: document.profile.fastingThresholdHours
        )
    }

    private var preferredBedtimeHour: Int {
        guard
            let wakeTime = document.profile.wakeTime,
            let sleepHours = document.profile.sleepHours,
            let separator = wakeTime.firstIndex(of: ":"),
            let wakeHour = Int(wakeTime[..<separator]),
            let wakeMinute = Int(wakeTime[wakeTime.index(after: separator)...])
        else { return 23 }
        let wakeMinutes = wakeHour * 60 + wakeMinute
        let bedtimeMinutes = (wakeMinutes - Int((sleepHours * 60).rounded()) + 24 * 60) % (24 * 60)
        return bedtimeMinutes / 60
    }

    func load() async {
        defer { isLoading = false }
        do {
            let arguments = ProcessInfo.processInfo.arguments
            if arguments.contains("--recovery-demo") { throw CocoaError(.fileReadCorruptFile) }
            if arguments.contains("--reset-onboarding") {
                CalorieOnboardingPreferences.reset()
            }
            if arguments.contains("--onboarding-demo") {
                document = .starter
                forceCalorieOnboarding = true
            } else {
                document = arguments.contains("--fresh-demo") ? .sample : try await store.load()
            }
            hasLoadedDocument = true
            if arguments.contains("--quick-log-demo") { isQuickLogPresented = true }
        } catch {
            message = error.localizedDescription
        }
    }

    func restoreAccountAndSync() async {
        let fixtures = ["--fresh-demo", "--onboarding-demo", "--recovery-demo"]
        guard hasLoadedDocument, !isAccountWorking,
              !ProcessInfo.processInfo.arguments.contains(where: fixtures.contains) else { return }
        isAccountWorking = true
        defer { isAccountWorking = false }
        await mirror?.account.restore()
        if account != nil {
            await finishSignIn()
        }
    }

    /// Runs after any sign-in path completes: surface the approval prompt when
    /// the journal is unbound, flag a foreign binding, otherwise sync.
    private func finishSignIn() async {
        if needsAccountApproval {
            isApprovalPresented = true
        } else if isBoundToDifferentAccount {
            accountNotice = "This journal is connected to a different account. Sign in to that account to sync it, or keep using this device journal locally."
        } else {
            await syncNow()
        }
    }

    func shouldPresentCalorieOnboarding(completed: Bool) -> Bool {
        let hasLocalActivity = !document.foodEntries.isEmpty
            || !document.waterEntries.isEmpty
            || !document.weightEntries.isEmpty
            || !document.routineCheckIns.isEmpty
            || document.foods.contains(where: \.isCustom)
        return CalorieOnboardingPolicy.shouldPresent(
            completed: completed,
            hasLocalActivity: hasLocalActivity,
            cloudActivityCount: 0,
            forced: forceCalorieOnboarding
        )
    }

    func dismissOnboarding() {
        forceCalorieOnboarding = false
    }

    @discardableResult
    func completeOnboarding(
        configuration: CalorieOnboardingConfiguration,
        food: Food,
        servings: Double,
        meal: Meal,
        saveFood: Bool
    ) async -> Bool {
        let succeeded = await mutate { document in
            document.profile.units = configuration.units
            document.profile.onboardingComplete = true
            switch configuration.targets {
            case .later, .estimateLater:
                document.profile.manualCalorieTarget = nil
                document.profile.manualMacroTargets = nil
            case let .manual(targets):
                document.profile.manualCalorieTarget = targets.calories
                document.profile.manualMacroTargets = targets
            }
            if saveFood {
                document.addCustomFood(food)
            }
            document.log(food: food, servings: servings, meal: meal, at: selectedDate)
        }
        if succeeded {
            selectedTab = 0
            message = nil
        }
        return succeeded
    }

    func log(_ food: Food, servings: Double, meal: Meal, at date: Date) async {
        guard await mutate({ $0.log(food: food, servings: servings, meal: meal, at: date) }) else { return }
        isQuickLogPresented = false
        message = "\(food.name) added."
    }

    func delete(_ entry: FoodEntry) async {
        guard await mutate({ document in
            _ = try document.deleteEntry(entry.id)
        }) else { return }
        lastDeletedEntry = entry
        message = "Entry removed. Undo is available below."
    }

    func undoDelete() async {
        guard let entry = lastDeletedEntry else { return }
        guard await mutate({ $0.restoreEntry(entry) }) else { return }
        lastDeletedEntry = nil
        message = "Entry restored."
    }

    func duplicate(_ entry: FoodEntry) async {
        guard await mutate({ try $0.duplicateEntry(entry.id) }) else { return }
        message = "Entry duplicated."
    }

    @discardableResult
    func update(_ entry: FoodEntry, servings: Double, meal: Meal, timestamp: Date) async -> Bool {
        let committed = await mutate { document in
            guard let index = document.foodEntries.firstIndex(where: { $0.id == entry.id }) else {
                throw CalorieError.entryNotFound
            }
            var updated = entry
            updated.servings = max(0.05, servings)
            updated.meal = meal
            updated.timestamp = timestamp
            if let food = document.foods.first(where: { $0.id == entry.foodID }) {
                updated.foodName = food.name
                updated.nutrients = food.nutrients.scaled(by: updated.servings)
            } else {
                updated.nutrients = entry.nutrients.scaled(by: updated.servings / max(entry.servings, 0.0001))
            }
            document.foodEntries[index] = updated
        }
        guard committed else { return false }
        message = "Food entry updated."
        return committed
    }

    func addWater(_ millilitres: Int) async {
        let date = selectedDate
        await mutate { $0.addWater(millilitres, at: date) }
    }

    func toggleRoutine(_ routine: MedicationRoutine) async {
        let date = selectedDate
        await mutate {
            $0.toggleRoutine(routine.id, on: date)
        }
    }

    func toggleFavorite(_ food: Food) async {
        await mutate { $0.toggleFavorite(food.id) }
    }

    @discardableResult
    func addCustomFood(_ food: Food) async -> Bool {
        let committed = await mutate { $0.addCustomFood(food) }
        guard committed else { return false }
        message = "Custom food saved."
        return committed
    }

    @discardableResult
    func saveFood(_ food: Food) async -> Bool {
        let committed = await mutate { document in
            if let index = document.foods.firstIndex(where: { $0.id == food.id }) {
                document.foods[index] = food
            } else {
                document.addCustomFood(food)
            }
        }
        guard committed else { return false }
        message = "Food saved."
        return committed
    }

    func toggleArchive(_ food: Food) async {
        await mutate { document in
            guard let index = document.foods.firstIndex(where: { $0.id == food.id }) else { return }
            document.foods[index].isArchived.toggle()
        }
    }

    @discardableResult
    func saveDailyContext(weightKilograms: Double?, note: String, cycle: CycleContext) async -> Bool {
        let date = selectedDate
        let committed = await mutate { document in
            let calendar = Calendar.current
            document.weightEntries.removeAll { calendar.isDate($0.date, inSameDayAs: date) }
            if let weightKilograms, weightKilograms > 0 {
                document.weightEntries.append(WeightEntry(date: date, kilograms: weightKilograms))
            }
            let key = DateKey.string(date)
            let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmedNote.isEmpty {
                document.dailyNotes.removeValue(forKey: key)
            } else {
                document.dailyNotes[key] = trimmedNote
            }
            document.cycle = cycle
        }
        guard committed else { return false }
        message = "Daily context saved."
        return committed
    }

    @discardableResult
    func saveRoutine(_ routine: MedicationRoutine) async -> Bool {
        let committed = await mutate { document in
            if let index = document.routines.firstIndex(where: { $0.id == routine.id }) {
                document.routines[index] = routine
            } else {
                document.routines.append(routine)
            }
        }
        return committed
    }

    func toggleArchive(_ routine: MedicationRoutine) async {
        var updated = routine
        updated.isArchived.toggle()
        await saveRoutine(updated)
    }

    @discardableResult
    func updateProfile(_ profile: Profile) async -> Bool {
        let committed = await mutate { $0.profile = profile }
        return committed
    }

    func setTheme(_ theme: AppTheme) async {
        await mutate { $0.theme = theme }
    }

    func prepareImport(_ data: Data) async {
        do {
            importPreview = try await store.previewImport(data)
            isImportConfirmationPresented = true
        } catch {
            message = error.localizedDescription
        }
    }

    func confirmImport() async {
        guard let importPreview else { return }
        let importedAccountIDs = Set(
            (document.legacyImportedAccountIDs ?? [])
                + [document.cloudAccountID, account?.userID].compactMap { $0 }
        )
        do {
            try await replaceLocalDocument(
                importPreview,
                invalidatingLegacyImportMarkersFor: importedAccountIDs
            )
            self.importPreview = nil
            isImportConfirmationPresented = false
            message = "Calorie journal replaced."
        } catch {
            saveError = error.localizedDescription
            message = "Could not prepare the journal replacement. Your current journal was kept."
        }
    }

    func resetLocalData() async {
        let importedAccountIDs = Set(
            (document.legacyImportedAccountIDs ?? [])
                + [document.cloudAccountID, account?.userID].compactMap { $0 }
        )
        do {
            try await replaceLocalDocument(.starter, invalidatingLegacyImportMarkersFor: importedAccountIDs)
            message = "Local journal reset."
        } catch {
            saveError = error.localizedDescription
            message = error.localizedDescription
        }
    }

    private func replaceLocalDocument(
        _ replacement: CalorieDocument,
        invalidatingLegacyImportMarkersFor accountIDs: Set<String> = []
    ) async throws {
        guard !isReplacingStore else { throw CalorieMirrorError.documentNotLoaded }
        isReplacingStore = true
        storeGeneration = UUID()
        defer { isReplacingStore = false }
        await acquireLocalWrite()
        defer { releaseLocalWrite() }
        // CAS invalidates old passes without waiting for an app callback.
        // The replacement flag prevents a new pass entering the reset/save gap.
        try await invalidateLegacyImportMarkers(for: accountIDs)
        try await mirror?.runtime.forgetBookkeeping()
        try await store.save(replacement)
        document = replacement
        localMutationRevision += 1
        hasLoadedDocument = true
        saveError = nil
    }

    private func invalidateLegacyImportMarkers(for accountIDs: Set<String>) async throws {
        for userID in accountIDs {
            let marker = await legacyImportMarkerURL(for: userID)
            if FileManager.default.fileExists(atPath: marker.path) {
                try FileManager.default.removeItem(at: marker)
            }
            guard !userID.isEmpty,
                  userID.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" })
            else { continue }
            let legacyMarker = marker.deletingLastPathComponent()
                .appending(path: "legacy-import-\(userID).done")
            if FileManager.default.fileExists(atPath: legacyMarker.path) {
                try FileManager.default.removeItem(at: legacyMarker)
            }
        }
    }

    func connectExistingAccount() async {
        guard !isAccountWorking else { return }
        invalidateSyncPasses()
        accountNotice = nil
        isAccountWorking = true
        defer { isAccountWorking = false }
        await accountModel?.connect()
        if account != nil {
            accountNotice = CalorieAccountCopy.existingAccountConnected
            await finishSignIn()
        } else if let error = accountModel?.errorMessage {
            message = "\(error) Try connecting your existing journal again."
        }
    }

    /// Called by the Sign in with Apple button after `accountModel` finished
    /// the credential exchange (it links Apple to an existing session itself).
    func finishAppleSignIn() async {
        guard account != nil else {
            if let error = accountModel?.errorMessage { message = "\(error) Try Apple sign-in again. Your device journal has not changed." }
            return
        }
        invalidateSyncPasses()
        isAccountWorking = true
        defer { isAccountWorking = false }
        await finishSignIn()
    }

    /// Binds this journal to the signed-in account and lets the mirror run.
    /// Records merge per-entity afterwards — the newest version of each record
    /// wins — so unlike the retired journal-choice sheet there is nothing to
    /// pick between.
    func approveCloudAccount() async {
        guard let mirror, account != nil, !isAccountWorking else { return }
        invalidateSyncPasses()
        isAccountWorking = true
        defer { isAccountWorking = false }
        // Tracks whether the journal itself durably claimed the account, so a
        // later failure cannot claim the journal is unchanged when it is not.
        var ownerCommitted = false
        do {
            // Approve against the server-verified session, not the cached one
            // the views display — the two can diverge across a sign-out race.
            guard let verified = try await mirror.identity.verifiedSyncAccount() else {
                accountNotice = "Sign in again to connect this journal."
                return
            }
            guard verified.userID == account?.userID else {
                throw PersonalIdentityError.sessionChanged
            }
            // Read-only checks first: a conflicting runtime owner, a foreign
            // document owner, or unreadable bookkeeping must all fail before
            // the document is touched.
            if let bound = try await mirror.runtime.boundOwnerID(), bound != verified.userID {
                throw PersonalSyncOwnershipError.differentAccount
            }
            if let owner = document.cloudAccountID, owner != verified.userID {
                throw PersonalSyncOwnershipError.differentAccount
            }
            try await commitLocalChange { next in
                // The session and both owners can change while this call waits
                // on the write lock — recheck all three inside it, before the
                // durable owner claim is saved.
                try await mirror.identity.requireCurrentAccount(verified)
                if let bound = try await mirror.runtime.boundOwnerID(), bound != verified.userID {
                    throw PersonalSyncOwnershipError.differentAccount
                }
                if let owner = next.cloudAccountID, owner != verified.userID {
                    throw PersonalSyncOwnershipError.differentAccount
                }
                next.cloudAccountID = verified.userID
                if next.syncState == .conflict { next.syncState = .pending }
            }
            ownerCommitted = true
            try await mirror.runtime.bindOwner(verified.userID)
            isApprovalPresented = false
            accountNotice = "Journal connected. Your records now merge privately across iCloud and Significant Hobbies."
            await syncNow()
        } catch PersonalSyncOwnershipError.differentAccount {
            accountNotice = "This connection is already approved under a different account. Sign in to that account to sync."
        } catch {
            message = ownerCommitted
                ? "Journal connected on this device, but the sync approval could not be saved. Connect again to finish."
                : "Could not connect this journal to your account. Your local journal is unchanged."
        }
    }

    func deferApproval() {
        isApprovalPresented = false
        accountNotice = "Your journal is unchanged. Connect it whenever you are ready."
    }

    func signOut() async {
        guard !isAccountWorking else { return }
        invalidateSyncPasses()
        isAccountWorking = true
        await mirror?.account.signOut()
        syncRequestedAfterMutation = false
        _ = try? await commitLocalChange { $0.syncState = .localOnly }
        isAccountWorking = false
        accountNotice = "Signed out. This device journal is still here."
    }

    func deleteCloudAccount() async {
        guard !isAccountWorking else { return }
        // The mirror contract cannot enumerate unknown remote records or
        // provide an authoritative account-wide delete. Local tombstones are
        // therefore insufficient: refusing here preserves the session,
        // owner binding, journal, and retry bookkeeping instead of claiming a
        // deletion that may leave remote data behind.
        message = "Cloud account deletion is unavailable until an authoritative remote deletion is supported. Your journal and account are unchanged."
    }

    func syncNow(forceRefresh _: Bool = true) async {
        guard let mirror, hasLoadedDocument, !isReplacingStore else { return }
        guard !isSyncing, activeLocalMutations == 0 else {
            syncRequestedAfterMutation = true
            return
        }
        isSyncing = true
        let generation = storeGeneration
        var pass: MirrorPass?
        var outcome: MirrorRuntime.Outcome?
        do {
            try await importLegacyJournalIfNeeded(generation: generation)
            let verified = try? await mirror.identity.verifiedSyncAccount()
            let activePass = makeMirrorPass(account: verified)
            pass = activePass
            outcome = try await mirror.runtime.synchronize(
                records: { try await self.mirrorRecords(for: activePass) },
                validateLocalSnapshot: { try await self.validateMirrorPass(activePass, transportID: $0) },
                apply: { try await self.commitMirrorRecords($0, pass: activePass) }
            )
        } catch {
            // A failed import or a thrown pass is not a sync receipt: the
            // outcome stays nil and is recorded honestly below.
            outcome = nil
        }
        await recordSyncOutcome(outcome, pass: pass, generation: generation)
        isSyncing = false
        if account != nil, activeLocalMutations == 0, syncRequestedAfterMutation {
            syncRequestedAfterMutation = false
            await syncNow()
        }
    }

    private func invalidateSyncPasses() {
        storeGeneration = UUID()
    }

    func refreshFromCloud() async {
        guard !isLoading, account != nil else { return }
        await syncNow(forceRefresh: false)
    }

    /// Import completion is saved with the journal itself. A crash or failure
    /// writing the compatibility marker cannot replay deleted imported entries.
    private func importLegacyJournalIfNeeded(generation: UUID) async throws {
        guard let legacyJournal, let mirror else { return }
        guard !isReplacingStore, generation == storeGeneration else {
            throw CalorieMirrorError.documentNotLoaded
        }
        guard let verified = try await mirror.identity.verifiedSyncAccount(),
              document.cloudAccountID == verified.userID else { return }
        guard !(document.legacyImportedAccountIDs ?? []).contains(verified.userID) else { return }
        let marker = await legacyImportMarkerURL(for: verified.userID)
        let alreadyImported = FileManager.default.fileExists(atPath: marker.path)
            || legacyImportCompatMarkerExists(for: verified.userID, marker: marker)
        let snapshot = alreadyImported ? nil : try CloudJournalMapper.decode(await legacyJournal.cloudExport())
        guard !isReplacingStore, generation == storeGeneration else {
            throw CalorieMirrorError.documentNotLoaded
        }
        try await commitLocalChange { next in
            guard !isReplacingStore, generation == storeGeneration else {
                throw CalorieMirrorError.documentNotLoaded
            }
            try await mirror.identity.requireCurrentAccount(verified)
            guard next.cloudAccountID == verified.userID else {
                throw PersonalSyncOwnershipError.differentAccount
            }
            guard !(next.legacyImportedAccountIDs ?? []).contains(verified.userID) else { return }
            if let snapshot { next = CloudJournalMapper.mergeLegacyImport(into: next, cloud: snapshot) }
            next.legacyImportedAccountIDs = (next.legacyImportedAccountIDs ?? []) + [verified.userID]
        }
        guard !isReplacingStore, generation == storeGeneration else { return }
        // Older builds read this marker. The document receipt above is the
        // authority for this build, so failure here cannot trigger re-import.
        try? FileManager.default.createDirectory(
            at: marker.deletingLastPathComponent(), withIntermediateDirectories: true
        )
        try? Data("{}".utf8).write(to: marker, options: .atomic)
    }

    /// Marker names are a hash of the account ID, never the raw ID — an ID
    /// containing path separators must not be able to write outside the
    /// journal directory. Markers written by older builds with the raw ID in
    /// the filename are still honoured, but only for IDs that could not have
    /// traversed the path in the first place.
    private func legacyImportMarkerURL(for userID: String) async -> URL {
        let key = SHA256.hash(data: Data(userID.utf8)).map { String(format: "%02x", $0) }.joined()
        return await store.fileURL
            .deletingLastPathComponent()
            .appending(path: "legacy-import-\(key).done")
    }

    private func legacyImportCompatMarkerExists(for userID: String, marker: URL) -> Bool {
        guard !userID.isEmpty,
              userID.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" })
        else { return false }
        let legacy = marker.deletingLastPathComponent()
            .appending(path: "legacy-import-\(userID).done")
        return FileManager.default.fileExists(atPath: legacy.path)
    }

    private func recordSyncOutcome(_ outcome: MirrorRuntime.Outcome?, pass: MirrorPass?, generation: UUID) async {
        pendingSyncCount = (try? await mirror?.runtime.unpushedCount(
            transportID: "hub",
            records: mirrorRecords()
        )) ?? pendingSyncCount
        do {
            try await commitLocalChange {
                guard !isReplacingStore, generation == storeGeneration else {
                    throw CalorieMirrorError.documentNotLoaded
                }
                if let pass {
                    pass.transportID = outcome?.transports.contains { $0.transportID == "hub" && $0.failure == nil } == true ? "hub" : "cloudkit"
                    try await validateMirrorPassLocked(pass)
                }
            if account == nil {
                $0.syncState = .localOnly
            } else if let outcome, outcome.isComplete {
                $0.syncState = pendingSyncCount > 0 ? .pending : .synced
                // Only a fully completed pass is a sync receipt; a nil or
                // partial outcome keeps the last genuine success timestamp.
                $0.lastSyncedAt = outcome.completedAt
            } else {
                $0.syncState = .failed
            }
        }
        } catch {
            saveError = error.localizedDescription
            message = "Sync status could not be saved. Your journal was preserved; retry sync."
        }
    }

    // MARK: - Mirror records

    private static let recordEncoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        return encoder
    }()

    private static let recordDecoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    /// The document's syncable set as canonical records: every entity plus a
    /// tombstone for any stamped record that left the document. Entity payloads
    /// are the exact local JSON with `recordType` injected — the same bytes go
    /// to CloudKit and the Hub.
    func mirrorRecords(from supplied: CalorieDocument? = nil) async throws -> [MirrorRecord] {
        let doc = supplied ?? document
        var records: [MirrorRecord] = []
        for food in doc.foods {
            records.append(try await makeRecord(name: "food-\(food.id.uuidString.lowercased())", entity: food, recordType: "food"))
        }
        for entry in doc.foodEntries {
            records.append(try await makeRecord(name: "entry-\(entry.id.uuidString.lowercased())", entity: entry, recordType: "foodEntry"))
        }
        for water in doc.waterEntries {
            records.append(try await makeRecord(name: "water-\(water.id.uuidString.lowercased())", entity: water, recordType: "waterEntry"))
        }
        for weight in doc.weightEntries {
            records.append(try await makeRecord(name: "weight-\(weight.id.uuidString.lowercased())", entity: weight, recordType: "weightEntry"))
        }
        for routine in doc.routines {
            records.append(try await makeRecord(name: "routine-\(routine.id.uuidString.lowercased())", entity: routine, recordType: "routine"))
        }
        for checkIn in doc.routineCheckIns {
            records.append(try await makeRecord(name: "checkin-\(checkIn.id.uuidString.lowercased())", entity: checkIn, recordType: "checkIn"))
        }
        for session in doc.goalCycleSessions ?? [] {
            records.append(try await makeRecord(name: "goalcycle-\(session.id.uuidString.lowercased())", entity: session, recordType: "goalCycle"))
        }
        records.append(try await makeRecord(
            name: "profile-\(CalorieMirrorNaming.profileID)",
            entity: doc.profile,
            recordType: "profile"
        ))
        records.append(try await makeRecord(
            name: "cyclecontext-\(CalorieMirrorNaming.cycleContextID)",
            entity: doc.cycle,
            recordType: "cycleContext"
        ))
        records.append(try await makeRecord(
            name: "theme-\(CalorieMirrorNaming.themeID)",
            entity: MirrorThemePayload(theme: doc.theme),
            recordType: "theme"
        ))
        for (key, note) in doc.dailyNotes {
            records.append(try await makeRecord(
                name: "note-\(key)",
                entity: MirrorDailyNotePayload(date: key, text: note),
                recordType: "dailyNote"
            ))
        }
        let live = Set(records.map(\.name))
        for name in try await mirror?.runtime.knownRecordNames() ?? [] where !live.contains(name) {
            records.append(MirrorRecord(name: name, modifiedAt: .now, payload: nil, appendOnly: false))
        }
        return records
    }

    private func makeRecord<Entity: Encodable>(
        name: String,
        entity: Entity,
        recordType: String
    ) async throws -> MirrorRecord {
        let object = try JSONSerialization.jsonObject(with: Self.recordEncoder.encode(entity))
        guard var fields = object as? [String: Any] else {
            throw CalorieMirrorError.invalidEntity(name)
        }
        fields["recordType"] = recordType
        let payload = try JSONSerialization.data(withJSONObject: fields, options: [.sortedKeys])
        let stamp = try await mirror?.runtime.stamp(for: name)
        let modifiedAt = stamp?.fingerprint == MirrorLedger.fingerprint(of: payload)
            ? stamp?.modifiedAt ?? .now
            : .now
        return MirrorRecord(name: name, modifiedAt: modifiedAt, payload: payload, appendOnly: false)
    }

    private func allTombstoneRecords() async throws -> [MirrorRecord] {
        try await mirrorRecords().map {
            MirrorRecord(name: $0.name, modifiedAt: .now, payload: nil, appendOnly: false)
        }
    }

    /// Commits pulled winners into the local document. Throwing leaves the
    /// pull token unsaved so the batch retries on the next pass.
    func commitMirrorRecords(_ records: [MirrorRecord], pass: MirrorPass? = nil) async throws {
        await acquireLocalWrite()
        defer { releaseLocalWrite() }
        guard hasLoadedDocument else { throw CalorieMirrorError.documentNotLoaded }
        if let pass { try await validateMirrorPassLocked(pass) }
        var next = document
        var changed = false
        for record in records {
            guard let kind = CalorieMirrorNaming.kind(of: record.name) else { continue }
            try validateMirrorRecordIdentity(record, kind: kind)
            if let payload = record.payload {
                changed = try applyUpsert(kind: kind, payload: payload, to: &next) || changed
            } else {
                changed = applyTombstone(kind: kind, name: record.name, to: &next) || changed
            }
        }
        guard changed else { return }
        try await store.save(next)
        document = next
        localMutationRevision += 1
        if let pass {
            pass.expected = document
            try await validateMirrorPassLocked(pass)
        }
    }

    private func validateMirrorRecordIdentity(
        _ record: MirrorRecord,
        kind: CalorieMirrorNaming.Kind
    ) throws {
        switch kind {
        case .profile:
            guard record.name == "profile-\(CalorieMirrorNaming.profileID)" else {
                throw CalorieMirrorError.invalidEntity(record.name)
            }
        case .cycleContext:
            guard record.name == "cyclecontext-\(CalorieMirrorNaming.cycleContextID)" else {
                throw CalorieMirrorError.invalidEntity(record.name)
            }
        case .theme:
            guard record.name == "theme-\(CalorieMirrorNaming.themeID)" else {
                throw CalorieMirrorError.invalidEntity(record.name)
            }
        case .dailyNote:
            guard let payload = record.payload,
                  let note = try? decode(MirrorDailyNotePayload.self, from: payload),
                  record.name == "note-\(note.date)" else {
                if record.payload == nil { return }
                throw CalorieMirrorError.invalidEntity(record.name)
            }
        case .food, .foodEntry, .waterEntry, .weightEntry, .routine, .checkIn, .goalCycle:
            guard let expectedID = CalorieMirrorNaming.entityID(of: record.name) else {
                throw CalorieMirrorError.invalidEntity(record.name)
            }
            guard record.payload == nil || decodedEntityID(kind: kind, payload: record.payload!) == expectedID else {
                throw CalorieMirrorError.invalidEntity(record.name)
            }
        }
    }

    private func decodedEntityID(
        kind: CalorieMirrorNaming.Kind,
        payload: Data
    ) -> UUID? {
        switch kind {
        case .food: try? decode(Food.self, from: payload).id
        case .foodEntry: try? decode(FoodEntry.self, from: payload).id
        case .waterEntry: try? decode(WaterEntry.self, from: payload).id
        case .weightEntry: try? decode(WeightEntry.self, from: payload).id
        case .routine: try? decode(MedicationRoutine.self, from: payload).id
        case .checkIn: try? decode(RoutineCheckIn.self, from: payload).id
        case .goalCycle: try? decode(GoalCycleSession.self, from: payload).id
        case .profile, .cycleContext, .theme, .dailyNote: nil
        }
    }

    @MainActor
    final class MirrorPass {
        var expected: CalorieDocument
        let generation: UUID
        let account: PersonalSyncAccount?
        var transportID = "cloudkit"
        init(document: CalorieDocument, generation: UUID, account: PersonalSyncAccount?) {
            expected = document
            self.generation = generation
            self.account = account
        }
    }

    func makeMirrorPass(account: PersonalSyncAccount? = nil) -> MirrorPass {
        MirrorPass(document: document, generation: storeGeneration, account: account)
    }

    private func mirrorRecords(for pass: MirrorPass) async throws -> [MirrorRecord] {
        guard !isReplacingStore, pass.generation == storeGeneration else {
            throw CalorieMirrorError.documentNotLoaded
        }
        pass.expected = document
        return try await mirrorRecords(from: pass.expected)
    }

    private func validateMirrorPass(_ pass: MirrorPass, transportID: String) async throws {
        await acquireLocalWrite()
        defer { releaseLocalWrite() }
        pass.transportID = transportID
        try await validateMirrorPassLocked(pass)
    }

    private func validateMirrorPassLocked(_ pass: MirrorPass) async throws {
        guard !isReplacingStore, pass.generation == storeGeneration, document == pass.expected else {
            throw CalorieMirrorError.documentNotLoaded
        }
        if pass.transportID == "hub" {
            guard let verified = pass.account, let mirror, document.cloudAccountID == verified.userID else {
                throw PersonalSyncOwnershipError.differentAccount
            }
            try await mirror.identity.requireCurrentAccount(verified)
        }
        guard !isReplacingStore, pass.generation == storeGeneration, document == pass.expected else {
            throw CalorieMirrorError.documentNotLoaded
        }
    }

    private func decode<Entity: Decodable>(_ type: Entity.Type, from payload: Data) throws -> Entity {
        try Self.recordDecoder.decode(type, from: payload)
    }

    private func applyUpsert(
        kind: CalorieMirrorNaming.Kind,
        payload: Data,
        to document: inout CalorieDocument
    ) throws -> Bool {
        switch kind {
        case .food, .foodEntry, .waterEntry, .weightEntry, .routine, .checkIn, .goalCycle:
            return try applyCollectionUpsert(kind: kind, payload: payload, to: &document)
        case .profile, .cycleContext, .theme, .dailyNote:
            return try applySingletonUpsert(kind: kind, payload: payload, to: &document)
        }
    }

    private func applyCollectionUpsert(
        kind: CalorieMirrorNaming.Kind,
        payload: Data,
        to document: inout CalorieDocument
    ) throws -> Bool {
        switch kind {
        case .food:
            return upsert(try decode(Food.self, from: payload), into: &document.foods)
        case .foodEntry:
            return upsert(try decode(FoodEntry.self, from: payload), into: &document.foodEntries)
        case .waterEntry:
            return upsert(try decode(WaterEntry.self, from: payload), into: &document.waterEntries)
        case .weightEntry:
            return upsert(try decode(WeightEntry.self, from: payload), into: &document.weightEntries)
        case .routine:
            return upsert(try decode(MedicationRoutine.self, from: payload), into: &document.routines)
        case .checkIn:
            return upsert(try decode(RoutineCheckIn.self, from: payload), into: &document.routineCheckIns)
        default:
            var sessions = document.goalCycleSessions ?? []
            let changed = upsert(try decode(GoalCycleSession.self, from: payload), into: &sessions)
            if changed { document.goalCycleSessions = sessions }
            return changed
        }
    }

    private func applySingletonUpsert(
        kind: CalorieMirrorNaming.Kind,
        payload: Data,
        to document: inout CalorieDocument
    ) throws -> Bool {
        switch kind {
        case .profile:
            let profile = try decode(Profile.self, from: payload)
            guard document.profile != profile else { return false }
            document.profile = profile
        case .cycleContext:
            let cycle = try decode(CycleContext.self, from: payload)
            guard document.cycle != cycle else { return false }
            document.cycle = cycle
        case .theme:
            let theme = try decode(MirrorThemePayload.self, from: payload).theme
            guard document.theme != theme else { return false }
            document.theme = theme
        default:
            let note = try decode(MirrorDailyNotePayload.self, from: payload)
            guard document.dailyNotes[note.date] != note.text else { return false }
            document.dailyNotes[note.date] = note.text
        }
        return true
    }

    private func upsert<Value: Identifiable & Equatable>(
        _ value: Value,
        into collection: inout [Value]
    ) -> Bool {
        if let index = collection.firstIndex(where: { $0.id == value.id }) {
            guard collection[index] != value else { return false }
            collection[index] = value
            return true
        }
        collection.append(value)
        return true
    }

    private func applyTombstone(
        kind: CalorieMirrorNaming.Kind,
        name: String,
        to document: inout CalorieDocument
    ) -> Bool {
        if case .dailyNote = kind {
            let key = CalorieMirrorNaming.noteKey(of: name)
            guard let key, document.dailyNotes.removeValue(forKey: key) != nil else { return false }
            return true
        }
        guard let id = CalorieMirrorNaming.entityID(of: name) else { return false }
        return applyCollectionTombstone(kind: kind, id: id, to: &document)
    }

    private func applyCollectionTombstone(
        kind: CalorieMirrorNaming.Kind,
        id: UUID,
        to document: inout CalorieDocument
    ) -> Bool {
        switch kind {
        case .food:
            return remove(id, from: &document.foods)
        case .foodEntry:
            return remove(id, from: &document.foodEntries)
        case .waterEntry:
            return remove(id, from: &document.waterEntries)
        case .weightEntry:
            return remove(id, from: &document.weightEntries)
        case .routine:
            return remove(id, from: &document.routines)
        case .checkIn:
            return remove(id, from: &document.routineCheckIns)
        case .goalCycle:
            var sessions = document.goalCycleSessions ?? []
            let changed = remove(id, from: &sessions)
            if changed { document.goalCycleSessions = sessions }
            return changed
        case .dailyNote:
            return false
        case .profile, .cycleContext, .theme:
            // Singletons are never deleted — a tombstone for one is ignored so
            // a stale remote delete cannot blank the journal's settings.
            return false
        }
    }

    private func remove<Value: Identifiable>(
        _ id: UUID,
        from collection: inout [Value]
    ) -> Bool where Value.ID == UUID {
        guard let index = collection.firstIndex(where: { $0.id == id }) else { return false }
        collection.remove(at: index)
        return true
    }

    private func acquireLocalWrite() async {
        if isSaving {
            await withCheckedContinuation { localWriteWaiters.append($0) }
        } else {
            isSaving = true
        }
    }

    private func releaseLocalWrite() {
        if localWriteWaiters.isEmpty {
            isSaving = false
        } else {
            localWriteWaiters.removeFirst().resume()
        }
    }

    @discardableResult
    private func commitLocalChange(
        allowUnread: Bool = false,
        _ operation: (inout CalorieDocument) async throws -> Void
    ) async throws -> CalorieDocument {
        guard hasLoadedDocument || allowUnread else { throw CocoaError(.fileReadCorruptFile) }
        await acquireLocalWrite()
        defer { releaseLocalWrite() }
        let previous = document
        var next = previous
        try await operation(&next)
        try await store.save(next)
        document = next
        localMutationRevision += 1
        return previous
    }

    @discardableResult
    private func mutate(
        allowUnread: Bool = false,
        _ operation: (inout CalorieDocument) throws -> Void
    ) async -> Bool {
        guard hasLoadedDocument || allowUnread else {
            message = "Your journal could not be opened. Retry opening it or restore a backup before making changes."
            return false
        }
        activeLocalMutations += 1
        await acquireLocalWrite()
        var shouldRequestSync = false
        var succeeded = false
        do {
            var next = document
            try operation(&next)
            if account != nil { next.syncState = .pending }
            try await store.save(next)
            document = next
            localMutationRevision += 1
            hasLoadedDocument = true
            succeeded = true
            saveError = nil
            shouldRequestSync = account != nil
        } catch {
            saveError = error.localizedDescription
            message = error.localizedDescription
        }
        finishLocalMutation(requestSync: shouldRequestSync)
        return succeeded
    }

    private func finishLocalMutation(requestSync: Bool) {
        if requestSync { syncRequestedAfterMutation = true }
        activeLocalMutations -= 1
        releaseLocalWrite()
        if activeLocalMutations == 0, syncRequestedAfterMutation {
            syncRequestedAfterMutation = false
            Task { await syncNow() }
        }
    }

    private static func makeMirrorConnection() -> PersonalMirrorConnection? {
        let defaults = UserDefaults.standard
        let key = "personal-platform-device-id"
        let deviceId = defaults.string(forKey: key) ?? UUID().uuidString.lowercased()
        defaults.set(deviceId, forKey: key)
        return try? PersonalMirrorConnection(
            domain: .calorie,
            keychainService: "com.significanthobbies.calorie.session",
            supportDirectory: FileManager.default
                .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                .appending(path: "Calorie", directoryHint: .isDirectory),
            deviceId: deviceId,
            callbackScheme: "calorie",
            cloudKitContainer: "iCloud.com.significanthobbies.calorie",
            appendOnly: { _ in false },
            // The committed document owns the Hub binding. Until it is bound to
            // the verified account the Hub leg stays quiet; CloudKit still syncs.
            accountGate: { verified in
                (try? await CalorieStore().load())?.cloudAccountID == verified.userID
            }
        )
    }
}

enum CalorieMirrorError: Error {
    case invalidEntity(String)
    case documentNotLoaded
}

enum CalorieMirrorNaming {
    enum Kind {
        case food, foodEntry, waterEntry, weightEntry, routine, checkIn
        case goalCycle, profile, cycleContext, theme, dailyNote
    }

    static let profileID = "00000000-0000-0000-0000-0000000000a1"
    static let cycleContextID = "00000000-0000-0000-0000-0000000000a2"
    static let themeID = "00000000-0000-0000-0000-0000000000a3"

    static func kind(of recordName: String) -> Kind? {
        switch true {
        case recordName.hasPrefix("food-"): .food
        case recordName.hasPrefix("entry-"): .foodEntry
        case recordName.hasPrefix("water-"): .waterEntry
        case recordName.hasPrefix("weight-"): .weightEntry
        case recordName.hasPrefix("routine-"): .routine
        case recordName.hasPrefix("checkin-"): .checkIn
        case recordName.hasPrefix("goalcycle-"): .goalCycle
        case recordName.hasPrefix("profile-"): .profile
        case recordName.hasPrefix("cyclecontext-"): .cycleContext
        case recordName.hasPrefix("theme-"): .theme
        case recordName.hasPrefix("note-"): .dailyNote
        default: nil
        }
    }

    static func entityID(of recordName: String) -> UUID? {
        guard let index = recordName.firstIndex(of: "-") else { return nil }
        return UUID(uuidString: String(recordName[recordName.index(after: index)...]))
    }

    static func noteKey(of recordName: String) -> String? {
        guard recordName.hasPrefix("note-") else { return nil }
        return String(recordName.dropFirst(5))
    }
}

struct MirrorThemePayload: Codable {
    var theme: AppTheme
}

struct MirrorDailyNotePayload: Codable {
    var date: String
    var text: String
}
