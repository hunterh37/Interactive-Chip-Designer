import Testing
@testable import Terawatt

struct TrainingFlowTests {
    @Test func zoomMonotonicAfterRack() {
        let z = TrainStep.allCases.map(\.zoom)
        #expect(z.first == .rack)
        #expect(z.last == .campus)
        #expect(Array(z.suffix(3)) == [.row, .hall, .campus])
    }
    @Test func completeAdvancesAndFinishes() {
        var s = TrainingState()
        for _ in TrainStep.allCases { s.complete() }
        #expect(s.finished)
        #expect(s.progress == 1)
    }
    @Test func sceneFlags() {
        var s = TrainingState()
        while s.step != .doors { s.complete() }
        #expect(s.trayInstalled && s.powerCabled && s.liquidCoupled && s.networkCabled)
        #expect(s.doorsOpen)
        s.complete()
        #expect(!s.doorsOpen && !s.poweredOn)
    }
    @MainActor @Test func uMath() {
        #expect(abs(RackU.height(u: 2) - RackU.height(u: 1) - 0.04445) < 1e-5)
        #expect(RackU.slotU(1) == 3 && RackU.slotU(18) == 37)
        #expect(RackU.height(u: 48) < TrainingScene.rackH)
    }
    @MainActor @Test func everyFocusHasAnchor() {
        for s in TrainStep.allCases { if let f = s.focus { #expect(TrainingScene.anchors[f] != nil, "\(f)") } }
    }
}
