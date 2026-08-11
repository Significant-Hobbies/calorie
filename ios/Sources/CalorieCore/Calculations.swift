import Foundation

public struct TargetExplanation: Equatable, Sendable {
    public var target: Nutrients
    public var title: String
    public var detail: String
    public var isEstimate: Bool

    public init(target: Nutrients, title: String, detail: String, isEstimate: Bool) {
        self.target = target
        self.title = title
        self.detail = detail
        self.isEstimate = isEstimate
    }
}

public enum TargetCalculator {
    public static func targets(for profile: Profile) -> TargetExplanation? {
        if let manual = profile.manualMacroTargets {
            return TargetExplanation(
                target: manual,
                title: "Your manual daily targets",
                detail: "These values were entered directly. Calorie did not estimate them.",
                isEstimate: false
            )
        }
        if let calories = profile.manualCalorieTarget {
            return targets(from: calories, title: "Your manual energy target", detail: "The energy target was entered directly. Macro ranges use the visible 25/45/30 split.", isEstimate: false)
        }
        guard let age = profile.age,
              let height = profile.heightCentimetres,
              let weight = profile.weightKilograms,
              let equation = profile.equationProfile else { return nil }
        let resting = (10 * weight) + (6.25 * height) - (5 * Double(age)) + equation.constant
        let maintenance = resting * profile.activity.multiplier
        let adjustment: Double = switch profile.goal {
        case .maintain: 0
        case .gradualLoss: -250
        case .gradualGain: 250
        }
        let calories = max(1_200, maintenance + adjustment)
        return targets(
            from: calories,
            title: "Estimated daily targets",
            detail: "Mifflin–St Jeor: resting energy \(resting.rounded().formatted()) × \(profile.activity.multiplier.formatted()) activity, then \(adjustment.formatted(.number.sign(strategy: .always()))) kcal for \(profile.goal.rawValue.lowercased()). This is an estimate, not medical advice.",
            isEstimate: true
        )
    }

    private static func targets(from calories: Double, title: String, detail: String, isEstimate: Bool) -> TargetExplanation {
        let protein = calories * 0.25 / 4
        let carbohydrates = calories * 0.45 / 4
        let fat = calories * 0.30 / 9
        return TargetExplanation(
            target: Nutrients(calories: calories, protein: protein, carbohydrates: carbohydrates, fat: fat, fibre: 28),
            title: title,
            detail: detail,
            isEstimate: isEstimate
        )
    }
}

public struct GuidanceItem: Identifiable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var timing: String
    public var explanation: String

    public init(id: String, title: String, timing: String, explanation: String) {
        self.id = id
        self.title = title
        self.timing = timing
        self.explanation = explanation
    }
}

public enum GuidanceEngine {
    public static func items(entries: [FoodEntry], now: Date, bedtimeHour: Int = 23) -> [GuidanceItem] {
        let lastMeal = entries.max(by: { $0.timestamp < $1.timestamp })
        let mealCopy: String
        if let lastMeal {
            let elapsed = max(0, now.timeIntervalSince(lastMeal.timestamp))
            mealCopy = "Your last recorded food was \(lastMeal.foodName) \(Int(elapsed / 3_600))h \(Int(elapsed.truncatingRemainder(dividingBy: 3_600) / 60))m ago."
        } else {
            mealCopy = "No food has been recorded today, so this estimate uses no meal timing input."
        }
        return [
            GuidanceItem(id: "training", title: "Training window", timing: "About 1–3 hours after a meal", explanation: "\(mealCopy) This broad range is a practical estimate; comfort varies by meal size and person."),
            GuidanceItem(id: "sleep", title: "Wind-down meal", timing: "Finish a larger meal 2–3 hours before sleep", explanation: "Using your \(bedtimeHour):00 bedtime preference. This is a comfort estimate, not a medical rule."),
            GuidanceItem(id: "fast", title: "Overnight pause", timing: "Count from your last recorded food", explanation: "Calorie reports the recorded interval only. It does not prescribe a fasting target or judge shorter intervals."),
        ]
    }
}
