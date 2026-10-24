import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { rpmToRad, radToRpm } from '@/physics/joints'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { clutchGeometry, engineGeometry, flywheelGeometry, gearX, shaftsGeometry, staticGeometry, stubGeometry, wheelGeometry } from './geometry'
import { AX, AXLE_X, FINAL, HOUSING, ROLLING_R, STUBS, Z, createDriveline, liveEngaged, live, mainEngaged, usePto, type BodyId } from './model'

const { PI } = Math

export const C = {
  types: [SRC.pt510('p2–3 PTO types'), SRC.tts510('p10 PTO, ground-speed PTO')],
  std: [SRC.tts510('p10 standards, 540/1000 rpm, splines'), SRC.pto502('540 rpm 6-spline')],
  clutch: [SRC.tts510('p2–3 clutch, dual clutch for live PTO'), SRC.top510('p6 Fig A2.9 dual clutch')],
  ipto: [SRC.top510('p7 Fig A2.10 independent PTO clutch'), SRC.pt510('p3 independent PTO')],
  line: [SRC.tts510('p1–2 Fig 30 line of drive'), SRC.top510('p3 Fig A2.6 hollow layshaft carrying the PTO drive')],
  gearbox: [SRC.pt510('p3 sliding gear, constant mesh'), SRC.tts510('p6–7 Fig 33')],
  guard: [SRC.tts510('p10 guarding'), SRC.pto502('master shield')],
}

const INFO = {
  root: {
    summary: 'Simplified tractor driveline, cut open to compare PTO drives.',
    details: 'Schematic: one forward and one reverse gear, one rear wheel, the hub final reduction not drawn. Shaft heights are compressed so the whole power path fits one view.',
  },
  engine: { summary: 'Diesel engine.', role: 'Turns the flywheel at the engine speed set on the panel.' },
  flywheel: { summary: 'Flywheel, clutch cover and pressure plates.', role: 'Turn with the engine. The springs in the cover clamp each driven plate against the flywheel (or the next plate) until the pedal releases it.' },
  mainDisc: { summary: 'Transmission clutch plate.', role: 'Splined to the gearbox input shaft. Pressing the pedal frees it, stopping the drive to the wheels — and, for a transmission PTO, the PTO too.' },
  ptoDisc: {
    summary: 'PTO clutch plate (second stage of a dual clutch).',
    role: 'Splined to the hollow PTO shaft. The first half of pedal travel releases only the transmission plate; the second half releases this one as well.',
  },
  flange: { summary: 'PTO drive plate.', role: 'Splined to the clutch cover, so the independent PTO’s drive shaft turns whenever the engine runs, whatever the clutch pedal does; its own clutch is at the rear.' },
  input: { summary: 'Gearbox input shaft.', role: 'Carries the constant-mesh pinion that drives the layshaft (20 : 40).' },
  hollow: { summary: 'Hollow PTO shaft.', role: 'Runs round the input shaft and drives the PTO drive shaft (20 : 40), independently of the transmission clutch.' },
  lay: { summary: 'Layshaft (hollow).', role: 'Driven by the constant-mesh pair; carries the first-gear and reverse gears. For a transmission PTO it drives the PTO countershaft through a dog clutch.' },
  ptoDrive: { summary: 'PTO drive shaft.', role: 'Passes through the hollow layshaft to the PTO countershaft at the rear — the arrangement of the MF 16-speed box.' },
  idler: { summary: 'Reverse idler.', role: 'Puts an extra gear in the train so the output shaft turns the other way.' },
  output: { summary: 'Output (main) shaft with sliding gear and bevel pinion.', role: 'The sliding gear meshes first gear, neutral or reverse. For a ground-speed PTO a gear on this shaft drives the PTO.' },
  crown: { summary: 'Crown wheel, differential and half shaft.', role: 'Turn the drive through 90° to the wheel (9 : 37 reduction).' },
  wheel: { summary: 'Rear driving wheel.', role: 'Travel speed is set by engine speed and the overall ratio (a 5.7 : 1 hub reduction, not drawn, is assumed).' },
  ptoUp: { summary: 'PTO countershaft.', role: 'Collects drive from the layshaft, the PTO drive shaft or the output shaft (depending on PTO type) and carries the two-speed PTO gears.' },
  collar: { summary: 'PTO engagement (dog) clutch.', role: 'The PTO lever slides it to couple the PTO countershaft. Engage it with the tractor clutch pressed.' },
  ipto: {
    summary: 'Independent PTO clutch: wet multi-plate pack.',
    role: 'Oil pressure on a piston clamps the plates; its own control engages or stops the PTO at any time, even on the move. Released, the PTO shaft is braked automatically.',
  },
  lower: { summary: 'PTO output shaft with sliding two-speed gear.', role: 'Shifting the double gear selects the 540 or 1000 rpm ratio.' },
  stub: { summary: 'PTO stub (splined shaft end).', role: 'The implement’s PTO shaft yoke slides on and locks here. Rotation is clockwise viewed from the rear.' },
  gearbox: { summary: 'Gearbox and centre housing.', role: 'Encloses the gears in oil; the PTO stub leaves the rear face.' },
  bell: { summary: 'Clutch (bell) housing.', role: 'Encloses flywheel and clutches between engine and gearbox.' },
  trumpet: { summary: 'Axle (trumpet) housing.', role: 'Carries the half shaft out to the wheel hub.' },
  shield: { summary: 'PTO master shield.', role: 'Covers the stub and the first joint of the implement shaft. It must be strong enough to stand on (114 kg).' },
}

interface GearSpec {
  id: string
  body: BodyId
  teeth: number
  axis: keyof typeof AX
  bore: number
}

const GEARS: GearSpec[] = [
  { id: 'G1', body: 'trans', teeth: Z.input[0], axis: 'top', bore: 0.0182 },
  { id: 'G2', body: 'lay', teeth: Z.input[1], axis: 'lay', bore: 0.0222 },
  { id: 'H1', body: 'hollow', teeth: Z.ptoIn[0], axis: 'top', bore: 0.0302 },
  { id: 'H2', body: 'ptoDrive', teeth: Z.ptoIn[1], axis: 'lay', bore: 0.0112 },
  { id: 'G3', body: 'lay', teeth: Z.first[0], axis: 'lay', bore: 0.0222 },
  { id: 'G4', body: 'out', teeth: Z.first[1], axis: 'top', bore: 0.0182 },
  { id: 'G5', body: 'lay', teeth: Z.reverse[0], axis: 'lay', bore: 0.0222 },
  { id: 'I', body: 'idler', teeth: Z.reverse[1], axis: 'idler', bore: 0.0092 },
  { id: 'GS', body: 'out', teeth: Z.ground[0], axis: 'top', bore: 0.0182 },
  { id: 'GU', body: 'ptoUp', teeth: Z.ground[1], axis: 'lay', bore: 0.0152 },
  { id: 'U5', body: 'ptoUp', teeth: Z.pto540[0], axis: 'lay', bore: 0.0152 },
  { id: 'U1', body: 'ptoUp', teeth: Z.pto1000[0], axis: 'lay', bore: 0.0152 },
  { id: 'L5', body: 'pto', teeth: Z.pto540[1], axis: 'pto', bore: 0.0162 },
  { id: 'L1', body: 'pto', teeth: Z.pto1000[1], axis: 'pto', bore: 0.0162 },
]
const GEAR = Object.fromEntries(GEARS.map((g) => [g.id, g])) as Record<string, GearSpec>

/** Meshes, in power-flow order, used to phase the teeth of each driven gear. */
const MESHES: { a: string; b: string; active: () => boolean }[] = [
  { a: 'G1', b: 'G2', active: () => true },
  { a: 'H1', b: 'H2', active: () => true },
  { a: 'G5', b: 'I', active: () => true },
  { a: 'G3', b: 'G4', active: () => usePto.getState().gear === 'F' },
  { a: 'I', b: 'G4', active: () => usePto.getState().gear === 'R' },
  { a: 'GS', b: 'GU', active: () => usePto.getState().type === 'ground' && usePto.getState().lever },
  { a: 'U5', b: 'L5', active: () => usePto.getState().std === '540' },
  { a: 'U1', b: 'L1', active: () => usePto.getState().std !== '540' },
]

/** Direction from gear a to gear b in the gear's tooth-angle convention (0 = −Z, +π/2 = +Y). */
function lineOfCentres(a: GearSpec, b: GearSpec) {
  const A = AX[a.axis]
  const B = AX[b.axis]
  return Math.atan2(B.y - A.y, -(B.z - A.z))
}

/** Base axial positions; sliding gears move from these. */
const GX: Record<string, number> = { G1: 0.18, G2: 0.18, H1: 0.27, H2: 0.27, G3: 0, G4: 0, G5: -0.12, I: -0.12, GS: -0.18, GU: -0.18, U5: -0.26, U1: -0.31, L5: -0.26, L1: -0.35 }

export function PtoTypes3D() {
  const st = usePto()
  const G = useMemo(() => {
    const gears = Object.fromEntries(GEARS.map((g) => [g.id, gearX(g.teeth, g.bore)])) as Record<string, THREE.BufferGeometry>
    return { gears, engine: engineGeometry(), flywheel: flywheelGeometry(), stat: staticGeometry(), clutch: clutchGeometry(), shafts: shaftsGeometry(), wheel: wheelGeometry() }
  }, [])
  const stub = useMemo(() => stubGeometry(st.std), [st.std])

  const graph = useMemo(() => createDriveline(() => usePto.getState()), [])
  const bodyRef = useRef<Partial<Record<BodyId, THREE.Group | null>>>({})
  const gearRef = useRef<Record<string, THREE.Group | null>>({})
  const offsets = useRef<Record<string, number>>({})
  const slide = useRef({ G4: 0, GU: -0.035, L: 0, collar: 0, main: 0, pto: 0 })
  const refs = {
    mainPlate: useRef<THREE.Group>(null),
    mainDisc: useRef<THREE.Group>(null),
    ptoPlate: useRef<THREE.Group>(null),
    ptoDisc: useRef<THREE.Group>(null),
    collar: useRef<THREE.Group>(null),
    wheel: useRef<THREE.Group>(null),
  }

  useSimFrame((dt) => {
    const p = usePto.getState()
    graph.drive('engine', rpmToRad(p.rpm))
    if (dt > 0) graph.step(dt)
    const th = (id: BodyId) => graph.get(id).theta
    for (const id of Object.keys(bodyRef.current) as BodyId[]) {
      const o = bodyRef.current[id]
      if (!o) continue
      if (id === 'crown') o.rotation.set(0, 0, th('crown'))
      else o.rotation.set(th(id), 0, 0)
    }
    refs.wheel.current?.rotation.set(0, 0, th('crown') / FINAL)

    // tooth phasing: each driven gear is set from its driver so the teeth stay in mesh
    const ang = (id: string) => th(GEAR[id].body) + (offsets.current[id] ?? 0)
    for (const m of MESHES) {
      if (!m.active()) continue
      const a = GEAR[m.a]
      const b = GEAR[m.b]
      const g = lineOfCentres(a, b)
      const want = g + PI - PI / b.teeth - (a.teeth / b.teeth) * (ang(m.a) - g)
      offsets.current[m.b] = want - th(b.body)
    }

    // sliding members ease to their positions
    const k = 1 - Math.exp(-Math.min(dt * 50, 0.4) * 2)
    const s = slide.current
    const ease = (cur: number, to: number) => cur + (to - cur) * (dt > 0 ? k : 1)
    s.G4 = ease(s.G4, p.gear === 'F' ? 0 : p.gear === 'N' ? -0.06 : -0.12)
    s.GU = ease(s.GU, p.type === 'ground' && p.lever ? 0 : -0.035)
    s.L = ease(s.L, p.std === '540' ? 0 : 0.04)
    s.collar = ease(s.collar, p.lever ? 0 : -0.018)
    s.main = ease(s.main, mainEngaged(p) ? 0 : 1)
    s.pto = ease(s.pto, p.type === 'live' && !liveEngaged(p) ? 1 : 0)
    for (const gs of GEARS) {
      const o = gearRef.current[gs.id]
      if (!o) continue
      let x = GX[gs.id]
      if (gs.id === 'G4') x += s.G4
      if (gs.id === 'GU') x += s.GU
      if (gs.id === 'L5' || gs.id === 'L1') x += s.L
      o.position.set(x, AX[gs.axis].y, AX[gs.axis].z)
      o.rotation.set(ang(gs.id), 0, 0)
    }
    refs.collar.current?.position.set(-0.152 + s.collar, 0, 0)
    refs.mainPlate.current?.position.set(0.455 - 0.014 * s.main, 0, 0)
    refs.mainDisc.current?.position.set(0.466 - 0.007 * s.main, 0, 0)
    refs.ptoPlate.current?.position.set(0.433 - 0.014 * s.pto, 0, 0)
    refs.ptoDisc.current?.position.set(0.444 - 0.007 * s.pto, 0, 0)

    const w = (id: BodyId) => radToRpm(graph.get(id).omega)
    live.engine = w('engine')
    live.trans = w('trans')
    live.out = w('out')
    live.wheel = w('crown') / FINAL
    const v = ((live.wheel * 2 * PI) / 60) * ROLLING_R
    live.travel = -v * 3.6 // wheel turning negatively about +Z rolls the tractor forward (+X)
    live.pto = w('pto')
    live.perMetre = Math.abs(v) > 0.01 ? Math.abs(live.pto / 60 / v) : 0
  })

  const bodyGroup = (id: BodyId, axis: keyof typeof AX) => ({
    ref: (o: THREE.Group | null) => {
      bodyRef.current[id] = o
    },
    position: [0, AX[axis].y, AX[axis].z] as [number, number, number],
  })
  const gearNode = (id: string, material: 'steel' | 'steelDark' | 'forged' = 'steelDark') => (
    <group
      key={id}
      ref={(o) => {
        gearRef.current[id] = o
      }}
    >
      <PartMesh geometry={G.gears[id]} material={material} />
    </group>
  )

  const isLive = st.type === 'live'
  const isInd = st.type === 'independent'
  const hasHollow = isLive || isInd
  const isGround = st.type === 'ground'
  const hasDog = st.type === 'transmission' || isLive

  const drivePath = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          [0.82, 0.4, 0],
          [0.5, 0.4, 0],
          [0.2, 0.39, 0],
          [0.16, 0.27, 0],
          [0.02, 0.27, 0],
          [-0.02, 0.39, 0],
          [-0.4, 0.39, 0],
          [AXLE_X + 0.02, 0.4, -0.04],
          [AXLE_X, 0.4, -0.3],
          [AXLE_X, 0.4, -0.5],
        ].map((p) => new THREE.Vector3(...(p as [number, number, number]))),
      ),
    [],
  )
  const ptoPath = useMemo(() => {
    const pts: [number, number, number][] = [[0.82, 0.31, 0], [0.5, 0.31, 0]]
    if (st.type === 'transmission') pts.push([0.2, 0.31, 0], [0.16, 0.2, 0], [-0.14, 0.2, 0])
    else if (hasHollow) pts.push([0.3, 0.31, 0], [0.26, 0.2, 0], [-0.14, 0.2, 0])
    else pts.push([0.2, 0.32, 0], [0.16, 0.27, 0], [0.02, 0.27, 0], [-0.02, 0.32, 0], [-0.17, 0.32, 0], [-0.19, 0.2, 0])
    pts.push([-0.25, 0.2, 0], [-0.27, 0.14, 0], [-0.3, 0.08, 0], [-0.62, 0.08, 0], [-0.74, 0.08, 0])
    return new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
  }, [st.type, hasHollow])

  const H = HOUSING
  const stubInfo = STUBS[st.std]
  return (
    <group>
      <Part id="driveline" name="Tractor driveline (schematic)" role="housing" material="castIron" info={INFO.root} cites={C.line}>
        <Part id="engine" name="Engine" material="paintGreen" role="housing" info={INFO.engine} cites={C.line} explode={[0.25, 0, 0]}>
          <PartMesh geometry={G.engine} />
        </Part>
        <Part id="bell" name="Clutch housing" material="castIron" role="housing" info={INFO.bell} cites={C.clutch} explode={[0.12, 0, 0]}>
          <PartMesh geometry={G.stat.bell} />
        </Part>
        <Part id="gearbox" name="Gearbox & centre housing" material="castIron" role="housing" info={INFO.gearbox} cites={C.gearbox}>
          <PartMesh geometry={G.stat.gearbox} />
          <PartMesh geometry={G.stat.idlerPin} material="steel" position={[0, AX.idler.y, AX.idler.z]} />
        </Part>
        <Part id="trumpet" name="Axle housing" material="castIron" role="housing" info={INFO.trumpet} explode={[0, 0, -0.15]}>
          <PartMesh geometry={G.stat.trumpet} />
        </Part>
        <Part id="shield" name="PTO master shield" material="paintYellow" role="housing" info={INFO.shield} cites={C.guard} explode={[-0.1, 0.1, 0]}>
          <PartMesh geometry={G.stat.shield} />
        </Part>

        {/* ---------------- engine side: flywheel and clutches ---------------- */}
        <Part id="flywheel" name="Flywheel & clutch cover" material="castIron" role="moving" info={INFO.flywheel} cites={C.clutch} explode={[0.12, 0, 0]}>
          <group {...bodyGroup('engine', 'top')}>
            <PartMesh geometry={G.flywheel.disc} />
            <PartMesh geometry={G.flywheel.ring} material="steelDark" />
            <Part id="clutch-cover" name="Clutch cover" material="steelDark" cut info={INFO.flywheel} cites={C.clutch}>
              <PartMesh geometry={G.clutch.cover} />
            </Part>
            <Part id="pressure-plates" name="Pressure plate(s)" material="castIron" info={INFO.flywheel} cites={C.clutch}>
              <group ref={refs.mainPlate}>
                <PartMesh geometry={G.clutch.pressurePlate} />
              </group>
              {isLive ? (
                <group ref={refs.ptoPlate}>
                  <PartMesh geometry={G.clutch.pressurePlate} />
                </group>
              ) : null}
            </Part>
          </group>
        </Part>

        <Part id="input" name="Input shaft & transmission clutch" material="steel" role="moving" info={INFO.input} cites={C.gearbox}>
          <group {...bodyGroup('trans', 'top')}>
            <PartMesh geometry={G.shafts.input} />
            <Part id="main-disc" name="Transmission clutch plate" material="friction" info={INFO.mainDisc} cites={C.clutch} explode={[0.1, 0, 0]}>
              <group ref={refs.mainDisc}>
                <PartMesh geometry={G.clutch.discIn.friction} />
                <PartMesh geometry={G.clutch.discIn.hub} material="steel" />
              </group>
            </Part>
          </group>
          {gearNode('G1')}
        </Part>

        {hasHollow ? (
          <Part id="hollow" name="Hollow PTO shaft" material="steel" role="moving" info={INFO.hollow} cites={C.clutch}>
            <group {...bodyGroup('hollow', 'top')}>
              <PartMesh geometry={isInd ? G.shafts.hollowLong : G.shafts.hollow} />
              {isLive ? (
                <Part id="pto-disc" name="PTO clutch plate" material="friction" info={INFO.ptoDisc} cites={C.clutch} explode={[0.06, 0, 0]}>
                  <group ref={refs.ptoDisc}>
                    <PartMesh geometry={G.clutch.discPto.friction} />
                    <PartMesh geometry={G.clutch.discPto.hub} material="steel" />
                  </group>
                </Part>
              ) : (
                <Part id="pto-flange" name="PTO drive plate" material="steelDark" info={INFO.flange} cites={C.ipto}>
                  <PartMesh geometry={G.clutch.driveFlange} position={[0.42, 0, 0]} />
                </Part>
              )}
            </group>
            {gearNode('H1')}
          </Part>
        ) : null}

        {/* ---------------- gearbox ---------------- */}
        <Part id="layshaft" name="Layshaft" material="steel" role="moving" info={INFO.lay} cites={C.gearbox}>
          <group {...bodyGroup('lay', 'lay')}>
            <PartMesh geometry={G.shafts.lay} />
            <PartMesh geometry={G.shafts.layDog} material="steelDark" />
          </group>
          {gearNode('G2')}
          {gearNode('G3')}
          {gearNode('G5')}
        </Part>
        {hasHollow ? (
          <Part id="pto-drive" name="PTO drive shaft" material="chrome" role="moving" info={INFO.ptoDrive} cites={C.line}>
            <group {...bodyGroup('ptoDrive', 'lay')}>
              <PartMesh geometry={G.shafts.ptoDrive} />
            </group>
            {gearNode('H2')}
          </Part>
        ) : null}
        <Part id="idler" name="Reverse idler" material="steelDark" role="moving" info={INFO.idler} cites={C.gearbox}>
          {gearNode('I')}
        </Part>
        <Part id="output" name="Output shaft, sliding gear & pinion" material="steel" role="moving" info={INFO.output} cites={C.gearbox}>
          <group {...bodyGroup('out', 'top')}>
            <PartMesh geometry={G.shafts.output} />
            <PartMesh geometry={G.shafts.pinion} material="steelDark" />
          </group>
          {gearNode('G4', 'forged')}
          {isGround ? gearNode('GS') : null}
        </Part>
        <Part id="crown" name="Crown wheel & half shaft" material="steelDark" role="moving" info={INFO.crown} cites={[SRC.tts510('p7 crown wheel and pinion')]}>
          <group position={[AXLE_X, AX.top.y, 0]} ref={(o) => void (bodyRef.current.crown = o)}>
            <PartMesh geometry={G.shafts.crown} />
            <PartMesh geometry={G.shafts.diff} material="castIron" />
            <PartMesh geometry={G.shafts.halfShaft} material="steel" />
          </group>
        </Part>
        <Part id="wheel" name="Rear wheel" material="rubber" role="moving" cut={false} info={INFO.wheel} cites={C.line} explode={[0, 0, -0.2]}>
          <group position={[AXLE_X, AX.top.y, -0.52]} ref={refs.wheel}>
            <PartMesh geometry={G.wheel.tyre} />
            <PartMesh geometry={G.wheel.rim} material="paintYellow" />
          </group>
        </Part>

        {/* ---------------- PTO train ---------------- */}
        <Part id="pto-counter" name="PTO countershaft" material="steel" role="moving" info={INFO.ptoUp} cites={C.types}>
          <group {...bodyGroup('ptoUp', 'lay')}>
            <PartMesh geometry={G.shafts.ptoUp} />
            {hasDog ? (
              <Part id="dog" name="PTO engagement dog clutch" material="forged" info={INFO.collar} cites={C.types}>
                <group ref={refs.collar}>
                  <PartMesh geometry={G.shafts.collar} />
                </group>
              </Part>
            ) : null}
          </group>
          {gearNode('U5')}
          {gearNode('U1')}
          {isGround ? gearNode('GU') : null}
        </Part>
        {isInd ? (
          <Part id="ipto" name="Independent PTO clutch (wet multi-plate)" material="steelDark" role="moving" info={INFO.ipto} cites={C.ipto} explode={[0, 0.12, 0]}>
            <group position={[-0.165, AX.lay.y, 0]}>
              <PartMesh geometry={G.shafts.iptoDrum} />
              <PartMesh geometry={G.shafts.iptoPlates} material="friction" />
            </group>
          </Part>
        ) : null}
        <Part id="pto-shaft" name="PTO output shaft & two-speed gear" material="steel" role="moving" info={INFO.lower} cites={C.std}>
          <group {...bodyGroup('pto', 'pto')}>
            <PartMesh geometry={G.shafts.lower} />
            <Part id="stub" name={`PTO stub (${stubInfo.label})`} material="chrome" info={{ ...INFO.stub, details: stubInfo.note }} cites={C.std} beyondNotes={stubInfo.beyond}>
              <PartMesh geometry={stub} position={[H.x0, 0, 0]} />
            </Part>
          </group>
          {gearNode('L5')}
          {gearNode('L1')}
        </Part>

        {st.flows ? (
          <>
            <Flow curve={drivePath} count={70} radius={0.005} color="#e8d06a" speed={0.25} spread={0.01} intensity={() => Math.min(1, Math.abs(live.out) / 400)} />
            <Flow curve={ptoPath} count={70} radius={0.005} color="#e8794f" speed={0.25} spread={0.01} intensity={() => Math.min(1, Math.abs(live.pto) / 300)} />
          </>
        ) : null}
      </Part>

      <PartLabel partId="engine" at={[0.74, 0.74, 0.1]} />
      <PartLabel partId="flywheel" at={[0.49, 0.56, 0.06]} />
      <PartLabel partId="main-disc" at={[0.46, 0.2, 0.1]} />
      {isLive ? <PartLabel partId="pto-disc" at={[0.4, 0.52, 0.1]} /> : null}
      <PartLabel partId="layshaft" at={[0.06, 0.19, 0.04]} />
      <PartLabel partId="output" at={[-0.2, 0.44, 0.03]} />
      <PartLabel partId="pto-counter" at={[-0.3, 0.3, 0.05]} />
      {isInd ? <PartLabel partId="ipto" at={[-0.15, 0.3, 0.06]} /> : null}
      <PartLabel partId="stub" at={[-0.7, 0.16, 0.03]} />
      <PartLabel partId="crown" at={[AXLE_X, 0.46, -0.06]} />
      <PartLabel partId="wheel" at={[AXLE_X - 0.2, 0.62, -0.52]} />
      <PartLabel partId="gearbox" at={[-0.1, 0.5, 0.15]} />
    </group>
  )
}
