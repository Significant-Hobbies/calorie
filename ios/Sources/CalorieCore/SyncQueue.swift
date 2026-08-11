import Foundation

public enum SyncOperation: Codable, Equatable, Sendable {
    case snapshot(CalorieDocument)
    case deleteFoodEntry(UUID)
    case deleteWaterEntry(UUID)
    case deleteWeightEntry(UUID)
    case deleteRoutineCheckIn(UUID)
}

public struct SyncIntent: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public let createdAt: Date
    public let operation: SyncOperation

    public init(id: UUID = UUID(), createdAt: Date = Date(), operation: SyncOperation) {
        self.id = id
        self.createdAt = createdAt
        self.operation = operation
    }
}

public actor SyncIntentStore {
    public let fileURL: URL
    private var loaded = false
    private var intents: [SyncIntent] = []

    public init(fileURL: URL? = nil) {
        if let fileURL {
            self.fileURL = fileURL
        } else {
            let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            self.fileURL = base.appending(path: "Calorie", directoryHint: .isDirectory)
                .appending(path: "sync-intents-v1.json")
        }
    }

    public func pending() throws -> [SyncIntent] {
        try loadIfNeeded()
        return intents
    }

    public func enqueue(_ operation: SyncOperation) throws {
        try loadIfNeeded()
        if case .snapshot = operation {
            intents.removeAll {
                if case .snapshot = $0.operation { return true }
                return false
            }
        }
        intents.append(SyncIntent(operation: operation))
        try persist()
    }

    public func complete(_ id: UUID) throws {
        try loadIfNeeded()
        intents.removeAll { $0.id == id }
        try persist()
    }

    public func removeAll() throws {
        intents = []
        loaded = true
        try persist()
    }

    private func loadIfNeeded() throws {
        guard !loaded else { return }
        defer { loaded = true }
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        intents = try decoder.decode([SyncIntent].self, from: Data(contentsOf: fileURL))
    }

    private func persist() throws {
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(intents).write(
            to: fileURL,
            options: [.atomic, .completeFileProtectionUnlessOpen]
        )
    }
}
