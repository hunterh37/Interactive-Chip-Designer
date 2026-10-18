import SwiftUI

struct FabInspector: View {
    @Environment(ProjectStore.self) private var store
    @Environment(\.openImmersiveSpace) private var openImmersive

    var body: some View {
        let at = store.current.wafer.station
        Form {
            Section(header: MonoLabel("Steps")) {
                ForEach(FabStation.allCases, id: \.self) { s in
                    Button { store.current.wafer = .at(s) } label: {
                        HStack {
                            Text(ASCII.mark(done: s.rawValue < at.rawValue, current: s == at))
                                .foregroundStyle(s.rawValue <= at.rawValue ? Theme.fg : Theme.mute)
                            Text("\(s.rawValue + 1)  \(s.title)")
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            Section {
                Button("Next") { store.current.wafer.advance() }.disabled(store.current.wafer.finished)
                Button("Restart") { store.current.wafer = WaferState() }
                if store.current.tapedOut != nil && store.current.wafer.finished {
                    Button("Package") { store.openChip(.package) }
                }
                Button("Walk") { Task { await openImmersive(id: SceneID.walk) } }
            }
        }
        .terawattStyle()
        .onChange(of: store.current.wafer) { _, _ in store.persist() }
        .navigationTitle("FAB 1")
    }
}
