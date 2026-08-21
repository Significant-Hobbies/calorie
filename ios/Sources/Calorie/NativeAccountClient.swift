import AuthenticationServices
import CalorieCore
import CryptoKit
import Foundation
import Security
import UIKit

struct AppleIdentityPayload: Sendable {
    let identityToken: String
    let nonce: String
    let email: String?
    let firstName: String?
    let lastName: String?
}

struct CalorieAccount: Equatable, Sendable {
    let name: String
    let email: String
    let providers: Set<String>

    var hasApple: Bool { providers.contains("apple") }
}

protocol NativeAccountServing: Sendable {
    var googleStartURL: URL { get async }

    func restoreAccount() async throws -> CalorieAccount?
    func exchangeGoogleHandoff(_ code: String) async throws -> CalorieAccount
    func signInWithApple(_ payload: AppleIdentityPayload) async throws -> CalorieAccount
    func linkApple(_ payload: AppleIdentityPayload) async throws -> CalorieAccount
    func cloudExport() async throws -> Data
    func apply(_ intent: SyncIntent) async throws
    func signOut() async
    func deleteAccount() async throws
}

enum NativeAccountError: LocalizedError {
    case invalidAppleCredential
    case invalidCallback
    case missingSession
    case server(String)
    case http(Int, String)

    var errorDescription: String? {
        switch self {
        case .invalidAppleCredential: "Apple did not return a usable identity credential."
        case .invalidCallback: "The account handoff could not be verified."
        case .missingSession: "Your Calorie session expired. Sign in again."
        case let .server(message): message
        case let .http(_, message): message
        }
    }
}

enum NativeProfilePatch {
    static func apply(from before: Profile, to profile: Profile, body: inout [String: Any]) throws {
        if before.name != profile.name { body["displayName"] = profile.name.isEmpty ? "You" : profile.name }
        if before.age != profile.age {
            guard let age = profile.age else {
                throw NativeAccountError.server("Age cannot be removed from a connected journal.")
            }
            body["ageYears"] = age
        }
        if before.heightCentimetres != profile.heightCentimetres {
            guard let height = profile.heightCentimetres else {
                throw NativeAccountError.server("Height cannot be removed from a connected journal.")
            }
            body["heightCm"] = height
        }
        if before.equationProfile != profile.equationProfile {
            body["equationProfile"] = cloudEquationProfile(profile.equationProfile)
        }
        if before.activity != profile.activity { body["activityLevel"] = cloudActivity(profile.activity) }
        if before.goal != profile.goal { body["goal"] = cloudGoal(profile.goal) }
        if before.manualCalorieTarget != profile.manualCalorieTarget {
            body["manualCalorieTarget"] = profile.manualCalorieTarget ?? NSNull()
            body["manualCalorieRange"] = profile.manualCalorieTarget.map {
                [max(800, $0 - 100), min(6_000, $0 + 100)]
            } ?? NSNull()
        }
        if before.waterTargetMillilitres != profile.waterTargetMillilitres {
            body["waterTargetMl"] = profile.waterTargetMillilitres
        }
    }

    private static func cloudGoal(_ goal: Goal) -> String {
        switch goal {
        case .gradualLoss: "lose_gentle"
        case .gradualGain: "gain_gentle"
        case .maintain: "maintain"
        }
    }

    private static func cloudActivity(_ activity: ActivityLevel) -> String {
        switch activity {
        case .light: "light"
        case .moderate: "moderate"
        case .high: "very"
        }
    }

    private static func cloudEquationProfile(_ equationProfile: EquationProfile?) -> String {
        switch equationProfile {
        case .mifflinFemaleConstant: "female"
        case .mifflinMaleConstant: "male"
        case nil: "none"
        }
    }
}

actor KeychainSessionStore {
    private let service: String
    private let account: String

    init(
        service: String = "com.significanthobbies.calorie.session",
        account: String = "better-auth-bearer"
    ) {
        self.service = service
        self.account = account
    }

    func load() throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else {
            throw NativeAccountError.server("The secure session could not be read.")
        }
        return String(data: data, encoding: .utf8)
    }

    func save(_ token: String) throws {
        let data = Data(token.utf8)
        let identity: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let updateStatus = SecItemUpdate(identity as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecItemNotFound {
            var insertion = identity
            insertion.merge(attributes) { _, replacement in replacement }
            let addStatus = SecItemAdd(insertion as CFDictionary, nil)
            guard addStatus == errSecSuccess else {
                throw NativeAccountError.server("The secure session could not be stored.")
            }
        } else if updateStatus != errSecSuccess {
            throw NativeAccountError.server("The secure session could not be updated.")
        }
    }

    func delete() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw NativeAccountError.server("The secure session could not be removed.")
        }
    }
}

actor NativeAccountClient: NativeAccountServing {
    static let productionBaseURL = URL(string: "https://calorie.significanthobbies.com")!
    static let productionIdentityURL = URL(string: "https://significanthobbies.com")!

    private let baseURL: URL
    private let identityBaseURL: URL
    private let urlSession: URLSession
    private let sessionStore: KeychainSessionStore

    init(
        baseURL: URL = productionBaseURL,
        identityBaseURL: URL? = nil,
        urlSession: URLSession = .shared,
        sessionStore: KeychainSessionStore = KeychainSessionStore()
    ) {
        self.baseURL = baseURL
        self.identityBaseURL = identityBaseURL
            ?? (baseURL == Self.productionBaseURL ? Self.productionIdentityURL : baseURL)
        self.urlSession = urlSession
        self.sessionStore = sessionStore
    }

    var googleStartURL: URL {
        var components = URLComponents(
            url: endpoint("/api/native/auth/google/start", target: .identity),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [URLQueryItem(name: "callback", value: "calorie://auth")]
        return components.url!
    }

    func restoreAccount() async throws -> CalorieAccount? {
        guard try await sessionStore.load() != nil else { return nil }
        do {
            return try await account()
        } catch {
            try? await sessionStore.delete()
            throw error
        }
    }

    func exchangeGoogleHandoff(_ code: String) async throws -> CalorieAccount {
        let response = try await request(
            path: "/api/native/auth/exchange",
            body: ["code": code],
            authenticated: false,
            target: .identity
        )
        let payload = try JSONDecoder().decode(TokenResponse.self, from: response.data)
        try await sessionStore.save(payload.token)
        return try await account()
    }

    func signInWithApple(_ payload: AppleIdentityPayload) async throws -> CalorieAccount {
        let response = try await appleRequest(path: "/api/auth/sign-in/social", payload: payload)
        guard let token = response.response.value(forHTTPHeaderField: "set-auth-token") else {
            throw NativeAccountError.missingSession
        }
        try await sessionStore.save(token)
        return try await account()
    }

    func linkApple(_ payload: AppleIdentityPayload) async throws -> CalorieAccount {
        _ = try await appleRequest(path: "/api/auth/link-social", payload: payload, authenticated: true)
        return try await account()
    }

    func cloudExport() async throws -> Data {
        try await request(path: "/api/app/export", method: "GET", authenticated: true).data
    }

    func apply(_ intent: SyncIntent) async throws {
        try await apply(intent.operation)
    }

    private func apply(_ operation: SyncOperation) async throws {
        switch operation {
        case let .snapshot(document):
            let cloud = try CloudJournalMapper.decode(await cloudExport())
            for operation in CloudJournalDiff.operations(from: cloud.document, to: document) {
                try await apply(operation)
            }
        case let .updateProfile(before, after):
            try await pushProfile(before: before, after: after)
        case let .upsertFood(food):
            try await pushFood(food)
        case let .upsertFoodEntry(entry, food):
            try await pushEntry(entry, food: food)
        case let .upsertWaterEntry(water):
            try await pushWater(water)
        case let .upsertWeightEntry(weight):
            try await pushWeight(weight)
        case let .upsertRoutine(routine):
            try await pushRoutine(routine)
        case let .upsertRoutineCheckIn(checkIn):
            try await pushCheckIn(checkIn)
        case let .deleteFoodEntry(id):
            try await delete(path: "/api/app/entries/\(id.uuidString)")
        case let .deleteWaterEntry(id):
            try await delete(path: "/api/app/water/\(id.uuidString)")
        case let .deleteWeightEntry(id):
            try await delete(path: "/api/app/weights/\(id.uuidString)")
        case let .deleteRoutineCheckIn(id):
            try await delete(path: "/api/app/medication-check-ins/\(id.uuidString)")
        }
    }

    func signOut() async {
        _ = try? await request(
            path: "/api/auth/sign-out",
            body: [String: String](),
            authenticated: true,
            target: .identity
        )
        try? await sessionStore.delete()
    }

    func deleteAccount() async throws {
        _ = try await request(
            path: "/api/app/data",
            method: "DELETE",
            jsonBody: nil,
            authenticated: true
        )
        try await sessionStore.delete()
    }

    private func appleRequest(
        path: String,
        payload: AppleIdentityPayload,
        authenticated: Bool = false
    ) async throws -> NetworkResponse {
        var idToken: [String: Any] = ["token": payload.identityToken, "nonce": payload.nonce]
        if path.hasSuffix("sign-in/social") {
            var user: [String: Any] = [:]
            if let email = payload.email { user["email"] = email }
            var name: [String: String] = [:]
            if let firstName = payload.firstName { name["firstName"] = firstName }
            if let lastName = payload.lastName { name["lastName"] = lastName }
            if !name.isEmpty { user["name"] = name }
            if !user.isEmpty { idToken["user"] = user }
        }
        return try await request(
            path: path,
            jsonBody: ["provider": "apple", "idToken": idToken],
            authenticated: authenticated,
            target: .identity
        )
    }

    private func account() async throws -> CalorieAccount {
        let sessionResponse = try await request(
            path: "/api/auth/get-session",
            method: "GET",
            authenticated: true,
            target: .identity
        )
        let session = try JSONDecoder().decode(SessionResponse.self, from: sessionResponse.data)
        let accountsResponse = try await request(
            path: "/api/auth/list-accounts",
            method: "GET",
            authenticated: true,
            target: .identity
        )
        let accounts = try JSONDecoder().decode([ProviderAccount].self, from: accountsResponse.data)
        return CalorieAccount(
            name: session.user.name,
            email: session.user.email,
            providers: Set(accounts.map(\.providerId))
        )
    }

    private func pushProfile(before: Profile, after profile: Profile) async throws {
        guard hasSupportedProfileChange(from: before, to: profile) else { return }
        let response = try await request(path: "/api/app/profile", method: "GET", authenticated: true)
        guard var body = try JSONSerialization.jsonObject(with: response.data) as? [String: Any] else {
            throw NativeAccountError.server("Calorie returned an invalid profile.")
        }
        try NativeProfilePatch.apply(from: before, to: profile, body: &body)
        _ = try await request(
            path: "/api/app/profile",
            method: "PUT",
            jsonBody: body,
            authenticated: true
        )
    }

    private func hasSupportedProfileChange(from before: Profile, to after: Profile) -> Bool {
        [
            before.name != after.name,
            before.age != after.age,
            before.heightCentimetres != after.heightCentimetres,
            before.goal != after.goal,
            before.activity != after.activity,
            before.equationProfile != after.equationProfile,
            before.manualCalorieTarget != after.manualCalorieTarget,
            before.waterTargetMillilitres != after.waterTargetMillilitres,
        ].contains(true)
    }

    private func pushFood(_ food: Food) async throws {
        let servingGrams = food.servingGrams ?? 0
        let scale = servingGrams > 0 ? 100 / servingGrams : 1
        let body: [String: Any] = [
            "id": food.id.uuidString,
            "name": food.name,
            "servingMode": servingGrams > 0 ? "per_100g" : "per_unit",
            "unitLabel": food.servingName,
            "defaultAmount": servingGrams > 0 ? servingGrams : (food.defaultAmount ?? 1),
            "calories": food.nutrients.calories * scale,
            "carbsG": food.nutrients.carbohydrates * scale,
            "proteinG": food.nutrients.protein * scale,
            "fibreG": food.nutrients.fibre * scale,
            "favourite": food.isFavorite,
            "isPackaged": food.isPackaged ?? false,
            "labels": food.labels ?? [],
        ]
        try await upsert(
            updatePath: "/api/app/foods/\(food.id.uuidString)",
            createPath: "/api/app/foods",
            body: body
        )
        let archivedAt: Any = food.isArchived ? Date().millisecondsSince1970 : NSNull()
        _ = try await request(
            path: "/api/app/foods/\(food.id.uuidString)",
            method: "PATCH",
            jsonBody: ["archivedAt": archivedAt],
            authenticated: true
        )
    }

    private func pushEntry(_ entry: FoodEntry, food: Food?) async throws {
        let amount = food?.servingGrams.map { $0 * entry.servings } ?? entry.servings
        var body: [String: Any] = [
            "id": entry.id.uuidString,
            "foodId": food?.id.uuidString ?? NSNull(),
            "amount": amount,
            "eatenAt": entry.timestamp.millisecondsSince1970,
        ]
        if food == nil {
            body.merge([
                "foodName": entry.foodName,
                "unitLabel": "serving",
                "calories": entry.nutrients.calories,
                "carbsG": entry.nutrients.carbohydrates,
                "proteinG": entry.nutrients.protein,
                "fibreG": entry.nutrients.fibre,
                "isPackaged": entry.isPackaged ?? false,
                "labels": entry.labels ?? [],
            ]) { _, replacement in replacement }
        }
        try await upsert(
            updatePath: "/api/app/entries/\(entry.id.uuidString)",
            createPath: "/api/app/entries",
            body: body,
            updateMethod: "PATCH"
        )
    }

    private func pushWater(_ water: WaterEntry) async throws {
        let body: [String: Any] = [
            "id": water.id.uuidString,
            "amountMl": water.millilitres,
            "drankAt": water.timestamp.millisecondsSince1970,
        ]
        try await upsert(
            updatePath: "/api/app/water/\(water.id.uuidString)",
            createPath: "/api/app/water",
            body: body,
            updateMethod: "PATCH"
        )
    }

    private func pushWeight(_ weight: WeightEntry) async throws {
        let body: [String: Any] = [
            "id": weight.id.uuidString,
            "weightKg": weight.kilograms,
            "recordedAt": weight.date.millisecondsSince1970,
        ]
        try await upsert(
            updatePath: "/api/app/weights/\(weight.id.uuidString)",
            createPath: "/api/app/weights",
            body: body,
            updateMethod: "PATCH"
        )
    }

    private func pushRoutine(_ routine: MedicationRoutine) async throws {
        let schedule = routine.period.rawValue.lowercased()
        let update: [String: Any] = [
            "name": routine.name,
            "schedule": schedule,
            "archivedAt": routine.isArchived ? Date().millisecondsSince1970 : NSNull(),
        ]
        do {
            _ = try await request(
                path: "/api/app/medications/\(routine.id.uuidString)",
                method: "PATCH",
                jsonBody: update,
                authenticated: true
            )
        } catch NativeAccountError.http(404, _) {
            _ = try await request(
                path: "/api/app/medications",
                jsonBody: [
                    "id": routine.id.uuidString,
                    "name": routine.name,
                    "schedule": schedule,
                    "createdAt": Date().millisecondsSince1970,
                ],
                authenticated: true
            )
            if routine.isArchived {
                _ = try await request(
                    path: "/api/app/medications/\(routine.id.uuidString)",
                    method: "PATCH",
                    jsonBody: update,
                    authenticated: true
                )
            }
        }
    }

    private func pushCheckIn(_ checkIn: RoutineCheckIn) async throws {
        _ = try await request(
            path: "/api/app/medication-check-ins",
            jsonBody: [
                "id": checkIn.id.uuidString,
                "medicationId": checkIn.routineID.uuidString,
                "takenOn": DateKey.string(checkIn.date),
                "takenAt": checkIn.date.millisecondsSince1970,
            ],
            authenticated: true
        )
    }

    private func upsert(
        updatePath: String,
        createPath: String,
        body: [String: Any],
        updateMethod: String = "PUT"
    ) async throws {
        do {
            _ = try await request(
                path: updatePath,
                method: updateMethod,
                jsonBody: body,
                authenticated: true
            )
        } catch NativeAccountError.http(404, _) {
            _ = try await request(path: createPath, jsonBody: body, authenticated: true)
        }
    }

    private func delete(path: String) async throws {
        do {
            _ = try await request(path: path, method: "DELETE", authenticated: true)
        } catch NativeAccountError.http(404, _) {
            return
        }
    }

    private func request(
        path: String,
        method: String = "POST",
        body: [String: String],
        authenticated: Bool,
        target: RequestTarget = .calorie
    ) async throws -> NetworkResponse {
        try await request(
            path: path,
            method: method,
            jsonBody: body,
            authenticated: authenticated,
            target: target
        )
    }

    private func request(
        path: String,
        method: String = "POST",
        jsonBody: Any? = nil,
        authenticated: Bool,
        target: RequestTarget = .calorie
    ) async throws -> NetworkResponse {
        var request = URLRequest(url: endpoint(path, target: target))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let jsonBody {
            request.httpBody = try JSONSerialization.data(withJSONObject: jsonBody)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if authenticated {
            guard let token = try await sessionStore.load() else { throw NativeAccountError.missingSession }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, rawResponse) = try await urlSession.data(for: request)
        guard let response = rawResponse as? HTTPURLResponse else {
            throw NativeAccountError.server("Calorie returned an invalid response.")
        }
        guard (200..<300).contains(response.statusCode) else {
            let error = try? JSONDecoder().decode(ServerError.self, from: data)
            throw NativeAccountError.http(
                response.statusCode,
                error?.message ?? "Calorie could not complete the request."
            )
        }
        return NetworkResponse(data: data, response: response)
    }

    private func endpoint(_ path: String, target: RequestTarget = .calorie) -> URL {
        URL(string: path, relativeTo: target == .identity ? identityBaseURL : baseURL)!.absoluteURL
    }
}

private enum RequestTarget {
    case calorie
    case identity
}

@MainActor
final class WebAuthenticationCoordinator: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?

    func authenticate(at url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "calorie") { callback, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let callback {
                    continuation.resume(returning: callback)
                } else {
                    continuation.resume(throwing: NativeAccountError.invalidCallback)
                }
                self.session = nil
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            session.start()
        }
    }

    func presentationAnchor(for _: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.flatMap(\.windows).first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}

enum AppleNonce {
    static func make() -> String {
        let alphabet = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        return String((0..<32).map { _ in alphabet.randomElement()! })
    }

    static func digest(_ nonce: String) -> String {
        SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

private struct NetworkResponse {
    let data: Data
    let response: HTTPURLResponse
}

private struct TokenResponse: Decodable { let token: String }
private struct ServerError: Decodable { let message: String }
private struct SessionResponse: Decodable { let user: SessionUser }
private struct SessionUser: Decodable { let name: String; let email: String }
private struct ProviderAccount: Decodable { let providerId: String }

private extension Date {
    var millisecondsSince1970: Double { timeIntervalSince1970 * 1_000 }
}
