import XCTest
@testable import Terawatt

/// Hits the production API (Render). Needs network.
@MainActor
final class LiveE2ETests: XCTestCase {
    private var phone: URLSessionWebSocketTask?

    override func tearDown() async throws { phone?.cancel(with: .goingAway, reason: nil); phone = nil }

    private func newRoom() async throws -> String {
        // Wakes the free-tier dyno, then uses a private 4-letter room so the DEMO lobby is untouched.
        var req = URLRequest(url: LiveSession.apiURL.appending(path: "healthz")); req.timeoutInterval = 90
        _ = try await URLSession.shared.data(for: req)
        return String((0..<4).map { _ in "QWXZ".randomElement()! })
    }

    private func wait(_ secs: Double, _ cond: () -> Bool) async -> Bool {
        let end = Date().addingTimeInterval(secs)
        while Date() < end { if cond() { return true }; try? await Task.sleep(for: .milliseconds(200)) }
        return cond()
    }

    private func joinPhone(_ code: String, mode: String) async throws {
        var c = URLComponents(url: LiveSession.apiURL.appending(path: "ws"), resolvingAgainstBaseURL: false)!
        c.scheme = "wss"
        c.queryItems = [.init(name: "room", value: code), .init(name: "kind", value: "phone"),
                        .init(name: "mode", value: mode), .init(name: "name", value: "TestPhone"), .init(name: "pid", value: "testphone")]
        let t = URLSession.shared.webSocketTask(with: c.url!)
        t.resume(); phone = t
        _ = try await t.receive() // initial state frame
    }

    private func phoneSend(_ obj: [String: Any]) async throws {
        let d = try JSONSerialization.data(withJSONObject: obj)
        try await phone?.send(.string(String(decoding: d, as: UTF8.self)))
    }

    private func joined(_ mode: LiveMode) async throws -> (LiveSession, String) {
        let code = try await newRoom()
        let s = LiveSession()
        await s.join(code, mode: mode)
        let ok = await wait(15) { s.state != nil }
        XCTAssertTrue(ok, "no state; lastError=\(s.lastError ?? "nil")")
        XCTAssertNotNil(s.catalog)
        XCTAssertFalse(s.catalog?.components.isEmpty ?? true)
        XCTAssertTrue(s.state?.players.values.contains { $0.kind == "vision" } ?? false)
        return (s, code)
    }

    func testRackFromPhone() async throws {
        let (s, code) = try await joined(.rack)
        defer { s.leave() }
        try await joinPhone(code, mode: "rack")
        try await phoneSend(["type": "rack.add", "id": "dgx-b200"])
        try await phoneSend(["type": "rack.color", "frame": "#ff0000"])
        let ok = await wait(10) { s.state?.racks["testphone"]?.slots.first?.id == "dgx-b200" && s.state?.racks["testphone"]?.frame == "#ff0000" }
        XCTAssertTrue(ok, "state=\(String(describing: s.state?.racks))")
        let e = await LiveBuilder.room(try XCTUnwrap(s.state).rackRow, try XCTUnwrap(s.catalog))
        XCTAssertFalse(e.children.isEmpty)
    }

    func testChipFromPhone() async throws {
        let (s, code) = try await joined(.chip)
        defer { s.leave() }
        try await joinPhone(code, mode: "chip")
        try await phoneSend(["type": "chip.paint", "cell": 0, "block": "tensor"])
        let ok = await wait(10) { s.state?.chip.cells.first == "tensor" }
        XCTAssertTrue(ok, "chip=\(String(describing: s.state?.chip))")
        let e = LiveBuilder.chip(try XCTUnwrap(s.state).chip, try XCTUnwrap(s.catalog))
        XCTAssertFalse(e.children.isEmpty)
    }

    func testSendOrderFromSession() async throws {
        let (s, _) = try await joined(.rack)
        defer { s.leave() }
        s.send(["type": "rack.add", "id": "dgx-b200"])
        let added = await wait(10) { (s.state?.rackRow.first?.slots.isEmpty == false) }
        XCTAssertTrue(added)
        s.send(["type": "rack.order"])
        let ok = await wait(10) { s.state?.rackRow.first?.ordered != nil }
        XCTAssertTrue(ok, "lastError=\(s.lastError ?? "nil")")
    }

    func testReconnectAfterLeave() async throws {
        let (s, code) = try await joined(.rack)
        s.send(["type": "rack.add", "id": "dgx-b200"])
        _ = await wait(10) { (s.state?.rackRow.first?.slots.isEmpty == false) }
        s.leave()
        XCTAssertFalse(s.connected)
        await s.join(code, mode: .rack)
        let ok = await wait(15) { s.connected && s.state?.rackRow.first?.slots.first?.id == "dgx-b200" }
        XCTAssertTrue(ok, "state=\(String(describing: s.state?.racks))")
        s.leave()
    }
}
