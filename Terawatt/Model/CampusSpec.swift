import Foundation

enum RoomKind: String, Codable, CaseIterable, Sendable {
    case dataHall, mepGallery, electrical, ups, cdu, chillerYard, generatorYard, networkMMR, noc, loadingDock, mantrap, office, staging
}

enum CoolingKind: String, Codable, CaseIterable, Sendable {
    case airChillers, airEvaporative, directLiquid, immersion, orbitalRadiators
    var title: String {
        switch self {
        case .airChillers: "Air + chillers"; case .airEvaporative: "Air + evaporative"
        case .directLiquid: "Direct liquid"; case .immersion: "Immersion"; case .orbitalRadiators: "Radiators"
        }
    }
}

enum PowerKind: String, Codable, CaseIterable, Sendable { case ac, dc800 }

struct HallDims: Codable, Equatable, Sendable {
    var length: Double = 200, width: Double = 80, clearHeight: Double = 10, raisedFloor = false
}

struct Room: Codable, Equatable, Identifiable, Sendable {
    var id = UUID()
    var kind: RoomKind
    var x: Double, z: Double, width: Double, depth: Double
}

struct RackRow: Codable, Equatable, Identifiable, Sendable {
    var id = UUID()
    var racks: Int = 20
    var pitch: Double = 0.6
    var preset: RackPresetID = .gpu
    var contained = true
}

struct CampusSpec: Codable, Equatable, Sendable {
    var name = "Campus"
    var site: SiteID = .texas
    var powerBudgetMW: Double = 1000
    var hall = HallDims()
    var rooms: [Room] = []
    var rows: [RackRow] = Array(repeating: RackRow(), count: 8)
    var rackPreset: RackPresetID = .gpu
    var cooling: CoolingKind = .directLiquid
    var power: PowerKind = .dc800

    static let `default`: CampusSpec = {
        var s = CampusSpec()
        s.rooms = [
            Room(kind: .dataHall, x: 0, z: 0, width: 200, depth: 80),
            Room(kind: .cdu, x: 0, z: -48, width: 200, depth: 12),
            Room(kind: .electrical, x: 0, z: 48, width: 200, depth: 12),
            Room(kind: .chillerYard, x: 120, z: 0, width: 30, depth: 80),
        ]
        s.rows = (0..<8).map { _ in RackRow(racks: 20) }
        return s
    }()
}
