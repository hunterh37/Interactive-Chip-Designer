import Foundation

/// Camera scale the training scene frames for a step. Rack is 1:1 close-up, campus is the full site.
enum TrainZoom: Int, Codable, Sendable, CaseIterable, Comparable {
    case rack, row, hall, campus
    static func < (a: Self, b: Self) -> Bool { a.rawValue < b.rawValue }
    var title: String { ["Rack", "Row", "Hall", "Campus"][rawValue] }
    /// Tabletop span in meters that must fit the 1.1 m volume.
    var span: Float { [2.0, 14, 0, 0][rawValue] }
}

/// New-hire rack install procedure, rack first, then zoom out to the campus.
enum TrainStep: Int, Codable, Sendable, CaseIterable {
    case ppe, locate, inspect, ground, lockout, rails, tray, power, liquid, leak, network, dress, blanking, doors, powerOn, row, hall, campus

    var title: String {
        switch self {
        case .ppe: "ESD and PPE"
        case .locate: "Find the rack"
        case .inspect: "Inspect the rack"
        case .ground: "Clip the wrist strap"
        case .lockout: "Lock out the slot"
        case .rails: "Read the U rails"
        case .tray: "Slide in the tray"
        case .power: "Connect A and B power"
        case .liquid: "Couple the liquid lines"
        case .leak: "Leak check"
        case .network: "Connect the network"
        case .dress: "Dress and label cables"
        case .blanking: "Fit blanking panels"
        case .doors: "Close the doors"
        case .powerOn: "Power on and verify"
        case .row: "The row"
        case .hall: "The hall"
        case .campus: "The campus"
        }
    }

    var instruction: String {
        switch self {
        case .ppe: "Safety shoes, ESD smock and hearing protection on. Hot aisle air exceeds 40 C."
        case .locate: "Match the ticket to the aisle sign and the rack label: hall, row, position."
        case .inspect: "Open front and rear doors. Check for damage, debris and wet manifold fittings."
        case .ground: "Clip the ESD strap to the rack grounding lug before touching any tray."
        case .lockout: "Confirm the PDU outlets for the target U are off. Hang the LOTO tag on the PDU."
        case .rails: "Count U from the bottom. Each U is 44.45 mm. The ticket names the lowest U of the tray."
        case .tray: "Two people. Align the tray on the rails and slide it in until the latches click."
        case .power: "One C19 cord to PDU A, one to PDU B. Never both cords on the same feed."
        case .liquid: "Blue supply, red return. Push each quick disconnect until it locks, then tug test."
        case .leak: "Open the manifold valves slowly. Watch the leak sensor cable for 5 minutes."
        case .network: "Fiber from the tray ports to the top-of-rack switch. Clean every LC end first."
        case .dress: "Route cables through the side managers, bend radius above 30 mm, label both ends."
        case .blanking: "Close every empty U with a blanking panel so cold air cannot bypass the servers."
        case .doors: "Close the rear door, then the front. Remove the LOTO tag. Unclip the strap."
        case .powerOn: "Switch the outlets on. Tray LEDs go green, the PDU shows load on both feeds."
        case .row: "Racks pair back to back around a contained hot aisle. Busway overhead feeds every PDU."
        case .hall: "CDU rows pump coolant to every manifold. Fiber trays run to the network core."
        case .campus: "Chiller yard and substation outside. Every rack in the campus follows this procedure."
        }
    }

    /// Child entity name in the rack prop (or training scene) to highlight.
    var focus: String? {
        switch self {
        case .ppe: "trainee-kit"
        case .locate: "aisle-sign"
        case .inspect: "rack-front-door"
        case .ground: "grounding-lug"
        case .lockout: "pdu-a"
        case .rails: "u-rail-left"
        case .tray, .powerOn: "tray-slot-09"
        case .power: "pdu-b"
        case .liquid, .leak: "manifold-supply"
        case .network: "tor-switch"
        case .dress: "cable-manager-left"
        case .blanking: "blanking-panels"
        case .doors: "rack-rear-door"
        case .row, .hall, .campus: nil
        }
    }

    var zoom: TrainZoom {
        switch self {
        case .locate, .row: .row
        case .hall: .hall
        case .campus: .campus
        default: .rack
        }
    }

    /// Prop ids that must be on stage for this step.
    var props: [String] {
        switch self {
        case .ppe: ["esd-wrist-strap", "crash-cart-kvm"]
        case .ground: ["esd-wrist-strap"]
        case .lockout: ["loto-tag"]
        case .tray: ["compute-tray-gpu", "server-lift"]
        case .power: ["power-cord-c19"]
        case .liquid, .leak: ["quick-disconnect", "leak-detection-cable"]
        case .network: ["fiber-patch-lc", "fiber-cleaner"]
        case .dress: ["cable-label", "velcro-tie"]
        case .blanking: ["blanking-panel"]
        case .locate: ["aisle-sign"]
        default: []
        }
    }
}

/// Tray U position in the rack: slot 1 starts at U 3 (two U for the ToR switch on top, PDU shelf at the bottom).
enum RackU {
    static let pitch: Float = 0.04445
    static let base: Float = 0.10
    static let trayU = 2
    static func height(u: Int) -> Float { base + Float(u - 1) * pitch }
    static func slotU(_ slot: Int) -> Int { 3 + (slot - 1) * trayU }
}

struct TrainingState: Codable, Equatable, Sendable {
    var step = TrainStep.ppe
    var done: Set<TrainStep> = []
    var finished: Bool { done.count == TrainStep.allCases.count }
    var progress: Double { Double(done.count) / Double(TrainStep.allCases.count) }

    mutating func complete() {
        done.insert(step)
        if let n = TrainStep(rawValue: step.rawValue + 1) { step = n }
    }
    mutating func back() { if let p = TrainStep(rawValue: step.rawValue - 1) { step = p } }
    mutating func jump(_ s: TrainStep) { step = s }

    /// Scene state derived from completed steps.
    var trayInstalled: Bool { done.contains(.tray) }
    var powerCabled: Bool { done.contains(.power) }
    var liquidCoupled: Bool { done.contains(.liquid) }
    var networkCabled: Bool { done.contains(.network) }
    var doorsOpen: Bool { done.contains(.inspect) && !done.contains(.doors) }
    var poweredOn: Bool { done.contains(.powerOn) }
}
