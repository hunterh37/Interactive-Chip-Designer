import Testing
@testable import Terawatt

struct ChipLoopTests {
    var campus: CampusSpec = {
        var s = CampusSpec.default
        s.rows = [RackRow(racks: 2, preset: .gpu)]
        return s
    }()

    @Test func defaultFitsReticle() {
        let c = ChipSpec()
        #expect(ChipMath.fits(c))
        #expect(ChipMath.hbmStacks(c) == 4)
        #expect(ChipMath.timing(c) > 0 && ChipMath.timing(c) <= 1)
    }
    @Test func overReticleRejected() {
        var c = ChipSpec(); ChipMath.setArea(&c, .tensorCore, 800)
        #expect(!ChipMath.fits(c))
        #expect(ChipMath.tapeOut(c) == nil)
    }
    @Test func powerGrowsWithTensorArea() {
        var a = ChipSpec(), b = ChipSpec()
        ChipMath.setArea(&a, .tensorCore, 300); ChipMath.setArea(&b, .tensorCore, 400)
        #expect(ChipMath.dieWatts(b) > ChipMath.dieWatts(a))
        #expect(ChipMath.pflops(b) > ChipMath.pflops(a))
    }
    @Test func hbmCapsThroughput() {
        var c = ChipSpec(); ChipMath.setArea(&c, .hbmPHY, 22.5)
        #expect(ChipMath.pflops(c) == 20)
    }
    @Test func tapeOutSetsTDP() throws {
        let t = try #require(ChipMath.tapeOut(ChipSpec()))
        #expect(t.tdpW == ChipMath.packageWatts(ChipSpec()))
    }
    @Test func floorplanStripsCoverBlocks() {
        let fp = ChipMath.floorplan(ChipSpec())
        #expect(!fp.overflow)
        #expect(abs(fp.blocks.reduce(0) { $0 + $1.w * $1.h } - ChipSpec().usedArea) < 1e-6)
    }
    @Test func installDeltaPositive() throws {
        let chip = try #require(ChipMath.tapeOut(ChipSpec()))
        let n = ChipLoop.installCount(campus)
        #expect(n == 2 * 72)
        let d = ChipLoop.delta(campus, chip: chip, installed: n)
        #expect(d.pflops > 0)
        #expect(d.mw > 0)
        #expect(d.usdPerMTok != 0)
    }
    @Test func noInstallNoDelta() {
        #expect(ChipLoop.delta(campus, chip: ChipSpec(), installed: 0) == CampusDelta())
    }
}
