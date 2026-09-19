import CalorieCore
import Foundation
import PersonalSyncKit

/// Read-and-delete access to the retired Calorie worker journal.
///
/// The app's own sync API was demoted to a connector when the journal moved to
/// the shared mirror (CloudKit private zone + Hub `calorie` domain). What
/// remains is exactly one read — `cloudExport` — to import pre-migration
/// cloud data into the canonical stores, plus `deleteData` so "delete cloud
/// account" still clears the legacy copy. The shared-identity bearer the
/// mirror uses is also accepted by the worker's shared-identity fallback, so
/// no second credential lives here.
protocol LegacyCalorieServing: Sendable {
    func cloudExport() async throws -> Data
    func deleteData() async throws
}

enum LegacyCalorieError: LocalizedError {
    case missingSession
    case http(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .missingSession: "Your Calorie session expired. Sign in again."
        case let .http(_, message): message
        }
    }
}

struct LegacyCalorieJournal: LegacyCalorieServing {
    static let productionBaseURL = URL(string: "https://calorie.significanthobbies.com")!

    private let baseURL: URL
    private let urlSession: URLSession
    private let tokenStore: any PersonalBearerTokenStore

    init(
        baseURL: URL = productionBaseURL,
        urlSession: URLSession = .shared,
        tokenStore: any PersonalBearerTokenStore = KeychainBearerTokenStore(
            service: "com.significanthobbies.calorie.session"
        )
    ) {
        self.baseURL = baseURL
        self.urlSession = urlSession
        self.tokenStore = tokenStore
    }

    func cloudExport() async throws -> Data {
        try await request(path: "/api/app/export", method: "GET")
    }

    func deleteData() async throws {
        _ = try await request(path: "/api/app/data", method: "DELETE")
    }

    private func request(path: String, method: String) async throws -> Data {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        guard let token = try await tokenStore.load() else {
            throw LegacyCalorieError.missingSession
        }
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, rawResponse) = try await urlSession.data(for: request)
        guard let response = rawResponse as? HTTPURLResponse else {
            throw LegacyCalorieError.http(status: -1, message: "Calorie returned an invalid response.")
        }
        guard (200..<300).contains(response.statusCode) else {
            throw LegacyCalorieError.http(
                status: response.statusCode,
                message: "Calorie could not complete the request (\(response.statusCode))."
            )
        }
        return data
    }
}
