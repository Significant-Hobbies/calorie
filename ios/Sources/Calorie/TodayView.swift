import CalorieCore
import SaaSMakerUI
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
        .clipped()
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
                Label("log food", systemImage: "plus").accessibilityLabel("Log food")
                    .frame(maxWidth: .infinity)
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
                Text("calorie")
                    .font(CalorieType.caption.weight(.heavy))
                    .tracking(1.4)
                Text(greeting.lowercased()).accessibilityLabel(greeting)
                    .font(CalorieType.title2.bold())
            }
        }
    }

    private var syncLabel: some View {
        let text = CalorieSyncStatusCopy.text(
            for: model.document.syncState,
            pendingCount: model.pendingSyncCount
        )
        return SMStatusPill(text.lowercased())
            .accessibilityLabel(text)
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
                    .font(CalorieType.headline.weight(.bold))
                Text(model.selectedDate.formatted(.dateTime.day().month(.wide)))
                    .font(CalorieType.caption).foregroundStyle(.secondary)
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
        let targets = model.targetExplanation?.target
        return VStack(alignment: .leading, spacing: 18) {
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    energySummary(target: targets?.calories, recorded: totals.calories)
                } else {
                    HStack(alignment: .lastTextBaseline) {
                        energySummary(target: targets?.calories, recorded: totals.calories)
                        Spacer()
                        CherryMark()
                    }
                }
            }
            if let targets {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Capsule().fill(CaloriePalette.surfaceStrong)
                        Capsule().fill(CaloriePalette.moss)
                            .frame(width: geometry.size.width * min(1, totals.calories / max(1, targets.calories)))
                    }
                }
                .frame(height: 10)
            }
            if dynamicTypeSize.isAccessibilitySize {
                LazyVGrid(columns: [GridItem(.flexible())], alignment: .leading, spacing: 18) {
                    nutrient("PROTEIN", totals.protein, targets?.protein, CaloriePalette.moss)
                    nutrient("CARBS", totals.carbohydrates, targets?.carbohydrates, CaloriePalette.amber)
                    nutrient("FAT", totals.fat, targets?.fat, CaloriePalette.cherry)
                    nutrient("FIBRE", totals.fibre, targets?.fibre, CaloriePalette.mossStrong)
                }
            } else {
                HStack(spacing: 0) {
                    nutrient("PROTEIN", totals.protein, targets?.protein, CaloriePalette.moss)
                    nutrient("CARBS", totals.carbohydrates, targets?.carbohydrates, CaloriePalette.amber)
                    nutrient("FAT", totals.fat, targets?.fat, CaloriePalette.cherry)
                    nutrient("FIBRE", totals.fibre, targets?.fibre, CaloriePalette.mossStrong)
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
        .botanicalCard(padding: 18)
    }

    private func energySummary(target: Double?, recorded: Double) -> some View {
        let remaining = target.map { max(0, $0 - recorded) }
        let displayed = (remaining ?? recorded).formatted(.number.precision(.fractionLength(0)))
        return VStack(alignment: .leading, spacing: 3) {
            BotanicalSectionLabel(text: remaining == nil ? "Energy recorded" : "Energy left today")
            Text(displayed)
                .font(CalorieType.energy.bold().monospacedDigit())
                .accessibilityLabel("\(displayed) kilocalories \(remaining == nil ? "recorded" : "remaining")")
            Text(remaining == nil ? "kcal recorded" : "kcal remaining · \(recorded.formatted(.number.precision(.fractionLength(0)))) recorded")
                .font(CalorieType.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }

    private func nutrient(_ label: String, _ value: Double, _ target: Double?, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Rectangle().fill(color).frame(width: 24, height: 3)
            Text(value.formatted(.number.precision(.fractionLength(0))))
                .font(CalorieType.headline.monospacedDigit().weight(.bold))
            Text(target.map { "of \($0.formatted(.number.precision(.fractionLength(0))))g" } ?? "g")
                .font(CalorieType.caption2).foregroundStyle(.secondary)
            Text(label.lowercased()).font(CalorieType.caption2.weight(.heavy))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(target.map { "\(label), \(value.formatted()) of \($0.formatted()) grams" } ?? "\(label), \(value.formatted()) grams")
    }

    private var mealJournal: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                SMSectionHeader("Food journal", size: 22).accessibilityLabel("Food journal")
                Spacer()
                Text("\(model.selectedEntries.count) \(model.selectedEntries.count == 1 ? "entry" : "entries")").font(CalorieType.caption.weight(.bold)).foregroundStyle(.secondary)
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
            SMSectionHeader("Daily care", size: 22).accessibilityLabel("Daily care")
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
                Label("edit weight, cycle & note", systemImage: "slider.horizontal.3").accessibilityLabel("Edit weight, cycle & note")
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(SMButtonStyle(.outline))
        }
    }

    private var waterCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: "drop.fill").foregroundStyle(.blue)
            Text("water").accessibilityLabel("Water").font(CalorieType.headline)
            Text("\(model.document.waterTotal(on: model.selectedDate)) ml")
                .font(CalorieType.title3.monospacedDigit().weight(.bold))
            Button("+ 250 ml") { Task { await model.addWater(250) } }
                .textCase(.lowercase).accessibilityLabel("+ 250 ml")
                .font(CalorieType.subheadline.weight(.bold)).frame(minHeight: 44)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .botanicalCard(padding: 15, color: CaloriePalette.sky)
    }

    @ViewBuilder
    private var routineCard: some View {
        if let routine = model.document.routines.first(where: { !$0.isArchived }) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(.purple)
                Text(routine.name).font(CalorieType.headline)
                Text(routine.period.rawValue).font(CalorieType.subheadline).foregroundStyle(.secondary)
                Button(model.document.isRoutineComplete(routine.id, on: model.selectedDate) ? "Completed" : "Mark done") {
                    Task { await model.toggleRoutine(routine) }
                }
                .textCase(.lowercase)
                .font(CalorieType.subheadline.weight(.bold)).frame(minHeight: 44)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .botanicalCard(padding: 15, color: CaloriePalette.plum)
        }
    }

    private var guidance: some View {
        VStack(alignment: .leading, spacing: 10) {
            SMSectionHeader("Useful timing", size: 22).accessibilityLabel("Useful timing")
            Text("Every estimate shows its working.").font(CalorieType.subheadline).foregroundStyle(.secondary)
            ForEach(model.guidance) { item in
                Button {
                    expandedGuidance = expandedGuidance == item.id ? nil : item.id
                } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(item.title.lowercased()).accessibilityLabel(item.title).font(CalorieType.headline)
                                Text(item.timing).font(CalorieType.subheadline).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: expandedGuidance == item.id ? "chevron.up" : "chevron.down")
                        }
                        if expandedGuidance == item.id {
                            Text(item.explanation)
                                .font(CalorieType.subheadline)
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
                .font(CalorieType.body)
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
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(AppModel.self) private var model
    let entry: FoodEntry
    let onEdit: () -> Void

    private var scoreBasis: EntryScoreBasis {
        EntryScoreBasisResolver.resolve(entry, foods: model.document.foods)
    }

    var body: some View {
        let layout = dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8))
            : AnyLayout(HStackLayout(spacing: 12))
        return layout {
            Text(entry.timestamp.formatted(.dateTime.hour().minute()))
                .font(CalorieType.caption.monospacedDigit().weight(.bold))
                .fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 3) {
                Text(entry.foodName).font(CalorieType.headline)
                Text("\(entry.servings.formatted()) serving · protein \(entry.nutrients.protein.formatted(.number.precision(.fractionLength(0))))g · carbs \(entry.nutrients.carbohydrates.formatted(.number.precision(.fractionLength(0))))g · fibre \(entry.nutrients.fibre.formatted(.number.precision(.fractionLength(0))))g")
                    .font(CalorieType.caption).foregroundStyle(.secondary)
                TrackedQualityScoreView(
                    quality: TrackedQualityEvaluator.evaluate(scoreBasis.nutrients),
                    contextLabel: "Entry score",
                    basisLabel: scoreBasis.source == .currentFood ? "Latest active food" : "Logged values fallback"
                )
            }
            if !dynamicTypeSize.isAccessibilitySize { Spacer() }
            Text(entry.nutrients.calories.formatted(.number.precision(.fractionLength(0))))
                .font(CalorieType.headline.monospacedDigit().weight(.bold))
        }
        .padding(.vertical, 9)
        .contextMenu {
            Button("Edit") { onEdit() }
                .textCase(.lowercase).accessibilityLabel("Edit")
            Button("Duplicate") { Task { await model.duplicate(entry) } }
                .textCase(.lowercase).accessibilityLabel("Duplicate")
            Button("Delete", role: .destructive) { Task { await model.delete(entry) } }
                .textCase(.lowercase).accessibilityLabel("Delete")
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
                LocalSaveErrorView()
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
            .botanicalNavigationTitle("Edit food entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .textCase(.lowercase).accessibilityLabel("Cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            if await model.update(entry, servings: servings, meal: meal, timestamp: timestamp) {
                                dismiss()
                            }
                        }
                    }
                    .textCase(.lowercase).accessibilityLabel("Save")
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
                LocalSaveErrorView()
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
            .botanicalNavigationTitle(date.formatted(.dateTime.day().month(.wide)))
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
                        .textCase(.lowercase).accessibilityLabel("Cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let cycle = CycleContext(
                            enabled: cycleEnabled,
                            latestPeriodStart: cycleEnabled ? cycleStart : nil,
                            typicalCycleDays: cycleEnabled ? cycleDays : nil
                        )
                        Task {
                            let saved = await model.saveDailyContext(
                                weightKilograms: Double(weight),
                                note: note,
                                cycle: cycle
                            )
                            if saved { dismiss() }
                        }
                    }
                    .textCase(.lowercase).accessibilityLabel("Save")
                    .disabled(!weight.isEmpty && Double(weight) == nil)
                }
            }
        }
    }
}
