import CalorieCore
import Foundation
import Observation
import PersonalSyncKit
import SwiftUI

@MainActor
@Observable
final class AppModel {
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
    private var attemptedLegacyImport = false

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
        // Replacing the journal must not propagate as a mass deletion: clear
        // sync bookkeeping first so the imported set is mirrored fresh and a
        // following pull restores remote records rather than tombstoning them.
        try? await mirror?.runtime.forgetBookkeeping()
        guard await mutate(allowUnread: true, { $0 = importPreview }) else { return }
        self.importPreview = nil
        isImportConfirmationPresented = false
        message = "Calorie journal replaced."
    }

    func resetLocalData() async {
        do {
            try await mirror?.runtime.forgetBookkeeping()
            try await commitLocalChange(allowUnread: true) { $0 = .starter }
            hasLoadedDocument = true
            saveError = nil
            message = "Local journal reset."
        } catch {
            message = error.localizedDescription
        }
    }

    func connectExistingAccount() async {
        guard !isAccountWorking else { return }
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
        isAccountWorking = true
        defer { isAccountWorking = false }
        await finishSignIn()
    }

    /// Binds this journal to the signed-in account and lets the mirror run.
    /// Records merge per-entity afterwards — the newest version of each record
    /// wins — so unlike the retired journal-choice sheet there is nothing to
    /// pick between.
    func approveCloudAccount() async {
        guard let userID = account?.userID, needsAccountApproval, !isAccountWorking else { return }
        isAccountWorking = true
        defer { isAccountWorking = false }
        do {
            try await commitLocalChange {
                $0.cloudAccountID = userID
                if $0.syncState == .conflict { $0.syncState = .pending }
            }
            try await mirror?.runtime.bindOwner(userID)
            isApprovalPresented = false
            accountNotice = "Journal connected. Your records now merge privately across iCloud and Significant Hobbies."
            await syncNow()
        } catch PersonalSyncOwnershipError.differentAccount {
            accountNotice = "This connection is already approved under a different account. Sign in to that account to sync."
        } catch {
            message = "Could not connect this journal to your account. Your local journal is unchanged."
        }
    }

    func deferApproval() {
        isApprovalPresented = false
        accountNotice = "Your journal is unchanged. Connect it whenever you are ready."
    }

    func signOut() async {
        guard !isAccountWorking else { return }
        isAccountWorking = true
        await mirror?.account.signOut()
        syncRequestedAfterMutation = false
        _ = try? await commitLocalChange { $0.syncState = .localOnly }
        isAccountWorking = false
        accountNotice = "Signed out. This device journal is still here."
    }

    func deleteCloudAccount() async {
        guard !isAccountWorking else { return }
        isAccountWorking = true
        defer { isAccountWorking = false }
        do {
            // Push tombstones for every record while the binding is still open,
            // then clear the legacy worker copy before unbinding.
            let tombstones = try await allTombstoneRecords()
            _ = try? await mirror?.runtime.synchronize(records: { tombstones }, apply: { _ in })
            try? await legacyJournal?.deleteData()
            await mirror?.account.signOut()
            try await mirror?.runtime.forgetBookkeeping()
            pendingSyncCount = 0
            syncRequestedAfterMutation = false
            try await commitLocalChange {
                $0.cloudAccountID = nil
                $0.syncState = .localOnly
            }
            accountNotice = "Calorie cloud data deleted. This device journal was preserved."
        } catch {
            message = "Could not finish deleting the cloud account. Nothing was removed from this device."
        }
    }

    func syncNow(forceRefresh _: Bool = true) async {
        guard let mirror, hasLoadedDocument else { return }
        guard !isSyncing, activeLocalMutations == 0 else {
            syncRequestedAfterMutation = true
            return
        }
        isSyncing = true
        await importLegacyJournalIfNeeded()
        let outcome = try? await mirror.runtime.synchronize(
            records: { try await self.mirrorRecords() },
            apply: { records in try await self.commitMirrorRecords(records) }
        )
        await recordSyncOutcome(outcome)
        isSyncing = false
        if account != nil, activeLocalMutations == 0, syncRequestedAfterMutation {
            syncRequestedAfterMutation = false
            await syncNow()
        }
    }

    func refreshFromCloud() async {
        guard !isLoading, account != nil else { return }
        await syncNow(forceRefresh: false)
    }

    /// One-shot import of the retired Calorie worker's journal. The legacy
    /// export carries the same stable entity IDs, so the merge is idempotent;
    /// a marker file keeps it from re-running on every sync.
    private func importLegacyJournalIfNeeded() async {
        guard let legacyJournal, !attemptedLegacyImport,
              let userID = account?.userID, document.cloudAccountID == userID else { return }
        attemptedLegacyImport = true
        let marker = await legacyImportMarkerURL(for: userID)
        guard !FileManager.default.fileExists(atPath: marker.path) else { return }
        do {
            let snapshot = try CloudJournalMapper.decode(await legacyJournal.cloudExport())
            try await commitLocalChange {
                $0 = CloudJournalMapper.mergeLegacyImport(into: $0, cloud: snapshot)
            }
            try FileManager.default.createDirectory(
                at: marker.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            try Data("{}".utf8).write(to: marker, options: .atomic)
        } catch {
            // The import is best-effort — a missing or empty legacy journal is
            // normal for accounts created after the mirror migration.
        }
    }

    private func legacyImportMarkerURL(for userID: String) async -> URL {
        await store.fileURL
            .deletingLastPathComponent()
            .appending(path: "legacy-import-\(userID).done")
    }

    private func recordSyncOutcome(_ outcome: MirrorRuntime.Outcome?) async {
        pendingSyncCount = (try? await mirror?.runtime.unpushedCount(
            transportID: "hub",
            records: mirrorRecords()
        )) ?? pendingSyncCount
        let syncedAt = outcome?.completedAt
        _ = try? await commitLocalChange {
            if account == nil {
                $0.syncState = .localOnly
            } else if let outcome, !outcome.isComplete {
                $0.syncState = .failed
            } else {
                $0.syncState = pendingSyncCount > 0 ? .pending : .synced
            }
            if let syncedAt { $0.lastSyncedAt = syncedAt }
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
    func mirrorRecords() async throws -> [MirrorRecord] {
        let doc = document
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
    func commitMirrorRecords(_ records: [MirrorRecord]) async throws {
        await acquireLocalWrite()
        defer { releaseLocalWrite() }
        guard hasLoadedDocument else { throw CalorieMirrorError.documentNotLoaded }
        var next = document
        var changed = false
        for record in records {
            guard let kind = CalorieMirrorNaming.kind(of: record.name) else { continue }
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
        guard let id = CalorieMirrorNaming.entityID(of: name) else { return false }
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
            let key = CalorieMirrorNaming.noteKey(of: name)
            guard let key, document.dailyNotes.removeValue(forKey: key) != nil else { return false }
            return true
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
        _ operation: (inout CalorieDocument) throws -> Void
    ) async throws -> CalorieDocument {
        guard hasLoadedDocument || allowUnread else { throw CocoaError(.fileReadCorruptFile) }
        await acquireLocalWrite()
        defer { releaseLocalWrite() }
        let previous = document
        var next = previous
        try operation(&next)
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
