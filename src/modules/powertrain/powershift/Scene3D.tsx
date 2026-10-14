import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import type { MaterialKey } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useLive } from '@/ui/live'
import { POWER } from '../common/anim'
import { meshPhase } from '@/parts/lib/shapes'
import { CS_Y, IDLER, ST, Z } from './dims'
import { CIRCUIT, FEED_Z, PACKS, PACK_Z, PATHS, PISTON_Z, STROKE, getPSGeometry } from './geometry'
import { live, makeGraph, stepPS, usePS } from './model'

const { PI } = Math
const PH_B = meshPhase(Z.a, 0, Z.b, -PI / 2)
const PH_D = meshPhase(Z.c, 0, Z.d, PI / 2)
const G1 = Math.atan2(IDLER.y - CS_Y, IDLER.x)
const G2 = Math.atan2(-IDLER.y, -IDLER.x)
const PH_I = meshPhase(Z.e, 0, Z.idler, G1)
const PH_F = meshPhase(Z.idler, PH_I, Z.f, G2)

const C = {
  unit: [SRC.pt510('p4 — hydraulic assist; countershaft high-low, reverse, high-low-reverse')],
  pack: [SRC.pt510('p4 — clutch pack: disks splined to the drum, plates to the hub, piston')],
  oil: [SRC.pt510('p6 — hydraulic shift controls, open-centre oil circuit')],
}

const INFO = {
  unit: { summary: 'Hydraulic-assist (powershift) high-low-reverse countershaft unit with three clutches.', role: 'A train of gears kept in constant mesh; hydraulic clutches route the power to the selected gears "on the go", without interrupting the flow of power.' },
  casing: { summary: 'Transmission case (sectioned).', role: 'Also the reservoir for the oil.' },
  input: { summary: 'Input shaft with the input gear and the direct (high) clutch drum.', role: 'Driven by the engine. The input and output shafts are not connected unless the direct-drive clutch is engaged.' },
  output: { summary: 'Output shaft with the three clutch hubs.', role: 'Plates splined to the hubs; whichever clutch is applied drives it.' },
  counter: { summary: 'Underdrive countershaft.', role: 'Driven by the input gear. With the underdrive (low) clutch applied, power goes input → countershaft → low gear → output, slower than the input.' },
  idler: { summary: 'Reverse countershaft (idler).', role: 'One more mesh: with the reverse clutch applied the output turns the opposite way to the input.' },
  low: { summary: 'Low (underdrive) gear and clutch drum, free on the output shaft.', role: 'Always in mesh; locked to the output by the underdrive clutch.' },
  rev: { summary: 'Reverse gear and clutch drum, free on the output shaft.', role: 'Always in mesh through the idler; locked to the output by the reverse clutch.' },
  packH: { summary: 'Direct-drive (high) clutch pack.', role: 'Locks input to output: both shafts turn at the same speed — high speed with no reduction.' },
  packL: { summary: 'Underdrive (low) clutch pack.', role: 'Applied for low speed; the direct clutch is released at the same time.' },
  packR: { summary: 'Reverse clutch pack.', role: 'Applied for reverse; power goes through the countershafts so the output turns backwards.' },
  piston: { summary: 'Clutch piston.', role: 'Pressure oil pushes it against the disks and plates, clamping them together; when the pressure is released the return spring moves it away and the pack is freed.' },
  discs: { summary: 'Friction disks (splined to the drum) and steel plates (splined to the hub).', role: 'An alternating pack. Clamped, they lock drum and hub together. Here 4 disks + 4 plates and the backing plate: 8 friction surfaces.' },
  oil: { summary: 'Oil in the transmission case (reservoir).', role: 'Oil does two jobs: it lubricates and cools the clutches, and it engages them.' },
  screen: { summary: 'Reservoir screen.', role: 'The pump draws oil through it from the transmission case.' },
  pump: { summary: 'Transmission oil pump (open-centre).', role: 'Driven from the input; delivers oil whenever the engine runs.' },
  filter: { summary: 'Filter with its relief (bypass) valve.', role: 'Removes contaminants; the relief valve protects the filter from rupture.' },
  regulator: { summary: 'Pressure-regulator valve.', role: 'Needed because the pump is open-centre: it regulates the pressure in the pump discharge line. From here oil flows two ways — the lubricating route and the control route.' },
  shiftValve: { summary: 'Shift (selector) valve.', role: 'Worked by the operator’s lever: sends control oil to the clutch to be applied and opens the others to drain.' },
}

type Key = 'H' | 'L' | 'R'

export function PowershiftScene3D() {
  const g = getPSGeometry()
  const powerFlow = usePS((s) => s.powerFlow)
  const flows = usePS((s) => s.flows)
  const sel = useLive(() => live.sel, 10)
  const graph = useMemo(makeGraph, [])
  const prevE = useRef({ H: 1, L: 0, R: 0 })
  const fill = useRef({ H: 0, L: 0, R: 0 })
  const R = {
    input: useRef<THREE.Group>(null),
    output: useRef<THREE.Group>(null),
    counter: useRef<THREE.Group>(null),
    idler: useRef<THREE.Group>(null),
    low: useRef<THREE.Group>(null),
    rev: useRef<THREE.Group>(null),
  }
  const pistons = useRef<Record<Key, THREE.Group | null>>({ H: null, L: null, R: null })
  const stacks = useRef<Record<Key, THREE.Group | null>>({ H: null, L: null, R: null })
  const plates = useRef<Record<Key, THREE.Group | null>>({ H: null, L: null, R: null })

  useSimFrame((dt) => {
    stepPS(graph, dt)
    const th = (id: string) => graph.get(id).theta
    const rot = (r: RefObject<THREE.Group | null>, a: number) => r.current?.rotation.set(0, 0, a)
    rot(R.input, th('input'))
    rot(R.output, th('output'))
    rot(R.counter, th('counter'))
    rot(R.idler, th('idler') + PH_I)
    rot(R.low, th('low'))
    rot(R.rev, th('rev'))
    for (const k of ['H', 'L', 'R'] as Key[]) {
      const e = live.e[k]
      const p = PACKS[k]
      pistons.current[k]?.position.set(0, 0, p.z0 + p.dir * (PISTON_Z + e * STROKE))
      stacks.current[k]?.position.set(0, 0, p.z0 + p.dir * e * STROKE * 0.6)
      plates.current[k]?.position.set(0, 0, p.z0 + p.dir * e * STROKE * 0.6)
      fill.current[k] = dt > 0 ? Math.max(0, (e - prevE.current[k]) / dt) : 0
      prevE.current[k] = e
    }
  }, -1)

  const pf = (on: boolean, base: MaterialKey): MaterialKey => (powerFlow && on ? POWER : base)
  const low = sel === 'L'
  const rv = sel === 'R'
  const viaCounter = low || rv
  const curves = useMemo(
    () => ({
      suction: PATHS.suction(),
      pressure: PATHS.pressure(),
      toRegulator: PATHS.toRegulator(),
      relief: PATHS.relief(),
      control: PATHS.control(),
      lube: PATHS.lube(),
      H: PATHS.feed(FEED_Z.H),
      L: PATHS.feed(FEED_Z.L),
      R: PATHS.feed(FEED_Z.R),
    }),
    [],
  )
  const feedIntensity = (k: Key) => () => Math.min(1, 0.12 * live.e[k] + fill.current[k] * 0.4)

  const packParts = (k: Key, geo: typeof g.packH, info: { summary: string; role: string }, driveMat: MaterialKey, label: string) => (
    <Part id={`pack-${k}`} name={label} material="forged" info={info} cites={C.pack} explode={[0, 0.14, 0]}>
      <PartMesh geometry={geo.drum} material={driveMat} />
      <Part id={`piston-${k}`} name={`${label}: piston`} material="aluminium" info={INFO.piston} cites={C.pack}>
        <group
          ref={(el) => {
            pistons.current[k] = el
          }}
        >
          <PartMesh geometry={geo.piston} />
        </group>
      </Part>
      <Part id={`discs-${k}`} name={`${label}: friction disks`} material="friction" info={INFO.discs} cites={C.pack}>
        <group
          ref={(el) => {
            stacks.current[k] = el
          }}
        >
          <PartMesh geometry={geo.discs} />
        </group>
      </Part>
    </Part>
  )

  return (
    <group>
      <Part id="powershift" name="High-low-reverse powershift unit" role="moving" material="steel" info={INFO.unit} cites={C.unit}>
        <Part id="casing" name="Transmission case" role="housing" material="castIron" info={INFO.casing} cites={C.oil} explode={[0, 0.3, 0]}>
          <PartMesh geometry={g.casing} />
          <Part id="oil" name="Oil (case is the reservoir)" role="fluid" material="hydraulicOil" info={INFO.oil} cites={C.oil}>
            <PartMesh geometry={g.sump} />
          </Part>
        </Part>

        <Part id="input" name="Input shaft & direct clutch drum" role="moving" material="steel" info={INFO.input} cites={C.unit}>
          <group ref={R.input}>
            <PartMesh geometry={g.input} material={POWER} />
            <PartMesh geometry={g.inputGear} position={[0, 0, ST.a]} material={pf(viaCounter, 'steelDark')} />
            {packParts('H', g.packH, INFO.packH, pf(sel === 'H', 'forged'), 'Direct (high) clutch')}
          </group>
        </Part>

        <Part id="output" name="Output shaft & clutch hubs" role="moving" material="steel" info={INFO.output} cites={C.unit}>
          <group ref={R.output}>
            <PartMesh geometry={g.output} material={pf(sel !== 'N', 'steel')} />
            {(['H', 'L', 'R'] as Key[]).map((k) => (
              <group key={k}>
                <PartMesh geometry={g[`pack${k}` as 'packH'].hub} material="steel" />
                <group
                  ref={(el) => {
                    plates.current[k] = el
                  }}
                >
                  <PartMesh geometry={g[`pack${k}` as 'packH'].plates} material="steelDark" />
                </group>
              </group>
            ))}
          </group>
        </Part>

        <Part id="countershaft" name="Underdrive countershaft" role="moving" material="steel" info={INFO.counter} cites={C.unit} explode={[0, -0.1, 0]}>
          <group position={[0, CS_Y, 0]}>
            <group ref={R.counter}>
              <PartMesh geometry={g.counter} material={pf(viaCounter, 'steel')} />
              <PartMesh geometry={g.gb} position={[0, 0, ST.a]} rotation={[0, 0, PH_B]} material={pf(viaCounter, 'steelDark')} />
              <PartMesh geometry={g.gc} position={[0, 0, ST.d]} material={pf(low, 'steelDark')} />
              <PartMesh geometry={g.ge} position={[0, 0, ST.f]} material={pf(rv, 'steelDark')} />
            </group>
          </group>
        </Part>

        <Part id="reverse-countershaft" name="Reverse countershaft (idler)" role="moving" material="steelDark" info={INFO.idler} cites={C.unit} explode={[0.1, 0, 0]}>
          <group position={[IDLER.x, IDLER.y, ST.f]}>
            <group ref={R.idler}>
              <PartMesh geometry={g.idler} material={pf(rv, 'steelDark')} />
            </group>
            <PartMesh geometry={g.idlerShaft} position={[0, 0, -ST.f]} material="steel" />
          </group>
        </Part>

        <Part id="low-gear" name="Low gear & underdrive clutch" role="moving" material="steelDark" info={INFO.low} cites={C.unit}>
          <group ref={R.low}>
            <PartMesh geometry={g.low} position={[0, 0, ST.d]} rotation={[0, 0, PH_D]} material={pf(low, 'steelDark')} />
            {packParts('L', g.packL, INFO.packL, pf(low, 'forged'), 'Underdrive (low) clutch')}
          </group>
        </Part>

        <Part id="rev-gear" name="Reverse gear & reverse clutch" role="moving" material="steelDark" info={INFO.rev} cites={C.unit}>
          <group ref={R.rev}>
            <PartMesh geometry={g.rev} position={[0, 0, ST.f]} rotation={[0, 0, PH_F]} material={pf(rv, 'steelDark')} />
            {packParts('R', g.packR, INFO.packR, pf(rv, 'forged'), 'Reverse clutch')}
          </group>
        </Part>

        <Part id="oil-circuit" name="Shift-oil circuit (open-centre)" role="static" material="paintGrey" cut={false} info={{ summary: 'Open-centre shift-oil circuit.', role: 'Case (reservoir) → screen → pump → filter (relief valve) → pressure regulator → lubrication route and control route (PT p6).' }} cites={C.oil} explode={[0.15, 0, 0]}>
          <Part id="screen" name="Reservoir screen" material="galvanised" info={INFO.screen} cites={C.oil}>
            <PartMesh geometry={g.circuit.screen} />
          </Part>
          <Part id="pump" name="Oil pump" material="paintGrey" info={INFO.pump} cites={C.oil}>
            <PartMesh geometry={g.circuit.pump} />
          </Part>
          <Part id="filter" name="Filter & relief valve" material="paintBlue" info={INFO.filter} cites={C.oil}>
            <PartMesh geometry={g.circuit.filter} />
            <PartMesh geometry={g.circuit.relief} material="brass" />
          </Part>
          <Part id="regulator" name="Pressure-regulator valve" material="castIron" info={INFO.regulator} cites={C.oil}>
            <PartMesh geometry={g.circuit.regulator} />
          </Part>
          <Part id="shift-valve" name="Shift valve" material="castIron" info={INFO.shiftValve} cites={C.oil}>
            <PartMesh geometry={g.circuit.shiftValve} />
            <PartMesh geometry={g.circuit.spool} material="chrome" />
          </Part>
          <Part id="pipes" name="Oil lines" material="copper">
            <PartMesh geometry={g.circuit.pipes} />
            <PartMesh geometry={g.circuit.feeds} />
          </Part>
        </Part>

        {flows ? (
          <>
            <Flow curve={curves.suction} count={30} radius={0.004} color="#c98d22" speed={0.6} spread={0.005} intensity={() => 0.7} />
            <Flow curve={curves.pressure} count={10} radius={0.004} color="#cf5a3f" speed={0.9} spread={0.004} intensity={() => 0.8} />
            <Flow curve={curves.toRegulator} count={10} radius={0.004} color="#cf5a3f" speed={0.9} spread={0.004} intensity={() => 0.8} />
            <Flow curve={curves.relief} count={14} radius={0.003} color="#e8a05a" speed={0.5} spread={0.003} intensity={() => 0.08} />
            <Flow curve={curves.control} count={10} radius={0.004} color="#cf5a3f" speed={0.9} spread={0.004} intensity={() => 0.6} />
            <Flow curve={curves.lube} count={36} radius={0.0032} color="#e0c27a" speed={0.5} spread={0.004} intensity={() => 0.5} />
            {(['H', 'L', 'R'] as Key[]).map((k) => (
              <Flow key={k} curve={curves[k]} count={26} radius={0.0035} color="#ff6a3d" speed={1.1} spread={0.003} intensity={feedIntensity(k)} />
            ))}
          </>
        ) : null}
      </Part>

      <PartLabel partId="pack-H" at={[0, 0.1, PACKS.H.z0 + 0.03]} />
      <PartLabel partId="pack-L" at={[0, 0.1, PACKS.L.z0 + 0.03]} />
      <PartLabel partId="pack-R" at={[0, 0.1, PACKS.R.z0 - 0.03]} />
      <PartLabel partId="countershaft" at={[0, CS_Y - 0.09, 0.1]} />
      <PartLabel partId="reverse-countershaft" at={[IDLER.x + 0.05, IDLER.y, ST.f]} />
      <PartLabel partId="pump" at={[CIRCUIT.pump.x + 0.05, CIRCUIT.pump.y, CIRCUIT.pump.z]} />
      <PartLabel partId="filter" at={[CIRCUIT.filter.x + 0.05, CIRCUIT.filter.y + 0.05, CIRCUIT.filter.z]} />
      <PartLabel partId="regulator" at={[CIRCUIT.regulator.x + 0.05, CIRCUIT.regulator.y, CIRCUIT.regulator.z]} />
      <PartLabel partId="shift-valve" at={[CIRCUIT.shiftValve.x + 0.05, CIRCUIT.shiftValve.y + 0.03, CIRCUIT.shiftValve.z]} />
      <PartLabel partId="screen" at={[CIRCUIT.screen.x, CIRCUIT.screen.y + 0.04, CIRCUIT.screen.z]} />
      <PartLabel partId="input" at={[0, 0.04, -0.14]} />
      <PartLabel partId="oil" at={[-0.05, -0.22, 0.42]} />
    </group>
  )
}

export { PACK_Z }
