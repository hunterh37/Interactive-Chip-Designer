import SwiftUI

struct TrainingInspector: View {
    @Environment(ProjectStore.self) private var store
    @Environment(\.openImmersiveSpace) private var openImmersive

    var body: some View {
        let t = store.training
        Form {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text(t.step.title).font(.title2).fontWeight(.semibold)
                    Text(t.step.instruction).font(.body)
                    ProgressView(value: t.progress).tint(Theme.accent)
                    Text("\(t.done.count) of \(TrainStep.allCases.count)  ·  \(t.step.zoom.title)")
                        .font(.caption).foregroundStyle(.secondary)
                }
                HStack {
                    Button("Back") { store.training.back() }.disabled(t.step == .ppe)
                    Spacer()
                    Button(t.step == .campus ? "Finish" : "Done") { store.training.complete() }
                        .buttonStyle(.borderedProminent).disabled(t.finished)
                }
            }
            Section("Procedure") {
                ForEach(TrainStep.allCases, id: \.self) { s in
                    Button { store.training.jump(s) } label: {
                        HStack {
                            Image(systemName: t.done.contains(s) ? "checkmark.circle.fill" : s == t.step ? "circle.inset.filled" : "circle")
                                .foregroundStyle(t.done.contains(s) || s == t.step ? Theme.accent : .secondary)
                            Text("\(s.rawValue + 1)  \(s.title)")
                            Spacer()
                            if s.zoom != .rack { Text(s.zoom.title).font(.caption).foregroundStyle(.secondary) }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            Section {
                Button("Restart") { store.training = TrainingState() }
                Button("Walk") { Task { await openImmersive(id: SceneID.walk) } }
            }
        }
        .tint(Theme.accent)
        .navigationTitle("Rack install")
    }
}
