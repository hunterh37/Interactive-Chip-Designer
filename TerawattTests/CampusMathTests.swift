import Testing
@testable import Terawatt

struct CampusMathTests {
    var spec: CampusSpec = {
        var s = CampusSpec.default
        s.rows = [RackRow(racks: 10, preset: .gpu)]
        return s
    }()

    @Test func itMW() { #expect(abs(CampusMath.itMW(spec) - 7.92) < 1e-9) }
    @Test func counts() {
        #expect(CampusMath.rackCount(spec) == 10)
        #expect(CampusMath.gpuCount(spec) == 1440)
    }
    @Test func pueOrdering() {
        #expect(CampusMath.pue(.immersion, ambientC: 10) < CampusMath.pue(.airChillers, ambientC: 10))
        #expect(CampusMath.pue(.airChillers, ambientC: 35) > CampusMath.pue(.airChillers, ambientC: 10))
    }
    @Test func facilityExceedsIT() {
        let s = CampusMath.stats(spec)
        #expect(s.facilityMW > s.itMW)
        #expect(s.capexUSD > 238e6)
    }
    @Test func carbonFreeSite() {
        var s = spec; s.site = .quebec
        var t = spec; t.site = .texas
        #expect(CampusMath.stats(s).carbonTPerYr < CampusMath.stats(t).carbonTPerYr)
    }
    @Test func budgetFlag() {
        var s = spec; s.powerBudgetMW = 1
        #expect(CampusMath.stats(s).overBudget)
    }
    @Test func installedChipsAddCompute() {
        #expect(CampusMath.stats(spec, installedChips: 100).pflopsFP4 > CampusMath.stats(spec).pflopsFP4)
    }
    @Test func costPerTokenPositive() { #expect(CampusMath.stats(spec).usdPerMTok > 0) }
    @Test func siteRanking() {
        let r = CampusMath.rankedSites(demandGW: 1)
        #expect(r.count == 9)
        #expect(r.last!.0.id == .mars)
    }
    @Test func waferAdvances() {
        var w = WaferState()
        for _ in 0..<20 { w.advance() }
        #expect(w.finished)
        #expect(w.layersDone == 1)
    }
}
