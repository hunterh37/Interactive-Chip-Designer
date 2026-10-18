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
            let campus = await CampusBuilder.build(store.current.campus, racksPerRowCap: 60)
            let span = Float(max(store.current.campus.hall.length, store.current.campus.hall.width) + 60)
            campus.scale = .init(repeating: 1.1 / span)
            campus.position.y = -0.28
            root.children.removeAll()
            root.addChild(campus)
        }
        .ornament(attachmentAnchor: .scene(.bottomFront)) { HUDStrip() }
    }
}
