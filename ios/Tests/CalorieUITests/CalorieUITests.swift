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

    func testExploreFirstKeepsTargetsUnsetAndCanStillLogFood() {
        let app = XCUIApplication()
        app.launchArguments = ["--onboarding-demo", "--reset-onboarding", "--reduce-motion-demo"]
        app.launch()

        XCTAssertTrue(app.staticTexts["Log food, see what changed."].waitForExistence(timeout: 3))
        app.buttons["Explore Calorie first"].tap()
        XCTAssertTrue(app.staticTexts["0 entries"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Energy recorded"].exists)
        XCTAssertFalse(app.staticTexts["Energy left today"].exists)
        XCTAssertFalse(app.staticTexts["kcal remaining · 0 recorded"].exists)
        for target in ["120 grams", "250 grams", "70 grams", "28 grams"] {
            XCTAssertFalse(app.descendants(matching: .any).matching(
                NSPredicate(format: "label CONTAINS %@", "of \(target)")
            ).firstMatch.exists)
        }

        app.buttons["Log food"].tap()
        XCTAssertTrue(app.staticTexts["Greek yoghurt bowl"].waitForExistence(timeout: 3))
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", "Greek yoghurt bowl"))
            .firstMatch.tap()
        app.buttons["Snack"].tap()
        app.buttons["Add to snack"].tap()
        XCTAssertTrue(app.staticTexts["Greek yoghurt bowl"].waitForExistence(timeout: 3))
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
        XCTAssertTrue(name.waitForExistence(timeout: 3))
        name.tap()
        name.typeText("Keep my draft")
        // @AppStorage drafts flush to UserDefaults asynchronously; give the
        // write a moment to commit or terminate() drops the last characters.
        Thread.sleep(forTimeInterval: 1)
        app.terminate()

        app.launchArguments = ["--onboarding-demo"]
        app.launch()
        let restored = app.textFields["Food name"]
        XCTAssertTrue(restored.waitForExistence(timeout: 3))
        expectation(
            for: NSPredicate(format: "value == %@", "Keep my draft"),
            evaluatedWith: restored
        )
        waitForExpectations(timeout: 3)
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
        XCTAssertTrue(app.staticTexts["Energy recorded"].exists)
        XCTAssertTrue(app.staticTexts["kcal recorded"].exists)
        XCTAssertFalse(app.staticTexts["Energy left today"].exists)
        XCTAssertFalse(app.descendants(matching: .any).matching(
            NSPredicate(format: "label CONTAINS %@", "kilocalories remaining")
        ).firstMatch.exists)
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

    func testFoodEditorKeepsLabelsAndSavedValuesAtDefaultAndEnlargedText() {
        let app = XCUIApplication()
        let id = UUID().uuidString
        let arguments = ["--persistent-ui-fixture", id]
        addTeardownBlock { @MainActor in
            app.terminate()
            app.launchArguments = arguments + ["--cleanup-persistent-ui-fixture"]
            app.launch()
            XCTAssertTrue(app.staticTexts["Test journal cleaned"].waitForExistence(timeout: 3))
            app.terminate()
        }
        func capture(_ name: String) {
            let screenshot = XCTAttachment(screenshot: app.screenshot())
            screenshot.name = name
            screenshot.lifetime = .keepAlways
            add(screenshot)
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "\(name) hierarchy"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
        }
        func reveal(_ field: XCUIElement) {
            for _ in 0..<6 where !field.isHittable { app.swipeUp() }
            XCTAssertTrue(field.isHittable)
        }
        func openFoodEditor() {
            XCTAssertTrue(app.tabBars.buttons["Foods"].waitForExistence(timeout: 3))
            app.tabBars.buttons["Foods"].tap()
            let search = app.textFields["Search foods"]
            XCTAssertTrue(search.waitForExistence(timeout: 3))
            search.tap()
            search.typeText("Fictional label audit bowl\n")
            let actions = app.descendants(matching: .any).matching(
                NSPredicate(format: "label == %@", "Actions for Fictional label audit bowl")
            ).firstMatch
            for _ in 0..<6 where !actions.isHittable { app.swipeUp() }
            XCTAssertTrue(actions.isHittable)
            actions.tap()
            app.buttons["Edit"].tap()
            XCTAssertTrue(app.navigationBars["Edit food"].waitForExistence(timeout: 3))
        }

        app.launchArguments = arguments
        app.launch()
        XCTAssertTrue(app.buttons["Set up my first log"].waitForExistence(timeout: 3))
        app.buttons["Set up my first log"].tap()
        app.buttons["No targets for now"].tap()
        fillFirstFood(in: app, name: "Fictional label audit bowl")
        app.buttons["Log my first food"].tap()
        XCTAssertTrue(app.buttons["Open Today"].waitForExistence(timeout: 3))
        app.buttons["Open Today"].tap()
        app.terminate()

        for (category, expectedCalories, savedCalories) in [
            ("UICTContentSizeCategoryL", "210", "220"),
            ("UICTContentSizeCategoryAccessibilityXXXL", "220", "230")
        ] {
            app.launchArguments = arguments + ["-UIPreferredContentSizeCategoryName", category]
            app.launch()
            openFoodEditor()
            capture("Filled food editor — \(category) — top")
            for (label, value) in [
                ("Name", "Fictional label audit bowl"), ("Serving", "1 serving"),
                ("Calories (kcal)", expectedCalories), ("Protein (g)", "7"),
                ("Carbohydrates (g)", "28"), ("Fat (g)", "0"), ("Fibre (g)", "5")
            ] {
                let field = app.textFields[label]
                reveal(field)
                XCTAssertTrue(field.waitForExistence(timeout: 3))
                XCTAssertTrue(app.staticTexts[label].exists)
                XCTAssertEqual(field.value as? String, value)
                capture("Filled food editor — \(category) — \(label)")
            }
            let calories = app.textFields["Calories (kcal)"]
            // A partly clipped large field can report hittable while its
            // value sits under the navigation bar. Bring the whole field
            // into the middle of the Form before targeting its value.
            let form = app.collectionViews.firstMatch
            let screen = app.frame
            for _ in 0..<16 {
                if !calories.exists {
                    form.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.45)).press(
                        forDuration: 0.01,
                        thenDragTo: form.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.65))
                    )
                    continue
                }
                let frame = calories.frame
                if calories.exists && frame.minY >= screen.height * 0.25 && frame.maxY <= screen.height * 0.75 { break }
                let endY = frame.minY < screen.height * 0.25 ? 0.65 : 0.25
                form.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.45)).press(
                    forDuration: 0.01,
                    thenDragTo: form.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: endY))
                )
            }
            XCTAssertTrue(calories.isHittable)
            XCTAssertGreaterThanOrEqual(calories.frame.minY, screen.height * 0.25)
            XCTAssertLessThanOrEqual(calories.frame.maxY, screen.height * 0.75)
            // At accessibility sizes the merged element includes its label
            // and the left-aligned value below it. Tap the value text; the
            // blank trailing area need not focus the field on every SDK.
            let valueOffset = category == "UICTContentSizeCategoryAccessibilityXXXL"
                ? CGVector(dx: 0.15, dy: 0.85)
                : CGVector(dx: 0.75, dy: 0.5)
            calories.coordinate(withNormalizedOffset: valueOffset).tap()
            guard app.keyboards.firstMatch.waitForExistence(timeout: 3) else {
                capture("Calories value did not receive keyboard focus — \(category)")
                XCTFail("The visible calories value must be editable at \(category)")
                return
            }
            calories.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: expectedCalories.count))
            XCTAssertTrue(app.staticTexts["Calories (kcal)"].exists)
            capture("Empty calories retain their label — \(category)")
            calories.typeText(savedCalories)
            capture("Edited calories retain their label — \(category)")
            XCTAssertTrue(app.buttons["Save"].isHittable)
            app.buttons["Save"].tap()
            XCTAssertTrue(app.staticTexts["Fictional label audit bowl"].waitForExistence(timeout: 3))
            app.terminate()
        }

        app.launchArguments = arguments
        app.launch()
        openFoodEditor()
        XCTAssertTrue(app.textFields["Calories (kcal)"].waitForExistence(timeout: 3))
        XCTAssertEqual(app.textFields["Calories (kcal)"].value as? String, "230")
        capture("Food edit persisted after enlarged-text save and relaunch")
    }

    func testRecordedDayAndServingLabelsUseSingularAndPluralCounts() {
        let app = XCUIApplication()
        let id = UUID().uuidString
        app.launchArguments = ["--persistent-ui-fixture", id]
        addTeardownBlock { @MainActor in
            app.terminate()
            app.launchArguments = ["--persistent-ui-fixture", id, "--cleanup-persistent-ui-fixture"]
            app.launch()
            XCTAssertTrue(app.staticTexts["Test journal cleaned"].waitForExistence(timeout: 3))
            app.terminate()
        }
        func capture(_ name: String) {
            let screenshot = XCTAttachment(screenshot: app.screenshot())
            screenshot.name = name
            screenshot.lifetime = .keepAlways
            add(screenshot)
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "\(name) hierarchy"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
        }
        app.launch()
        app.buttons["Set up my first log"].tap()
        app.buttons["No targets for now"].tap()
        fillFirstFood(in: app, name: "Fictional count audit bowl")
        app.buttons["Log my first food"].tap()
        app.buttons["Open Today"].tap()
        app.tabBars.buttons["Progress"].tap()
        XCTAssertTrue(app.staticTexts["1 day includes entries, averaging 210 recorded calories. Missing days are not treated as zero intake."].waitForExistence(timeout: 3))
        capture("One recorded day uses singular wording")
        app.tabBars.buttons["Today"].tap()
        capture("Today date navigation before adding a second day")
        let previousDay = app.buttons.matching(NSPredicate(format: "identifier == %@ OR label == %@", "chevron.left", "Back")).firstMatch
        XCTAssertTrue(previousDay.exists)
        previousDay.tap()
        app.buttons["Log food"].tap()
        let food = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Fictional count audit bowl")).firstMatch
        XCTAssertTrue(food.waitForExistence(timeout: 3))
        food.tap()
        XCTAssertTrue(app.staticTexts["1 serving"].waitForExistence(timeout: 3))
        capture("One serving uses singular accessible wording")
        for _ in 0..<2 { app.buttons["Increase amount"].tap() }
        XCTAssertTrue(app.staticTexts["1.5 servings"].exists)
        capture("Fractional servings use plural accessible wording")
        for _ in 0..<2 { app.buttons["Increase amount"].tap() }
        XCTAssertTrue(app.staticTexts["2 servings"].exists)
        capture("Multiple servings use plural accessible wording")
        app.buttons["Snack"].tap()
        app.buttons["Add to snack"].tap()
        app.tabBars.buttons["Progress"].tap()
        XCTAssertTrue(app.staticTexts["2 days include entries, averaging 315 recorded calories. Missing days are not treated as zero intake."].waitForExistence(timeout: 3))
        capture("Multiple recorded days retain plural wording and missing-days explanation")
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
