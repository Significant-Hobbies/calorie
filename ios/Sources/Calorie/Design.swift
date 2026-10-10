import CalorieCore
import SaaSMakerUI
import SwiftUI
import UIKit

enum CaloriePalette {
    private static let leafColor = adaptive(light: rgb(27, 55, 35), dark: rgb(236, 244, 235))
    private static let surfaceStrongColor = adaptive(light: rgb(229, 239, 222), dark: rgb(48, 64, 49))
    private static let surfaceColor = adaptive(light: rgb(242, 247, 237), dark: rgb(30, 40, 31))
    private static let paperColor = adaptive(light: rgb(252, 253, 249), dark: rgb(18, 24, 19))
    static let paper = theme.background
    static let surface = theme.surface
    static let surfaceStrong = theme.secondary
    static let leaf = theme.foreground
    static let moss = adaptive(light: rgb(71, 116, 58), dark: rgb(111, 165, 93))
    static let mossStrong = adaptive(light: rgb(44, 82, 36), dark: rgb(145, 195, 127))
    static let cherry = adaptive(light: rgb(223, 59, 50), dark: rgb(255, 112, 101))
    static let amber = adaptive(light: rgb(224, 167, 45), dark: rgb(244, 193, 76))
    static let sky = adaptive(light: rgb(204, 231, 239), dark: rgb(37, 56, 62))
    static let plum = adaptive(light: rgb(226, 211, 235), dark: rgb(58, 47, 65))

    // Base has the closest sans-serif hierarchy and the app's 16pt card radius.
    static var theme: SMPalette {
        var palette = SMPalette.base.brand(moss, foreground: adaptive(light: .white, dark: rgb(18, 24, 19)), soft: surfaceStrongColor)
        palette.background = paperColor
        palette.foreground = leafColor
        palette.surface = surfaceColor
        palette.card = surfaceColor
        palette.secondary = surfaceStrongColor
        palette.success = mossStrong
        palette.warning = amber
        palette.destructive = cherry
        return palette
    }

    static func theme(for scheme: ColorScheme) -> SMPalette {
        var palette = theme
        if scheme == .dark {
            let dark = SMPalette.baseDark
            palette.isDark = true
            palette.mutedForeground = dark.mutedForeground
            palette.border = dark.border
            palette.hairline = dark.hairline
            palette.input = dark.input
        }
        return palette
    }

    private static func rgb(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat) -> UIColor {
        UIColor(red: red / 255, green: green / 255, blue: blue / 255, alpha: 1)
    }

    private static func adaptive(light: UIColor, dark: UIColor) -> Color {
        Color(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? dark : light
        })
    }
}

struct BotanicalBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(CalorieType.body)
            .foregroundStyle(CaloriePalette.leaf)
            .background(CaloriePalette.paper.ignoresSafeArea())
            .tint(CaloriePalette.moss)
    }
}

struct LeafMark: View {
    var size: CGFloat = 40

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.22)
                .fill(CaloriePalette.moss)
            Capsule()
                .fill(.white)
                .frame(width: size * 0.25, height: size * 0.52)
                .rotationEffect(.degrees(32))
                .offset(x: size * 0.08, y: -size * 0.03)
            Circle()
                .fill(CaloriePalette.cherry)
                .frame(width: size * 0.16)
                .offset(x: size * 0.24, y: -size * 0.25)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

struct CherryMark: View {
    var body: some View {
        ZStack {
            Circle().fill(CaloriePalette.cherry.opacity(0.12))
            Path { path in
                path.move(to: CGPoint(x: 27, y: 28))
                path.addQuadCurve(to: CGPoint(x: 38, y: 15), control: CGPoint(x: 29, y: 16))
                path.move(to: CGPoint(x: 39, y: 15))
                path.addQuadCurve(to: CGPoint(x: 45, y: 29), control: CGPoint(x: 48, y: 19))
            }
            .stroke(CaloriePalette.mossStrong, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
            Capsule()
                .fill(CaloriePalette.moss)
                .frame(width: 16, height: 8)
                .rotationEffect(.degrees(-28))
                .offset(x: 5, y: -15)
            Circle().fill(CaloriePalette.cherry).frame(width: 17).offset(x: -8, y: 9)
            Circle().fill(CaloriePalette.cherry).frame(width: 17).offset(x: 11, y: 10)
        }
        .frame(width: 58, height: 58)
        .accessibilityHidden(true)
    }
}

// Keep the public style used by onboarding and journal screens.
struct BotanicalButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        BotanicalButtonBody(configuration: configuration)
    }
}

/// A view (not a direct `SMButtonStyle.makeBody` call) so the themed palette
/// from the environment applies; SMButtonStyle outside a view falls back to the default brand.
private struct BotanicalButtonBody: View {
    let configuration: ButtonStyleConfiguration
    @Environment(\.smPalette) private var p

    var body: some View {
        configuration.label
            .font(.custom(p.displayFont, size: 16, relativeTo: .body).weight(.semibold))
            .textCase(p.uiLowercase ? .lowercase : nil)
            .foregroundStyle(p.brandForeground)
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(p.brand, in: .capsule)
            .contentShape(.capsule)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
    }
}

enum CalorieType {
    static let body = Font.custom(SMPalette.base.sansFont, size: 16, relativeTo: .body)
    static let headline = Font.custom(SMPalette.base.displayFont, size: 17, relativeTo: .headline)
    static let title = Font.custom(SMPalette.base.displayFont, size: 28, relativeTo: .title)
    static let title2 = Font.custom(SMPalette.base.displayFont, size: 22, relativeTo: .title2)
    static let title3 = Font.custom(SMPalette.base.displayFont, size: 20, relativeTo: .title3)
    static let largeTitle = Font.custom(SMPalette.base.displayFont, size: 34, relativeTo: .largeTitle)
    static let caption = Font.custom(SMPalette.base.sansFont, size: 12, relativeTo: .caption)
    static let caption2 = Font.custom(SMPalette.base.sansFont, size: 11, relativeTo: .caption2)
    static let subheadline = Font.custom(SMPalette.base.sansFont, size: 15, relativeTo: .subheadline)
    static let callout = Font.custom(SMPalette.base.sansFont, size: 16, relativeTo: .callout)
    static let energy = Font.custom(SMPalette.base.displayFont, size: 52, relativeTo: .largeTitle)
}

struct BotanicalSectionLabel: View {
    let text: String

    var body: some View {
        Text(text.lowercased())
            .accessibilityLabel(text)
            .font(CalorieType.caption.weight(.bold))
            .foregroundStyle(.secondary)
    }
}

struct TrackedQualityScoreView: View {
    let quality: TrackedQuality
    var contextLabel = "Tracked quality"
    var basisLabel: String?
    var showsExplanation = false

    var body: some View {
        if showsExplanation {
            DisclosureGroup {
                VStack(alignment: .leading, spacing: 4) {
                    if let basisLabel {
                        Text(basisLabel).font(CalorieType.caption.weight(.semibold))
                    }
                    Text(quality.explanation)
                }
                .font(CalorieType.caption)
                .foregroundStyle(.secondary)
                .padding(.top, 5)
            } label: {
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(contextLabel).font(CalorieType.subheadline.weight(.semibold))
                        if let basisLabel {
                            Text(basisLabel).font(CalorieType.caption2).foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    scoreChip
                }
            }
            .accessibilityLabel(accessibilityLabel)
        } else {
            VStack(alignment: .leading, spacing: 3) {
                scoreChip
                if let basisLabel {
                    Text(basisLabel)
                        .font(CalorieType.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(accessibilityLabel)
        }
    }

    private var accessibilityLabel: String {
        [contextLabel, basisLabel, quality.explanation].compactMap { $0 }.joined(separator: ". ")
    }

    private var scoreChip: some View {
        SMStatusPill(
            quality.score.map { "\($0)/100 tracked" } ?? "score unavailable",
            tone: quality.score == nil ? .neutral : .brand
        )
    }
}

struct DailyScoreView: View {
    let result: DailyScore

    var body: some View {
        DisclosureGroup {
            VStack(alignment: .leading, spacing: 4) {
                Text("Calories \(factor(result.calorieFactor)) · Protein \(factor(result.proteinFactor)) · Fibre \(factor(result.fibreFactor))")
                    .font(CalorieType.caption.weight(.semibold))
                Text(result.explanation)
                    .font(CalorieType.caption)
            }
            .foregroundStyle(.secondary)
            .padding(.top, 5)
        } label: {
            HStack(spacing: 10) {
                Text(result.label).font(CalorieType.subheadline.weight(.semibold))
                Spacer()
                SMStatusPill(
                    result.score.map { "\($0)/100" } ?? "score unavailable",
                    tone: result.score == nil ? .neutral : .brand
                )
            }
        }
        .accessibilityLabel("\(result.label). \(result.explanation)")
    }

    private func factor(_ value: Double?) -> String {
        value.map { "\(Int(($0 * 100).rounded()))%" } ?? "not scored"
    }
}

private struct BotanicalCard: ViewModifier {
    @Environment(\.smPalette) private var palette
    let padding: CGFloat
    let color: Color?

    func body(content: Content) -> some View {
        var cardPalette = palette
        if let color { cardPalette.card = color }
        return SMCard(padding: padding) { content }
            // Calorie uses flat surfaces; clip the library's outer card shadow.
            .clipShape(RoundedRectangle(cornerRadius: cardPalette.radius + 4))
            .environment(\.smPalette, cardPalette)
    }
}

extension View {
    func botanicalCard(padding: CGFloat = 18, color: Color? = nil) -> some View {
        modifier(BotanicalCard(padding: padding, color: color))
    }

    func botanicalNavigationTitle(_ title: String) -> some View {
        navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text(title.lowercased())
                        .font(CalorieType.headline.weight(.semibold))
                        .accessibilityLabel(title)
                }
            }
    }

    func botanicalBackground() -> some View { modifier(BotanicalBackground()) }
}
