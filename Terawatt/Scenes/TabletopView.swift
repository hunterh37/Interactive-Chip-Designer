import SwiftUI
import RealityKit

struct TabletopView: View {
    @Environment(ProjectStore.self) private var store
    @State private var root = Entity()

    var body: some View {
        RealityView { content in
            content.add(root)
        }
        .task(id: store.current.campus) {
            let spec = store.current.campus
            let campus = await CampusBuilder.build(spec, immersive: false)
            guard !Task.isCancelled else { return }
            let span = Float(max(spec.hall.length + 30, spec.hall.width + 12) + 30)
            campus.scale = .init(repeating: 1.1 / span)
            campus.position.y = -0.28
            root.children.removeAll()
            root.addChild(campus)
        }
        .ornament(attachmentAnchor: .scene(.bottomFront)) { HUDStrip() }
    }
}
