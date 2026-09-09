import XCTest

@MainActor
final class CalorieUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    func testUnreadJournalOffersRecoveryWithoutAnEmptyEditableJournal() {
        let app = XCUIApplication()
        app.launchArguments = ["--recovery-demo"]
        app.launch()
        let okay = app.alerts.buttons["OK"]
        if okay.waitForExistence(timeout: 3) { okay.tap() }
        XCTAssertTrue(app.alerts.firstMatch.waitForNonExistence(timeout: 3), "The read-error alert must dismiss so recovery controls can be used")
        XCTAssertTrue(app.staticTexts["Your journal needs attention"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["Retry opening journal"].exists)
        XCTAssertTrue(app.buttons["Preview an import"].exists)
        XCTAssertFalse(app.buttons["Export journal"].exists)
        XCTAssertFalse(app.tabBars.buttons["Today"].exists)
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Unread journal recovery"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

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
        app.launchArguments = ["--fresh-demo", "-calorie-illustrated-onboarding-seen-v1", "YES"]
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

    func testEntryEditDeleteUndoUpdatesVisibleDailyTotals() {
        let app = XCUIApplication()
        addTeardownBlock { @MainActor in app.terminate() }
        app.launchArguments = ["--fresh-demo", "-calorie-illustrated-onboarding-seen-v1", "YES"]
        app.launch()

        func assertTotal(_ calories: String) {
            let score = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Score so far")).firstMatch
            XCTAssertTrue(score.waitForExistence(timeout: 3))
            XCTAssertTrue(score.label.contains("\(calories) kcal against"), score.label)
        }
        func capture(_ name: String) {
            let attachment = XCTAttachment(screenshot: app.screenshot())
            attachment.name = name
            attachment.lifetime = .keepAlways
            add(attachment)
        }
        func openEntryActions() {
            app.swipeUp()
            let row = app.staticTexts["Greek yoghurt bowl"].firstMatch
            XCTAssertTrue(row.waitForExistence(timeout: 3))
            row.press(forDuration: 1)
        }

        assertTotal("515")
        capture("Today before editing — 515 kcal")
        openEntryActions()
        XCTAssertTrue(app.buttons["Edit"].waitForExistence(timeout: 3))
        app.buttons["Edit"].tap()
        XCTAssertTrue(app.navigationBars["Edit food entry"].waitForExistence(timeout: 3))
        let increment = app.steppers.buttons["Increment"].firstMatch
        for _ in 0..<4 { increment.tap() }
        capture("Edit food — two servings")
        app.buttons["Save"].tap()
        app.swipeDown()
        assertTotal("925")
        capture("Today after editing — 925 kcal")

        openEntryActions()
        app.buttons["Delete"].tap()
        let okay = app.alerts.buttons["OK"]
        if okay.waitForExistence(timeout: 2) { okay.tap() }
        XCTAssertTrue(app.buttons["Undo"].waitForExistence(timeout: 3))
        app.swipeDown()
        assertTotal("105")
        XCTAssertTrue(app.staticTexts["1 entry"].exists)
        capture("Deleted entry — 105 kcal and Undo")
        app.buttons["Undo"].tap()
        XCTAssertTrue(app.alerts.buttons["OK"].waitForExistence(timeout: 3))
        app.alerts.buttons["OK"].tap()
        XCTAssertTrue(app.alerts.firstMatch.waitForNonExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["2 entries"].exists)
        assertTotal("925")
        capture("Undo restored entry — 925 kcal")
    }

    func testFoodAndWaterPersistAcrossRelaunchInAnIsolatedJournal() {
        let app = XCUIApplication()
        let firstID = UUID().uuidString
        let secondID = UUID().uuidString
        addTeardownBlock { @MainActor in
            app.terminate()
            for id in [firstID, secondID] {
                app.launchArguments = ["--persistent-ui-fixture", id, "--cleanup-persistent-ui-fixture"]
                app.launch()
                XCTAssertTrue(app.staticTexts["Test journal cleaned"].waitForExistence(timeout: 3))
                app.terminate()
            }
        }
        func capture(_ name: String) {
            let attachment = XCTAttachment(screenshot: app.screenshot())
            attachment.name = name
            attachment.lifetime = .keepAlways
            add(attachment)
        }
        func revealWater() {
            let water = app.buttons["+ 250 ml"]
            for _ in 0..<5 where !water.isHittable { app.swipeUp() }
            XCTAssertTrue(water.isHittable)
        }
        func assertFoodAndCalories() {
            XCTAssertTrue(app.staticTexts["Persisted lentil bowl"].waitForExistence(timeout: 3))
            XCTAssertTrue(app.staticTexts["210 kilocalories recorded"].exists)
            XCTAssertTrue(app.staticTexts["Energy recorded"].exists)
            XCTAssertTrue(app.staticTexts["kcal recorded"].exists)
            XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "PROTEIN, 7 grams")).firstMatch.exists)
            XCTAssertFalse(app.staticTexts["Energy left today"].exists)
            XCTAssertFalse(app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "kilocalories remaining")).firstMatch.exists)
            XCTAssertFalse(app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "of 120 grams")).firstMatch.exists)
        }

        app.launchArguments = ["--persistent-ui-fixture", firstID]
        app.launch()
        XCTAssertTrue(app.buttons["Set up my first log"].waitForExistence(timeout: 3))
        app.buttons["Set up my first log"].tap()
        app.buttons["No targets for now"].tap()
        fillFirstFood(in: app, name: "Persisted lentil bowl")
        app.switches["Save this as a reusable food"].tap()
        app.buttons["Log my first food"].tap()
        XCTAssertTrue(app.staticTexts["Your day changed."].waitForExistence(timeout: 3))
        app.buttons["Open Today"].tap()
        assertFoodAndCalories()
        capture("Persistent journal — first food saved")
        revealWater()
        app.buttons["+ 250 ml"].tap()
        XCTAssertTrue(app.staticTexts["250 ml"].waitForExistence(timeout: 3))
        capture("Persistent journal — water saved")
        app.terminate()

        app.launch()
        assertFoodAndCalories()
        capture("Persistent journal — food after relaunch")
        revealWater()
        XCTAssertTrue(app.staticTexts["250 ml"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["Log food"].isHittable)
        XCTAssertTrue(app.tabBars.buttons["Foods"].isHittable)
        capture("Persistent journal — water after relaunch")
        app.buttons["Log food"].tap()
        XCTAssertTrue(app.navigationBars["Log food"].waitForExistence(timeout: 3))
        app.buttons["Close"].tap()
        app.tabBars.buttons["Foods"].tap()
        XCTAssertTrue(app.staticTexts["Familiar foods first. Values stay editable."].waitForExistence(timeout: 3))
        app.terminate()

        app.launchArguments = ["--persistent-ui-fixture", secondID]
        app.launch()
        XCTAssertTrue(app.buttons["Set up my first log"].waitForExistence(timeout: 3))
        capture("Independent UUID — fresh onboarding")
        app.terminate()
        app.launchArguments += ["-calorie-illustrated-onboarding-seen-v1", "YES"]
        app.launch()
        XCTAssertTrue(app.staticTexts["0 entries"].waitForExistence(timeout: 3))
        XCTAssertFalse(app.staticTexts["Persisted lentil bowl"].exists)
        XCTAssertTrue(app.staticTexts["kcal remaining · 0 recorded"].exists)
        revealWater()
        XCTAssertTrue(app.staticTexts["0 ml"].exists)
        capture("Independent UUID — empty food and water journal")
    }

    func testPrimaryTabsAreReachable() {
        let app = XCUIApplication()
        app.launchArguments = ["--fresh-demo", "-calorie-illustrated-onboarding-seen-v1", "YES"]
        app.launch()

        for tab in ["Progress", "Foods", "You"] {
            app.tabBars.buttons[tab].tap()
            XCTAssertTrue(app.staticTexts[tab].waitForExistence(timeout: 2))
        }
    }

    func testFoodsExposeEditAndArchiveActions() {
        let app = XCUIApplication()
        app.launchArguments = ["--fresh-demo", "-calorie-illustrated-onboarding-seen-v1", "YES"]
        app.launch()

        app.tabBars.buttons["Foods"].tap()
        XCTAssertTrue(app.staticTexts["Familiar foods first. Values stay editable."].waitForExistence(timeout: 3))
        app.buttons["Actions for Greek yoghurt bowl"].tap()
        XCTAssertTrue(app.buttons["Edit"].waitForExistence(timeout: 2))
        XCTAssertTrue(app.buttons["Archive"].exists)
    }

    func testProgressSupportsThirtyDayAndDateReview() {
        let app = XCUIApplication()
        app.launchArguments = ["--fresh-demo", "-calorie-illustrated-onboarding-seen-v1", "YES"]
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
        addTeardownBlock { @MainActor in app.terminate() }
        func captureScoreState(_ name: String) {
            let screenshot = XCTAttachment(screenshot: app.screenshot())
            screenshot.name = name
            screenshot.lifetime = .keepAlways
            add(screenshot)
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "\(name) hierarchy"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
        }
        app.launchArguments = ["--fresh-demo", "-calorie-illustrated-onboarding-seen-v1", "YES"]
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
        let foodButton = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH %@", "Greek yoghurt bowl,")
        ).firstMatch
        XCTAssertTrue(foodButton.waitForExistence(timeout: 3))
        captureScoreState("Score food picker")
        foodButton.tap()
        XCTAssertTrue(app.navigationBars["Add entry"].waitForExistence(timeout: 3))
        let selection = app.scrollViews.containing(.button, identifier: "Increase amount").firstMatch
        XCTAssertTrue(selection.waitForExistence(timeout: 3))
        selection.swipeUp()
        let amountScore = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH %@", "This amount")
        ).firstMatch
        XCTAssertTrue(amountScore.waitForExistence(timeout: 3))
        XCTAssertTrue(amountScore.isHittable)
        captureScoreState("Visible selected amount score")
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
