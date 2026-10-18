import SwiftUI

struct HomeView: View {
    @Environment(ProjectStore.self) private var store
    @Environment(\.openWindow) private var openWindow
    @Environment(\.openImmersiveSpace) private var openImmersive

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 6) {
                MonoLabel("// datacenter + silicon")
                ScrambleText(text: "TERAWATT", duration: 0.7)
                    .font(Theme.mono(56, .bold)).tracking(6)
            }
            HStack(spacing: 12) {
                tile("01", "Design Studio", "▦") {
                    store.mode = .studio
                    openWindow(id: SceneID.tabletop); openWindow(id: SceneID.inspector)
                }
                tile("02", "Fab", "◎") {
                    store.mode = .fab
                    openWindow(id: SceneID.tabletop); openWindow(id: SceneID.inspector)
                }
                tile("03", "Training", "≡") {
                    store.mode = .training; store.training = TrainingState()
                    openWindow(id: SceneID.tabletop); openWindow(id: SceneID.inspector)
                }
                tile("04", "Chip Workshop", "█") {
                    store.openChip()
                    openWindow(id: SceneID.tabletop); openWindow(id: SceneID.inspector)
                }
            }
            LiveJoinView()
            HStack(alignment: .firstTextBaseline) {
                MonoLabel("Projects [\(store.projects.count)]")
                Spacer()
                Button("+ New") { store.new(); store.save() }.buttonStyle(.mono)
            }
            List(store.projects) { p in
                Button { store.open(p); openWindow(id: SceneID.tabletop) } label: {
                    HStack { Text("> \(p.name.uppercased())").tracking(1); Spacer(); Text("→").foregroundStyle(Theme.mute) }
                        .font(Theme.mono(15))
                }
                .listRowBackground(Color.clear)
                .swipeActions { Button("Delete", role: .destructive) { store.delete(p) } }
            }
            .listStyle(.plain)
            .overlay(alignment: .top) { Rectangle().fill(Theme.line).frame(height: 1) }
        }
        .padding(32)
        .terawattStyle(field: true)
        .ornament(attachmentAnchor: .scene(.bottom)) { HUDStrip() }
    }

    private func tile(_ idx: String, _ title: String, _ glyph: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                Text(idx).font(Theme.mono(11)).foregroundStyle(Theme.mute)
                Text(String(repeating: glyph, count: 3)).font(Theme.mono(30))
                Spacer(minLength: 0)
                Text(title.uppercased()).font(Theme.mono(13, .medium)).tracking(1.6)
            }
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: 140, alignment: .leading)
            .background(Theme.bg.opacity(0.7))
            .overlay(Rectangle().stroke(Theme.dim, lineWidth: 1))
            .contentShape(Rectangle())
            .hoverEffect(.highlight)
        }
        .buttonStyle(.plain)
    }
}
