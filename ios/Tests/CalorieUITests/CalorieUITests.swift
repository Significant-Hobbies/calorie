import XCTest

@MainActor
final class CalorieUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    func testQuickLogsFavoriteFood() {
        let app = XCUIApplication()
        app.launchArguments = ["--fresh-demo"]
        app.launch()

        XCTAssertTrue(app.staticTexts["Energy left today"].waitForExistence(timeout: 3))
        app.buttons["Log food"].tap()
        XCTAssertTrue(app.staticTexts["Greek yoghurt bowl"].waitForExistence(timeout: 3))
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Greek yoghurt bowl")).firstMatch.tap()
        app.buttons["Snack"].tap()
        app.buttons["Add to snack"].tap()
        XCTAssertTrue(app.staticTexts["Greek yoghurt bowl"].waitForExistence(timeout: 3))
    }

    func testPrimaryTabsAreReachable() {
        let app = XCUIApplication()
        app.launchArguments = ["--fresh-demo"]
        app.launch()

        for tab in ["Progress", "Foods", "You"] {
            app.tabBars.buttons[tab].tap()
            XCTAssertTrue(app.staticTexts[tab].waitForExistence(timeout: 2))
        }
    }

    func testFoodsExposeEditAndArchiveActions() {
        let app = XCUIApplication()
        app.launchArguments = ["--fresh-demo"]
        app.launch()

        app.tabBars.buttons["Foods"].tap()
        XCTAssertTrue(app.staticTexts["Familiar foods first. Values stay editable."].waitForExistence(timeout: 3))
        app.buttons["Actions for Greek yoghurt bowl"].tap()
        XCTAssertTrue(app.buttons["Edit"].waitForExistence(timeout: 2))
        XCTAssertTrue(app.buttons["Archive"].exists)
    }

    func testProgressSupportsThirtyDayAndDateReview() {
        let app = XCUIApplication()
        app.launchArguments = ["--fresh-demo"]
        app.launch()

        app.tabBars.buttons["Progress"].tap()
        XCTAssertTrue(app.buttons["30 days"].waitForExistence(timeout: 3))
        app.buttons["30 days"].tap()
        XCTAssertTrue(app.staticTexts["30-day energy"].waitForExistence(timeout: 2))
        XCTAssertTrue(app.staticTexts["Review a day"].exists)
        XCTAssertTrue(app.datePickers["Journal date"].exists)
    }

    func testDailyAndEntryScoresExposeTheirCalculationBasis() {
        let app = XCUIApplication()
        app.launchArguments = ["--fresh-demo"]
        app.launch()

        XCTAssertTrue(
            app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Score so far")).firstMatch
                .waitForExistence(timeout: 3)
        )
        XCTAssertTrue(
            app.descendants(matching: .any)
                .matching(NSPredicate(format: "label CONTAINS %@", "Latest active food"))
                .firstMatch.exists
        )

        app.buttons["Log food"].tap()
        XCTAssertTrue(app.staticTexts["Greek yoghurt bowl"].waitForExistence(timeout: 3))
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Greek yoghurt bowl")).firstMatch.tap()
        XCTAssertTrue(
            app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "This amount")).firstMatch
                .waitForExistence(timeout: 2)
        )
        XCTAssertTrue(
            app.descendants(matching: .any)
                .matching(NSPredicate(format: "label CONTAINS %@", "/100 tracked"))
                .firstMatch.exists
        )
    }
}
