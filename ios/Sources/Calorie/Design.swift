import CalorieCore
import SwiftUI
import UIKit

enum CaloriePalette {
    static let paper = adaptive(light: rgb(252, 253, 249), dark: rgb(18, 24, 19))
    static let surface = adaptive(light: rgb(242, 247, 237), dark: rgb(30, 40, 31))
    static let surfaceStrong = adaptive(light: rgb(229, 239, 222), dark: rgb(48, 64, 49))
    static let leaf = adaptive(light: rgb(27, 55, 35), dark: rgb(236, 244, 235))
    static let moss = adaptive(light: rgb(71, 116, 58), dark: rgb(111, 165, 93))
    static let mossStrong = adaptive(light: rgb(44, 82, 36), dark: rgb(145, 195, 127))
    static let cherry = adaptive(light: rgb(223, 59, 50), dark: rgb(255, 112, 101))
    static let amber = adaptive(light: rgb(224, 167, 45), dark: rgb(244, 193, 76))
    static let sky = adaptive(light: rgb(204, 231, 239), dark: rgb(37, 56, 62))
    static let plum = adaptive(light: rgb(226, 211, 235), dark: rgb(58, 47, 65))

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
            .fontDesign(.rounded)
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

struct BotanicalButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.bold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(CaloriePalette.moss)
            .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}

struct BotanicalSectionLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption.weight(.bold))
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
                        Text(basisLabel).font(.caption.weight(.semibold))
                    }
                    Text(quality.explanation)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.top, 5)
            } label: {
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(contextLabel).font(.subheadline.weight(.semibold))
                        if let basisLabel {
                            Text(basisLabel).font(.caption2).foregroundStyle(.secondary)
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
                        .font(.caption2.weight(.semibold))
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
        Label(
            quality.score.map { "\($0)/100 tracked" } ?? "Score unavailable",
            systemImage: "leaf.fill"
        )
        .font(.caption.weight(.bold))
        .foregroundStyle(quality.score == nil ? .secondary : CaloriePalette.mossStrong)
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(CaloriePalette.surfaceStrong)
        .clipShape(Capsule())
    }
}

struct DailyScoreView: View {
    let result: DailyScore

    var body: some View {
        DisclosureGroup {
            VStack(alignment: .leading, spacing: 4) {
                Text("Calories \(factor(result.calorieFactor)) · Protein \(factor(result.proteinFactor)) · Fibre \(factor(result.fibreFactor))")
                    .font(.caption.weight(.semibold))
                Text(result.explanation)
                    .font(.caption)
            }
            .foregroundStyle(.secondary)
            .padding(.top, 5)
        } label: {
            HStack(spacing: 10) {
                Text(result.label).font(.subheadline.weight(.semibold))
                Spacer()
                Label(
                    result.score.map { "\($0)/100" } ?? "Score unavailable",
                    systemImage: "target"
                )
                .font(.caption.weight(.bold))
                .foregroundStyle(result.score == nil ? .secondary : CaloriePalette.mossStrong)
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(CaloriePalette.surfaceStrong)
                .clipShape(Capsule())
            }
        }
        .accessibilityLabel("\(result.label). \(result.explanation)")
    }

    private func factor(_ value: Double?) -> String {
        value.map { "\(Int(($0 * 100).rounded()))%" } ?? "not scored"
    }
}

extension View {
    func botanicalBackground() -> some View { modifier(BotanicalBackground()) }
}
