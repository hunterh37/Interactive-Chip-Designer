#if DEBUG
import DicyaninStageDirector

@MainActor
enum DemoRoutes {
    static func register(_ book: RouteBook) {
        let store = ProjectStore.shared

        func show(_ t: Take, _ windows: [String], settle: Double = 2) async {
            for w in windows { t.openWindow(w) }
            await t.wait(settle)
            await t.ready()
            await t.wait(3)
            t.done()
        }
        func shootChipTapeOut() {
            store.current = Project(name: "Demo")
            _ = store.tapeOut()
            store.package()
        }

        book.route("home", "Home window") { t in
            store.mode = .studio
            await t.ready(); await t.wait(4); t.done()
        }
        book.group("studio") { b in
            b.route("inspector", "Design Studio inspector + tabletop") { t in
                store.mode = .studio
                await show(t, [SceneID.tabletop, SceneID.inspector])
            }
            b.route("tabletop", "Campus tabletop volume") { t in
                store.mode = .studio
                await show(t, [SceneID.tabletop])
            }
            b.route("walk", "Campus walk immersive") { t in
                store.mode = .studio
                await t.openImmersive(SceneID.walk)
                await t.wait(2); await t.ready(); await t.wait(3); t.done()
            }
        }
        book.group("fab") { b in
            for n in 1...12 {
                b.route("station/\(n)", "Fab station \(n)") { t in
                    store.current.wafer = WaferState.at(FabStation(rawValue: n - 1)!)
                    store.mode = .fab
                    await show(t, [SceneID.tabletop, SceneID.inspector])
                }
            }
        }
        book.group("chip") { b in
            b.route("floorplan", "Chip floorplan") { t in
                store.openChip(.floorplan)
                await show(t, [SceneID.tabletop, SceneID.inspector])
            }
            b.route("package", "Package explode") { t in
                shootChipTapeOut()
                store.openChip(.package)
                store.explode = true
                await show(t, [SceneID.tabletop, SceneID.inspector])
            }
            b.route("install", "Chips installed in campus") { t in
                shootChipTapeOut()
                store.install()
                store.openChip(.integrate)
                await show(t, [SceneID.tabletop, SceneID.inspector])
            }
        }
        book.group("campus") { b in
            b.route("hud", "Walk with HUD and installed chips") { t in
                shootChipTapeOut()
                store.install()
                store.mode = .studio
                await t.openImmersive(SceneID.walk)
                await t.wait(2); await t.ready(); await t.wait(3); t.done()
            }
        }
    }
}
#endif
