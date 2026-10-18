import SwiftUI
import RealityKit

struct TabletopView: View {
    @Environment(ProjectStore.self) private var store
    @State private var root = Entity()
    @State private var fab: FabScene?
    @State private var chipScene: ChipScene?
    @State private var training: TrainingScene?

    var body: some View {
        RealityView { content in
            content.add(root)
        }
        .task(id: store.sceneKey) {
            training = nil
            if store.mode == .training {
                fab = nil; chipScene = nil
                let t = TrainingScene()
                let spec = store.current.campus
                await t.build(state: store.training, campus: spec, immersive: false)
                guard !Task.isCancelled else { return }
                let span: Float = switch t.zoom {
                case .rack, .row: t.zoom.span
                case .hall: Float(max(spec.hall.length, spec.hall.width) + 4)
                case .campus: Float(max(spec.hall.length + 30, spec.hall.width + 12) + 30)
                }
                t.root.scale = .init(repeating: 1.1 / span)
                t.root.position.y = -0.28
                training = t
                root.children.removeAll()
                root.addChild(t.root)
                return
            }
            if store.mode == .chip {
                fab = nil
                let c = ChipScene()
                await c.build(chip: store.current.chip, step: store.current.chipStep, micro: store.micro,
                              installed: store.current.installedChips > 0, packaged: store.current.packaged ?? false)
                guard !Task.isCancelled else { return }
                c.root.position = [0, -0.28, 0]
                chipScene = c
                root.children.removeAll()
                root.addChild(c.root)
                c.setExplode(store.explode, animated: false)
                return
            }
            chipScene = nil
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
            let span = Float(max(spec.hall.length, spec.hall.width * 2) + 12)
            campus.scale = .init(repeating: 1.1 / span)
            campus.position.y = -0.28
            root.children.removeAll()
            root.addChild(campus)
        }
        .onChange(of: store.training) { _, s in training?.apply(s, animated: true) }
        .onChange(of: store.explode) { _, e in chipScene?.setExplode(e, animated: true) }
        .onChange(of: store.current.wafer.station) { _, s in fab?.apply(s, animated: true) }
        .ornament(attachmentAnchor: .scene(.bottomFront)) { if store.mode != .fab && store.mode != .training { HUDStrip() } }
    }
}
