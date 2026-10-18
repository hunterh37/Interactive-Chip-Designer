import SwiftUI

struct HomeView: View {
    @Environment(ProjectStore.self) private var store
    @Environment(\.openWindow) private var openWindow
    @Environment(\.openImmersiveSpace) private var openImmersive

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("Terawatt").font(.extraLargeTitle2).fontWeight(.semibold)
            HStack(spacing: 16) {
                tile("Design Studio", "building.2") {
                    openWindow(id: SceneID.tabletop); openWindow(id: SceneID.inspector)
                }
                tile("Fab", "circle.grid.cross") { openWindow(id: SceneID.inspector) }
                tile("Chip Workshop", "cpu") { openWindow(id: SceneID.inspector) }
            }
            HStack {
                Text("Projects").font(.title3)
                Spacer()
                Button("New", systemImage: "plus") { store.new(); store.save() }
            }
            List(store.projects) { p in
                Button(p.name) { store.open(p); openWindow(id: SceneID.tabletop) }
                    .swipeActions { Button("Delete", role: .destructive) { store.delete(p) } }
            }
            .listStyle(.plain)
        }
        .padding(32)
        .tint(Theme.accent)
        .ornament(attachmentAnchor: .scene(.bottom)) { HUDStrip() }
    }

    private func tile(_ title: String, _ icon: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 40)).foregroundStyle(Theme.accent)
                Text(title).font(.headline)
            }
            .frame(maxWidth: .infinity, minHeight: 140)
        }
        .buttonStyle(.bordered)
        .buttonBorderShape(.roundedRectangle(radius: 24))
    }
}
