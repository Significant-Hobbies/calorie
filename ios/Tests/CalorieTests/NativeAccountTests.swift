import XCTest
@testable import Calorie

final class NativeAccountTests: XCTestCase {
    func testNonceIsRandomAndUsesASHA256Digest() {
        let first = AppleNonce.make()
        let second = AppleNonce.make()

        XCTAssertEqual(first.count, 32)
        XCTAssertNotEqual(first, second)
        XCTAssertEqual(AppleNonce.digest(first).count, 64)
        XCTAssertNotEqual(AppleNonce.digest(first), first)
    }

    func testSessionRoundTripsOnlyThroughAnIsolatedKeychainItem() async throws {
        let service = "com.significanthobbies.calorie.tests.\(UUID().uuidString)"
        let store = KeychainSessionStore(service: service, account: "test-bearer")

        let initial = try await store.load()
        XCTAssertNil(initial)
        try await store.save("private-session-token")
        let saved = try await store.load()
        XCTAssertEqual(saved, "private-session-token")
        try await store.delete()
        let deleted = try await store.load()
        XCTAssertNil(deleted)
    }
}
