import SwiftUI

struct HUDStrip: View {
    @Environment(ProjectStore.self) private var store

    var body: some View {
        let s = store.stats
        VStack(spacing: 8) {
        if store.current.installedChips > 0 { deltaRow }
        HStack(spacing: 20) {
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
        .glassBackgroundEffect()
    }

    @ViewBuilder private var deltaRow: some View {
        let d = store.delta
        HStack(spacing: 20) {
            stat("Δ PFLOPS", sign(d.pflops, 0))
            stat("Δ MW", sign(d.mw, 1))
            stat("Δ $/M tok", sign(d.usdPerMTok, 3))
        }
    }

    private func sign(_ v: Double, _ d: Int) -> String { (v >= 0 ? "+" : "") + Fmt.n(v, d) }

    private func stat(_ label: String, _ value: String, warn: Bool = false) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.title3.monospacedDigit()).fontWeight(.semibold)
                .foregroundStyle(warn ? Theme.accent : .primary)
                .contentTransition(.numericText())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
    }
}
