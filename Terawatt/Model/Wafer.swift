enum FabStation: Int, Codable, CaseIterable, Sendable {
    case waferStart, clean, deposition, resistCoat, euv, developInspect, etch, implant, metallization, cmp, waferTest, packageTest
    var title: String {
        ["Wafer start", "Clean", "Deposition", "Resist coat", "High-NA EUV", "Develop", "Etch", "Implant", "Metallization", "CMP", "Wafer test", "Package"][rawValue]
    }
}

struct WaferState: Codable, Equatable, Sendable {
    var station: FabStation = .waferStart
    var layersDone = 0
    var yield = 1.0
    var finished: Bool { station == .packageTest }
    mutating func advance() {
        guard let next = FabStation(rawValue: station.rawValue + 1) else { return }
        station = next
        if next == .euv { layersDone += 1 }
        yield *= 0.995
    }
}
