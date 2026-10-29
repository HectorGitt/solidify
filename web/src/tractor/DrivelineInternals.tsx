import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { gear, lathe, tube } from '@/geometry'
import { bevelGear, bevelPair } from '@/geometry/parts'
import type { PartInfo } from '@/parts/registry'
import type { Citation } from '@/content/citations'
import { Part, PartMesh } from '@/render/Part'
import { AXLE_Y, DRIVE_Y, GEARBOX, type TractorGeometry } from './geometry'
import { CLUTCH_X } from './engine'

/**
 * The working parts of the clutch, gearbox and differential, shown when you look inside each one
 * in place. They read the drive angles the tractor works out every frame (see Tractor.tsx), so the
 * clutch slips when the pedal is down, the free gears spin at their own speeds and the planet
 * pinions turn only on corners. Frame as the tractor: +X forward, Y up, +Z right.
 */
export interface DriveAngles {
  crank: number
  /** clutch driven plate */
  disc: number
  /** gearbox input shaft */
  input: number
  lay: number
  output: number
  crown: number
  /** side gears relative to the differential cage (left +, right −) */
  diff: number
  /** clutch pedal 0 (up) … 1 (down) */
  pedal: number
  /** dog collar 0 (neutral) … 1 (engaged) */
  engage: number
  /** lower-link hitch height (m) and its rate (m/s, + rising) */
  hitch: number
  hitchRate: number
  /** front-wheel steer angles about the kingpins (rad, + left) */
  steerLeft: number
  steerRight: number
}

export const newAngles = (): DriveAngles => ({ crank: 0, disc: 0, input: 0, lay: 0, output: 0, crown: 0, diff: 0, pedal: 0, engage: 1, hitch: 0.45, hitchRate: 0, steerLeft: 0, steerRight: 0 })

type Angles = MutableRefObject<DriveAngles>

/** Y-axis geometry turned to lie along +X */
const toX = (g: THREE.BufferGeometry) => g.rotateZ(-Math.PI / 2)

const INFO: Record<string, PartInfo> = {
  pressure: { summary: 'Pressure plate and cover.', role: 'Bolted to the flywheel and turning with it; the spring clamps the driven plate between the pressure plate and the flywheel face so friction carries the engine torque.' },
  diaphragm: { summary: 'Diaphragm spring.', role: 'A dished spring that supplies the clamping force. Pushing its fingers in at the centre pulls the pressure plate back and frees the driven plate.' },
  release: { summary: 'Release (throw-out) bearing and fork.', role: 'Moves forward when the pedal is pressed and pushes the spring fingers; it is a bearing because the fingers spin while the fork does not.' },
  freeGears: { summary: 'Gears running free on the main shaft.', role: 'Always in mesh with the layshaft gears but free to spin on the main shaft until the dog collar locks one of them to it. Each turns at its own speed.' },
  layGears: { summary: 'Layshaft gear cluster.', role: 'Gears fixed to the layshaft, driven by the constant-mesh pair. One for each speed.' },
  collar: { summary: 'Dog collar (selector sleeve).', role: 'Splined to the main shaft. Sliding it into the dogs on a free gear locks that gear to the shaft and selects its ratio; in the middle the box is in neutral.' },
  fork: { summary: 'Selector fork and rail.', role: 'Moved by the gear lever; the fork sits in a groove in the dog collar and slides it along the shaft.' },
  spiders: { summary: 'Planet (spider) pinions on their cross pin.', role: 'Carried round by the differential cage. Going straight they do not turn on their pin; on a corner they spin, letting the outer wheel turn faster than the inner one.' },
  sides: { summary: 'Side (sun) gears and half shafts.', role: 'Meshed with the planet pinions, each drives one half shaft. Their average speed is always the cage speed: one gains what the other loses.' },
  cage: { summary: 'Differential cage (cut open).', role: 'Bolted to the crown wheel; it carries the planet pinions round with it. Shown cut in half so the gears inside can be seen.' },
}

/* ------------------------------ the drive line itself ------------------------------ */

type Core = { a: Angles; k: (s: string) => string; G: TractorGeometry; info: PartInfo; cites?: Citation[]; explode?: [number, number, number] }

/** The clutch driven plate, turning with the disc angle (it stops when the pedal is down). */
export function ClutchPlate({ a, k, G, info, explode }: Core) {
  const g = useRef<THREE.Group>(null)
  useSimFrame(() => g.current?.rotation.set(a.current.disc, 0, 0))
  return (
    <Part id={k('clutch-disc')} name="Clutch plate" role="moving" material="friction" info={info} explode={explode}>
      <group position={[CLUTCH_X, DRIVE_Y, 0]} ref={g}>
        <PartMesh geometry={G.clutchDisc} />
        <PartMesh geometry={G.clutchCore} material="steel" />
      </group>
    </Part>
  )
}

/** Input shaft, layshaft and output shaft with the constant-mesh and selected pairs and the bevel pinion. */
export function GearTrain({ a, k, G, info, explode }: Core) {
  const input = useRef<THREE.Group>(null)
  const lay = useRef<THREE.Group>(null)
  const output = useRef<THREE.Group>(null)
  useSimFrame(() => {
    const s = a.current
    input.current?.rotation.set(s.input, 0, 0)
    lay.current?.rotation.set(s.lay, 0, 0)
    output.current?.rotation.set(s.output, 0, 0)
  })
  return (
    <Part id={k('gears')} name="Gears and shafts" role="moving" material="steel" info={info} explode={explode}>
      <group position={[0.25, DRIVE_Y, 0]} ref={input}>
        <PartMesh geometry={G.inputShaft} />
        <PartMesh geometry={G.inputPinion} position={[0.22, 0, 0]} />
      </group>
      <group position={[0.37, DRIVE_Y - GEARBOX.centre, 0]} ref={lay}>
        <PartMesh geometry={G.layShaft} />
        <PartMesh geometry={G.layGear} position={[0.1, 0, 0]} />
        <PartMesh geometry={G.laySelected} position={[-0.07, 0, 0]} />
      </group>
      <group position={[0, DRIVE_Y, 0]} ref={output}>
        <PartMesh geometry={G.pinion} />
        <PartMesh geometry={G.mainSelected} position={[0.3, 0, 0]} />
      </group>
    </Part>
  )
}

/**
 * Crown wheel with the differential. `open` cuts the cage open to show the planet pinions and
 * side gears (and adds the bevel pinion that drives it, whose own copy lives in the gearbox).
 */
export function CrownWheel({ a, k, G, info, cites, explode, open, stub }: Core & { open: boolean; stub?: number }) {
  const crown = useRef<THREE.Group>(null)
  const pinion = useRef<THREE.Group>(null)
  useSimFrame(() => {
    crown.current?.rotation.set(0, 0, -a.current.crown)
    pinion.current?.rotation.set(a.current.output, 0, 0)
  })
  return (
    <Part id={k('crown-wheel')} name="Crown wheel and differential" role="moving" material="steel" info={info} cites={cites} explode={explode}>
      <group position={[0, AXLE_Y, 0]} ref={crown}>
        <PartMesh geometry={G.crownWheel} />
        {open ? (
          <DiffInternals a={a} k={k} stub={stub} />
        ) : (
          <>
            <PartMesh geometry={G.diffCage} material="castIron" />
            <PartMesh geometry={G.halfShafts} material="forged" />
          </>
        )}
      </group>
      {open ? (
        <group position={[0, DRIVE_Y, 0]} ref={pinion}>
          <PartMesh geometry={G.pinion} />
        </group>
      ) : null}
    </Part>
  )
}

/* ------------------------------ clutch ------------------------------ */

const DIA_X = CLUTCH_X - 0.045
const RELEASE_X = CLUTCH_X - 0.13

export function ClutchInternals({ a, k }: { a: Angles; k: (s: string) => string }) {
  const G = useMemo(() => {
    const plate = toX(tube(0.2, 0.1, 0.022))
    const cover = toX(tube(0.218, 0.198, 0.06))
    const fingers: THREE.BufferGeometry[] = []
    for (let i = 0; i < 18; i++) {
      const f = new THREE.BoxGeometry(0.004, 0.14, 0.022)
      f.translate(0, 0.12, 0)
      f.rotateZ(-0.16) // dished: the inner ends sit further back
      f.rotateX((i / 18) * Math.PI * 2)
      fingers.push(f)
    }
    const ring = toX(tube(0.19, 0.17, 0.006))
    const diaphragm = mergeAll([...fingers, ring])
    const bearing = toX(tube(0.05, 0.028, 0.026))
    const forkArm = new THREE.BoxGeometry(0.016, 0.2, 0.02)
    forkArm.translate(-0.012, 0.11, 0)
    const fork = mergeAll([forkArm, new THREE.TorusGeometry(0.052, 0.006, 8, 24, Math.PI).rotateY(Math.PI / 2).translate(-0.012, 0, 0)])
    return { plate, cover, diaphragm, bearing, fork }
  }, [])
  const spin = useRef<THREE.Group>(null)
  const plate = useRef<THREE.Group>(null)
  const dia = useRef<THREE.Group>(null)
  const release = useRef<THREE.Group>(null)
  useSimFrame(() => {
    const s = a.current
    if (spin.current) spin.current.rotation.x = s.crank
    // exaggerated travel so it can be seen: plate pulls back, release bearing pushes in
    if (plate.current) plate.current.position.x = -0.012 * s.pedal
    if (dia.current) dia.current.position.x = DIA_X + 0.006 * s.pedal
    if (release.current) release.current.position.x = RELEASE_X + 0.03 * s.pedal
  })
  return (
    <>
      <group position={[0, DRIVE_Y, 0]}>
        <group ref={spin}>
          <Part id={k('pressure-plate')} name="Pressure plate and cover" role="moving" material="castIron" info={INFO.pressure} explode={[-0.15, 0, 0]}>
            <group ref={plate}>
              <PartMesh geometry={G.plate} position={[CLUTCH_X - 0.022, 0, 0]} />
            </group>
            <PartMesh geometry={G.cover} position={[CLUTCH_X - 0.01, 0, 0]} material="steelDark" />
          </Part>
          <Part id={k('diaphragm')} name="Diaphragm spring" role="moving" material="steel" info={INFO.diaphragm} explode={[-0.28, 0, 0]}>
            <group ref={dia} position={[DIA_X, 0, 0]}>
              <PartMesh geometry={G.diaphragm} />
            </group>
          </Part>
        </group>
        <Part id={k('release-bearing')} name="Release bearing and fork" role="moving" material="steel" info={INFO.release} explode={[-0.4, 0, 0]}>
          <group ref={release} position={[RELEASE_X, 0, 0]}>
            <PartMesh geometry={G.bearing} />
            <PartMesh geometry={G.fork} material="castIron" />
          </group>
        </Part>
      </group>
    </>
  )
}

/* ------------------------------ gearbox ------------------------------ */

const M = GEARBOX.module
/** the other two speeds: [main-shaft gear, layshaft gear, x] (each pair adds up to the centre distance) */
export const PAIRS: [number, number, number][] = [
  [26, 34, 0.38],
  [38, 22, 0.225],
]
const COLLAR_X = 0.34

export function GearboxInternals({ a, k }: { a: Angles; k: (s: string) => string }) {
  const G = useMemo(() => {
    const gearX = (teeth: number) => {
      const g = gear({ teeth, module: M, width: 0.03, bore: 0.012 })
      g.rotateY(Math.PI / 2)
      return g
    }
    const main = PAIRS.map(([z]) => gearX(z))
    const lay = mergeAll(PAIRS.map(([, z, x]) => gearX(z).translate(x - 0.37, 0, 0)).concat(toX(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 16)).translate(0.19 - 0.37, 0, 0)))
    const shaft = toX(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 20)).translate(0.29, 0, 0)
    const collar = toX(tube(0.042, 0.022, 0.03))
    const rail = toX(new THREE.CylinderGeometry(0.008, 0.008, 0.34, 12)).translate(0.36, 0.12, 0.06)
    const fork = mergeAll([new THREE.BoxGeometry(0.012, 0.075, 0.012).translate(0, 0.085, 0.045), new THREE.BoxGeometry(0.012, 0.012, 0.05).translate(0, 0.12, 0.05), new THREE.TorusGeometry(0.05, 0.006, 8, 24, Math.PI).rotateY(Math.PI / 2)])
    return { main, lay, shaft, collar, rail, fork }
  }, [])
  const free = useRef<(THREE.Group | null)[]>([])
  const lay = useRef<THREE.Group>(null)
  const out = useRef<THREE.Group>(null)
  const collar = useRef<THREE.Group>(null)
  const fork = useRef<THREE.Group>(null)
  useSimFrame(() => {
    const s = a.current
    PAIRS.forEach(([zm, zl], i) => {
      const g = free.current[i]
      if (g) g.rotation.x = (-s.lay * zl) / zm
    })
    if (lay.current) lay.current.rotation.x = s.lay
    if (out.current) out.current.rotation.x = s.output
    // the collar slides from the middle (neutral) onto the dogs of the selected gear behind it
    const x = COLLAR_X - 0.012 * s.engage
    if (collar.current) {
      collar.current.position.x = x
      collar.current.rotation.x = s.output
    }
    if (fork.current) fork.current.position.x = x
  })
  return (
    <>
      <Part id={k('free-gears')} name="Free-running main-shaft gears" role="moving" material="steel" info={INFO.freeGears} explode={[0, 0.3, 0]}>
        {PAIRS.map(([, , x], i) => (
          <group key={i} position={[x, DRIVE_Y, 0]} ref={(g) => void (free.current[i] = g)}>
            <PartMesh geometry={G.main[i]} />
          </group>
        ))}
        <group ref={out} position={[0, DRIVE_Y, 0]}>
          <PartMesh geometry={G.shaft} material="forged" />
        </group>
      </Part>
      <Part id={k('lay-gears')} name="Layshaft gear cluster" role="moving" material="steel" info={INFO.layGears} explode={[0, -0.3, 0]}>
        <group ref={lay} position={[0.37, DRIVE_Y - GEARBOX.centre, 0]}>
          <PartMesh geometry={G.lay} />
        </group>
      </Part>
      <Part id={k('dog-collar')} name="Dog collar" role="moving" material="steelDark" info={INFO.collar} explode={[0, 0, 0.35]}>
        <group ref={collar} position={[COLLAR_X, DRIVE_Y, 0]}>
          <PartMesh geometry={G.collar} />
        </group>
      </Part>
      <Part id={k('selector')} name="Selector fork and rail" role="static" material="castIron" info={INFO.fork} explode={[0, 0.45, 0.2]}>
        <group position={[0, DRIVE_Y, 0]}>
          <PartMesh geometry={G.rail} material="forged" />
          <group ref={fork} position={[COLLAR_X, 0, 0]}>
            <PartMesh geometry={G.fork} />
          </group>
        </group>
      </Part>
    </>
  )
}

/* ------------------------------ differential ------------------------------ */

const SPIDER = 10
const SIDE = 16
const DM = 0.0045
/** the cage sits beside the crown wheel (bolted to its flange), right of its plane */
const CAGE_Z = 0.07

/** Mount inside the crown-wheel group (the cage frame: axle along Z, turning with the crown wheel). */
export function DiffInternals({ a, k, stub = 0.22 }: { a: Angles; k: (s: string) => string; /** half-shaft stub length from the axle centre */ stub?: number }) {
  const G = useMemo(() => {
    const { pinion: gs, gear: gg } = bevelPair(SPIDER, SIDE)
    const rs = (SPIDER * DM) / 2
    const rg = (SIDE * DM) / 2
    const apS = rs / Math.tan((gs * Math.PI) / 180)
    const apG = rg / Math.tan((gg * Math.PI) / 180)
    const spider = () => bevelGear({ teeth: SPIDER, module: DM, faceWidth: 0.012, pitchAngleDeg: gs, bore: 0.008 }).translate(0, 0, -apS)
    const side = () => bevelGear({ teeth: SIDE, module: DM, faceWidth: 0.012, pitchAngleDeg: gg, bore: 0.012 }).translate(0, 0, -apG)
    // stubs of the half shafts (they carry on out through the axle housings)
    const shaft = (len: number) => new THREE.CylinderGeometry(0.03, 0.03, len, 20).rotateX(Math.PI / 2).translate(0, 0, -apG - len / 2)
    const end = stub
    const left = mergeAll([side(), shaft(end + CAGE_Z - apG)])
    const right = mergeAll([side(), shaft(end - CAGE_Z - apG)]).rotateY(Math.PI)
    const pin = new THREE.CylinderGeometry(0.008, 0.008, 2 * apS + 0.03, 12)
    // the cage, cut open: half of it, so the gears show
    const cage = lathe([[0.03, -0.09], [0.075, -0.08], [0.085, 0], [0.075, 0.08], [0.03, 0.09]], 32, 0, Math.PI).rotateX(Math.PI / 2)
    return { top: spider().rotateX(Math.PI / 2), bottom: spider().rotateX(-Math.PI / 2), left, right, pin, cage }
  }, [stub])
  const top = useRef<THREE.Group>(null)
  const bottom = useRef<THREE.Group>(null)
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  useSimFrame(() => {
    const d = a.current.diff
    // side gears turn ±d relative to the cage; the pinions spin d × side/spider teeth
    if (left.current) left.current.rotation.z = -d
    if (right.current) right.current.rotation.z = d
    const s = (d * SIDE) / SPIDER
    if (top.current) top.current.rotation.y = s
    if (bottom.current) bottom.current.rotation.y = -s
  })
  return (
    <group position={[0, 0, CAGE_Z]}>
      <Part id={k('diff-cage')} name="Differential cage" role="moving" material="castIron" info={INFO.cage} explode={false}>
        <PartMesh geometry={G.cage} />
      </Part>
      <Part id={k('spiders')} name="Planet pinions and cross pin" role="moving" material="steel" info={INFO.spiders} explode={false}>
        <PartMesh geometry={G.pin} material="forged" />
        <group ref={top}>
          <PartMesh geometry={G.top} />
        </group>
        <group ref={bottom}>
          <PartMesh geometry={G.bottom} />
        </group>
      </Part>
      <Part id={k('side-gears')} name="Side gears and half shafts" role="moving" material="steel" info={INFO.sides} explode={false}>
        <group ref={left}>
          <PartMesh geometry={G.left} />
        </group>
        <group ref={right}>
          <PartMesh geometry={G.right} />
        </group>
      </Part>
    </group>
  )
}

/** merge geometries with mismatched index/attributes (all made non-indexed, uvs dropped) */
function mergeAll(gs: THREE.BufferGeometry[]) {
  const flat = gs.map((g) => {
    const n = g.index ? g.toNonIndexed() : g.clone()
    for (const name of Object.keys(n.attributes)) if (name !== 'position' && name !== 'normal') n.deleteAttribute(name)
    if (!n.attributes.normal) n.computeVertexNormals()
    return n
  })
  const out = new THREE.BufferGeometry()
  const count = flat.reduce((s, g) => s + g.attributes.position.count, 0)
  const pos = new Float32Array(count * 3)
  const nor = new Float32Array(count * 3)
  let o = 0
  for (const g of flat) {
    pos.set(g.attributes.position.array as Float32Array, o * 3)
    nor.set(g.attributes.normal.array as Float32Array, o * 3)
    o += g.attributes.position.count
  }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  return out
}
