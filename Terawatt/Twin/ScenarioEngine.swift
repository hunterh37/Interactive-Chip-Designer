import Foundation

/// Pure scenario engine: derived metrics and constraint checks. No UI code.
/// P_facility = PUE x sum(P_rack); Racks_max = P_grid / (PUE x P_rack);
/// Cost_5yr = racks + buildings + P_facility x 43,800 h x price + launch.

struct RackSpec: Equatable, Sendable {
    var id: RackPresetID, title: String, year: Double
    var kW: Double, chips: Int, costUSD: Double
    var prefillTokPerChip: Double, decodeTokPerChip: Double, massKg: Double, leadTimeWeeks: Double
    var chipKW: Double { chips > 0 ? kW / Double(chips) : 0 }
    var usdPerKW: Double { costUSD / kW }
    /// Liquid or immersion needed above 1.5 kW per chip or 60 kW per rack (simplified).
    var needsLiquid: Bool { chipKW > 1.5 || kW > 60 }
}

enum ConstraintKind: String, CaseIterable, Sendable {
    case grid, budget, serving, cooling, latency
    var title: String {
        switch self {
        case .grid: "Grid"; case .budget: "Budget"; case .serving: "Serving"
        case .cooling: "Cooling fit"; case .latency: "Latency"
        }
    }
}

struct ConstraintResult: Equatable, Sendable {
    var kind: ConstraintKind
    var ok: Bool
    /// value / limit; > 1 fails for grid and budget, < 1 fails for serving.
    var ratio: Double
    var detail: String
    var cause: TwinFocus?
}

struct HallMetrics: Equatable, Sendable {
    var racks = 0, chips = 0
    var itKW = 0.0, rackCostUSD = 0.0, prefillTokS = 0.0, decodeTokS = 0.0, massKg = 0.0
    var maxChipKW = 0.0, leadTimeWeeks = 0.0
    var coolingFit = true
}

struct SiteMetrics: Equatable, Sendable {
    var halls: [[HallMetrics]] = []   // [building][hall]
    var itMW = 0.0, facilityMW = 0.0
    var rackCostUSD = 0.0, buildingCostUSD = 0.0, energyCostUSD = 0.0, launchCostUSD = 0.0
    var launchMassKg = 0.0, radiatorM2 = 0.0
    var prefillTokS = 0.0, decodeTokS = 0.0
    var gridRatio = 0.0, risk = 0.0, delayMonths = 0.0, waterML = 0.0, carbonT = 0.0
    var cost5yr: Double { rackCostUSD + buildingCostUSD + energyCostUSD + launchCostUSD }
}

struct TwinMetrics: Equatable, Sendable {
    var sites: [SiteMetrics] = []
    var earthFacilityMW = 0.0, offWorldMW = 0.0
    var rackCostUSD = 0.0, buildingCostUSD = 0.0, energyCostUSD = 0.0, launchCostUSD = 0.0
    var demandOutTokS = 0.0, demandInTokS = 0.0, prefillTokS = 0.0, decodeTokS = 0.0
    var constraints: [ConstraintResult] = []
    var cost5yr: Double { rackCostUSD + buildingCostUSD + energyCostUSD + launchCostUSD }
    var firstFailing: ConstraintResult? { constraints.first { !$0.ok } }
    func constraint(_ k: ConstraintKind) -> ConstraintResult? { constraints.first { $0.kind == k } }
}

enum ScenarioEngine {
    static let hours5yr = 43_800.0
    /// Two-sided radiator at 300 K, emissivity 0.9: 2 x 0.9 x 5.67e-8 x 300^4 W/m2.
    static let radiatorWPerM2 = 826.0
    static let radiatorKgPerM2 = 5.0
    static let solarKgPerKW = 7.0

    /// Rack catalog entry at `year`, linearly interpolated between year points. Nil before the first point.
    static func rack(_ id: RackPresetID, year: Double, presets: PresetData = .shared) -> RackSpec? {
        let c = presets.rack(id)
        let pts = c.points.sorted { $0.year < $1.year }
        guard let first = pts.first, year >= Double(first.year) else { return nil }
        var lo = first, hi = first
        for p in pts { if Double(p.year) <= year { lo = p; hi = p } else { hi = p; break } }
        let t = hi.year == lo.year ? 0 : (year - Double(lo.year)) / Double(hi.year - lo.year)
        func lerp(_ a: Double, _ b: Double) -> Double { a + (b - a) * t }
        return RackSpec(id: id, title: c.title, year: year,
                        kW: lerp(lo.kW, hi.kW), chips: Int(lerp(Double(lo.chips), Double(hi.chips)).rounded()),
                        costUSD: lerp(lo.costUSD, hi.costUSD),
                        prefillTokPerChip: c.prefillTokPerChip, decodeTokPerChip: c.decodeTokPerChip,
                        massKg: c.massKg, leadTimeWeeks: c.leadTimeWeeks)
    }

    static func maxRacks(gridMW: Double, pue: Double, rackKW: Double) -> Int {
        Int((gridMW * 1000 / (pue * rackKW)).rounded(.down))
    }

    static func coolingFits(_ c: CoolingKind, rack: RackSpec, location: TwinLocation) -> Bool {
        if location.offWorld { return c == .orbitalRadiators }
        switch c {
        case .orbitalRadiators: return false
        case .airChillers, .airEvaporative: return !rack.needsLiquid
        case .directLiquid, .immersion: return true
        }
    }

    static func hall(_ h: TwinHall, location: TwinLocation, year: Double, presets: PresetData = .shared) -> HallMetrics {
        var m = HallMetrics()
        for (id, n) in h.rackMix.sorted(by: { $0.key.rawValue < $1.key.rawValue }) where n > 0 {
            guard let r = rack(id, year: year, presets: presets) else { continue }
            m.racks += n; m.chips += n * r.chips
            m.itKW += Double(n) * r.kW
            m.rackCostUSD += Double(n) * r.costUSD
            m.prefillTokS += Double(n * r.chips) * r.prefillTokPerChip
            m.decodeTokS += Double(n * r.chips) * r.decodeTokPerChip
            m.massKg += Double(n) * r.massKg
            m.maxChipKW = max(m.maxChipKW, r.chipKW)
            m.leadTimeWeeks = max(m.leadTimeWeeks, r.leadTimeWeeks)
            if !coolingFits(h.cooling, rack: r, location: location) { m.coolingFit = false }
        }
        return m
    }

    static func site(_ s: TwinSite, _ sc: Scenario, presets: PresetData = .shared) -> SiteMetrics {
        var m = SiteMetrics()
        guard s.enabled else { return m }
        m.halls = s.buildings.map { b in b.halls.map { hall($0, location: s.location, year: sc.year, presets: presets) } }
        let all = m.halls.flatMap { $0 }
        let itKW = all.reduce(0) { $0 + $1.itKW }
        m.itMW = itKW / 1000
        let pue = s.location.offWorld ? CampusMath.pue(.orbitalRadiators, ambientC: 0) : sc.pue
        m.facilityMW = m.itMW * pue
        m.rackCostUSD = all.reduce(0) { $0 + $1.rackCostUSD }
        m.prefillTokS = all.reduce(0) { $0 + $1.prefillTokS }
        m.decodeTokS = all.reduce(0) { $0 + $1.decodeTokS }
        // Comms lens feeds the business case: negative sentiment raises risk, cost and delay.
        let con = presets.sentiment(s.climate)?.con ?? 0.3
        m.risk = s.location.offWorld ? 0.2 : con
        let penalty = max(0, m.risk - 0.4)
        m.delayMonths = penalty * 24
        m.buildingCostUSD = m.facilityMW * sc.buildingUSDPerMW * (1 + penalty * 0.5)
        let climate = Site.of(s.climate)
        if s.location.offWorld {
            m.radiatorM2 = m.facilityMW * 1e6 / radiatorWPerM2
            m.launchMassKg = all.reduce(0) { $0 + $1.massKg } + m.radiatorM2 * radiatorKgPerM2 + itKW * solarKgPerKW
            m.launchCostUSD = m.launchMassKg * sc.launchUSDPerKg * s.location.launchMultiple
        } else {
            m.energyCostUSD = m.facilityMW * 1000 * hours5yr * sc.energyUSDPerKWh
            m.gridRatio = s.gridAllocationMW > 0 ? m.facilityMW / s.gridAllocationMW : (m.facilityMW > 0 ? .infinity : 0)
            let cooling = s.buildings.first?.halls.first?.cooling ?? .directLiquid
            m.waterML = m.itMW * 1000 * hours5yr / 5 * CampusMath.wue(cooling, site: climate) / 1e6
            m.carbonT = m.facilityMW * hours5yr / 5 * climate.carbonKgPerMWh / 1000
        }
        return m
    }

    static func run(_ sc: Scenario, presets: PresetData = .shared) -> TwinMetrics {
        var t = TwinMetrics()
        t.sites = sc.sites.map { site($0, sc, presets: presets) }
        for (s, m) in zip(sc.sites, t.sites) {
            if s.location.offWorld { t.offWorldMW += m.facilityMW } else { t.earthFacilityMW += m.facilityMW }
            t.rackCostUSD += m.rackCostUSD; t.buildingCostUSD += m.buildingCostUSD
            t.energyCostUSD += m.energyCostUSD; t.launchCostUSD += m.launchCostUSD
            t.prefillTokS += m.prefillTokS; t.decodeTokS += m.decodeTokS
        }
        for (id, w) in sc.weights where w > 0 {
            let c = presets.userCase(id)
            t.demandOutTokS += w * c.peakTotalOut
            t.demandInTokS += w * c.peakTotalIn
        }
        t.constraints = checks(sc, t)
        return t
    }

    /// Order matches the spec: grid, budget, serving, cooling fit, latency. The first failing one is shown red.
    static func checks(_ sc: Scenario, _ t: TwinMetrics) -> [ConstraintResult] {
        var out: [ConstraintResult] = []
        // Grid: total Earth facility power at or under the cap; cause is the most loaded Earth site.
        let earth = sc.sites.indices.filter { sc.sites[$0].enabled && sc.sites[$0].location == .earth }
        let worst = earth.max { t.sites[$0].gridRatio < t.sites[$1].gridRatio }
        let gridRatio = t.earthFacilityMW / max(sc.gridCapMW, 1)
        out.append(ConstraintResult(kind: .grid, ok: gridRatio <= 1 + 1e-9, ratio: gridRatio,
                                    detail: "\(Fmt.n(t.earthFacilityMW, 0)) / \(Fmt.n(sc.gridCapMW, 0)) MW",
                                    cause: worst.map { TwinFocus(scale: .site, site: $0) }))
        // Budget.
        let costliest = sc.sites.indices.max { t.sites[$0].cost5yr < t.sites[$1].cost5yr }
        let br = t.cost5yr / max(sc.budgetUSD, 1)
        out.append(ConstraintResult(kind: .budget, ok: br <= 1 + 1e-9, ratio: br,
                                    detail: "$\(Fmt.big(t.cost5yr)) / $\(Fmt.big(sc.budgetUSD))",
                                    cause: costliest.map { TwinFocus(scale: .site, site: $0) }))
        // Serving: prefill covers input, decode covers output, at peak.
        let pr = t.demandInTokS > 0 ? t.prefillTokS / t.demandInTokS : 1
        let dr = t.demandOutTokS > 0 ? t.decodeTokS / t.demandOutTokS : 1
        let sr = min(pr, dr)
        out.append(ConstraintResult(kind: .serving, ok: sr >= 1 - 1e-9, ratio: sr,
                                    detail: "\(dr <= pr ? "decode" : "prefill") \(Fmt.n(sr * 100, 0))% of peak",
                                    cause: TwinFocus(scale: .fleet)))
        // Cooling fit: first hall whose rack mix does not suit its cooling.
        var coolCause: TwinFocus?
        outer: for (si, m) in t.sites.enumerated() {
            for (bi, b) in m.halls.enumerated() { for (hi, h) in b.enumerated() where !h.coolingFit {
                coolCause = TwinFocus(scale: .hall, site: si, building: bi, hall: hi); break outer
            } }
        }
        out.append(ConstraintResult(kind: .cooling, ok: coolCause == nil, ratio: coolCause == nil ? 0 : 1,
                                    detail: coolCause.map { "\(sc.sites[$0.site].name) hall \($0.hall + 1)" } ?? "all halls fit",
                                    cause: coolCause))
        // Latency: Moon and Mars only take batch work.
        let bad = sc.sites.indices.first { sc.sites[$0].enabled && sc.sites[$0].workload == .interactive && !sc.sites[$0].location.allowsInteractive }
        out.append(ConstraintResult(kind: .latency, ok: bad == nil, ratio: bad == nil ? 0 : 1,
                                    detail: bad.map { "\(sc.sites[$0].name) set interactive" } ?? "interactive on Earth/LEO",
                                    cause: bad.map { TwinFocus(scale: .site, site: $0) }))
        return out
    }
}

/// Maps engine metrics to a 0...1 stress value per lens (1 = at or past the limit) and a label.
enum TwinLensMath {
    static func site(_ lens: TwinLens, _ s: TwinSite, _ m: SiteMetrics, _ sc: Scenario, presets: PresetData = .shared) -> (Double, String) {
        switch lens {
        case .heat:
            let fit = m.halls.flatMap { $0 }.allSatisfy(\.coolingFit)
            return (fit ? min(m.facilityMW / 150, 0.9) : 1, "\(Fmt.n(m.facilityMW, 0)) MW heat")
        case .power:
            if s.location.offWorld { return (min(m.facilityMW / 100, 1), "\(Fmt.n(m.facilityMW, 0)) MW solar") }
            return (m.gridRatio > 1 ? 1 : m.gridRatio * 0.85, "\(Fmt.n(m.facilityMW, 0))/\(Fmt.n(s.gridAllocationMW, 0)) MW")
        case .business:
            let share = sc.budgetUSD / Double(max(sc.sites.filter(\.enabled).count, 1))
            return (min(m.cost5yr / max(share, 1), 1), "$\(Fmt.big(m.cost5yr))")
        case .manufacturing:
            let lead = m.halls.flatMap { $0 }.map(\.leadTimeWeeks).max() ?? 0
            return (min(lead / 52, 1), "\(Fmt.n(lead, 0)) wk lead")
        case .comms:
            let sen = presets.sentiment(s.climate)
            return (s.location.offWorld ? 0 : m.risk, sen.map { "\(Int($0.pro * 100))% pro" } ?? "no data")
        }
    }

    static func rack(_ lens: TwinLens, _ r: RackSpec, cooling: CoolingKind, location: TwinLocation) -> (Double, String) {
        switch lens {
        case .heat:
            let fit = ScenarioEngine.coolingFits(cooling, rack: r, location: location)
            return (fit ? min(r.chipKW / 6, 0.9) : 1, "\(Fmt.n(r.chipKW, 1)) kW/chip")
        case .power: return (min(r.kW / 800, 1), "\(Fmt.n(r.kW, 0)) kW")
        case .business: return (min(r.costUSD / 25e6, 1), "$\(Fmt.big(r.costUSD))")
        case .manufacturing: return (min(r.leadTimeWeeks / 52, 1), "\(Fmt.n(r.leadTimeWeeks, 0)) wk")
        case .comms: return (0, "")
        }
    }
}
