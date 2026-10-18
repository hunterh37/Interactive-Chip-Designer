import Foundation
import Observation

/// Mirrors server/src state for the collaborative rack + chip rooms.
struct LiveSlot: Codable, Equatable, Sendable { var id: String }
struct LiveOrder: Codable, Equatable, Sendable { var orderId: String; var price: Double }
struct LiveRack: Codable, Equatable, Sendable {
    var owner: String?; var totals: LiveRackTotals?; var rackId: String; var frame: String; var accent: String; var slots: [LiveSlot]; var ordered: LiveOrder?
}
struct LiveChip: Codable, Equatable, Sendable { var name: String; var cells: [String?]; var taped: Bool }
struct LivePlayer: Codable, Equatable, Sendable { var name: String; var kind: String; var mode: String }
struct LiveRackTotals: Codable, Equatable, Sendable { var u: Int; var capacity: Int; var kw: Double; var price: Double }
struct LiveChipTotals: Codable, Equatable, Sendable { var usedMM2: Int; var tflops: Int; var watts: Int }
struct LiveRoomTotals: Codable, Equatable, Sendable { var racks: Int; var kw: Double; var price: Double; var ordered: Int }
struct LiveTotals: Codable, Equatable, Sendable { var room: LiveRoomTotals; var chip: LiveChipTotals }
struct LiveState: Codable, Equatable, Sendable {
    /// One rack per phone player; all render in one server room row.
    var racks: [String: LiveRack]
    /// Racks in stable left-to-right order (server keeps insertion order; JSON dict order is not kept by Codable).
    var rackRow: [LiveRack] { racks.sorted { $0.key < $1.key }.map(\.value) }
    var chip: LiveChip; var players: [String: LivePlayer]; var rev: Int; var totals: LiveTotals
}

struct LiveComponent: Codable, Equatable, Sendable { var id: String; var cat: String; var name: String; var u: Int; var kw: Double; var price: Double; var color: String }
struct LiveRackFrame: Codable, Equatable, Sendable { var id: String; var name: String; var u: Int; var price: Double }
struct LiveBlock: Codable, Equatable, Sendable { var id: String; var name: String; var color: String }
struct LiveDie: Codable, Equatable, Sendable { var cols: Int; var rows: Int }
struct LiveCatalog: Codable, Equatable, Sendable {
    var racks: [LiveRackFrame]; var components: [LiveComponent]; var chipBlocks: [LiveBlock]; var die: LiveDie
}

enum LiveMode: String, Sendable { case rack, chip }

@MainActor @Observable
final class LiveSession {
    static let shared = LiveSession()
    /// Override with LIVE_API_URL in Info.plist; defaults to the Render service.
    static var apiURL: URL {
        URL(string: Bundle.main.object(forInfoDictionaryKey: "LIVE_API_URL") as? String ?? "https://chipdesigner-api.onrender.com")!
    }

    var room = "DEMO"
    var mode = LiveMode.rack
    private(set) var state: LiveState?
    private(set) var catalog: LiveCatalog?
    private(set) var connected = false
    private(set) var lastError: String?
    private var task: URLSessionWebSocketTask?
    private var generation = 0

    func join(_ code: String, mode: LiveMode) async {
        self.mode = mode
        room = code.uppercased().filter(\.isLetter).prefix(4).description
        leave()
        do {
            let (data, _) = try await URLSession.shared.data(from: Self.apiURL.appending(path: "api/catalog"))
            catalog = try JSONDecoder().decode(LiveCatalog.self, from: data)
        } catch { lastError = "catalog: \(error.localizedDescription)"; return }
        connect()
    }

    func leave() { generation += 1; task?.cancel(with: .goingAway, reason: nil); task = nil; connected = false }

    func send(_ op: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: op), let s = String(data: data, encoding: .utf8) else { return }
        task?.send(.string(s)) { _ in }
    }

    private func connect() {
        var c = URLComponents(url: Self.apiURL.appending(path: "ws"), resolvingAgainstBaseURL: false)!
        c.scheme = c.scheme == "https" ? "wss" : "ws"
        c.queryItems = [.init(name: "room", value: room), .init(name: "kind", value: "vision"),
                        .init(name: "mode", value: mode.rawValue), .init(name: "name", value: "Vision Pro")]
        let t = URLSession.shared.webSocketTask(with: c.url!)
        task = t; t.resume(); connected = true
        let gen = generation
        Task { await receive(t, gen) }
    }

    private func receive(_ t: URLSessionWebSocketTask, _ gen: Int) async {
        while gen == generation {
            do {
                let msg = try await t.receive()
                guard case .string(let s) = msg, let d = s.data(using: .utf8) else { continue }
                apply(d)
            } catch {
                connected = false
                guard gen == generation else { return }
                try? await Task.sleep(for: .seconds(1))
                if gen == generation { connect() }
                return
            }
        }
    }

    /// Decodes a server frame; internal for tests.
    func apply(_ data: Data) {
        struct Frame: Decodable { var t: String; var state: LiveState?; var error: String? }
        guard let f = try? JSONDecoder().decode(Frame.self, from: data) else { return }
        if f.t == "state", let s = f.state { state = s }
        if f.t == "error" { lastError = f.error }
    }
}
