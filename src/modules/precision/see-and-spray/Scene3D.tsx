import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, mat4, merge, xform } from '@/geometry'
import { nozzleRow } from '@/parts/lib/implements'
import { planPass, scatterWeeds, type Plant, type SpotPlan } from '@/physics/spotspray'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { TRACTOR } from '@/tractor/dims'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { BOOM_X, BOOM_Y, ROW, STRIP, live, resetLive, specOf, useSeeSpray } from './model'

const { PI } = Math
export const pose = createTractorPose({ hitchHeight: 0.55 })
const NOZZLES = Math.round(STRIP.W / 0.5)
const START = STRIP.x0 - 4 - BOOM_X
const END = STRIP.x0 + STRIP.L + 3 - BOOM_X

const COL = {
  weed: new THREE.Color('#7ee04a'),
  dead: new THREE.Color('#8a6a2c'),
  missed: new THREE.Color('#c8ff3a'),
  crop: new THREE.Color('#2f8f3a'),
  seen: new THREE.Color('#ffd23f'),
  falseHit: new THREE.Color('#ff4d4d'),
}

interface Field {
  key: string
  weeds: Plant[]
  plan: SpotPlan
  /** weed state shown: 0 untouched, 1 dead, 2 missed */
  state: Uint8Array
  /** detection frame shown */
  marked: Uint8Array
  firesByK: { x0: number; x1: number; weed: number }[][]
  x: number
}

function keyOf() {
  const s = useSeeSpray.getState()
  return JSON.stringify({ ...s, set: 0, reset: 0 })
}

function makeField(): Field {
  const p = useSeeSpray.getState()
  const seed = 17 + p.run * 13
  const weeds = scatterWeeds(seed, STRIP.x0, STRIP.L, STRIP.W, p.density)
  const spec = specOf(p)
  const plan = planPass(spec, weeds, p.speed / 3.6, seed + 1, STRIP.x0, STRIP.L)
  const firesByK: Field['firesByK'] = Array.from({ length: NOZZLES }, () => [])
  for (const f of plan.fires) firesByK[f.k].push(f)
  return { key: keyOf(), weeds, plan, state: new Uint8Array(weeds.length), marked: new Uint8Array(weeds.length + plan.fires.length), firesByK, x: START }
}

let field: Field = makeField()
function ensure() {
  if (field.key !== keyOf()) {
    field = makeField()
    resetLive()
  }
}

/* ------------------------------ geometry ------------------------------ */

function boomGeometry() {
  const half = STRIP.W / 2
  const bar = merge(xform(box(0.08, 0.08, STRIP.W + 0.3), mat4.t(0, BOOM_Y + 0.08, 0)), xform(box(0.06, 0.05, STRIP.W + 0.2), mat4.t(0, BOOM_Y + 0.32, 0)))
  const frame: THREE.BufferGeometry[] = [bar, xform(box(0.9, 0.6, 1.0), mat4.t(0.55, BOOM_Y + 0.35, 0))]
  for (let z = -half; z <= half + 1e-6; z += 1.5) frame.push(xform(box(0.04, 0.26, 0.04), mat4.t(0, BOOM_Y + 0.2, z)))
  // nozzle bodies hang from the bottom of the boom bar (fitting at BOOM_Y + 0.04)
  const row = nozzleRow(Array.from({ length: NOZZLES }, (_, k) => -half + 0.25 + k * 0.5))
  const nozzles = [xform(merge(row.bodies, row.tips), mat4.t(0, BOOM_Y + 0.04, 0))]
  const cams: THREE.BufferGeometry[] = []
  for (let k = 0; k < NOZZLES / 2; k++) {
    const z = -half + 0.5 + k * 1
    cams.push(xform(box(0.09, 0.07, 0.07), mat4.c(mat4.t(0.12, BOOM_Y + 0.17, z), mat4.rz(-0.6))))
  }
  return { frame: merge(...frame), nozzles: merge(...nozzles), cams: merge(...cams) }
}

function plantGeometry(r: number, blades: number) {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < blades; i++) parts.push(xform(box(r * 2, 0.004, r * 0.45), mat4.c(mat4.t(0, 0.02, 0), mat4.ry((i * PI) / blades), mat4.rz(0.25))))
  return merge(...parts)
}

/* ------------------------------ scene ------------------------------ */

const INFO = {
  boom: { summary: 'Spot-spraying boom, 12 m.', role: 'Carries a camera every metre and a nozzle every 0.5 m, each with its own fast solenoid valve, so it can wet a single weed instead of the whole strip.' },
  cams: { summary: 'Cameras with on-board processors.', role: 'Look ahead of the nozzles and pick out weeds from crop and soil by colour, shape and size (a trained neural network). Detection takes a few tens of milliseconds.' },
  nozzles: { summary: 'Individually switched nozzles.', role: 'Each opens for a fraction of a second when a weed is below it. The controller times it from the travel speed and the camera’s look-ahead.' },
  weeds: { summary: 'Weeds between the rows.', role: 'Turn brown once sprayed. Bright yellow-green ones were missed — not seen, or the burst landed beside them.' },
  crop: { summary: 'Crop rows.', role: 'Left unsprayed by the spot system; a blanket sprayer wets them along with the soil.' },
  ground: { summary: 'Field strip.', role: 'Dark patches are where spray landed.' },
}

export function SeeSpray3D() {
  const st = useSeeSpray()
  ensure()
  const tractor = useRef<THREE.Group>(null)
  const weedMesh = useRef<THREE.InstancedMesh>(null)
  const wetMesh = useRef<THREE.InstancedMesh>(null)
  const markMesh = useRef<THREE.InstancedMesh>(null)
  const coneMesh = useRef<THREE.InstancedMesh>(null)
  const blanketWet = useRef<THREE.Mesh>(null)
  const geo = useMemo(boomGeometry, [])
  const weedGeo = useMemo(() => plantGeometry(1, 3), [])
  const cropGeo = useMemo(() => plantGeometry(0.09, 4), [])
  const wetGeo = useMemo(() => new THREE.BoxGeometry(1, 0.004, 1), [])
  const markGeo = useMemo(() => {
    const ring = new THREE.RingGeometry(0.85, 1, 4, 1)
    ring.rotateX(-PI / 2)
    ring.rotateY(PI / 4)
    return ring
  }, [])
  const coneGeo = useMemo(() => {
    const c = new THREE.ConeGeometry(0.28, BOOM_Y - 0.02, 16, 1, true)
    c.translate(0, -(BOOM_Y - 0.02) / 2, 0)
    return c
  }, [])
  const mats = useMemo(
    () => ({
      weed: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }),
      crop: new THREE.MeshStandardMaterial({ color: COL.crop, roughness: 0.8 }),
      wet: new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.4, transparent: true, opacity: 0.55, depthWrite: false }),
      mark: new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }),
      cone: new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    }),
    [],
  )
  const crop = useMemo(() => {
    const pts: [number, number][] = []
    for (let z = -STRIP.W / 2 + ROW.spacing / 2; z < STRIP.W / 2; z += ROW.spacing) for (let x = STRIP.x0 + 0.1; x < STRIP.x0 + STRIP.L; x += ROW.plant) pts.push([x, z])
    return pts
  }, [])
  const cropRef = useRef<THREE.InstancedMesh>(null)
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const v3 = useMemo(() => new THREE.Vector3(), [])
  const s3 = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const cm = cropRef.current
    if (!cm) return
    crop.forEach(([x, z], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 2.39) % (2 * PI))
      m.compose(v3.set(x, 0, z), q, s3.set(1, 1, 1))
      cm.setMatrixAt(i, m)
    })
    cm.instanceMatrix.needsUpdate = true
  }, [crop, m, q, v3, s3])

  // rebuild weed instances whenever the field changes
  const fieldKey = field.key
  useEffect(() => {
    const wm = weedMesh.current
    if (!wm) return
    field.weeds.forEach((w, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 1.7) % (2 * PI))
      m.compose(v3.set(w.x, 0, w.z), q, s3.set(w.r * 2.6, w.r * 2.6, w.r * 2.6))
      wm.setMatrixAt(i, m)
      wm.setColorAt(i, COL.weed)
    })
    wm.count = field.weeds.length
    wm.instanceMatrix.needsUpdate = true
    if (wm.instanceColor) wm.instanceColor.needsUpdate = true
  }, [fieldKey, m, q, v3, s3])

  useSimFrame((dt) => {
    ensure()
    const p = useSeeSpray.getState()
    const v = p.speed / 3.6
    const f = field
    if (dt > 0) f.x += v * dt
    if (f.x > END) {
      live.passes++
      useSeeSpray.setState({ run: p.run + 1 })
      return
    }
    tractor.current?.position.set(f.x, 0, 0)
    pose.rearAngle += (v * dt) / TRACTOR.rear.rolling
    pose.frontAngle += (v * dt) / TRACTOR.front.radius
    pose.engineAngle += dt * 2 * PI * 28
    pose.effects = { load: 0.35, rpm: 1900, ratedRpm: 2250, speed: v, slip: 0.03, dust: 0.25 }
    const xn = f.x + BOOM_X
    const xc = xn + p.lookAhead
    const spot = p.mode === 'spot'
    const inStrip = xn > STRIP.x0 && xn < STRIP.x0 + STRIP.L

    // weed states as the boom passes
    const wm = weedMesh.current
    let colorDirty = false
    let killed = 0
    let missed = 0
    let passed = 0
    f.weeds.forEach((w, i) => {
      if (xn < w.x + w.r) return
      passed++
      const dead = spot ? f.plan.hit[i] : true
      if (dead) killed++
      else missed++
      const s = dead ? 1 : 2
      if (f.state[i] !== s) {
        f.state[i] = s
        wm?.setColorAt(i, s === 1 ? COL.dead : COL.missed)
        colorDirty = true
      }
    })
    if (colorDirty && wm?.instanceColor) wm.instanceColor.needsUpdate = true

    // detection frames (spot mode): weeds the camera has seen, and false detections
    const mk = markMesh.current
    if (mk) {
      let n = 0
      if (spot) {
        for (const fire of f.plan.fires) {
          const x = (fire.x0 + fire.x1) / 2
          if (xc < x || xn > fire.x1 + 0.6) continue
          const w = fire.weed >= 0 ? f.weeds[fire.weed] : null
          const r = w ? w.r * 2.2 : 0.12
          m.compose(v3.set(w ? w.x : x, 0.03, w ? w.z : -STRIP.W / 2 + (fire.k + 0.5) * 0.5), q.identity(), s3.set(r, 1, r))
          mk.setMatrixAt(n, m)
          mk.setColorAt(n, fire.weed >= 0 ? COL.seen : COL.falseHit)
          n++
          if (n >= 400) break
        }
      }
      mk.count = n
      mk.instanceMatrix.needsUpdate = true
      if (mk.instanceColor) mk.instanceColor.needsUpdate = true
    }

    // nozzles firing and the patches they have wetted
    const cm = coneMesh.current
    const wet = wetMesh.current
    let nc = 0
    let nw = 0
    let sprayed = 0
    for (let k = 0; k < NOZZLES; k++) {
      const z = -STRIP.W / 2 + 0.25 + k * 0.5
      let on = false
      if (spot) {
        for (const fire of f.firesByK[k]) {
          if (xn >= fire.x0 && xn <= fire.x1) on = true
          if (xn > fire.x0 && wet && nw < 1500) {
            const x1 = Math.min(xn, fire.x1)
            m.compose(v3.set((fire.x0 + x1) / 2, 0.006, z), q.identity(), s3.set(x1 - fire.x0, 1, 0.5))
            wet.setMatrixAt(nw++, m)
            sprayed += (x1 - fire.x0) * 0.5
          }
        }
      } else on = inStrip
      if (on && cm) {
        m.compose(v3.set(xn, BOOM_Y, z), q.identity(), s3.set(1, 1, 1))
        cm.setMatrixAt(nc++, m)
      }
    }
    if (cm) {
      cm.count = nc
      cm.instanceMatrix.needsUpdate = true
    }
    if (wet) {
      wet.count = nw
      wet.instanceMatrix.needsUpdate = true
    }
    const done = Math.max(0, Math.min(STRIP.L, xn - STRIP.x0))
    if (blanketWet.current) {
      blanketWet.current.visible = !spot && done > 0
      blanketWet.current.scale.set(Math.max(0.001, done), 1, STRIP.W)
      blanketWet.current.position.set(STRIP.x0 + done / 2, 0.006, 0)
    }
    Object.assign(live, {
      progress: done / STRIP.L,
      weedsPassed: passed,
      killed,
      missed,
      falseFires: spot ? f.plan.fires.filter((x) => x.weed < 0 && x.x0 < xn).length : 0,
      sprayed: spot ? sprayed : done * STRIP.W,
      blanket: done * STRIP.W,
    })
  })

  return (
    <group>
      <group ref={tractor} position={[START, 0, 0]}>
        <Tractor pose={pose} internals={false} labels={false} paint="paintGreen" cab />
        <group position={[BOOM_X, 0, 0]}>
          <Part id="boom" name="Spot-spraying boom" role="static" material="paintYellow" cut={false} info={INFO.boom}>
            <PartMesh geometry={geo.frame} />
            <Part id="nozzles" name="Nozzles and valves" material="steelDark" info={INFO.nozzles}>
              <PartMesh geometry={geo.nozzles} />
            </Part>
            <Part id="cams" name="Cameras" material="paintBlack" info={INFO.cams}>
              <PartMesh geometry={geo.cams} />
            </Part>
          </Part>
          {/* the cameras' view line on the ground */}
          <mesh position={[st.lookAhead, 0.012, 0]}>
            <boxGeometry args={[0.12, 0.002, STRIP.W]} />
            <meshBasicMaterial color="#4fd1ff" transparent opacity={0.45} depthWrite={false} />
          </mesh>
        </group>
        <PartLabel partId="cams" at={[BOOM_X + 0.2, BOOM_Y + 0.6, 3.5]} />
        <PartLabel partId="nozzles" at={[BOOM_X, BOOM_Y - 0.1, -4.5]} />
      </group>
      <instancedMesh ref={coneMesh} args={[coneGeo, mats.cone, NOZZLES]} frustumCulled={false} />
      <Part id="weeds" name="Weeds" role="static" material="crop" cut={false} info={INFO.weeds}>
        <instancedMesh ref={weedMesh} args={[weedGeo, mats.weed, 2400]} frustumCulled={false} />
      </Part>
      <Part id="crop" name="Crop rows" role="static" material="crop" cut={false} info={INFO.crop}>
        <instancedMesh ref={cropRef} args={[cropGeo, mats.crop, crop.length]} frustumCulled={false} />
      </Part>
      <instancedMesh ref={markMesh} args={[markGeo, mats.mark, 400]} frustumCulled={false} />
      <instancedMesh ref={wetMesh} args={[wetGeo, mats.wet, 1500]} frustumCulled={false} />
      <mesh ref={blanketWet} geometry={wetGeo} material={mats.wet} visible={false} />
      <Part id="ground" name="Field strip" role="static" material="soil" cut={false} info={INFO.ground}>
        <PartMesh geometry={useMemo(() => box(1, 1, 1), [])} position={[0, -0.05, 0]} scale={[STRIP.L + 40, 0.1, STRIP.W + 30]} receiveShadow />
      </Part>
      <PartLabel partId="weeds" at={[STRIP.x0 + 8, 0.4, 2]} />
    </group>
  )
}

export function resetScene() {
  resetLive()
  field.key = ''
}
