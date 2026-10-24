import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { box, mat4, xform } from '@/geometry'
import { reactionOffset } from '@/physics/traction'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { TRACTOR } from '@/tractor/dims'
import { AXLE_Y, REAR_Z } from '@/tractor/geometry'
import { farmlandEffects } from '@/tractor/effects'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { ForceArrow, Ground, LiveTag, type ArrowState } from '../../chassis/common/three'
import { strainLink } from '@/parts/lib/chassis'
import { FARMLAND_REAR, toLeft, wheel, wheelWeight, wheelWeightStack } from '@/parts/lib/wheels'
import { slab } from '../../chassis/common/wheel'
import { D, REAR_TYRE, live, sinkage, solve, useLab, type LabParams, type Soil, type Solved } from './model'

/** how much dust each surface throws up (display) */
const SOIL_DUST: Record<Soil, number> = { firm: 0.35, tilled: 0.8, soft: 0.55 }

const { PI } = Math
/** arrow scale, m per kN */
const KN = 0.045
/** the run: the tractor drives from X0 to X1, then starts a fresh strip */
const X0 = -4.5
const X1 = 3.5
const PRINTS = 70
const LUGS = 22
/** static loaded radius from rr ≈ 1.06·slr (L27 p6) */
const SLR = D / 2 / 1.06

const C = {
  mech: [SRC.mech502('eqs 2.1–2.15, Fig 2.2')],
  l27: [SRC.l27('eqs 1–16, Figs 1–3')],
  test: [SRC.tests502('drawbar test, dynamometer car')],
}

/** Memoised solve: recomputed only when the zustand state object changes. */
function useSolved() {
  const cache = useRef<{ p: LabParams | null; s: Solved | null }>({ p: null, s: null })
  return () => {
    const p = useLab.getState()
    if (cache.current.p !== p) cache.current = { p, s: solve(p) }
    return cache.current.s!
  }
}

/** Dynamometer (load) car on the drawbar: local origin at the drawbar pin. */
function LoadCar({ wheels }: { wheels: React.RefObject<THREE.Group | null> }) {
  const g = useMemo(() => {
    const y0 = -TRACTOR.drawbar.y
    return {
      tongue: slab(-1.0, -0.04, 0, 0.04, 0.08),
      body: slab(-2.6, y0 + 0.32, -1.0, y0 + 0.82, 1.1),
      cell: xform(strainLink({ span: 0.26, bodyR: 0.04, bodyL: 0.14, eyeLen: 0.06, eyeT: 0.03, eyeR: 0.035 }), mat4.t(-0.55, 0, 0)),
      wheel: wheel({ radius: 0.3, width: 0.16, pattern: 'smooth' }),
    }
  }, [])
  const y0 = -TRACTOR.drawbar.y + 0.3
  return (
    <Part id="load-car" name="Dynamometer (load) car" role="static" material="paintYellow" cut={false} info={{ summary: 'Drawbar dynamometer car.', role: 'Braked to load the tractor with a set drawbar pull P, measured by a load cell in the drawbar. Speed is timed over a distance and wheel revolutions are counted, giving the slip.', details: 'Like the Nebraska tractor-test car: a hydraulic cylinder passes the pull to a pressure transducer and recorder. Shown schematically.' }} cites={C.test}>
      <PartMesh geometry={g.tongue} material="steelDark" />
      <PartMesh geometry={g.body} />
      <Part id="load-cell" name="Load cell (drawbar pull P)" role="static" material="chrome" info={{ summary: 'Tension load cell in the drawbar line.', role: 'Measures the drawbar pull P used in ηt = (P/(P + R))(1 − i).' }} cites={[SRC.tests502('dynamometers'), SRC.mech502('p8 measuring ηt')]}>
        <PartMesh geometry={g.cell} />
      </Part>
      {[-1.25, -2.35].map((x) =>
        [0.66, -0.66].map((z) => (
          <group key={`${x}${z}`} position={[x, y0, z]}>
            <group ref={x === -1.25 && z > 0 ? wheels : undefined}>
              <PartMesh geometry={g.wheel.tyre} material="rubber" />
              <group rotation={[0, z < 0 ? PI : 0, 0]}>
                <PartMesh geometry={g.wheel.rim} material="paintGrey" />
                {g.wheel.hub ? <PartMesh geometry={g.wheel.hub} material="steelDark" /> : null}
              </group>
            </group>
          </group>
        )),
      )}
    </Part>
  )
}

function WheelFBD({ get }: { get: () => Solved }) {
  const geo = useMemo(() => wheel({ ...FARMLAND_REAR, width: REAR_TYRE.b }), [])
  const spin = useRef<THREE.Group>(null)
  const theta = useRef(0)
  useSimFrame((dt) => {
    const s = get()
    theta.current += (s.op.V0 / (D / 2)) * dt
    spin.current?.rotation.set(0, 0, -theta.current)
  })
  const z = REAR_TYRE.b / 2 + 0.05
  const Wd = () => get().Vr / 2
  const eh = () => {
    const s = get()
    return reactionOffset(SLR, (s.br.MRR * s.Vr) / 2, Wd())
  }
  const set = (a: ArrowState, x: number, y: number, angle: number, kN: number, tip = false) => {
    a.x = x
    a.y = y
    a.z = z
    a.angle = angle
    a.length = Math.max(0, kN) * KN * 2
    a.tipAt = tip
  }
  return (
    <group>
      <Part id="fbd-wheel" name="Driving wheel (free body)" role="moving" material="rubber" info={{ summary: 'One rear driving wheel on soft soil as a free body.', role: 'Axle torque T drives it; the soil reaction acts ahead of the axle by eh = slr·MR/Wd, so the motion resistance MR is the moment arm of the dynamic load. Gross traction GT = T/rt; net traction NT = GT − MR.' }} cites={C.l27}>
        <group position={[0, SLR, 0]} ref={spin}>
          <PartMesh geometry={geo.tyre} />
          <PartMesh geometry={geo.rim} material="paintGrey" />
          {geo.hub ? <PartMesh geometry={geo.hub} material="steelDark" /> : null}
        </group>
      </Part>
      {/* dynamic load on the axle, down */}
      <ForceArrow color="#93a59a" get={(a) => set(a, 0, SLR, -PI / 2, Wd() / 1000, true)} />
      {/* soil reaction, vertical part, ahead of the axle by eh */}
      <ForceArrow color="#6fb3e0" get={(a) => set(a, eh(), 0, PI / 2, Wd() / 1000, true)} />
      {/* net traction on the axle (the wheel's share of the pull), rearward */}
      <ForceArrow color="#e8794f" get={(a) => set(a, 0, SLR, PI, (get().NTR * Wd()) / 1000)} />
      {/* gross traction at the contact, forward */}
      <ForceArrow color="#9bd17a" get={(a) => set(a, eh(), 0.01, 0, (get().br.GTR * Wd()) / 1000)} />
      {/* motion resistance at the contact, rearward */}
      <ForceArrow color="#c792ea" radius={0.014} get={(a) => set(a, eh(), 0.06, PI, (get().br.MRR * Wd()) / 1000)} />
      <LiveTag get={() => ({ text: `Wd ${(Wd() / 1000).toFixed(2)} kN`, x: 0.15, y: SLR + (Wd() / 1000) * KN * 2 + 0.1, z })} />
      <LiveTag get={() => ({ text: `NT ${((get().NTR * Wd()) / 1000).toFixed(2)} kN`, x: -0.25 - (get().NTR * Wd() * KN * 2) / 1000, y: SLR + 0.12, z })} />
      <LiveTag get={() => ({ text: `GT ${((get().br.GTR * Wd()) / 1000).toFixed(2)} kN`, x: eh() + 0.2 + (get().br.GTR * Wd() * KN * 2) / 1000, y: 0.12, z })} />
      <LiveTag get={() => ({ text: `MR ${((get().br.MRR * Wd()) / 1000).toFixed(2)} kN`, x: eh() - 0.4, y: -0.12, z })} />
      <LiveTag get={() => ({ text: `eh ${(eh() * 1000).toFixed(0)} mm · slr ${SLR.toFixed(3)} m`, x: 0.1, y: -0.32, z })} />
      <LiveTag get={() => {
        const s = get()
        return { text: `T = GT·rt ≈ ${(((s.br.GTR * Wd()) * D) / 2 / 1000).toFixed(2)} kN·m · slip ${(s.i * 100).toFixed(1)} %`, x: 0, y: SLR * 2 + 0.25, z }
      }} />
      <PartLabel partId="fbd-wheel" at={[-0.5, SLR * 2 + 0.05, z]} />
    </group>
  )
}

export function Lab3D() {
  const view = useLab((s) => s.view)
  const ballast = useLab((s) => s.ballast)
  const get = useSolved()
  const pose = useMemo(() => createTractorPose({ hitchHeight: 0.6 }), [])
  const body = useRef<THREE.Group>(null)
  const carWheel = useRef<THREE.Group>(null)
  const discs = useRef<THREE.Group>(null)
  const rut = useRef<THREE.Group>(null)
  const prints = useRef<THREE.InstancedMesh>(null)
  const sim = useRef({ x: X0, start: X0, lug: 0, theta: 0, carTheta: 0, printX: [] as number[], printS: [] as number[] })

  const G = useMemo(
    () => ({
      disc: wheelWeight(),
      discL: toLeft(wheelWeight()),
      rut: box(1, 0.006, REAR_TYRE.b),
      bar: box(1, 0.008, 1),
    }),
    [],
  )
  const printMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a1d14', roughness: 1 }), [])
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), zero: new THREE.Matrix4().makeScale(0, 0, 0) }), [])
  const nDisc = Math.min(6, Math.round(ballast / 80))

  useSimFrame((dt) => {
    const s = get()
    const st = sim.current
    const V0 = s.stalled ? 0 : s.op.V0
    const V = s.stalled ? 0 : s.op.V
    st.x += V * dt
    if (st.x > X1) {
      st.x = X0
      st.start = X0
      st.printX = []
      st.printS = []
    }
    st.theta += (V0 / (D / 2)) * dt
    st.carTheta += (V / 0.3) * dt
    pose.rearAngle = st.theta
    pose.frontAngle += (V / TRACTOR.front.radius) * dt
    pose.engineAngle += ((s.stalled ? 0 : s.op.rpm) / 60) * 2 * PI * dt
    pose.steer = 0
    pose.effects = farmlandEffects({ Te: s.op.Te, rpm: s.op.rpm, V, slip: s.i, stalled: s.stalled }, SOIL_DUST[useLab.getState().soil])
    live.x = st.x
    live.V = V
    live.V0 = V0
    live.slip = s.i
    body.current?.position.set(st.x, 0, 0)
    carWheel.current?.rotation.set(0, 0, -st.carTheta)
    discs.current?.rotation.set(0, 0, -st.theta)

    // ruts behind the rear wheels, from the start of this run to the axle
    if (rut.current) {
      const len = Math.max(1e-3, st.x - st.start)
      rut.current.position.set(st.start + len / 2, 0, 0)
      rut.current.scale.set(len, 1, 1)
    }
    // lug prints: one pair of bars per lug contact, closer together and smeared by slip
    const lug = Math.floor((st.theta * LUGS) / (2 * PI))
    if (lug !== st.lug) {
      st.lug = lug
      st.printX.push(st.x)
      st.printS.push(s.i)
      while (st.printX.length > PRINTS) {
        st.printX.shift()
        st.printS.shift()
      }
    }
    const pm = prints.current
    if (pm) {
      const { o } = tmp
      let k = 0
      for (let i = 0; i < PRINTS; i++) {
        const has = i < st.printX.length
        for (const side of [1, -1]) {
          for (const bar of [1, -1]) {
            if (!has) {
              pm.setMatrixAt(k++, tmp.zero)
              continue
            }
            const smear = 1 + 5 * Math.min(1, st.printS[i])
            o.position.set(st.printX[i], 0.004, side * REAR_Z + (bar * REAR_TYRE.b) / 4)
            o.rotation.set(0, (bar * PI) / 4, 0)
            o.scale.set(0.16 * smear, 1, 0.035)
            o.updateMatrix()
            pm.setMatrixAt(k++, o.matrix)
          }
        }
      }
      pm.instanceMatrix.needsUpdate = true
    }
  })

  const arrow = (fn: (s: Solved, a: ArrowState) => void) => (a: ArrowState) => fn(get(), a)
  const zf = REAR_Z + 0.32

  return (
    <group>
      <Ground length={18} width={5} x={-0.5} depth={0.4} cut cites={[SRC.l27('soil strength: cone index'), SRC.mech502('p6–7 slip and rolling resistance')]} />
      {view === 'wheel' ? (
        <WheelFBD get={get} />
      ) : (
        <>
          <group ref={body}>
            <Tractor pose={pose} trailed={<LoadCar wheels={carWheel} />} labels={false} />
            <Part id="rear-ballast" name={`Rear wheel weights (${2 * nDisc} discs)`} role="moving" material="castIron" cut={false} info={{ summary: 'Cast-iron weights on the rear wheel centres (the Ballast slider).', role: 'Adds weight on the driving wheels: more pull for the same slip, less slip loss — but more rolling resistance, so there is an optimum.' }} cites={[SRC.mech502('p7, p10'), SRC.l27('p40–44 ballast')]}>
              <group position={[0, AXLE_Y, 0]} ref={discs}>
                {wheelWeightStack(FARMLAND_REAR, nDisc).map((z, i) =>
                  [1, -1].map((sd) => <PartMesh key={`${i}${sd}`} geometry={sd > 0 ? G.disc : G.discL} position={[0, 0, sd * (REAR_Z + z)]} />),
                )}
              </group>
            </Part>
            {/* forces on the tractor (move with it) */}
            <ForceArrow color="#e8794f" onTop get={arrow((s, a) => Object.assign(a, { x: TRACTOR.drawbar.x, y: TRACTOR.drawbar.y, z: 0.0, angle: PI, length: (s.P / 1000) * KN }))} />
            <ForceArrow color="#9bd17a" get={arrow((s, a) => Object.assign(a, { x: 0, y: 0.02, z: zf, angle: 0, length: (s.op.H / 1000) * KN }))} />
            <ForceArrow color="#c792ea" radius={0.014} get={arrow((s, a) => Object.assign(a, { x: 0, y: 0.1, z: zf, angle: PI, length: ((s.R - s.Rf) / 1000) * KN }))} />
            <ForceArrow color="#c792ea" radius={0.014} get={arrow((s, a) => Object.assign(a, { x: TRACTOR.wheelbase, y: 0.05, z: zf, angle: PI, length: (s.Rf / 1000) * KN }))} />
            <ForceArrow color="#6fb3e0" get={arrow((s, a) => Object.assign(a, { x: TRACTOR.wheelbase, y: 0, z: zf + 0.1, angle: PI / 2, tipAt: true, length: (Math.max(0, s.Vf) / 1000) * KN }))} />
            <ForceArrow color="#6fb3e0" get={arrow((s, a) => Object.assign(a, { x: 0, y: 0, z: zf + 0.1, angle: PI / 2, tipAt: true, length: (s.Vr / 1000) * KN }))} />
            <PartLabel partId="load-car" at={[-2.6, 1.4, 0.6]} />
            <LiveTag get={() => ({ text: `P ${(get().P / 1000).toFixed(1)} kN`, x: TRACTOR.drawbar.x - (get().P / 1000) * KN - 0.25, y: TRACTOR.drawbar.y + 0.15, z: 0.4 })} />
            <LiveTag get={() => {
              const s = get()
              return { text: `H = P + R = ${(s.op.H / 1000).toFixed(1)} kN`, x: (s.op.H / 1000) * KN + 0.5, y: 0.15, z: zf }
            }} />
            <LiveTag get={() => {
              const s = get()
              return { text: s.spin ? 'wheels spinning — pull exceeds the traction limit' : `slip ${(s.i * 100).toFixed(1)} % · V ${(s.op.V * 3.6).toFixed(2)} of ${(s.op.V0 * 3.6).toFixed(2)} km/h`, x: 0, y: 2.8, z: 0, warn: s.spin || s.stalled }
            }} />
            <LiveTag get={() => ({ text: `Vf ${(get().Vf / 1000).toFixed(1)} kN`, x: TRACTOR.wheelbase, y: (Math.max(0, get().Vf) / 1000) * KN + 0.15, z: zf + 0.1, warn: get().Vf <= 0 })} />
            <LiveTag get={() => ({ text: `Vr ${(get().Vr / 1000).toFixed(1)} kN`, x: 0, y: (get().Vr / 1000) * KN + 0.15, z: zf + 0.1 })} />
          </group>
          <Part id="ruts" name="Wheel tracks" role="static" material="soil" cut={false} info={{ summary: 'Rear-wheel tracks and lug prints.', role: 'With slip the wheel turns further than it travels, so the lug prints are closer together than the lug pitch and smeared; on soft soil the tyre sinks and motion resistance rises (MRR = 1/Bn + 0.04 + 0.5s/√Bn).' }} cites={[SRC.tt510('p7 Fig 11'), SRC.l27('eq 16')]}>
            <group ref={rut}>
              {[1, -1].map((sd) => (
                <PartMesh key={sd} geometry={G.rut} material="soil" position={[0, 0.001, sd * REAR_Z]} />
              ))}
            </group>
            <instancedMesh ref={prints} args={[G.bar, printMat, PRINTS * 4]} frustumCulled={false} />
          </Part>
          <LiveTag get={() => {
            const s = get()
            return { text: `sinkage ≈ ${(sinkage(s.BnR, s.i) * 1000).toFixed(0)} mm (Bn ${s.BnR.toFixed(0)})`, x: sim.current.x - 1.2, y: 0.12, z: REAR_Z + 0.5 }
          }} />
          <PartLabel partId="ruts" at={[-3.5, 0.1, -REAR_Z]} />
        </>
      )}
    </group>
  )
}
