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
        book.group("training") { b in
            for s in TrainStep.allCases {
                b.route("step/\(s.rawValue + 1)", "Training: \(s.title)") { t in
                    var st = TrainingState()
                    while st.step != s { st.complete() }
                    store.training = st
                    store.mode = .training
                    await show(t, [SceneID.tabletop, SceneID.inspector])
                }
            }
            b.route("walk", "Training rack walk") { t in
                store.training = TrainingState(step: .tray)
                store.mode = .training
                await t.openImmersive(SceneID.walk)
                await t.wait(2); await t.ready(); await t.wait(3); t.done()
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
        // Rack to the Future demo flow (docs/Rack-to-the-Future-Technical-Spec.pdf, "Demo flow").
        book.group("twin") { b in
            @MainActor func twin(_ f: TwinFocus, lens: TwinLens = .heat, _ edit: (inout Scenario) -> Void = { _ in }) {
                store.current = Project(name: "Rack to the Future")
                var sc = Scenario(); edit(&sc)
                store.current.scenarioRaw = sc
                store.mode = .twin; store.focus = f; store.lens = lens
            }
            b.route("1-fleet", "Fleet globe, presets, case B") { t in
                twin(TwinFocus(scale: .fleet), lens: .power); await show(t, [SceneID.tabletop, SceneID.inspector])
            }
            b.route("2-site", "Earth site") { t in twin(TwinFocus(scale: .site, site: 0)); await show(t, [SceneID.tabletop, SceneID.inspector]) }
            b.route("2-building", "Building cutaway") { t in twin(TwinFocus(scale: .building, site: 0)); await show(t, [SceneID.tabletop, SceneID.inspector]) }
            b.route("2-hall", "Hall, heat lens") { t in twin(TwinFocus(scale: .hall, site: 0)); await show(t, [SceneID.tabletop, SceneID.inspector]) }
            b.route("2-walk", "Hall walk immersive") { t in
                twin(TwinFocus(scale: .hall, site: 0))
                await t.openImmersive(SceneID.walk)
                await t.wait(2); await t.ready(); await t.wait(3); t.done()
            }
            b.route("3-chip", "GPU chip 5.5 kW") { t in twin(TwinFocus(scale: .chip, site: 0)); await show(t, [SceneID.tabletop, SceneID.inspector]) }
            b.route("3-air", "Hall switched to air: cooling fails") { t in
                twin(TwinFocus(scale: .chip, site: 0)) { $0.sites[0].buildings[0].halls[0].cooling = .airChillers }
                await show(t, [SceneID.tabletop, SceneID.inspector])
            }
            b.route("4-grid", "More GPU racks: grid binds before budget") { t in
                twin(TwinFocus(scale: .fleet), lens: .power) { $0.addRacksEverywhere(.gpu, 20) }
                await show(t, [SceneID.tabletop, SceneID.inspector])
            }
            b.route("5-leo", "LEO on, business lens") { t in
                twin(TwinFocus(scale: .offWorld), lens: .business) { $0.addRacksEverywhere(.gpu, 20); $0.setOffWorld(.leo, true) }
                await show(t, [SceneID.tabletop, SceneID.inspector])
            }
            b.route("6-2025", "Same fleet in 2025") { t in
                twin(TwinFocus(scale: .fleet), lens: .power) { $0.year = 2025 }
                await show(t, [SceneID.tabletop, SceneID.inspector])
            }
        }
    }
}
#endif
