import SwiftUI

enum Theme {
    static let paper = Color.white
    static let graphite = Color(red: 0.16, green: 0.17, blue: 0.19)
    static let accent = Color(red: 0.98, green: 0.45, blue: 0.09)
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
