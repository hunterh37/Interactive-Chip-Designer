import SwiftUI
import RealityKit

struct WalkView: View {
    @Environment(ProjectStore.self) private var store
    @State private var root = Entity()
    @State private var fab: FabScene?

    var body: some View {
        RealityView { content, attachments in
            content.add(root)
            if let hud = attachments.entity(for: "hud") {
                hud.position = [3, 1.5, 0]
                hud.orientation = simd_quatf(angle: -.pi / 2, axis: [0, 1, 0])
                content.add(hud)
            }
        } attachments: {
            Attachment(id: "hud") { if store.mode == .studio { HUDStrip() } }
        }
        .task(id: store.sceneKey) {
            if store.mode == .fab {
                let f = FabScene()
                await f.build(immersive: true, station: store.current.wafer.station)
                guard !Task.isCancelled else { return }
                f.root.position = [-f.startX, 0, 0]
                fab = f
                root.children.removeAll()
                root.addChild(f.root)
                return
            }
            fab = nil
            let spec = store.current.campus
            let hall = await CampusBuilder.build(spec, immersive: true)
            guard !Task.isCancelled else { return }
            hall.position = [0, 0, -CampusBuilder.hotAisleZ(spec)]
            root.children.removeAll()
            root.addChild(hall)
        }
        .onChange(of: store.current.wafer.station) { _, s in fab?.apply(s, animated: true) }
    }
}
