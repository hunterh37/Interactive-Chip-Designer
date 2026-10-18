enum RackPresetID: String, Codable, CaseIterable, Sendable { case gpu, lpu, air, nvl72 }

struct RackPreset: Sendable, Equatable {
    let id: RackPresetID
    let title: String
    let kW: Double
    let costUSD: Double
    let chips: Int
    let pflopsFP4PerChip: Double
    let prefillTokPerChip: Double
    let decodeTokPerChip: Double
    let propID: String

    static func of(_ id: RackPresetID) -> RackPreset { table.first { $0.id == id }! }

    static let table: [RackPreset] = [
        RackPreset(id: .gpu, title: "GPU", kW: 792, costUSD: 23.8e6, chips: 144, pflopsFP4PerChip: 60, prefillTokPerChip: 120_000, decodeTokPerChip: 8_000, propID: "rack-ai-1mw"),
        RackPreset(id: .lpu, title: "LPU", kW: 516, costUSD: 14.3e6, chips: 256, pflopsFP4PerChip: 12, prefillTokPerChip: 20_000, decodeTokPerChip: 15_000, propID: "rack-lpu"),
        RackPreset(id: .air, title: "Air", kW: 37, costUSD: 0.5e6, chips: 32, pflopsFP4PerChip: 2, prefillTokPerChip: 4_000, decodeTokPerChip: 1_500, propID: "rack-air-42u"),
        RackPreset(id: .nvl72, title: "GB200 NVL72", kW: 132, costUSD: 4e6, chips: 72, pflopsFP4PerChip: 10, prefillTokPerChip: 20_000, decodeTokPerChip: 1_200, propID: "rack-nvl72-2025"),
    ]
}
