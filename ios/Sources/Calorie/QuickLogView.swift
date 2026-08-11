import CalorieCore
import SwiftUI

struct QuickLogView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""
    @State private var selectedFood: Food?
    @State private var servings = 1.0
    @State private var meal: Meal = .snack

    private var visibleFoods: [Food] {
        let active = model.document.foods.filter { !$0.isArchived }
        if search.isEmpty {
            return active.sorted { lhs, rhs in
                if lhs.isFavorite != rhs.isFavorite { return lhs.isFavorite }
                return lhs.name < rhs.name
            }
        }
        return active.filter { $0.name.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if let selectedFood {
                    selection(selectedFood)
                } else {
                    List(visibleFoods) { food in
                        Button {
                            selectedFood = food
                            meal = suggestedMeal
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: food.isFavorite ? "heart.fill" : "leaf.fill")
                                    .foregroundStyle(food.isFavorite ? CaloriePalette.cherry : CaloriePalette.moss)
                                    .frame(width: 34, height: 34)
                                    .background(CaloriePalette.surface)
                                    .clipShape(Circle())
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(food.name).font(.headline)
                                    Text("\(food.servingName) · \(food.nutrients.calories.formatted(.number.precision(.fractionLength(0)))) kcal")
                                        .font(.subheadline).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                            }
                            .foregroundStyle(.primary)
                            .frame(minHeight: 54)
                        }
                    }
                    .listStyle(.plain)
                    .searchable(text: $search, prompt: "Search foods")
                }
            }
            .navigationTitle(selectedFood == nil ? "Log food" : "Add entry")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(selectedFood == nil ? "Close" : "Back") {
                        if selectedFood == nil { dismiss() } else { self.selectedFood = nil }
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func selection(_ food: Food) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 6) {
                    BotanicalSectionLabel(text: "Selected food")
                    Text(food.name).font(.system(.title, design: .rounded, weight: .bold))
                    Text(food.servingName).foregroundStyle(.secondary)
                }
                VStack(alignment: .leading, spacing: 8) {
                    BotanicalSectionLabel(text: "Amount")
                    HStack {
                        Button { servings = max(0.25, servings - 0.25) } label: {
                            Image(systemName: "minus").frame(width: 48, height: 48)
                        }
                        Spacer()
                        Text("\(servings.formatted()) ×")
                            .font(.system(size: 34, weight: .bold, design: .rounded).monospacedDigit())
                        Spacer()
                        Button { servings += 0.25 } label: {
                            Image(systemName: "plus").frame(width: 48, height: 48)
                        }
                    }
                    .background(CaloriePalette.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 13))
                }
                Picker("Meal", selection: $meal) {
                    ForEach(Meal.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                let scaled = food.nutrients.scaled(by: servings)
                HStack(spacing: 0) {
                    quickMetric("KCAL", scaled.calories)
                    quickMetric("PROTEIN", scaled.protein)
                    quickMetric("CARBS", scaled.carbohydrates)
                    quickMetric("FAT", scaled.fat)
                }
                Button("Add to \(meal.rawValue.lowercased())") {
                    let time = Calendar.current.date(
                        bySettingHour: Calendar.current.component(.hour, from: .now),
                        minute: Calendar.current.component(.minute, from: .now),
                        second: 0,
                        of: model.selectedDate
                    ) ?? model.selectedDate
                    Task { await model.log(food, servings: servings, meal: meal, at: time) }
                }
                .buttonStyle(BotanicalButtonStyle())
            }
            .padding(20)
        }
    }

    private func quickMetric(_ label: String, _ value: Double) -> some View {
        VStack(spacing: 4) {
            Text(value.formatted(.number.precision(.fractionLength(0))))
                .font(.headline.monospacedDigit().weight(.bold))
            Text(label).font(.system(size: 9, weight: .bold)).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var suggestedMeal: Meal {
        switch Calendar.current.component(.hour, from: .now) {
        case 5..<11: .breakfast
        case 11..<16: .lunch
        case 17..<23: .dinner
        default: .snack
        }
    }
}
