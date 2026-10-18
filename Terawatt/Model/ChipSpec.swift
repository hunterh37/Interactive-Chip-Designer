import Foundation

enum ChipBlockKind: String, Codable, CaseIterable, Sendable { case tensorCore, sram, hbmPHY, noc, io, cpo }

struct ChipBlock: Codable, Equatable, Identifiable, Sendable {
    var id = UUID()
    var kind: ChipBlockKind
    var areaMM2: Double
}

struct ChipSpec: Codable, Equatable, Sendable {
    var name = "TW-1"
    var nodeNM: Double = 1.4
    var dieAreaMM2: Double = 800
    var tdpW: Double = 1800
    var blocks: [ChipBlock] = [
        ChipBlock(kind: .tensorCore, areaMM2: 420), ChipBlock(kind: .sram, areaMM2: 180),
        ChipBlock(kind: .hbmPHY, areaMM2: 90), ChipBlock(kind: .noc, areaMM2: 50),
        ChipBlock(kind: .io, areaMM2: 30), ChipBlock(kind: .cpo, areaMM2: 30),
    ]
    var usedArea: Double { blocks.reduce(0) { $0 + $1.areaMM2 } }
    /// Scales the preset per-chip FP4 rate by tensor-core share and node.
    var perfFactor: Double {
        let tc = blocks.filter { $0.kind == .tensorCore }.reduce(0) { $0 + $1.areaMM2 }
        return (tc / 420) * (1.4 / nodeNM)
    }
}
