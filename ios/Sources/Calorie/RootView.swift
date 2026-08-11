import CalorieCore
import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.selectedTab) {
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
        .botanicalBackground()
        .sheet(isPresented: $model.isQuickLogPresented) { QuickLogView() }
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
}
