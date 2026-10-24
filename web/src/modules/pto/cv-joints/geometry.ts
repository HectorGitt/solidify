import { helixSpring, lathe, mat4, xform, type V2 } from '@/geometry'
import { ball, rzeppaCage, rzeppaCup, rzeppaInner, tractaSlotted, tractaSpigot, tripodePot, tripodeRoller, tripodeSpider, weissYoke } from '@/parts/lib/driveline'
import { CV } from './dims'

/**
 * CV-joint solids, from the shared parts library (src/parts/lib/driveline.ts). Lathe solids are
 * built along +Y and turned onto +X (the shaft axis). Every joint is drawn with its input member
 * on the −X side and the joint centre at the origin.
 */
const { PI } = Math
const AXIS_X = mat4.rz(-PI / 2)
const alongX = (profile: V2[], seg = 64) => xform(lathe(profile, seg), AXIS_X)

/** Solid sphere (closed lathe). */
export const sphere = ball

/* ------------------------------ build ------------------------------ */

export function buildStatic() {
  const spig = tractaSpigot(CV)
  const slot = tractaSlotted(CV)
  return {
    rzCup: rzeppaCup(CV),
    rzInner: rzeppaInner(CV),
    rzCage: rzeppaCage(CV),
    rzBall: sphere(CV.rz.ballR),
    weissYoke: weissYoke(CV),
    weissBall: sphere(CV.weiss.ballR),
    weissCentre: sphere(CV.weiss.centreR),
    tractaSpigot: spig.body,
    tractaSpigotTrunnions: spig.trunnions,
    tractaSlotted: slot.body,
    tractaSlottedTrunnions: slot.trunnions,
    triPot: tripodePot(CV),
    triSpider: tripodeSpider(CV),
    triRoller: tripodeRoller(CV),
    centreBall: sphere(0.018),
    centreSocket: alongX([[0.0185, -0.02], [0.026, -0.02], [0.026, 0.012], [0.0185, 0.012]], 40),
    centreSpring: xform(helixSpring(0.012, 0.0022, 0.05, 6), AXIS_X),
  }
}

export type CVGeometry = ReturnType<typeof buildStatic>

let ready: CVGeometry | null = null

export async function prepareCVGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('pto/cv-joints', buildStatic)
  return ready
}

export function buildCVGeometry(): CVGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
