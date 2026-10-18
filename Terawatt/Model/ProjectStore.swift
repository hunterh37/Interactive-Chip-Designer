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
}

enum AppMode: Sendable { case studio, fab }

/// Rebuild trigger for tabletop and walk scenes.
struct SceneKey: Equatable { var mode: AppMode; var campus: CampusSpec? }

@MainActor @Observable
final class ProjectStore {
    var projects: [Project] = []
    var current = Project(name: "Campus 1")
    var selectedRow: UUID?
    var mode = AppMode.studio
    var sceneKey: SceneKey { SceneKey(mode: mode, campus: mode == .studio ? current.campus : nil) }
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
