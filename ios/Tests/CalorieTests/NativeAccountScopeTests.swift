import XCTest
import Foundation
import os
import PersonalSyncKit
import CalorieCore
@testable import Calorie

final class NativeAccountScopeTests: XCTestCase {
    func testJournalRejectsAnotherStableIdentityBeforeReadingProductData() async throws {
        let host = UUID().uuidString.lowercased() + ".invalid"
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [AccountScopeProtocol.self]
        let transport = URLSession(configuration: configuration)
        defer {
            transport.invalidateAndCancel()
            AccountScopeProtocol.headers.withLock { _ = $0.removeValue(forKey: host) }
        }
        let tokens = ScopeTokenStore()
        let client = NativeAccountClient(baseURL: URL(string: "https://" + host)!,
                                         urlSession: transport, tokenStore: tokens)
        do {
            _ = try await client.journal(for: "different-owner")
            XCTFail("A bearer for one identity cannot replay another identity's queue")
        } catch NativeAccountError.accountChanged { }
        XCTAssertEqual(tokens.load(), "synthetic-A")
        let headers = AccountScopeProtocol.headers.withLock { $0[host] ?? [] }
        XCTAssertEqual(headers, ["Bearer synthetic-A"])
        let journal = try await client.journal(for: "synthetic-owner")
        tokens.save("synthetic-B")
        do {
            _ = try await journal.cloudExport()
            XCTFail("A scoped journal must reject a replacement bearer")
        } catch NativeAccountError.accountChanged { }
        let finalHeaders = AccountScopeProtocol.headers.withLock { $0[host] ?? [] }
        XCTAssertEqual(finalHeaders, ["Bearer synthetic-A", "Bearer synthetic-A"])
        XCTAssertEqual(tokens.load(), "synthetic-B")
    }

    func testUnchangedAccountCompletesProfileUpdate() async throws {
        try await checkProfileUpdate(changeAccount: false)
    }

    func testAccountChangeStopsProfileWriteAndPreservesNewCredential() async throws {
        try await checkProfileUpdate(changeAccount: true)
    }

    private func checkProfileUpdate(changeAccount: Bool) async throws {
        let host = UUID().uuidString.lowercased() + ".invalid"
        let tokens = ScopeTokenStore()
        AccountScopeProtocol.switches.withLock {
            $0[host] = changeAccount ? tokens : nil
        }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [AccountScopeProtocol.self]
        let transport = URLSession(configuration: configuration)
        defer {
            transport.invalidateAndCancel()
            AccountScopeProtocol.headers.withLock { _ = $0.removeValue(forKey: host) }
            AccountScopeProtocol.switches.withLock { _ = $0.removeValue(forKey: host) }
        }
        let client = NativeAccountClient(
            baseURL: URL(string: "https://" + host)!, urlSession: transport, tokenStore: tokens)
        let before = Profile(waterTargetMillilitres: 2500)
        var after = before
        after.waterTargetMillilitres = 3000
        let intent = SyncIntent(operation: .updateProfile(before: before, after: after))
        do {
            try await client.apply(intent)
            XCTAssertFalse(changeAccount, "Changing accounts must stop the in-flight operation")
        } catch NativeAccountError.accountChanged {
            XCTAssertTrue(changeAccount)
        }
        let headers = AccountScopeProtocol.headers.withLock { $0[host] ?? [] }
        XCTAssertEqual(headers, changeAccount ? ["Bearer synthetic-A"] :
                       ["Bearer synthetic-A", "Bearer synthetic-A"])
        XCTAssertEqual(tokens.load(), changeAccount ? "synthetic-B" : "synthetic-A")
        if changeAccount {
            // A later operation may use B, but cannot inherit A's fetched profile.
            try await client.apply(intent)
            let allHeaders = AccountScopeProtocol.headers.withLock { $0[host] ?? [] }
            XCTAssertEqual(allHeaders, ["Bearer synthetic-A", "Bearer synthetic-B", "Bearer synthetic-B"])
        }
    }
}

private final class ScopeTokenStore: PersonalBearerTokenStore, Sendable {
    private let token = OSAllocatedUnfairLock<String?>(initialState: "synthetic-A")
    func load() -> String? { token.withLock { $0 } }
    func save(_ value: String) { token.withLock { $0 = value } }
    func delete() { token.withLock { $0 = nil } }
}

private final class AccountScopeProtocol: URLProtocol, @unchecked Sendable {
    static let switches = OSAllocatedUnfairLock<[String: ScopeTokenStore]>(initialState: [:])
    static let headers = OSAllocatedUnfairLock<[String: [String]]>(initialState: [:])
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let url = request.url!
        let bearer = request.value(forHTTPHeaderField: "Authorization") ?? ""
        Self.headers.withLock { $0[url.host!, default: []].append(bearer) }
        if request.httpMethod == "GET" {
            let tokens = Self.switches.withLock { $0.removeValue(forKey: url.host!) }
            tokens?.save("synthetic-B")
        }
        let body = url.path.hasSuffix("/session")
            ? #"{"userId":"synthetic-owner","email":"synthetic@example.invalid","appleSubject":null}"#
            : #"{"ageYears":30,"heightCm":175,"waterTargetMl":2500,"displayName":"Synthetic A profile"}"#
        let data = Data(body.utf8)
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil,
                                       headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() { }
}
