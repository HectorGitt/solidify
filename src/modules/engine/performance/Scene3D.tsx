import { Html } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, lathe, mat4, merge, pipe, tube, xform } from '@/geometry'
import { scaleForce } from '@/physics/dynamometer'
import { pinHeight } from '@/physics/engine'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { fan as coolingFan, radiatorCore, radiatorFrame, radiatorTank, type RadiatorSpec } from '@/parts/lib/cooling'
import { crankshaft } from '../multi-cylinder/crank'
import { BARREL_X, CASE_X, CRANK, DECK, INJ_X, blockLength, getMultiGeometry } from '../multi-cylinder/geometry'
import { DIM, LAYOUTS, SC, cylZ, type CylCount } from '../multi-cylinder/model'
import { compute, live, shares, usePerf } from './model'

const { PI } = Math
const alongZ = mat4.rx(PI / 2)
export const FLOOR_Y = -0.182

/** test-bed radiator, centred on x = 0, z = 0 (placed in front of the engine) */
const BED_RAD: RadiatorSpec = { x: 0.17, y0: -0.035, y1: 0.275, z0: -0.025, z1: 0.025, tankZ0: -0.035, tankZ1: 0.035, botY0: -0.09, topY1: 0.33, tubes: 14, fins: 34 }

/** Map any cylinder count onto one of the modelled inline engines (the 3D engine is representative). */
export function shownCount(n: number): CylCount {
  if (n <= 2) return 2
  if (n === 3) return 3
  if (n <= 5) return 4
  if (n <= 7) return 6
  return 8
}

/** Flat ribbon (box section) swept along a smooth curve; width along `up × tangent`. */
function ribbon(pts: THREE.Vector3[], width: number, thick: number, up = new THREE.Vector3(0, 1, 0)) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4)
  const N = 72
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= N; i++) {
    const p = curve.getPointAt(i / N)
    const t = curve.getTangentAt(i / N)
    let s = new THREE.Vector3().crossVectors(t, up)
    if (s.lengthSq() < 1e-6) s = new THREE.Vector3(1, 0, 0)
    s.normalize()
    const nn = new THREE.Vector3().crossVectors(s, t).normalize()
    for (const [a, b] of [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ])
      pos.push(...p.clone().addScaledVector(s, (a * width) / 2).addScaledVector(nn, (b * thick) / 2).toArray())
  }
  for (let i = 0; i < N; i++)
    for (let k = 0; k < 4; k++) {
      const a = i * 4 + k
      const b = i * 4 + ((k + 1) % 4)
      const c = (i + 1) * 4 + ((k + 1) % 4)
      const d = (i + 1) * 4 + k
      idx.push(a, d, c, a, c, b)
    }
  idx.push(0, 1, 2, 0, 2, 3)
  const e = N * 4
  idx.push(e, e + 2, e + 1, e, e + 3, e + 2)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return { geo: g, curve }
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

const RIBBON = {
  fuel: { color: '#d8b24a', label: 'Fuel energy in' },
  brake: { color: '#7fc06a', label: 'Brake power' },
  cooling: { color: '#4fa3d8', label: 'Cooling' },
  exhaust: { color: '#e8794f', label: 'Exhaust' },
  friction: { color: '#a3a3a3', label: 'Friction' },
} as const

export function Performance3D() {
  const g = getMultiGeometry()
  const p = usePerf()
  const n = shownCount(p.cylinders)
  const cg = g.byCount[n]
  const L = blockLength(n)
  const layout = LAYOUTS[n][0]
  const r = useMemo(() => compute(p), [p])
  const sh = shares(p, r)

  const crankG = useMemo(() => crankshaft(CRANK, layout.firing.map((f, i) => ({ z: cylZ(i + 1, n), firingDeg: f })), DIM.pitch), [n, layout])
  const pist = g.piston
  const rodG = g.rod

  // test-bed layout along −Z behind the flywheel
  const flyZ = crankG.back
  const dynoZ = flyZ - 0.42
  const radZ = crankG.front + 0.12
  const bed = useMemo(() => {
    const shaft = xform(cylinder(0.028, flyZ - 0.04 - (dynoZ + 0.08), 32), mat4.c(mat4.t(0, 0, (flyZ - 0.04 + dynoZ + 0.08) / 2), alongZ))
    const flange = lathe([[0.028, 0], [0.07, 0], [0.07, 0.018], [0.028, 0.018]], 40)
    const couplings = merge(xform(flange, mat4.c(mat4.t(0, 0, flyZ - 0.058), alongZ)), xform(flange, mat4.c(mat4.t(0, 0, dynoZ + 0.08), alongZ)))
    const casing = xform(lathe([[0.035, -0.08], [0.17, -0.08], [0.17, 0.08], [0.035, 0.08], [0.035, 0.065], [0.155, 0.065], [0.155, -0.065], [0.035, -0.065]], 72), mat4.c(mat4.t(0, 0, dynoZ), alongZ))
    const vanes: THREE.BufferGeometry[] = [xform(lathe([[0.03, -0.006], [0.14, -0.006], [0.14, 0.006], [0.03, 0.006]], 48), alongZ)]
    for (let i = 0; i < 12; i++) vanes.push(xform(box(0.1, 0.006, 0.1), mat4.c(mat4.rz((i / 12) * 2 * PI), mat4.t(0.085, 0, 0))))
    const rotor = xform(merge(...vanes), mat4.t(0, 0, dynoZ))
    const dynoShaft = xform(cylinder(0.028, 0.3, 32), mat4.c(mat4.t(0, 0, dynoZ), alongZ))
    const ped = (z: number) => merge(xform(box(0.12, -FLOOR_Y - 0.05, 0.05), mat4.t(0, (FLOOR_Y - 0.05) / 2, z)), xform(tube(0.06, 0.0285, 0.05, 40), mat4.c(mat4.t(0, 0, z), alongZ)))
    const pedestals = merge(ped(dynoZ + 0.115), ped(dynoZ - 0.115))
    const arm = merge(xform(box(p.arm - 0.15, 0.022, 0.03), mat4.t(0.15 + (p.arm - 0.15) / 2, 0, dynoZ)), xform(box(0.03, 0.04, 0.04), mat4.t(p.arm, -0.02, dynoZ)))
    const scaleBody = merge(xform(box(0.07, -FLOOR_Y - 0.05, 0.07), mat4.t(p.arm, (FLOOR_Y - 0.05) / 2 - 0.0, dynoZ)), xform(box(0.08, 0.01, 0.08), mat4.t(p.arm, -0.045, dynoZ)))
    const dial = xform(lathe([[0, 0], [0.05, 0], [0.05, 0.012], [0.044, 0.016], [0, 0.014]], 48), mat4.c(mat4.t(p.arm, -0.11, dynoZ + 0.035), alongZ))
    const needle = xform(box(0.003, 0.04, 0.002), mat4.t(0, 0.02, 0))
    const base = xform(box(0.5, 0.02, radZ - dynoZ + 0.5), mat4.t(0.12, FLOOR_Y - 0.01, (radZ + dynoZ) / 2))
    const radStand = xform(box(0.3, -0.09 - FLOOR_Y, 0.05), mat4.t(0, (FLOOR_Y - 0.09) / 2, radZ + 0.12))
    const hoses = merge(
      pipe(new THREE.CatmullRomCurve3([V(0, DECK + 0.02, L / 2 - 0.01), V(0, DECK + 0.03, L / 2 + 0.05), V(0, 0.3, radZ + 0.08)]), 0.017, 0.012, 24, 16),
      pipe(new THREE.CatmullRomCurve3([V(-0.05, -0.06, radZ + 0.09), V(-0.07, 0.0, L / 2 + 0.02), V(-0.06, 0.06, L / 2 - 0.01)]), 0.017, 0.012, 24, 16),
    )
    const stackX = BARREL_X + 0.057
    const stack = pipe(new THREE.CatmullRomCurve3([V(stackX, DECK + 0.035, 0.0), V(stackX + 0.01, DECK + 0.12, 0), V(stackX + 0.01, 0.75, 0)]), 0.03, 0.026, 32, 20)
    const tank = xform(box(0.22, 0.16, 0.24), mat4.t(0.42, 0.42, 0.12))
    const tankStand = xform(box(0.04, 0.42 - 0.08 - FLOOR_Y, 0.04), mat4.t(0.42, (0.34 + FLOOR_Y) / 2, 0.12))
    return { shaft, couplings, casing, rotor, dynoShaft, pedestals, arm, scaleBody, dial, needle, base, radStand, hoses, stack, tank, tankStand }
  }, [flyZ, dynoZ, radZ, L, p.arm])

  // radiator (shared library core, tanks and frame) and fan: rebuilt only when the engine length changes
  const rad = useMemo(() => {
    const at = mat4.t(0, 0, radZ + 0.12)
    const core = radiatorCore(BED_RAD)
    return {
      core: xform(merge(core.tubes, core.fins), at),
      tanks: xform(merge(radiatorTank(BED_RAD, BED_RAD.y1, BED_RAD.topY1).shell, radiatorTank(BED_RAD, BED_RAD.botY0, BED_RAD.y0).shell, radiatorFrame(BED_RAD)), at),
    }
  }, [radZ])
  const fanG = useMemo(() => coolingFan(0.14), [])

  // heat-balance ribbons
  const rib = useMemo(() => {
    const W = 0.13
    const w = (f: number) => Math.max(0.003, W * f)
    const stackX = BARREL_X + 0.057
    const fuel = ribbon([V(0.42, 0.34, 0.12), V(0.4, 0.3, 0.12), V(0.25, DECK + 0.2, 0.05), V(0.06, DECK + 0.16, 0), V(INJ_X, DECK + 0.12, 0)], w(1), 0.006)
    const brake = ribbon([V(0, DECK + 0.1, -L / 2 + 0.05), V(0, DECK + 0.12, -L / 2 - 0.08), V(0, 0.27, dynoZ + 0.2), V(0, 0.2, dynoZ)], w(sh.brake), 0.006)
    const cooling = ribbon([V(0, DECK + 0.13, L / 2 - 0.06), V(0, DECK + 0.15, L / 2 + 0.04), V(0, 0.36, radZ + 0.06), V(0, 0.33, radZ + 0.12)], w(sh.cooling), 0.006)
    const exhaust = ribbon([V(stackX + 0.04, DECK + 0.06, 0), V(stackX + 0.08, DECK + 0.15, 0), V(stackX + 0.09, 0.62, 0), V(stackX + 0.2, 0.78, 0)], w(sh.exhaust), 0.006, new THREE.Vector3(0, 0, 1))
    const friction = ribbon([V(-CASE_X - 0.01, 0.02, 0), V(-CASE_X - 0.12, 0.0, 0), V(-CASE_X - 0.22, -0.1, 0), V(-CASE_X - 0.24, -0.16, 0)], w(sh.friction), 0.006, new THREE.Vector3(0, 0, 1))
    return { fuel, brake, cooling, exhaust, friction }
  }, [sh.brake, sh.cooling, sh.exhaust, sh.friction, L, dynoZ, radZ])
  const mats = useMemo(() => Object.fromEntries(Object.entries(RIBBON).map(([k, v]) => [k, new THREE.MeshStandardMaterial({ color: v.color, roughness: 0.5, transparent: true, opacity: 0.82, emissive: v.color, emissiveIntensity: 0.18 })])) as Record<keyof typeof RIBBON, THREE.MeshStandardMaterial>, [])

  const theta = useRef(0)
  const crankRef = useRef<THREE.Group>(null)
  const rotorRef = useRef<THREE.Group>(null)
  const casingRef = useRef<THREE.Group>(null)
  const needleRef = useRef<THREE.Group>(null)
  const fanRef = useRef<THREE.Group>(null)
  const pistons = useRef<(THREE.Group | null)[]>([])
  const rods = useRef<(THREE.Group | null)[]>([])
  const torque = r.torque ?? 0
  const F = scaleForce(torque, p.arm)
  const Fmax = Math.max(100, Math.pow(10, Math.ceil(Math.log10(Math.max(1, F) * 1.25))))

  useSimFrame((dt) => {
    const st = usePerf.getState()
    theta.current = (theta.current + Math.min(st.rpm, 3000) * 6 * dt) % 720
    const th = theta.current
    const a = (th * PI) / 180
    crankRef.current?.rotation.set(0, 0, a)
    rotorRef.current?.rotation.set(0, 0, a)
    fanRef.current?.rotation.set(0, 0, a * 1.3)
    const R = DIM.crankR
    for (let i = 0; i < n; i++) {
      const ai = ((th - layout.firing[i]) * PI) / 180
      const z = cylZ(i + 1, n)
      pistons.current[i]?.position.set(0, pinHeight(SC, ai), z)
      const rr = rods.current[i]
      if (rr) {
        rr.position.set(-R * Math.sin(ai), R * Math.cos(ai), z)
        rr.rotation.set(0, 0, -Math.asin((R * Math.sin(ai)) / DIM.rodL))
      }
    }
    // the casing is dragged round by the reaction torque; the arm on the scale stops it
    casingRef.current?.rotation.set(0, 0, Math.min(0.05, torque / 40000))
    needleRef.current?.rotation.set(0, 0, -(F / Fmax) * 1.5 * PI + 0.75 * PI)
    live.crank = th
    live.shaftRpm = st.rpm
  })

  const zs = Array.from({ length: n }, (_, i) => cylZ(i + 1, n))
  const pct = (f: number) => `${(f * 100).toFixed(1)} %`
  const ribbonList = [
    ['fuel', rib.fuel, 1, V(0.42, 0.52, 0.12)],
    ['brake', rib.brake, sh.brake, V(0.05, 0.32, dynoZ + 0.15)],
    ['cooling', rib.cooling, sh.cooling, V(0.05, 0.42, radZ + 0.06)],
    ['exhaust', rib.exhaust, sh.exhaust, V(BARREL_X + 0.3, 0.8, 0)],
    ['friction', rib.friction, sh.friction, V(-CASE_X - 0.24, -0.08, 0.05)],
  ] as const

  return (
    <group>
      <Part id="test-bed" name="Engine on a dynamometer test bed" role="housing" material="paintGrey" info={{ summary: 'Multi-cylinder tractor diesel coupled to a cradled (trunnion-mounted) brake dynamometer.', role: 'The dynamometer absorbs the engine’s output; its casing is free to swing, and the torque arm pressing on the scale measures the torque: T = F × R, BP = 2πNT/60.' }} cites={[SRC.misc509('p2–3 brake power'), SRC.tests502('p4–6, Fig 15.3 hydraulic dynamometer')]}>
        <Part id="engine" name={`${n}-cylinder tractor diesel`} material="castIron" role="housing" info={{ summary: 'Inline four-stroke diesel (shown with the nearest modelled cylinder count).', details: 'The same castings as the Crankshafts & firing order scene; the calculator data, not the drawing, set the numbers.' }} cites={[SRC.tb509('Fig 2.1')]}>
          <PartMesh geometry={cg.block} />
          <PartMesh geometry={cg.coolant} material="coolant" />
          <group position={[0, DECK, 0]}>
            <PartMesh geometry={cg.head} />
            <PartMesh geometry={cg.cover} material="paintGreen" />
            {zs.map((z, i) => (
              <PartMesh key={i} geometry={g.injector} material="steel" position={[INJ_X, 0.001, z]} />
            ))}
          </group>
          <PartMesh geometry={cg.sump} material="paintGrey" />
          <PartMesh geometry={cg.exhaust} position={[0, DECK, 0]} />
        </Part>
        <Part id="crank-train" name="Crankshaft, pistons & rods" material="forged" role="moving" info={{ summary: 'Crank train (see the Crankshafts & firing order scene).' }}>
          <group ref={crankRef}>
            <PartMesh geometry={crankG.geometry} />
            <PartMesh geometry={g.flywheel.disc} material="castIron" position={[0, 0, flyZ]} />
            <PartMesh geometry={g.flywheel.ring} material="steelDark" position={[0, 0, flyZ]} />
            <PartMesh geometry={g.pulley} material="castIron" position={[0, 0, crankG.front - 0.03]} />
          </group>
          {zs.map((_, i) => (
            <group key={`r${i}`} ref={(el) => void (rods.current[i] = el)}>
              <PartMesh geometry={rodG.body} />
              <PartMesh geometry={rodG.cap} />
              <PartMesh geometry={rodG.bolts} material="steelDark" />
              <PartMesh geometry={rodG.shells} material="bearing" />
              <PartMesh geometry={rodG.bush} material="bronze" />
            </group>
          ))}
          {zs.map((_, i) => (
            <group key={`p${i}`} ref={(el) => void (pistons.current[i] = el)}>
              <PartMesh geometry={pist.body} material="aluminium" />
              <PartMesh geometry={pist.rings.compression} material="steelDark" />
              {pist.rings.oil ? <PartMesh geometry={pist.rings.oil} material="castIron" /> : null}
              <PartMesh geometry={pist.pin} material="steel" />
            </group>
          ))}
        </Part>
        <Part id="cooling-hw" name="Radiator, hoses & fan" material="paintBlack" role="housing" cut={false} info={{ summary: 'Radiator, hoses and fan.', role: 'About 30–40 % of the fuel energy leaves in the cooling water.' }} cites={[SRC.supp509('cooling: 30 % removed by cooling'), SRC.tb509('§3.3')]}>
          <PartMesh geometry={rad.core} material="copper" />
          <PartMesh geometry={rad.tanks} />
          <PartMesh geometry={bed.radStand} material="paintGrey" />
          <PartMesh geometry={bed.hoses} material="rubber" />
          <group ref={fanRef} position={[0, 0, crankG.front + 0.03]}>
            <PartMesh geometry={fanG} material="paintYellow" />
          </group>
        </Part>
        <Part id="exhaust-stack" name="Exhaust stack" material="paintBlack" role="housing" cut={false} info={{ summary: 'Exhaust stack.', role: 'Exhaust gas carries away the largest share of the heat: about 40 %, or 31 % with other heat losses in another typical split.' }} cites={[SRC.supp509('40 % via exhaust'), SRC.tb509('§3.3')]}>
          <PartMesh geometry={bed.stack} />
        </Part>
        <Part id="fuel-tank" name="Fuel tank" material="paintGreen" role="housing" cut={false} info={{ summary: 'Fuel tank (measured fuel consumption gives ṁf).', role: 'Fuel energy in = ṁf × HV — the 100 % of the heat balance.' }} cites={[SRC.misc509('p3 ηbth = BP/(ṁf·HV)')]}>
          <PartMesh geometry={bed.tank} />
          <PartMesh geometry={bed.tankStand} material="paintGrey" />
        </Part>
        <Part id="dyno" name="Brake dynamometer" material="paintBlue" role="housing" info={{ summary: 'Cradled hydraulic brake dynamometer.', role: 'The rotor churns water inside the casing, absorbing the brake power as heat. The casing is carried on trunnion bearings, so the reaction torque tries to turn it; the torque arm on the scale holds it: T = F·R.' }} cites={[SRC.tests502('p4–6, Fig 15.3 hydraulic dynamometer'), SRC.misc509('p2 BP = 2πNT/60')]}>
          <group ref={casingRef} position={[0, 0, 0]}>
            <PartMesh geometry={bed.casing} />
            <Part id="torque-arm" name={`Torque arm (R = ${p.arm} m)`} material="paintYellow" role="static" info={{ summary: 'Torque arm on the dynamometer casing.', role: 'Its end rests on the scale: torque T = F × R.' }}>
              <PartMesh geometry={bed.arm} />
            </Part>
          </group>
          <Part id="dyno-rotor" name="Dynamometer rotor & shaft" material="steel" role="moving" info={{ summary: 'Rotor driven by the engine through the coupling shaft.' }}>
            <group ref={rotorRef}>
              <PartMesh geometry={bed.rotor} />
              <PartMesh geometry={bed.dynoShaft} />
              <PartMesh geometry={bed.shaft} />
              <PartMesh geometry={bed.couplings} material="steelDark" />
            </group>
          </Part>
          <Part id="trunnions" name="Trunnion bearings" material="castIron" role="housing" info={{ summary: 'Trunnion bearings let the casing swing about the shaft axis.' }}>
            <PartMesh geometry={bed.pedestals} />
          </Part>
          <Part id="scale" name="Weighing scale" material="paintGrey" role="housing" cut={false} info={{ summary: 'Scale under the torque arm — reads the force F.' }}>
            <PartMesh geometry={bed.scaleBody} />
            <PartMesh geometry={bed.dial} material="chrome" />
            <group ref={needleRef} position={[p.arm, -0.11, dynoZ + 0.052]}>
              <PartMesh geometry={bed.needle} material="paintRed" />
            </group>
          </Part>
        </Part>
        <PartMesh geometry={bed.base} material="concrete" />
      </Part>

      <Part id="heat-balance" name="Heat balance (ribbon widths ∝ energy)" role="fluid" cut={false} info={{ summary: `Energy flows, width proportional to share of the fuel energy (${sh.source}).`, role: 'Fuel energy in = brake power + cooling + exhaust + friction (typical splits 40/30/30 or 31/40/5.5/23.5).' }} cites={[SRC.supp509('heat balance 40/30/30'), SRC.tb509('§3.3')]}>
        {ribbonList.map(([k, rb]) => (
          <PartMesh key={k} geometry={rb.geo} customMaterial={mats[k]} castShadow={false} />
        ))}
      </Part>
      {ribbonList.map(([k, rb, f]) => (f > 0.004 ? <Flow key={`f-${k}`} curve={rb.curve} count={Math.max(4, Math.round(70 * f))} radius={0.006} color={RIBBON[k].color} speed={0.25} spread={0.02} intensity={() => 1} emissive={0.5} /> : null))}
      {ribbonList.map(([k, , f, at]) => (
        <Html key={`t-${k}`} position={at} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{ border: `1.5px solid ${RIBBON[k].color}`, borderRadius: 6, padding: '1px 6px', font: '600 11px Inter, sans-serif', color: '#e8efe9', background: 'rgba(12,17,15,0.78)', whiteSpace: 'nowrap' }}>
            {RIBBON[k].label} {pct(f)}
          </div>
        </Html>
      ))}
      <Html position={[p.arm, 0.03, dynoZ + 0.06]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ borderRadius: 6, padding: '1px 6px', font: '600 11px JetBrains Mono, monospace', color: '#f5e27a', background: 'rgba(12,17,15,0.8)', whiteSpace: 'nowrap' }}>
          F = {F.toFixed(0)} N
        </div>
      </Html>
      <PartLabel partId="dyno" at={[0.0, 0.24, dynoZ - 0.05]} />
      <PartLabel partId="torque-arm" at={[p.arm * 0.6, 0.05, dynoZ + 0.03]} />
      <PartLabel partId="scale" at={[p.arm + 0.06, -0.06, dynoZ]} />
      <PartLabel partId="engine" at={[0.12, 0.2, L / 2]} />
      <PartLabel partId="cooling-hw" at={[0.22, 0.3, radZ + 0.12]} />
      <PartLabel partId="exhaust-stack" at={[BARREL_X + 0.1, 0.6, 0]} />
      <PartLabel partId="fuel-tank" at={[0.55, 0.45, 0.12]} />
    </group>
  )
}
