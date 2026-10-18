import Testing
@testable import Terawatt

/// Worked example and constraint checks from docs/Rack-to-the-Future-Technical-Spec.pdf.
struct TwinEngineTests {
    func one(_ mix: [RackPresetID: Int], cooling: CoolingKind = .directLiquid) -> Scenario {
        var s = Scenario()
        s.sites = [TwinSite(name: "A", climate: .texas, gridAllocationMW: 500,
                            buildings: [TwinBuilding(halls: [TwinHall(cooling: cooling, rackMix: mix)])])]
        return s
    }

    @Test func workedExampleRackCount() {
        let gpu = ScenarioEngine.rack(.gpu, year: 2035)!
        #expect(ScenarioEngine.maxRacks(gridMW: 500, pue: 1.0, rackKW: gpu.kW) == 631)
        #expect(ScenarioEngine.maxRacks(gridMW: 500, pue: 1.0, rackKW: ScenarioEngine.rack(.lpu, year: 2035)!.kW) == 968)
        #expect(abs(gpu.chipKW - 5.5) < 1e-9)
    }

    @Test func workedExampleFitsBudgetGridBinds() {
        var s = one([.gpu: 631]); s.pue = 1.0; s.buildingUSDPerMW = 11e6
        let t = ScenarioEngine.run(s)
        #expect(abs(t.rackCostUSD - 15.0178e9) < 1e6)
        #expect(abs(t.energyCostUSD - 1.0945e9) < 1e7)
        #expect(t.cost5yr < 30e9)
        #expect(t.constraint(.grid)!.ok)
        #expect(t.constraint(.budget)!.ok)
        var s2 = s; s2.sites[0].buildings[0].halls[0].rackMix[.gpu] = 632
        let t2 = ScenarioEngine.run(s2)
        #expect(!t2.constraint(.grid)!.ok)
        #expect(t2.constraint(.budget)!.ok)
        #expect(t2.firstFailing?.kind == .grid)
        #expect(t2.firstFailing?.cause == TwinFocus(scale: .site, site: 0))
    }

    @Test func airCoolingFlagsGpuRack() {
        let t = ScenarioEngine.run(one([.gpu: 10], cooling: .airChillers))
        let c = t.constraint(.cooling)!
        #expect(!c.ok)
        #expect(c.cause == TwinFocus(scale: .hall, site: 0, building: 0, hall: 0))
        #expect(ScenarioEngine.run(one([.air: 10], cooling: .airChillers)).constraint(.cooling)!.ok)
    }

    @Test func yearInterpolation() {
        #expect(ScenarioEngine.rack(.lpu, year: 2025) == nil)
        #expect(ScenarioEngine.rack(.gpu, year: 2025)!.kW == 132)
        #expect(abs(ScenarioEngine.rack(.gpu, year: 2032.5)!.kW - 596) < 1e-9)
        #expect(ScenarioEngine.rack(.gpu, year: 2035)!.costUSD == 23.8e6)
    }

    @Test func designStopsFittingOverTime() {
        var s = one([.gpu: 2000]); s.pue = 1.2
        s.year = 2025
        #expect(ScenarioEngine.run(s).constraint(.grid)!.ok)      // 2000 x 132 kW x 1.2 = 317 MW
        s.year = 2035
        #expect(!ScenarioEngine.run(s).constraint(.grid)!.ok)
    }

    @Test func offWorldLaunchAndLatency() {
        var s = Scenario()
        let base = ScenarioEngine.run(s)
        #expect(base.launchCostUSD == 0)
        s.setOffWorld(.leo, true)
        let t = ScenarioEngine.run(s)
        #expect(t.launchCostUSD > 0)
        #expect(t.earthFacilityMW == base.earthFacilityMW)
        s.setOffWorld(.mars, true)
        #expect(ScenarioEngine.run(s).constraint(.latency)!.ok)   // Mars defaults to batch
        let mars = s.sites.firstIndex { $0.location == .mars }!
        s.sites[mars].workload = .interactive
        #expect(!ScenarioEngine.run(s).constraint(.latency)!.ok)
    }

    @Test func defaultsHaveGridHeadroomAndAddingGpuRacksBindsGrid() {
        var s = Scenario()
        let t = ScenarioEngine.run(s)
        #expect(t.constraint(.grid)!.ok)
        #expect(t.constraint(.budget)!.ok)
        s.addRacksEverywhere(.gpu, 20)
        let t2 = ScenarioEngine.run(s)
        #expect(!t2.constraint(.grid)!.ok)
        #expect(t2.constraint(.budget)!.ok)
    }

    @Test func caseDemandMatchesSlides() {
        var s = Scenario(); s.caseMix = [.A: 1]
        let a = ScenarioEngine.run(s)
        #expect(abs(a.demandOutTokS - 9.6e9) < 1e6)
        #expect(abs(a.demandInTokS - 22.4e9) < 1e6)
        s.caseMix = [.B: 1]
        #expect(abs(ScenarioEngine.run(s).demandInTokS - 16.65e9) < 1e6)
    }

    @Test func zoomLadder() {
        var f = TwinFocus()
        f = f.zoomedIn(site: 2); #expect(f.scale == .site && f.site == 2)
        f = f.zoomedIn(); #expect(f.scale == .building)
        f = f.zoomedIn(hall: 0); #expect(f.scale == .hall)
        f = f.zoomedIn(rack: .lpu); #expect(f.scale == .rack && f.rack == .lpu)
        f = f.zoomedIn(); #expect(f.scale == .chip)
        f = f.zoomedOut; #expect(f.scale == .rack)
        #expect(TwinFocus(scale: .offWorld).zoomedOut.scale == .fleet)
    }

    @Test func negativeSentimentAddsCostAndDelay() {
        var s = one([.gpu: 10])
        let tx = ScenarioEngine.run(s).sites[0]
        s.sites[0].climate = .singapore
        let sg = ScenarioEngine.run(s).sites[0]
        #expect(sg.delayMonths > tx.delayMonths)
        #expect(sg.buildingCostUSD > tx.buildingCostUSD)
    }
}
