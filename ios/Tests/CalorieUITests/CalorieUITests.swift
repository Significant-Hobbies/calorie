import XCTest

@MainActor
final class CalorieUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    func testFirstDayLogsARealOneOffFoodAndShowsTotals() {
        let app = XCUIApplication()
        app.launchArguments = ["--onboarding-demo", "--reset-onboarding"]
        app.launch()

        XCTAssertTrue(app.staticTexts["Log food, see what changed."].waitForExistence(timeout: 3))
        app.buttons["Set up my first log"].tap()
        app.buttons["No targets for now"].tap()

        fillFirstFood(in: app, name: "Apple and peanut butter")
        app.switches["Save this as a reusable food"].tap()
        app.buttons["Log my first food"].tap()

        XCTAssertTrue(app.staticTexts["Your day changed."].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["210"].exists)
        app.buttons["Open Today"].tap()
        XCTAssertTrue(app.staticTexts["Apple and peanut butter"].waitForExistence(timeout: 3))
    }

    func testReusableFoodPathAddsTheFoodToTheLibrary() {
        let app = XCUIApplication()
        app.launchArguments = ["--onboarding-demo", "--reset-onboarding", "--reduce-motion-demo"]
        app.launch()

        app.buttons["Set up my first log"].tap()
        app.buttons["Explore an estimate later"].tap()
        fillFirstFood(in: app, name: "Home lentil bowl")
        app.buttons["Log my first food"].tap()
        XCTAssertTrue(app.staticTexts["Your day changed."].waitForExistence(timeout: 3))
        app.buttons["Open Today"].tap()
        app.tabBars.buttons["Foods"].tap()
        XCTAssertTrue(app.staticTexts["Home lentil bowl"].waitForExistence(timeout: 3))
    }

    func testOnboardingRestoresFoodDraftAcrossRelaunch() {
        let app = XCUIApplication()
        app.launchArguments = ["--onboarding-demo", "--reset-onboarding"]
        app.launch()
        app.buttons["Set up my first log"].tap()
        app.buttons["No targets for now"].tap()
        let name = app.textFields["Food name"]
        name.tap()
        name.typeText("Keep my draft")
        app.terminate()

        app.launchArguments = ["--onboarding-demo"]
        app.launch()
        XCTAssertEqual(app.textFields["Food name"].value as? String, "Keep my draft")
    }

    func testQuickLogsFavoriteFood() {
        let app = XCUIApplication()
        app.launchArguments = ["--fresh-demo"]
        app.launch()

        XCTAssertTrue(app.staticTexts["Energy left today"].waitForExistence(timeout: 3))
        app.buttons["Log food"].tap()
        XCTAssertTrue(app.staticTexts["Greek yoghurt bowl"].waitForExistence(timeout: 3))
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", "Greek yoghurt bowl"))
            .firstMatch.tap()
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
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", "Greek yoghurt bowl"))
            .firstMatch.tap()
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

    private func fillFirstFood(in app: XCUIApplication, name: String) {
        let nameField = app.textFields["Food name"]
        XCTAssertTrue(nameField.waitForExistence(timeout: 3))
        nameField.tap()
        nameField.typeText(name)
        type("210", into: app.textFields["Calories"])
        type("7", into: app.textFields["Protein"])
        type("28", into: app.textFields["Carbohydrates"])
        type("5", into: app.textFields["Fibre"])
    }

    private func type(_ value: String, into field: XCUIElement) {
        XCTAssertTrue(field.waitForExistence(timeout: 3))
        field.tap()
        field.typeText(value)
    }
}
