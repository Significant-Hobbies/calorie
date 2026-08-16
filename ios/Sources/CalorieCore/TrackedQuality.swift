import Foundation

public struct TrackedQuality: Equatable, Sendable {
    public let score: Int?
    public let label: String
    public let proteinPer100Kcal: Double?
    public let fibrePer100Kcal: Double?
    public let proteinFactor: Double?
    public let fibreFactor: Double?
    public let explanation: String
}

public enum EntryScoreBasisSource: String, Equatable, Sendable {
    case currentFood
    case loggedFallback
}

public enum EntryScoreFallbackReason: String, Equatable, Sendable {
    case missingFood
    case archivedFood
}

public struct EntryScoreBasis: Equatable, Sendable {
    public let nutrients: Nutrients
    public let source: EntryScoreBasisSource
    public let fallbackReason: EntryScoreFallbackReason?
}

public struct DailyScoreTargets: Equatable, Sendable {
    public let calorieRange: [Double]?
    public let calorieTarget: Double?
    public let proteinTarget: Double?
    public let fibreTarget: Double?

    public init(calorieRange: [Double]? = nil, calorieTarget: Double? = nil, proteinTarget: Double? = nil, fibreTarget: Double? = nil) {
        self.calorieRange = calorieRange
        self.calorieTarget = calorieTarget
        self.proteinTarget = proteinTarget
        self.fibreTarget = fibreTarget
    }
}

public struct DailyScore: Equatable, Sendable {
    public let score: Int?
    public let label: String
    public let nutrients: Nutrients
    public let calorieFactor: Double?
    public let proteinFactor: Double?
    public let fibreFactor: Double?
    public let fallbackCount: Int
    public let explanation: String
}

public enum EntryScoreBasisResolver {
    public static func resolve(_ entry: FoodEntry, foods: [Food]) -> EntryScoreBasis {
        guard let food = foods.first(where: { $0.id == entry.foodID }) else {
            return EntryScoreBasis(nutrients: entry.nutrients, source: .loggedFallback, fallbackReason: .missingFood)
        }
        guard !food.isArchived else {
            return EntryScoreBasis(nutrients: entry.nutrients, source: .loggedFallback, fallbackReason: .archivedFood)
        }

        return EntryScoreBasis(
            nutrients: food.nutrients.scaled(by: nonNegative(entry.servings)),
            source: .currentFood,
            fallbackReason: nil
        )
    }

    private static func nonNegative(_ value: Double) -> Double {
        value.isFinite ? max(0, value) : 0
    }
}

public enum DailyScoreEvaluator {
    private static let caveat = "This tracked score does not assess ingredients, vitamins, minerals, sodium, added sugars, fat quality, dietary variety, or overall health quality."

    public static func evaluate(entries: [FoodEntry], foods: [Food], targets: DailyScoreTargets, isCurrentDay: Bool) -> DailyScore {
        let bases = entries.map { EntryScoreBasisResolver.resolve($0, foods: foods) }
        let total = bases.reduce(into: Nutrients()) { result, basis in
            result.calories += nonNegative(basis.nutrients.calories)
            result.protein += nonNegative(basis.nutrients.protein)
            result.fibre += nonNegative(basis.nutrients.fibre)
        }
        let nutrients = Nutrients(
            calories: rounded(total.calories),
            protein: rounded(total.protein),
            fibre: rounded(total.fibre)
        )
        let bounds = calorieBounds(targets)
        let proteinTarget = positive(targets.proteinTarget)
        let fibreTarget = positive(targets.fibreTarget)
        let calorieFactor = calorieAdherence(nutrients.calories, bounds: bounds)
        let proteinFactor = targetCompletion(nutrients.protein, target: proteinTarget)
        let fibreFactor = targetCompletion(nutrients.fibre, target: fibreTarget)
        let factors: [(Double?, Double)] = [(calorieFactor, 50), (proteinFactor, 30), (fibreFactor, 20)]
        let available = factors.compactMap { value, weight in value.map { ($0, weight) } }
        let availableWeight = available.reduce(0) { $0 + $1.1 }
        let score = availableWeight > 0
            ? Int((100 * available.reduce(0) { $0 + ($1.0 * $1.1) } / availableWeight).rounded())
            : nil
        let fallbackCount = bases.count(where: { $0.source == .loggedFallback })
        let label = isCurrentDay ? "Score so far" : "Final score"
        let currentCount = bases.count - fallbackCount
        let provenance = "\(currentCount) current-food \(currentCount == 1 ? "entry" : "entries") and \(fallbackCount) logged \(fallbackCount == 1 ? "fallback" : "fallbacks")"
        let omitted = [
            calorieFactor == nil ? "calories" : nil,
            proteinFactor == nil ? "protein" : nil,
            fibreFactor == nil ? "fibre" : nil,
        ].compactMap { $0 }

        let explanation: String
        if let score {
            let omittedCopy = omitted.isEmpty ? "" : " Omitted unavailable \(omitted.joined(separator: " and ")) targets and normalized the remaining weights."
            explanation = "\(label) \(score)/100: \(display(nutrients.calories)) kcal against \(display(bounds)) (\(percent(calorieFactor)), 50% weight); \(display(nutrients.protein))g protein against \(display(proteinTarget, suffix: "g")) (\(percent(proteinFactor)), 30% weight); \(display(nutrients.fibre))g fibre against \(display(fibreTarget, suffix: "g")) (\(percent(fibreFactor)), 20% weight). Resolved \(provenance).\(omittedCopy) \(caveat)"
        } else {
            explanation = "\(label) unavailable because no calorie, protein, or fibre targets are available. Resolved \(provenance). \(caveat)"
        }

        return DailyScore(
            score: score,
            label: label,
            nutrients: nutrients,
            calorieFactor: calorieFactor,
            proteinFactor: proteinFactor,
            fibreFactor: fibreFactor,
            fallbackCount: fallbackCount,
            explanation: explanation
        )
    }

    private static func calorieBounds(_ targets: DailyScoreTargets) -> [Double]? {
        if let range = targets.calorieRange,
           range.count == 2,
           let first = positive(range[0]),
           let second = positive(range[1]) {
            return [min(first, second), max(first, second)]
        }
        guard let target = positive(targets.calorieTarget) else { return nil }
        return [target, target]
    }

    private static func calorieAdherence(_ calories: Double, bounds: [Double]?) -> Double? {
        guard let bounds, bounds.count == 2 else { return nil }
        if calories < bounds[0] { return factor(calories, target: bounds[0]) }
        if calories <= bounds[1] { return 1 }
        return min(1, max(0, 1 - 2 * ((calories - bounds[1]) / bounds[1])))
    }

    private static func targetCompletion(_ value: Double, target: Double?) -> Double? {
        target.map { factor(value, target: $0) }
    }

    private static func factor(_ value: Double, target: Double) -> Double {
        min(1, max(0, value / target))
    }

    private static func positive(_ value: Double?) -> Double? {
        guard let value, value.isFinite, value > 0 else { return nil }
        return value
    }

    private static func nonNegative(_ value: Double) -> Double {
        value.isFinite ? max(0, value) : 0
    }

    private static func rounded(_ value: Double) -> Double {
        (value * 10).rounded() / 10
    }

    private static func percent(_ value: Double?) -> String {
        value.map { "\(Int(($0 * 100).rounded()))%" } ?? "not scored"
    }

    private static func display(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0 ... 1)))
    }

    private static func display(_ value: Double?, suffix: String) -> String {
        value.map { "\(display($0))\(suffix)" } ?? "no target"
    }

    private static func display(_ bounds: [Double]?) -> String {
        guard let bounds, bounds.count == 2 else { return "no target" }
        return bounds[0] == bounds[1]
            ? "\(display(bounds[0])) kcal"
            : "\(display(bounds[0]))–\(display(bounds[1])) kcal"
    }
}

public enum TrackedQualityEvaluator {
    public static let proteinBenchmarkPer100Kcal = 8.0
    public static let fibreBenchmarkPer100Kcal = 3.0

    private static let caveat = "This tracked score does not assess ingredients, vitamins, minerals, sodium, added sugars, fat quality, dietary variety, or overall health quality."

    public static func evaluate(_ nutrients: Nutrients) -> TrackedQuality {
        guard nutrients.calories.isFinite, nutrients.calories > 0 else {
            return unavailable
        }

        let proteinPer100Kcal = rounded(nonNegative(nutrients.protein) * 100 / nutrients.calories)
        let fibrePer100Kcal = rounded(nonNegative(nutrients.fibre) * 100 / nutrients.calories)
        let proteinFactor = factor(proteinPer100Kcal, benchmark: proteinBenchmarkPer100Kcal)
        let fibreFactor = factor(fibrePer100Kcal, benchmark: fibreBenchmarkPer100Kcal)
        let score = Int((70 * max(proteinFactor, fibreFactor) + 30 * min(proteinFactor, fibreFactor)).rounded())
        let label = "\(score) tracked score"

        return TrackedQuality(
            score: score,
            label: label,
            proteinPer100Kcal: proteinPer100Kcal,
            fibrePer100Kcal: fibrePer100Kcal,
            proteinFactor: proteinFactor,
            fibreFactor: fibreFactor,
            explanation: "Tracked quality \(score)/100: \(display(proteinPer100Kcal)) g protein and \(display(fibrePer100Kcal)) g fibre per 100 kcal. Protein factor \(Int((proteinFactor * 100).rounded()))%; fibre factor \(Int((fibreFactor * 100).rounded()))%. Score = 70% stronger factor + 30% complementary factor. \(caveat)"
        )
    }

    public static func evaluateMenu(_ entries: [Nutrients]) -> TrackedQuality {
        guard entries.allSatisfy({ $0.calories.isFinite && $0.calories >= 0 }) else {
            return unavailable
        }

        let total = entries.reduce(into: Nutrients()) { result, entry in
            result.calories += entry.calories
            result.protein += nonNegative(entry.protein)
            result.fibre += nonNegative(entry.fibre)
        }
        return evaluate(total)
    }

    private static var unavailable: TrackedQuality {
        TrackedQuality(
            score: nil,
            label: "Tracked score unavailable",
            proteinPer100Kcal: nil,
            fibrePer100Kcal: nil,
            proteinFactor: nil,
            fibreFactor: nil,
            explanation: "Add calories to calculate Tracked quality. \(caveat)"
        )
    }

    private static func nonNegative(_ value: Double) -> Double {
        value.isFinite ? max(0, value) : 0
    }

    private static func factor(_ value: Double, benchmark: Double) -> Double {
        min(1, max(0, value / benchmark))
    }

    private static func rounded(_ value: Double) -> Double {
        (value * 10).rounded() / 10
    }

    private static func display(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0 ... 1)))
    }
}
