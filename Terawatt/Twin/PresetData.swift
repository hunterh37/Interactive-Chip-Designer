import Foundation

/// Rack catalog, user cases and sample sentiment from Resources/twin-presets.json.
struct PresetData: Codable, Sendable {
    struct RackPoint: Codable, Sendable { var year: Int; var kW: Double; var chips: Int; var costUSD: Double }
    struct RackClass: Codable, Sendable, Identifiable {
        var id: RackPresetID
        var title: String
        var role: String
        var points: [RackPoint]
        var prefillTokPerChip: Double
        var decodeTokPerChip: Double
        var massKg: Double
        var leadTimeWeeks: Double
    }
    struct UserCase: Codable, Sendable, Identifiable {
        var id: UserCaseID
        var title: String
        var targetUsers: Double
        var readsPerUserPerDay: Double
        var peakOutTokS: Double
        var peakInTokS: Double
        var peakTotalOut: Double { targetUsers * peakOutTokS }
        var peakTotalIn: Double { targetUsers * peakInTokS }
    }
    struct Sentiment: Codable, Sendable { var site: SiteID; var pro: Double; var con: Double; var note: String }

    var racks: [RackClass]
    var userCases: [UserCase]
    var sentiment: [Sentiment]

    func rack(_ id: RackPresetID) -> RackClass { racks.first { $0.id == id }! }
    func userCase(_ id: UserCaseID) -> UserCase { userCases.first { $0.id == id }! }
    func sentiment(_ site: SiteID) -> Sentiment? { sentiment.first { $0.site == site } }

    static func decode(_ data: Data) throws -> PresetData { try JSONDecoder().decode(PresetData.self, from: data) }

    static let shared: PresetData = {
        let url = Bundle.main.url(forResource: "twin-presets", withExtension: "json")
            ?? Bundle(for: BundleToken.self).url(forResource: "twin-presets", withExtension: "json")
        guard let url, let data = try? Data(contentsOf: url), let p = try? decode(data) else {
            fatalError("twin-presets.json missing from bundle")
        }
        return p
    }()
}

private final class BundleToken {}

enum UserCaseID: String, Codable, CaseIterable, Sendable { case A, B, C }
