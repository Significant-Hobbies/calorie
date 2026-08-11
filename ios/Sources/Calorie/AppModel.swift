import CalorieCore
import Foundation
import Observation
import SwiftUI

@MainActor
@Observable
final class AppModel {
    private(set) var document: CalorieDocument = .sample
    var selectedDate = Date.now
    var selectedTab = 0
    var isLoading = true
    var isQuickLogPresented = false
    var message: String?
    var lastDeletedEntry: FoodEntry?
    var importPreview: CalorieDocument?
    var isImportConfirmationPresented = false

    private let store: CalorieStore

    init(store: CalorieStore = CalorieStore()) {
        self.store = store
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
    var guidance: [GuidanceItem] { GuidanceEngine.items(entries: selectedEntries, now: .now) }

    func load() async {
        defer { isLoading = false }
        do {
            document = ProcessInfo.processInfo.arguments.contains("--fresh-demo") ? .sample : try await store.load()
            if ProcessInfo.processInfo.arguments.contains("--quick-log-demo") { isQuickLogPresented = true }
        } catch {
            document = .sample
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
        await mutate { $0.toggleRoutine(routine.id, on: selectedDate) }
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
            try await store.replace(with: importPreview)
            document = importPreview
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
            document = .sample
            message = "Local journal reset."
        } catch {
            message = error.localizedDescription
        }
    }

    private func mutate(_ operation: (inout CalorieDocument) throws -> Void) async {
        do {
            var next = document
            try operation(&next)
            try await store.save(next)
            document = next
        } catch {
            message = error.localizedDescription
        }
    }
}
