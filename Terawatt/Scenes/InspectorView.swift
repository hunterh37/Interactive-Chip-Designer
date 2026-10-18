import SwiftUI

struct InspectorView: View {
    @Environment(ProjectStore.self) private var store
    @Environment(\.openImmersiveSpace) private var openImmersive

    var body: some View {
        switch store.mode {
        case .fab: FabInspector()
        case .chip: ChipInspector()
        case .training: TrainingInspector()
        case .studio: studio
        }
    }

    @ViewBuilder private var studio: some View {
        @Bindable var store = store
        let c = store.current.campus
        Form {
            Section(header: MonoLabel("Campus")) {
                TextField("Name", text: $store.current.name)
                Picker("Site", selection: $store.current.campus.site) {
                    ForEach(SiteID.allCases, id: \.self) { Text(Site.of($0).title).tag($0) }
                }
                LabeledContent("Budget \(Int(c.powerBudgetMW)) MW") {
                    Slider(value: $store.current.campus.powerBudgetMW, in: 50...5000, step: 50)
                }
            }
            Section(header: MonoLabel("Hall")) {
                LabeledContent("Length \(Int(c.hall.length)) m") {
                    Slider(value: $store.current.campus.hall.length, in: 40...400, step: 10)
                }
                LabeledContent("Width \(Int(c.hall.width)) m") {
                    Slider(value: $store.current.campus.hall.width, in: 20...120, step: 5)
                }
                LabeledContent("Height \(Int(c.hall.clearHeight)) m") {
                    Slider(value: $store.current.campus.hall.clearHeight, in: 6...14, step: 1)
                }
            }
            Section(header: MonoLabel("Racks")) {
                Picker("Rack", selection: $store.current.campus.rackPreset) {
                    ForEach(RackPreset.table, id: \.id) { Text($0.title).tag($0.id) }
                }
                Stepper("Rows \(c.rows.count)") {
                    store.current.campus.rows.append(RackRow(racks: c.rows.first?.racks ?? 20, preset: c.rackPreset))
                } onDecrement: {
                    if c.rows.count > 1 { store.current.campus.rows.removeLast() }
                }
                Stepper("Racks per row \(c.rows.first?.racks ?? 0)",
                        value: Binding(get: { c.rows.first?.racks ?? 1 }, set: { v in
                            for i in store.current.campus.rows.indices { store.current.campus.rows[i].racks = v }
                        }), in: 1...c.maxRacksPerRow)
                Picker("Cooling", selection: $store.current.campus.cooling) {
                    ForEach(CoolingKind.allCases, id: \.self) { Text($0.title).tag($0) }
                }
                Picker("Power", selection: $store.current.campus.power) {
                    Text("AC").tag(PowerKind.ac); Text("800 V DC").tag(PowerKind.dc800)
                }
            }
            Section {
                Button("Walk") { Task { await openImmersive(id: SceneID.walk) } }
                Button("Save") { store.save() }
            }
        }
        .terawattStyle()
        .onChange(of: store.current.campus.rackPreset) { _, p in
            for i in store.current.campus.rows.indices { store.current.campus.rows[i].preset = p }
        }
        .onChange(of: store.current.campus.hall) { _, _ in
            store.current.campus.relayoutRooms()
            let cap = store.current.campus.maxRacksPerRow
            for i in store.current.campus.rows.indices where store.current.campus.rows[i].racks > cap {
                store.current.campus.rows[i].racks = cap
            }
        }
        .onChange(of: store.current.campus) { _, _ in store.persist() }
        .navigationTitle("INSPECTOR")
    }
}
