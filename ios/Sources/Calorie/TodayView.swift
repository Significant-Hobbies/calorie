import CalorieCore
import SwiftUI

struct TodayView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var expandedGuidance: String?
    @State private var editingEntry: FoodEntry?
    @State private var isDailyContextPresented = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                header
                dateRail
                dailyLedger
                mealJournal
                dailyCare
                guidance
                note
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 36)
        }
        .botanicalBackground()
        .navigationBarHidden(true)
        .sheet(item: $editingEntry) { entry in
            EntryEditorView(entry: entry)
        }
        .sheet(isPresented: $isDailyContextPresented) {
            DailyContextEditorView(date: model.selectedDate)
        }
        .safeAreaInset(edge: .bottom) {
            Button {
                model.isQuickLogPresented = true
            } label: {
                Label("Log food", systemImage: "plus")
            }
            .buttonStyle(BotanicalButtonStyle())
            .padding(.horizontal, 18)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial)
        }
    }

    private var header: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 10) {
                    brand
                    syncLabel
                }
            } else {
                HStack(alignment: .center, spacing: 12) {
                    brand
                    Spacer()
                    syncLabel
                }
            }
        }
        .padding(.top, 16)
    }

    private var brand: some View {
        HStack(alignment: .center, spacing: 12) {
            LeafMark(size: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text("CALORIE")
                    .font(.caption.weight(.heavy))
                    .tracking(1.4)
                Text(greeting)
                    .font(.system(.title2, design: .rounded, weight: .bold))
            }
        }
    }

    private var syncLabel: some View {
        Label(
            CalorieSyncStatusCopy.text(
                for: model.document.syncState,
                pendingCount: model.pendingSyncCount
            ),
            systemImage: CalorieSyncStatusCopy.symbol(for: model.document.syncState)
        )
            .font(.caption.weight(.bold))
            .foregroundStyle(.secondary)
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        if hour < 12 { return "Good morning" }
        if hour < 17 { return "Good afternoon" }
        return "Good evening"
    }

    private var dateRail: some View {
        HStack {
            Button { model.selectedDate = Calendar.current.date(byAdding: .day, value: -1, to: model.selectedDate) ?? model.selectedDate } label: {
                Image(systemName: "chevron.left").frame(width: 44, height: 44)
            }
            Spacer()
            VStack(spacing: 2) {
                Text(Calendar.current.isDateInToday(model.selectedDate) ? "Today" : model.selectedDate.formatted(.dateTime.weekday(.wide)))
                    .font(.headline.weight(.bold))
                Text(model.selectedDate.formatted(.dateTime.day().month(.wide)))
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Button { model.selectedDate = Calendar.current.date(byAdding: .day, value: 1, to: model.selectedDate) ?? model.selectedDate } label: {
                Image(systemName: "chevron.right").frame(width: 44, height: 44)
            }
        }
        .background(CaloriePalette.surface)
        .clipShape(RoundedRectangle(cornerRadius: 13))
    }

    private var dailyLedger: some View {
        let totals = model.selectedTotals
        let targets = model.targetExplanation?.target ?? Nutrients(calories: 2_100, protein: 120, carbohydrates: 250, fat: 70, fibre: 28)
        let remaining = max(0, targets.calories - totals.calories)
        return VStack(alignment: .leading, spacing: 18) {
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    energySummary(remaining: remaining, recorded: totals.calories)
                } else {
                    HStack(alignment: .lastTextBaseline) {
                        energySummary(remaining: remaining, recorded: totals.calories)
                        Spacer()
                        CherryMark()
                    }
                }
            }
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule().fill(CaloriePalette.surfaceStrong)
                    Capsule().fill(CaloriePalette.moss)
                        .frame(width: geometry.size.width * min(1, totals.calories / max(1, targets.calories)))
                }
            }
            .frame(height: 10)
            if dynamicTypeSize.isAccessibilitySize {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 18) {
                    nutrient("PROTEIN", totals.protein, targets.protein, CaloriePalette.moss)
                    nutrient("CARBS", totals.carbohydrates, targets.carbohydrates, CaloriePalette.amber)
                    nutrient("FAT", totals.fat, targets.fat, CaloriePalette.cherry)
                    nutrient("FIBRE", totals.fibre, targets.fibre, CaloriePalette.mossStrong)
                }
            } else {
                HStack(spacing: 0) {
                    nutrient("PROTEIN", totals.protein, targets.protein, CaloriePalette.moss)
                    nutrient("CARBS", totals.carbohydrates, targets.carbohydrates, CaloriePalette.amber)
                    nutrient("FAT", totals.fat, targets.fat, CaloriePalette.cherry)
                    nutrient("FIBRE", totals.fibre, targets.fibre, CaloriePalette.mossStrong)
                }
            }
            Divider()
            DailyScoreView(
                result: DailyScoreEvaluator.evaluate(
                    entries: model.selectedEntries,
                    foods: model.document.foods,
                    targets: model.dailyScoreTargets,
                    isCurrentDay: Calendar.current.isDateInToday(model.selectedDate)
                )
            )
        }
        .padding(18)
        .background(CaloriePalette.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func energySummary(remaining: Double, recorded: Double) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            BotanicalSectionLabel(text: "Energy left today")
            Text(remaining.formatted(.number.precision(.fractionLength(0))))
                .font(.system(size: 52, weight: .bold, design: .rounded).monospacedDigit())
                .accessibilityLabel("\(remaining.formatted(.number.precision(.fractionLength(0)))) kilocalories remaining")
            Text("kcal remaining · \(recorded.formatted(.number.precision(.fractionLength(0)))) recorded")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }

    private func nutrient(_ label: String, _ value: Double, _ target: Double, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Rectangle().fill(color).frame(width: 24, height: 3)
            Text(value.formatted(.number.precision(.fractionLength(0))))
                .font(.headline.monospacedDigit().weight(.bold))
            Text("of \(target.formatted(.number.precision(.fractionLength(0))))g")
                .font(.caption2).foregroundStyle(.secondary)
            Text(label).font(.caption2.weight(.heavy))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label), \(value.formatted()) of \(target.formatted()) grams")
    }

    private var mealJournal: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Food journal").font(.title2.weight(.bold))
                Spacer()
                Text("\(model.selectedEntries.count) entries").font(.caption.weight(.bold)).foregroundStyle(.secondary)
            }
            if model.selectedEntries.isEmpty {
                Text("Nothing recorded yet. Add what you ate; the daily score will use the complete menu.")
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 16)
            } else {
                ForEach(Meal.allCases, id: \.self) { meal in
                    let entries = model.selectedEntries.filter { $0.meal == meal }
                    if !entries.isEmpty {
                        BotanicalSectionLabel(text: meal.rawValue)
                        ForEach(entries) { entry in
                            FoodEntryRow(entry: entry) {
                                editingEntry = entry
                            }
                        }
                    }
                }
            }
        }
    }

    private var dailyCare: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Daily care").font(.title2.weight(.bold))
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(spacing: 10) {
                        waterCard
                        routineCard
                    }
                } else {
                    HStack(spacing: 10) {
                        waterCard
                        routineCard
                    }
                }
            }
            Button {
                isDailyContextPresented = true
            } label: {
                Label("Edit weight, cycle & note", systemImage: "slider.horizontal.3")
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.bordered)
        }
    }

    private var waterCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: "drop.fill").foregroundStyle(.blue)
            Text("Water").font(.headline)
            Text("\(model.document.waterTotal(on: model.selectedDate)) ml")
                .font(.title3.monospacedDigit().weight(.bold))
            Button("+ 250 ml") { Task { await model.addWater(250) } }
                .font(.subheadline.weight(.bold)).frame(minHeight: 44)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(15).background(CaloriePalette.sky).clipShape(RoundedRectangle(cornerRadius: 14))
    }

    @ViewBuilder
    private var routineCard: some View {
        if let routine = model.document.routines.first(where: { !$0.isArchived }) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(.purple)
                Text(routine.name).font(.headline)
                Text(routine.period.rawValue).font(.subheadline).foregroundStyle(.secondary)
                Button(model.document.isRoutineComplete(routine.id, on: model.selectedDate) ? "Completed" : "Mark done") {
                    Task { await model.toggleRoutine(routine) }
                }
                .font(.subheadline.weight(.bold)).frame(minHeight: 44)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(15).background(CaloriePalette.plum).clipShape(RoundedRectangle(cornerRadius: 14))
        }
    }

    private var guidance: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Useful timing").font(.title2.weight(.bold))
            Text("Every estimate shows its working.").font(.subheadline).foregroundStyle(.secondary)
            ForEach(model.guidance) { item in
                Button {
                    expandedGuidance = expandedGuidance == item.id ? nil : item.id
                } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(item.title).font(.headline)
                                Text(item.timing).font(.subheadline).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: expandedGuidance == item.id ? "chevron.up" : "chevron.down")
                        }
                        if expandedGuidance == item.id {
                            Text(item.explanation)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .transition(.opacity)
                        }
                    }
                    .foregroundStyle(.primary)
                    .padding(.vertical, 10)
                }
                Divider()
            }
        }
    }

    private var note: some View {
        VStack(alignment: .leading, spacing: 8) {
            BotanicalSectionLabel(text: "A note from today")
            Text(model.document.dailyNotes[DateKey.string(model.selectedDate)] ?? "Add context to remember how the day actually felt.")
                .font(.body)
                .foregroundStyle(.secondary)
                .padding(15)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(CaloriePalette.surface)
                .clipShape(RoundedRectangle(cornerRadius: 13))
        }
    }
}

enum CalorieSyncStatusCopy {
    static func text(for state: SyncState, pendingCount: Int) -> String {
        switch state {
        case .localOnly: "On this device"
        case .pending: pendingCount == 1 ? "1 change waiting" : "\(pendingCount) changes waiting"
        case .synced: "Up to date"
        case .conflict: "Choice required"
        case .failed: "Sync needs attention"
        }
    }

    static func symbol(for state: SyncState) -> String {
        switch state {
        case .localOnly: "iphone.gen3"
        case .pending: "arrow.triangle.2.circlepath.icloud"
        case .synced: "checkmark.icloud.fill"
        case .conflict: "arrow.triangle.branch"
        case .failed: "exclamationmark.icloud.fill"
        }
    }
}

private struct FoodEntryRow: View {
    @Environment(AppModel.self) private var model
    let entry: FoodEntry
    let onEdit: () -> Void

    private var scoreBasis: EntryScoreBasis {
        EntryScoreBasisResolver.resolve(entry, foods: model.document.foods)
    }

    var body: some View {
        HStack(spacing: 12) {
            Text(entry.timestamp.formatted(.dateTime.hour().minute()))
                .font(.caption.monospacedDigit().weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.78)
                .frame(width: 62, alignment: .leading)
            VStack(alignment: .leading, spacing: 3) {
                Text(entry.foodName).font(.headline)
                Text("\(entry.servings.formatted()) serving · protein \(entry.nutrients.protein.formatted(.number.precision(.fractionLength(0))))g · carbs \(entry.nutrients.carbohydrates.formatted(.number.precision(.fractionLength(0))))g · fibre \(entry.nutrients.fibre.formatted(.number.precision(.fractionLength(0))))g")
                    .font(.caption).foregroundStyle(.secondary)
                TrackedQualityScoreView(
                    quality: TrackedQualityEvaluator.evaluate(scoreBasis.nutrients),
                    contextLabel: "Entry score",
                    basisLabel: scoreBasis.source == .currentFood ? "Latest active food" : "Logged values fallback"
                )
            }
            Spacer()
            Text(entry.nutrients.calories.formatted(.number.precision(.fractionLength(0))))
                .font(.headline.monospacedDigit().weight(.bold))
        }
        .padding(.vertical, 9)
        .contextMenu {
            Button("Edit") { onEdit() }
            Button("Duplicate") { Task { await model.duplicate(entry) } }
            Button("Delete", role: .destructive) { Task { await model.delete(entry) } }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAction(named: "Edit") { onEdit() }
        .accessibilityAction(named: "Duplicate") { Task { await model.duplicate(entry) } }
        .accessibilityAction(named: "Delete") { Task { await model.delete(entry) } }
    }
}

private struct EntryEditorView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let entry: FoodEntry
    @State private var servings: Double
    @State private var meal: Meal
    @State private var timestamp: Date

    private var scoreBasis: EntryScoreBasis {
        EntryScoreBasisResolver.resolve(entry, foods: model.document.foods)
    }

    init(entry: FoodEntry) {
        self.entry = entry
        _servings = State(initialValue: entry.servings)
        _meal = State(initialValue: entry.meal)
        _timestamp = State(initialValue: entry.timestamp)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(entry.foodName) {
                    Stepper(
                        "Servings: \(servings.formatted(.number.precision(.fractionLength(2))))",
                        value: $servings,
                        in: 0.05...20,
                        step: 0.25
                    )
                    Picker("Meal", selection: $meal) {
                        ForEach(Meal.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    DatePicker("Time", selection: $timestamp)
                }
                Section("Tracked quality") {
                    TrackedQualityScoreView(
                        quality: TrackedQualityEvaluator.evaluate(scoreBasis.nutrients.scaled(by: servings / max(entry.servings, 0.0001))),
                        contextLabel: "Entry score",
                        basisLabel: scoreBasis.source == .currentFood ? "Latest active food" : "Logged values fallback",
                        showsExplanation: true
                    )
                }
            }
            .navigationTitle("Edit food entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            await model.update(entry, servings: servings, meal: meal, timestamp: timestamp)
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}

private struct DailyContextEditorView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let date: Date
    @State private var weight = ""
    @State private var note = ""
    @State private var cycleEnabled = false
    @State private var cycleStart = Date.now
    @State private var cycleDays = 28

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Weight (kg, optional)", text: $weight)
                        .keyboardType(.decimalPad)
                } header: {
                    Text("Measurement")
                } footer: {
                    Text("A measurement is context, not a grade.")
                }
                Section("Private note") {
                    TextField("How did today actually feel?", text: $note, axis: .vertical)
                        .lineLimit(3...8)
                }
                Section {
                    Toggle("Track cycle context", isOn: $cycleEnabled)
                    if cycleEnabled {
                        DatePicker("Latest period start", selection: $cycleStart, displayedComponents: .date)
                        Stepper("Typical cycle: \(cycleDays) days", value: $cycleDays, in: 15...60)
                    }
                } header: {
                    Text("Cycle context")
                } footer: {
                    Text("Cycle context stays in this local journal and is used only as optional context.")
                }
            }
            .navigationTitle(date.formatted(.dateTime.day().month(.wide)))
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                let calendar = Calendar.current
                if let existing = model.document.weightEntries.first(where: { calendar.isDate($0.date, inSameDayAs: date) }) {
                    weight = existing.kilograms.formatted(.number.precision(.fractionLength(1)))
                }
                note = model.document.dailyNotes[DateKey.string(date)] ?? ""
                cycleEnabled = model.document.cycle.enabled
                cycleStart = model.document.cycle.latestPeriodStart ?? date
                cycleDays = model.document.cycle.typicalCycleDays ?? 28
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let cycle = CycleContext(
                            enabled: cycleEnabled,
                            latestPeriodStart: cycleEnabled ? cycleStart : nil,
                            typicalCycleDays: cycleEnabled ? cycleDays : nil
                        )
                        Task {
                            await model.saveDailyContext(
                                weightKilograms: Double(weight),
                                note: note,
                                cycle: cycle
                            )
                            dismiss()
                        }
                    }
                    .disabled(!weight.isEmpty && Double(weight) == nil)
                }
            }
        }
    }
}
