import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Engine, type EnginePartKey, type EnginePartOverride } from '@/machines/Engine'
import { CRANK_DRILLINGS, PATHS, STRAINER, buildLubeGeometry } from './geometry'
import { BREATHER, CAM, CYL_X, DECK, FILTER, GAUGE, MAIN_X, PUMP, RELIEF, ROCKER, SUMP_OIL_Y, TROUGH, gaugeBar, live, operating, useLube } from './model'

const { PI } = Math
const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z)
const OIL_C = '#f0a830'

const C = {
  force: [SRC.tb509('§6, Fig 6.2 force-feed system (p35)'), SRC.supp509('lubrication system')],
  splash: [SRC.tb509('Fig 6.1 circulating splash system')],
  breather: [SRC.tb509('Fig 6.3 crankcase breather')],
  oil: [SRC.supp509('functions of oil; SAE grades'), SRC.add509('lubricating oils')],
  engine: [SRC.l4_509('parts description'), SRC.tb509('Fig 2.1')],
}

const INFO = {
  engine: { summary: 'Four-cylinder in-line diesel (100 × 124 mm, firing order 1-3-4-2), every part working, shown for its lubrication system.', details: 'Oil must reach the cylinder walls and pistons, gudgeon pins, main and big-end bearings, camshaft bearings and the valve gear.' },
  block: { summary: 'Cylinder block with the main oil gallery drilled along it.', role: 'Drillings from the gallery feed every main bearing and camshaft bearing; a riser feeds the rocker shaft.' },
  sump: { summary: 'Sump (oil pan) — the oil reservoir.', role: 'Holds the oil; oil returning from the bearings, cylinder walls and valve gear drains back here and cools.' },
  pump: { summary: 'Gear-type oil pump, driven from the camshaft.', role: 'Two meshing gears carry oil round the outside of the casing from the inlet to the outlet. Output rises with engine speed.' },
  strainer: { summary: 'Strainer (gauze) on the pick-up.', role: 'Stops large particles and sludge entering the pump.' },
  relief: { summary: 'Pressure-relief valve.', role: 'A spring-loaded plunger that opens when the pump pressure exceeds its setting and returns the surplus oil to the sump, protecting the filter, gauge and seals. Cold, thick oil and high speed make it open.' },
  filter: { summary: 'Full-flow oil filter.', role: 'All the oil from the pump passes through the element before it reaches the bearings, so dirt carried by the oil is removed.' },
  gallery: { summary: 'Main oil gallery and drilled oilways.', role: 'Distributes oil under pressure to the main bearings, camshaft bearings and rocker shaft.' },
  crank: { summary: 'Crankshaft with drilled oilways.', role: 'Oil enters each main journal and passes through drillings in the webs to the crank pins, lubricating the big-end bearings. Oil escaping from the big ends is flung onto the cylinder walls.' },
  rods: { summary: 'Connecting rods with big-end shells.', role: 'In the splash system the dipper (scoop) on each big-end cap dips into its trough every revolution and splashes oil over the moving parts.' },
  pistons: { summary: 'Pistons.', role: 'Lubricated by the oil thrown up onto the cylinder walls; the oil-control ring scrapes the surplus back.' },
  camshaft: { summary: 'Camshaft and its bearings.', role: 'Pressure-fed from the gallery; also drives the oil pump through crossed helical (skew) gears.' },
  rocker: { summary: 'Hollow rocker shaft.', role: 'Fed with oil from the riser drilling; oil leaks out at each rocker and drains back to the sump down the push-rod holes.' },
  gauge: { summary: 'Oil pressure gauge.', role: 'Shows the gallery pressure. Low pressure warns of a worn pump or bearings, low oil level or very hot, thin oil.' },
  troughs: { summary: 'Splash troughs.', role: 'Kept full by the pump in the circulating splash system; the dippers on the con-rods dip into them.' },
  breather: { summary: 'Crankcase breather pipe with filter.', role: 'Vents blow-by gas that leaks past the rings, so crankcase pressure does not force oil past the seals; the filter stops dust getting in.' },
}

/** the scene's ids, names, cards and sources for the shared engine's parts */
const IDS: Partial<Record<EnginePartKey, string>> = { crank: 'crankshaft', oil: 'sump-oil' }
const k = (key: EnginePartKey) => IDS[key] ?? key
const partsFor = (force: boolean): Partial<Record<EnginePartKey, EnginePartOverride>> => ({
  block: { name: 'Cylinder block & oil gallery', info: INFO.block, cites: C.force },
  'main-bearings': { name: 'Main bearing shells', info: { summary: 'Main bearing shells (white metal on steel).', role: 'Each is fed with oil from the gallery; the oil film keeps journal and shell apart.' }, cites: [SRC.m503(7, 'journal bearings')] },
  sump: { info: INFO.sump, cites: C.force },
  oil: { name: 'Oil in the sump', info: { summary: 'Engine oil.', role: 'Reduces friction, cools the bearings and pistons, seals the rings and cleans — carrying dirt away to the filter.' }, cites: C.oil },
  'rocker-shaft': { name: 'Rocker shaft (hollow)', info: INFO.rocker, cites: C.force },
  crank: { name: 'Crankshaft & oilways', info: INFO.crank, cites: C.force },
  camshaft: { name: 'Camshaft & skew gear', info: INFO.camshaft, cites: C.force },
  conrods: { info: INFO.rods, cites: force ? C.force : C.splash },
  pistons: { info: INFO.pistons, cites: C.engine },
})

export function Lube3D() {
  const g = buildLubeGeometry()
  const mode = useLube((s) => s.mode)
  const flows = useLube((s) => s.flows)
  const pumpA = useRef<THREE.Group>(null)
  const pumpB = useRef<THREE.Group>(null)
  const plunger = useRef<THREE.Group>(null)
  const rspring = useRef<THREE.Mesh>(null)
  const needle = useRef<THREE.Mesh>(null)
  const state = useRef({ bearing: 0, relief: 0, pump: 0, gauge: 0 })

  const sprays = useMemo(
    () =>
      CYL_X.flatMap((x) =>
        [-1, 1].map((s) => new THREE.CatmullRomCurve3([V(x, -0.01, 0), V(x + s * 0.02, 0.07, s * 0.02), V(x + s * 0.045, 0.18, s * 0.02), V(x + s * 0.048, 0.24, 0)])),
      ),
    [],
  )
  const splashes = useMemo(
    () => CYL_X.flatMap((x) => [-1, 1].map((s) => new THREE.CatmullRomCurve3([V(x, TROUGH.y, 0), V(x + s * 0.03, -0.04, s * 0.03), V(x + s * 0.045, 0.07, s * 0.04), V(x + s * 0.048, 0.18, 0)]))),
    [],
  )

  useSimFrame((dt) => {
    const st = useLube.getState()
    const w = (st.rpm * 2 * PI) / 60
    live.theta += w * dt
    const th = live.theta
    pumpA.current?.rotation.set(0, th / 2, 0)
    pumpB.current?.rotation.set(0, -th / 2, 0)
    const r = operating(st)
    const s = state.current
    s.pump = st.rpm > 0 ? Math.min(1, r.pumpLpm / 12) : 0
    s.bearing = st.rpm > 0 ? Math.min(1, r.bearingLpm / 9) : 0
    s.relief = st.rpm > 0 ? r.reliefOpen : 0
    const target = gaugeBar(st, r)
    s.gauge += (target - s.gauge) * Math.min(1, dt * 40)
    plunger.current?.position.set(0, s.relief * 0.004, 0)
    if (rspring.current) {
      rspring.current.position.y = 0.012 + s.relief * 0.004
      rspring.current.scale.y = 0.036 - (0.012 + s.relief * 0.004)
    }
    // gauge: 0 … 6 bar over 270°
    needle.current?.rotation.set(0, 0, PI * 0.75 - (Math.min(6, s.gauge) / 6) * PI * 1.5)
  })

  const force = mode === 'force'
  const fk = (k: () => number) => () => (useLube.getState().mode === 'force' ? k() : 0)
  const sk = (k: () => number) => () => (useLube.getState().mode === 'splash' ? k() : 0)
  const pumpK = () => state.current.pump
  const bearingK = () => state.current.bearing
  const reliefK = () => state.current.relief
  const runK = () => (useLube.getState().rpm > 0 ? Math.min(1, useLube.getState().rpm / 1500) : 0)

  return (
    <group>
      <Part id="engine" name="Four-cylinder engine" role="housing" material="castIron" info={INFO.engine} cites={C.engine}>
        {/* the shared engine, turned so its crank lies along X with cylinder 1 at the front (−X) */}
        <Engine
          rotation={[0, -PI / 2, 0]}
          crankAngle={() => live.theta}
          k={k}
          parts={partsFor(force)}
          gas={false}
          oilTop={SUMP_OIL_Y}
          crankParts={
            <Part id="crank-oil" name="Crankshaft oil drillings" material="oil" role="fluid" cut={false} info={INFO.crank}>
              <PartMesh geometry={g.crankOil} />
              {flows ? CRANK_DRILLINGS.map((c, i) => <Flow key={`k${i}`} curve={c} count={8} radius={0.0028} color={OIL_C} speed={1} spread={0.001} intensity={fk(bearingK)} />) : null}
            </Part>
          }
          camParts={<PartMesh geometry={g.camSkew} material="steelDark" />}
          rodParts={() => (force ? null : <PartMesh geometry={g.dipper} material="steel" />)}
        />
        {!force ? (
          <Part id="troughs" name="Splash troughs" material="paintGrey" role="static" info={INFO.troughs} cites={C.splash}>
            <PartMesh geometry={g.troughs} />
            <PartMesh geometry={g.troughOil} material="oil" />
            <PartMesh geometry={g.oilTroughFeed} material="oil" />
          </Part>
        ) : null}

        {/* oil system */}
        <Part id="oil-pump" name="Gear oil pump" material="castIron" role="housing" info={INFO.pump} cites={C.force} explode={[0, -0.1, -0.08]}>
          <PartMesh geometry={g.pumpBody} />
          <Part id="pump-gears" name="Pump gears & drive shaft" material="steelDark" role="moving" info={INFO.pump} cites={C.force}>
            <group ref={pumpA} position={[PUMP.x, PUMP.y, PUMP.z]}>
              <PartMesh geometry={g.pumpGear} />
              <PartMesh geometry={g.pumpShaft} material="steel" />
              <PartMesh geometry={g.skewPinion} position={[0, CAM.y - PUMP.y, 0]} />
            </group>
            <group ref={pumpB} position={[PUMP.x, PUMP.y, PUMP.z - PUMP.idleDz]}>
              <PartMesh geometry={g.pumpGear} />
            </group>
          </Part>
          <Part id="strainer" name="Strainer" material="brass" role="static" info={INFO.strainer} cites={C.force}>
            <group position={[STRAINER.x, STRAINER.y, STRAINER.z]}>
              <PartMesh geometry={g.gauze} />
              <PartMesh geometry={g.gauzeCap} material="steel" />
            </group>
          </Part>
        </Part>
        <Part id="relief-valve" name="Pressure-relief valve" material="brass" role="housing" info={INFO.relief} cites={C.force}>
          <group position={[RELIEF.x, RELIEF.y, RELIEF.z]}>
            <PartMesh geometry={g.reliefBody} />
            <Part id="relief-plunger" name="Relief plunger & spring" material="steel" role="moving" cut={false} info={INFO.relief}>
              <group ref={plunger}>
                <PartMesh geometry={g.reliefPlunger} />
              </group>
              <PartMesh ref={rspring} geometry={g.reliefSpring} material="steelDark" />
            </Part>
          </group>
        </Part>
        <Part id="oil-filter" name="Full-flow filter" material="paintBlue" role="housing" info={INFO.filter} cites={C.force} explode={[0, 0, -0.12]}>
          <group position={[FILTER.x, 0, FILTER.z]}>
            <PartMesh geometry={g.filterCan} />
            <PartMesh geometry={g.filterHead} material="castIron" />
            <Part id="filter-element" name="Filter element" material="nylon" role="static">
              <PartMesh geometry={g.filterElement} />
            </Part>
            <Part id="filter-oil" name="Oil in the filter" material="oil" role="fluid">
              <PartMesh geometry={g.filterOil} />
            </Part>
          </group>
        </Part>
        <Part id="oilways" name="Oil gallery & drillings" material="oil" role="fluid" info={INFO.gallery} cites={C.force}>
          <PartMesh geometry={g.oilPressure} />
          <PartMesh geometry={g.oilRocker} />
        </Part>
        <Part id="pressure-gauge" name="Oil pressure gauge" material="paintBlack" role="static" cut={false} info={INFO.gauge} cites={C.force}>
          <group position={[GAUGE.x, GAUGE.y, GAUGE.z]}>
            <PartMesh geometry={g.gaugeBody} />
            <PartMesh geometry={g.gaugeFace} material="ceramic" />
            <PartMesh geometry={g.gaugeTicks} material="paintBlack" />
            <PartMesh ref={needle} geometry={g.gaugeNeedle} material="paintRed" />
          </group>
        </Part>
        <Part id="breather" name="Crankcase breather" material="paintBlack" role="static" cut={false} info={INFO.breather} cites={C.breather}>
          <PartMesh geometry={g.breatherPipe} />
          <PartMesh geometry={g.breatherCan} material="galvanised" position={[BREATHER.x, BREATHER.y, BREATHER.z]} />
        </Part>

        {flows ? (
          <>
            <Flow curve={PATHS.inlet} count={14} radius={0.0034} color={OIL_C} speed={1} spread={0.002} intensity={pumpK} />
            <Flow curve={PATHS.pumpGears} count={24} radius={0.003} color={OIL_C} speed={0.8} spread={0.004} intensity={pumpK} />
            <Flow curve={PATHS.delivery} count={30} radius={0.0034} color={OIL_C} speed={0.7} spread={0.002} intensity={pumpK} />
            <Flow curve={PATHS.reliefBranch} count={10} radius={0.003} color={OIL_C} speed={0.8} spread={0.001} intensity={reliefK} />
            <Flow curve={PATHS.spill} count={16} radius={0.003} color="#ffcf5a" speed={0.8} spread={0.003} intensity={reliefK} />
            <Flow curve={PATHS.throughFilter} count={30} radius={0.003} color={OIL_C} speed={0.5} spread={0.003} intensity={fk(bearingK)} />
            <Flow curve={PATHS.toGallery} count={10} radius={0.0034} color={OIL_C} speed={0.8} spread={0.001} intensity={fk(bearingK)} />
            <Flow curve={PATHS.gallery} count={22} radius={0.0036} color={OIL_C} speed={0.5} spread={0.002} intensity={fk(bearingK)} />
            <Flow curve={PATHS.galleryRear} count={36} radius={0.0036} color={OIL_C} speed={0.35} spread={0.002} intensity={fk(bearingK)} />
            {PATHS.mains.map((c, i) => (
              <Flow key={`m${i}`} curve={c} count={8} radius={0.003} color={OIL_C} speed={0.9} spread={0.001} intensity={fk(bearingK)} />
            ))}
            {PATHS.cams.map((c, i) => (
              <Flow key={`c${i}`} curve={c} count={6} radius={0.0026} color={OIL_C} speed={0.9} spread={0.001} intensity={fk(bearingK)} />
            ))}
            <Flow curve={PATHS.riser} count={24} radius={0.003} color={OIL_C} speed={0.4} spread={0.001} intensity={fk(bearingK)} />
            <Flow curve={PATHS.rockerShaft} count={30} radius={0.0035} color={OIL_C} speed={0.4} spread={0.002} intensity={fk(bearingK)} />
            <Flow curve={PATHS.gaugeLine} count={10} radius={0.0024} color={OIL_C} speed={0.3} spread={0.001} intensity={fk(bearingK)} />
            {PATHS.drains.map((c, i) => (
              <Flow key={`d${i}`} curve={c} count={14} radius={0.0026} color="#c9862a" speed={0.35} spread={0.004} intensity={fk(bearingK)} />
            ))}
            {sprays.map((c, i) => (
              <Flow key={`s${i}`} curve={c} count={12} radius={0.0022} color="#ffd36b" speed={1.6} spread={0.012} intensity={fk(runK)} />
            ))}
            <Flow curve={PATHS.troughFeed} count={30} radius={0.003} color={OIL_C} speed={0.5} spread={0.002} intensity={sk(pumpK)} />
            {splashes.map((c, i) => (
              <Flow key={`p${i}`} curve={c} count={16} radius={0.0024} color="#ffd36b" speed={1.8} spread={0.02} intensity={sk(runK)} />
            ))}
            <Flow curve={PATHS.breather} count={30} radius={0.004} color="#b9c2c9" speed={0.25} spread={0.004} intensity={runK} />
          </>
        ) : null}
      </Part>

      <PartLabel partId="oil-pump" at={[PUMP.x - 0.02, PUMP.y - 0.04, PUMP.z + 0.05]} />
      <PartLabel partId="strainer" at={[STRAINER.x + 0.06, STRAINER.y - 0.01, STRAINER.z + 0.03]} />
      <PartLabel partId="relief-valve" at={[RELIEF.x + 0.03, RELIEF.y + 0.05, RELIEF.z + 0.03]} />
      <PartLabel partId="oil-filter" at={[FILTER.x, -0.13, FILTER.z]} />
      <PartLabel partId="oilways" at={[0.05, 0.05, -0.14]} text="Main oil gallery" />
      <PartLabel partId="crankshaft" at={[MAIN_X[2], -0.07, 0.06]} />
      <PartLabel partId="camshaft" at={[0.1, CAM.y + 0.03, CAM.z]} />
      <PartLabel partId="rocker-shaft" at={[0.1, ROCKER.y + 0.03, ROCKER.z]} />
      <PartLabel partId="pressure-gauge" at={[GAUGE.x, GAUGE.y + 0.07, GAUGE.z]} />
      <PartLabel partId="breather" at={[BREATHER.x + 0.03, BREATHER.y + 0.06, BREATHER.z]} />
      <PartLabel partId="sump" at={[0.2, -0.2, 0.1]} />
      <PartLabel partId="pistons" at={[CYL_X[1], DECK - 0.05, 0.06]} />
      {!force ? <PartLabel partId="troughs" at={[CYL_X[2], TROUGH.y + 0.01, 0.05]} /> : null}
    </group>
  )
}
