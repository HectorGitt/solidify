import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
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
import { insideReady, useInside } from '@/ui/inside'
import { CYL_Z, FIRING, HEAD_Y, prepareTractorEngine, tractorEngineReady, type TractorEngineGeometry } from './engine.geometry'
import { DRIVE_Y } from './geometry'

/**
 * The tractor's engine opened up in place: the four-stroke scene's engine as a four-cylinder,
 * every part moving exactly as in that scene (same slider-crank, valve timing, cam lift, rocker
 * ratio and gas-temperature cycle), cylinder by cylinder in firing order 1-3-4-2.
 * Tractor frame: +X forward, Y up, +Z right; the engine is turned so its crank axis lies along X.
 */

const { PI } = Math
/** crank centre along the tractor, chosen so the flywheel meets the clutch housing */
export const ENGINE_X = 1.1

const INFO: Record<string, PartInfo> = {
  ...ENGINE_INFO,
  block: { ...ENGINE_INFO.block, summary: 'Cylinder block and crankcase: one casting for all four cylinders.', details: 'Main-bearing bulkheads between the throws, a water jacket round each liner, the cam tunnel and the tappet and pushrod bores.' },
  head: { ...ENGINE_INFO.head, summary: 'Cylinder head: one casting over all four cylinders, with an inlet and an exhaust port for each.' },
  gasket: { summary: 'Head gasket.', role: 'Seals the joint between block and head round each cylinder (fire rings), the coolant passages and the pushrod holes.' },
  camshaft: { ...ENGINE_INFO.camshaft, details: 'Each cylinder’s lobes are set at half its firing angle round the shaft, so the valves open in firing order 1-3-4-2.' },
  crankshaft: { ...ENGINE_INFO.crankshaft, summary: 'Four-throw crankshaft with five main journals.', details: 'Throws 1 and 4 point one way, 2 and 3 the other: pistons 1 & 4 rise and fall together, as do 2 & 3, and the firing order is 1-3-4-2.' },
  pump: { summary: 'In-line injection pump and high-pressure pipes.', role: 'Meters fuel and delivers it to each injector in firing order, at a pressure high enough to atomise it; the governor on the end holds the engine speed.' },
  inlet: { summary: 'Inlet manifold.', role: 'Carries clean air from the air cleaner to each cylinder’s inlet port.' },
  exhaust: { summary: 'Exhaust manifold.', role: 'Collects the exhaust from each cylinder’s exhaust port and leads it to the exhaust pipe.' },
  mains: { summary: 'Main-bearing shells.', role: 'Plain bearings in the bulkheads that carry the crankshaft; pressure-fed with oil.' },
}

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

/** Mounts the engine once its geometry is built (in the worker, first time only). */
export function EngineDetail({ crankAngle, k, paint, fuel = true }: { crankAngle: () => number; k: (s: string) => string; paint: MaterialKey; /** draw the outline injection pump and pipes (the whole tractor has its own fuel system) */ fuel?: boolean }) {
  const [g, setG] = useState<TractorEngineGeometry | null>(tractorEngineReady)
  useEffect(() => {
    if (g) return
    let live = true
    useInside.setState({ loading: true })
    prepareTractorEngine().then((geo) => live && setG(geo))
    return () => {
      live = false
    }
  }, [g])
  if (!g) return null
  return <Engine g={g} crankAngle={crankAngle} k={k} paint={paint} fuel={fuel} />
}

function Engine({ g, crankAngle, k, paint, fuel }: { g: TractorEngineGeometry; crankAngle: () => number; k: (s: string) => string; paint: MaterialKey; fuel: boolean }) {
  const cyl = useRef(CYL_Z.map(emptyRefs))
  const crank = useRef<THREE.Group>(null)
  const cam = useRef<THREE.Group>(null)
  const gas = useMemo(() => CYL_Z.map(() => createDynamicCutMaterial({ color: '#3a70a8', hatch: 'fluid', roughness: 0.6, emissive: '#000000' })), [])
  const cycle = useMemo(() => computeCycle(DEFAULTS), [])
  const rgb = useMemo(() => ({ r: 0, g: 0, b: 0 }), [])
  const injQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), INJECTOR.dir), [])

  // frame the camera once everything is in place
  useEffect(() => {
    const t = window.setTimeout(insideReady, 60)
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
    CYL_Z.forEach((z, i) => {
      const c = cyl.current[i]
      const { deg, crankAngle: a, pin } = kinematics(th - (FIRING[i] * PI) / 180)
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
      // gas colour from the same air-standard cycle as the four-stroke scene
      const s = cycleState(cycle, deg, DEFAULTS.r)
      const m = gas[i]
      gasColor(s.stroke === 'exhaust' ? exhaustGasTemperature(cycle) : s.T, rgb)
      m.material.color.setRGB(rgb.r, rgb.g, rgb.b)
      m.capColor.setRGB(rgb.r, rgb.g, rgb.b)
      const glow = Math.max(0, (s.T - 1100) / 1500)
      m.material.emissive.setRGB(rgb.r * glow, rgb.g * glow * 0.8, rgb.b * glow * 0.5)
      m.material.clipIntersection = inter
    })
  })

  const set = <K extends keyof Refs>(i: number, key: K) => (el: Refs[K]) => void (cyl.current[i][key] = el)

  return (
    <group position={[ENGINE_X, DRIVE_Y, 0]} rotation={[0, PI / 2, 0]}>
      {/* ---------------- castings ---------------- */}
      <Part id={k('block')} name="Cylinder block & crankcase" material="castIron" role="housing" info={INFO.block}>
        <PartMesh geometry={g.block} />
        <Part id={k('liners')} name="Cylinder liners" material="steelDark" role="static" xray info={INFO.liner}>
          {CYL_Z.map((z, i) => (
            <PartMesh key={i} geometry={g.liner} position={[0, 0, z]} />
          ))}
        </Part>
        <Part id={k('coolant')} name="Coolant (water jacket)" material="coolant" role="fluid" xray info={INFO.coolant}>
          <PartMesh geometry={g.coolant} />
        </Part>
        <Part id={k('main-bearings')} name="Main bearings" material="bearing" role="static" info={INFO.mains}>
          <PartMesh geometry={g.mains} />
        </Part>
      </Part>
      <Part id={k('sump')} name="Sump" material="paintGrey" role="housing" info={INFO.sump} explode={[0, -0.18, 0]}>
        <PartMesh geometry={g.sump} />
        <Part id={k('oil')} name="Engine oil" material="oil" role="fluid" xray info={INFO.oil}>
          <PartMesh geometry={g.oil} />
        </Part>
      </Part>

      <Part id={k('head-assembly')} name="Cylinder head assembly" role="housing" explode={[0, 0.22, 0]}>
        <Part id={k('gasket')} name="Head gasket" material="gasket" role="static" xray info={INFO.gasket}>
          <PartMesh geometry={g.gasket} position={[0, CROWN_TDC, 0]} scale={[1, HEAD_Y - CROWN_TDC, 1]} />
        </Part>
        <group position={[0, HEAD_Y, 0]}>
          <Part id={k('head')} name="Cylinder head" material="castIron" role="housing" info={INFO.head}>
            <PartMesh geometry={g.head} />
          </Part>
          <Part id={k('rocker-cover')} name="Rocker cover" material={paint} role="housing" info={INFO.cover} explode={[0, 0.16, 0]}>
            <PartMesh geometry={g.cover} />
          </Part>
          <Part id={k('inlet-manifold')} name="Inlet manifold" material="aluminium" role="housing" cut={false} info={INFO.inlet} explode={[0.14, 0.08, 0]}>
            <PartMesh geometry={g.inlet} />
          </Part>
          <Part id={k('exhaust-manifold')} name="Exhaust manifold" material="castIron" role="housing" info={INFO.exhaust} explode={[0.16, -0.04, 0]}>
            <PartMesh geometry={g.exhaust} />
          </Part>
          <Part id={k('injectors')} name="Fuel injectors" material="steel" role="static" info={INFO.injector} explode={[0.06, 0.12, 0]}>
            {CYL_Z.map((z, i) => (
              <group key={i} position={[INJECTOR.tip.x, INJECTOR.tip.y, z]} quaternion={injQuat}>
                <PartMesh geometry={g.injector.body} />
                <group ref={set(i, 'needle')}>
                  <PartMesh geometry={g.injector.needle} material="chrome" />
                </group>
                <PartMesh geometry={g.injector.spring} material="steelDark" position={[0, 0.071, 0]} scale={[1, 0.045, 1]} />
              </group>
            ))}
          </Part>
          <Part id={k('rocker-shaft')} name="Rocker shaft & pedestals" material="steel" role="static">
            <PartMesh geometry={g.rockerShaft} />
            <PartMesh geometry={g.pedestals} />
          </Part>
          <Part id={k('rockers')} name="Rocker arms" material="forged" role="moving" info={INFO.rockers} explode={[0, 0.05, 0]}>
            {CYL_Z.flatMap((z, i) => [
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
        <Part id={k('valves')} name="Inlet and exhaust valves" material="steel" role="moving" info={INFO.inletValve}>
          {CYL_Z.flatMap((_, i) => [
            <group key={`i${i}`} ref={set(i, 'valveIn')}>
              <PartMesh geometry={g.inletValve} />
            </group>,
            <group key={`e${i}`} ref={set(i, 'valveEx')}>
              <PartMesh geometry={g.exhaustValve} />
            </group>,
          ])}
        </Part>
        <Part id={k('valve-springs')} name="Valve springs" material="steelDark" role="moving" info={INFO.springs} cut={false}>
          {CYL_Z.flatMap((z, i) => [
            <PartMesh key={`si${i}`} ref={set(i, 'springIn')} geometry={g.spring} position={[DIM.valveX, 0, z + DIM.inletZ]} />,
            <PartMesh key={`se${i}`} ref={set(i, 'springEx')} geometry={g.spring} position={[DIM.valveX, 0, z + DIM.exhaustZ]} />,
            <PartMesh key={`ri${i}`} ref={set(i, 'retIn')} geometry={g.retainer} position={[DIM.valveX, 0, z + DIM.inletZ]} />,
            <PartMesh key={`re${i}`} ref={set(i, 'retEx')} geometry={g.retainer} position={[DIM.valveX, 0, z + DIM.exhaustZ]} />,
          ])}
        </Part>
        <Part id={k('pushrods')} name="Push rods" material="steel" role="moving" info={INFO.pushrods}>
          {CYL_Z.flatMap((z, i) => [
            <PartMesh key={`i${i}`} ref={set(i, 'pushIn')} geometry={g.pushrod} position={[PUSHROD_X, 0, z + DIM.inletZ]} />,
            <PartMesh key={`e${i}`} ref={set(i, 'pushEx')} geometry={g.pushrod} position={[PUSHROD_X, 0, z + DIM.exhaustZ]} />,
          ])}
        </Part>
      </Part>

      {fuel ? (
      <Part id={k('injection-pump')} name="Injection pump & pipes" material="paintBlack" role="static" info={INFO.pump} explode={[0.14, -0.04, 0]}>
        <PartMesh geometry={g.pump} />
        <PartMesh geometry={g.hpPipes} material="steel" />
      </Part>
      ) : null}

      {/* ---------------- moving parts ---------------- */}
      <Part id={k('camshaft')} name="Camshaft & cam gear" material="forged" role="moving" info={INFO.camshaft} explode={[-0.12, -0.02, 0]}>
        <group ref={cam} position={[CAM_X, CAM_Y, 0]}>
          <PartMesh geometry={g.camShaft} />
          <PartMesh geometry={g.camLobes} material="steel" />
          <PartMesh geometry={g.camJournals} material="steel" />
          <PartMesh geometry={g.timing.cam} material="steelDark" position={[0, 0, CYL_Z[0] + DIM.frontGearZ]} rotation={[0, 0, CAM_GEAR_PHASE]} />
        </group>
      </Part>
      <Part id={k('tappets')} name="Cam followers (tappets)" material="steel" role="moving" info={INFO.tappets} explode={[-0.06, 0, 0]}>
        {CYL_Z.flatMap((_, i) => [
          <group key={`i${i}`} ref={set(i, 'tapIn')}>
            <PartMesh geometry={g.tappet} />
          </group>,
          <group key={`e${i}`} ref={set(i, 'tapEx')}>
            <PartMesh geometry={g.tappet} />
          </group>,
        ])}
      </Part>
      <Part id={k('crank')} name="Crankshaft" material="forged" role="moving" info={INFO.crankshaft} explode={[0, -0.14, 0]}>
        <group ref={crank}>
          <PartMesh geometry={g.crank} />
          <Part id={k('timing-gears')} name="Timing gears" material="steelDark" info={INFO.timingGears} explode={[0, -0.04, 0.1]}>
            <PartMesh geometry={g.timing.crank} position={[0, 0, CYL_Z[0] + DIM.frontGearZ]} />
          </Part>
          <Part id={k('pulley')} name="Crankshaft pulley" material="castIron" info={{ summary: 'Crankshaft pulley.', role: 'Drives the fan, water pump and alternator by V-belt.' }} explode={[0, -0.04, 0.16]}>
            <PartMesh geometry={g.pulley} position={[0, 0, CYL_Z[0] + 0.112]} />
          </Part>
          <Part id={k('flywheel')} name="Flywheel & ring gear" material="castIron" info={INFO.flywheel} explode={[0, -0.04, -0.14]}>
            <PartMesh geometry={g.flywheel} position={[0, 0, CYL_Z[3] - 0.107]} />
            <PartMesh geometry={g.ringGear} material="steelDark" position={[0, 0, CYL_Z[3] - 0.115]} />
          </Part>
        </group>
      </Part>
      <Part id={k('conrods')} name="Connecting rods" material="forged" role="moving" info={INFO.conrod} explode={[0, -0.05, 0]}>
        {CYL_Z.map((_, i) => (
          <group key={i} ref={set(i, 'rod')}>
            <PartMesh geometry={g.rod.body} />
            <PartMesh geometry={g.rod.cap} />
            <PartMesh geometry={g.rod.bolts} material="steelDark" />
            <PartMesh geometry={g.rod.shells} material="bearing" />
            <PartMesh geometry={g.rod.bush} material="bronze" />
          </group>
        ))}
      </Part>
      <Part id={k('pistons')} name="Pistons" material="aluminium" role="moving" info={INFO.piston} explode={[0, 0.1, 0]}>
        {CYL_Z.map((_, i) => (
          <group key={i} ref={set(i, 'piston')}>
            <PartMesh geometry={g.piston} />
            <PartMesh geometry={g.rings.compression} material="steelDark" />
            <PartMesh geometry={g.rings.oil} material="castIron" />
            <PartMesh geometry={g.pin} material="steel" />
            <PartMesh geometry={g.gas.bowl} customMaterial={gas[i].material} position={[0, DIM.pistonComp, 0]} castShadow={false} />
          </group>
        ))}
      </Part>
      <Part id={k('cylinder-gas')} name="Cylinder gas" role="fluid" info={INFO.gas}>
        {CYL_Z.map((_, i) => (
          <PartMesh key={i} ref={set(i, 'column')} geometry={g.gas.column} customMaterial={gas[i].material} castShadow={false} />
        ))}
      </Part>
    </group>
  )
}
