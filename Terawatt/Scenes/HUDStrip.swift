import SwiftUI

struct HUDStrip: View {
    @Environment(ProjectStore.self) private var store

    var body: some View {
        let s = store.stats
        VStack(alignment: .leading, spacing: 8) {
            if store.current.installedChips > 0 { deltaRow }
            HStack(spacing: 22) {
                stat("MW", Fmt.n(s.facilityMW, 0), warn: s.overBudget)
                stat("PUE", Fmt.n(s.pue, 2))
                stat("PFLOPS", Fmt.big(s.pflopsFP4))
                stat("tok/s", Fmt.big(s.decodeTokS))
                stat("$/M tok", Fmt.n(s.usdPerMTok, 3))
                stat("Capex", "$" + Fmt.big(s.capexUSD))
                stat("CO₂ t/yr", Fmt.big(s.carbonTPerYr))
            }
        }
        .padding(.horizontal, 24).padding(.vertical, 12)
        .fontDesign(.monospaced)
        .monoPanel()
    }

    @ViewBuilder private var deltaRow: some View {
        let d = store.delta
        HStack(spacing: 22) {
            stat("Δ PFLOPS", sign(d.pflops, 0))
            stat("Δ MW", sign(d.mw, 1))
            stat("Δ $/M tok", sign(d.usdPerMTok, 3))
        }
    }

    private func sign(_ v: Double, _ d: Int) -> String { (v >= 0 ? "+" : "") + Fmt.n(v, d) }

    private func stat(_ label: String, _ value: String, warn: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(warn ? "! " + value : value).font(Theme.mono(20, .medium).monospacedDigit())
                .foregroundStyle(warn ? Color.black : Theme.fg)
                .padding(.horizontal, warn ? 4 : 0)
                .background(warn ? Theme.fg : .clear)
                .contentTransition(.numericText())
            Text(label.uppercased()).font(Theme.mono(10)).tracking(1.8).foregroundStyle(Theme.mute)
        }
    }
}
