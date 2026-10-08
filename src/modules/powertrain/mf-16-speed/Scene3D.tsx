import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { planetSpin } from '@/core/drive'
import { useSimFrame } from '@/core/sim'
import { PartLabel } from '@/render/Label'
import type { MaterialKey } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useLive } from '@/ui/live'
import { POWER } from '../common/anim'
import { phaseToMeet, placeBevelGear } from '../common/bevel'
import { meshPhase } from '../common/geo'
import { BEVEL, BOT, FRONT_Y, GW, IDLER, RANGE_L, SS, ST, Z } from './dims'
import { getMFGeometry } from './geometry'
import { live, makeGraph, seq, stepMF, useMF } from './model'

const { PI } = Math
const UP = PI / 2
const DOWN = -PI / 2
const RC = ((SS.zs + SS.zp) * SS.m) / 2
const planetAngle = (i: number) => (2 * PI * i) / SS.n
const planetPhase = (i: number) => planetAngle(i) + PI + PI / SS.zp + planetAngle(i) * (SS.zs / SS.zp)
const RING_PHASE = SS.zp % 2 === 0 ? PI / SS.zr : 0
const PH_CM = meshPhase(Z.fwd, 0, Z.cm, DOWN)
const G1 = Math.atan2(IDLER.y, IDLER.x)
const G2 = Math.atan2(BOT - IDLER.y, -IDLER.x)
const PH_IDLER = phaseToMeet(Z.idler, Z.cm, PH_CM, G2)
const PH_REV = phaseToMeet(Z.rev, Z.idler, PH_IDLER, G1)
const PH_L = Z.m.map((zm, i) => meshPhase(zm, 0, Z.l[i], UP))
const PH_T2 = meshPhase(Z.t1, 0, Z.t2, DOWN)
const APEX = new THREE.Vector3(0, 0, BEVEL.apexZ)
const PIN = placeBevelGear(APEX, new THREE.Vector3(0, 0, 1), BEVEL.rp, BEVEL.g1, new THREE.Vector3(-1, 0, 0), Z.pinion, true)
const CRN = placeBevelGear(APEX, new THREE.Vector3(1, 0, 0), BEVEL.rc, BEVEL.g2, new THREE.Vector3(0, 0, -1), Z.crown, false)
const RANGE_C = ST.rangeH + ST.slide.d + ST.slide.s
const SYNC_TRAVEL = 0.017
const SHUTTLE_TRAVEL = 0.011

const C = {
  fig: [SRC.top510('p3–4, Fig A2.6')],
  ss: [SRC.top510('p3 — speed-shift epicyclic, change on the move'), SRC.tts510('p4 — hydraulic hi-lo doubles the ratios')],
  shuttle: [SRC.top510('p3 — free-running gears and sliding coupler: shuttle; reverse drive arrangement inset')],
  sync: [SRC.top510('p3 — 4-speed all-synchromesh, constant-mesh helical'), SRC.tts510('p5 — synchromesh')],
  range: [SRC.top510('p3 — sliding non-synchromesh range-change gear')],
  layshaft: [SRC.top510('p3 — hollow layshaft carries the PTO drive shaft')],
  out: [SRC.top510('p3 — output shaft spigoted into the mainshaft'), SRC.tts510('p7 — crown wheel and pinion')],
}

const INFO = {
  box: { summary: 'Sixteen-speed tractor gearbox with high-low power shift and shuttle reverse in 12 speeds (Massey-Ferguson 2000 range).', role: '2 speed-shift × 4 synchro gears × 2 ranges = 16 forward. Tooth numbers here are typical values chosen for 1.6–32 km/h.' },
  casing: { summary: 'Gearbox casing (sectioned).', role: 'Bearings, oil (shared with the transmission) and the lubrication nozzle that sprays the gears.' },
  pto: { summary: 'PTO drive shaft.', role: 'Runs from the PTO clutch straight through the hollow layshaft to the rear, independent of the gear selected.' },
  sun: { summary: 'Speed-shift unit: sun gear on the input sleeve (from the transmission clutch).', role: 'Hydraulically operated epicyclic gearset in front of the main gearbox — a change-on-the-move high-low in each of the 4 × 2 gears.' },
  carrier: { summary: 'Speed-shift planet carrier → shuttle sleeve.', role: 'Output of the epicyclic. High: the hydraulic clutch locks sun and carrier, 1 : 1. Low: the ring is held and the carrier turns slower (45/114 = 0.395).' },
  ring: { summary: 'Speed-shift ring gear and its brake band.', role: 'Held by the hydraulic brake for the low ratio; free (carried round) in high.' },
  hiClutch: { summary: 'Speed-shift high clutch (multi-plate).', role: 'Locks the sun to the carrier: two members locked, the set turns as one.' },
  shuttle: { summary: 'Forward and reverse gears (free-running) with the sliding coupler.', role: 'Either gear can be connected to the shaft by the sliding coupler — a quick "shuttle" from forward to reverse in any of gears 1 to 12.' },
  idler: { summary: 'Reverse idler.', role: 'Reverse gear → idler → constant-mesh gear: one more mesh, so the mainshaft turns the other way.' },
  main: { summary: 'Mainshaft with the constant-mesh gear.', role: 'Driven by the forward gear (or through the idler in reverse). Carries the four free helical gears and the two synchromesh units.' },
  mg: { summary: 'Constant-mesh helical gears (1st–4th), free on the mainshaft.', role: 'Always in mesh with the layshaft. A synchromesh sleeve locks one of them to the mainshaft.' },
  syncs: { summary: 'Synchromesh units (1–2 and 3–4).', role: 'Cone and baulk ring bring the gear to shaft speed before the sleeve’s teeth engage.' },
  lay: { summary: 'Hollow layshaft with the fixed gears 2nd, 1st, 4th, 3rd and the high and low range gears.', role: 'The layshaft has a hollow centre to accommodate the PTO drive shaft.' },
  range: { summary: 'Range-change gear (sliding, non-synchromesh) on the output shaft.', role: 'Meshes the high-range or the low-range layshaft gear — high/low range in the four basic gears. Changed only with the tractor stopped.' },
  output: { summary: 'Output shaft (spigoted into the mainshaft) with transfer gear, parking brake and bevel pinion.', role: 'Drives the crown wheel and, through the transfer gear and 4WD clutch, the front axle drive shaft.' },
  transfer: { summary: 'Transfer gear, four-wheel-drive clutch and front axle drive shaft.', role: 'The multi-plate 4WD clutch connects the front axle drive.' },
  brake: { summary: 'Parking brake.', role: 'Holds the output shaft (here also declutches the drive).' },
  crown: { summary: 'Crown wheel and pinion with the differential.', role: 'Right-angle drive and the second reduction (47 : 11). A 4.8 : 1 final drive follows (not drawn).' },
  levers: { summary: 'Gear lever, range lever and shuttle lever.', role: 'The speed-shift is a separate hydraulic control used on the move without the clutch.' },
  oil: { summary: 'Transmission oil.', role: 'Lubricates (splash and the lubrication nozzle) and supplies the hydraulic speed-shift.' },
}

export function MF16Scene3D() {
  const g = getMFGeometry()
  const powerFlow = useMF((s) => s.powerFlow)
  const ssL = useMF((s) => s.speedShift === 'L')
  const fourWD = useMF((s) => s.fourWD)
  const ptoOn = useMF((s) => s.pto)
  const park = useMF((s) => s.parkingBrake)
  const engagedKey = useLive(() => `${live.engaged}|${live.clutch || live.phase === 'reclutch' ? 1 : 0}`, 10)
  const graph = useMemo(makeGraph, [])
  const pl = useRef(0)
  const snapR = useRef({ key: '', off: 0 })
  const R = {
    pto: useRef<THREE.Group>(null),
    input: useRef<THREE.Group>(null),
    carrier: useRef<THREE.Group>(null),
    ring: useRef<THREE.Group>(null),
    fwd: useRef<THREE.Group>(null),
    rev: useRef<THREE.Group>(null),
    idler: useRef<THREE.Group>(null),
    main: useRef<THREE.Group>(null),
    lay: useRef<THREE.Group>(null),
    output: useRef<THREE.Group>(null),
    range: useRef<THREE.Group>(null),
    transfer: useRef<THREE.Group>(null),
    front: useRef<THREE.Group>(null),
    crown: useRef<THREE.Group>(null),
    shuttleCollar: useRef<THREE.Group>(null),
    gearLever: useRef<THREE.Group>(null),
    rangeLever: useRef<THREE.Group>(null),
    shuttleLever: useRef<THREE.Group>(null),
  }
  const planets = useRef<(THREE.Group | null)[]>([])
  const mg = useRef<(THREE.Group | null)[]>([])
  const collars = useRef<(THREE.Group | null)[]>([])

  useSimFrame((dt) => {
    stepMF(graph, dt)
    const th = (id: string) => graph.get(id).theta
    const rot = (r: RefObject<THREE.Group | null>, a: number) => r.current?.rotation.set(0, 0, a)
    rot(R.pto, th('pto'))
    rot(R.input, th('input'))
    rot(R.carrier, th('carrier'))
    rot(R.ring, th('ring') + RING_PHASE)
    rot(R.fwd, th('fwd'))
    rot(R.rev, th('rev') + PH_REV)
    rot(R.idler, th('idler') + PH_IDLER)
    rot(R.main, th('main'))
    rot(R.lay, th('lay'))
    rot(R.output, th('output'))
    rot(R.transfer, th('transfer') + PH_T2)
    rot(R.front, th('front'))
    rot(R.crown, th('crown') + CRN.phase)
    const wS = graph.get('input').omega
    const wC = graph.get('carrier').omega
    pl.current += (planetSpin(wS, wC, SS.zs, SS.zp) - wC) * dt
    planets.current.forEach((p, i) => p?.rotation.set(0, 0, pl.current + planetPhase(i)))
    ;['m1', 'm2', 'm3', 'm4'].forEach((id, i) => mg.current[i]?.rotation.set(0, 0, th(id)))
    // sliding range gear: re-phase as it slides into mesh
    const p = seq.pos
    const k = p.r < -0.4 ? 'H' : p.r > 0.4 ? 'L' : ''
    if (k && k !== snapR.current.key)
      snapR.current.off = (k === 'H' ? phaseToMeet(Z.oh, Z.lh, th('lay'), UP) : phaseToMeet(Z.ol, Z.ll, th('lay'), UP)) - th('output')
    snapR.current.key = k
    R.range.current?.position.set(0, 0, RANGE_C + p.r * ST.slide.s)
    R.range.current?.rotation.set(0, 0, snapR.current.off)
    R.shuttleCollar.current?.position.set(0, 0, ST.coupler + p.sh * SHUTTLE_TRAVEL)
    collars.current[0]?.position.set(0, 0, ST.hub12 + p.s12 * SYNC_TRAVEL)
    collars.current[1]?.position.set(0, 0, ST.hub34 + p.s34 * SYNC_TRAVEL)
    R.gearLever.current?.rotation.set((p.s12 !== 0 ? p.s12 : p.s34) * 0.28, 0, p.s12 !== 0 ? 0.16 : p.s34 !== 0 ? -0.16 : 0)
    R.rangeLever.current?.rotation.set(p.r * 0.3, 0, 0)
    R.shuttleLever.current?.rotation.set(p.sh * 0.3, 0, 0)
  }, -1)

  // power path from the engaged selection
  const [eng, drv] = engagedKey.split('|')
  const range = eng[0]
  const gear = eng[1]
  const sh = eng[3]
  const driving = drv === '1' && !park
  const pf = (on: boolean, base: MaterialKey): MaterialKey => (powerFlow && on ? POWER : base)
  const on = {
    ss: driving,
    fwd: driving && sh === 'F',
    rev: driving && sh === 'R',
    main: driving && sh !== 'N',
    gear: (k: number) => driving && sh !== 'N' && gear === String(k),
    lay: driving && sh !== 'N' && gear !== 'N',
    rh: driving && sh !== 'N' && gear !== 'N' && range === 'H',
    rl: driving && sh !== 'N' && gear !== 'N' && range === 'L',
  }
  const out = on.rh || on.rl
  const pinPos = useMemo(() => Array.from({ length: SS.n }, (_, i) => [RC * Math.cos(planetAngle(i)), RC * Math.sin(planetAngle(i)), SS.z] as [number, number, number]), [])
  const mGeo = [g.m1, g.m2, g.m3, g.m4]
  const lGeo = [g.l1, g.l2, g.l3, g.l4]

  return (
    <group>
      <Part id="mf16" name="16F/12R tractor gearbox" role="moving" material="steel" info={INFO.box} cites={C.fig}>
        <Part id="casing" name="Gearbox casing" role="housing" material="castIron" info={INFO.casing} cites={C.fig} explode={[0, 0.35, 0]}>
          <PartMesh geometry={g.casing} />
          <PartMesh geometry={g.transferCase} />
          <PartMesh geometry={g.axleHousing} position={[0, BOT, BEVEL.apexZ]} />
          <PartMesh geometry={g.nozzle} position={[0.05, -0.08, ST.cmZ0 - 0.03]} material="copper" />
          <Part id="oil" name="Transmission oil" role="fluid" material="oil" info={INFO.oil} cites={[SRC.tts510('p7')]}>
            <PartMesh geometry={g.oil} />
          </Part>
        </Part>

        <Part id="pto-shaft" name="PTO drive shaft" role="moving" material="steel" info={INFO.pto} cites={C.layshaft} explode={[0, 0.06, 0]}>
          <group ref={R.pto}>
            <PartMesh geometry={g.pto} material={pf(ptoOn, 'steel')} />
          </group>
        </Part>

        <Part id="speed-shift" name="Speed-shift epicyclic" role="moving" material="steel" info={INFO.sun} cites={C.ss} explode={[0, 0, -0.15]}>
          <Part id="ss-sun" name="Input sleeve & sun gear" info={INFO.sun} cites={C.ss}>
            <group ref={R.input}>
              <PartMesh geometry={g.input} material={pf(on.ss, 'steel')} />
              <PartMesh geometry={g.sun} position={[0, 0, SS.z]} material={pf(on.ss, 'steelDark')} />
              <PartMesh geometry={g.hiClutch.hub} position={[0, 0, SS.z]} material="steel" />
              <PartMesh geometry={g.hiClutch.friction} position={[0, 0, SS.z]} material="friction" />
            </group>
          </Part>
          <Part id="ss-carrier" name="Planet carrier, planets & shuttle sleeve" info={INFO.carrier} cites={C.ss}>
            <group ref={R.carrier}>
              <PartMesh geometry={g.carrier.plates} position={[0, 0, SS.z]} material={pf(on.ss, 'forged')} />
              <PartMesh geometry={g.carrier.pins} position={[0, 0, SS.z]} />
              <PartMesh geometry={g.shuttleSleeve} material={pf(on.ss, 'steel')} />
              <Part id="ss-hi-clutch" name="High clutch (steel plates on the carrier drum)" material="steel" info={INFO.hiClutch} cites={C.ss}>
                <PartMesh geometry={g.hiClutch.steel} position={[0, 0, SS.z]} material={!ssL && powerFlow ? POWER : 'steel'} />
              </Part>
              <PartMesh geometry={g.hub} position={[0, 0, ST.coupler]} />
              <group ref={R.shuttleCollar}>
                <Part id="coupler" name="Shuttle sliding coupler" material="forged" info={INFO.shuttle} cites={C.shuttle}>
                  <PartMesh geometry={g.collar} />
                </Part>
              </group>
              {pinPos.map((pp, i) => (
                <group key={i} position={pp}>
                  <group
                    ref={(el) => {
                      planets.current[i] = el
                    }}
                  >
                    <PartMesh geometry={g.planet} material="steelDark" />
                  </group>
                </group>
              ))}
            </group>
          </Part>
          <Part id="ss-ring" name="Ring gear & low brake" info={INFO.ring} cites={C.ss}>
            <group ref={R.ring} position={[0, 0, SS.z]}>
              <PartMesh geometry={g.ring} material={powerFlow && ssL ? 'paintRed' : 'steel'} />
            </group>
            <PartMesh geometry={g.band} position={[0, 0, SS.z]} material={ssL ? 'paintRed' : 'paintGrey'} />
          </Part>
        </Part>

        <Part id="shuttle" name="Shuttle: forward & reverse gears" role="moving" material="steelDark" info={INFO.shuttle} cites={C.shuttle} explode={[0, 0.1, 0]}>
          <group position={[0, 0, ST.fwd]}>
            <group ref={R.fwd}>
              <PartMesh geometry={g.fwdSpur} material={pf(on.fwd, 'steelDark')} />
              <PartMesh geometry={g.shuttleDogs} position={[0, 0, -GW / 2 - 0.003]} material="steel" />
            </group>
          </group>
          <group position={[0, 0, ST.rev]}>
            <group ref={R.rev}>
              <PartMesh geometry={g.revSpur} material={pf(on.rev, 'steelDark')} />
              <PartMesh geometry={g.shuttleDogs} position={[0, 0, GW / 2 + 0.003]} material="steel" />
            </group>
          </group>
          <Part id="idler" name="Reverse idler" info={INFO.idler} cites={C.shuttle}>
            <group position={[IDLER.x, IDLER.y, ST.rev]}>
              <group ref={R.idler}>
                <PartMesh geometry={g.idler} material={pf(on.rev, 'steelDark')} />
              </group>
              <PartMesh geometry={g.idlerShaft} position={[0, 0, -ST.rev]} material="steel" />
            </group>
          </Part>
        </Part>

        <Part id="mainshaft" name="Mainshaft, constant-mesh gear & synchro units" role="moving" material="steel" info={INFO.main} cites={C.sync} explode={[0, -0.12, 0]}>
          <group position={[0, BOT, 0]}>
            <group ref={R.main}>
              <PartMesh geometry={g.main} material={pf(on.main, 'steel')} />
              <PartMesh geometry={g.cm} position={[0, 0, (ST.cmZ0 + ST.cmZ1) / 2]} rotation={[0, 0, PH_CM]} material={pf(on.main, 'steelDark')} />
              <Part id="synchros" name="Synchromesh units" material="steel" info={INFO.syncs} cites={C.sync}>
                <PartMesh geometry={g.hub} position={[0, 0, ST.hub12]} />
                <PartMesh geometry={g.hub} position={[0, 0, ST.hub34]} />
                {[0, 1].map((i) => (
                  <group
                    key={i}
                    ref={(el) => {
                      collars.current[i] = el
                    }}
                  >
                    <PartMesh geometry={g.collar} material="forged" />
                  </group>
                ))}
                {[0, 1, 2, 3].map((i) => (
                  <PartMesh key={`b${i}`} geometry={g.baulk} position={[0, 0, ST.g[i] + (i === 0 || i === 2 ? -1 : 1) * (GW / 2 + 0.01)]} material="brass" />
                ))}
              </Part>
            </group>
            <Part id="main-gears" name="Mainshaft gears 1st–4th (free)" material="steelDark" info={INFO.mg} cites={C.sync}>
              {mGeo.map((m, i) => (
                <group key={i} position={[0, 0, ST.g[i]]}>
                  <group
                    ref={(el) => {
                      mg.current[i] = el
                    }}
                  >
                    <PartMesh geometry={m.gear} material={pf(on.gear(i + 1), 'steelDark')} />
                    <PartMesh geometry={m.dog} material="steel" />
                    {m.cone ? <PartMesh geometry={m.cone} material="bronze" /> : null}
                  </group>
                </group>
              ))}
            </Part>
          </group>
        </Part>

        <Part id="layshaft" name="Hollow layshaft & range gears" role="moving" material="steel" info={INFO.lay} cites={C.layshaft} explode={[0, 0.14, 0]}>
          <group ref={R.lay}>
            <PartMesh geometry={g.lay} material={pf(on.lay, 'steel')} />
            {lGeo.map((l, i) => (
              <PartMesh key={i} geometry={l} position={[0, 0, ST.g[i]]} rotation={[0, 0, PH_L[i]]} material={pf(on.gear(i + 1), 'steelDark')} />
            ))}
            <PartMesh geometry={g.lh} position={[0, 0, ST.rangeH]} material={pf(on.rh, 'steelDark')} />
            <PartMesh geometry={g.ll} position={[0, 0, RANGE_L]} material={pf(on.rl, 'steelDark')} />
          </group>
        </Part>

        <Part id="output" name="Output shaft, range gear, transfer gear & pinion" role="moving" material="steel" info={INFO.output} cites={C.out} explode={[0, -0.1, 0.1]}>
          <group position={[0, BOT, 0]}>
            <group ref={R.output}>
              <PartMesh geometry={g.output} material={pf(out, 'steel')} />
              <Part id="range-gear" name="Range-change gear (sliding)" material="steelDark" info={INFO.range} cites={C.range}>
                <group ref={R.range}>
                  <PartMesh geometry={g.rangeCluster} material={pf(out, 'steelDark')} />
                </group>
              </Part>
              <PartMesh geometry={g.t1} position={[0, 0, ST.transfer]} material={pf(out && fourWD, 'steelDark')} />
              <PartMesh geometry={g.brakeDisc} position={[0, 0, ST.brake]} material="castIron" />
              <group position={PIN.position} quaternion={PIN.quaternion}>
                <PartMesh geometry={g.pinion} rotation={[0, 0, PIN.phase]} material={pf(out, 'forged')} />
              </group>
            </group>
            <Part id="parking-brake" name="Parking brake" role="static" material={park ? 'paintRed' : 'paintGrey'} info={INFO.brake} cites={C.fig}>
              <PartMesh geometry={g.caliper} position={[0, 0, ST.brake]} />
            </Part>
            <Part id="crown" name="Crown wheel & differential" role="moving" material="forged" info={INFO.crown} cites={C.out}>
              <group position={CRN.position} quaternion={CRN.quaternion}>
                <group ref={R.crown}>
                  <PartMesh geometry={g.crown} material={pf(out, 'forged')} />
                  <PartMesh geometry={g.diffCase} material="castIron" />
                  <PartMesh geometry={g.halfShafts} position={[0, 0, BEVEL.rc / Math.tan(BEVEL.g2)]} material="steel" />
                </group>
              </group>
            </Part>
          </group>
        </Part>

        <Part id="transfer" name="Transfer gear, 4WD clutch & front drive shaft" role="moving" material="steelDark" info={INFO.transfer} cites={C.fig} explode={[0, -0.12, 0]}>
          <group position={[0, FRONT_Y, 0]}>
            <group ref={R.transfer}>
              <PartMesh geometry={g.t2} position={[0, 0, ST.transfer]} material={pf(out && fourWD, 'steelDark')} />
              <PartMesh geometry={g.fourWD} material={fourWD ? 'forged' : 'steel'} />
            </group>
            <group ref={R.front}>
              <PartMesh geometry={g.front} material={pf(out && fourWD, 'steel')} />
              <PartMesh geometry={g.fourWDHub} material="steel" />
              <PartMesh geometry={g.fourWDPlates} material="friction" />
            </group>
          </group>
        </Part>

        <Part id="levers" name="Gear, range and shuttle levers" role="moving" material="paintBlack" info={INFO.levers} cites={C.fig} explode={[0, 0.15, 0]}>
          {(
            [
              [R.gearLever, 0.42, 0, 'plastic'],
              [R.rangeLever, 0.68, 0.07, 'paintRed'],
              [R.shuttleLever, 0.17, -0.07, 'paintYellow'],
            ] as const
          ).map(([ref, z, x], i) => (
            <group key={i} position={[x, 0.15, z]}>
              <PartMesh geometry={g.tower} material="castIron" />
              <group ref={ref} position={[0, 0.04, 0]}>
                <PartMesh geometry={g.lever} />
              </group>
            </group>
          ))}
        </Part>
      </Part>

      <PartLabel partId="speed-shift" at={[0, 0.13, SS.z]} />
      <PartLabel partId="shuttle" at={[0, 0.08, ST.fwd]} />
      <PartLabel partId="idler" at={[IDLER.x + 0.05, IDLER.y, ST.rev]} />
      <PartLabel partId="synchros" at={[0, BOT + 0.06, ST.hub34]} />
      <PartLabel partId="layshaft" at={[0, 0.11, 0.4]} />
      <PartLabel partId="pto-shaft" at={[0, 0.03, 0.9]} />
      <PartLabel partId="range-gear" at={[0, BOT - 0.13, RANGE_C]} />
      <PartLabel partId="transfer" at={[0, FRONT_Y - 0.09, ST.transfer]} />
      <PartLabel partId="parking-brake" at={[0, BOT + 0.1, ST.brake]} />
      <PartLabel partId="crown" at={[-0.06, BOT + 0.15, BEVEL.apexZ]} />
      <PartLabel partId="levers" at={[0, 0.42, 0.42]} />
    </group>
  )
}
