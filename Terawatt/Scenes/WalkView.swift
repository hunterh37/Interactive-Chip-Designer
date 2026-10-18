import SwiftUI
import RealityKit

struct WalkView: View {
    @Environment(ProjectStore.self) private var store

    var body: some View {
        RealityView { content in
            var spec = store.current.campus
            spec.rows = Array(spec.rows.prefix(6))
            let hall = await CampusBuilder.build(spec, racksPerRowCap: 40)
            hall.position = [0, 0, -2]
            content.add(hall)
        }
    }
}
