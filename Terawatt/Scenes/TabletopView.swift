import SwiftUI
import RealityKit

struct TabletopView: View {
    @Environment(ProjectStore.self) private var store
    @State private var root = Entity()
    @State private var fab: FabScene?

    var body: some View {
        RealityView { content in
            content.add(root)
        }
        .task(id: store.sceneKey) {
            if store.mode == .fab {
                let f = FabScene()
                await f.build(immersive: false, station: store.current.wafer.station)
                guard !Task.isCancelled else { return }
                let s = 1.1 / f.length
                f.root.scale = .init(repeating: s)
                f.root.position = [-f.length / 2 * s, -0.28, 0]
                fab = f
                root.children.removeAll()
                root.addChild(f.root)
                return
            }
            fab = nil
            let spec = store.current.campus
            let campus = await CampusBuilder.build(spec, immersive: false)
            guard !Task.isCancelled else { return }
            let span = Float(max(spec.hall.length + 30, spec.hall.width + 12) + 30)
            campus.scale = .init(repeating: 1.1 / span)
            campus.position.y = -0.28
            root.children.removeAll()
            root.addChild(campus)
        }
        .onChange(of: store.current.wafer.station) { _, s in fab?.apply(s, animated: true) }
        .ornament(attachmentAnchor: .scene(.bottomFront)) { if store.mode == .studio { HUDStrip() } }
    }
}
