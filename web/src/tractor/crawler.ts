import { box, cylinder, mat4, merge, xform } from '@/geometry'
import { crawlerTrackGeometry, crawlerTrackLayout } from './CrawlerTrack'
import { TRACTOR } from './dims'
import { AXLE_Y, REAR_Z } from './geometry'

/**
 * The shared tractor as a crawler: a steel track each side in place of the wheels. The drive
 * sprocket sits on the rear axle (so the transmission is unchanged), the idler at the front, five
 * bottom rollers between; each track frame pivots on the axle and is tied across the front by an
 * equaliser bar under the front support. Frame as the tractor (+X forward, Y up, +Z right).
 */

/** front idler centre x: a little ahead of the 2WD front axle */
const IDLER_X = TRACTOR.wheelbase + 0.17
const IDLER_R = 0.38

/**
 * `gauge`: track centre to centre (default the rear wheel track, so the sprocket sits where the wheel hub
 * was). A wider gauge (a dozer's) carries the drive out through final-drive housings outboard of the axle.
 */
export function crawlerGeometry(gauge = 2 * REAR_Z) {
  const layout = crawlerTrackLayout({ xs: 0, ys: AXLE_Y, xi: IDLER_X, idlerR: IDLER_R, rollers: 5, spec: { shoeW: 0.45, rollerR: 0.1 } })
  const parts = crawlerTrackGeometry(layout, 5)
  const z = gauge / 2
  const y = layout.yb + layout.spec.rail + 2 * layout.spec.rollerR + 0.07
  // track frames: a box beam over the rollers from the sprocket hub to the idler yoke
  const frames = merge(
    ...[1, -1].flatMap((s) => [
      xform(box(IDLER_X - 0.25, 0.14, 0.16), mat4.t((IDLER_X + 0.25) / 2, y, s * z)),
      // pivot boss round the axle and the idler's recoil-spring housing
      xform(cylinder(0.12, 0.16, 32), mat4.c(mat4.t(0, AXLE_Y, s * (z - 0.2)), mat4.rx(Math.PI / 2))),
      xform(box(0.12, 0.42, 0.16), mat4.t(0.18, (AXLE_Y + y) / 2, s * (z - 0.2))),
      xform(box(0.5, 0.12, 0.12), mat4.t(IDLER_X - 0.45, y + 0.05, s * z)),
    ]),
  )
  // equaliser bar across the front, under the front support
  const equaliser = merge(xform(box(0.12, 0.1, 2 * z + 0.2), mat4.t(TRACTOR.wheelbase - 0.15, y + 0.06, 0)), xform(box(0.2, 0.18, 0.2), mat4.t(TRACTOR.wheelbase - 0.15, y + 0.15, 0)))
  // outboard final drives: a housing from each axle trumpet out to its sprocket
  const finals =
    z > REAR_Z + 0.05
      ? merge(
          ...[1, -1].flatMap((s) => [
            xform(cylinder(0.11, z - REAR_Z - 0.1, 32), mat4.c(mat4.t(0, AXLE_Y, s * (REAR_Z + z - 0.15) / 2), mat4.rx(Math.PI / 2))),
            xform(box(0.42, 0.5, 0.2), mat4.t(0, AXLE_Y - 0.08, s * (z - 0.25))),
          ]),
        )
      : null
  return { layout, parts, frames, equaliser, finals, z }
}
export type CrawlerGeometry = ReturnType<typeof crawlerGeometry>
