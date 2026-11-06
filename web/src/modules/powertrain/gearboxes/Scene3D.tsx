import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { PartLabel } from '@/render/Label'
import type { MaterialKey } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useLive } from '@/ui/live'
import { POWER } from '../common/anim'
import { placeBevelGear } from '@/parts/lib/driveline'
import { meshPhase, phaseToMeet } from '@/parts/lib/shapes'
import { BEVEL, BOTTOM_Y, CM, CM_TRAVEL, GW, IDLER, RANGE, SL, SLIDE, Z, type Gear } from './dims'
import { getGearboxGeometry } from './geometry'
import { live, makeGraph, shift, stepGearbox, targetPos, useGearbox } from './model'

const { PI } = Math
const DOWN = -PI / 2
const G1 = Math.atan2(IDLER.y, IDLER.x)
const G2 = Math.atan2(BOTTOM_Y - IDLER.y, -IDLER.x)
/** static phases of the gears on the bottom shaft and the idler (top gears at phase 0) */
const PH = {
  b1: meshPhase(Z.t1, 0, Z.b1, DOWN),
  b2: meshPhase(Z.t2, 0, Z.b2, DOWN),
  b3: meshPhase(Z.t3, 0, Z.b3, DOWN),
  idler: meshPhase(Z.tr, 0, Z.idler, G1),
  rhb: meshPhase(Z.rho, 0, Z.rhb, DOWN),
  rlb: meshPhase(Z.rlo, 0, Z.rlb, DOWN),
}
const PH_BR = meshPhase(Z.idler, PH.idler, Z.br, G2)
const APEX = new THREE.Vector3(0, 0, BEVEL.apexZ)
const PIN = placeBevelGear(APEX, new THREE.Vector3(0, 0, 1), BEVEL.rp, BEVEL.g1, new THREE.Vector3(-1, 0, 0), Z.pinion, true)
const CRN = placeBevelGear(APEX, new THREE.Vector3(1, 0, 0), BEVEL.rc, BEVEL.g2, new THREE.Vector3(0, 0, -1), Z.crown, false)

const CA = SL.b1 + SLIDE.d + SLIDE.s
const CB = SL.b3 + SLIDE.d + SLIDE.s
const CR = RANGE.h + SLIDE.d + SLIDE.s
const HUB_A = (CM.t1 + CM.t2) / 2
const HUB_B = (CM.t3 + CM.tr) / 2

const C = {
  sliding: [SRC.tts510('p6 Fig 33, p7 — sliding mesh'), SRC.pt510('p3 — sliding gear')],
  constant: [SRC.tts510('p7 — constant mesh'), SRC.pt510('p3 — collar shift')],
  synchro: [SRC.tts510('p4–5 — synchromesh'), SRC.pt510('p3 — synchromesh')],
  layout: [SRC.tts510('p4 — 6 or 8 forward, 2 reverse, two levers'), SRC.top510('p3–4 — D·N = d·n')],
  crown: [SRC.tts510('p7 — crown wheel and pinion')],
  lube: [SRC.tts510('p7 — SAE 40 or 50 gear oil, checked weekly')],
}

const INFO = {
  casing: { summary: 'Gearbox casing (sectioned and hatched).', role: 'Carries the shaft bearings and holds the oil. Many tractors combine gearbox and transmission housing with one oil supply.' },
  oil: { summary: 'Gear oil, SAE 40 or 50.', role: 'The bottom-shaft gears dip into it and splash the rest. Check the level every week.' },
  input: { summary: 'Top (input) shaft from the clutch.', role: 'Splined so that the sliding gears can be moved along it (sliding mesh), or carrying the hubs of the dog collars / synchronisers.' },
  bottom: { summary: 'Bottom shaft (countershaft).', role: 'Carries the fixed gears that the top-shaft gears mesh with, and the high and low range gears at its rear end.' },
  slide: { summary: 'Sliding gears (spur) on the splined top shaft.', role: 'Moved along the shaft by a selector fork until they mesh with a gear on the bottom shaft. Straight-toothed spur gears are rather noisy. Changed with the tractor stopped, or the teeth clash.' },
  free: { summary: 'Constant-mesh helical gears, free to turn on the top shaft.', role: 'Always in mesh with their partners. Nothing is driven until a dog collar locks one gear to its shaft. Helical teeth are quieter and stronger but cost more.' },
  collar: { summary: 'Sliding dog collar on a splined hub.', role: 'Its internal teeth slide over the dog teeth on the side of a gear and lock that gear to the shaft — a "special coupling".' },
  baulk: { summary: 'Synchroniser: cone on the gear and baulk ring.', role: 'As the sleeve moves, the baulk ring’s cone rubs on the gear’s cone and brings the two to the same speed; until they match, the baulk ring blocks the sleeve. Then the dog teeth slide in quietly, with both gears at the same speed.' },
  idler: { summary: 'Reverse idler gear.', role: 'An extra gear between top and bottom shafts: two meshes instead of one, so the output turns the other way.' },
  range: { summary: 'Range gears (high / low), sliding, non-synchromesh.', role: 'The second lever chooses high or low range — doubling three gears and reverse into 6F/2R. Changed only with the tractor stopped.' },
  output: { summary: 'Output shaft with the bevel pinion.', role: 'Spigoted into the end of the top shaft; carries the sliding range gears and drives the crown wheel.' },
  crown: { summary: 'Crown wheel, pinion and differential.', role: 'Turns the drive through 90° and gives a large reduction (47 : 11 = 4.27 : 1). Most tractors use helical bevel teeth; straight teeth drawn here.' },
  forks: { summary: 'Selector forks and rails.', role: 'Worked by the gear lever; each fork moves one sliding gear or collar. Interlocks stop two rails moving at once.' },
  lever: { summary: 'Gear lever (gate 1–2 / 3–R) and range lever (H–N–L).', role: 'One lever selects the gear, the other the speed range. One lever must be in neutral before most tractors can be started.' },
}

export function GearboxScene3D() {
  const g = getGearboxGeometry()
  const variant = useGearbox((s) => s.variant)
  const powerFlow = useGearbox((s) => s.powerFlow)
  const key = useLive(() => `${live.gear}|${live.range}|${live.clutch ? 1 : 0}`, 10)
  const [gear, range, clutchOn] = key.split('|') as [Gear, string, string]
  const graph = useMemo(makeGraph, [])
  const snap = useRef({ a: 0, b: 0, r: 0, aKey: '', bKey: '', rKey: '' })

  const top = useRef<THREE.Group>(null)
  const bottom = useRef<THREE.Group>(null)
  const idler = useRef<THREE.Group>(null)
  const output = useRef<THREE.Group>(null)
  const crown = useRef<THREE.Group>(null)
  const pinion = useRef<THREE.Group>(null)
  const clA = useRef<THREE.Group>(null)
  const clB = useRef<THREE.Group>(null)
  const clR = useRef<THREE.Group>(null)
  const free = useRef<(THREE.Group | null)[]>([])
  const collars = useRef<(THREE.Group | null)[]>([])
  const baulks = useRef<(THREE.Group | null)[]>([])
  const forks = useRef<(THREE.Group | null)[]>([])
  const mainLever = useRef<THREE.Group>(null)
  const rangeLever = useRef<THREE.Group>(null)

  useSimFrame((dt) => {
    stepGearbox(graph, dt)
    const s = useGearbox.getState()
    const th = (id: string) => graph.get(id).theta
    const sl = s.variant === 'sliding'
    top.current?.rotation.set(0, 0, th('top'))
    bottom.current?.rotation.set(0, 0, th('bottom'))
    idler.current?.rotation.set(0, 0, th('idler') + PH.idler)
    output.current?.rotation.set(0, 0, th('output'))
    crown.current?.rotation.set(0, 0, th('crown') + CRN.phase)
    pinion.current?.rotation.set(0, 0, PIN.phase)
    const p = shift.pos
    const sn = snap.current
    // sliding gears: re-phase a cluster as it slides into mesh so its teeth enter the tooth spaces
    if (sl) {
      const kA = p.a < -0.4 ? '1' : p.a > 0.4 ? '2' : ''
      if (kA && kA !== sn.aKey) sn.a = (kA === '1' ? phaseToMeet(Z.t1, Z.b1, th('bottom') + PH.b1, DOWN) : phaseToMeet(Z.t2, Z.b2, th('bottom') + PH.b2, DOWN)) - th('top')
      sn.aKey = kA
      const kB = p.b < -0.4 ? '3' : p.b > 0.4 ? 'R' : ''
      if (kB && kB !== sn.bKey) sn.b = (kB === '3' ? phaseToMeet(Z.t3, Z.b3, th('bottom') + PH.b3, DOWN) : phaseToMeet(Z.tr, Z.idler, th('idler') + PH.idler, G1)) - th('top')
      sn.bKey = kB
    }
    const kR = p.r < -0.4 ? 'H' : p.r > 0.4 ? 'L' : ''
    if (kR && kR !== sn.rKey) sn.r = (kR === 'H' ? phaseToMeet(Z.rho, Z.rhb, th('bottom') + PH.rhb, DOWN) : phaseToMeet(Z.rlo, Z.rlb, th('bottom') + PH.rlb, DOWN)) - th('output')
    sn.rKey = kR
    clA.current?.position.set(0, 0, CA + p.a * SLIDE.s)
    clA.current?.rotation.set(0, 0, sn.a)
    clB.current?.position.set(0, 0, CB + p.b * SLIDE.s)
    clB.current?.rotation.set(0, 0, sn.b)
    clR.current?.position.set(0, 0, CR + p.r * SLIDE.s)
    clR.current?.rotation.set(0, 0, sn.r)
    // constant mesh: free gears turn with their own bodies; collars slide (half-way onto the baulk ring while synchronising)
    ;(['t1', 't2', 't3', 'tr'] as const).forEach((id, i) => free.current[i]?.rotation.set(0, 0, th(id)))
    const want = targetPos(s.gear, s.range)
    const syncing = shift.phase === 'sync'
    const ca = p.a !== 0 ? p.a : syncing && want.a !== 0 ? want.a * 0.45 : 0
    const cb = p.b !== 0 ? p.b : syncing && want.b !== 0 ? want.b * 0.45 : 0
    collars.current[0]?.position.set(0, 0, HUB_A + ca * CM_TRAVEL)
    collars.current[1]?.position.set(0, 0, HUB_B + cb * CM_TRAVEL)
    baulks.current.forEach((b, i) => {
      if (!b) return
      const pos = i < 2 ? ca : cb
      const side = i % 2 === 0 ? -1 : 1
      const pushed = pos * side > 0.3 ? 0.0015 : 0
      b.position.z = side * pushed
    })
    const fa = sl ? CA + p.a * SLIDE.s : HUB_A + ca * CM_TRAVEL
    const fb = sl ? CB + p.b * SLIDE.s : HUB_B + cb * CM_TRAVEL
    forks.current[0]?.position.set(0, 0, fa)
    forks.current[1]?.position.set(0, 0, fb)
    forks.current[2]?.position.set(0, 0, CR + p.r * SLIDE.s)
    const plane = p.a !== 0 ? 1 : p.b !== 0 ? -1 : 0
    mainLever.current?.rotation.set(-(p.a !== 0 ? p.a : p.b) * 0.3, 0, plane * 0.18)
    rangeLever.current?.rotation.set(-p.r * 0.3, 0, 0)
  }, -1)

  const pf = (on: boolean, base: MaterialKey): MaterialKey => (powerFlow && on ? POWER : base)
  const driving = clutchOn === '1' || shift.phase === 'reclutch'
  const inGear = gear !== 'N' && range !== 'N'
  const on = {
    input: driving,
    g1: driving && gear === '1',
    g2: driving && gear === '2',
    g3: driving && gear === '3',
    gr: driving && gear === 'R',
    bottom: driving && gear !== 'N',
    rh: driving && inGear && range === 'H',
    rl: driving && inGear && range === 'L',
    out: driving && inGear,
  }
  const sl = variant === 'sliding'
  const syn = variant === 'synchro'
  const freeAt = [CM.t1, CM.t2, CM.t3, CM.tr]
  const freeGeo = [g.t1, g.t2, g.t3, g.tr]
  const freeOn = [on.g1, on.g2, on.g3, on.gr]
  const bot = sl
    ? [
        { geo: g.spurB1, z: SL.b1, ph: PH.b1, on: on.g1 },
        { geo: g.spurB2, z: SL.b2, ph: PH.b2, on: on.g2 },
        { geo: g.spurB3, z: SL.b3, ph: PH.b3, on: on.g3 },
        { geo: g.spurBR, z: SL.br, ph: PH_BR, on: on.gr },
      ]
    : [
        { geo: g.hB1, z: CM.t1, ph: PH.b1, on: on.g1 },
        { geo: g.hB2, z: CM.t2, ph: PH.b2, on: on.g2 },
        { geo: g.hB3, z: CM.t3, ph: PH.b3, on: on.g3 },
        { geo: g.hBR, z: CM.tr, ph: PH_BR, on: on.gr },
      ]
  const idlerZ = sl ? SL.br : CM.tr

  return (
    <group>
      <Part id="gearbox" name="Two-lever tractor gearbox (6F/2R)" role="moving" material="steel" info={{ summary: 'Three forward gears and reverse, doubled by a high/low range: 6 forward and 2 reverse speeds.', role: 'Provides a range of forward and reverse speeds and a neutral; the choice of gear also sets how much the tractor can pull (TTS p4).' }} cites={C.layout}>
        <Part id="casing" name="Gearbox casing" role="housing" material="castIron" info={INFO.casing} cites={C.lube} explode={[0, 0.3, 0]}>
          <PartMesh geometry={g.casing} />
          <PartMesh geometry={g.axleHousing} position={[0, 0, BEVEL.apexZ]} />
          <Part id="oil" name="Gear oil" role="fluid" material="oil" info={INFO.oil} cites={C.lube}>
            <PartMesh geometry={g.oil} />
          </Part>
        </Part>

        <Part id="input" name="Top (input) shaft" role="moving" material="steel" info={INFO.input} cites={sl ? C.sliding : C.constant}>
          <group ref={top}>
            <PartMesh geometry={sl ? g.input : g.inputPlain} material={pf(on.input, 'steel')} />
            {sl ? (
              <Part id="sliding-gears" name="Sliding gears" material="steelDark" info={INFO.slide} cites={C.sliding} explode={[0, 0.12, 0]}>
                <group ref={clA}>
                  <PartMesh geometry={g.clusterA.gears} material={pf(on.g1 || on.g2, 'steelDark')} />
                  <PartMesh geometry={g.clusterA.sleeve} material="steel" />
                </group>
                <group ref={clB}>
                  <PartMesh geometry={g.clusterB.gears} material={pf(on.g3 || on.gr, 'steelDark')} />
                  <PartMesh geometry={g.clusterB.sleeve} material="steel" />
                </group>
              </Part>
            ) : (
              <Part id="hubs" name={syn ? 'Synchroniser hubs, sleeves & baulk rings' : 'Dog-collar hubs & collars'} material="steel" info={syn ? INFO.baulk : INFO.collar} cites={syn ? C.synchro : C.constant} explode={[0, 0.12, 0]}>
                <PartMesh geometry={g.hub} position={[0, 0, HUB_A]} />
                <PartMesh geometry={g.hub} position={[0, 0, HUB_B]} />
                {[0, 1].map((i) => (
                  <group
                    key={i}
                    rotation={[0, 0, PI / 24]}
                    ref={(el) => {
                      collars.current[i] = el
                    }}
                  >
                    <PartMesh geometry={g.collar} material="forged" />
                  </group>
                ))}
              </Part>
            )}
          </group>
          {!sl
            ? freeGeo.map((fg, i) => (
                <Part key={i} id={`free-${['1', '2', '3', 'r'][i]}`} name={`${['1st', '2nd', '3rd', 'Reverse'][i]} gear (free on the shaft)`} material="steelDark" info={INFO.free} cites={C.constant}>
                  <group
                    position={[0, 0, freeAt[i]]}
                    ref={(el) => {
                      free.current[i] = el
                    }}
                  >
                    <PartMesh geometry={fg.gear} material={pf(freeOn[i], 'steelDark')} />
                    <PartMesh geometry={fg.dog} material="steel" />
                    {syn ? <PartMesh geometry={fg.cone} material="bronze" /> : null}
                  </group>
                  {syn ? (
                    <group position={[0, 0, freeAt[i] + (i % 2 === 0 ? 1 : -1) * (GW / 2 + 0.006 + 0.004)]}>
                      <group
                        ref={(el) => {
                          baulks.current[i] = el
                        }}
                      >
                        <PartMesh geometry={g.baulk} material="brass" />
                      </group>
                    </group>
                  ) : null}
                </Part>
              ))
            : null}
        </Part>

        <Part id="bottom" name="Bottom shaft & gears" role="moving" material="steel" info={INFO.bottom} cites={C.sliding}>
          <group position={[0, BOTTOM_Y, 0]}>
            <group ref={bottom}>
              <PartMesh geometry={g.bottom} material={pf(on.bottom, 'steel')} />
              {bot.map((b, i) => (
                <PartMesh key={i} geometry={b.geo} position={[0, 0, b.z]} rotation={[0, 0, b.ph]} material={pf(b.on, 'steelDark')} />
              ))}
              <Part id="range-bottom" name="Range gears (bottom shaft)" material="steelDark" info={INFO.range} cites={C.layout}>
                <PartMesh geometry={g.rhb} position={[0, 0, RANGE.h]} rotation={[0, 0, PH.rhb]} material={pf(on.rh, 'steelDark')} />
                <PartMesh geometry={g.rlb} position={[0, 0, RANGE.l]} rotation={[0, 0, PH.rlb]} material={pf(on.rl, 'steelDark')} />
              </Part>
            </group>
          </group>
        </Part>

        <Part id="idler" name="Reverse idler" role="moving" material="steelDark" info={INFO.idler} cites={C.sliding}>
          <group position={[IDLER.x, IDLER.y, idlerZ]}>
            {/* still: the stub shaft it turns on, and the boss holding it to the side wall */}
            <PartMesh geometry={g.idlerStub} material="steel" />
            <PartMesh geometry={g.idlerBoss} material="castIron" />
            <group ref={idler}>
              <PartMesh geometry={sl ? g.spurIdler : g.hIdler} material={pf(on.gr, 'steelDark')} />
            </group>
          </group>
        </Part>

        <Part id="output" name="Output shaft, range slider & pinion" role="moving" material="steel" info={INFO.output} cites={C.crown}>
          <group ref={output}>
            <PartMesh geometry={g.output} material={pf(on.out, 'steel')} />
            <Part id="range-gears" name="Range sliding gears (output)" material="steelDark" info={INFO.range} cites={C.layout} explode={[0, 0.1, 0]}>
              <group ref={clR}>
                <PartMesh geometry={g.clusterR.gears} material={pf(on.out, 'steelDark')} />
                <PartMesh geometry={g.clusterR.sleeve} material="steel" />
              </group>
            </Part>
            <group position={PIN.position} quaternion={PIN.quaternion}>
              <group ref={pinion}>
                <PartMesh geometry={g.pinion} material={pf(on.out, 'forged')} />
              </group>
            </group>
          </group>
        </Part>

        <Part id="crown" name="Crown wheel & differential" role="moving" material="forged" info={INFO.crown} cites={C.crown} explode={[-0.1, 0, 0.1]}>
          <group position={CRN.position} quaternion={CRN.quaternion}>
            <group ref={crown}>
              <PartMesh geometry={g.crown} material={pf(on.out, 'forged')} />
              <PartMesh geometry={g.diffCase} material="castIron" />
              <PartMesh geometry={g.halfShafts} position={[0, 0, BEVEL.rc / Math.tan(BEVEL.g2)]} material="steel" />
            </group>
          </group>
        </Part>

        <Part id="forks" name="Selector forks & rails" role="moving" material="forged" info={INFO.forks} cites={C.sliding} explode={[0, 0.2, 0]}>
          <PartMesh geometry={g.rails} material="steel" />
          {[sl ? g.forkSlide : g.forkCollarA, sl ? g.forkSlideB : g.forkCollarB, g.forkRange].map((fg, i) => (
            <group
              key={i}
              ref={(el) => {
                forks.current[i] = el
              }}
            >
              <PartMesh geometry={fg} />
            </group>
          ))}
        </Part>

        <Part id="levers" name="Gear & range levers" role="moving" material="paintBlack" info={INFO.lever} cites={C.layout} explode={[0, 0.15, 0]}>
          {/* the levers stand on the shift cover, which stays whole when the casing is cut open */}
          <PartMesh geometry={g.shiftCover} material="castIron" />
          <group position={[0, 0.142, 0.2]}>
            <PartMesh geometry={g.tower} rotation={[-PI / 2, 0, 0]} material="castIron" />
            <group ref={mainLever} position={[0, 0.05, 0]}>
              <PartMesh geometry={g.lever.ball} material="steel" />
              <PartMesh geometry={g.lever.stick} />
              <PartMesh geometry={g.lever.knob} material="plastic" />
            </group>
          </group>
          <group position={[0.07, 0.142, 0.46]}>
            <PartMesh geometry={g.tower} rotation={[-PI / 2, 0, 0]} material="castIron" />
            <group ref={rangeLever} position={[0, 0.05, 0]} scale={[0.8, 0.7, 0.8]}>
              <PartMesh geometry={g.lever.ball} material="steel" />
              <PartMesh geometry={g.lever.stick} />
              <PartMesh geometry={g.lever.knob} material="paintRed" />
            </group>
          </group>
        </Part>
      </Part>

      <PartLabel partId="input" at={[0, 0.03, -0.12]} />
      <PartLabel partId={sl ? 'sliding-gears' : 'hubs'} at={[0, 0.09, sl ? CA : HUB_A]} />
      <PartLabel partId="bottom" at={[0, BOTTOM_Y - 0.03, -0.03]} />
      <PartLabel partId="idler" at={[IDLER.x + 0.03, IDLER.y + 0.03, idlerZ]} />
      <PartLabel partId="range-gears" at={[0, 0.1, CR]} />
      <PartLabel partId="crown" at={[-0.05, 0.15, BEVEL.apexZ]} />
      <PartLabel partId="forks" at={[-0.04, 0.125, 0.1]} />
      <PartLabel partId="levers" at={[0, 0.45, 0.2]} />
      <PartLabel partId="oil" at={[0.1, -0.22, 0.3]} />
      <PartLabel partId="casing" at={[0.14, 0.12, 0.05]} />
      {!sl ? <PartLabel partId="free-2" at={[0, 0.07, CM.t2]} /> : null}
    </group>
  )
}
