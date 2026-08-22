import CalorieCore
import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model
    @AppStorage(CalorieOnboardingPreferences.completedKey) private var onboardingCompleted = false
    @State private var isOnboardingSessionActive = false

    var body: some View {
        @Bindable var model = model
        Group {
            if model.isLoading {
                ProgressView("Opening your food journal…")
            } else if isOnboardingSessionActive || model.shouldPresentCalorieOnboarding(completed: onboardingCompleted) {
                CalorieOnboardingView {
                    onboardingCompleted = true
                    isOnboardingSessionActive = false
                }
                .onAppear { isOnboardingSessionActive = true }
            } else {
                mainTabs(selection: $model.selectedTab)
            }
        }
        .botanicalBackground()
        .sheet(isPresented: $model.isQuickLogPresented) { QuickLogView() }
        .sheet(isPresented: $model.isReconciliationPresented) { ReconciliationView() }
        .overlay(alignment: .bottom) {
            if model.lastDeletedEntry != nil {
                HStack {
                    Text("Entry removed")
                    Spacer()
                    Button("Undo") { Task { await model.undoDelete() } }.fontWeight(.bold)
                }
                .padding(14)
                .background(.regularMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 13))
                .padding(.horizontal, 18)
                .padding(.bottom, 54)
            }
        }
        .alert("Calorie", isPresented: Binding(
            get: { model.message != nil && model.lastDeletedEntry == nil },
            set: { if !$0 { model.message = nil } }
        )) {
            Button("OK", role: .cancel) { model.message = nil }
        } message: {
            Text(model.message ?? "")
        }
    }

    private func mainTabs(selection: Binding<Int>) -> some View {
        TabView(selection: selection) {
            NavigationStack { TodayView() }
                .tabItem { Label("Today", systemImage: "sun.max.fill") }
                .tag(0)
            NavigationStack { ProgressViewScreen() }
                .tabItem { Label("Progress", systemImage: "chart.line.uptrend.xyaxis") }
                .tag(1)
            NavigationStack { FoodsView() }
                .tabItem { Label("Foods", systemImage: "leaf.fill") }
                .tag(2)
            NavigationStack { YouView() }
                .tabItem { Label("You", systemImage: "person.crop.circle.fill") }
                .tag(3)
        }
    }
}

private struct ReconciliationView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var proposedChoice: JournalReconciliationChoice?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    botanicalHeader("Bring your journal together", subtitle: "Nothing changes until you choose.")
                    comparison
                    choice(
                        title: "Use cloud journal",
                        detail: "Replace supported records on this device with your existing web history. Appearance stays the same.",
                        symbol: "icloud.and.arrow.down.fill",
                        choice: .keepCloud
                    )
                    choice(
                        title: "Merge both journals",
                        detail: "Keep records from both sides. If the same record was edited twice, this device's version stays.",
                        symbol: "arrow.triangle.merge",
                        choice: .merge
                    )
                    choice(
                        title: "Keep this device",
                        detail: "Leave this device unchanged and upload its food, water, weight, and routine records.",
                        symbol: "iphone.gen3",
                        choice: .keepIPhone
                    )
                    Text("Meal labels, cycle context, daily notes, and fat values that exist only on this device stay on this device. Calorie never invents missing cloud fields.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(18)
            }
            .botanicalBackground()
            .navigationTitle("Journal choice")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Decide later") { model.deferReconciliation() }
                        .disabled(model.isAccountWorking)
                }
            }
            .overlay {
                if model.isAccountWorking {
                    ZStack {
                        Rectangle().fill(.ultraThinMaterial)
                        ProgressView("Bringing journals together…")
                            .padding(20)
                            .background(CaloriePalette.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .ignoresSafeArea()
                }
            }
            .interactiveDismissDisabled(model.isAccountWorking)
            .confirmationDialog(
                confirmationTitle,
                isPresented: Binding(
                    get: { proposedChoice != nil },
                    set: { if !$0 { proposedChoice = nil } }
                ),
                titleVisibility: .visible
            ) {
                if let proposedChoice {
                    Button(confirmationAction(proposedChoice), role: proposedChoice == .keepCloud ? .destructive : nil) {
                        self.proposedChoice = nil
                        Task { await model.reconcileJournal(proposedChoice) }
                    }
                }
                Button("Review again", role: .cancel) { proposedChoice = nil }
            } message: {
                Text(confirmationDetail)
            }
        }
    }

    @ViewBuilder
    private var comparison: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(spacing: 12) { comparisonCards }
        } else {
            HStack(spacing: 12) { comparisonCards }
        }
    }

    @ViewBuilder
    private var comparisonCards: some View {
        countCard("This device", counts: JournalCounts(document: model.document), tint: CaloriePalette.moss)
        countCard("Cloud journal", counts: model.cloudSnapshot?.counts ?? JournalCounts(document: CalorieDocument()), tint: CaloriePalette.cherry)
    }

    private func countCard(_ title: String, counts: JournalCounts, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption.weight(.bold)).foregroundStyle(tint)
            Text("\(counts.activityTotal)").font(.title.bold().monospacedDigit())
            Text("logged records").font(.caption).foregroundStyle(.secondary)
            Text("\(counts.foodEntries) food · \(counts.waterEntries) water")
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text("\(counts.weightEntries) weight · \(counts.routineCheckIns) check-ins")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(CaloriePalette.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func choice(
        title: String,
        detail: String,
        symbol: String,
        choice: JournalReconciliationChoice
    ) -> some View {
        Button { proposedChoice = choice } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: symbol)
                    .font(.title3)
                    .foregroundStyle(CaloriePalette.moss)
                    .frame(width: 30)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.headline)
                    Text(detail).font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").foregroundStyle(.tertiary)
            }
            .frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
            .padding(14)
            .background(CaloriePalette.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .disabled(model.isAccountWorking)
    }

    private var confirmationTitle: String {
        guard let proposedChoice else { return "Choose a journal" }
        return switch proposedChoice {
        case .keepCloud: "Replace this device's supported records?"
        case .keepIPhone: "Upload this device's supported records?"
        case .merge: "Merge both journals?"
        }
    }

    private var confirmationDetail: String {
        guard let proposedChoice else { return "Nothing changes until you confirm." }
        return switch proposedChoice {
        case .keepCloud:
            "Cloud food, water, weight, and routine history will replace those categories here. Notes, meal labels, cycle context, fat values, and appearance that only exist on this device stay here."
        case .keepIPhone:
            "This device stays unchanged. Its supported records will be queued for cloud sync; device-only notes and context remain private to this device."
        case .merge:
            "Records from both journals will be kept. When the same record exists in both places, this device's version will be used."
        }
    }

    private func confirmationAction(_ choice: JournalReconciliationChoice) -> String {
        switch choice {
        case .keepCloud: "Use cloud records"
        case .keepIPhone: "Keep and upload device records"
        case .merge: "Merge journals"
        }
    }
}
