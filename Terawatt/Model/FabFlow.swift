enum WaferLook: CaseIterable, Sendable { case bare, oxide, patterned, metal }
enum ToolStatus: Sendable { case idle, waiting, running, done }

/// Pure wafer-flow rules for Fab 1 (no RealityKit).
enum FabFlow {
    static let toolIDs = ["foup-stocker", "wet-bench", "cvd-ald-cluster", "litho-track", "euv-scanner-highna", "ebeam-metrology",
                          "plasma-etch-cluster", "ion-implanter", "pvd-cluster", "cmp-tool", "probe-station", "hybrid-bonder"]

    static func toolID(_ s: FabStation) -> String { toolIDs[s.rawValue] }

    static func look(_ s: FabStation) -> WaferLook {
        switch s {
        case .waferStart, .clean: .bare
        case .deposition, .resistCoat: .oxide
        case .euv, .developInspect, .etch, .implant: .patterned
        default: .metal
        }
    }

    /// Status tower state of `tool` while the wafer sits at `wafer`.
    static func status(of tool: FabStation, wafer: FabStation) -> ToolStatus {
        if tool == wafer { return .running }
        if tool.rawValue == wafer.rawValue + 1 { return .waiting }
        return tool.rawValue < wafer.rawValue ? .done : .idle
    }
}

extension WaferState {
    static func at(_ s: FabStation) -> WaferState {
        var w = WaferState()
        while w.station != s { w.advance() }
        return w
    }
}
