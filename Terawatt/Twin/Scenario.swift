import Foundation

/// Rack to the Future digital twin data model (docs/Rack-to-the-Future-Technical-Spec.pdf, "Data model").
/// Every challenge number is a default preset the scenario panel can change.

enum TwinLocation: String, Codable, CaseIterable, Sendable {
    case earth, leo, moon, mars
    var title: String { switch self { case .earth: "Earth"; case .leo: "LEO"; case .moon: "Moon"; case .mars: "Mars" } }
    var offWorld: Bool { self != .earth }
    /// Round-trip latency to users, ms.
    var roundTripMs: Double { switch self { case .earth: 40; case .leo: 40; case .moon: 2600; case .mars: 1_200_000 } }
    /// Interactive work allowed here (spec: Moon and Mars take background or batch only).
    var allowsInteractive: Bool { self == .earth || self == .leo }
    /// Launch cost multiple over the LEO $/kg price (assumption).
    var launchMultiple: Double { switch self { case .earth: 0; case .leo: 1; case .moon: 5; case .mars: 10 } }
}

enum Workload: String, Codable, CaseIterable, Sendable { case interactive, batch }

struct TwinHall: Codable, Equatable, Sendable, Identifiable {
    var id = UUID()
    var cooling: CoolingKind = .directLiquid
    var rackMix: [RackPresetID: Int] = [:]
}

struct TwinBuilding: Codable, Equatable, Sendable, Identifiable {
    var id = UUID()
    var halls: [TwinHall] = [TwinHall()]
}

struct TwinSite: Codable, Equatable, Sendable, Identifiable {
    var id = UUID()
    var name: String
    var location: TwinLocation = .earth
    /// Climate, energy price and carbon come from Site.of(climate).
    var climate: SiteID
    var gridAllocationMW: Double
    var workload: Workload = .interactive
    var enabled = true
    var buildings: [TwinBuilding] = [TwinBuilding()]
    var lat: Double = 0, lon: Double = 0
}

struct Scenario: Codable, Equatable, Sendable {
    var budgetUSD: Double = 30e9            // $5B ... $100B
    var gridCapMW: Double = 500             // 100 MW ... 2 GW, all Earth sites together
    var launchUSDPerKg: Double = 200        // $50 ... $2,000
    var pue: Double = 1.2                   // 1.05 ... 1.6 (assumption)
    var energyUSDPerKWh: Double = 0.05      // $0.02 ... $0.20 (assumption)
    var year: Double = 2035                 // 2025 ... 2035
    var caseMix: [UserCaseID: Double] = [.A: 0, .B: 1, .C: 0]
    /// Open-question assumptions, labelled in the panel.
    var buildingUSDPerMW: Double = 11e6
    var sites: [TwinSite] = Scenario.defaultSites

    static let yearRange = 2025.0...2035.0

    static let defaultSites: [TwinSite] = {
        func earth(_ name: String, _ c: SiteID, _ lat: Double, _ lon: Double, _ cool: CoolingKind = .directLiquid) -> TwinSite {
            TwinSite(name: name, climate: c, gridAllocationMW: 500.0 / 6,
                     buildings: [TwinBuilding(halls: [TwinHall(cooling: cool, rackMix: [.gpu: 60, .lpu: 20])])],
                     lat: lat, lon: lon)
        }
        func space(_ name: String, _ l: TwinLocation, _ c: SiteID) -> TwinSite {
            TwinSite(name: name, location: l, climate: c, gridAllocationMW: 0, workload: l == .leo ? .interactive : .batch,
                     enabled: false,
                     buildings: [TwinBuilding(halls: [TwinHall(cooling: .orbitalRadiators, rackMix: [.gpu: 40])])])
        }
        return [
            earth("Abilene", .texas, 32.4, -99.7),
            earth("Baie-Comeau", .quebec, 49.2, -68.1, .immersion),
            earth("Keflavík", .iceland, 64.0, -22.6),
            earth("Narvik", .norway, 68.4, 17.4),
            earth("Abu Dhabi", .uae, 24.5, 54.4),
            earth("Jurong", .singapore, 1.3, 103.7),
            space("LEO ring", .leo, .leo),
            space("Shackleton", .moon, .moon),
            space("Jezero", .mars, .mars),
        ]
    }()

    /// Normalized case weights (sum 1).
    var weights: [UserCaseID: Double] {
        let t = caseMix.values.reduce(0, +)
        guard t > 0 else { return [.B: 1] }
        return caseMix.mapValues { $0 / t }
    }

    mutating func setOffWorld(_ l: TwinLocation, _ on: Bool) {
        for i in sites.indices where sites[i].location == l { sites[i].enabled = on }
    }
    func offWorldOn(_ l: TwinLocation) -> Bool { sites.contains { $0.location == l && $0.enabled } }

    /// Adds `n` racks of one type to the first hall of every enabled Earth site.
    mutating func addRacksEverywhere(_ type: RackPresetID, _ n: Int) {
        for i in sites.indices where sites[i].enabled && sites[i].location == .earth {
            let cur = sites[i].buildings[0].halls[0].rackMix[type] ?? 0
            sites[i].buildings[0].halls[0].rackMix[type] = max(0, cur + n)
        }
    }

    /// Splits the grid cap evenly across enabled Earth sites.
    mutating func rebalanceGrid() {
        let earth = sites.indices.filter { sites[$0].enabled && sites[$0].location == .earth }
        for i in earth { sites[i].gridAllocationMW = gridCapMW / Double(max(earth.count, 1)) }
    }
}

/// Where the twin camera sits on the scale ladder.
enum TwinScale: Int, Codable, CaseIterable, Sendable, Comparable {
    case chip, rack, hall, building, site, fleet, offWorld
    static func < (a: Self, b: Self) -> Bool { a.rawValue < b.rawValue }
    var title: String {
        switch self {
        case .chip: "Chip"; case .rack: "Rack"; case .hall: "Hall"; case .building: "Building"
        case .site: "Site"; case .fleet: "Fleet"; case .offWorld: "Off-world"
        }
    }
}

/// Path into the scenario: fleet > site > building > hall > rack type > chip.
struct TwinFocus: Codable, Equatable, Sendable {
    var scale: TwinScale = .fleet
    var site = 0, building = 0, hall = 0
    var rack: RackPresetID = .gpu

    /// One level down into `child` (site/building/hall index or rack).
    func zoomedIn(site s: Int? = nil, building b: Int? = nil, hall h: Int? = nil, rack r: RackPresetID? = nil) -> TwinFocus {
        var f = self
        switch scale {
        case .offWorld, .fleet: f.scale = .site; f.site = s ?? site; f.building = 0; f.hall = 0
        case .site: f.scale = .building; f.building = b ?? 0; f.hall = 0
        case .building: f.scale = .hall; f.hall = h ?? 0
        case .hall: f.scale = .rack; f.rack = r ?? rack
        case .rack, .chip: f.scale = .chip
        }
        return f
    }
    var zoomedOut: TwinFocus {
        var f = self
        f.scale = scale == .offWorld ? .fleet : (TwinScale(rawValue: scale.rawValue + 1) ?? .fleet)
        return f
    }
}

enum TwinLens: String, Codable, CaseIterable, Sendable {
    case heat, power, business, manufacturing, comms
    var title: String {
        switch self {
        case .heat: "Heat"; case .power: "Power"; case .business: "Business"
        case .manufacturing: "Manufacturing"; case .comms: "Comms"
        }
    }
    var icon: String {
        switch self {
        case .heat: "thermometer.medium"; case .power: "bolt"; case .business: "dollarsign.circle"
        case .manufacturing: "shippingbox"; case .comms: "bubble.left.and.bubble.right"
        }
    }
}
