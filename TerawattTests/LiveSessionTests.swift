import XCTest
@testable import Terawatt

@MainActor
final class LiveSessionTests: XCTestCase {
    func testDecodesServerStateFrame() throws {
        let json = ##"{"t":"state","state":{"rack":{"rackId":"apc-ar3300","frame":"#1c1d20","accent":"#00e0a4","slots":[{"id":"dgx-b200","by":"x"}],"ordered":null},"chip":{"name":"HACK-1","cells":[null,"tensor"],"taped":false},"players":{"a":{"name":"P","kind":"phone","mode":"rack"}},"rev":3,"totals":{"rack":{"u":10,"capacity":42,"kw":14.3,"price":516890},"chip":{"usedMM2":13,"tflops":100,"watts":20}}}}"##
        let s = LiveSession()
        s.apply(Data(json.utf8))
        XCTAssertEqual(s.state?.rack.slots.first?.id, "dgx-b200")
        XCTAssertEqual(s.state?.totals.rack.capacity, 42)
        XCTAssertEqual(s.state?.chip.cells[1], "tensor")
    }

    func testHexColor() {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        LiveBuilder.color("#ff8000").getRed(&r, green: &g, blue: &b, alpha: &a)
        XCTAssertEqual(r, 1, accuracy: 0.01); XCTAssertEqual(g, 0.5, accuracy: 0.01); XCTAssertEqual(b, 0, accuracy: 0.01)
    }
}
