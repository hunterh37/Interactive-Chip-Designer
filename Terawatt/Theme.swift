import SwiftUI

/// Monochrome design language shared with web/src/style.css + ascii.js.
enum Theme {
    static let bg = Color.black
    static let fg = Color(white: 0.957)
    static let mute = Color(white: 0.42)
    static let dim = Color(white: 0.165)
    static let line = Color(white: 0.11)
    static let paper = Color.white
    static let graphite = Color(white: 0.16)
    /// Highlight color. White on black; 3D buses use it too.
    static let accent = Color.white

    static func mono(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }
}

enum Fmt {
    static func n(_ v: Double, _ d: Int = 1) -> String { v.formatted(.number.precision(.fractionLength(d))) }
    static func big(_ v: Double) -> String {
        switch abs(v) {
        case 1e12...: "\(n(v / 1e12))T"; case 1e9...: "\(n(v / 1e9))B"
        case 1e6...: "\(n(v / 1e6))M"; case 1e3...: "\(n(v / 1e3))k"
        default: n(v, 0)
        }
    }
}

enum ASCII {
    /// Text meter: ████████░░░░
    static func bar(_ v: Double, _ max: Double, _ w: Int = 16) -> String {
        let f = Swift.max(0, Swift.min(w, Int((v / Swift.max(max, 1e-9) * Double(w)).rounded())))
        return String(repeating: "█", count: f) + String(repeating: "░", count: w - f)
    }
    /// Step marker: [x] done, [>] current, [ ] pending.
    static func mark(done: Bool, current: Bool) -> String { done ? "[x]" : current ? "[>]" : "[ ]" }
}

/// Section header label: small, tracked, uppercase, muted.
struct MonoLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text.uppercased()).font(Theme.mono(11)).tracking(2.2).foregroundStyle(Theme.mute)
    }
}

/// Scramble-in text effect (port of ascii.js scramble).
struct ScrambleText: View {
    let text: String
    var duration: Double = 0.5
    @State private var start = Date()
    private static let pool = Array("!<>-_\\/[]{}=+*^?#01ABCDEF")

    var body: some View {
        TimelineView(.animation(paused: Date().timeIntervalSince(start) > duration)) { ctx in
            Text(frame(ctx.date))
        }
        .onChange(of: text) { _, _ in start = Date() }
        .accessibilityLabel(text)
    }

    private func frame(_ now: Date) -> String {
        let p = min(1, now.timeIntervalSince(start) / duration)
        let chars = Array(text), n = Int(p * Double(chars.count))
        return String(chars.prefix(n)) + String(chars.dropFirst(n).map { $0 == " " ? " " : Self.pool.randomElement()! })
    }
}

/// Animated ASCII field background (port of ascii.js asciiField).
struct ASCIIField: View {
    var density = Array(" .:-=+*#%@")
    var alpha = 0.22
    var speed = 1.0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 20, paused: reduceMotion)) { ctx in
            Canvas { g, size in
                let t = ctx.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 10_000) * 0.25 * speed
                let cw = 9.0, ch = 14.0
                var y = 0.0
                while y < size.height {
                    var x = 0.0
                    while x < size.width {
                        let v = sin(x * 0.011 + t * 3) * cos(y * 0.017 - t * 2) + sin((x + y) * 0.006 + t) * 0.6
                        let k = max(0, min(density.count - 1, Int((v + 1.6) / 3.2 * Double(density.count))))
                        if k > 0 {
                            g.draw(Text(String(density[k])).font(Theme.mono(11))
                                .foregroundStyle(Color.white.opacity(alpha * Double(k) / Double(density.count))),
                                   at: CGPoint(x: x, y: y), anchor: .topLeading)
                        }
                        x += cw
                    }
                    y += ch
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// Square bordered uppercase button. `primary` fills white with black text.
struct MonoButtonStyle: ButtonStyle {
    var primary = false
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.mono(13, primary ? .medium : .regular)).tracking(1.6).textCase(.uppercase)
            .padding(.horizontal, 16).padding(.vertical, 11)
            .foregroundStyle(primary ? Color.black : Theme.fg)
            .background(primary ? Theme.fg : configuration.isPressed ? Theme.dim : .clear)
            .overlay(Rectangle().stroke(primary ? Theme.fg : Theme.dim, lineWidth: 1))
            .contentShape(Rectangle())
            .hoverEffect(.highlight)
            .opacity(enabled ? 1 : 0.3)
            .offset(y: configuration.isPressed ? 1 : 0)
    }
}

extension ButtonStyle where Self == MonoButtonStyle {
    static var mono: MonoButtonStyle { .init() }
    static var monoPrimary: MonoButtonStyle { .init(primary: true) }
}

extension View {
    /// Black window, monospaced type, white tint.
    func terawattStyle(field: Bool = false) -> some View {
        self
            .fontDesign(.monospaced)
            .tint(Theme.fg)
            .foregroundStyle(Theme.fg)
            .scrollContentBackground(.hidden)
            .background {
                ZStack { Theme.bg; if field { ASCIIField() } }.ignoresSafeArea()
            }
            .preferredColorScheme(.dark)
    }

    /// Black panel with hairline border, replaces glass in ornaments.
    func monoPanel() -> some View {
        self.background(Theme.bg.opacity(0.92)).overlay(Rectangle().stroke(Theme.dim, lineWidth: 1))
            .glassBackgroundEffect(in: Rectangle(), displayMode: .never)
    }
}
