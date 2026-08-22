import CalorieCore
import SwiftUI

enum CalorieOnboardingStep: Int {
    case promise
    case targets
    case manualTargets
    case food
    case result
}

enum CalorieOnboardingPreferences {
    static let completedKey = "calorie-onboarding-completed-v1"
    static let stepKey = "calorie-onboarding-step-v1"
    static let targetPlanKey = "calorie-onboarding-target-plan-v1"
    static let foodNameKey = "calorie-onboarding-food-name-v1"
    static let servingKey = "calorie-onboarding-serving-v1"
    static let amountKey = "calorie-onboarding-amount-v1"
    static let caloriesKey = "calorie-onboarding-calories-v1"
    static let proteinKey = "calorie-onboarding-protein-v1"
    static let carbsKey = "calorie-onboarding-carbs-v1"
    static let fibreKey = "calorie-onboarding-fibre-v1"
    static let saveFoodKey = "calorie-onboarding-save-food-v1"
    static let manualCaloriesKey = "calorie-onboarding-manual-calories-v1"
    static let manualProteinKey = "calorie-onboarding-manual-protein-v1"
    static let manualCarbsKey = "calorie-onboarding-manual-carbs-v1"
    static let manualFibreKey = "calorie-onboarding-manual-fibre-v1"
    static let mealKey = "calorie-onboarding-meal-v1"

    static func reset(defaults: UserDefaults = .standard) {
        [
            completedKey, stepKey, targetPlanKey, foodNameKey, servingKey,
            amountKey, caloriesKey, proteinKey, carbsKey, fibreKey, saveFoodKey,
            manualCaloriesKey, manualProteinKey, manualCarbsKey, manualFibreKey, mealKey,
        ].forEach(defaults.removeObject(forKey:))
    }
}

enum CalorieOnboardingTargetPlan: Equatable {
    case later
    case estimateLater
    case manual(Nutrients)
}

struct CalorieOnboardingConfiguration: Equatable {
    let units: String
    let targets: CalorieOnboardingTargetPlan
}

enum CalorieOnboardingPolicy {
    static func shouldPresent(
        completed: Bool,
        hasLocalActivity: Bool,
        cloudActivityCount: Int,
        forced: Bool = false
    ) -> Bool {
        guard !completed else { return false }
        if forced { return true }
        return !hasLocalActivity && cloudActivityCount == 0
    }
}

struct CalorieOnboardingView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @AppStorage(CalorieOnboardingPreferences.stepKey) private var storedStep = CalorieOnboardingStep.promise.rawValue
    @AppStorage(CalorieOnboardingPreferences.targetPlanKey) private var targetPlan = "later"
    @AppStorage(CalorieOnboardingPreferences.foodNameKey) private var foodName = ""
    @AppStorage(CalorieOnboardingPreferences.servingKey) private var serving = "1 serving"
    @AppStorage(CalorieOnboardingPreferences.amountKey) private var amount = "1"
    @AppStorage(CalorieOnboardingPreferences.caloriesKey) private var calories = ""
    @AppStorage(CalorieOnboardingPreferences.proteinKey) private var protein = ""
    @AppStorage(CalorieOnboardingPreferences.carbsKey) private var carbs = ""
    @AppStorage(CalorieOnboardingPreferences.fibreKey) private var fibre = ""
    @AppStorage(CalorieOnboardingPreferences.saveFoodKey) private var saveFood = true
    @AppStorage(CalorieOnboardingPreferences.manualCaloriesKey) private var manualCalories = ""
    @AppStorage(CalorieOnboardingPreferences.manualProteinKey) private var manualProtein = ""
    @AppStorage(CalorieOnboardingPreferences.manualCarbsKey) private var manualCarbs = ""
    @AppStorage(CalorieOnboardingPreferences.manualFibreKey) private var manualFibre = ""
    @AppStorage(CalorieOnboardingPreferences.mealKey) private var mealRaw = Meal.breakfast.rawValue
    @State private var isSaving = false

    let completion: () -> Void

    private var step: CalorieOnboardingStep {
        CalorieOnboardingStep(rawValue: storedStep) ?? .promise
    }

    private var shouldReduceMotion: Bool {
        reduceMotion || ProcessInfo.processInfo.arguments.contains("--reduce-motion-demo")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(spacing: 12) {
                    LeafMark()
                    VStack(alignment: .leading, spacing: 2) {
                        Text("CALORIE").font(.caption.weight(.bold)).tracking(1.2)
                        Text("Your first useful log").font(.subheadline).foregroundStyle(.secondary)
                    }
                }

                stepContent
                    .id(step)
                    .transition(shouldReduceMotion ? .identity : .opacity.combined(with: .move(edge: .trailing)))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
            .frame(maxWidth: 680, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .botanicalBackground()
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case .promise: promise
        case .targets: targets
        case .manualTargets: manualTargetForm
        case .food: foodForm
        case .result: result
        }
    }

    private var promise: some View {
        VStack(alignment: .leading, spacing: 22) {
            title(
                "Log food, see what changed.",
                detail: "Start with one honest entry. No account, weight, body measurements, or goal is required."
            )

            VStack(alignment: .leading, spacing: 10) {
                Label("The journal works offline", systemImage: "iphone.gen3")
                    .font(.headline)
                Text("Nutrition uses kcal and grams. Optional profile measurements use kilograms, and water uses millilitres throughout Calorie.")
                    .foregroundStyle(.secondary)
            }
            .padding(16)
            .background(CaloriePalette.surface)
            .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))

            Button("Set up my first log") { advance(to: .targets) }
                .buttonStyle(BotanicalButtonStyle())
        }
    }

    private var targets: some View {
        VStack(alignment: .leading, spacing: 20) {
            title(
                "Targets are optional.",
                detail: "Calorie can use numbers you enter, explain an estimate later, or leave targets unset. Logging works in every path."
            )
            choice(
                "Enter my own targets",
                detail: "Use exact calories, protein, carbohydrates, and fibre you already chose.",
                symbol: "hand.draw.fill"
            ) {
                targetPlan = "manual"
                advance(to: .manualTargets)
            }
            choice(
                "Explore an estimate later",
                detail: "The profile screen explains the Mifflin–St Jeor inputs and limitations before estimating anything.",
                symbol: "function"
            ) {
                targetPlan = "estimate-later"
                advance(to: .food)
            }
            choice(
                "No targets for now",
                detail: "Today's totals remain useful and Calorie will not invent a target.",
                symbol: "arrow.right"
            ) {
                targetPlan = "later"
                advance(to: .food)
            }
            backButton(to: .promise)
        }
    }

    private var manualTargetForm: some View {
        VStack(alignment: .leading, spacing: 18) {
            title("Enter only what you mean.", detail: "These are manual daily targets. Calorie will label them as yours, not as estimates.")
            nutrientField("Calories", value: $manualCalories, unit: "kcal")
            nutrientField("Protein", value: $manualProtein, unit: "g")
            nutrientField("Carbohydrates", value: $manualCarbs, unit: "g")
            nutrientField("Fibre", value: $manualFibre, unit: "g")
            Button("Use these targets") { advance(to: .food) }
                .buttonStyle(BotanicalButtonStyle())
                .disabled(manualTargets == nil)
            Button("Continue without targets") {
                targetPlan = "later"
                advance(to: .food)
            }
            .frame(minHeight: 44)
            backButton(to: .targets)
        }
    }

    private var foodForm: some View {
        VStack(alignment: .leading, spacing: 18) {
            title("What did you just eat?", detail: "Use the values you know from a label, recipe, or your own estimate. You can edit the entry later.")

            field("Food name", text: $foodName, keyboard: .default)
            field("Serving description", text: $serving, keyboard: .default)
            field("Amount", text: $amount, keyboard: .decimalPad)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                nutrientField("Calories", value: $calories, unit: "kcal")
                nutrientField("Protein", value: $protein, unit: "g")
                nutrientField("Carbohydrates", value: $carbs, unit: "g")
                nutrientField("Fibre", value: $fibre, unit: "g")
            }

            mealPicker

            Toggle("Save this as a reusable food", isOn: $saveFood)
                .font(.headline)

            Button {
                Task { await saveFirstFood() }
            } label: {
                if isSaving {
                    ProgressView().tint(.white).frame(maxWidth: .infinity)
                } else {
                    Text("Log my first food").frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(BotanicalButtonStyle())
            .disabled(firstFood == nil || isSaving)

            Text("Calorie stores this entry locally first. A connected account may also sync a private copy to Cloudflare.")
                .font(.caption)
                .foregroundStyle(.secondary)
            backButton(to: targetPlan == "manual" ? .manualTargets : .targets)
        }
    }

    private var result: some View {
        let totals = model.selectedTotals
        return VStack(alignment: .leading, spacing: 22) {
            title("Your day changed.", detail: "This is the real Today total after your saved entry—not sample data.")

            if dynamicTypeSize.isAccessibilitySize {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    resultMetrics(totals)
                }
            } else {
                HStack(spacing: 10) {
                    resultMetrics(totals)
                }
            }

            if targetPlan == "estimate-later" {
                Text("When you are ready, You → Set up targets explains every estimate input and formula.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else if targetPlan == "later" {
                Text("Targets are unset. Today's totals still work, and nothing is graded as good or bad.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Button("Open Today") { completion() }
                .buttonStyle(BotanicalButtonStyle())
        }
    }

    @ViewBuilder
    private var mealPicker: some View {
        if dynamicTypeSize.isAccessibilitySize {
            Picker("Meal", selection: $mealRaw) {
                ForEach(Meal.allCases, id: \.self) { Text($0.rawValue).tag($0.rawValue) }
            }
            .pickerStyle(.menu)
        } else {
            Picker("Meal", selection: $mealRaw) {
                ForEach(Meal.allCases, id: \.self) { Text($0.rawValue).tag($0.rawValue) }
            }
            .pickerStyle(.segmented)
        }
    }

    @ViewBuilder
    private func resultMetrics(_ totals: Nutrients) -> some View {
        resultMetric("CAL", totals.calories, "kcal", CaloriePalette.cherry)
        resultMetric("PROTEIN", totals.protein, "g", CaloriePalette.moss)
        resultMetric("CARBS", totals.carbohydrates, "g", CaloriePalette.amber)
        resultMetric("FIBRE", totals.fibre, "g", CaloriePalette.mossStrong)
    }

    private var manualTargets: Nutrients? {
        guard
            let calories = positive(manualCalories),
            let protein = positive(manualProtein),
            let carbs = positive(manualCarbs),
            let fibre = positive(manualFibre)
        else { return nil }
        return Nutrients(calories: calories, protein: protein, carbohydrates: carbs, fibre: fibre)
    }

    private var firstFood: (food: Food, amount: Double)? {
        guard
            !foodName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            !serving.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            let amount = positive(amount),
            let calories = nonnegative(calories),
            let protein = nonnegative(protein),
            let carbs = nonnegative(carbs),
            let fibre = nonnegative(fibre)
        else { return nil }
        let food = Food(
            name: foodName.trimmingCharacters(in: .whitespacesAndNewlines),
            servingName: serving.trimmingCharacters(in: .whitespacesAndNewlines),
            nutrients: Nutrients(calories: calories, protein: protein, carbohydrates: carbs, fibre: fibre),
            isFavorite: saveFood,
            isCustom: saveFood,
            defaultAmount: amount
        )
        return (food, amount)
    }

    private func configuration() -> CalorieOnboardingConfiguration? {
        let targets: CalorieOnboardingTargetPlan
        switch targetPlan {
        case "manual":
            guard let manualTargets else { return nil }
            targets = .manual(manualTargets)
        case "estimate-later": targets = .estimateLater
        default: targets = .later
        }
        return CalorieOnboardingConfiguration(units: "metric", targets: targets)
    }

    @MainActor
    private func saveFirstFood() async {
        guard let firstFood, let configuration = configuration() else { return }
        isSaving = true
        defer { isSaving = false }
        guard await model.completeOnboarding(
            configuration: configuration,
            food: firstFood.food,
            servings: firstFood.amount,
            meal: Meal(rawValue: mealRaw) ?? .breakfast,
            saveFood: saveFood
        ) else { return }
        advance(to: .result)
    }

    private func title(_ heading: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(heading).font(.largeTitle.bold())
            Text(detail).font(.title3).foregroundStyle(.secondary)
        }
    }

    private func choice(_ label: String, detail: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label {
                HStack(alignment: .top, spacing: 8) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(label).font(.headline)
                        Text(detail).font(.subheadline).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                }
            } icon: {
                Image(systemName: symbol)
                    .font(.title3)
                    .foregroundStyle(CaloriePalette.moss)
                    .frame(width: 30)
            }
            .frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
            .padding(14)
            .background(CaloriePalette.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityHint(detail)
    }

    private func field(_ label: String, text: Binding<String>, keyboard: UIKeyboardType) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.caption.weight(.bold)).foregroundStyle(.secondary)
            TextField(label, text: text)
                .keyboardType(keyboard)
                .textFieldStyle(.roundedBorder)
                .frame(minHeight: 44)
                .accessibilityLabel(label)
        }
    }

    private func nutrientField(_ label: String, value: Binding<String>, unit: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.caption.weight(.bold)).foregroundStyle(.secondary)
            HStack {
                TextField("0", text: value)
                    .keyboardType(.decimalPad)
                    .accessibilityLabel(label)
                Text(unit).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 12)
            .frame(minHeight: 48)
            .background(CaloriePalette.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 12).stroke(.secondary.opacity(0.25)) }
        }
    }

    private func resultMetric(_ label: String, _ value: Double, _ unit: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(.caption2.bold()).foregroundStyle(color)
            Text(value.formatted(.number.precision(.fractionLength(0))))
                .font(.title3.bold().monospacedDigit())
            Text(unit).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label), \(value.formatted()) \(unit)")
    }

    private func backButton(to destination: CalorieOnboardingStep) -> some View {
        Button { advance(to: destination) } label: {
            Label("Back", systemImage: "arrow.left").frame(minHeight: 44)
        }
        .font(.subheadline.weight(.semibold))
    }

    private func advance(to destination: CalorieOnboardingStep) {
        if shouldReduceMotion {
            storedStep = destination.rawValue
        } else {
            withAnimation(.easeInOut(duration: 0.22)) { storedStep = destination.rawValue }
        }
    }

    private func positive(_ value: String) -> Double? {
        guard let parsed = Double(value), parsed > 0 else { return nil }
        return parsed
    }

    private func nonnegative(_ value: String) -> Double? {
        guard let parsed = Double(value), parsed >= 0 else { return nil }
        return parsed
    }
}
