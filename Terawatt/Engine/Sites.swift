enum SiteID: String, Codable, CaseIterable, Sendable {
    case texas, quebec, iceland, norway, uae, singapore, leo, moon, mars
}

struct Site: Sendable, Equatable {
    let id: SiteID, title: String
    let priceUSDperMWh: Double, carbonKgPerMWh: Double, ambientC: Double, gridCapGW: Double, latencyMs: Double
    let wueLPerKWh: Double

    static func of(_ id: SiteID) -> Site { all.first { $0.id == id }! }
    static let all: [Site] = [
        Site(id: .texas, title: "Texas", priceUSDperMWh: 45, carbonKgPerMWh: 380, ambientC: 22, gridCapGW: 5, latencyMs: 30, wueLPerKWh: 1.8),
        Site(id: .quebec, title: "Québec", priceUSDperMWh: 35, carbonKgPerMWh: 2, ambientC: 6, gridCapGW: 3, latencyMs: 25, wueLPerKWh: 0.4),
        Site(id: .iceland, title: "Iceland", priceUSDperMWh: 30, carbonKgPerMWh: 10, ambientC: 4, gridCapGW: 1, latencyMs: 60, wueLPerKWh: 0.1),
        Site(id: .norway, title: "Norway", priceUSDperMWh: 40, carbonKgPerMWh: 20, ambientC: 6, gridCapGW: 2, latencyMs: 45, wueLPerKWh: 0.2),
        Site(id: .uae, title: "UAE", priceUSDperMWh: 50, carbonKgPerMWh: 420, ambientC: 35, gridCapGW: 5, latencyMs: 90, wueLPerKWh: 2.5),
        Site(id: .singapore, title: "Singapore", priceUSDperMWh: 110, carbonKgPerMWh: 400, ambientC: 28, gridCapGW: 0.5, latencyMs: 70, wueLPerKWh: 2.2),
        Site(id: .leo, title: "LEO", priceUSDperMWh: 200, carbonKgPerMWh: 0, ambientC: -270, gridCapGW: 1, latencyMs: 40, wueLPerKWh: 0),
        Site(id: .moon, title: "Moon", priceUSDperMWh: 900, carbonKgPerMWh: 0, ambientC: -170, gridCapGW: 0.2, latencyMs: 2600, wueLPerKWh: 0),
        Site(id: .mars, title: "Mars", priceUSDperMWh: 4000, carbonKgPerMWh: 0, ambientC: -60, gridCapGW: 0.05, latencyMs: 1_200_000, wueLPerKWh: 0),
    ]
}
