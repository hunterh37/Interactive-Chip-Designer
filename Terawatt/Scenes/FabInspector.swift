import SwiftUI

struct FabInspector: View {
    @Environment(ProjectStore.self) private var store
    @Environment(\.openImmersiveSpace) private var openImmersive

    var body: some View {
        let at = store.current.wafer.station
        Form {
            Section("Steps") {
                ForEach(FabStation.allCases, id: \.self) { s in
                    Button { store.current.wafer = .at(s) } label: {
                        HStack {
                            Image(systemName: s.rawValue < at.rawValue ? "checkmark.circle.fill" : s == at ? "circle.inset.filled" : "circle")
                                .foregroundStyle(s.rawValue <= at.rawValue ? Theme.accent : .secondary)
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
                Button("Walk") { Task { await openImmersive(id: SceneID.walk) } }
            }
        }
        .tint(Theme.accent)
        .onChange(of: store.current.wafer) { _, _ in store.persist() }
        .navigationTitle("Fab 1")
    }
}
