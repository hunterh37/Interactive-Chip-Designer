#if DEBUG
import DicyaninStageDirector

@MainActor
enum DemoRoutes {
    static func register(_ book: RouteBook) {
        book.route("launch", "Home window") { take in
            await take.ready()
            try await Task.sleep(for: .seconds(5))
            take.done()
        }
    }
}
#endif
