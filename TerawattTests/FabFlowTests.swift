import Testing
@testable import Terawatt

struct FabFlowTests {
    @Test func twelveUniqueTools() {
        #expect(FabStation.allCases.count == 12)
        #expect(Set(FabFlow.toolIDs).count == 12)
    }
    @Test func looks() {
        #expect(FabFlow.look(.waferStart) == .bare)
        #expect(FabFlow.look(.deposition) == .oxide)
        #expect(FabFlow.look(.etch) == .patterned)
        #expect(FabFlow.look(.packageTest) == .metal)
    }
    @Test func status() {
        #expect(FabFlow.status(of: .etch, wafer: .etch) == .running)
        #expect(FabFlow.status(of: .implant, wafer: .etch) == .waiting)
        #expect(FabFlow.status(of: .clean, wafer: .etch) == .done)
        #expect(FabFlow.status(of: .cmp, wafer: .etch) == .idle)
    }
    @Test func waferAt() {
        let w = WaferState.at(.cmp)
        #expect(w.station == .cmp)
        #expect(w.layersDone == 1)
    }
}
