import Foundation
import PersonalSyncKit

/// The shared Significant Hobbies identity as the journal views see it.
/// Calorie's own worker session is retired; the account here is the same
/// better-auth session every family app uses.
struct CalorieAccount: Equatable, Sendable {
    let userID: String
    let email: String
    let providers: Set<String>

    var hasApple: Bool { providers.contains("apple") }

    init(userID: String, email: String, providers: Set<String>) {
        self.userID = userID
        self.email = email
        self.providers = providers
    }

    init(_ session: PersonalIdentitySession) {
        userID = session.userId
        email = session.email
        providers = session.appleSubject == nil ? ["google"] : ["apple"]
    }
}
