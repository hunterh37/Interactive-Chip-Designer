import Foundation
import Observation

struct Project: Codable, Identifiable, Equatable, Sendable {
    var id = UUID()
    var name: String
    var updated = Date()
    var campus = CampusSpec.default
    var chip = ChipSpec()
    var wafer = WaferState()
    var installedChips = 0
    // Optional so project files saved before Chip Workshop still decode.
    var chipStepRaw: ChipStep?
    var tapedOut: ChipSpec?
    var packaged: Bool?
    var chipStep: ChipStep { get { chipStepRaw ?? .spec } set { chipStepRaw = newValue } }
}

enum AppMode: Sendable { case studio, fab, chip }

/// Rebuild trigger for tabletop and walk scenes.
struct ChipView: Equatable { var chip: ChipSpec; var step: ChipStep; var micro: MicroLevel; var installed: Bool; var packaged: Bool }
struct SceneKey: Equatable { var mode: AppMode; var campus: CampusSpec?; var chip: ChipView? = nil }

@MainActor @Observable
final class ProjectStore {
    var projects: [Project] = []
    var current = Project(name: "Campus 1")
    var selectedRow: UUID?
    var mode = AppMode.studio
    var micro = MicroLevel.off
    var explode = false
    var sceneKey: SceneKey {
        SceneKey(mode: mode, campus: mode == .studio ? current.campus : nil,
                 chip: mode == .chip ? ChipView(chip: current.chip, step: current.chipStep, micro: micro,
                                                installed: current.installedChips > 0, packaged: current.packaged ?? false) : nil)
    }
    var delta: CampusDelta { ChipLoop.delta(current.campus, chip: current.chip, installed: current.installedChips) }

    func openChip(_ step: ChipStep? = nil) { mode = .chip; if let step { current.chipStep = step }; micro = .off }

    /// Freezes the floorplan, sets TDP from the model, hands the ChipSpec to Fab at wafer start.
    @discardableResult func tapeOut() -> Bool {
        guard let t = ChipMath.tapeOut(current.chip) else { return false }
        current.chip = t; current.tapedOut = t; current.packaged = false
        current.wafer = WaferState(); mode = .fab; persist()
        return true
    }
    func package() { guard current.tapedOut != nil else { return }; current.packaged = true; current.chipStep = .integrate; persist() }
    func install() { guard current.packaged == true else { return }; current.installedChips = ChipLoop.installCount(current.campus); persist() }
    func uninstall() { current.installedChips = 0; persist() }
    private let dir: URL

    init(directory: URL? = nil) {
        dir = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Projects", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        load()
    }

    var stats: CampusStats { CampusMath.stats(current.campus, installedChips: current.installedChips, chip: current.chip) }

    func load() {
        let files = (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
        projects = files.filter { $0.pathExtension == "json" }
            .compactMap { try? JSONDecoder().decode(Project.self, from: Data(contentsOf: $0)) }
            .sorted { $0.updated > $1.updated }
    }

    func save() {
        current.updated = .now
        guard let data = try? JSONEncoder().encode(current) else { return }
        try? data.write(to: dir.appendingPathComponent("\(current.id).json"), options: .atomic)
        load()
    }

    /// Writes the current project without reloading the list (autosave).
    func persist() {
        current.updated = .now
        guard let data = try? JSONEncoder().encode(current) else { return }
        try? data.write(to: dir.appendingPathComponent("\(current.id).json"), options: .atomic)
    }

    func new() { current = Project(name: "Campus \(projects.count + 1)") }
    func open(_ p: Project) { current = p; mode = .studio }
    func delete(_ p: Project) {
        try? FileManager.default.removeItem(at: dir.appendingPathComponent("\(p.id).json")); load()
    }
}
