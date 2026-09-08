import CalorieCore
import Foundation
import Observation
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
    private(set) var account: CalorieAccount? {
        didSet { accountRevision += 1 }
    }
    private var accountRevision = 0
    private var cloudSnapshotRevision: Int?
    private(set) var isAccountWorking = false
    private(set) var accountNotice: String?
    private(set) var cloudSnapshot: CloudJournalSnapshot?
    var isReconciliationPresented = false
    private(set) var pendingSyncCount = 0
    private(set) var isSyncing = false
    private(set) var forceCalorieOnboarding = false

    private let store: CalorieStore
    private let accountClient: any NativeAccountServing
    private let syncStore: SyncIntentStore
    private let cloudQuery: ServerStateQueryCache<CloudJournalSnapshot>
    private let webAuthentication = WebAuthenticationCoordinator()
    private var activeLocalMutations = 0
    private var localMutationRevision = 0
    private var syncRequestedAfterMutation = false

    init(
        store: CalorieStore = CalorieStore(),
        accountClient: any NativeAccountServing = NativeAccountClient(),
        syncStore: SyncIntentStore = SyncIntentStore(),
        cloudQuery: ServerStateQueryCache<CloudJournalSnapshot> = ServerStateQueryCache()
    ) {
        self.store = store
        self.accountClient = accountClient
        self.syncStore = syncStore
        self.cloudQuery = cloudQuery
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
        account = try? await accountClient.restoreAccount()
        pendingSyncCount = (try? await syncStore.pending().count) ?? 0
        if account != nil {
            if document.syncState == .localOnly {
                await prepareCloudReconciliation()
            } else {
                await syncNow()
            }
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
            cloudActivityCount: cloudSnapshot?.counts.activityTotal ?? 0,
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
        guard await mutate(allowUnread: true, { $0 = importPreview }) else { return }
        self.importPreview = nil
        isImportConfirmationPresented = false
        message = "Calorie journal replaced."
    }

    func resetLocalData() async {
        do {
            try await commitLocalChange(allowUnread: true) { $0 = .starter }
            hasLoadedDocument = true
            saveError = nil
            message = "Local journal reset."
        } catch {
            message = error.localizedDescription
        }
    }

    private func beginAccountChange() -> Bool {
        guard !isAccountWorking else { return false }
        accountRevision += 1
        cloudSnapshot = nil
        cloudSnapshotRevision = nil
        return true
    }

    func connectExistingAccount() async {
        guard beginAccountChange() else { return }
        accountNotice = nil
        isAccountWorking = true
        defer { isAccountWorking = false }
        do {
            let startURL = await accountClient.googleStartURL
            let callback = try await webAuthentication.authenticate(at: startURL)
            guard
                let components = URLComponents(url: callback, resolvingAgainstBaseURL: false),
                let code = components.queryItems?.first(where: { $0.name == "code" })?.value
            else { throw NativeAccountError.invalidCallback }
            account = try await accountClient.exchangeGoogleHandoff(code)
            await cloudQuery.clear()
            accountNotice = CalorieAccountCopy.existingAccountConnected
            await prepareCloudReconciliation()
        } catch {
            message = accountErrorMessage(error, recovery: "Try connecting your existing journal again.")
        }
    }

    func completeAppleSignIn(_ payload: AppleIdentityPayload) async {
        guard beginAccountChange() else { return }
        accountNotice = nil
        isAccountWorking = true
        defer { isAccountWorking = false }
        do {
            if let account, !account.hasApple {
                self.account = try await accountClient.linkApple(payload)
                await cloudQuery.clear()
                await prepareCloudReconciliation()
            } else {
                account = try await accountClient.signInWithApple(payload)
                await cloudQuery.clear()
                await prepareCloudReconciliation()
            }
        } catch let error as NativeAccountError where error.requiresExistingAccountRecovery {
            await recoverFromUnlinkedCalorieAccount()
        } catch {
            message = accountErrorMessage(error, recovery: "Try Apple sign-in again. Your device journal has not changed.")
        }
    }

    private func recoverFromUnlinkedCalorieAccount() async {
        let wasAccountWorking = isAccountWorking
        isAccountWorking = true
        defer { isAccountWorking = wasAccountWorking }
        accountRevision += 1
        await cloudQuery.clear()
        cloudSnapshot = nil
        _ = try? await commitLocalChange { $0.syncState = .localOnly }
        if let account, !account.hasApple {
            accountNotice = "Existing Calorie account connected. Add Sign in with Apple to finish linking your cloud journal."
            message = "Add Sign in with Apple once to connect this account to the retained Calorie journal. Your journal on this device has not changed."
            return
        }
        await accountClient.signOut()
        account = nil
        accountNotice = "Reopen your existing Calorie account with Google first, then add Sign in with Apple."
        message = "This Apple sign-in is not linked to your existing Calorie journal. Your journal on this device has not changed."
    }

    func signOut() async {
        guard beginAccountChange() else { return }
        isAccountWorking = true
        await cloudQuery.clear()
        await accountClient.signOut()
        account = nil
        cloudSnapshot = nil
        syncRequestedAfterMutation = false
        _ = try? await commitLocalChange { $0.syncState = .localOnly }
        isAccountWorking = false
        accountNotice = "Signed out. This device journal is still here."
    }

    func deleteCloudAccount() async {
        guard beginAccountChange() else { return }
        isAccountWorking = true
        defer { isAccountWorking = false }
        do {
            try await accountClient.deleteAccount()
            try await syncStore.removeAll()
            await cloudQuery.clear()
            pendingSyncCount = 0
            account = nil
            cloudSnapshot = nil
            syncRequestedAfterMutation = false
            try await commitLocalChange { $0.syncState = .localOnly }
            accountNotice = "Calorie cloud data deleted. This device journal was preserved."
        } catch {
            message = accountErrorMessage(error, recovery: "Try deleting the cloud account again. Nothing was removed from this device.")
        }
    }

    func reconcileJournal(_ choice: JournalReconciliationChoice) async {
        guard let cloudSnapshot, let ownerID = account?.userID,
              cloudSnapshotRevision == accountRevision, !isAccountWorking else { return }
        accountRevision += 1
        let revision = accountRevision
        isAccountWorking = true
        defer { isAccountWorking = false }
        guard await mutate(cloudBaseline: cloudSnapshot.document, clearPending: true, enqueueChanges: choice != .keepCloud, {
            guard self.accountRevision == revision else { throw NativeAccountError.accountChanged }
            $0 = CloudJournalMapper.reconcile(local: $0, cloud: cloudSnapshot, choice: choice)
            $0.cloudAccountID = ownerID
        }) else { return }
        self.cloudSnapshot = nil
        isReconciliationPresented = false
        if document.syncState != .conflict {
            accountNotice = switch choice {
            case .keepCloud: "Your current cloud journal is now on this device."
            case .keepIPhone: "This device journal is preserved and queued for cloud sync."
            case .merge: "Cloud and device records were merged without duplicate IDs."
            }
        }
    }

    func deferReconciliation() {
        isReconciliationPresented = false
        accountNotice = "Your journals are unchanged. Resolve them whenever you are ready."
    }

    func resumeReconciliation() async {
        if cloudSnapshot != nil {
            isReconciliationPresented = true
        } else {
            await prepareCloudReconciliation()
        }
    }

    private func prepareCloudReconciliation() async {
        guard let ownerID = account?.userID else { return }
        let revision = accountRevision
        do {
            try await commitLocalChange { $0.syncState = .conflict }
            let journal = try await accountClient.journal(for: ownerID)
            guard accountRevision == revision else { return }
            let result = try await fetchCloud(policy: .always, journal: journal)
            guard accountRevision == revision else { return }
            cloudSnapshot = result.value
            cloudSnapshotRevision = revision
            isReconciliationPresented = true
        } catch let error as NativeAccountError where error.requiresExistingAccountRecovery {
            guard accountRevision == revision else { return }
            await recoverFromUnlinkedCalorieAccount()
        } catch {
            guard accountRevision == revision else { return }
            message = accountErrorMessage(error, recovery: "Try loading your cloud journal again. This device journal has not changed.")
        }
    }

    func syncNow(forceRefresh: Bool = true) async {
        guard let ownerID = account?.userID else { return }
        let accountRevisionBeforeSync = accountRevision
        guard !isSyncing else {
            syncRequestedAfterMutation = true
            return
        }
        guard activeLocalMutations == 0 else {
            syncRequestedAfterMutation = true
            return
        }
        if await requiresJournalChoice() {
            await resumeReconciliation()
            return
        }
        guard accountRevision == accountRevisionBeforeSync else { return }
        isSyncing = true
        do {
            let journal = try await accountClient.journal(for: ownerID)
            try await synchronizeJournal(journal, revision: accountRevisionBeforeSync, forceRefresh: forceRefresh)
        } catch {
            if accountRevision == accountRevisionBeforeSync {
                await handleSyncFailure(error, revision: accountRevisionBeforeSync)
            }
        }
        isSyncing = false
        if account != nil, activeLocalMutations == 0, syncRequestedAfterMutation {
            syncRequestedAfterMutation = false
            await syncNow()
        }
    }

    private func synchronizeJournal(
        _ journal: any NativeJournalServing, revision: Int, forceRefresh: Bool
    ) async throws {
    while true {
        try requireCurrentAccount(revision)
        let replayedPending = try await replayPendingSyncIntents(
            journal: journal, accountRevision: revision)
        guard try await syncStore.pending().isEmpty else { continue }
        let revisionBeforeFetch = localMutationRevision
        let query = try await fetchCloud(
            policy: cloudPolicy(forceRefresh: forceRefresh, replayedPending: replayedPending),
            journal: journal
        )
        try requireCurrentAccount(revision)
        guard activeLocalMutations == 0, revisionBeforeFetch == localMutationRevision else {
            syncRequestedAfterMutation = true
            break
        }
        guard try await syncStore.pending().isEmpty else { continue }
        if query.source == .network {
            let applied = try await applyCloudSnapshot(query.value, revision: revisionBeforeFetch, accountRevision: revision)
            if !applied {
                syncRequestedAfterMutation = true
                break
            }
        }
        guard try await syncStore.pending().isEmpty else { continue }
        break
    }
    }

    private func requireCurrentAccount(_ revision: Int) throws {
        guard account != nil, accountRevision == revision else { throw NativeAccountError.accountChanged }
    }

    private func requiresJournalChoice() async -> Bool {
        if let ownerID = account?.userID, document.cloudAccountID != ownerID {
            _ = try? await commitLocalChange { $0.syncState = .conflict }
            return true
        }
        if document.syncState == .pending, (try? await syncStore.pending().isEmpty) == true {
            // An older build may have committed a journal without its intent.
            // Preserve that journal for an explicit choice after a restart.
            _ = try? await commitLocalChange { $0.syncState = .conflict }
        }
        return document.syncState == .conflict
    }

    private func handleSyncFailure(_ error: Error, revision: Int) async {
        if let accountError = error as? NativeAccountError,
           accountError.requiresExistingAccountRecovery {
            await recoverFromUnlinkedCalorieAccount()
            return
        }
        let pendingCount = (try? await syncStore.pending().count) ?? pendingSyncCount
        guard accountRevision == revision else { return }
        pendingSyncCount = pendingCount
        _ = try? await commitLocalChange {
            try self.requireCurrentAccount(revision)
            if $0.syncState != .conflict { $0.syncState = pendingCount > 0 ? .pending : .failed }
        }
        guard accountRevision == revision else { return }
        message = accountErrorMessage(error, recovery: "Your changes are saved on this device and cloud sync can be retried.")
    }

    private func replayPendingSyncIntents(
        journal: any NativeJournalServing, accountRevision revision: Int
    ) async throws -> Bool {
        let pending = try await syncStore.pending()
        try requireCurrentAccount(revision)
        pendingSyncCount = pending.count
        guard !pending.isEmpty else { return false }
        await cloudQuery.invalidate()
        for intent in pending {
            try requireCurrentAccount(revision)
            try await journal.apply(intent)
            await acquireLocalWrite()
            do {
                try requireCurrentAccount(revision)
                try await syncStore.complete(intent.id)
                try requireCurrentAccount(revision)
                pendingSyncCount -= 1
                releaseLocalWrite()
            } catch {
                releaseLocalWrite()
                throw error
            }
        }
        return true
    }

    private func cloudPolicy(
        forceRefresh: Bool,
        replayedPending: Bool
    ) -> ServerStateQueryPolicy {
        forceRefresh || replayedPending ? .always : .ifStale
    }

    func refreshFromCloud() async {
        guard !isLoading, account != nil else { return }
        await syncNow(forceRefresh: false)
    }

    private func fetchCloud(
        policy: ServerStateQueryPolicy,
        journal: any NativeJournalServing
    ) async throws -> ServerStateQueryResult<CloudJournalSnapshot> {
        try await cloudQuery.value(policy: policy) { [journal] in
            try CloudJournalMapper.decode(await journal.cloudExport())
        }
    }

    private func accountErrorMessage(_ error: Error, recovery: String) -> String {
        let detail = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        return "\(detail) \(recovery)"
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

    private func applyCloudSnapshot(
        _ snapshot: CloudJournalSnapshot, revision: Int, accountRevision expectedAccountRevision: Int
    ) async throws -> Bool {
        await acquireLocalWrite()
        defer { releaseLocalWrite() }
        guard hasLoadedDocument, let account, accountRevision == expectedAccountRevision,
              document.cloudAccountID == account.userID, document.syncState != .conflict,
              activeLocalMutations == 0, localMutationRevision == revision else { return false }
        var next = CloudJournalMapper.reconcile(local: document, cloud: snapshot, choice: .keepCloud)
        next.cloudAccountID = account.userID
        try await store.save(next)
        document = next
        localMutationRevision += 1
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

    private func prepareLocalCommit(_ next: CalorieDocument, stagesSync: Bool) async -> CalorieDocument {
        var prepared = next
        if account != nil, stagesSync {
            // Retain the journal if the app stops before its separate outbox
            // becomes durable, including explicit imports and choices.
            prepared.syncState = .conflict
            await cloudQuery.invalidate()
        } else if account == nil {
            prepared.syncState = .localOnly
        }
        return prepared
    }

    private func persistSyncOperations(
        _ operations: [SyncOperation],
        clearPending: Bool,
        canAutomaticallySync: Bool,
        stagesSync: Bool
    ) async throws -> Bool {
        guard let ownerID = account?.userID, document.cloudAccountID == ownerID else { return false }
        if clearPending { try await syncStore.removeAll() }
        for operation in operations { try await syncStore.enqueue(operation) }
        pendingSyncCount = (try await syncStore.pending()).count
        guard canAutomaticallySync, stagesSync else { return false }
        var ready = document
        ready.syncState = pendingSyncCount > 0 ? .pending : .synced
        try await store.save(ready)
        document = ready
        return pendingSyncCount > 0
    }

    @discardableResult
    private func mutate(
        allowUnread: Bool = false,
        cloudBaseline: CalorieDocument? = nil,
        clearPending: Bool = false,
        enqueueChanges: Bool = true,
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
            let previous = document
            var next = previous
            try operation(&next)
            let syncOperations = account == nil || !enqueueChanges || (clearPending && cloudBaseline == nil) ? []
                : CloudJournalDiff.operations(from: cloudBaseline ?? previous, to: next)
            let stagesSync = !syncOperations.isEmpty || clearPending || allowUnread
            next = await prepareLocalCommit(next, stagesSync: stagesSync)
            try await store.save(next)
            document = next
            localMutationRevision += 1
            hasLoadedDocument = true
            succeeded = true
            saveError = nil
            shouldRequestSync = try await persistSyncOperations(
                syncOperations,
                clearPending: clearPending,
                canAutomaticallySync: !allowUnread && (previous.syncState != .conflict || cloudBaseline != nil),
                stagesSync: stagesSync
            )
        } catch {
            if succeeded {
                syncRequestedAfterMutation = false
                accountNotice = "Saved on this device. Review your journals before retrying cloud sync: \(error.localizedDescription)"
            } else {
                saveError = error.localizedDescription
                message = error.localizedDescription
            }
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
}
