import Foundation

public enum SyncOperation: Codable, Equatable, Sendable {
    case snapshot(CalorieDocument)
    case updateProfile(before: Profile, after: Profile)
    case upsertFood(Food)
    case upsertFoodEntry(FoodEntry, food: Food?)
    case upsertWaterEntry(WaterEntry)
    case upsertWeightEntry(WeightEntry)
    case upsertRoutine(MedicationRoutine)
    case upsertRoutineCheckIn(RoutineCheckIn)
    case deleteFoodEntry(UUID)
    case deleteWaterEntry(UUID)
    case deleteWeightEntry(UUID)
    case deleteRoutineCheckIn(UUID)

    fileprivate var compactionKey: String? {
        switch self {
        case .snapshot: nil
        case .updateProfile: "profile"
        case let .upsertFood(food): "food:\(food.id)"
        case let .upsertFoodEntry(entry, _): "entry:\(entry.id)"
        case let .deleteFoodEntry(id): "entry:\(id)"
        case let .upsertWaterEntry(entry): "water:\(entry.id)"
        case let .deleteWaterEntry(id): "water:\(id)"
        case let .upsertWeightEntry(entry): "weight:\(entry.id)"
        case let .deleteWeightEntry(id): "weight:\(id)"
        case let .upsertRoutine(routine): "routine:\(routine.id)"
        case let .upsertRoutineCheckIn(checkIn): "check-in:\(checkIn.id)"
        case let .deleteRoutineCheckIn(id): "check-in:\(id)"
        }
    }
}

public enum CloudJournalDiff {
    public static func operations(
        from before: CalorieDocument,
        to after: CalorieDocument
    ) -> [SyncOperation] {
        var operations: [SyncOperation] = []
        if before.profile != after.profile {
            operations.append(.updateProfile(before: before.profile, after: after.profile))
        }

        operations.append(contentsOf: deleted(before.foodEntries, after.foodEntries).map(SyncOperation.deleteFoodEntry))
        operations.append(contentsOf: deleted(before.waterEntries, after.waterEntries).map(SyncOperation.deleteWaterEntry))
        operations.append(contentsOf: deleted(before.weightEntries, after.weightEntries).map(SyncOperation.deleteWeightEntry))
        operations.append(contentsOf: deleted(before.routineCheckIns, after.routineCheckIns).map(SyncOperation.deleteRoutineCheckIn))

        operations.append(contentsOf: changed(before.foods, after.foods).map(SyncOperation.upsertFood))
        operations.append(contentsOf: changed(before.routines, after.routines).map(SyncOperation.upsertRoutine))
        operations.append(contentsOf: changed(before.foodEntries, after.foodEntries).map { entry in
            .upsertFoodEntry(entry, food: after.foods.first(where: { $0.id == entry.foodID }))
        })
        operations.append(contentsOf: changed(before.waterEntries, after.waterEntries).map(SyncOperation.upsertWaterEntry))
        operations.append(contentsOf: changed(before.weightEntries, after.weightEntries).map(SyncOperation.upsertWeightEntry))
        operations.append(contentsOf: changed(before.routineCheckIns, after.routineCheckIns).map(SyncOperation.upsertRoutineCheckIn))
        return operations
    }

    private static func changed<Value: Equatable & Identifiable>(
        _ before: [Value],
        _ after: [Value]
    ) -> [Value] where Value.ID: Hashable {
        let prior = Dictionary(uniqueKeysWithValues: before.map { ($0.id, $0) })
        return after.filter { prior[$0.id] != $0 }
    }

    private static func deleted<Value: Identifiable>(
        _ before: [Value],
        _ after: [Value]
    ) -> [UUID] where Value.ID == UUID {
        let retained = Set(after.map(\.id))
        return before.map(\.id).filter { !retained.contains($0) }
    }
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
        var compactedOperation = operation
        if case let .updateProfile(_, after) = operation,
           let originalBefore = intents.compactMap({ intent -> Profile? in
               if case let .updateProfile(before, _) = intent.operation { return before }
               return nil
           }).first {
            compactedOperation = .updateProfile(before: originalBefore, after: after)
        }
        if case .snapshot = compactedOperation {
            intents.removeAll {
                if case .snapshot = $0.operation { return true }
                return false
            }
        } else if let key = compactedOperation.compactionKey {
            intents.removeAll { $0.operation.compactionKey == key }
        }
        intents.append(SyncIntent(operation: compactedOperation))
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
