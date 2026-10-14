import { box, cylinder, lathe, merge } from '@/geometry'
import { BALL, COLUMN_END, WORM } from './model'
import { ballCircuit, ballNut, ballRocker, ballScrew, boxHousing as housing, dropArm, sphereProfile, steeringWheel, transferTube, worm, wormRocker } from '@/parts/lib/steeringBox'
export { ballCircuit }

/** Both boxes' parts come from the shared parts library (src/parts/lib/steeringBox.ts). */
function wheel() {
  const w = steeringWheel()
  return merge(w.rim, w.hub, w.spokes)
}

export function buildStatic() {
  const bs = ballScrew(COLUMN_END)
  const bn = ballNut()
  const br = ballRocker()
  const wm = worm(COLUMN_END)
  const wr = wormRocker()
  return {
    ballThread: bs.thread,
    ballShafts: bs.shafts,
    ballNut: bn.nut,
    ballPeg: bn.peg,
    transferTube: transferTube(),
    ballRockerArm: br.arm,
    ballRockerShaft: br.shaft,
    ballHousing: housing(-0.085, 0.085, BALL.eY - 0.03, 0.055, 0.045, [
      { at: [-0.085, 0, 0], r: 0.012, axis: 'x' },
      { at: [0.085, 0, 0], r: 0.012, axis: 'x' },
      { at: [0, BALL.eY, 0.045], r: 0.0135, axis: 'z' },
    ]),
    wormBody: wm.body,
    wormShafts: wm.shafts,
    wormRockerArm: wr.arm,
    wormPeg: wr.peg,
    wormRockerShaft: wr.shaft,
    wormHousing: housing(-0.07, 0.07, -0.04, WORM.eY + 0.03, 0.04, [
      { at: [-0.07, 0, 0], r: 0.012, axis: 'x' },
      { at: [0.07, 0, 0], r: 0.012, axis: 'x' },
      { at: [0, WORM.eY, -0.04], r: 0.0135, axis: 'z' },
    ]),
    dropArm: dropArm(),
    wheel: wheel(),
    ball: lathe(sphereProfile(BALL.ball), 16),
    levelPlug: cylinder(0.008, 0.012, 6),
    ballOil: box(0.15, 0.03, 0.072),
    wormOil: box(0.12, 0.022, 0.062),
  }
}

export type BoxesGeometry = ReturnType<typeof buildStatic>

let ready: BoxesGeometry | null = null

export async function prepareBoxesGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('steering/boxes', buildStatic)
  return ready
}

export function buildBoxesGeometry(): BoxesGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
