import Foundation

public struct Nutrients: Codable, Equatable, Sendable {
    public var calories: Double
    public var protein: Double
    public var carbohydrates: Double
    public var fat: Double
    public var fibre: Double

    public init(calories: Double = 0, protein: Double = 0, carbohydrates: Double = 0, fat: Double = 0, fibre: Double = 0) {
        self.calories = calories
        self.protein = protein
        self.carbohydrates = carbohydrates
        self.fat = fat
        self.fibre = fibre
    }

    public static let zero = Nutrients()

    public static func + (lhs: Nutrients, rhs: Nutrients) -> Nutrients {
        Nutrients(
            calories: lhs.calories + rhs.calories,
            protein: lhs.protein + rhs.protein,
            carbohydrates: lhs.carbohydrates + rhs.carbohydrates,
            fat: lhs.fat + rhs.fat,
            fibre: lhs.fibre + rhs.fibre
        )
    }

    public func scaled(by amount: Double) -> Nutrients {
        Nutrients(
            calories: calories * amount,
            protein: protein * amount,
            carbohydrates: carbohydrates * amount,
            fat: fat * amount,
            fibre: fibre * amount
        )
    }
}

public struct Food: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var name: String
    public var servingName: String
    public var servingGrams: Double?
    public var nutrients: Nutrients
    public var isFavorite: Bool
    public var isArchived: Bool
    public var isCustom: Bool

    public init(
        id: UUID = UUID(),
        name: String,
        servingName: String,
        servingGrams: Double? = nil,
        nutrients: Nutrients,
        isFavorite: Bool = false,
        isArchived: Bool = false,
        isCustom: Bool = false
    ) {
        self.id = id
        self.name = name
        self.servingName = servingName
        self.servingGrams = servingGrams
        self.nutrients = nutrients
        self.isFavorite = isFavorite
        self.isArchived = isArchived
        self.isCustom = isCustom
    }
}

public enum Meal: String, Codable, CaseIterable, Sendable {
    case breakfast = "Breakfast"
    case lunch = "Lunch"
    case dinner = "Dinner"
    case snack = "Snack"
}

public struct FoodEntry: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var foodID: UUID
    public var foodName: String
    public var meal: Meal
    public var timestamp: Date
    public var servings: Double
    public var nutrients: Nutrients

    public init(
        id: UUID = UUID(),
        foodID: UUID,
        foodName: String,
        meal: Meal,
        timestamp: Date,
        servings: Double,
        nutrients: Nutrients
    ) {
        self.id = id
        self.foodID = foodID
        self.foodName = foodName
        self.meal = meal
        self.timestamp = timestamp
        self.servings = servings
        self.nutrients = nutrients
    }
}

public struct WaterEntry: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var timestamp: Date
    public var millilitres: Int

    public init(id: UUID = UUID(), timestamp: Date, millilitres: Int) {
        self.id = id
        self.timestamp = timestamp
        self.millilitres = millilitres
    }
}

public struct WeightEntry: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var date: Date
    public var kilograms: Double

    public init(id: UUID = UUID(), date: Date, kilograms: Double) {
        self.id = id
        self.date = date
        self.kilograms = kilograms
    }
}

public enum RoutinePeriod: String, Codable, CaseIterable, Sendable {
    case morning = "Morning"
    case evening = "Evening"
    case either = "Either"
}

public struct MedicationRoutine: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var name: String
    public var period: RoutinePeriod
    public var isArchived: Bool

    public init(id: UUID = UUID(), name: String, period: RoutinePeriod, isArchived: Bool = false) {
        self.id = id
        self.name = name
        self.period = period
        self.isArchived = isArchived
    }
}

public struct RoutineCheckIn: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID
    public var routineID: UUID
    public var date: Date

    public init(id: UUID = UUID(), routineID: UUID, date: Date) {
        self.id = id
        self.routineID = routineID
        self.date = date
    }
}

public struct CycleContext: Codable, Equatable, Sendable {
    public var enabled: Bool
    public var latestPeriodStart: Date?
    public var typicalCycleDays: Int?

    public init(enabled: Bool = false, latestPeriodStart: Date? = nil, typicalCycleDays: Int? = nil) {
        self.enabled = enabled
        self.latestPeriodStart = latestPeriodStart
        self.typicalCycleDays = typicalCycleDays
    }
}

public enum Goal: String, Codable, CaseIterable, Sendable {
    case maintain = "Maintain"
    case gradualLoss = "Gradual loss"
    case gradualGain = "Gradual gain"
}

public enum ActivityLevel: String, Codable, CaseIterable, Sendable {
    case light = "Light"
    case moderate = "Moderate"
    case high = "High"

    public var multiplier: Double {
        switch self {
        case .light: 1.375
        case .moderate: 1.55
        case .high: 1.725
        }
    }
}

public enum EquationProfile: String, Codable, CaseIterable, Sendable {
    case mifflinFemaleConstant = "Mifflin–St Jeor (−161 constant)"
    case mifflinMaleConstant = "Mifflin–St Jeor (+5 constant)"

    public var constant: Double {
        switch self {
        case .mifflinFemaleConstant: -161
        case .mifflinMaleConstant: 5
        }
    }
}

public struct Profile: Codable, Equatable, Sendable {
    public var name: String
    public var age: Int?
    public var heightCentimetres: Double?
    public var weightKilograms: Double?
    public var goal: Goal
    public var activity: ActivityLevel
    public var equationProfile: EquationProfile?
    public var manualCalorieTarget: Double?
    public var manualMacroTargets: Nutrients?
    public var waterTargetMillilitres: Int

    public init(
        name: String = "",
        age: Int? = nil,
        heightCentimetres: Double? = nil,
        weightKilograms: Double? = nil,
        goal: Goal = .maintain,
        activity: ActivityLevel = .moderate,
        equationProfile: EquationProfile? = nil,
        manualCalorieTarget: Double? = 2_100,
        manualMacroTargets: Nutrients? = Nutrients(calories: 2_100, protein: 120, carbohydrates: 250, fat: 70, fibre: 28),
        waterTargetMillilitres: Int = 2_500
    ) {
        self.name = name
        self.age = age
        self.heightCentimetres = heightCentimetres
        self.weightKilograms = weightKilograms
        self.goal = goal
        self.activity = activity
        self.equationProfile = equationProfile
        self.manualCalorieTarget = manualCalorieTarget
        self.manualMacroTargets = manualMacroTargets
        self.waterTargetMillilitres = waterTargetMillilitres
    }
}

public enum AppTheme: String, Codable, CaseIterable, Sendable {
    case system = "System"
    case light = "Light"
    case dark = "Dark"
}

public enum SyncState: String, Codable, Sendable {
    case localOnly
    case pending
    case synced
    case conflict
    case failed
}

public struct CalorieDocument: Codable, Equatable, Sendable {
    public var schemaVersion: Int
    public var profile: Profile
    public var foods: [Food]
    public var foodEntries: [FoodEntry]
    public var waterEntries: [WaterEntry]
    public var weightEntries: [WeightEntry]
    public var routines: [MedicationRoutine]
    public var routineCheckIns: [RoutineCheckIn]
    public var cycle: CycleContext
    public var dailyNotes: [String: String]
    public var theme: AppTheme
    public var syncState: SyncState
    public var lastSyncedAt: Date?

    public init(
        schemaVersion: Int = 1,
        profile: Profile = Profile(),
        foods: [Food] = [],
        foodEntries: [FoodEntry] = [],
        waterEntries: [WaterEntry] = [],
        weightEntries: [WeightEntry] = [],
        routines: [MedicationRoutine] = [],
        routineCheckIns: [RoutineCheckIn] = [],
        cycle: CycleContext = CycleContext(),
        dailyNotes: [String: String] = [:],
        theme: AppTheme = .system,
        syncState: SyncState = .localOnly,
        lastSyncedAt: Date? = nil
    ) {
        self.schemaVersion = schemaVersion
        self.profile = profile
        self.foods = foods
        self.foodEntries = foodEntries
        self.waterEntries = waterEntries
        self.weightEntries = weightEntries
        self.routines = routines
        self.routineCheckIns = routineCheckIns
        self.cycle = cycle
        self.dailyNotes = dailyNotes
        self.theme = theme
        self.syncState = syncState
        self.lastSyncedAt = lastSyncedAt
    }
}

public extension CalorieDocument {
    private static var seedFoods: [Food] {
        [
            Food(name: "Greek yoghurt bowl", servingName: "1 bowl", servingGrams: 280, nutrients: Nutrients(calories: 410, protein: 29, carbohydrates: 48, fat: 11, fibre: 7), isFavorite: true),
            Food(name: "Paneer rice bowl", servingName: "1 bowl", servingGrams: 420, nutrients: Nutrients(calories: 620, protein: 31, carbohydrates: 72, fat: 23, fibre: 8), isFavorite: true),
            Food(name: "Banana", servingName: "1 medium", servingGrams: 118, nutrients: Nutrients(calories: 105, protein: 1.3, carbohydrates: 27, fat: 0.4, fibre: 3.1)),
            Food(name: "Masala omelette", servingName: "2 eggs", servingGrams: 150, nutrients: Nutrients(calories: 240, protein: 17, carbohydrates: 7, fat: 16, fibre: 1.5)),
            Food(name: "Dal and roti", servingName: "1 plate", servingGrams: 380, nutrients: Nutrients(calories: 510, protein: 22, carbohydrates: 79, fat: 12, fibre: 15)),
        ]
    }

    static var starter: CalorieDocument {
        CalorieDocument(foods: seedFoods)
    }

    static var sample: CalorieDocument {
        let foods = seedFoods
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: .now)
        let yoghurt = foods[0]
        let banana = foods[2]
        let entries = [
            FoodEntry(foodID: yoghurt.id, foodName: yoghurt.name, meal: .breakfast, timestamp: today.addingTimeInterval(8 * 3_600 + 15 * 60), servings: 1, nutrients: yoghurt.nutrients),
            FoodEntry(foodID: banana.id, foodName: banana.name, meal: .snack, timestamp: today.addingTimeInterval(11 * 3_600), servings: 1, nutrients: banana.nutrients),
        ]
        let routine = MedicationRoutine(name: "Morning routine", period: .morning)
        return CalorieDocument(
            foods: foods,
            foodEntries: entries,
            waterEntries: [WaterEntry(timestamp: today.addingTimeInterval(8 * 3_600), millilitres: 750)],
            weightEntries: [WeightEntry(date: today, kilograms: 72.4)],
            routines: [routine],
            dailyNotes: [DateKey.string(today): "Energy felt steady after breakfast."]
        )
    }

    func entries(on date: Date, calendar: Calendar = .current) -> [FoodEntry] {
        foodEntries.filter { calendar.isDate($0.timestamp, inSameDayAs: date) }.sorted { $0.timestamp < $1.timestamp }
    }

    func totals(on date: Date, calendar: Calendar = .current) -> Nutrients {
        entries(on: date, calendar: calendar).reduce(.zero) { $0 + $1.nutrients }
    }

    func waterTotal(on date: Date, calendar: Calendar = .current) -> Int {
        waterEntries.filter { calendar.isDate($0.timestamp, inSameDayAs: date) }.reduce(0) { $0 + $1.millilitres }
    }

    func isRoutineComplete(_ routineID: UUID, on date: Date, calendar: Calendar = .current) -> Bool {
        routineCheckIns.contains { $0.routineID == routineID && calendar.isDate($0.date, inSameDayAs: date) }
    }

    mutating func log(food: Food, servings: Double, meal: Meal, at date: Date) {
        foodEntries.append(FoodEntry(
            foodID: food.id,
            foodName: food.name,
            meal: meal,
            timestamp: date,
            servings: servings,
            nutrients: food.nutrients.scaled(by: servings)
        ))
    }

    mutating func duplicateEntry(_ id: UUID, at date: Date = .now) throws {
        guard var copy = foodEntries.first(where: { $0.id == id }) else { throw CalorieError.entryNotFound }
        copy.id = UUID()
        copy.timestamp = date
        foodEntries.append(copy)
    }

    mutating func deleteEntry(_ id: UUID) throws -> FoodEntry {
        guard let index = foodEntries.firstIndex(where: { $0.id == id }) else { throw CalorieError.entryNotFound }
        return foodEntries.remove(at: index)
    }

    mutating func restoreEntry(_ entry: FoodEntry) {
        foodEntries.append(entry)
    }

    mutating func addWater(_ millilitres: Int, at date: Date = .now) {
        waterEntries.append(WaterEntry(timestamp: date, millilitres: max(0, millilitres)))
    }

    mutating func toggleRoutine(_ routineID: UUID, on date: Date = .now, calendar: Calendar = .current) {
        if let index = routineCheckIns.firstIndex(where: { $0.routineID == routineID && calendar.isDate($0.date, inSameDayAs: date) }) {
            routineCheckIns.remove(at: index)
        } else {
            routineCheckIns.append(RoutineCheckIn(routineID: routineID, date: date))
        }
    }

    mutating func toggleFavorite(_ foodID: UUID) {
        guard let index = foods.firstIndex(where: { $0.id == foodID }) else { return }
        foods[index].isFavorite.toggle()
    }

    mutating func addCustomFood(_ food: Food) {
        var custom = food
        custom.isCustom = true
        foods.append(custom)
    }
}

public enum DateKey {
    public static func string(_ date: Date, calendar: Calendar = .current) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }
}

public enum CalorieError: LocalizedError, Equatable {
    case entryNotFound
    case unsupportedSchema(Int)

    public var errorDescription: String? {
        switch self {
        case .entryNotFound: "That food entry is no longer available."
        case let .unsupportedSchema(version): "This Calorie journal uses unsupported version \(version)."
        }
    }
}
