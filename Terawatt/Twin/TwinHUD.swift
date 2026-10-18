import SwiftUI

/// Gauge strip under the twin volume: Earth MW vs cap, 5-yr spend vs budget, serving, first failing constraint.
struct TwinHUD: View {
    @Environment(ProjectStore.self) private var store

    var body: some View {
        let t = store.twin, sc = store.current.scenario
        HStack(spacing: 20) {
            stat("Earth MW", "\(Fmt.n(t.earthFacilityMW, 0))/\(Fmt.n(sc.gridCapMW, 0))", warn: !(t.constraint(.grid)?.ok ?? true))
            stat("5-yr $", "\(Fmt.big(t.cost5yr))/\(Fmt.big(sc.budgetUSD))", warn: !(t.constraint(.budget)?.ok ?? true))
            stat("Serving", "\(Int(((t.constraint(.serving)?.ratio ?? 0) * 100).rounded()))%", warn: !(t.constraint(.serving)?.ok ?? true))
            stat("Off-world MW", Fmt.n(t.offWorldMW, 0))
            stat("Year", "\(Int(sc.year))")
            stat("Lens", store.lens.title)
            if let f = t.firstFailing { stat("Binds first", f.kind.title, warn: true) }
        }
        .padding(.horizontal, 24).padding(.vertical, 12)
        .glassBackgroundEffect()
    }

    private func stat(_ label: String, _ value: String, warn: Bool = false) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.title3.monospacedDigit()).fontWeight(.semibold)
                .foregroundStyle(warn ? Color.red : .primary)
                .contentTransition(.numericText())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
    }
}
