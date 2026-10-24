import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, lathe, merge, pipe } from '@/geometry'
import { jetSpeed } from '@/physics/application'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import type { MaterialKey } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { TRACTOR } from '@/tractor/dims'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { Level } from '../_shared/field'
import { aFrameMast, bar, hash, lineStrainer, nozzleParts, nozzleRow, pistonPump, pressureGauge, rod, sectionValves, sprayBoomFrame, sprayPipe, sprayRegulator, sprayTank } from '@/parts/lib/implements'
import { CropRows, Ground, PtoDriveline, type Treadmill, type V3 } from '../_appkit/three'
import {
  BOOM_WORLD_X,
  C,
  HITCH_H,
  HX,
  HY,
  LAYOUT,
  MAST_TOP,
  NOZZLE_DEMO,
  PTO_LOCAL,
  PUMP,
  live,
  nozzleZ,
  sectionOf,
  solveSpray,
  sprayAngle,
  useSprayer,
} from './model'

const { PI } = Math
export const pose = createTractorPose({ hitchHeight: HITCH_H })
const mill: Treadmill = { s: 0 }
const clock = { t: 0, pto: 0 }

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const curve = (pts: V3[]) => new THREE.CatmullRomCurve3(pts.map((p) => v3(...p)), false, 'catmullrom', 0.4)
const hose = (pts: V3[], r = 0.011) => pipe(curve(pts), r, r * 0.6, 40, 10)

/** ISO nozzle colour code by flow at 3 bar (beyond notes: the notes mention colour-coded nozzles only for ULV). */
export const NOZZLE_SIZES: { q3: number; iso: string; mat: MaterialKey }[] = [
  { q3: 0.4, iso: '01', mat: 'paintOrange' },
  { q3: 0.6, iso: '015', mat: 'paintGreen' },
  { q3: 0.8, iso: '02', mat: 'paintYellow' },
  { q3: 1.2, iso: '03', mat: 'paintBlue' },
  { q3: 1.6, iso: '04', mat: 'paintRed' },
  { q3: 2.4, iso: '06', mat: 'paintGrey' },
  { q3: 3.2, iso: '08', mat: 'nylon' },
]
const tipMaterial = (q3: number) => NOZZLE_SIZES.reduce((a, b) => (Math.abs(b.q3 - q3) < Math.abs(a.q3 - q3) ? b : a)).mat

const INFO = {
  sprayer: {
    summary: 'Tractor-mounted boom sprayer.',
    role: 'A tank and a PTO-driven pump deliver the pressurised liquid to a long boom with nozzles at set spacings along it. The essential parts are the tank, pump and nozzles; relief valve, gauge, boom, cut-off valves and filters are added.',
  },
  frame: { summary: 'Sprayer frame and A-frame mast.', role: 'Carries the tank, pump and boom on the three-point linkage: two lower-link pins and the top-link pin.' },
  tank: {
    summary: 'Spray tank, 600 L, polyethylene.',
    role: 'Carries and stores the chemical mixed with the carrier (water). Usually plastic or fibreglass so the chemical cannot corrode it.',
    details: 'Half-fill with water before adding concentrate, never put concentrate into an empty tank.',
  },
  liquid: { summary: 'Spray liquid (water carrier + chemical).', role: 'A solution, suspension or emulsion. A suspension needs constant agitation to stop the powder settling out. The level falls as you spray.' },
  tankStrainer: { summary: 'Basket strainer in the filling hole (filter 1 of 3).', role: 'Filters are fitted at the tank filling hole, before the pump and in each nozzle so dirt cannot block the nozzles. Blocked filters are a major source of trouble.' },
  agitator: { summary: 'Hydraulic agitator jet.', role: 'The relief-valve bypass flow returns through this jet near the tank bottom and keeps suspensions and emulsions mixed.', details: 'A suspension needs constant agitation.' },
  lineStrainer: { summary: 'Suction-line strainer (filter 2 of 3), clear bowl.', role: 'Traps particles before they reach the pump.' },
  pump: {
    summary: 'Twin-piston pump with air chamber, PTO-driven at 540 rpm.',
    role: 'Gives the liquid its pressure. Piston/plunger pumps are reciprocating and usually have an air chamber to level out the pulsations in output. Positive displacement: it delivers its full flow whatever the nozzles take, so it needs a relief valve.',
    details: 'Here 2 × Ø42 mm × 24 mm stroke, volumetric efficiency 0.9 → about 34 L/min at 540 rpm (typical values). Other types: gear (rotary), centrifugal and diaphragm pumps.',
  },
  pumpShaft: { summary: 'Pump shaft with two eccentrics, 180° apart.', role: 'Each eccentric drives one piston up and down once per revolution.' },
  pistons: { summary: 'Pump pistons.', role: 'Draw liquid in through the inlet valve on the down-stroke and push it out through the delivery valve on the up-stroke.' },
  airChamber: { summary: 'Air chamber.', role: 'The trapped air is compressed by each delivery pulse and expands between them, smoothing the flow to the boom.' },
  regulator: {
    summary: 'Pressure-relief valve (pressure regulator).',
    role: 'Sets and maintains the required pressure. When the line pressure reaches the spring setting the poppet lifts and the surplus pump flow returns to the tank — protecting the pump and holding the nozzle pressure steady.',
  },
  reliefSpring: { summary: 'Relief-valve spring.', role: 'Its preload, set by the knob, fixes the pressure at which the poppet lifts.' },
  poppet: { summary: 'Relief poppet.', role: 'Lifts off its seat by an amount that passes exactly the excess flow.' },
  gauge: { summary: 'Pressure gauge.', role: 'On the delivery side of the pump, to monitor the working pressure.' },
  manifold: { summary: 'Control (cut-off) valves, one per boom section.', role: 'Regulate the flow and switch each section on or off, e.g. at headlands or to avoid overlaps.' },
  hoses: { summary: 'Suction, delivery, bypass and boom-feed hoses.' },
  boom: { summary: 'Spray boom (three sections).', role: 'The tubular frame the nozzles are attached to, at adjustable distances along it. The boom height and nozzle spacing must suit the spray angle so the fans overlap evenly.' },
  liftFrame: { summary: 'Boom lift frame.', role: 'The boom carriage slides up and down it to set the boom height.' },
  sprayPipe: { summary: 'Spray pipe (stainless).', role: 'Carries liquid from the section valves to the nozzle bodies.' },
  nozzles: {
    summary: 'Nozzle bodies with colour-coded tips.',
    role: 'A nozzle is a restricting device that breaks the liquid stream into droplets. The orifice diameter usually designates the nozzle size; flow is proportional to √pressure.',
    details: 'Tip colours follow the ISO 10625 code (03 blue = 1.2 L/min at 3 bar).',
  },
  spray: { summary: 'Spray droplets.', role: 'Flat fan: a thin wedge across the boom. Hollow cone: a ring with no spray at the centre.' },
  demo: { summary: 'Nozzle cutaway, enlarged ×8.', role: 'The parts of a spray nozzle: body, strainer, gasket, whirl plate (hollow and solid cone only), orifice disc or fan tip, and cap.' },
  demoBody: { summary: 'Nozzle body.', role: 'Screws into the boom fitting and holds the strainer.' },
  demoStrainer: { summary: 'Nozzle strainer (filter 3 of 3).', role: 'The finest filter — stops particles blocking the orifice. Rinse nozzles with water, never clean them with wire.' },
  demoGasket: { summary: 'Gasket.', role: 'Seals the orifice disc against the body.' },
  demoWhirl: { summary: 'Whirl plate (swirl core).', role: 'Has two or more slanted holes that set the liquid whirling before the orifice. Without a centre hole the spray leaves as a hollow cone; with one it is a solid cone.' },
  demoDisc: { summary: 'Orifice disc (plate).', role: 'The liquid escapes through its opening; the orifice diameter designates the nozzle size.' },
  demoFan: { summary: 'Flat-fan tip.', role: 'An elliptical orifice cut by a groove: the sheet spreads into a flat fan. A fan nozzle has no whirl plate — popular on weed sprayers.' },
  demoCap: { summary: 'Nozzle cap.', role: 'Clamps the tip, disc and gasket to the body.' },
} as const

/* ------------------------------ geometry ------------------------------ */

function useSprayerGeometry(n: number, s: number) {
  return useMemo(() => {
    const T = LAYOUT.tank
    const [fx0, fx1] = LAYOUT.frameX
    const top = MAST_TOP
    const frame = merge(
      // lower-link pins and mast
      aFrameMast({ pinHalf: 0.47, pinR: 0.014, footZ: 0.4, topX: top[0] - 0.03, topY: top[1], topZ: 0.05, legW: 0.05, legT: 0.05, topPinR: 0 }),
      box(0.06, 0.08, 0.16).translate(top[0] - 0.03, top[1], 0),
      // main frame rails
      bar([fx0, 0.04, 0.42], [fx1, 0.18, 0.42], 0.06, 0.06),
      bar([fx0, 0.04, -0.42], [fx1, 0.18, -0.42], 0.06, 0.06),
      bar([fx0, 0.04, 0.45], [fx0, 0.04, -0.45], 0.06, 0.06),
      bar([-0.25, 0.12, 0.45], [-0.25, 0.12, -0.45], 0.05, 0.05),
      bar([fx1, 0.18, 0.45], [fx1, 0.18, -0.45], 0.06, 0.06),
      // tank cradle
      bar([-0.25, 0.12, 0.42], [-0.25, 0.2, 0.42], 0.04, 0.04),
      bar([-0.95, 0.18, 0.42], [-0.95, 0.22, 0.42], 0.04, 0.04),
      // brace to the mast top
      bar([top[0] - 0.03, top[1], 0], [-0.25, 0.12, 0], 0.04, 0.04),
      // control post
      bar([LAYOUT.ctrl.x, 0.04, LAYOUT.ctrl.z], [LAYOUT.ctrl.x, 0.95, LAYOUT.ctrl.z], 0.04, 0.04),
    )
    const tk = sprayTank({ w: T.w, h: T.h, d: T.d })
    const tank = tk.tank.translate(T.x, T.y, 0)
    const liquid = tk.liquid
    const filler = tk.filler.translate(T.x, T.y, 0)
    const basket = tk.basket.translate(T.x, T.y, 0)
    const agitator = merge(rod([T.x + 0.38, T.y - T.h / 2 + 0.05, 0.3], [T.x + 0.1, T.y - T.h / 2 + 0.05, 0.3], 0.008, 10), lathe([[0, 0], [0.012, 0], [0.004, 0.03], [0, 0.03]], 12).rotateZ(PI / 2).translate(T.x + 0.1, T.y - T.h / 2 + 0.05, 0.3))

    // pump: crankcase, two vertical cylinders, head with air chamber
    const P = PUMP
    const { cylX, crankcase, airChamber, shaft, piston, conrod } = pistonPump(P)

    // line strainer (clear bowl filter)
    const S = LAYOUT.strainer
    const ls = lineStrainer(S.x, S.y, S.z)
    const strHead = ls.head
    const strBowl = ls.bowl
    const strMesh = ls.element

    // relief valve, gauge, section manifold on the control post
    const cx = LAYOUT.ctrl.x + 0.05
    const cz = LAYOUT.ctrl.z
    const ry = 0.55
    const reg = sprayRegulator(cx, ry, cz)
    const regBody = reg.body
    const regKnob = reg.knob
    const regSpring = reg.spring
    const poppet = reg.poppet
    const gaugeY = 0.85
    const gg = pressureGauge(cx, gaugeY, cz, ry + 0.17)
    const gauge = gg.gauge
    const gaugeFace = gg.face
    const needle = gg.needle
    const manY = 0.72
    const sv = sectionValves(cx, manY, cz)
    const manifold = sv.block
    const lever = sv.lever

    // hoses
    const tb = T.y - T.h / 2
    const suction = hose([[T.x + 0.1, tb + 0.02, -0.3], [T.x + 0.2, tb - 0.04, -0.3], [S.x - 0.12, S.y + 0.09, S.z], [S.x - 0.07, S.y + 0.09, S.z]])
    const suction2 = hose([[S.x + 0.07, S.y + 0.09, S.z], [P.x - 0.06, P.y + 0.02, -0.12], [P.x - 0.06, P.y, -0.06]])
    const delivery = hose([[P.x, P.y + 0.26, 0], [P.x - 0.02, P.y + 0.33, 0.1], [cx + 0.1, ry + 0.015, cz], [cx + 0.06, ry + 0.015, cz]])
    const bypass = hose([[cx - 0.06, ry + 0.015, cz], [cx - 0.1, ry, cz], [T.x + T.w / 2 + 0.05, tb + 0.06, 0.3], [T.x + 0.38, tb + 0.05, 0.3]])
    const regToMan = hose([[cx, ry + 0.035, cz + 0.035], [cx + 0.02, (ry + manY) / 2, cz + 0.06], [cx, manY - 0.02, cz + 0.04]], 0.009)

    // boom (built at spray-pipe height y = 0, boom x = 0; positioned by the scene)
    const W = n * s
    const boomFrame = sprayBoomFrame(W)
    const pipeG = sprayPipe(W)
    const nozzles = nozzleRow(Array.from({ length: n }, (_, i) => nozzleZ(i, n, s)))
    const liftFrame = merge(bar([LAYOUT.boomX + 0.1, 0.05, 0.38], [LAYOUT.boomX + 0.1, 1.15, 0.38], 0.05, 0.05), bar([LAYOUT.boomX + 0.1, 0.05, -0.38], [LAYOUT.boomX + 0.1, 1.15, -0.38], 0.05, 0.05), bar([LAYOUT.boomX + 0.1, 1.15, 0.4], [LAYOUT.boomX + 0.1, 1.15, -0.4], 0.05, 0.05), bar([LAYOUT.frameX[1], 0.18, 0.38], [LAYOUT.boomX + 0.1, 0.18, 0.38], 0.05, 0.05), bar([LAYOUT.frameX[1], 0.18, -0.38], [LAYOUT.boomX + 0.1, 0.18, -0.38], 0.05, 0.05))

    return { frame, tank, liquid, filler, basket, agitator, crankcase, airChamber, shaft, piston, conrod, cylX, strHead, strBowl, strMesh, regBody, regKnob, regSpring, poppet, gauge, gaugeFace, needle, manifold, lever, suction, suction2, delivery, bypass, regToMan, boomFrame, sprayPipe: pipeG, bodies: nozzles.bodies, tips: nozzles.tips, liftFrame, cx, cz, ry, gaugeY, manY, W }
  }, [n, s])
}

/** Section-feed hoses depend on the boom height. */
function useFeedHoses(n: number, s: number, pipeY: number, cx: number, cz: number, manY: number) {
  return useMemo(() => {
    const W = n * s
    return [0, 1, 2].map((k) => {
      const zc = -W / 2 + (W * (k + 0.5)) / 3
      const z0 = cz - 0.09 + k * 0.07
      const pts: V3[] = [
        [cx, manY + 0.055, z0],
        [cx - 0.05, manY + 0.25, z0 * 0.8],
        [LAYOUT.tank.x, 1.12, zc * 0.12],
        [LAYOUT.boomX + 0.2, pipeY + 0.45, zc * 0.4],
        [LAYOUT.boomX + 0.03, pipeY + 0.06, zc],
        [LAYOUT.boomX, pipeY + 0.012, zc],
      ]
      return { geo: hose(pts, 0.009), curve: curve(pts) }
    })
  }, [n, s, pipeY, cx, cz, manY])
}

/* ------------------------------ spray droplets ------------------------------ */

const PER_NOZZLE = 34
const MAX_NOZZLES = 24

function Spray({ pipeY }: { pipeY: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9fd3ff', transparent: true, opacity: 0.75, roughness: 0.2 }), [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  useSimFrame(() => {
    const im = ref.current
    if (!im) return
    const st = useSprayer.getState()
    const sol = solveSpray(st)
    const ang = sprayAngle(st.kind)
    const tipY = pipeY - 0.07
    const h = tipY + HY // tip height above ground
    const vj = jetSpeed(sol.p * 1e5) * 0.6
    const vF = st.speed / 3.6
    let k = 0
    for (let i = 0; i < MAX_NOZZLES; i++) {
      const open = i < st.nozzles && st.spraying && st.sections[sectionOf(i, st.nozzles)] && st.flows
      const z0 = i < st.nozzles ? nozzleZ(i, st.nozzles, st.spacing) : 0
      for (let j = 0; j < PER_NOZZLE; j++, k++) {
        if (!open) {
          m.makeScale(0, 0, 0)
          im.setMatrixAt(k, m)
          continue
        }
        const a = hash(i * 131 + j * 7.13)
        const b = hash(i * 17 + j * 3.71 + 5)
        let dx: number, dy: number, dz: number
        if (st.kind === 'flat-fan') {
          const phi = (a - 0.5) * ang * 0.98
          const th = (b - 0.5) * 0.08
          dx = Math.sin(th)
          dy = -Math.cos(phi) * Math.cos(th)
          dz = Math.sin(phi)
        } else {
          const al = (ang / 2) * (0.82 + 0.18 * b)
          const az = a * 2 * PI
          dx = Math.sin(al) * Math.cos(az)
          dy = -Math.cos(al)
          dz = Math.sin(al) * Math.sin(az)
        }
        const Lr = h / -dy
        const T = Lr / vj
        const u = (((clock.t / T + hash(i * 3 + j * 11.3)) % 1) + 1) % 1
        const d = Lr * u
        const r = 0.006 + 0.004 * hash(j * 1.7 + i)
        m.makeScale(r, r, r).setPosition(LAYOUT.boomX + dx * d - vF * T * u * u * 0.3, tipY + dy * d, z0 + dz * d)
        im.setMatrixAt(k, m)
      }
    }
    im.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, mat, MAX_NOZZLES * PER_NOZZLE]} frustumCulled={false} />
}

/* ------------------------------ enlarged nozzle cutaway ------------------------------ */

function NozzleDemo() {
  const kind = useSprayer((s) => s.kind)
  const q3 = useSprayer((s) => s.q3)
  const g = useMemo(() => {
    const parts = nozzleParts()
    const stand = merge(cylinder(0.12, 0.03, 32).translate(0, -NOZZLE_DEMO.y + 0.015, 0), rod([0, -NOZZLE_DEMO.y + 0.03, 0], [0, -0.13, 0], 0.02), box(0.03, 0.03, 0.16).translate(0, -0.12, 0))
    const plaque = box(0.18, 0.1, 0.012)
    return { ...parts, stand, plaque }
  }, [])

  const drops = useRef<THREE.InstancedMesh>(null)
  const dgeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), [])
  const dmat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9fd3ff', transparent: true, opacity: 0.8 }), [])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const N = 140
  useSimFrame(() => {
    const im = drops.current
    if (!im) return
    const st = useSprayer.getState()
    const ang = sprayAngle(st.kind)
    for (let j = 0; j < N; j++) {
      const a = hash(j * 7.13)
      const b = hash(j * 3.71 + 5)
      let dx: number, dy: number, dz: number
      if (st.kind === 'flat-fan') {
        const phi = (a - 0.5) * ang
        dx = (b - 0.5) * 0.06
        dy = -Math.cos(phi)
        dz = Math.sin(phi)
      } else {
        const al = (ang / 2) * (0.85 + 0.15 * b)
        dx = Math.sin(al) * Math.cos(a * 2 * PI)
        dy = -Math.cos(al)
        dz = Math.sin(al) * Math.sin(a * 2 * PI)
      }
      const u = (((clock.t * 4 + hash(j * 11.3)) % 1) + 1) % 1
      const d = 0.004 + 0.05 * u
      const r = st.spraying && st.flows ? 0.0007 : 0
      m.makeScale(r, r, r).setPosition(dx * d, -0.009 + dy * d, dz * d)
      im.setMatrixAt(j, m)
    }
    im.instanceMatrix.needsUpdate = true
  })
  const tipMat = tipMaterial(q3)
  return (
    <group position={[NOZZLE_DEMO.x, NOZZLE_DEMO.y, NOZZLE_DEMO.z]}>
      <Part id="nozzle-stand" name="Display stand" role="static" material="paintGrey" cut={false}>
        <PartMesh geometry={g.stand} />
      </Part>
      <group scale={NOZZLE_DEMO.scale}>
        <Part id="nozzle-demo" name={kind === 'flat-fan' ? 'Flat-fan nozzle (×8)' : 'Hollow-cone nozzle (×8)'} role="static" material="brass" info={INFO.demo} cites={[C.nozzle('Fig 15.6 parts, Fig 15.7 patterns')]}>
          <Part id="demo-body" name="Nozzle body" material="brass" role="housing" info={INFO.demoBody} cites={[C.nozzle('Fig 15.6')]} explode={[0, 0.03, 0]}>
            <PartMesh geometry={g.body} />
          </Part>
          <Part id="demo-strainer" name="Nozzle strainer" material="galvanised" role="static" info={INFO.demoStrainer} cites={[C.sprayer('filters'), SRC_MAINT]} explode={[0, 0.06, 0]}>
            <PartMesh geometry={g.strainer} />
          </Part>
          <Part id="demo-gasket" name="Gasket" material="rubber" role="static" info={INFO.demoGasket} cites={[C.nozzle('Fig 15.6 — cap and gasket')]} explode={[0, -0.008, 0]}>
            <PartMesh geometry={g.gasket} />
          </Part>
          {kind === 'hollow-cone' ? (
            <>
              <Part id="demo-whirl" name="Whirl plate (no centre hole)" material="steel" role="static" info={INFO.demoWhirl} cites={[C.nozzle('whirl plate, hollow vs solid cone')]} explode={[0, -0.018, 0]}>
                <PartMesh geometry={g.whirl} />
              </Part>
              <Part id="demo-disc" name="Orifice disc" material={tipMat} role="static" info={INFO.demoDisc} cites={[C.nozzle('disc or orifice plate')]} explode={[0, -0.028, 0]}>
                <PartMesh geometry={g.disc} />
              </Part>
            </>
          ) : (
            <Part id="demo-fan" name="Flat-fan tip (no whirl plate)" material={tipMat} role="static" info={INFO.demoFan} cites={[C.nozzle('fan type: no whirl plate')]} explode={[0, -0.025, 0]}>
              <PartMesh geometry={g.fanTip} />
            </Part>
          )}
          <Part id="demo-cap" name="Nozzle cap" material="plastic" role="housing" info={INFO.demoCap} cites={[C.nozzle('Fig 15.6')]} explode={[0, -0.045, 0]}>
            <PartMesh geometry={g.cap} />
          </Part>
          <instancedMesh ref={drops} args={[dgeo, dmat, N]} frustumCulled={false} />
        </Part>
      </group>
    </group>
  )
}
const SRC_MAINT = C.calib('§15.13 maintenance — rinse, never clean with wire')

/* ------------------------------ the mounted sprayer ------------------------------ */

function MountedSprayer() {
  const n = useSprayer((s) => s.nozzles)
  const sp = useSprayer((s) => s.spacing)
  const boomH = useSprayer((s) => s.boomH)
  const q3 = useSprayer((s) => s.q3)
  const flows = useSprayer((s) => s.flows)
  const g = useSprayerGeometry(n, sp)
  const pipeY = boomH - HY + 0.07
  const feeds = useFeedHoses(n, sp, pipeY, g.cx, g.cz, g.manY)

  const shaft = useRef<THREE.Group>(null)
  const pistons = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const liquid = useRef<THREE.Mesh>(null)
  const poppet = useRef<THREE.Group>(null)
  const spring = useRef<THREE.Mesh>(null)
  const needle = useRef<THREE.Group>(null)
  const levers = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)]

  const T = LAYOUT.tank
  const P = PUMP
  useSimFrame(() => {
    const st = useSprayer.getState()
    const a = clock.pto
    shaft.current?.rotation.set(a, 0, 0)
    pistons.forEach((r, i) => {
      const ph = a + i * PI
      r.current?.position.set(g.cylX[i], P.y + 0.06 + (P.stroke / 2) * Math.cos(ph), 0)
    })
    const fill = Math.max(0.02, live.tank / T.capacity)
    const hIn = T.h - 0.04
    if (liquid.current) {
      liquid.current.scale.set(1, hIn * fill, 1)
      liquid.current.position.set(T.x, T.y - hIn / 2 + (hIn * fill) / 2, 0)
    }
    const sol = solveSpray(st)
    const lift = sol.pump > 0 ? (0.004 * sol.bypass) / sol.pump : 0
    poppet.current?.position.set(g.cx, g.ry + 0.03 + lift, g.cz)
    if (spring.current) {
      spring.current.position.set(g.cx, g.ry + 0.06 + lift, g.cz)
      spring.current.scale.y = 0.065 - lift + 0.002 * (st.pSet - 3)
    }
    needle.current?.rotation.set(0, 0, (3 * PI) / 4 - (live.pressure / 10) * 1.5 * PI)
    levers.forEach((r, k) => r.current?.rotation.set(0, st.sections[k] ? 0 : PI / 2, 0))
  })

  const fl = (get: () => number) => () => (flows ? get() : 0)
  const suctionCurve = useMemo(() => curve([[T.x + 0.1, T.y - T.h / 2 + 0.02, -0.3], [LAYOUT.strainer.x - 0.1, LAYOUT.strainer.y + 0.09, LAYOUT.strainer.z], [P.x - 0.06, P.y + 0.02, -0.12], [P.x - 0.045, P.y + 0.08, 0]]), [T.x, T.y, T.h, P.x, P.y])
  const deliveryCurve = useMemo(() => curve([[P.x, P.y + 0.2, 0], [P.x - 0.02, P.y + 0.33, 0.1], [g.cx + 0.1, g.ry + 0.015, g.cz], [g.cx, g.ry + 0.03, g.cz]]), [P.x, P.y, g])
  const bypassCurve = useMemo(() => curve([[g.cx, g.ry + 0.03, g.cz], [g.cx - 0.1, g.ry, g.cz], [T.x + T.w / 2 + 0.05, T.y - T.h / 2 + 0.06, 0.3], [T.x + 0.1, T.y - T.h / 2 + 0.05, 0.3]]), [g, T])

  return (
    <Part id="sprayer" name="Boom sprayer" role="housing" material="paintOrange" info={INFO.sprayer} cites={[C.boom('tractor-operated, Fig 15.9'), C.sprayer('essential components, Fig 15.4')]}>
      <Part id="sprayer-frame" name="Frame & mast" material="paintOrange" role="static" info={INFO.frame} cites={[SRC_HITCH]}>
        <PartMesh geometry={g.frame} />
      </Part>
      <Part id="tank" name="Spray tank" material="nylon" role="housing" info={INFO.tank} cites={[C.sprayer('tank: plastic or fibreglass'), C.calib('§15.13 half-fill with water first')]} explode={[0, 0.6, 0]}>
        <PartMesh geometry={g.tank} />
        <Part id="tank-liquid" name="Spray liquid" material="water" role="fluid" info={INFO.liquid} cites={[C.sprayer('solution, suspension, emulsion')]}>
          <PartMesh ref={liquid} geometry={g.liquid} />
        </Part>
        <Part id="filler" name="Filler lid & basket strainer" material="plastic" role="static" info={INFO.tankStrainer} cites={[C.sprayer('filters at the filling hole, before the pump, in the nozzle')]} explode={[0, 0.25, 0]}>
          <PartMesh geometry={g.filler} />
          <PartMesh geometry={g.basket} material="galvanised" />
        </Part>
        <Part id="agitator" name="Agitator jet" material="steel" role="static" info={INFO.agitator} cites={[C.sprayer('suspension needs constant agitation')]} beyondNotes>
          <PartMesh geometry={g.agitator} />
        </Part>
      </Part>

      <Part id="pump" name="Piston pump & air chamber" material="castIron" role="housing" info={INFO.pump} cites={[C.pump('piston or plunger pumps with air chamber'), C.boom('pump run off the PTO')]} explode={[0.25, -0.15, 0]}>
        <PartMesh geometry={g.crankcase} />
        <Part id="air-chamber" name="Air chamber" material="paintRed" role="housing" info={INFO.airChamber} cites={[C.pump('air chamber levels out variations')]}>
          <PartMesh geometry={g.airChamber} />
        </Part>
        <Part id="pump-shaft" name="Pump shaft & eccentrics" material="forged" role="moving" info={INFO.pumpShaft}>
          <group ref={shaft} position={[0, P.y, 0]}>
            <PartMesh geometry={g.shaft} />
          </group>
        </Part>
        <Part id="pistons" name="Pistons" material="aluminium" role="moving" info={INFO.pistons} cites={[C.pump('reciprocating units')]}>
          {pistons.map((r, i) => (
            <group key={i} ref={r}>
              <PartMesh geometry={g.piston} />
              <PartMesh geometry={g.conrod} material="forged" position={[0, -0.065, 0]} />
            </group>
          ))}
        </Part>
      </Part>
      <PtoDriveline id="pto-shaft" from={PTO_LOCAL} to={[P.x + 0.14, P.y, 0]} angle={() => clock.pto} />

      <Part id="line-strainer" name="Line strainer" material="aluminium" role="housing" info={INFO.lineStrainer} cites={[C.sprayer('filters before the pump')]} explode={[0, -0.1, -0.2]}>
        <PartMesh geometry={g.strHead} />
        <PartMesh geometry={g.strBowl} material="glass" />
        <Part id="line-strainer-mesh" name="Strainer element" material="galvanised" role="static">
          <PartMesh geometry={g.strMesh} />
        </Part>
      </Part>

      <Part id="regulator" name="Pressure-relief valve" material="bronze" role="housing" info={INFO.regulator} cites={[C.sprayer('pressure relief valve sets and maintains pressure'), C.pump('relief valve protects the pump')]} explode={[0, 0.1, 0.25]}>
        <PartMesh geometry={g.regBody} />
        <PartMesh geometry={g.regKnob} material="plastic" />
        <Part id="relief-poppet" name="Relief poppet" material="steel" role="moving" info={INFO.poppet}>
          <group ref={poppet}>
            <PartMesh geometry={g.poppet} />
          </group>
        </Part>
        <Part id="relief-spring" name="Relief spring" material="steelDark" role="moving" info={INFO.reliefSpring} cut={false}>
          <PartMesh ref={spring} geometry={g.regSpring} />
        </Part>
      </Part>
      <Part id="gauge" name="Pressure gauge" material="steel" role="static" info={INFO.gauge} cites={[C.sprayer('gauge on the delivery side')]} explode={[0, 0.15, 0.25]}>
        <PartMesh geometry={g.gauge} />
        <PartMesh geometry={g.gaugeFace} material="ceramic" />
        <group ref={needle} position={[g.cx, g.gaugeY, g.cz + 0.049]}>
          <PartMesh geometry={g.needle} material="paintRed" />
        </group>
      </Part>
      <Part id="manifold" name="Section cut-off valves" material="brass" role="static" info={INFO.manifold} cites={[C.sprayer('control valve or cut-off device')]} explode={[0, 0.12, 0.3]}>
        <PartMesh geometry={g.manifold} />
        {levers.map((r, k) => (
          <group key={k} ref={r} position={[g.cx, g.manY + 0.06, g.cz - 0.09 + k * 0.07]}>
            <PartMesh geometry={g.lever} material={k === 0 ? 'paintRed' : k === 1 ? 'paintYellow' : 'paintGreen'} />
          </group>
        ))}
      </Part>

      <Part id="hoses" name="Hoses" material="rubber" role="static" info={INFO.hoses} cut={false}>
        <PartMesh geometry={g.suction} />
        <PartMesh geometry={g.suction2} />
        <PartMesh geometry={g.delivery} />
        <PartMesh geometry={g.bypass} />
        <PartMesh geometry={g.regToMan} />
        {feeds.map((f, k) => (
          <PartMesh key={k} geometry={f.geo} />
        ))}
      </Part>

      <Part id="boom" name="Spray boom" material="galvanised" role="static" info={INFO.boom} cites={[C.sprayer('boom or lance'), C.boom('nozzles at adjustable distances')]}>
        <Part id="lift-frame" name="Boom lift frame" material="paintOrange" role="static" info={INFO.liftFrame}>
          <PartMesh geometry={g.liftFrame} />
        </Part>
        <group position={[LAYOUT.boomX, pipeY, 0]}>
          <Part id="boom-frame" name="Boom frame (3 sections)" material="galvanised" role="static" info={INFO.boom}>
            <PartMesh geometry={g.boomFrame} />
          </Part>
          <Part id="spray-pipe" name="Spray pipe" material="steel" role="static" info={INFO.sprayPipe}>
            <PartMesh geometry={g.sprayPipe} />
          </Part>
          <Part id="nozzle-bodies" name="Nozzles" material="plastic" role="static" info={INFO.nozzles} cites={[C.nozzle('flow ∝ √pressure; orifice designates size')]}>
            <PartMesh geometry={g.bodies} />
            <PartMesh geometry={g.tips} material={tipMaterial(q3)} />
          </Part>
        </group>
      </Part>
      <Part id="spray" name="Spray" role="fluid" info={INFO.spray} cites={[C.nozzle('Fig 15.7 spray patterns')]} cut={false}>
        <Spray pipeY={pipeY} />
      </Part>

      {flows ? (
        <>
          <Flow curve={suctionCurve} count={26} radius={0.006} color="#6fb8ec" speed={0.8} spread={0.004} intensity={fl(() => Math.min(1, live.flow / 30 + live.bypass / 30))} />
          <Flow curve={deliveryCurve} count={26} radius={0.006} color="#6fb8ec" speed={0.9} spread={0.004} intensity={fl(() => Math.min(1, (live.flow + live.bypass) / 30))} />
          <Flow curve={bypassCurve} count={26} radius={0.006} color="#e8d06a" speed={0.9} spread={0.004} intensity={fl(() => Math.min(1, live.bypass / 20))} />
          {feeds.map((f, k) => (
            <Flow key={k} curve={f.curve} count={30} radius={0.005} color="#6fb8ec" speed={0.7} spread={0.003} intensity={fl(() => (useSprayer.getState().sections[k] && useSprayer.getState().spraying ? Math.min(1, live.flow / 15 + 0.2) : 0))} />
          ))}
        </>
      ) : null}
    </Part>
  )
}
const SRC_HITCH = C.boom('mounted on the tractor')

/* ------------------------------ scene ------------------------------ */

const WET = new THREE.Color('#2e6b62')

export function Scene3D() {
  const n = useSprayer((s) => s.nozzles)
  const sp = useSprayer((s) => s.spacing)
  const rows = useMemo(() => {
    const out: number[] = []
    for (let z = -4.25; z <= 4.26; z += 0.5) if (Math.abs(Math.abs(z) - TRACTOR.rear.track / 2) > 0.2) out.push(z)
    return out
  }, [])

  useSimFrame((dt) => {
    const st = useSprayer.getState()
    clock.t += dt
    const v = st.speed / 3.6
    mill.s += v * dt
    clock.pto += (dt * 2 * PI * st.ptoRpm) / 60
    pose.hitchHeight = HITCH_H
    pose.rearAngle += (v * dt) / TRACTOR.rear.rolling
    pose.frontAngle += (v * dt) / TRACTOR.front.radius
    pose.engineAngle += dt * 2 * PI * 30
    pose.ptoAngle = clock.pto
    const sol = solveSpray(st)
    live.pressure = sol.p
    live.bypass = sol.bypass
    live.flow = sol.Q
    live.rate = sol.rate
    live.tank = Math.max(0, live.tank - (sol.Q / 60) * dt)
    if (live.runActive) {
      live.runDist += v * dt
      live.runUsed += (sol.Q / 60) * dt
      if (live.runDist >= sol.L) {
        live.runUsed *= sol.L / live.runDist
        live.runDist = sol.L
        live.runActive = false
      }
    }
  })

  const tint = (x: number, z: number, out: THREE.Color) => {
    const st = useSprayer.getState()
    const W = st.nozzles * st.spacing
    if (x > BOOM_WORLD_X || Math.abs(z) > W / 2 || !st.spraying) return
    const k = Math.min(2, Math.floor(((z + W / 2) / W) * 3))
    if (st.sections[k]) out.lerp(WET, 0.55)
  }

  return (
    <group>
      <Tractor
        pose={pose}
       
        labels={false}
        mounted={
          <Level pose={pose}>
            <MountedSprayer />
          </Level>
        }
      />
      <Ground />
      <CropRows mill={mill} rows={rows} pitch={0.32} tint={tint} />
      <NozzleDemo />

      <PartLabel partId="tank" at={[HX + LAYOUT.tank.x, HY + 1.12, 0.3]} />
      <PartLabel partId="pump" at={[HX + PUMP.x + 0.05, HY + 0.3, -0.2]} />
      <PartLabel partId="regulator" at={[HX + LAYOUT.ctrl.x + 0.08, HY + 0.6, LAYOUT.ctrl.z + 0.12]} />
      <PartLabel partId="gauge" at={[HX + LAYOUT.ctrl.x + 0.08, HY + 0.93, LAYOUT.ctrl.z + 0.1]} />
      <PartLabel partId="manifold" at={[HX + LAYOUT.ctrl.x + 0.1, HY + 0.76, LAYOUT.ctrl.z - 0.15]} />
      <PartLabel partId="line-strainer" at={[HX + LAYOUT.strainer.x, HY + 0.1, LAYOUT.strainer.z - 0.1]} />
      <PartLabel partId="boom-frame" at={[BOOM_WORLD_X, 0.95, -(n * sp) / 2 + 0.3]} />
      <PartLabel partId="nozzle-bodies" at={[BOOM_WORLD_X, 0.45, (n * sp) / 2 - 0.4]} />
      <PartLabel partId="pto-shaft" at={[HX + 0.6, HY + 0.12, 0.08]} />
      <PartLabel partId="nozzle-demo" at={[NOZZLE_DEMO.x, NOZZLE_DEMO.y + 0.32, NOZZLE_DEMO.z]} />
    </group>
  )
}
