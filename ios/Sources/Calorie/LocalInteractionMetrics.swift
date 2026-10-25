import Foundation

enum LocalInteractionEvent: String, CaseIterable {
    case logFormOpened = "log_form_opened"
    case logSaved = "log_saved"
    case logCancelled = "log_cancelled"
    case logSaveFailed = "log_save_failed"
    case entryEditOpened = "entry_edit_opened"
    case entryEditSaved = "entry_edit_saved"
    case entryEditCancelled = "entry_edit_cancelled"
    case entryEditSaveFailed = "entry_edit_save_failed"
}

enum LocalInteractionDuration: String, CaseIterable {
    case logFormElapsed = "log_form_elapsed"
    case entryEditElapsed = "entry_edit_elapsed"
}

struct LocalInteractionDay: Codable, Equatable {
    var date: String
    var counters: [String: Int] = [:]
    var durationTotalsSeconds: [String: Double] = [:]
    var durationSamples: [String: Int] = [:]
}

struct LocalInteractionReport: Codable, Equatable {
    var schemaVersion = 1
    var projectId = "calorie"
    var coverageStartedAtISO: String
    var updatedAtISO: String
    var timeZoneIdentifier: String
    var days: [LocalInteractionDay]
}

/// Stores only fixed-name interaction counts and elapsed-time totals locally.
/// A sidecar write is best-effort and never participates in journal persistence.
@MainActor
final class LocalInteractionMetricsStore {
    private let fileURL: URL

    init(fileURL: URL? = nil) {
        self.fileURL = fileURL ?? Self.defaultFileURL
    }

    func record(
        _ event: LocalInteractionEvent,
        elapsedSeconds: Double? = nil,
        now: Date = .now,
        timeZone: TimeZone = .current
    ) {
        do {
            var report = try loadReport(now: now, timeZone: timeZone)
            try validate(report)
            let dayKey = Self.dayKey(for: now, timeZone: timeZone)
            let dayIndex: Int
            if let existing = report.days.firstIndex(where: { $0.date == dayKey }) {
                dayIndex = existing
            } else {
                report.days.append(LocalInteractionDay(date: dayKey))
                dayIndex = report.days.count - 1
            }
            let (nextCount, countOverflow) = report.days[dayIndex].counters[event.rawValue, default: 0]
                .addingReportingOverflow(1)
            guard !countOverflow else { return }
            report.days[dayIndex].counters[event.rawValue] = nextCount
            if let elapsedSeconds, elapsedSeconds.isFinite, elapsedSeconds >= 0,
               let duration = Self.duration(for: event) {
                let nextTotal = report.days[dayIndex].durationTotalsSeconds[duration.rawValue, default: 0]
                    + elapsedSeconds
                let (nextSamples, sampleOverflow) = report.days[dayIndex].durationSamples[duration.rawValue, default: 0]
                    .addingReportingOverflow(1)
                guard nextTotal.isFinite, !sampleOverflow else { return }
                report.days[dayIndex].durationTotalsSeconds[duration.rawValue] = nextTotal
                report.days[dayIndex].durationSamples[duration.rawValue] = nextSamples
            }
            report.days.sort { $0.date < $1.date }
            report.updatedAtISO = Self.iso8601(now)
            report.timeZoneIdentifier = timeZone.identifier
            try persist(report)
        } catch {
            // Optional measurement must never interfere with saving the journal.
        }
    }

    private func loadReport(now: Date, timeZone: TimeZone) throws -> LocalInteractionReport {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            let stamp = Self.iso8601(now)
            return LocalInteractionReport(
                coverageStartedAtISO: stamp,
                updatedAtISO: stamp,
                timeZoneIdentifier: timeZone.identifier,
                days: []
            )
        }
        return try JSONDecoder().decode(LocalInteractionReport.self, from: Data(contentsOf: fileURL))
    }

    private func persist(_ report: LocalInteractionReport) throws {
        try FileManager.default.createDirectory(
            at: fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.completeUnlessOpen]
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(report).write(to: fileURL, options: [.atomic, .completeFileProtectionUnlessOpen])
    }

    private func validate(_ report: LocalInteractionReport) throws {
        let eventNames = Set(LocalInteractionEvent.allCases.map(\.rawValue))
        let durationNames = Set(LocalInteractionDuration.allCases.map(\.rawValue))
        let dates = report.days.map(\.date)
        let valid = report.schemaVersion == 1
            && report.projectId == "calorie"
            && Set(dates).count == dates.count
            && report.days.allSatisfy { day in
                day.date.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil
                    && day.counters.allSatisfy { eventNames.contains($0.key) && $0.value >= 0 }
                    && day.durationTotalsSeconds.allSatisfy {
                        durationNames.contains($0.key) && $0.value.isFinite && $0.value >= 0
                    }
                    && day.durationSamples.allSatisfy {
                        durationNames.contains($0.key) && $0.value >= 0
                    }
            }
        guard valid else { throw CocoaError(.fileReadCorruptFile) }
    }

    private static var defaultFileURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appending(path: "Calorie/interaction-metrics-v1.json")
    }

    private static func duration(for event: LocalInteractionEvent) -> LocalInteractionDuration? {
        switch event {
        case .logSaved, .logCancelled: .logFormElapsed
        case .entryEditSaved, .entryEditCancelled: .entryEditElapsed
        case .logFormOpened, .logSaveFailed, .entryEditOpened, .entryEditSaveFailed: nil
        }
    }

    private static func dayKey(for date: Date, timeZone: TimeZone) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    private static func iso8601(_ date: Date) -> String {
        ISO8601DateFormatter().string(from: date)
    }
}
