import Foundation

struct CampusStats: Equatable, Sendable {
    var rackCount = 0, gpuCount = 0
    var itMW = 0.0, facilityMW = 0.0, pue = 0.0, wue = 0.0
    var pflopsFP4 = 0.0, prefillTokS = 0.0, decodeTokS = 0.0
    var usdPerMTok = 0.0, capexUSD = 0.0, carbonTPerYr = 0.0, latencyMs = 0.0, cableKm = 0.0
    var overBudget = false
}

enum CampusMath {
    static let hoursPerYear = 8760.0

    static func rackCount(_ s: CampusSpec) -> Int { s.rows.reduce(0) { $0 + $1.racks } }

    static func itMW(_ s: CampusSpec) -> Double {
        s.rows.reduce(0) { $0 + Double($1.racks) * RackPreset.of($1.preset).kW } / 1000
    }

    static func pue(_ c: CoolingKind, ambientC: Double) -> Double {
        let base: Double = switch c {
        case .airChillers: 1.45; case .airEvaporative: 1.25; case .directLiquid: 1.12
        case .immersion: 1.06; case .orbitalRadiators: 1.03
        }
        guard c != .orbitalRadiators else { return base }
        return base + max(0, ambientC - 15) * 0.006
    }

    static func wue(_ c: CoolingKind, site: Site) -> Double {
        let f: Double = switch c {
        case .airChillers: 1.0; case .airEvaporative: 1.6; case .directLiquid: 0.3
        case .immersion: 0.1; case .orbitalRadiators: 0
        }
        return site.wueLPerKWh * f
    }

    static func gpuCount(_ s: CampusSpec) -> Int {
        s.rows.reduce(0) { $0 + $1.racks * RackPreset.of($1.preset).chips }
    }

    static func pflops(_ s: CampusSpec, chip: ChipSpec, installedChips: Int) -> Double {
        let base = s.rows.reduce(0.0) { $0 + Double($1.racks * RackPreset.of($1.preset).chips) * RackPreset.of($1.preset).pflopsFP4PerChip }
        let custom = Double(installedChips) * 60 * chip.perfFactor
        return base + custom
    }

    static func tokens(_ s: CampusSpec) -> (prefill: Double, decode: Double) {
        s.rows.reduce((0.0, 0.0)) { acc, r in
            let p = RackPreset.of(r.preset), n = Double(r.racks * p.chips)
            return (acc.0 + n * p.prefillTokPerChip, acc.1 + n * p.decodeTokPerChip)
        }
    }

    static func capex(_ s: CampusSpec) -> Double {
        let racks = s.rows.reduce(0.0) { $0 + Double($1.racks) * RackPreset.of($1.preset).costUSD }
        let facility = itMW(s) * 11e6  // shell, power, cooling per IT MW
        return racks + facility
    }

    /// Rows run along hall length; each rack gets a fixed fabric drop plus run to the row end.
    static func cableKm(_ s: CampusSpec) -> Double {
        s.rows.reduce(0.0) { acc, r in
            let rowLen = Double(r.racks) * r.pitch
            return acc + Double(r.racks) * (RackPreset.of(r.preset).chips == 0 ? 0 : 2.0 + rowLen / 2 + s.hall.width / 2) * 8
        } / 1000
    }

    static func usdPerMTok(capex: Double, facilityMW: Double, site: Site, tokS: Double) -> Double {
        guard tokS > 0 else { return 0 }
        let annual = capex / 5 + facilityMW * hoursPerYear * site.priceUSDperMWh
        let mTokPerYr = tokS * 3600 * hoursPerYear / 1e6
        return annual / mTokPerYr
    }

    static func stats(_ s: CampusSpec, installedChips: Int = 0, chip: ChipSpec = ChipSpec()) -> CampusStats {
        let site = Site.of(s.site)
        var o = CampusStats()
        o.rackCount = rackCount(s)
        o.gpuCount = gpuCount(s) + installedChips
        o.itMW = itMW(s) + Double(installedChips) * chip.tdpW / 1e6
        o.pue = pue(s.cooling, ambientC: site.ambientC) - (s.power == .dc800 ? 0.02 : 0)
        o.facilityMW = o.itMW * o.pue
        o.wue = wue(s.cooling, site: site)
        o.pflopsFP4 = pflops(s, chip: chip, installedChips: installedChips)
        let t = tokens(s)
        o.prefillTokS = t.prefill; o.decodeTokS = t.decode
        o.capexUSD = capex(s)
        o.usdPerMTok = usdPerMTok(capex: o.capexUSD, facilityMW: o.facilityMW, site: site, tokS: t.decode)
        o.carbonTPerYr = o.facilityMW * hoursPerYear * site.carbonKgPerMWh / 1000
        o.latencyMs = site.latencyMs
        o.cableKm = cableKm(s)
        o.overBudget = o.facilityMW > s.powerBudgetMW
        return o
    }

    /// 0...1, higher is better. Weights price, carbon, climate, grid cap, latency equally.
    static func score(_ site: Site, demandGW: Double) -> Double {
        let price = 1 - min(site.priceUSDperMWh / 200, 1)
        let carbon = 1 - min(site.carbonKgPerMWh / 500, 1)
        let climate = 1 - min(max(site.ambientC, 0) / 40, 1)
        let grid = min(site.gridCapGW / max(demandGW, 0.001), 1)
        let latency = 1 - min(log10(max(site.latencyMs, 1)) / 6, 1)
        return (price + carbon + climate + grid + latency) / 5
    }

    static func rankedSites(demandGW: Double) -> [(Site, Double)] {
        Site.all.map { ($0, score($0, demandGW: demandGW)) }.sorted { $0.1 > $1.1 }
    }
}
