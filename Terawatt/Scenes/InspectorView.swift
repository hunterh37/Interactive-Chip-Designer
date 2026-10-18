import SwiftUI

struct InspectorView: View {
    @Environment(ProjectStore.self) private var store
    @Environment(\.openImmersiveSpace) private var openImmersive

    var body: some View {
        @Bindable var store = store
        Form {
            Section("Campus") {
                TextField("Name", text: $store.current.name)
                Picker("Site", selection: $store.current.campus.site) {
                    ForEach(SiteID.allCases, id: \.self) { Text(Site.of($0).title).tag($0) }
                }
                LabeledContent("Budget MW") {
                    Slider(value: $store.current.campus.powerBudgetMW, in: 50...5000, step: 50)
                }
            }
            Section("Hall") {
                LabeledContent("Length \(Int(store.current.campus.hall.length)) m") {
                    Slider(value: $store.current.campus.hall.length, in: 40...400, step: 10)
                }
                LabeledContent("Width \(Int(store.current.campus.hall.width)) m") {
                    Slider(value: $store.current.campus.hall.width, in: 20...120, step: 5)
                }
            }
            Section("Racks") {
                Picker("Rack", selection: $store.current.campus.rackPreset) {
                    ForEach(RackPreset.table, id: \.id) { Text($0.title).tag($0.id) }
                }
                .onChange(of: store.current.campus.rackPreset) { _, p in
                    for i in store.current.campus.rows.indices { store.current.campus.rows[i].preset = p }
                }
                Stepper("Rows \(store.current.campus.rows.count)") {
                    store.current.campus.rows.append(RackRow(preset: store.current.campus.rackPreset))
                } onDecrement: {
                    if !store.current.campus.rows.isEmpty { store.current.campus.rows.removeLast() }
                }
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
        .tint(Theme.accent)
        .navigationTitle("Inspector")
    }
}
