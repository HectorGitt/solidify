import { Line } from '@react-three/drei'
import { Html } from '@/render/Html'
import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, gear, mat4, merge, tube, xform } from '@/geometry'
import { bevelGear, bevelPair } from '@/geometry/parts'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { ForceArrow, circlePoints } from '../_shared/Arrow'
import { A503 } from '../_shared/cites'
import { meshPhase } from '../_shared/loop'
import { BEVEL, SPUR, bevelResult, deg, helicalResult, idlerResult, live, spurResult, useGears, type GearParams } from './model'

const { PI } = Math
export const FLOOR = -0.32
const along = mat4.rx(PI / 2)
const C = { m5: [A503.m(5, 'slides 2–8')], mg: [A503.mg17('Q3b'), A503.mg19('Q3b')] }

function Spinner({ angle, children, ...rest }: { angle: () => number; children: ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null)
  useSimFrame(() => ref.current?.rotation.set(0, 0, angle()))
  return (
    <group {...rest}>
      <group ref={ref}>{children}</group>
    </group>
  )
}

/** Small DOM tag for nomenclature (shown with the toolbar's labels switch or always for the circles). */
function Tag({ at, children, color = '#c8d0d6' }: { at: [number, number, number]; children: ReactNode; color?: string }) {
  return (
    <Html position={at} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }} center>
      <div className="part-label" style={{ color, borderColor: color, whiteSpace: 'nowrap' }}>
        {children}
      </div>
    </Html>
  )
}

export function Gears3D() {
  const mode = useGears((s) => s.mode)
  const theta = useRef(0)
  useSimFrame((dt) => {
    theta.current += ((useGears.getState().rpm * 2 * PI) / 60) * dt
    live.theta = theta.current
  })
  return (
    <group>
      {mode === 'spur' || mode === 'helical' ? <SpurPair helical={mode === 'helical'} theta={theta} /> : null}
      {mode === 'bevel' ? <BevelPair theta={theta} /> : null}
      {mode === 'idler' ? <IdlerTrain theta={theta} /> : null}
    </group>
  )
}

function Housing({ x0, x1, y0, holes }: { x0: number; x1: number; y0: number; holes: [number, number][] }) {
  const geo = useMemo(() => {
    const plate = xform(box(x1 - x0, 0.012, 0.16), mat4.t((x0 + x1) / 2, y0, -0.03))
    const back = xform(box(x1 - x0, 0.012 - y0 + 0.08, 0.012), mat4.t((x0 + x1) / 2, (y0 + 0.08) / 2, -0.06))
    const bosses = holes.map(([x, y]) => xform(tube(0.04, 0.018, 0.03, 32), mat4.c(mat4.t(x, y, -0.06), along)))
    const legs = [x0 + 0.03, x1 - 0.03].map((x) => xform(box(0.04, y0 - FLOOR, 0.12), mat4.t(x, (y0 + FLOOR) / 2, -0.03)))
    return merge(plate, back, ...bosses, ...legs)
  }, [x0, x1, y0, holes])
  return (
    <Part id="housing" name="Gearbox wall" role="housing" material="castIron" info={{ summary: 'Gearbox casting.', role: 'Holds the shaft bearings at the exact centre distance a = m(z₁ + z₂)/2.' }} explode={[0, 0, -0.12]}>
      <PartMesh geometry={geo} />
    </Part>
  )
}

/* ------------------------------ spur & helical ------------------------------ */

function SpurPair({ helical, theta }: { helical: boolean; theta: React.MutableRefObject<number> }) {
  const p = useGears()
  const labels = useView((s) => s.labels)
  const { m, z1, z2, width } = SPUR
  const r1 = (m * z1) / 2
  const r2 = (m * z2) / 2
  const a = r1 + r2
  const x1 = -a / 2
  const x2 = a / 2
  const geo = useMemo(
    () => ({
      g1: gear({ teeth: z1, module: m, width, bore: 0.012, pressureAngleDeg: deg(p.phi), helixDeg: helical ? deg(p.helix) : 0 }),
      g2: gear({ teeth: z2, module: m, width, bore: 0.02, pressureAngleDeg: deg(p.phi), helixDeg: helical ? -deg(p.helix) : 0 }),
      s1: xform(cylinder(0.012, 0.16, 24), mat4.c(mat4.t(0, 0, -0.02), along)),
      s2: xform(cylinder(0.02, 0.16, 24), mat4.c(mat4.t(0, 0, -0.02), along)),
      hub2: xform(tube(0.045, 0.02, width + 0.02, 40), along),
    }),
    [helical, p.phi, p.helix, z1, z2, m, width],
  )
  const ph = meshPhase(0, z1, z2)
  // the torque acts on the gear whose diameter is D: the pinion (Ø100) for spur, the Ø250 gear for helical
  const onGear = Math.abs(p.D - 2 * r2) < 1e-3
  const f = helical ? helicalResult(p) : spurResult(p)
  const pitchPt = new THREE.Vector3(x1 + r1, 0, width / 2 + 0.004)
  const k = 0.12 / Math.max(f.Ft, 1)
  // forces on the driven member at the pitch point; the pinion drives CCW so the gear feels F_t downward (−y)
  const sgn = onGear ? 1 : -1
  const cx = onGear ? x2 : x1
  const radialDir = new THREE.Vector3(Math.sign(cx - pitchPt.x), 0, 0)
  const circ = spurResult(p).circles
  const z = width / 2 + 0.002
  const loa = useMemo(() => {
    const d = new THREE.Vector3(Math.sin(p.phi), Math.cos(p.phi), 0).multiplyScalar(0.07)
    return [pitchPt.clone().sub(d).toArray(), pitchPt.clone().add(d).toArray()] as [number, number, number][]
  }, [p.phi]) // eslint-disable-line react-hooks/exhaustive-deps
  const name = helical ? 'Helical' : 'Spur'
  return (
    <group>
      <Housing x0={x1 - r1 - 0.06} x1={x2 + r2 + 0.06} y0={-r2 - 0.05} holes={[[x1, 0], [x2, 0]]} />
      <Part id="pinion" name={`${name} pinion, ${z1} T, Ø${r1 * 2000} mm`} role="moving" material="steelMatte" info={{ summary: `${name} pinion: ${z1} teeth, module ${m * 1000} mm, pitch Ø${r1 * 2000} mm.`, role: helical ? 'Helical teeth (helix angle α from the axis) engage gradually: smoother and quieter, but they push the shaft endwise with F_a = F_t tan α.' : 'Teeth cut parallel to the axis. Driving gear of the pair.' }} cites={C.m5}>
        <Spinner angle={() => theta.current} position={[x1, 0, 0]}>
          <PartMesh geometry={geo.g1} />
          <PartMesh geometry={geo.s1} material="steelDark" />
        </Spinner>
      </Part>
      <Part id="gear" name={`${name} gear, ${z2} T, Ø${r2 * 2000} mm`} role="moving" material="steelMatte" info={{ summary: `${name} gear: ${z2} teeth, pitch Ø${r2 * 2000} mm.`, role: `Turns at N₁z₁/z₂ = ${(p.rpm * z1) / z2} rpm for ${p.rpm} rpm on the pinion.` }} cites={C.m5}>
        <Spinner angle={() => -(z1 / z2) * theta.current + ph} position={[x2, 0, 0]}>
          <PartMesh geometry={geo.g2} />
          <PartMesh geometry={geo.hub2} />
          <PartMesh geometry={geo.s2} material="steelDark" />
        </Spinner>
      </Part>
      {/* nomenclature on the pinion */}
      {!helical ? (
        <group position={[x1, 0, z]}>
          <Line points={circlePoints(circ.pitch, 160)} color="#f5b942" lineWidth={1.6} />
          <Line points={circlePoints(circ.addendum, 160)} color="#9bd17a" lineWidth={1} dashed dashSize={0.004} gapSize={0.003} />
          <Line points={circlePoints(circ.dedendum, 160)} color="#6fb3e0" lineWidth={1} dashed dashSize={0.004} gapSize={0.003} />
          <Line points={circlePoints(circ.base, 160)} color="#a78bfa" lineWidth={0.8} dashed dashSize={0.002} gapSize={0.003} />
          <Line points={circlePoints(r2, 200).map(([x, y, zz]) => [x + a, y, zz] as [number, number, number])} color="#f5b942" lineWidth={1.2} />
          {labels ? (
            <>
              <Tag at={[-circ.pitch * 0.7, circ.pitch * 0.72, 0]} color="#f5b942">pitch circle Ø{(circ.pitch * 2000).toFixed(0)}</Tag>
              <Tag at={[-circ.addendum * 0.2, circ.addendum + 0.008, 0]} color="#9bd17a">addendum circle (+m)</Tag>
              <Tag at={[-circ.dedendum * 0.62, -circ.dedendum * 0.62, 0]} color="#6fb3e0">dedendum circle (−1.25m)</Tag>
              <Tag at={[circ.base * 0.2, -circ.base - 0.006, 0]} color="#a78bfa">base circle</Tag>
              <Tag at={[r1 + 0.012, 0.03, 0]} color="#e8794f">pitch point</Tag>
              <Tag at={[r1 - 0.03, 0.075, 0]} color="#e8794f">line of action, φ = {deg(p.phi).toFixed(1)}°</Tag>
            </>
          ) : null}
        </group>
      ) : null}
      {!helical ? <Line points={loa} color="#e8794f" lineWidth={1.4} /> : null}
      {/* forces at the pitch point */}
      <ForceArrow color="#e8794f" spec={() => ({ origin: pitchPt, dir: new THREE.Vector3(0, sgn, 0), length: f.Ft * k, label: `Fₜ = ${f.Ft.toFixed(0)} N` })} />
      <ForceArrow color="#6fb3e0" spec={() => ({ origin: pitchPt, dir: radialDir, length: f.Fr * k, label: `Fᵣ = ${f.Fr.toFixed(0)} N` })} />
      {helical ? <ForceArrow color="#9bd17a" spec={() => ({ origin: pitchPt, dir: new THREE.Vector3(0, 0, 1), length: (f as ReturnType<typeof helicalResult>).Fa * k, label: `Fₐ = ${(f as ReturnType<typeof helicalResult>).Fa.toFixed(0)} N` })} /> : null}
      <PartLabel partId="pinion" at={[x1 - r1 * 0.5, r1 + 0.03, 0.02]} />
      <PartLabel partId="gear" at={[x2 + r2 * 0.4, r2 + 0.03, 0.02]} />
      <PartLabel partId="housing" at={[x2 + r2, -r2, -0.06]} />
    </group>
  )
}

/* ------------------------------ bevel ------------------------------ */

function BevelPair({ theta }: { theta: React.MutableRefObject<number> }) {
  const p = useGears()
  const { m, z1, z2, face } = BEVEL
  const cone = bevelPair(z1, z2)
  const R1 = (m * z1) / 2
  const R2 = (m * z2) / 2
  const A = R1 / Math.sin((cone.pinion * PI) / 180)
  const h1 = A * Math.cos((cone.pinion * PI) / 180)
  const h2 = A * Math.cos((cone.gear * PI) / 180)
  const geo = useMemo(
    () => ({
      g1: bevelGear({ teeth: z1, module: m, faceWidth: face, pitchAngleDeg: cone.pinion, bore: 0.014 }),
      g2: bevelGear({ teeth: z2, module: m, faceWidth: face, pitchAngleDeg: cone.gear, bore: 0.02 }),
      s1: xform(cylinder(0.014, 0.16, 24), mat4.t(0, 0, -0.07)),
      s2: xform(cylinder(0.02, 0.18, 24), mat4.t(0, 0, -0.08)),
    }),
    [z1, z2, m, face, cone.pinion, cone.gear],
  )
  const r = bevelResult(p)
  // mean-radius contact point on the line where the pitch cones touch
  const el = new THREE.Vector3(-h1, -R1, 0).normalize()
  const mean = el.clone().multiplyScalar(A - face / 2)
  const k = 0.12 / Math.max(r.Ft, 1)
  // pinion: local Z → world +X, apex at origin; gear: local Z → world +Y
  const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PI / 2, 0))
  const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-PI / 2, 0, 0))
  const INFO = {
    pinion: { summary: `Straight bevel pinion, ${z1} T, Ø${R1 * 2000} mm, pitch cone β = ${cone.pinion.toFixed(2)}°.`, role: 'Bevel gears connect intersecting shafts (here at 90°). tan β = r_pinion / r_gear; sin β = 0.6 for the 4 : 3 pair.' },
    gear: { summary: `Bevel gear, ${z2} T, Ø${R2 * 2000} mm, cone ${cone.gear.toFixed(2)}°.`, role: 'The separating force F_t tan φ splits into a thrust along each shaft: F_p on the pinion, F_g on the gear.' },
  }
  return (
    <group position={[0.06, 0.1, 0]}>
      <Part id="pinion" name={`Bevel pinion, ${z1} T`} role="moving" material="steelMatte" info={INFO.pinion} cites={[A503.m(5, 'slides 13–15'), A503.mg15('Q3c')]}>
        <group position={[-h1, 0, 0]} quaternion={q1}>
          <Spinner angle={() => -PI / 2 + theta.current}>
            <PartMesh geometry={geo.g1} />
            <PartMesh geometry={geo.s1} material="steelDark" />
          </Spinner>
        </group>
      </Part>
      <Part id="gear" name={`Bevel gear, ${z2} T`} role="moving" material="steelMatte" info={INFO.gear} cites={[A503.m(5, 'slides 13–15'), A503.mg15('Q3c')]}>
        <group position={[0, -h2, 0]} quaternion={q2}>
          <Spinner angle={() => PI - PI / z2 - (z1 / z2) * theta.current}>
            <PartMesh geometry={geo.g2} />
            <PartMesh geometry={geo.s2} material="steelDark" />
          </Spinner>
        </group>
      </Part>
      <Line points={[[0, 0, 0], el.clone().multiplyScalar(A + 0.03).toArray() as [number, number, number]]} color="#f5b942" lineWidth={1} dashed dashSize={0.006} gapSize={0.004} />
      <ForceArrow color="#e8794f" spec={() => ({ origin: mean, dir: new THREE.Vector3(0, 0, 1), length: r.Ft * k, label: `Fₜ = ${r.Ft.toFixed(0)} N` })} />
      <ForceArrow color="#9bd17a" spec={() => ({ origin: mean, dir: new THREE.Vector3(-1, 0, 0), length: Math.max(0.02, r.Fp * k * 2), label: `Fₚ = ${r.Fp.toFixed(0)} N` })} />
      <ForceArrow color="#6fb3e0" spec={() => ({ origin: mean, dir: new THREE.Vector3(0, -1, 0), length: Math.max(0.02, r.Fg * k * 2), label: `F_g = ${r.Fg.toFixed(0)} N` })} />
      <PartLabel partId="pinion" at={[-h1 - 0.05, R1 + 0.03, 0]} />
      <PartLabel partId="gear" at={[R2 + 0.03, -h2, 0]} />
    </group>
  )
}

/* ------------------------------ idler train ------------------------------ */

function IdlerTrain({ theta }: { theta: React.MutableRefObject<number> }) {
  const p = useGears()
  const r = idlerResult(p)
  const aAB = r.rA + r.rB
  const aBC = r.rB + r.rC
  const cA: [number, number] = [-aAB, 0]
  const u2: [number, number] = [-Math.cos(p.psi), Math.sin(p.psi)]
  const cC: [number, number] = [aBC * u2[0], aBC * u2[1]]
  const w = 0.04
  const geo = useMemo(() => {
    const mk = (z: number, bore: number) => gear({ teeth: z, module: p.m, width: w, bore, pressureAngleDeg: deg(p.phiI), flankPoints: 5 })
    return { A: mk(p.zA, 0.015), B: mk(p.zB, 0.018), C: mk(p.zC, 0.02), sh: xform(cylinder(0.015, 0.14, 20), mat4.c(mat4.t(0, 0, -0.04), along)) }
  }, [p.zA, p.zB, p.zC, p.m, p.phiI])
  const phB = meshPhase(0, p.zA, p.zB)
  const gBC = Math.atan2(u2[1], u2[0])
  const phC = meshPhase(gBC, p.zB, p.zC)
  const thB = () => -(p.zA / p.zB) * theta.current + phB
  const thC = () => -(p.zB / p.zC) * thB() + phC
  const xs = [cA[0] - r.rA, cC[0] + r.rC, 0 - r.rB, 0 + r.rB]
  const ys = [-r.rB, cC[1] - r.rC, -r.rA]
  const k = 0.1 / Math.max(r.Ft, 1)
  const load = new THREE.Vector3(Math.cos(r.loadDir), Math.sin(r.loadDir), 0)
  return (
    <group position={[0.05, 0, 0]}>
      <Housing x0={Math.min(...xs) - 0.05} x1={Math.max(...xs) + 0.05} y0={Math.min(...ys) - 0.05} holes={[cA, [0, 0], cC]} />
      <Part id="gear-a" name={`Gear A (driver), ${p.zA} T`} role="moving" material="steelMatte" info={{ summary: `Gear A: ${p.zA} teeth × module ${p.m * 1000} = Ø${(r.D[0] * 1000).toFixed(0)} mm.`, role: `Input: ${p.iP / 1000} kW at ${p.iRpm} rpm → T_A = ${r.TA.toFixed(1)} N·m.` }} cites={[A503.mg17('Q2c'), A503.mg21('Q2c')]}>
        <Spinner angle={() => theta.current} position={[cA[0], cA[1], 0]}>
          <PartMesh geometry={geo.A} />
          <PartMesh geometry={geo.sh} material="steelDark" />
        </Spinner>
      </Part>
      <Part id="gear-b" name={`Gear B (idler), ${p.zB} T`} role="moving" material="steelMatte" info={{ summary: `Idler B: ${p.zB} teeth, Ø${(r.D[1] * 1000).toFixed(0)} mm.`, role: 'An idler only reverses the direction: it transmits no torque to its shaft, so N_C = N_A·z_A/z_C whatever its size. Its shaft still carries the two tooth loads.' }} cites={[A503.mg17('Q2c')]}>
        <Spinner angle={thB}>
          <PartMesh geometry={geo.B} />
          <PartMesh geometry={geo.sh} material="steelDark" />
        </Spinner>
      </Part>
      <Part id="gear-c" name={`Gear C (driven), ${p.zC} T`} role="moving" material="steelMatte" info={{ summary: `Gear C: ${p.zC} teeth, Ø${(r.D[2] * 1000).toFixed(0)} mm.`, role: `Output: T_C = ${r.TC.toFixed(1)} N·m at ${r.rpmC.toFixed(1)} rpm — same sense as A.` }} cites={[A503.mg17('Q2c')]}>
        <Spinner angle={thC} position={[cC[0], cC[1], 0]}>
          <PartMesh geometry={geo.C} />
          <PartMesh geometry={geo.sh} material="steelDark" />
        </Spinner>
      </Part>
      <ForceArrow color="#e8794f" spec={() => ({ origin: new THREE.Vector3(0, 0, w / 2 + 0.01), dir: load, length: r.load * k, label: `idler shaft load ${r.load.toFixed(0)} N` })} />
      <ForceArrow color="#6fb3e0" spec={() => ({ origin: new THREE.Vector3(-r.rB, 0, w / 2 + 0.01), dir: new THREE.Vector3(0, -1, 0), length: r.Ft * k, label: `Fₜ = ${r.Ft.toFixed(0)} N` })} />
      <PartLabel partId="gear-a" at={[cA[0], r.rA + 0.03, 0.03]} />
      <PartLabel partId="gear-b" at={[0, r.rB + 0.03, 0.03]} />
      <PartLabel partId="gear-c" at={[cC[0], cC[1] + r.rC + 0.03, 0.03]} />
    </group>
  )
}

export type { GearParams }
