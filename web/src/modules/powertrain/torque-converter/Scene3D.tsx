import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { DriveGraph, brake, coupling } from '@/core/drive'
import { useSimFrame } from '@/core/sim'
import { vortexShare } from '@/physics/transmission'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { rotaryRing, tcGeometry, vortexLoop } from './geometry'
import { SPEC, TC, live, radToRpm, rpmToRad, useTc } from './model'

const C = [SRC.pt510('p8–11 (PDF p9–11) torque converter'), SRC.pt510('p10 block diagram, element table')]

const INFO = {
  tc: {
    summary: 'Three-element hydrodynamic torque converter (1 pump, 1 stator, 1 turbine — design D in the table of converter designs).',
    role: 'Transmits engine torque by the motion of high-speed, low-pressure oil. It acts as a clutch (connecting and disconnecting engine and gear train) and as a transmission, shifting smoothly through an infinite number of ratios.',
    details: 'Sizes are typical values.',
  },
  impeller: {
    summary: 'Pump (impeller), welded to the front cover and driven by the engine.',
    role: 'Its blades fling the oil outward and across into the turbine — the start of the vortex flow.',
  },
  cover: { summary: 'Front cover.', role: 'Bolted to the engine flywheel and welded to the impeller, so the casing turns at engine speed and holds the oil.' },
  turbine: {
    summary: 'Turbine, splined to the output shaft.',
    role: 'Oil from the impeller strikes its blades and turns it, then flows inward and back out through the stator.',
  },
  stator: {
    summary: 'Stator on a one-way clutch.',
    role: 'The "fluid fulcrum". Held still by its one-way clutch, its blades turn the oil leaving the turbine so it re-enters the pump in the pump’s direction of rotation — adding to the pump’s own velocity. This regenerating action multiplies the torque.',
  },
  clutch: { summary: 'One-way (overrunning) clutch: rollers between the stator hub and the stationary sleeve.', role: 'Locks the stator when the oil pushes it backwards (converter range); lets it freewheel once the flow strikes its back (coupling range).' },
  sleeve: { summary: 'Stationary stator sleeve (reaction shaft).', role: 'Fixed to the transmission case; takes the stator reaction torque.' },
  shaft: { summary: 'Turbine (output) shaft.', role: 'To the range gears (a simple planetary set — reverse is needed because the converter turns only one way) and the final drive.' },
  housing: { summary: 'Converter (bell) housing.', role: 'Stationary casing between engine and transmission; sectioned here.' },
  flywheel: { summary: 'Flex plate (drive plate) with the starter ring gear.', role: 'Bolted to the crankshaft; drives the converter cover. A converter needs no heavy flywheel: its own oil-filled mass smooths the engine.' },
  oil: { summary: 'Converter oil.', role: 'Oil flow lubricates, oil pressure engages, and oil velocity drives the turbine.' },
}

export function Tc3D() {
  const g = tcGeometry()
  const flows = useTc((s) => s.flows)
  const impeller = useRef<THREE.Group>(null)
  const turbine = useRef<THREE.Group>(null)
  const stator = useRef<THREE.Group>(null)
  const fluid = useRef<THREE.Group>(null)
  const graph = useMemo(() => {
    const d = new DriveGraph()
    d.body('impeller')
    d.body('turbine')
    d.body('stator', 2)
    const held = () => useTc.getState().SR < SPEC.couplingSR
    d.add({ id: 'slip', rows: () => [{ c: { turbine: 1, impeller: -useTc.getState().SR }, rhs: 0 }] })
    d.add(brake('one-way', 'stator', held))
    d.add(coupling('freewheel', 'stator', 'turbine', () => !held()))
    return d
  }, [])
  const loops = useMemo(() => Array.from({ length: 10 }, (_, k) => vortexLoop((2 * Math.PI * k) / 10 + 0.15)), [])
  const rings = useMemo(() => [rotaryRing(TC.RC + 0.045, 0.02), rotaryRing(TC.RC + 0.045, -0.02), rotaryRing(TC.RC, 0.05), rotaryRing(TC.RC, -0.05)], [])

  useSimFrame((dt) => {
    const st = useTc.getState()
    graph.drive('impeller', rpmToRad(st.rpm))
    graph.step(dt)
    const th = (id: string) => graph.get(id).theta
    impeller.current?.rotation.set(0, 0, th('impeller'))
    turbine.current?.rotation.set(0, 0, th('turbine'))
    stator.current?.rotation.set(0, 0, th('stator'))
    // the oil turns round the axis roughly at the mean of pump and turbine speed (rotary flow)
    fluid.current?.rotation.set(0, 0, (th('impeller') + th('turbine')) / 2)
    live.impeller = radToRpm(graph.get('impeller').omega)
    live.turbine = radToRpm(graph.get('turbine').omega)
    live.stator = radToRpm(graph.get('stator').omega)
  }, -1)

  const vortex = () => vortexShare(useTc.getState().SR)
  return (
    <group>
      <Part id="tc" name="Torque converter" role="moving" material="steel" info={INFO.tc} cites={C}>
        <Part id="housing" name="Converter housing" role="housing" material="castIron" info={INFO.housing} explode={[0, 0.3, 0]}>
          <PartMesh geometry={g.housing} />
        </Part>
        <group ref={impeller}>
          <Part id="impeller" name="Pump (impeller)" material="steel" cut info={INFO.impeller} cites={C} explode={[0, 0, 0.12]}>
            <PartMesh geometry={g.impellerShell} />
            <PartMesh geometry={g.impellerCore} />
            <PartMesh geometry={g.impellerBlades} material="steelDark" />
            <PartMesh geometry={g.impellerHub} material="forged" />
          </Part>
          <Part id="cover" name="Front cover" material="steelDark" cut info={INFO.cover} cites={C} explode={[0, 0, -0.18]}>
            <PartMesh geometry={g.cover} />
          </Part>
          <Part id="flywheel" name="Flex plate & ring gear" material="steel" info={INFO.flywheel} explode={[0, 0, -0.26]}>
            <PartMesh geometry={g.flywheel.plate} />
            <PartMesh geometry={g.flywheel.ring} material="steelDark" />
            <PartMesh geometry={g.flywheel.crank} material="forged" />
          </Part>
        </group>
        <group ref={turbine}>
          <Part id="turbine" name="Turbine" material="aluminium" cut info={INFO.turbine} cites={C} explode={[0, 0, -0.08]}>
            <PartMesh geometry={g.turbineShell} />
            <PartMesh geometry={g.turbineCore} />
            <PartMesh geometry={g.turbineBlades} material="steel" />
            <PartMesh geometry={g.turbineHub} material="forged" />
          </Part>
          <Part id="output-shaft" name="Turbine (output) shaft" material="forged" info={INFO.shaft} cites={[SRC.pt510('p11 full TC transmission')]} explode={[0, 0, 0.2]}>
            <PartMesh geometry={g.shaft} />
          </Part>
        </group>
        <group ref={stator}>
          <Part id="stator" name="Stator" material="bronze" info={INFO.stator} cites={C} explode={[0, 0.16, 0]}>
            <PartMesh geometry={g.stator} />
          </Part>
        </group>
        <Part id="one-way" name="One-way clutch" role="static" material="steel" info={INFO.clutch} cites={[SRC.pt510('p2 overrunning clutch'), SRC.beyond('stator one-way clutch')]} explode={[0, 0.1, 0]}>
          {Array.from({ length: 12 }, (_, k) => {
            const a = (2 * Math.PI * k) / 12
            return <PartMesh key={k} geometry={g.roller} position={[TC.rollerR * Math.cos(a), TC.rollerR * Math.sin(a), 0]} />
          })}
        </Part>
        <Part id="sleeve" name="Stator sleeve" role="static" material="steelDark" info={INFO.sleeve} explode={[0, 0, 0.3]}>
          <PartMesh geometry={g.sleeve} />
        </Part>
      </Part>
      {flows ? (
        <group ref={fluid}>
          {loops.map((c, k) => (
            <Flow key={k} curve={c} count={34} radius={0.0042} color="#e8a23a" speed={3} spread={0.012} intensity={vortex} />
          ))}
          {rings.map((c, k) => (
            <Flow key={`r${k}`} curve={c} count={40} radius={0.0042} color="#7fc4ff" speed={0.0001} spread={0.01} intensity={() => 1 - vortex()} />
          ))}
        </group>
      ) : null}
      <PartLabel partId="impeller" at={[0, TC.RC + 0.05, 0.06]} />
      <PartLabel partId="turbine" at={[0, TC.RC + 0.05, -0.06]} />
      <PartLabel partId="stator" at={[0, TC.statorR1 - 0.01, 0]} />
      <PartLabel partId="one-way" at={[0.02, 0.03, 0.02]} />
      <PartLabel partId="cover" at={[0, 0.19, -0.11]} />
      <PartLabel partId="output-shaft" at={[0, 0.03, 0.27]} />
      <PartLabel partId="housing" at={[0, TC.housingR + 0.01, 0.1]} />
      <PartLabel partId="flywheel" at={[0, 0.2, -0.16]} />
    </group>
  )
}
