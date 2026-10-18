import SwiftUI
import RealityKit

struct WalkView: View {
    @Environment(ProjectStore.self) private var store
    @State private var root = Entity()
    @State private var fab: FabScene?
    @State private var training: TrainingScene?

    var body: some View {
        RealityView { content, attachments in
            content.add(root)
            if let hud = attachments.entity(for: "hud") {
                hud.position = [3, 1.5, 0]
                hud.orientation = simd_quatf(angle: -.pi / 2, axis: [0, 1, 0])
                content.add(hud)
            }
        } attachments: {
            Attachment(id: "hud") { if store.mode == .twin { TwinHUD() } else if store.mode != .fab && store.mode != .training { HUDStrip() } }
        }
        .task(id: store.sceneKey) {
            training = nil
            if store.mode == .twin, let tv = store.sceneKey.twin {
                fab = nil
                // Walk the focused hall 1:1, standing in the first cold aisle.
                let h = TwinBuilder.hall(tv.scenario, tv.focus, tv.lens)
                h.root.position = [0, 0, h.width / 2 - TwinBuilder.coldAisle / 2]
                root.children.removeAll()
                root.addChild(h.root)
                return
            }
            if store.mode == .training {
                fab = nil
                let t = TrainingScene()
                await t.build(state: store.training, campus: store.current.campus, immersive: true)
                guard !Task.isCancelled else { return }
                // Trainee stands 1.4 m in front of the rack face; hall and campus spawn in the hot aisle.
                t.root.position = t.zoom >= .hall ? .zero : [0, 0, -(TrainingScene.rackD / 2 + 1.4)]
                training = t
                root.children.removeAll()
                root.addChild(t.root)
                return
            }
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
        .onChange(of: store.training) { _, s in training?.apply(s, animated: true) }
        .onChange(of: store.current.wafer.station) { _, s in fab?.apply(s, animated: true) }
    }
}
