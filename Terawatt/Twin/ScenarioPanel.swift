import SwiftUI

/// Scenario panel: the only writer to the scenario. Open beside the volume at every scale.
struct ScenarioPanel: View {
    @Environment(ProjectStore.self) private var store
    @Environment(\.openImmersiveSpace) private var openImmersive

    var body: some View {
        @Bindable var store = store
        let t = store.twin
        let sc = store.current.scenario
        Form {
            Section { breadcrumb }
            Section { gauges(t) }
            if let fail = t.firstFailing {
                Section {
                    Button { if let c = fail.cause { store.zoom(to: c) } } label: {
                        Label("\(fail.kind.title): \(fail.detail)", systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                    }
                    .disabled(fail.cause == nil)
                } header: { Text("First failing constraint") }
            }
            Section("Lens") {
                Picker("Lens", selection: $store.lens) {
                    ForEach(TwinLens.allCases, id: \.self) { Label($0.title, systemImage: $0.icon).tag($0) }
                }
                .pickerStyle(.segmented)
            }
            Section("Year \(Int(sc.year))") {
                Slider(value: $store.current.scenario.year, in: Scenario.yearRange, step: 1)
            }
            levelSection
            Section("Presets") {
                slider("Budget $\(Fmt.big(sc.budgetUSD))", $store.current.scenario.budgetUSD, 5e9...100e9, 1e9)
                slider("Grid cap \(Int(sc.gridCapMW)) MW", $store.current.scenario.gridCapMW, 100...2000, 10)
                slider("Launch $\(Int(sc.launchUSDPerKg))/kg", $store.current.scenario.launchUSDPerKg, 50...2000, 10)
                slider("PUE \(Fmt.n(sc.pue, 2)) (assumed)", $store.current.scenario.pue, 1.05...1.6, 0.01)
                slider("Energy $\(Fmt.n(sc.energyUSDPerKWh, 2))/kWh (assumed)", $store.current.scenario.energyUSDPerKWh, 0.02...0.2, 0.01)
                slider("Building $\(Fmt.big(sc.buildingUSDPerMW))/MW (assumed)", $store.current.scenario.buildingUSDPerMW, 3e6...25e6, 1e6)
            }
            Section("User case mix") {
                ForEach(PresetData.shared.userCases) { c in
                    slider("\(c.id.rawValue): \(c.title) \(Int((sc.weights[c.id] ?? 0) * 100))%",
                           Binding(get: { store.current.scenario.caseMix[c.id] ?? 0 },
                                   set: { store.current.scenario.caseMix[c.id] = $0 }), 0...1, 0.05)
                }
                LabeledContent("Peak demand", value: "\(Fmt.big(t.demandOutTokS)) out · \(Fmt.big(t.demandInTokS)) in tok/s")
                LabeledContent("Supply", value: "\(Fmt.big(t.decodeTokS)) decode · \(Fmt.big(t.prefillTokS)) prefill")
            }
            Section("Off-world") {
                ForEach([TwinLocation.leo, .moon, .mars], id: \.self) { l in
                    Toggle(l.title, isOn: Binding(get: { store.current.scenario.offWorldOn(l) },
                                                  set: { store.current.scenario.setOffWorld(l, $0) }))
                }
                LabeledContent("Launch cost", value: "$\(Fmt.big(t.launchCostUSD))")
                Button("Orbital view", systemImage: "globe.americas") { store.zoom(to: TwinFocus(scale: .offWorld)) }
            }
            Section("Assumptions") {
                Text("Simplified models. Tokens/s per chip, building $/MW, PUE, energy price and 2030 rack points are assumptions. Values rounded.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .tint(Theme.accent)
        .onChange(of: store.current.scenario) { _, _ in store.persist() }
        .navigationTitle("Scenario")
    }

    private var breadcrumb: some View {
        HStack(spacing: 6) {
            Button("Back", systemImage: "chevron.left") { store.zoomOut() }
                .labelStyle(.iconOnly).disabled(store.focus.scale == .fleet)
            ForEach(path, id: \.scale) { f in
                Button(crumb(f)) { store.zoom(to: f) }
                    .buttonStyle(.borderless)
                    .fontWeight(f.scale == store.focus.scale ? .bold : .regular)
                if f.scale != store.focus.scale { Image(systemName: "chevron.right").font(.caption2).foregroundStyle(.secondary) }
            }
        }
    }

    private var path: [TwinFocus] {
        let f = store.focus
        if f.scale == .offWorld { return [TwinFocus(scale: .fleet), f] }
        return TwinScale.allCases.reversed().filter { $0 >= f.scale && $0 != .offWorld }.map { s in var x = f; x.scale = s; return x }
    }

    private func crumb(_ f: TwinFocus) -> String {
        let sc = store.current.scenario
        switch f.scale {
        case .fleet: return "Fleet"
        case .offWorld: return "Off-world"
        case .site: return sc.sites[f.site].name
        case .building: return "Bldg \(f.building + 1)"
        case .hall: return "Hall \(f.hall + 1)"
        case .rack: return f.rack.rawValue.uppercased()
        case .chip: return "Chip"
        }
    }

    private func gauges(_ t: TwinMetrics) -> some View {
        HStack(spacing: 12) {
            ForEach(t.constraints, id: \.kind) { c in
                let fail = !c.ok, first = t.firstFailing?.kind == c.kind
                VStack(spacing: 4) {
                    Gauge(value: min(c.kind == .serving ? c.ratio : (c.kind == .grid || c.kind == .budget ? c.ratio : (c.ok ? 0 : 1)), 1)) {
                        EmptyView()
                    } currentValueLabel: {
                        Text(c.kind == .grid || c.kind == .budget || c.kind == .serving ? "\(Int((c.ratio * 100).rounded()))%" : (c.ok ? "OK" : "✕"))
                            .font(.caption.monospacedDigit())
                    }
                    .gaugeStyle(.accessoryCircularCapacity)
                    .tint(fail ? (first ? .red : .orange) : Theme.accent)
                    Text(c.kind.title).font(.caption2)
                }
                .onTapGesture { if fail, let cause = c.cause { store.zoom(to: cause) } }
                .accessibilityLabel("\(c.kind.title) \(c.detail)")
            }
        }
        .frame(maxWidth: .infinity)
    }

    /// Editors for the level in view.
    @ViewBuilder private var levelSection: some View {
        @Bindable var store = store
        let f = store.focus
        switch f.scale {
        case .fleet, .offWorld:
            Section("Fleet") {
                Stepper("GPU racks per Earth site \(perSite(.gpu))") {
                    store.current.scenario.addRacksEverywhere(.gpu, 10)
                } onDecrement: { store.current.scenario.addRacksEverywhere(.gpu, -10) }
                Stepper("LPU racks per Earth site \(perSite(.lpu))") {
                    store.current.scenario.addRacksEverywhere(.lpu, 10)
                } onDecrement: { store.current.scenario.addRacksEverywhere(.lpu, -10) }
                Stepper("Earth sites \(store.current.scenario.sites.filter { $0.location == .earth && $0.enabled }.count)",
                        onIncrement: { toggleEarthSite(on: true) }, onDecrement: { toggleEarthSite(on: false) })
                Button("Split grid cap evenly") { store.current.scenario.rebalanceGrid() }
            }
        case .site, .building:
            let s = store.current.scenario.sites[f.site]
            let m = store.twin.sites[f.site]
            Section(s.name) {
                LabeledContent("Facility", value: "\(Fmt.n(m.facilityMW, 0)) MW")
                if s.location == .earth {
                    slider("Grid allocation \(Int(s.gridAllocationMW)) MW", $store.current.scenario.sites[f.site].gridAllocationMW, 0...1000, 5)
                    LabeledContent("Water", value: "\(Fmt.n(m.waterML, 0)) ML/yr")
                    LabeledContent("Carbon", value: "\(Fmt.big(m.carbonT)) t/yr")
                } else {
                    LabeledContent("Radiator", value: "\(Fmt.big(m.radiatorM2)) m²")
                    LabeledContent("Launch mass", value: "\(Fmt.big(m.launchMassKg / 1000)) t")
                }
                Picker("Workload", selection: $store.current.scenario.sites[f.site].workload) {
                    ForEach(Workload.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
                }
                LabeledContent("5-yr cost", value: "$\(Fmt.big(m.cost5yr))")
                if let sen = PresetData.shared.sentiment(s.climate), s.location == .earth {
                    LabeledContent("Sentiment", value: "\(Int(sen.pro * 100))% pro · +\(Fmt.n(m.delayMonths, 0)) mo")
                    Text(sen.note).font(.footnote).foregroundStyle(.secondary)
                }
                if f.scale == .site { Button("Add building", systemImage: "plus") { store.current.scenario.sites[f.site].buildings.append(TwinBuilding()) } }
                else { Button("Add hall", systemImage: "plus") { store.current.scenario.sites[f.site].buildings[f.building].halls.append(TwinHall()) } }
            }
        case .hall, .rack, .chip:
            let hallPath = (f.site, f.building, f.hall)
            Section("Hall \(f.hall + 1)") {
                Picker("Cooling", selection: $store.current.scenario.sites[hallPath.0].buildings[hallPath.1].halls[hallPath.2].cooling) {
                    ForEach(CoolingKind.allCases, id: \.self) { Text($0.title).tag($0) }
                }
                ForEach(RackPresetID.allCases, id: \.self) { id in
                    let n = store.current.scenario.sites[hallPath.0].buildings[hallPath.1].halls[hallPath.2].rackMix[id] ?? 0
                    let avail = ScenarioEngine.rack(id, year: store.current.scenario.year) != nil
                    Stepper("\(PresetData.shared.rack(id).title) \(n)\(avail ? "" : " (n/a \(Int(store.current.scenario.year)))")",
                            value: Binding(get: { n }, set: { store.current.scenario.sites[hallPath.0].buildings[hallPath.1].halls[hallPath.2].rackMix[id] = $0 }),
                            in: 0...400, step: 10)
                }
                if f.scale == .hall { Button("Walk hall", systemImage: "figure.walk") { Task { await openImmersive(id: SceneID.walk) } } }
            }
        }
    }

    private func perSite(_ id: RackPresetID) -> Int {
        store.current.scenario.sites.first { $0.location == .earth && $0.enabled }?.buildings.first?.halls.first?.rackMix[id] ?? 0
    }

    private func toggleEarthSite(on: Bool) {
        let earth = store.current.scenario.sites.indices.filter { store.current.scenario.sites[$0].location == .earth }
        if on, let i = earth.first(where: { !store.current.scenario.sites[$0].enabled }) { store.current.scenario.sites[i].enabled = true }
        if !on, let i = earth.last(where: { store.current.scenario.sites[$0].enabled }),
           earth.filter({ store.current.scenario.sites[$0].enabled }).count > 1 { store.current.scenario.sites[i].enabled = false }
    }

    private func slider(_ title: String, _ v: Binding<Double>, _ r: ClosedRange<Double>, _ step: Double) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.callout.monospacedDigit())
            Slider(value: v, in: r, step: step)
        }
    }
}
