import Foundation

enum ServerStateQueryPolicy: Sendable {
    case ifStale
    case always
}

enum ServerStateQuerySource: Equatable, Sendable {
    case cache
    case network
}

struct ServerStateQueryResult<Value: Sendable>: Sendable {
    let value: Value
    let source: ServerStateQuerySource
}

actor ServerStateQueryCache<Value: Sendable> {
    private struct CacheEntry: Sendable {
        let value: Value
        let fetchedAt: Date
    }

    private struct InFlightRequest: Sendable {
        let id: Int
        let generation: Int
        let task: Task<Value, Error>
    }

    private let staleAfter: TimeInterval
    private let now: @Sendable () -> Date
    private var cache: CacheEntry?
    private var inFlight: InFlightRequest?
    private var generation = 0
    private var lastClearedGeneration = -1
    private var nextRequestID = 0

    init(
        staleAfter: TimeInterval = 60,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.staleAfter = max(0, staleAfter)
        self.now = now
    }

    func value(
        policy: ServerStateQueryPolicy = .ifStale,
        loader: @escaping @Sendable () async throws -> Value
    ) async throws -> ServerStateQueryResult<Value> {
        if policy == .ifStale, let cache, isFresh(cache) {
            return ServerStateQueryResult(value: cache.value, source: .cache)
        }

        if let inFlight, inFlight.generation == generation {
            return try await resolve(inFlight, loader: loader)
        }

        nextRequestID += 1
        let request = InFlightRequest(
            id: nextRequestID,
            generation: generation,
            task: Task { try await loader() }
        )
        inFlight = request
        return try await resolve(request, loader: loader)
    }

    func invalidate() {
        generation += 1
        cache = nil
    }

    func clear() {
        generation += 1
        lastClearedGeneration = generation
        cache = nil
        inFlight?.task.cancel()
        inFlight = nil
    }

    func cachedValue() -> Value? {
        cache?.value
    }

    private func isFresh(_ entry: CacheEntry) -> Bool {
        now().timeIntervalSince(entry.fetchedAt) < staleAfter
    }

    private func resolve(
        _ request: InFlightRequest,
        loader: @escaping @Sendable () async throws -> Value
    ) async throws -> ServerStateQueryResult<Value> {
        do {
            let value = try await request.task.value
            if inFlight?.id == request.id { inFlight = nil }
            if request.generation < lastClearedGeneration { throw CancellationError() }
            guard request.generation == generation else {
                return try await self.value(policy: .always, loader: loader)
            }
            cache = CacheEntry(value: value, fetchedAt: now())
            return ServerStateQueryResult(value: value, source: .network)
        } catch {
            if inFlight?.id == request.id { inFlight = nil }
            if request.generation < lastClearedGeneration { throw CancellationError() }
            guard request.generation == generation else {
                return try await self.value(policy: .always, loader: loader)
            }
            throw error
        }
    }
}
