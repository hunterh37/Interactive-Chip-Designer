import SwiftUI
import RealityKit

struct WalkView: View {
    @Environment(ProjectStore.self) private var store
    @State private var root = Entity()

    var body: some View {
        RealityView { content, attachments in
            content.add(root)
            if let hud = attachments.entity(for: "hud") {
                hud.position = [3, 1.5, 0]
                hud.orientation = simd_quatf(angle: -.pi / 2, axis: [0, 1, 0])
                content.add(hud)
            }
        } attachments: {
            Attachment(id: "hud") { HUDStrip() }
        }
        .task(id: store.current.campus) {
            let spec = store.current.campus
            let hall = await CampusBuilder.build(spec, immersive: true)
            guard !Task.isCancelled else { return }
            hall.position = [0, 0, -CampusBuilder.hotAisleZ(spec)]
            root.children.removeAll()
            root.addChild(hall)
        }
    }
}
