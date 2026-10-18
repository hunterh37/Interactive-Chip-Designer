import SwiftUI
import RealityKit

/// Join panel shown in Home. Room code comes from the QR screen.
struct LiveJoinView: View {
    @Environment(\.openWindow) private var openWindow
    @Environment(\.openImmersiveSpace) private var openImmersive
    @State private var live = LiveSession.shared
    @State private var code = "DEMO"

    var body: some View {
        HStack(spacing: 12) {
            TextField("ROOM", text: $code).font(Theme.mono(20)).tracking(3).frame(width: 120)
                .padding(.vertical, 6).overlay(alignment: .bottom) { Rectangle().fill(Theme.dim).frame(height: 1) }
                .textInputAutocapitalization(.characters)
            Button("Live Rack") { go(.rack) }.buttonStyle(.mono)
            Button("Live Chip") { go(.chip) }.buttonStyle(.mono)
            if live.connected { Text("● \(live.room) · \(live.state?.players.count ?? 0) IN ROOM").font(Theme.mono(12)).foregroundStyle(Theme.mute) }
            if let e = live.lastError { Text("! " + e.uppercased()).font(Theme.mono(11)).tracking(1).lineLimit(1) }
        }
        .disabled(false)
    }

    private func go(_ m: LiveMode) {
        guard code.count == 4 else { return }
        Task {
            await live.join(code, mode: m)
            openWindow(id: SceneID.live)
            if m == .rack { _ = await openImmersive(id: SceneID.liveSpace) }
        }
    }
}

/// Shared builder driven by LiveSession state; `lifeSize` false scales into the volume.
struct LiveSceneView: View {
    let lifeSize: Bool
    @State private var live = LiveSession.shared
    @State private var root = Entity()

    var body: some View {
        RealityView { content in content.add(root) }
            .task(id: live.state.map { "\($0.rev)-\(live.mode.rawValue)" }) { await rebuild() }
            .ornament(attachmentAnchor: .scene(.bottomFront)) { if !lifeSize { hud } }
    }

    private func rebuild() async {
        guard let s = live.state, let cat = live.catalog else { return }
        let e: Entity = live.mode == .rack ? await LiveBuilder.room(s.rackRow, cat) : LiveBuilder.chip(s.chip, cat)
        if lifeSize { e.position = [0, 0, -1.6] }
        else if live.mode == .rack { e.scale = .init(repeating: 0.25 / max(1, Float(s.racks.count) * 0.45)); e.position = [0, -0.28, 0] }
        else { e.scale = .init(repeating: 1.2); e.position = [0, -0.2, 0] }
        root.children.removeAll(); root.addChild(e)
    }

    @ViewBuilder private var hud: some View {
        if let t = live.state?.totals {
            HStack(spacing: 20) {
                if live.mode == .rack {
                    Text("\(t.room.racks) racks"); Text(String(format: "%.1f kW", t.room.kw))
                    Text(t.room.price, format: .currency(code: "USD").precision(.fractionLength(0)))
                    Text("\(t.room.ordered) purchased")
                } else {
                    Text("\(t.chip.usedMM2) mm²"); Text("\(t.chip.tflops) TFLOPS"); Text("\(t.chip.watts) W")
                    if live.state?.chip.taped == true { Text("Taped out") }
                }
            }
            .font(Theme.mono(17, .medium).monospacedDigit()).textCase(.uppercase).foregroundStyle(Theme.fg)
            .padding(.horizontal, 24).padding(.vertical, 12).monoPanel()
        }
    }
}
