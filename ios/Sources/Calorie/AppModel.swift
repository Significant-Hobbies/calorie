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
    var isQuickLogPresented = false
    var message: String?
    var lastDeletedEntry: FoodEntry?
    var importPreview: CalorieDocument?
    var isImportConfirmationPresented = false
    private(set) var account: CalorieAccount?
    private(set) var isAccountWorking = false
    private(set) var accountNotice: String?
    private(set) var cloudSnapshot: CloudJournalSnapshot?
    var isReconciliationPresented = false
    private(set) var pendingSyncCount = 0
    private(set) var isSyncing = false

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
            document = ProcessInfo.processInfo.arguments.contains("--fresh-demo") ? .sample : try await store.load()
            if ProcessInfo.processInfo.arguments.contains("--quick-log-demo") { isQuickLogPresented = true }
            account = try? await accountClient.restoreAccount()
            pendingSyncCount = (try? await syncStore.pending().count) ?? 0
            if account != nil {
                if document.syncState == .localOnly {
                    await prepareCloudReconciliation()
                } else {
                    await syncNow()
                }
            }
        } catch {
            document = .starter
            message = error.localizedDescription
        }
    }

    func log(_ food: Food, servings: Double, meal: Meal, at date: Date) async {
        await mutate { $0.log(food: food, servings: servings, meal: meal, at: date) }
        isQuickLogPresented = false
        message = "\(food.name) added."
    }

    func delete(_ entry: FoodEntry) async {
        await mutate { document in
            lastDeletedEntry = try document.deleteEntry(entry.id)
        }
        message = "Entry removed. Undo is available below."
    }

    func undoDelete() async {
        guard let entry = lastDeletedEntry else { return }
        await mutate { $0.restoreEntry(entry) }
        lastDeletedEntry = nil
        message = "Entry restored."
    }

    func duplicate(_ entry: FoodEntry) async {
        await mutate { try $0.duplicateEntry(entry.id) }
        message = "Entry duplicated."
    }

    func update(_ entry: FoodEntry, servings: Double, meal: Meal, timestamp: Date) async {
        await mutate { document in
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
            }
            document.foodEntries[index] = updated
        }
        message = "Food entry updated."
    }

    func addWater(_ millilitres: Int) async {
        await mutate { $0.addWater(millilitres, at: selectedDate) }
    }

    func toggleRoutine(_ routine: MedicationRoutine) async {
        await mutate {
            $0.toggleRoutine(routine.id, on: selectedDate)
        }
    }

    func toggleFavorite(_ food: Food) async {
        await mutate { $0.toggleFavorite(food.id) }
    }

    func addCustomFood(_ food: Food) async {
        await mutate { $0.addCustomFood(food) }
        message = "Custom food saved."
    }

    func saveFood(_ food: Food) async {
        await mutate { document in
            if let index = document.foods.firstIndex(where: { $0.id == food.id }) {
                document.foods[index] = food
            } else {
                document.addCustomFood(food)
            }
        }
        message = "Food saved."
    }

    func toggleArchive(_ food: Food) async {
        await mutate { document in
            guard let index = document.foods.firstIndex(where: { $0.id == food.id }) else { return }
            document.foods[index].isArchived.toggle()
        }
    }

    func saveDailyContext(weightKilograms: Double?, note: String, cycle: CycleContext) async {
        await mutate { document in
            let calendar = Calendar.current
            document.weightEntries.removeAll { calendar.isDate($0.date, inSameDayAs: selectedDate) }
            if let weightKilograms, weightKilograms > 0 {
                document.weightEntries.append(WeightEntry(date: selectedDate, kilograms: weightKilograms))
            }
            let key = DateKey.string(selectedDate)
            let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmedNote.isEmpty {
                document.dailyNotes.removeValue(forKey: key)
            } else {
                document.dailyNotes[key] = trimmedNote
            }
            document.cycle = cycle
        }
        message = "Daily context saved."
    }

    func saveRoutine(_ routine: MedicationRoutine) async {
        await mutate { document in
            if let index = document.routines.firstIndex(where: { $0.id == routine.id }) {
                document.routines[index] = routine
            } else {
                document.routines.append(routine)
            }
        }
    }

    func toggleArchive(_ routine: MedicationRoutine) async {
        var updated = routine
        updated.isArchived.toggle()
        await saveRoutine(updated)
    }

    func updateProfile(_ profile: Profile) async {
        await mutate { $0.profile = profile }
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
        do {
            let previous = document
            try await store.replace(with: importPreview)
            document = importPreview
            if account != nil {
                for operation in CloudJournalDiff.operations(from: previous, to: importPreview) {
                    try await syncStore.enqueue(operation)
                }
                await syncNow()
            }
            self.importPreview = nil
            isImportConfirmationPresented = false
            message = "Calorie journal replaced."
        } catch {
            message = error.localizedDescription
        }
    }

    func resetLocalData() async {
        do {
            try await store.reset()
            document = .starter
            message = "Local journal reset."
        } catch {
            message = error.localizedDescription
        }
    }

    func connectExistingAccount() async {
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
            accountNotice = "Cloud journal connected. Apple sign-in is optional."
            await prepareCloudReconciliation()
        } catch {
            message = accountErrorMessage(error, recovery: "Try connecting your existing journal again.")
        }
    }

    func completeAppleSignIn(_ payload: AppleIdentityPayload) async {
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
        } catch {
            message = accountErrorMessage(error, recovery: "Try Apple sign-in again. Your device journal has not changed.")
        }
    }

    func signOut() async {
        isAccountWorking = true
        await cloudQuery.clear()
        await accountClient.signOut()
        account = nil
        cloudSnapshot = nil
        syncRequestedAfterMutation = false
        document.syncState = .localOnly
        try? await store.save(document)
        isAccountWorking = false
        accountNotice = "Signed out. This device journal is still here."
    }

    func deleteCloudAccount() async {
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
            document.syncState = .localOnly
            try await store.save(document)
            accountNotice = "Cloud account deleted. This device journal was preserved."
        } catch {
            message = accountErrorMessage(error, recovery: "Try deleting the cloud account again. Nothing was removed from this device.")
        }
    }

    func reconcileJournal(_ choice: JournalReconciliationChoice) async {
        guard let cloudSnapshot else { return }
        isAccountWorking = true
        defer { isAccountWorking = false }
        do {
            let next = CloudJournalMapper.reconcile(local: document, cloud: cloudSnapshot, choice: choice)
            if choice == .keepCloud {
                try await syncStore.removeAll()
                pendingSyncCount = 0
            }
            try await store.save(next)
            document = next
            if choice != .keepCloud {
                for operation in CloudJournalDiff.operations(from: cloudSnapshot.document, to: next) {
                    try await syncStore.enqueue(operation)
                }
                await syncNow()
            }
            self.cloudSnapshot = nil
            isReconciliationPresented = false
            accountNotice = switch choice {
            case .keepCloud: "Your current cloud journal is now on this device."
            case .keepIPhone: "This device journal is preserved and queued for cloud sync."
            case .merge: "Cloud and device records were merged without duplicate IDs."
            }
        } catch {
            message = accountErrorMessage(error, recovery: "Try this journal choice again. Neither journal was discarded.")
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
        do {
            cloudSnapshot = try await fetchCloud(policy: .always).value
            document.syncState = .conflict
            try await store.save(document)
            isReconciliationPresented = true
        } catch {
            document.syncState = .failed
            try? await store.save(document)
            message = accountErrorMessage(error, recovery: "Try loading your cloud journal again. This device journal has not changed.")
        }
    }

    func syncNow(forceRefresh: Bool = true) async {
        guard account != nil else { return }
        guard !isSyncing else {
            syncRequestedAfterMutation = true
            return
        }
        guard activeLocalMutations == 0 else {
            syncRequestedAfterMutation = true
            return
        }
        if document.syncState == .conflict {
            await resumeReconciliation()
            return
        }
        isSyncing = true
        do {
            while true {
                let replayedPending = try await replayPendingSyncIntents()
                guard try await syncStore.pending().isEmpty else { continue }
                let revisionBeforeFetch = localMutationRevision
                let query = try await fetchCloud(
                    policy: cloudPolicy(forceRefresh: forceRefresh, replayedPending: replayedPending)
                )
                guard activeLocalMutations == 0, revisionBeforeFetch == localMutationRevision else {
                    syncRequestedAfterMutation = true
                    break
                }
                guard try await syncStore.pending().isEmpty else { continue }
                if query.source == .network {
                    let refreshed = CloudJournalMapper.reconcile(
                        local: document,
                        cloud: query.value,
                        choice: .keepCloud
                    )
                    document = refreshed
                    try await store.save(refreshed)
                }
                guard try await syncStore.pending().isEmpty else { continue }
                break
            }
        } catch {
            pendingSyncCount = (try? await syncStore.pending().count) ?? pendingSyncCount
            document.syncState = pendingSyncCount > 0 ? .pending : .failed
            try? await store.save(document)
            message = accountErrorMessage(error, recovery: "Your changes are saved on this device and cloud sync can be retried.")
        }
        isSyncing = false
        if account != nil, activeLocalMutations == 0, syncRequestedAfterMutation {
            syncRequestedAfterMutation = false
            await syncNow()
        }
    }

    private func replayPendingSyncIntents() async throws -> Bool {
        let pending = try await syncStore.pending()
        pendingSyncCount = pending.count
        guard !pending.isEmpty else { return false }
        await cloudQuery.invalidate()
        for intent in pending {
            try await accountClient.apply(intent)
            try await syncStore.complete(intent.id)
            pendingSyncCount -= 1
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
        policy: ServerStateQueryPolicy
    ) async throws -> ServerStateQueryResult<CloudJournalSnapshot> {
        try await cloudQuery.value(policy: policy) { [accountClient] in
            try CloudJournalMapper.decode(await accountClient.cloudExport())
        }
    }

    private func accountErrorMessage(_ error: Error, recovery: String) -> String {
        let detail = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        return "\(detail) \(recovery)"
    }

    private func mutate(_ operation: (inout CalorieDocument) throws -> Void) async {
        activeLocalMutations += 1
        var shouldRequestSync = false
        do {
            let previous = document
            var next = document
            try operation(&next)
            let syncOperations = account == nil ? [] : CloudJournalDiff.operations(from: previous, to: next)
            if !syncOperations.isEmpty {
                next.syncState = .pending
                localMutationRevision += 1
                await cloudQuery.invalidate()
                shouldRequestSync = true
            }
            try await store.save(next)
            document = next
            if !syncOperations.isEmpty {
                for operation in syncOperations {
                    try await syncStore.enqueue(operation)
                }
                pendingSyncCount = (try await syncStore.pending()).count
            }
        } catch {
            message = error.localizedDescription
        }
        if shouldRequestSync { syncRequestedAfterMutation = true }
        activeLocalMutations -= 1
        if activeLocalMutations == 0, syncRequestedAfterMutation {
            syncRequestedAfterMutation = false
            await syncNow()
        }
    }
}
