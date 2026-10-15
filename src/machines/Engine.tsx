import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import type { ThreeElements } from '@react-three/fiber'
import type { Citation } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { INFO as ENGINE_INFO, CAM_GEAR_PHASE } from '@/modules/engine/four-stroke/Engine3D'
import { INJECTOR, SPRING_SEAT } from '@/modules/engine/four-stroke/geometry'
import { CAM_X, CAM_Y, CROWN_TDC, DEFAULTS, DIM, PUSHROD_X, VALVE_TIMING, computeCycle, cycleState, gasColor, isInjecting, kinematics, tappetLifts } from '@/modules/engine/four-stroke/model'
import { valveLifts } from '@/physics/engine'
import { exhaustGasTemperature } from '@/physics/thermo'
import type { PartInfo } from '@/parts/registry'
import { createDynamicCutMaterial, type MaterialKey } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { engineReady, prepareEngine, type EngineGeometry } from './engine.geometry'
import { FIRING_4, HEAD_Y, SUMP, engineLayout, type EngineLayout } from './layout'

/**
 * The shared inline diesel engine, every part in place and moving: castings, crankshaft, rods and
 * pistons, camshaft, tappets, pushrods, rockers, valves and springs, injectors and the in-line pump,
 * with the gas in each cylinder coloured through its cycle. Every part moves exactly as in the
 * four-stroke scene (same slider-crank, valve timing, cam lift, rocker ratio and gas cycle),
 * cylinder by cylinder at its firing angle.
 *
 * Engine frame (as the four-stroke scene): crank axis = Z, cylinder 1 at the front (+Z), Y up,
 * origin at the crank centre. Place it with `position`/`rotation`; `scale` sizes it (1 = 100 × 124 mm
 * cylinders). Geometry is built in the worker once per firing layout; `placeholder` shows meanwhile.
 */

const { PI } = Math
type GroupProps = ThreeElements['group']

export type EnginePartKey =
  | 'block'
  | 'liners'
  | 'coolant'
  | 'main-bearings'
  | 'sump'
  | 'oil'
  | 'head-assembly'
  | 'gasket'
  | 'head'
  | 'rocker-cover'
  | 'inlet-manifold'
  | 'exhaust-manifold'
  | 'injectors'
  | 'spark-plugs'
  | 'rocker-shaft'
  | 'rockers'
  | 'valves'
  | 'valve-springs'
  | 'pushrods'
  | 'injection-pump'
  | 'camshaft'
  | 'tappets'
  | 'crank'
  | 'timing-gears'
  | 'pulley'
  | 'flywheel'
  | 'conrods'
  | 'pistons'
  | 'cylinder-gas'

/** a scene's own name, card text or sources for one of the engine's parts */
export type EnginePartOverride = { name?: string; info?: PartInfo; cites?: Citation[] }

/** the cylinder numbers in the order they fire */
export function firingOrder(firing: number[]) {
  return firing
    .map((f, i) => [((f % 720) + 720) % 720, i + 1] as const)
    .sort((a, b) => a[0] - b[0])
    .map((x) => x[1])
}

function defaultInfo(L: EngineLayout): Record<EnginePartKey, PartInfo | undefined> {
  const n = L.n
  const order = firingOrder(L.firing).join('-')
  const all = n === 1 ? 'the cylinder' : n === 2 ? 'both cylinders' : `all ${n} cylinders`
  return {
    block: { ...ENGINE_INFO.block, summary: `Cylinder block and crankcase: one casting for ${all}.`, details: 'Main-bearing bulkheads between the throws, a water jacket round each liner, the cam tunnel and the tappet and pushrod bores.' },
    liners: ENGINE_INFO.liner,
    coolant: ENGINE_INFO.coolant,
    'main-bearings': { summary: 'Main-bearing shells.', role: 'Plain bearings in the bulkheads that carry the crankshaft; pressure-fed with oil.' },
    sump: ENGINE_INFO.sump,
    oil: ENGINE_INFO.oil,
    'head-assembly': undefined,
    gasket: { summary: 'Head gasket.', role: 'Seals the joint between block and head round each cylinder (fire rings), the coolant passages and the pushrod holes.' },
    head: { ...ENGINE_INFO.head, summary: `Cylinder head: one casting over ${all}, with an inlet and an exhaust port for each.` },
    'rocker-cover': ENGINE_INFO.cover,
    'inlet-manifold': { summary: 'Inlet manifold.', role: 'Carries clean air from the air cleaner to each cylinder’s inlet port.' },
    'exhaust-manifold': { summary: 'Exhaust manifold.', role: 'Collects the exhaust from each cylinder’s exhaust port and leads it to the exhaust pipe.' },
    injectors: ENGINE_INFO.injector,
    'spark-plugs': { summary: 'Spark plugs, one per cylinder.', role: 'The high-voltage pulse from the ignition system jumps the gap between the electrodes and ignites the compressed mixture, cylinder by cylinder in firing order.' },
    'rocker-shaft': { summary: 'Rocker shaft and pedestals.', role: 'Carries the rocker arms over the valves; fed with oil from the gallery.' },
    rockers: ENGINE_INFO.rockers,
    valves: ENGINE_INFO.inletValve,
    'valve-springs': ENGINE_INFO.springs,
    pushrods: ENGINE_INFO.pushrods,
    'injection-pump': { summary: 'In-line injection pump and high-pressure pipes.', role: 'Meters fuel and delivers it to each injector in firing order, at a pressure high enough to atomise it; the governor on the end holds the engine speed.' },
    camshaft: { ...ENGINE_INFO.camshaft, details: `Each cylinder’s lobes are set at half its firing angle round the shaft, so the valves open in firing order ${order}.` },
    tappets: ENGINE_INFO.tappets,
    crank: {
      ...ENGINE_INFO.crankshaft,
      summary: n === 1 ? 'Crankshaft with one throw and two main journals.' : `${n}-throw crankshaft with ${n + 1} main journals.`,
      details: n === 1 ? undefined : `Each throw is turned to its cylinder’s firing angle, so the cylinders fire in the order ${order}.${n === 4 && order === '1-3-4-2' ? ' Throws 1 and 4 point one way, 2 and 3 the other: pistons 1 & 4 rise and fall together, as do 2 & 3.' : ''}`,
    },
    'timing-gears': ENGINE_INFO.timingGears,
    pulley: { summary: 'Crankshaft pulley.', role: 'Drives the fan, water pump and alternator by V-belt.' },
    flywheel: ENGINE_INFO.flywheel,
    conrods: ENGINE_INFO.conrod,
    pistons: ENGINE_INFO.piston,
    'cylinder-gas': ENGINE_INFO.gas,
  }
}

const NAMES: Record<EnginePartKey, string> = {
  block: 'Cylinder block & crankcase',
  liners: 'Cylinder liners',
  coolant: 'Coolant (water jacket)',
  'main-bearings': 'Main bearings',
  sump: 'Sump',
  oil: 'Engine oil',
  'head-assembly': 'Cylinder head assembly',
  gasket: 'Head gasket',
  head: 'Cylinder head',
  'rocker-cover': 'Rocker cover',
  'inlet-manifold': 'Inlet manifold',
  'exhaust-manifold': 'Exhaust manifold',
  injectors: 'Fuel injectors',
  'spark-plugs': 'Spark plugs',
  'rocker-shaft': 'Rocker shaft & pedestals',
  rockers: 'Rocker arms',
  valves: 'Inlet and exhaust valves',
  'valve-springs': 'Valve springs',
  pushrods: 'Push rods',
  'injection-pump': 'Injection pump & pipes',
  camshaft: 'Camshaft & cam gear',
  tappets: 'Cam followers (tappets)',
  crank: 'Crankshaft',
  'timing-gears': 'Timing gears',
  pulley: 'Crankshaft pulley',
  flywheel: 'Flywheel & ring gear',
  conrods: 'Connecting rods',
  pistons: 'Pistons',
  'cylinder-gas': 'Cylinder gas',
}

export type GasMaterial = ReturnType<typeof createDynamicCutMaterial>

export interface EngineProps extends Omit<GroupProps, 'id' | 'children'> {
  /** firing angle (deg in the 720° cycle) of each cylinder; its length is the cylinder count. Default: four, 1-3-4-2 */
  firing?: number[]
  /** crank angle (rad), read every frame */
  crankAngle: () => number
  /** part id for an engine part key (prefix or rename); default: the key itself */
  k?: (key: EnginePartKey) => string
  /** rocker-cover paint */
  paint?: MaterialKey
  /** 'core': only the moving heart (crankshaft with gears, pulley and flywheel, rods and pistons) */
  detail?: 'full' | 'core'
  /** 'spark': a petrol engine — a spark plug in each cylinder in place of the injector, and no injection pump */
  ignition?: 'compression' | 'spark'
  /** a scene's own parts at each spark plug (plug frame: firing end at the origin, axis +Y), e.g. the spark */
  plugParts?: (cyl: number) => ReactNode
  /** the in-line injection pump and pipes (off where a machine draws its own fuel system) */
  fuel?: boolean
  /** gas in the cylinders: coloured by temperature through the cycle, or not drawn */
  gas?: boolean
  /** recolour each cylinder's gas instead: cylinder index, its cycle angle (deg, 0 = TDC before intake, firing at 360) */
  gasStyle?: (cyl: number, deg: number, m: GasMaterial) => void
  /** a scene's own names, card text or sources for parts */
  parts?: Partial<Record<EnginePartKey, EnginePartOverride>>
  /** shown until the geometry is ready (first time only) */
  placeholder?: ReactNode
  /** called once the engine is in place */
  onReady?: () => void
  /** the coolant's material (e.g. one coloured by its temperature); default: plain coolant */
  coolantMaterial?: THREE.Material
  /** sump oil level: engine-frame y of the surface */
  oilTop?: number
  /** a scene's own parts that turn with the crankshaft (engine frame), e.g. drilled oilways */
  crankParts?: ReactNode
  /** a scene's own parts that turn with the camshaft (camshaft frame: its axis along Z through the origin) */
  camParts?: ReactNode
  /** a scene's own parts carried by each connecting rod (rod frame: big-end centre at the origin, rod along +Y) */
  rodParts?: (cyl: number) => ReactNode
  /** extra parts in the engine's frame (scaled with it) */
  children?: ReactNode
}

/**
 * Builds the layout's geometry the first time (in the worker), then mounts the engine. Changing
 * the layout keeps the last engine running until the new one is ready.
 */
export function Engine({ firing = FIRING_4, placeholder = null, ...rest }: EngineProps) {
  const key = firing.join(',')
  const [shown, setShown] = useState<{ key: string; firing: number[]; geo: EngineGeometry } | null>(() => {
    const geo = engineReady(firing)
    return geo ? { key, firing, geo } : null
  })
  useEffect(() => {
    if (shown?.key === key) return
    const geo = engineReady(firing)
    if (geo) return void setShown({ key, firing, geo })
    let live = true
    void prepareEngine(firing).then((geo) => live && setShown({ key, firing, geo }))
    return () => {
      live = false
    }
  }, [key])
  if (!shown) return <>{placeholder}</>
  return <EngineBody key={shown.key} g={shown.geo} firing={shown.firing} {...rest} />
}

/** spark plug (spark-ignition engine): its axis and where its terminal sits, engine frame */
export const PLUG_AXIS = INJECTOR.dir.clone()
export const plugTerminal = (z: number) => INJECTOR.tip.clone().addScaledVector(INJECTOR.dir, 0.072).add(new THREE.Vector3(0, HEAD_Y, z))

/** where the parts of a layout sit, for a scene's own labels and overlays (engine frame, unscaled) */
export function engineFrame(firing: number[] = FIRING_4) {
  return { ...engineLayout(firing), headY: HEAD_Y, crownTdc: CROWN_TDC, bore: DIM.bore, stroke: 2 * DIM.crankR }
}

/** vertical stretch of the default oil block (floor to SUMP.oilTop) to reach another level */
const oilScale = (top: number) => Math.max(0.02, (top - SUMP.floorY) / (SUMP.oilTop - SUMP.floorY))

type Refs = {
  rod: THREE.Group | null
  piston: THREE.Group | null
  tapIn: THREE.Group | null
  tapEx: THREE.Group | null
  pushIn: THREE.Mesh | null
  pushEx: THREE.Mesh | null
  rockIn: THREE.Group | null
  rockEx: THREE.Group | null
  valveIn: THREE.Group | null
  valveEx: THREE.Group | null
  springIn: THREE.Mesh | null
  springEx: THREE.Mesh | null
  retIn: THREE.Mesh | null
  retEx: THREE.Mesh | null
  needle: THREE.Group | null
  column: THREE.Mesh | null
}
const emptyRefs = (): Refs => ({ rod: null, piston: null, tapIn: null, tapEx: null, pushIn: null, pushEx: null, rockIn: null, rockEx: null, valveIn: null, valveEx: null, springIn: null, springEx: null, retIn: null, retEx: null, needle: null, column: null })

function EngineBody({ g, firing, crankAngle, k = (s: EnginePartKey) => s, paint = 'paintGreen', detail = 'full', ignition = 'compression', plugParts, fuel: fuelProp = true, gas = true, gasStyle, parts, onReady, oilTop = SUMP.oilTop, coolantMaterial, crankParts, camParts, rodParts, children, ...group }: Omit<EngineProps, 'placeholder'> & { g: EngineGeometry; firing: number[] }) {
  const L = useMemo(() => engineLayout(firing), [firing])
  const { cylZ } = L
  const core = detail === 'core'
  const spark = ignition === 'spark'
  const fuel = fuelProp && !spark
  const info = useMemo(() => defaultInfo(L), [L])
  /** props for one engine part: id, name, card and sources, with the scene's overrides */
  const p = (key: EnginePartKey) => ({ id: k(key), name: parts?.[key]?.name ?? NAMES[key], info: parts?.[key]?.info ?? info[key], cites: parts?.[key]?.cites })

  const cyl = useRef(cylZ.map(emptyRefs))
  const crank = useRef<THREE.Group>(null)
  const cam = useRef<THREE.Group>(null)
  const gasMats = useMemo(() => cylZ.map(() => createDynamicCutMaterial({ color: '#3a70a8', hatch: 'fluid', roughness: 0.6, emissive: '#000000' })), [cylZ])
  const cycle = useMemo(() => computeCycle(DEFAULTS), [])
  const rgb = useMemo(() => ({ r: 0, g: 0, b: 0 }), [])
  const injQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), INJECTOR.dir), [])
  const ready = useRef(onReady)
  ready.current = onReady

  // let the parts mount before anyone frames them
  useEffect(() => {
    const t = window.setTimeout(() => ready.current?.(), 60)
    return () => window.clearTimeout(t)
  }, [])

  useSimFrame(() => {
    const th = crankAngle()
    crank.current?.rotation.set(0, 0, th)
    cam.current?.rotation.set(0, 0, -th / 2)
    const R = DIM.crankR
    const tappetBase = CAM_Y + DIM.camBase
    const rock = (lift: number) => Math.asin(Math.min(1, lift / DIM.rockerArmPush))
    const inter = useView.getState().cut.intersection
    cylZ.forEach((z, i) => {
      const c = cyl.current[i]
      const { deg, crankAngle: a, pin } = kinematics(th - (firing[i] * PI) / 180)
      if (c.rod) {
        c.rod.position.set(-R * Math.sin(a), R * Math.cos(a), z)
        c.rod.rotation.set(0, 0, -Math.asin((R * Math.sin(a)) / DIM.rodL))
      }
      c.piston?.position.set(0, pin, z)
      const crownY = pin + DIM.pistonComp
      if (c.column) {
        c.column.position.set(0, crownY, z)
        c.column.scale.y = Math.max(1e-4, HEAD_Y - crownY)
      }
      if (!core) {
        const tl = tappetLifts(deg)
        const vl = valveLifts(deg, VALVE_TIMING)
        c.tapIn?.position.set(PUSHROD_X, tappetBase + tl.inlet, z + DIM.inletZ)
        c.tapEx?.position.set(PUSHROD_X, tappetBase + tl.exhaust, z + DIM.exhaustZ)
        c.rockIn?.rotation.set(0, 0, -rock(tl.inlet))
        c.rockEx?.rotation.set(0, 0, -rock(tl.exhaust))
        for (const [m, lift] of [
          [c.pushIn, tl.inlet],
          [c.pushEx, tl.exhaust],
        ] as const) {
          if (!m) continue
          const y0 = tappetBase + lift + DIM.tappetH - 0.004
          const y1 = HEAD_Y + DIM.rockerY - 0.002 + DIM.rockerArmPush * Math.sin(rock(lift))
          m.position.y = y0
          m.scale.y = y1 - y0
        }
        const valveY = HEAD_Y + 0.0004
        c.valveIn?.position.set(DIM.valveX, valveY - vl.inlet, z + DIM.inletZ)
        c.valveEx?.position.set(DIM.valveX, valveY - vl.exhaust, z + DIM.exhaustZ)
        for (const [sp, rt, lift] of [
          [c.springIn, c.retIn, vl.inlet],
          [c.springEx, c.retEx, vl.exhaust],
        ] as const) {
          const b = HEAD_Y + DIM.valveTip - 0.012 + 0.0004 - lift
          if (sp) {
            sp.position.y = HEAD_Y + SPRING_SEAT
            sp.scale.y = b - (HEAD_Y + SPRING_SEAT)
          }
          if (rt) rt.position.y = b
        }
        c.needle?.position.set(0, isInjecting(DEFAULTS.cycle, deg) ? 0.0016 : 0, 0)
      }
      if (!gas) return
      const m = gasMats[i]
      if (gasStyle) gasStyle(i, deg, m)
      else {
        // gas colour from the same air-standard cycle as the four-stroke scene
        const s = cycleState(cycle, deg, DEFAULTS.r)
        gasColor(s.stroke === 'exhaust' ? exhaustGasTemperature(cycle) : s.T, rgb)
        m.material.color.setRGB(rgb.r, rgb.g, rgb.b)
        m.capColor.setRGB(rgb.r, rgb.g, rgb.b)
        const glow = Math.max(0, (s.T - 1100) / 1500)
        m.material.emissive.setRGB(rgb.r * glow, rgb.g * glow * 0.8, rgb.b * glow * 0.5)
      }
      m.material.clipIntersection = inter
    })
  })

  const set = <K extends keyof Refs>(i: number, key: K) => (el: Refs[K]) => void (cyl.current[i][key] = el)

  return (
    <group {...group}>
      {/* ---------------- castings ---------------- */}
      {core ? null : (
        <>
          <Part {...p('block')} material="castIron" role="housing">
            <PartMesh geometry={g.block} />
            <Part {...p('liners')} material="steelDark" role="static" xray>
              {cylZ.map((z, i) => (
                <PartMesh key={i} geometry={g.liner} position={[0, 0, z]} />
              ))}
            </Part>
            <Part {...p('coolant')} material="coolant" role="fluid" xray>
              <PartMesh geometry={g.coolant} customMaterial={coolantMaterial} castShadow={coolantMaterial ? false : undefined} />
            </Part>
            <Part {...p('main-bearings')} material="bearing" role="static">
              <PartMesh geometry={g.mains} />
            </Part>
          </Part>
          <Part {...p('sump')} material="paintGrey" role="housing" explode={[0, -0.18, 0]}>
            <PartMesh geometry={g.sump} />
            <Part {...p('oil')} material="oil" role="fluid" xray>
              {/* the oil block is built at the default level; stretch it from the floor to the level asked for */}
              <PartMesh geometry={g.oil} position={[0, SUMP.floorY - SUMP.floorY * oilScale(oilTop), 0]} scale={[1, oilScale(oilTop), 1]} />
            </Part>
          </Part>

          <Part {...p('head-assembly')} role="housing" explode={[0, 0.22, 0]}>
            <Part {...p('gasket')} material="gasket" role="static" xray>
              <PartMesh geometry={g.gasket} position={[0, CROWN_TDC, 0]} scale={[1, HEAD_Y - CROWN_TDC, 1]} />
            </Part>
            <group position={[0, HEAD_Y, 0]}>
              <Part {...p('head')} material="castIron" role="housing">
                <PartMesh geometry={g.head} />
              </Part>
              <Part {...p('rocker-cover')} material={paint} role="housing" explode={[0, 0.16, 0]}>
                <PartMesh geometry={g.cover} />
              </Part>
              <Part {...p('inlet-manifold')} material="aluminium" role="housing" explode={[0.14, 0.08, 0]}>
                <PartMesh geometry={g.inlet} />
              </Part>
              <Part {...p('exhaust-manifold')} material="castIron" role="housing" explode={[0.16, -0.04, 0]}>
                <PartMesh geometry={g.exhaust} />
              </Part>
              {spark ? (
                <Part {...p('spark-plugs')} material="steel" role="static" explode={[0.06, 0.12, 0]}>
                  {cylZ.map((z, i) => (
                    <group key={i} position={[INJECTOR.tip.x, INJECTOR.tip.y, z]} quaternion={injQuat}>
                      <PartMesh geometry={g.plug.shell} />
                      <PartMesh geometry={g.plug.insulator} material="ceramic" />
                      <PartMesh geometry={g.plug.centre} material="steelDark" />
                      <PartMesh geometry={g.plug.terminal} material="brass" />
                      <PartMesh geometry={g.plug.ground} material="steelDark" />
                      {plugParts?.(i)}
                    </group>
                  ))}
                </Part>
              ) : (
              <Part {...p('injectors')} material="steel" role="static" explode={[0.06, 0.12, 0]}>
                {cylZ.map((z, i) => (
                  <group key={i} position={[INJECTOR.tip.x, INJECTOR.tip.y, z]} quaternion={injQuat}>
                    <PartMesh geometry={g.injector.body} />
                    <group ref={set(i, 'needle')}>
                      <PartMesh geometry={g.injector.needle} material="chrome" />
                    </group>
                    <PartMesh geometry={g.injector.spring} material="steelDark" position={[0, 0.071, 0]} scale={[1, 0.045, 1]} />
                  </group>
                ))}
              </Part>
              )}
              <Part {...p('rocker-shaft')} material="steel" role="static">
                <PartMesh geometry={g.rockerShaft} />
                <PartMesh geometry={g.pedestals} />
              </Part>
              <Part {...p('rockers')} material="forged" role="moving" explode={[0, 0.05, 0]}>
                {cylZ.flatMap((z, i) => [
                  <group key={`i${i}`} ref={set(i, 'rockIn')} position={[DIM.rockerX, DIM.rockerY, z + DIM.inletZ]}>
                    <PartMesh geometry={g.rocker} />
                  </group>,
                  <group key={`e${i}`} ref={set(i, 'rockEx')} position={[DIM.rockerX, DIM.rockerY, z + DIM.exhaustZ]}>
                    <PartMesh geometry={g.rocker} />
                  </group>,
                ])}
              </Part>
            </group>
            {/* valves, springs and pushrods move in engine space so they can pass the deck */}
            <Part {...p('valves')} material="steel" role="moving">
              {cylZ.flatMap((_, i) => [
                <group key={`i${i}`} ref={set(i, 'valveIn')}>
                  <PartMesh geometry={g.inletValve} />
                </group>,
                <group key={`e${i}`} ref={set(i, 'valveEx')}>
                  <PartMesh geometry={g.exhaustValve} />
                </group>,
              ])}
            </Part>
            <Part {...p('valve-springs')} material="steelDark" role="moving" cut={false}>
              {cylZ.flatMap((z, i) => [
                <PartMesh key={`si${i}`} ref={set(i, 'springIn')} geometry={g.spring} position={[DIM.valveX, 0, z + DIM.inletZ]} />,
                <PartMesh key={`se${i}`} ref={set(i, 'springEx')} geometry={g.spring} position={[DIM.valveX, 0, z + DIM.exhaustZ]} />,
                <PartMesh key={`ri${i}`} ref={set(i, 'retIn')} geometry={g.retainer} position={[DIM.valveX, 0, z + DIM.inletZ]} />,
                <PartMesh key={`re${i}`} ref={set(i, 'retEx')} geometry={g.retainer} position={[DIM.valveX, 0, z + DIM.exhaustZ]} />,
              ])}
            </Part>
            <Part {...p('pushrods')} material="steel" role="moving">
              {cylZ.flatMap((z, i) => [
                <PartMesh key={`i${i}`} ref={set(i, 'pushIn')} geometry={g.pushrod} position={[PUSHROD_X, 0, z + DIM.inletZ]} />,
                <PartMesh key={`e${i}`} ref={set(i, 'pushEx')} geometry={g.pushrod} position={[PUSHROD_X, 0, z + DIM.exhaustZ]} />,
              ])}
            </Part>
          </Part>

          {fuel ? (
            <Part {...p('injection-pump')} material="paintBlack" role="static" explode={[0.14, -0.04, 0]}>
              <PartMesh geometry={g.pump} />
              <PartMesh geometry={g.hpPipes} material="steel" />
            </Part>
          ) : null}

          {/* ---------------- valve-train drive ---------------- */}
          <Part {...p('camshaft')} material="forged" role="moving" explode={[-0.12, -0.02, 0]}>
            <group ref={cam} position={[CAM_X, CAM_Y, 0]}>
              <PartMesh geometry={g.camShaft} />
              <PartMesh geometry={g.camLobes} material="steel" />
              <PartMesh geometry={g.camJournals} material="steel" />
              <PartMesh geometry={g.timing.cam} material="steelDark" position={[0, 0, L.front + DIM.frontGearZ]} rotation={[0, 0, CAM_GEAR_PHASE]} />
              {camParts}
            </group>
          </Part>
          <Part {...p('tappets')} material="steel" role="moving" explode={[-0.06, 0, 0]}>
            {cylZ.flatMap((_, i) => [
              <group key={`i${i}`} ref={set(i, 'tapIn')}>
                <PartMesh geometry={g.tappet} />
              </group>,
              <group key={`e${i}`} ref={set(i, 'tapEx')}>
                <PartMesh geometry={g.tappet} />
              </group>,
            ])}
          </Part>
        </>
      )}

      {/* ---------------- crank train ---------------- */}
      <Part {...p('crank')} material="forged" role="moving" explode={[0, -0.14, 0]}>
        <group ref={crank}>
          <PartMesh geometry={g.crank} />
          {crankParts}
          <Part {...p('timing-gears')} material="steelDark" explode={[0, -0.04, 0.1]}>
            <PartMesh geometry={g.timing.crank} position={[0, 0, L.front + DIM.frontGearZ]} />
          </Part>
          <Part {...p('pulley')} material="castIron" explode={[0, -0.04, 0.16]}>
            <PartMesh geometry={g.pulley} position={[0, 0, L.pulleyZ]} />
          </Part>
          <Part {...p('flywheel')} material="castIron" explode={[0, -0.04, -0.14]}>
            <PartMesh geometry={g.flywheel} position={[0, 0, L.flywheelZ]} />
            <PartMesh geometry={g.ringGear} material="steelDark" position={[0, 0, L.ringGearZ]} />
          </Part>
        </group>
      </Part>
      <Part {...p('conrods')} material="forged" role="moving" explode={[0, -0.05, 0]}>
        {cylZ.map((_, i) => (
          <group key={i} ref={set(i, 'rod')}>
            <PartMesh geometry={g.rod.body} />
            <PartMesh geometry={g.rod.cap} />
            <PartMesh geometry={g.rod.bolts} material="steelDark" />
            <PartMesh geometry={g.rod.shells} material="bearing" />
            <PartMesh geometry={g.rod.bush} material="bronze" />
            {rodParts?.(i)}
          </group>
        ))}
      </Part>
      <Part {...p('pistons')} material="aluminium" role="moving" explode={[0, 0.1, 0]}>
        {cylZ.map((_, i) => (
          <group key={i} ref={set(i, 'piston')}>
            <PartMesh geometry={g.piston} />
            <PartMesh geometry={g.rings.compression} material="steelDark" />
            <PartMesh geometry={g.rings.oil} material="castIron" />
            <PartMesh geometry={g.pin} material="steel" />
            {gas ? <PartMesh geometry={g.gas.bowl} customMaterial={gasMats[i].material} position={[0, DIM.pistonComp, 0]} castShadow={false} /> : null}
          </group>
        ))}
      </Part>
      {core || !gas ? null : (
        <Part {...p('cylinder-gas')} role="fluid">
          {cylZ.map((_, i) => (
            <PartMesh key={i} ref={set(i, 'column')} geometry={g.gas.column} customMaterial={gasMats[i].material} castShadow={false} />
          ))}
        </Part>
      )}
      {children}
    </group>
  )
}
