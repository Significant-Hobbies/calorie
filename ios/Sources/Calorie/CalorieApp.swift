import CalorieCore
import SwiftUI

@main
struct CalorieApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .preferredColorScheme(model.preferredColorScheme)
                .task { await model.load() }
        }
    }
}
