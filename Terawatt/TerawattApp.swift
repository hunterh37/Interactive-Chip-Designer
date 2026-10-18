import SwiftUI
#if DEBUG
import DicyaninStageDirector
import DicyaninPerfProbe
#endif

enum SceneID {
    static let home = "home", inspector = "inspector", tabletop = "tabletop", walk = "walk"
}

@main
struct TerawattApp: App {
    @State private var store = ProjectStore.shared

    init() {
        #if DEBUG
        PerfProbe.shared.start()
        #endif
    }

    var body: some Scene {
        WindowGroup(id: SceneID.home) {
            HomeView()
                .environment(store)
                #if DEBUG
                .director(DemoRoutes.register)
                #endif
        }
        .defaultSize(width: 720, height: 520)

        WindowGroup(id: SceneID.inspector) {
            InspectorView().environment(store)
        }
        .defaultSize(width: 420, height: 640)
        .defaultWindowPlacement { content, context in
            if let home = context.windows.first(where: { $0.id == SceneID.home }) { return WindowPlacement(.trailing(home)) }
            return WindowPlacement()
        }

        WindowGroup(id: SceneID.tabletop) {
            TabletopView().environment(store)
        }
        .windowStyle(.volumetric)
        .defaultSize(width: 1.2, height: 0.6, depth: 1.2, in: .meters)

        ImmersiveSpace(id: SceneID.walk) {
            WalkView().environment(store)
        }
        .immersionStyle(selection: .constant(.full), in: .full)
    }
}
