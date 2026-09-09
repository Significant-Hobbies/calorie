import CalorieCore
import SwiftUI

@main
struct CalorieApp: App {
    @Environment(\.scenePhase) private var scenePhase
    #if DEBUG
    private let fixture: PersistentJournalFixture?
    @State private var model: AppModel

    init() {
        let fixture = PersistentJournalFixture.fromLaunchArguments()
        self.fixture = fixture
        _model = State(initialValue: fixture?.makeModel() ?? AppModel())
    }
    #else
    @State private var model = AppModel()
    #endif

    var body: some Scene {
        WindowGroup {
            journalView
                .environment(model)
                .preferredColorScheme(model.preferredColorScheme)
                .task {
                    #if DEBUG
                    guard fixture?.isCleanup != true else { return }
                    #endif
                    await model.load()
                    await model.restoreAccountAndSync()
                }
                .onChange(of: scenePhase) { _, phase in
                    #if DEBUG
                    guard fixture?.isCleanup != true else { return }
                    #endif
                    guard phase == .active else { return }
                    Task { await model.refreshFromCloud() }
                }
        }
    }

    @ViewBuilder
    private var journalView: some View {
        #if DEBUG
        if fixture?.isCleanup == true {
            Text("Test journal cleaned")
        } else {
            RootView().defaultAppStorage(fixture?.defaults ?? .standard)
        }
        #else
        RootView()
        #endif
    }
}

#if DEBUG
/// Test-only persistence uses real stores, without constructing a credential client.
@MainActor
private struct PersistentJournalFixture {
    let directory: URL
    let defaults: UserDefaults
    let isCleanup: Bool

    static func fromLaunchArguments() -> Self? {
        let arguments = ProcessInfo.processInfo.arguments
        guard let index = arguments.firstIndex(of: "--persistent-ui-fixture") else {
            precondition(!arguments.contains("--cleanup-persistent-ui-fixture"), "Cleanup requires a fixture UUID")
            return nil
        }
        guard index + 1 < arguments.count,
              let id = UUID(uuidString: arguments[index + 1]),
              !arguments.contains(where: ["--fresh-demo", "--onboarding-demo", "--recovery-demo", "--reset-onboarding"].contains)
        else { preconditionFailure("Persistent fixture requires a UUID and no resetting demo flags") }

        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appending(path: "CalorieUITestJournals", directoryHint: .isDirectory)
            .appending(path: id.uuidString, directoryHint: .isDirectory)
        let domain = "com.significanthobbies.calorie.ui-fixture.\(id.uuidString)"
        guard let defaults = UserDefaults(suiteName: domain) else {
            preconditionFailure("Cannot create fixture preferences")
        }
        let isCleanup = arguments.contains("--cleanup-persistent-ui-fixture")
        if isCleanup {
            do {
                if FileManager.default.fileExists(atPath: directory.path) {
                    try FileManager.default.removeItem(at: directory)
                }
                defaults.removePersistentDomain(forName: domain)
            } catch { preconditionFailure("Cannot clean the requested test journal: \(error)") }
        }
        return Self(directory: directory, defaults: defaults, isCleanup: isCleanup)
    }

    func makeModel() -> AppModel {
        AppModel(
            store: CalorieStore(fileURL: directory.appending(path: "journal-v1.json")),
            accountClient: FixtureNoAccountClient(),
            syncStore: SyncIntentStore(fileURL: directory.appending(path: "outbox-v1.json"))
        )
    }
}

private actor FixtureNoAccountClient: NativeAccountServing {
    var googleStartURL: URL { URL(string: "about:blank")! }
    func restoreAccount() async throws -> CalorieAccount? { nil }
    func journal(for _: String) async throws -> any NativeJournalServing { throw CancellationError() }
    func exchangeGoogleHandoff(_: String) async throws -> CalorieAccount { throw CancellationError() }
    func signInWithApple(_: AppleIdentityPayload) async throws -> CalorieAccount { throw CancellationError() }
    func linkApple(_: AppleIdentityPayload) async throws -> CalorieAccount { throw CancellationError() }
    func cloudExport() async throws -> Data { throw CancellationError() }
    func apply(_: SyncIntent) async throws { throw CancellationError() }
    func signOut() async {}
    func deleteAccount() async throws { throw CancellationError() }
}
#endif
