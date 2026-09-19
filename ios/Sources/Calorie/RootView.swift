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
            } else if !model.hasLoadedDocument {
                NavigationStack { YouView(recoveryOnly: true) }
            } else if isOnboardingSessionActive || model.shouldPresentCalorieOnboarding(completed: onboardingCompleted) {
                CalorieOnboardingView {
                    onboardingCompleted = true
                    isOnboardingSessionActive = false
                    model.dismissOnboarding()
                }
                .onAppear { isOnboardingSessionActive = true }
            } else {
                mainTabs(selection: $model.selectedTab)
            }
        }
        .botanicalBackground()
        .sheet(isPresented: $model.isQuickLogPresented) { QuickLogView() }
        .sheet(isPresented: $model.isApprovalPresented) { ApprovalView() }
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
            get: { model.message != nil && (model.lastDeletedEntry == nil || model.saveError != nil) },
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

private struct ApprovalView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    botanicalHeader("Connect your journal", subtitle: "Nothing changes until you approve.")
                    Text("This journal can sync privately to \(model.account?.email ?? "your account"). Records merge automatically — the newest version of each record wins — and a fresh install can restore from either iCloud or Significant Hobbies.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Button { Task { await model.approveCloudAccount() } } label: {
                        Label("Connect this journal", systemImage: "checkmark.icloud.fill")
                            .frame(maxWidth: .infinity, minHeight: 48)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.isAccountWorking)
                }
                .padding(18)
            }
            .botanicalBackground()
            .navigationTitle("Journal connection")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Decide later") { model.deferApproval() }
                        .disabled(model.isAccountWorking)
                }
            }
            .overlay {
                if model.isAccountWorking {
                    ZStack {
                        Rectangle().fill(.ultraThinMaterial)
                        ProgressView("Connecting your journal…")
                            .padding(20)
                            .background(CaloriePalette.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .ignoresSafeArea()
                }
            }
            .interactiveDismissDisabled(model.isAccountWorking)
        }
    }
}

struct LocalSaveErrorView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if let error = model.saveError {
            Text("Could not save. Your input is still here. \(error)")
                .font(.callout)
                .foregroundStyle(.red)
                .accessibilityIdentifier("local-save-error")
        }
    }
}
