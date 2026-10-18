import SwiftUI

struct ChipInspector: View {
    @Environment(ProjectStore.self) private var store

    var body: some View {
        @Bindable var store = store
        let c = store.current.chip, step = store.current.chipStep
        Form {
            Section("Steps") {
                ForEach(ChipStep.allCases, id: \.self) { s in
                    Button { store.current.chipStep = s } label: {
                        HStack {
                            Image(systemName: s.rawValue < step.rawValue ? "checkmark.circle.fill" : s == step ? "circle.inset.filled" : "circle")
                                .foregroundStyle(s.rawValue <= step.rawValue ? Theme.accent : .secondary)
                            Text("\(s.rawValue + 1)  \(s.title)")
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            stepBody(c, step)
            Section("Readout") {
                LabeledContent("Area", value: "\(Fmt.n(c.usedArea, 0)) / \(Fmt.n(ChipMath.limitMM2(c), 0)) mm²")
                LabeledContent("Power", value: "\(Fmt.n(ChipMath.packageWatts(c), 0)) W")
                LabeledContent("Perf", value: "\(Fmt.n(ChipMath.pflops(c), 1)) PFLOPS")
                LabeledContent("Perf/kW", value: Fmt.n(ChipMath.perfPerKW(c), 1))
                LabeledContent("Timing", value: "\(Fmt.n(ChipMath.timing(c) * 100, 0))%")
                LabeledContent("HBM stacks", value: "\(ChipMath.hbmStacks(c))")
                if !ChipMath.fits(c) { Text("Over reticle limit").foregroundStyle(Theme.accent) }
            }
            Section("Scale") {
                Picker("Micro", selection: $store.micro) {
                    ForEach(MicroLevel.allCases, id: \.self) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)
            }
        }
        .tint(Theme.accent)
        .onChange(of: store.current.chip) { _, _ in store.persist() }
        .onChange(of: store.current.chipStep) { _, _ in store.persist() }
        .navigationTitle("Chip Workshop")
    }

    @ViewBuilder private func stepBody(_ c: ChipSpec, _ step: ChipStep) -> some View {
        @Bindable var store = store
        switch step {
        case .spec:
            Section("Spec") {
                TextField("Name", text: $store.current.chip.name)
                Picker("Node", selection: $store.current.chip.nodeNM) {
                    ForEach([3.0, 2.0, 1.4, 1.0], id: \.self) { Text("\(Fmt.n($0, 1)) nm").tag($0) }
                }
                LabeledContent("Die \(Int(c.dieAreaMM2)) mm²") {
                    Slider(value: $store.current.chip.dieAreaMM2, in: 200...ChipMath.reticleMM2, step: 10)
                }
            }
        case .architecture:
            Section("Blocks") {
                ForEach(ChipBlockKind.allCases, id: \.self) { k in
                    let a = ChipMath.area(c, k)
                    Stepper("\(k.title) \(Int(a)) mm²", onIncrement: { ChipMath.setArea(&store.current.chip, k, a + 10) },
                            onDecrement: { ChipMath.setArea(&store.current.chip, k, max(a - 10, 0)) })
                }
            }
        case .floorplan, .simulate:
            EmptyView()
        case .tapeOut:
            Section { Button("Tape out") { store.tapeOut() }.disabled(!ChipMath.fits(c)) }
        case .package:
            Section {
                Toggle("Explode", isOn: $store.explode)
                Button("Package") { store.package() }.disabled(store.current.tapedOut == nil)
            }
        case .integrate:
            Section {
                if store.current.installedChips > 0 {
                    Button("Remove") { store.uninstall() }
                } else {
                    Button("Install \(ChipLoop.installCount(store.current.campus)) chips") { store.install() }
                        .disabled(store.current.packaged != true)
                }
            }
        }
    }
}
