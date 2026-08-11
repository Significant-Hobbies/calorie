import AuthenticationServices
import CalorieCore
import Charts
import SwiftUI
import UniformTypeIdentifiers

struct ProgressViewScreen: View {
    @Environment(AppModel.self) private var model

    private var days: [DaySummary] {
        (0..<7).reversed().compactMap { offset in
            guard let date = Calendar.current.date(byAdding: .day, value: -offset, to: .now) else { return nil }
            return DaySummary(date: date, nutrients: model.document.totals(on: date))
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                botanicalHeader("Progress", subtitle: "Patterns without punishment.")
                VStack(alignment: .leading, spacing: 14) {
                    Text("Seven-day energy").font(.title2.weight(.bold))
                    Chart(days) { day in
                        BarMark(
                            x: .value("Day", day.date, unit: .day),
                            y: .value("Recorded calories", day.nutrients.calories)
                        )
                        .foregroundStyle(CaloriePalette.moss.gradient)
                        .cornerRadius(5)
                    }
                    .chartYAxis { AxisMarks(position: .leading) }
                    .frame(height: 210)
                    Text(accessibleWeekSummary)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(17)
                .background(CaloriePalette.surface)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                VStack(alignment: .leading, spacing: 14) {
                    Text("Meal timing").font(.title2.weight(.bold))
                    ForEach(model.document.foodEntries.sorted { $0.timestamp < $1.timestamp }.suffix(8)) { entry in
                        HStack {
                            Text(entry.timestamp.formatted(.dateTime.weekday(.abbreviated)))
                                .font(.caption.weight(.bold)).frame(width: 36)
                            GeometryReader { geometry in
                                let hour = Calendar.current.component(.hour, from: entry.timestamp)
                                Circle().fill(CaloriePalette.amber)
                                    .frame(width: 12, height: 12)
                                    .offset(x: geometry.size.width * CGFloat(hour) / 24)
                            }
                            .frame(height: 14)
                            Text(entry.timestamp.formatted(.dateTime.hour().minute()))
                                .font(.caption.monospacedDigit()).frame(width: 64)
                        }
                    }
                    HStack {
                        Text("00"); Spacer(); Text("06"); Spacer(); Text("12"); Spacer(); Text("18"); Spacer(); Text("24")
                    }
                    .font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
                }
                VStack(alignment: .leading, spacing: 14) {
                    Text("Weight check-ins").font(.title2.weight(.bold))
                    if let latest = model.document.weightEntries.sorted(by: { $0.date > $1.date }).first {
                        HStack(alignment: .lastTextBaseline) {
                            Text(latest.kilograms.formatted(.number.precision(.fractionLength(1))))
                                .font(.system(size: 42, weight: .bold, design: .rounded).monospacedDigit())
                            Text("kg recorded").font(.subheadline).foregroundStyle(.secondary)
                        }
                        Text("A check-in is a measurement, not a grade.").font(.subheadline).foregroundStyle(.secondary)
                    } else {
                        Text("No weight check-ins yet.").foregroundStyle(.secondary)
                    }
                }
            }
            .padding(18)
        }
        .defaultScrollAnchor(.top)
        .botanicalBackground()
        .navigationBarHidden(true)
    }

    private var accessibleWeekSummary: String {
        let recorded = days.filter { $0.nutrients.calories > 0 }
        guard !recorded.isEmpty else { return "No energy entries were recorded in the last seven days." }
        let average = recorded.map(\.nutrients.calories).reduce(0, +) / Double(recorded.count)
        return "\(recorded.count) days include entries, averaging \(average.formatted(.number.precision(.fractionLength(0)))) recorded calories. Missing days are not treated as zero intake."
    }
}

private struct DaySummary: Identifiable {
    let date: Date
    let nutrients: Nutrients
    var id: Date { date }
}

struct FoodsView: View {
    @Environment(AppModel.self) private var model
    @State private var search = ""
    @State private var isAddPresented = false
    @State private var editingFood: Food?
    @State private var showArchived = false

    private var foods: [Food] {
        model.document.foods
            .filter { $0.isArchived == showArchived && (search.isEmpty || $0.name.localizedCaseInsensitiveContains(search)) }
            .sorted { lhs, rhs in
                if lhs.isFavorite != rhs.isFavorite { return lhs.isFavorite }
                return lhs.name < rhs.name
            }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                botanicalHeader("Foods", subtitle: "Familiar foods first. Values stay editable.")
                HStack {
                    Image(systemName: "magnifyingglass")
                    TextField("Search foods", text: $search)
                        .textInputAutocapitalization(.never)
                }
                .padding(.horizontal, 14)
                .frame(minHeight: 48)
                .background(CaloriePalette.surface)
                .clipShape(RoundedRectangle(cornerRadius: 13))
                HStack {
                    Text("\(foods.count) available").font(.caption.weight(.bold)).foregroundStyle(.secondary)
                    Spacer()
                    Button { isAddPresented = true } label: { Label("Custom food", systemImage: "plus") }
                        .font(.subheadline.weight(.bold)).frame(minHeight: 44)
                }
                Picker("Food archive", selection: $showArchived) {
                    Text("Current").tag(false)
                    Text("Archived").tag(true)
                }
                .pickerStyle(.segmented)
                ForEach(foods) { food in
                    HStack(spacing: 12) {
                        Button { Task { await model.toggleFavorite(food) } } label: {
                            Image(systemName: food.isFavorite ? "heart.fill" : "heart")
                                .foregroundStyle(food.isFavorite ? CaloriePalette.cherry : .secondary)
                                .frame(width: 44, height: 44)
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text(food.name).font(.headline)
                            Text("\(food.servingName) · P \(food.nutrients.protein.formatted(.number.precision(.fractionLength(0)))) · C \(food.nutrients.carbohydrates.formatted(.number.precision(.fractionLength(0)))) · F \(food.nutrients.fat.formatted(.number.precision(.fractionLength(0))))")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(food.nutrients.calories.formatted(.number.precision(.fractionLength(0))))
                            .font(.headline.monospacedDigit().weight(.bold))
                        Menu {
                            Button("Edit") { editingFood = food }
                            Button(showArchived ? "Restore" : "Archive") {
                                Task { await model.toggleArchive(food) }
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                                .frame(width: 44, height: 44)
                        }
                        .accessibilityLabel("Actions for \(food.name)")
                    }
                    .padding(.vertical, 8)
                    Divider()
                }
            }
            .padding(18)
        }
        .defaultScrollAnchor(.top)
        .botanicalBackground()
        .navigationBarHidden(true)
        .sheet(isPresented: $isAddPresented) { CustomFoodView() }
        .sheet(item: $editingFood) { food in
            CustomFoodView(food: food)
        }
    }
}

private struct CustomFoodView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var serving = "1 serving"
    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var fibre = ""
    private let existingFood: Food?

    init(food: Food? = nil) {
        existingFood = food
        _name = State(initialValue: food?.name ?? "")
        _serving = State(initialValue: food?.servingName ?? "1 serving")
        _calories = State(initialValue: food?.nutrients.calories.formatted() ?? "")
        _protein = State(initialValue: food?.nutrients.protein.formatted() ?? "")
        _carbs = State(initialValue: food?.nutrients.carbohydrates.formatted() ?? "")
        _fat = State(initialValue: food?.nutrients.fat.formatted() ?? "")
        _fibre = State(initialValue: food?.nutrients.fibre.formatted() ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Food") {
                    TextField("Name", text: $name)
                    TextField("Serving", text: $serving)
                }
                Section("Per serving") {
                    numeric("Calories", $calories)
                    numeric("Protein (g)", $protein)
                    numeric("Carbohydrates (g)", $carbs)
                    numeric("Fat (g)", $fat)
                    numeric("Fibre (g)", $fibre)
                }
            }
            .navigationTitle(existingFood == nil ? "Custom food" : "Edit food")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let food = Food(
                            id: existingFood?.id ?? UUID(),
                            name: name,
                            servingName: serving,
                            servingGrams: existingFood?.servingGrams,
                            nutrients: Nutrients(
                                calories: Double(calories) ?? 0,
                                protein: Double(protein) ?? 0,
                                carbohydrates: Double(carbs) ?? 0,
                                fat: Double(fat) ?? 0,
                                fibre: Double(fibre) ?? 0
                            ),
                            isFavorite: existingFood?.isFavorite ?? false,
                            isArchived: existingFood?.isArchived ?? false,
                            isCustom: existingFood?.isCustom ?? true
                        )
                        Task { await model.saveFood(food); dismiss() }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || Double(calories) == nil)
                }
            }
        }
    }

    private func numeric(_ label: String, _ value: Binding<String>) -> some View {
        TextField(label, text: value).keyboardType(.decimalPad)
    }
}

struct YouView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.colorScheme) private var colorScheme
    @State private var isProfilePresented = false
    @State private var isImporterPresented = false
    @State private var showReset = false
    @State private var showDeleteAccount = false
    @State private var isRoutineManagerPresented = false
    @State private var appleNonce = AppleNonce.make()

    var body: some View {
        @Bindable var model = model
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                botanicalHeader("You", subtitle: "Your inputs, your formulas, your journal.")
                if let explanation = model.targetExplanation {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Image(systemName: explanation.isEstimate ? "function" : "hand.draw.fill")
                                .foregroundStyle(CaloriePalette.moss)
                            Text(explanation.title).font(.headline)
                            Spacer()
                            Text("\(explanation.target.calories.formatted(.number.precision(.fractionLength(0)))) kcal")
                                .font(.headline.monospacedDigit())
                        }
                        Text(explanation.detail).font(.subheadline).foregroundStyle(.secondary)
                        Button("Edit profile & targets") { isProfilePresented = true }
                            .font(.subheadline.weight(.bold)).frame(minHeight: 44)
                    }
                    .padding(16).background(CaloriePalette.surface).clipShape(RoundedRectangle(cornerRadius: 15))
                } else {
                    Button("Set up targets") { isProfilePresented = true }.buttonStyle(BotanicalButtonStyle())
                }
                youSection("Appearance") {
                    Picker("Theme", selection: Binding(
                        get: { model.document.theme },
                        set: { theme in Task { await model.setTheme(theme) } }
                    )) {
                        ForEach(AppTheme.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                youSection("Daily care") {
                    Button {
                        isRoutineManagerPresented = true
                    } label: {
                        Label("Manage routines", systemImage: "checklist")
                            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                    }
                    Text("Routine names and preferred time only. Calorie does not store dosage instructions.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                youSection("Account & sync") {
                    accountControls
                }
                youSection("Your data") {
                    ShareLink(item: CalorieExportPayload(document: model.document), preview: SharePreview("Calorie journal")) {
                        Label("Export journal", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(minHeight: 48)
                    Button { isImporterPresented = true } label: {
                        Label("Preview an import", systemImage: "doc.badge.plus").frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(minHeight: 48)
                    Button(role: .destructive) { showReset = true } label: {
                        Label("Reset local journal", systemImage: "trash").frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(minHeight: 48)
                }
                youSection("About") {
                    LabeledContent("Version", value: "1.0.0 (1)")
                    Link("Privacy", destination: URL(string: "https://calorie.significanthobbies.com/privacy")!).frame(minHeight: 44)
                    Link("Support", destination: URL(string: "https://calorie.significanthobbies.com")!).frame(minHeight: 44)
                }
            }
            .padding(18)
        }
        .defaultScrollAnchor(.top)
        .botanicalBackground()
        .navigationBarHidden(true)
        .sheet(isPresented: $isProfilePresented) { ProfileEditorView() }
        .sheet(isPresented: $isRoutineManagerPresented) { RoutineManagerView() }
        .fileImporter(isPresented: $isImporterPresented, allowedContentTypes: [.json]) { result in
            guard case let .success(url) = result else { return }
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            if let data = try? Data(contentsOf: url) { Task { await model.prepareImport(data) } }
        }
        .alert("Replace the local journal?", isPresented: $model.isImportConfirmationPresented) {
            Button("Replace", role: .destructive) { Task { await model.confirmImport() } }
            Button("Cancel", role: .cancel) { model.importPreview = nil }
        } message: {
            Text("The import contains \(model.importPreview?.foodEntries.count ?? 0) food entries and \(model.importPreview?.foods.count ?? 0) foods.")
        }
        .confirmationDialog("Reset local Calorie data?", isPresented: $showReset) {
            Button("Reset journal", role: .destructive) { Task { await model.resetLocalData() } }
            Button("Cancel", role: .cancel) {}
        }
        .confirmationDialog(
            "Delete your Calorie cloud account?",
            isPresented: $showDeleteAccount,
            titleVisibility: .visible
        ) {
            Button("Delete cloud account", role: .destructive) {
                Task { await model.deleteCloudAccount() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Cloud data and linked sign-ins will be deleted. Your journal on this iPhone will remain until you reset it separately.")
        }
    }

    @ViewBuilder
    private var accountControls: some View {
        if let account = model.account {
            Label(
                account.hasApple ? "Apple sign-in connected" : "Existing journal connected",
                systemImage: account.hasApple ? "checkmark.icloud.fill" : "person.crop.circle.badge.checkmark"
            )
            .font(.headline)
            .frame(minHeight: 44)
            if !account.name.isEmpty, account.name != account.email {
                Text(account.name)
                    .font(.subheadline.weight(.semibold))
            }
            Text(account.email)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
            if account.hasApple {
                Text("This account uses Apple's stable private identifier. Sharing or hiding your email does not change which journal opens.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                HStack {
                    Label(syncStatusText, systemImage: syncStatusSymbol)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Button(model.document.syncState == .conflict ? "Resolve journals" : "Sync now") {
                        Task { await model.syncNow() }
                    }
                        .font(.caption.weight(.bold))
                        .frame(minHeight: 44)
                }
                Button { Task { await model.signOut() } } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.bordered)
                Button(role: .destructive) { showDeleteAccount = true } label: {
                    Label("Delete cloud account", systemImage: "person.crop.circle.badge.minus")
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
            } else {
                Text("Finish once with Apple. After that, Apple sign-in opens this same journal—not a second account.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                appleButton
            }
        } else {
            Label("On this iPhone", systemImage: "iphone.gen3")
                .font(.headline)
                .frame(minHeight: 44)
            Text("Already use Calorie on the web? Connect that journal first, then add Apple. Email matching is never used to guess ownership.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button { Task { await model.connectExistingAccount() } } label: {
                Label("Connect existing Calorie data", systemImage: "arrow.triangle.2.circlepath.icloud")
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(BotanicalButtonStyle())
            Text("Starting fresh? Continue with Apple to create a new private cloud journal.")
                .font(.caption)
                .foregroundStyle(.secondary)
            appleButton
        }
        if model.isAccountWorking {
            ProgressView("Securing your account…")
                .frame(maxWidth: .infinity, minHeight: 44)
        }
        if let notice = model.accountNotice {
            Label(notice, systemImage: "checkmark.circle.fill")
                .font(.caption)
                .foregroundStyle(CaloriePalette.moss)
                .accessibilityLabel("Account status: \(notice)")
        }
    }

    private var appleButton: some View {
        SignInWithAppleButton(.continue) { request in
            appleNonce = AppleNonce.make()
            request.requestedScopes = [.fullName, .email]
            request.nonce = AppleNonce.digest(appleNonce)
        } onCompletion: { result in
            guard
                case let .success(authorization) = result,
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let token = String(data: tokenData, encoding: .utf8)
            else {
                if case let .failure(error) = result { model.message = error.localizedDescription }
                return
            }
            let payload = AppleIdentityPayload(
                identityToken: token,
                nonce: appleNonce,
                email: credential.email,
                firstName: credential.fullName?.givenName,
                lastName: credential.fullName?.familyName
            )
            Task { await model.completeAppleSignIn(payload) }
        }
        .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
        .frame(maxWidth: .infinity, minHeight: 48)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .disabled(model.isAccountWorking)
    }

    private var syncStatusText: String {
        switch model.document.syncState {
        case .localOnly: "On this iPhone"
        case .pending: model.pendingSyncCount == 1 ? "1 change pending" : "\(model.pendingSyncCount) changes pending"
        case .synced: "Up to date"
        case .conflict: "Choice required"
        case .failed: "Sync needs attention"
        }
    }

    private var syncStatusSymbol: String {
        switch model.document.syncState {
        case .localOnly: "iphone.gen3"
        case .pending: "arrow.triangle.2.circlepath.icloud"
        case .synced: "checkmark.icloud.fill"
        case .conflict: "arrow.triangle.branch"
        case .failed: "exclamationmark.icloud.fill"
        }
    }

    private func youSection<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            BotanicalSectionLabel(text: title)
            VStack(alignment: .leading, spacing: 10) { content() }
                .padding(16).background(CaloriePalette.surface).clipShape(RoundedRectangle(cornerRadius: 15))
        }
    }
}

private struct RoutineManagerView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var period: RoutinePeriod = .morning

    var body: some View {
        NavigationStack {
            Form {
                Section("Add routine") {
                    TextField("Routine name", text: $name)
                    Picker("Preferred time", selection: $period) {
                        ForEach(RoutinePeriod.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    Button("Add routine") {
                        let routine = MedicationRoutine(
                            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                            period: period
                        )
                        Task {
                            await model.saveRoutine(routine)
                            name = ""
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                Section {
                    ForEach(model.document.routines) { routine in
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(routine.name)
                                Text(routine.period.rawValue)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button(routine.isArchived ? "Restore" : "Archive") {
                                Task { await model.toggleArchive(routine) }
                            }
                            .font(.subheadline.weight(.semibold))
                        }
                    }
                } header: {
                    Text("Routines")
                } footer: {
                    Text("Names and timing are reminders only; dosage is intentionally not stored.")
                }
            }
            .navigationTitle("Daily care routines")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct ProfileEditorView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var profile = Profile()
    @State private var useEstimate = false

    var body: some View {
        NavigationStack {
            Form {
                Section("You") {
                    TextField("Name (optional)", text: $profile.name)
                    Picker("Goal", selection: $profile.goal) { ForEach(Goal.allCases, id: \.self) { Text($0.rawValue).tag($0) } }
                    Picker("Activity", selection: $profile.activity) { ForEach(ActivityLevel.allCases, id: \.self) { Text($0.rawValue).tag($0) } }
                }
                Section {
                    Toggle("Use a published estimate", isOn: $useEstimate)
                    if useEstimate {
                        optionalNumber("Age", value: $profile.age)
                        optionalDouble("Height (cm)", value: $profile.heightCentimetres)
                        optionalDouble("Weight (kg)", value: $profile.weightKilograms)
                        Picker("Equation profile", selection: $profile.equationProfile) {
                            Text("Choose later").tag(EquationProfile?.none)
                            ForEach(EquationProfile.allCases, id: \.self) { Text($0.rawValue).tag(Optional($0)) }
                        }
                    } else {
                        optionalDouble("Manual calorie target", value: $profile.manualCalorieTarget)
                    }
                } header: { Text("Targets") } footer: {
                    Text("The equation profile only selects a published formula constant. It is separate from gender identity. Choosing manual targets is always valid.")
                }
                Section("Daily care") {
                    Stepper("Water target: \(profile.waterTargetMillilitres) ml", value: $profile.waterTargetMillilitres, in: 500...6_000, step: 250)
                }
            }
            .navigationTitle("Profile & targets")
            .onAppear {
                profile = model.document.profile
                useEstimate = profile.equationProfile != nil && profile.manualCalorieTarget == nil && profile.manualMacroTargets == nil
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if useEstimate {
                            profile.manualCalorieTarget = nil
                            profile.manualMacroTargets = nil
                        } else {
                            profile.equationProfile = nil
                            profile.manualMacroTargets = nil
                        }
                        Task { await model.updateProfile(profile); dismiss() }
                    }
                }
            }
        }
    }

    private func optionalNumber(_ label: String, value: Binding<Int?>) -> some View {
        TextField(label, value: value, format: .number).keyboardType(.numberPad)
    }

    private func optionalDouble(_ label: String, value: Binding<Double?>) -> some View {
        TextField(label, value: value, format: .number).keyboardType(.decimalPad)
    }
}

func botanicalHeader(_ title: String, subtitle: String) -> some View {
    VStack(alignment: .leading, spacing: 9) {
        HStack { LeafMark(size: 34); Text("CALORIE").font(.caption.weight(.heavy)).tracking(1.3) }
        Text(title).font(.system(.largeTitle, design: .rounded, weight: .bold))
        Text(subtitle).font(.body).foregroundStyle(.secondary)
    }
    .padding(.top, 16)
}

private struct CalorieExportPayload: Transferable {
    let document: CalorieDocument

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .json) { payload in
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            return try encoder.encode(payload.document)
        }
    }
}
