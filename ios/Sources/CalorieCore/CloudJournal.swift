import CryptoKit
import Foundation

public struct JournalCounts: Equatable, Sendable {
    public let foods: Int
    public let foodEntries: Int
    public let waterEntries: Int
    public let weightEntries: Int
    public let routines: Int
    public let routineCheckIns: Int

    public init(document: CalorieDocument) {
        foods = document.foods.count
        foodEntries = document.foodEntries.count
        waterEntries = document.waterEntries.count
        weightEntries = document.weightEntries.count
        routines = document.routines.count
        routineCheckIns = document.routineCheckIns.count
    }

    public var activityTotal: Int {
        foodEntries + waterEntries + weightEntries + routineCheckIns
    }
}

public struct CloudJournalSnapshot: Equatable, Sendable {
    public let document: CalorieDocument
    public let generatedAt: Date
    public let counts: JournalCounts
}

public enum JournalReconciliationChoice: Equatable, Sendable {
    case keepCloud
    case keepIPhone
    case merge
}

public enum CloudJournalMapper {
    public static func decode(
        _ data: Data,
        calendar: Calendar = .current
    ) throws -> CloudJournalSnapshot {
        let export = try JSONDecoder().decode(CloudExport.self, from: data)
        guard export.schema == "calorie-journal-backup", export.version == 2 else {
            throw CalorieError.unsupportedSchema(export.version)
        }
        let generatedAt = ISO8601DateFormatter().date(from: export.generatedAt) ?? Date.distantPast
        let foodByID = Dictionary(uniqueKeysWithValues: export.foods.map { ($0.id, $0) })
        let foods = export.foods.map(mapFood)
        let weights = export.weights.map {
            WeightEntry(id: stableUUID($0.id), date: date($0.recordedAt), kilograms: $0.weightKg)
        }
        var profile = mapProfile(export.profile)
        profile.weightKilograms = weights.max(by: { $0.date < $1.date })?.kilograms
        let document = CalorieDocument(
            profile: profile,
            foods: foods,
            foodEntries: export.entries.map {
                mapEntry($0, food: $0.foodId.flatMap { foodByID[$0] }, calendar: calendar)
            },
            waterEntries: export.waterEntries.map {
                WaterEntry(id: stableUUID($0.id), timestamp: date($0.drankAt), millilitres: $0.amountMl)
            },
            weightEntries: weights,
            routines: export.medications.map {
                MedicationRoutine(
                    id: stableUUID($0.id),
                    name: $0.name,
                    period: mapPeriod($0.schedule),
                    isArchived: $0.archivedAt != nil
                )
            },
            routineCheckIns: export.medicationCheckIns.map {
                RoutineCheckIn(
                    id: stableUUID($0.id),
                    routineID: stableUUID($0.medicationId),
                    date: date($0.takenAt)
                )
            },
            goalCycleSessions: export.cycleSessions.map {
                GoalCycleSession(
                    id: stableUUID($0.id),
                    kind: mapGoalCycleKind($0.cycle),
                    goal: $0.goal,
                    startOn: $0.startOn,
                    endOn: $0.endOn,
                    calorieRange: $0.calorieRange,
                    proteinRange: $0.proteinRangeG,
                    createdAt: date($0.createdAt),
                    updatedAt: date($0.updatedAt)
                )
            },
            theme: .system,
            syncState: .synced,
            lastSyncedAt: generatedAt
        )
        return CloudJournalSnapshot(
            document: document,
            generatedAt: generatedAt,
            counts: JournalCounts(document: document)
        )
    }

    public static func reconcile(
        local: CalorieDocument,
        cloud: CloudJournalSnapshot,
        choice: JournalReconciliationChoice,
        now: Date = Date()
    ) -> CalorieDocument {
        switch choice {
        case .keepCloud:
            var document = cloud.document
            document.theme = local.theme
            if document.profile.weightKilograms == nil {
                document.profile.weightKilograms = local.profile.weightKilograms
            }
            document.profile.manualMacroTargets = local.profile.manualMacroTargets
            document.dailyNotes = local.dailyNotes
            document.cycle = local.cycle
            let localFoods = Dictionary(uniqueKeysWithValues: local.foods.map { ($0.id, $0) })
            for index in document.foods.indices {
                guard let localFood = localFoods[document.foods[index].id] else { continue }
                document.foods[index].nutrients.fat = localFood.nutrients.fat
            }
            let localEntries = Dictionary(uniqueKeysWithValues: local.foodEntries.map { ($0.id, $0) })
            for index in document.foodEntries.indices {
                guard let localEntry = localEntries[document.foodEntries[index].id] else { continue }
                document.foodEntries[index].meal = localEntry.meal
                document.foodEntries[index].nutrients.fat = localEntry.nutrients.fat
            }
            document.syncState = .synced
            document.lastSyncedAt = now
            return document
        case .keepIPhone:
            var document = local
            document.syncState = .pending
            document.lastSyncedAt = nil
            return document
        case .merge:
            var document = cloud.document
            document.profile = local.profile
            document.theme = local.theme
            document.foods = merge(cloud.document.foods, local.foods)
            document.foodEntries = merge(cloud.document.foodEntries, local.foodEntries)
            document.waterEntries = merge(cloud.document.waterEntries, local.waterEntries)
            document.weightEntries = merge(cloud.document.weightEntries, local.weightEntries)
            document.routines = merge(cloud.document.routines, local.routines)
            document.routineCheckIns = merge(cloud.document.routineCheckIns, local.routineCheckIns)
            document.dailyNotes.merge(local.dailyNotes) { _, local in local }
            document.cycle = local.cycle
            document.syncState = .pending
            document.lastSyncedAt = nil
            return document
        }
    }

    private static func merge<Value: Identifiable>(_ cloud: [Value], _ local: [Value]) -> [Value]
    where Value.ID: Hashable {
        var values = cloud
        var indexes = Dictionary(uniqueKeysWithValues: cloud.enumerated().map { ($0.element.id, $0.offset) })
        for value in local {
            if let index = indexes[value.id] {
                values[index] = value
            } else {
                indexes[value.id] = values.count
                values.append(value)
            }
        }
        return values
    }

    private static func mapProfile(_ profile: CloudProfile) -> Profile {
        let goal: Goal = switch profile.goal {
        case "lose_gentle", "lose_steady": .gradualLoss
        case "gain_gentle": .gradualGain
        default: .maintain
        }
        let activity: ActivityLevel = switch profile.activityLevel {
        case "very": .high
        case "moderate": .moderate
        default: .light
        }
        let equationProfile: EquationProfile? = switch profile.equationProfile {
        case "female": .mifflinFemaleConstant
        case "male": .mifflinMaleConstant
        default: nil
        }
        var result = Profile(
            name: profile.displayName,
            age: profile.ageYears,
            heightCentimetres: profile.heightCm,
            weightKilograms: nil,
            goal: goal,
            activity: activity,
            equationProfile: equationProfile,
            manualCalorieTarget: profile.manualCalorieTarget,
            manualMacroTargets: nil,
            waterTargetMillilitres: profile.waterTargetMl
        )
        result.units = profile.units
        result.genderIdentity = profile.genderIdentity
        result.manualCalorieRange = profile.manualCalorieRange
        result.targetWeightKilograms = profile.targetWeightKg
        result.wakeTime = profile.wakeTime
        result.sleepHours = profile.sleepHours
        result.fastingThresholdHours = profile.fastingThresholdHours
        result.dailyActionOrder = profile.dailyActionOrder
        result.dailyActionHidden = profile.dailyActionHidden
        result.onboardingComplete = profile.onboardingComplete
        return result
    }

    private static func mapFood(_ food: CloudFood) -> Food {
        let scale = food.servingMode == "per_100g" ? food.defaultAmount / 100 : 1
        var result = Food(
            id: stableUUID(food.id),
            name: food.name,
            servingName: food.unitLabel,
            servingGrams: food.servingMode == "per_100g" ? food.defaultAmount : nil,
            nutrients: Nutrients(
                calories: food.calories * scale,
                protein: food.proteinG * scale,
                carbohydrates: food.carbsG * scale,
                fat: 0,
                fibre: food.fibreG * scale
            ),
            isFavorite: food.favourite,
            isArchived: food.archivedAt != nil,
            isCustom: true,
            defaultAmount: food.servingMode == "per_100g" ? 1 : food.defaultAmount,
            lastUsedAt: food.lastUsedAt.map(date)
        )
        result.isPackaged = food.isPackaged
        result.labels = food.labels
        return result
    }

    private static func mapEntry(
        _ entry: CloudEntry,
        food: CloudFood?,
        calendar: Calendar
    ) -> FoodEntry {
        let servings: Double
        if let food, food.servingMode == "per_100g", food.defaultAmount > 0 {
            servings = entry.amount / food.defaultAmount
        } else {
            servings = entry.amount
        }
        let timestamp = date(entry.eatenAt)
        var result = FoodEntry(
            id: stableUUID(entry.id),
            foodID: stableUUID(entry.foodId ?? "direct:\(entry.id)"),
            foodName: entry.foodName,
            meal: meal(for: timestamp, calendar: calendar),
            timestamp: timestamp,
            servings: max(0.01, servings),
            nutrients: Nutrients(
                calories: entry.calories,
                protein: entry.proteinG,
                carbohydrates: entry.carbsG,
                fat: 0,
                fibre: entry.fibreG
            )
        )
        result.isPackaged = entry.isPackaged
        result.labels = entry.labels
        return result
    }

    private static func meal(for date: Date, calendar: Calendar) -> Meal {
        switch calendar.component(.hour, from: date) {
        case 0..<11: .breakfast
        case 11..<16: .lunch
        case 16..<21: .dinner
        default: .snack
        }
    }

    private static func mapPeriod(_ value: String) -> RoutinePeriod {
        switch value {
        case "morning": .morning
        case "evening": .evening
        default: .either
        }
    }

    private static func mapGoalCycleKind(_ value: String) -> GoalCycleKind {
        switch value {
        case "cut": .cut
        case "gain": .gain
        default: .recomposition
        }
    }

    private static func date(_ milliseconds: Double) -> Date {
        Date(timeIntervalSince1970: milliseconds / 1_000)
    }

    private static func stableUUID(_ value: String) -> UUID {
        if let uuid = UUID(uuidString: value) { return uuid }
        var bytes = Array(SHA256.hash(data: Data(value.utf8)).prefix(16))
        bytes[6] = (bytes[6] & 0x0F) | 0x40
        bytes[8] = (bytes[8] & 0x3F) | 0x80
        return UUID(uuid: (
            bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
            bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
        ))
    }
}

private struct CloudExport: Decodable {
    let schema: String
    let version: Int
    let generatedAt: String
    let profile: CloudProfile
    let foods: [CloudFood]
    let entries: [CloudEntry]
    let waterEntries: [CloudWater]
    let medications: [CloudMedication]
    let medicationCheckIns: [CloudMedicationCheckIn]
    let weights: [CloudWeight]
    let cycleSessions: [CloudGoalCycle]
}

private struct CloudProfile: Decodable {
    let displayName: String
    let units: String?
    let ageYears: Int?
    let genderIdentity: String?
    let equationProfile: String?
    let heightCm: Double?
    let activityLevel: String
    let goal: String
    let targetWeightKg: Double?
    let manualCalorieTarget: Double?
    let manualCalorieRange: [Double]?
    let wakeTime: String?
    let sleepHours: Double?
    let fastingThresholdHours: Int?
    let waterTargetMl: Int
    let dailyActionOrder: [String]?
    let dailyActionHidden: [String]?
    let onboardingComplete: Bool?
}

private struct CloudFood: Decodable {
    let id: String
    let name: String
    let servingMode: String
    let unitLabel: String
    let defaultAmount: Double
    let calories: Double
    let carbsG: Double
    let proteinG: Double
    let fibreG: Double
    let favourite: Bool
    let lastUsedAt: Double?
    let archivedAt: Double?
    let isPackaged: Bool?
    let labels: [String]?
}

private struct CloudEntry: Decodable {
    let id: String
    let foodId: String?
    let foodName: String
    let amount: Double
    let calories: Double
    let carbsG: Double
    let proteinG: Double
    let fibreG: Double
    let eatenAt: Double
    let isPackaged: Bool?
    let labels: [String]?
}

private struct CloudWater: Decodable { let id: String; let amountMl: Int; let drankAt: Double }
private struct CloudWeight: Decodable { let id: String; let weightKg: Double; let recordedAt: Double }
private struct CloudMedication: Decodable {
    let id: String
    let name: String
    let schedule: String
    let archivedAt: Double?
}
private struct CloudMedicationCheckIn: Decodable {
    let id: String
    let medicationId: String
    let takenAt: Double
}
private struct CloudGoalCycle: Decodable {
    let id: String
    let cycle: String
    let goal: String
    let startOn: String
    let endOn: String?
    let calorieRange: [Double]?
    let proteinRangeG: [Double]?
    let createdAt: Double
    let updatedAt: Double
}
