import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, lathe, mat4, merge, xform } from '@/geometry'
import { PITCH } from '@/physics/elements'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { ForceArrow } from '../_shared/Arrow'
import { A503 } from '../_shared/cites'
import { motor, pillowBlock, shaft } from '../belts/geometry'
import { ChainStrands, SprocketPart } from './ChainParts'
import { PLANTER, live, planterTrain, select, twoSprocketLoop, useChains } from './model'

const { PI } = Math
export const FLOOR = -0.36

export function Chains3D() {
  const mode = useChains((s) => s.mode)
  return mode === 'planter' ? <Planter /> : <Drive />
}

function Drive() {
  const p = useChains()
  const pm = PITCH[p.pitch]
  const cl = useMemo(() => twoSprocketLoop(p.z1, p.z2, pm, p.cPitches), [p.z1, p.z2, pm, p.cPitches])
  const m = useRef(0)
  const R1 = pm / (2 * Math.sin(PI / p.z1))
  const R2 = pm / (2 * Math.sin(PI / p.z2))
  const [c1, c2] = cl.centres
  const zw = (p.strands - 1) * 1.09 * pm
  const statics = useMemo(() => {
    const bedY = -Math.max(R1, R2) - 0.08
    return {
      bedY,
      motor: motor(0.09, 0.26),
      stand: xform(box(0.18, Math.max(0.01, -bedY - 0.09), 0.22), mat4.t(0, (bedY - 0.09) / 2, -0.22)),
      pillow: pillowBlock(0.02, -bedY),
      shaft1: shaft(0.012, -0.1, 0.03 + zw / 2),
      shaft2: shaft(0.02, -0.3, 0.04 + zw / 2),
      bed: xform(box(cl.C + R1 + R2 + 0.3, 0.03, 0.42), mat4.t(0, bedY - 0.015, -0.15)),
      leg: box(0.05, 1, 0.05),
      legH: Math.max(0.01, bedY - 0.03 - FLOOR),
    }
  }, [R1, R2, cl.C, zw])

  useSimFrame((dt) => {
    const w1 = (p.rpm * 2 * PI) / 60
    m.current = (m.current + (w1 * pm * p.z1) / (2 * PI) * dt) % cl.M
    live.m0 = m.current
    live.rpm2 = (p.rpm * p.z1) / p.z2
    live.v = (p.z1 * pm * p.rpm) / 60
    live.links = cl.links
    live.C = cl.C
  })
  const m0 = () => m.current
  const sel = select(p)
  const tight = () => {
    const seg = cl.loop.segs[3]
    const a = new THREE.Vector3(...seg.p1!, 0.05)
    const b = new THREE.Vector3(...seg.p0!, 0.05)
    const F = (sel.design * 1000) / Math.max(0.1, sel.v)
    return { origin: a, dir: b.sub(a), length: 0.12, label: `F ≈ P/v = ${F.toFixed(0)} N` }
  }

  return (
    <group>
      <Part id="drive" name="Chain drive" role="moving" material="steel" info={{ summary: `${p.strands === 2 ? 'Duplex' : 'Simplex'} roller-chain drive, ${p.pitch}″ pitch, ${p.z1}/${p.z2} teeth.`, role: 'Positive drive: no slip, so the speed ratio is exactly z₂/z₁.' }} cites={[A503.m(3), A503.mg17('Q1c')]}>
        <Part id="frame" name="Bed" role="housing" material="paintGrey" info={{ summary: 'Machine bed.', role: 'Keeps the shafts parallel and the sprockets in line.' }} explode={[0, -0.1, 0]}>
          <PartMesh geometry={statics.bed} />
          {[-1, 1].map((sx) => (
            <PartMesh key={sx} geometry={statics.leg} position={[sx * (cl.C / 2 + Math.max(R1, R2)), FLOOR + statics.legH / 2, -0.15]} scale={[1, statics.legH, 1]} />
          ))}
        </Part>
        <group position={[c1[0], c1[1], 0]}>
          <Part id="motor" name="Gear motor" role="housing" material="paintBlue" info={{ summary: 'Driving motor.', role: `Turns the driving sprocket at ${p.rpm} rpm.` }} explode={[0, 0, -0.2]}>
            <PartMesh geometry={statics.motor} position={[0, 0, -0.1]} />
            <PartMesh geometry={statics.stand} material="paintGrey" />
          </Part>
          <Part id="shaft1" name="Driving shaft" role="moving" material="steel">
            <PartMesh geometry={statics.shaft1} />
          </Part>
        </group>
        <group position={[c2[0], c2[1], 0]}>
          <Part id="bearings" name="Plummer blocks" role="housing" material="castIron" info={{ summary: 'Bearings of the driven shaft.', role: 'Carry the chain pull.' }} explode={[0, 0, -0.15]}>
            <PartMesh geometry={statics.pillow} position={[0, 0, -0.12]} />
            <PartMesh geometry={statics.pillow} position={[0, 0, -0.26]} />
          </Part>
        </group>
        <DrivenShaft cl={cl} z={p.z2} m0={m0} geo={statics.shaft2} at={c2} />
        <SprocketPart id="sprocket1" name={`Driving sprocket, ${p.z1} T`} cl={cl} i={0} z={p.z1} p={pm} strands={p.strands} m0={m0} at={c1} info={{ summary: `Driving sprocket, ${p.z1} teeth, pitch Ø${(2 * R1 * 1000).toFixed(1)} mm.`, role: 'The smaller sprocket goes on the faster shaft; more teeth run smoother (less chordal action).' }} />
        <SprocketPart id="sprocket2" name={`Driven sprocket, ${p.z2} T`} cl={cl} i={1} z={p.z2} p={pm} strands={p.strands} m0={m0} at={c2} material="castIron" info={{ summary: `Driven sprocket, ${p.z2} teeth, pitch Ø${(2 * R2 * 1000).toFixed(1)} mm.`, role: `Turns at N₁z₁/z₂ = ${((p.rpm * p.z1) / p.z2).toFixed(1)} rpm.` }} />
        <ChainStrands cl={cl} p={pm} strands={p.strands} m0={m0} />
      </Part>
      <ForceArrow color="#e8794f" spec={tight} radius={0.003} />
      <PartLabel partId="sprocket1" at={[c1[0], R1 + 0.05, 0.04]} />
      <PartLabel partId="sprocket2" at={[c2[0], R2 + 0.05, 0.04]} />
      <PartLabel partId="rollers" at={[0, -Math.max(R1, R2) * 0.7, 0.03]} />
      <PartLabel partId="outer-plates" at={[-0.1, Math.max(R1, R2) * 0.75, 0.04]} />
      <PartLabel partId="motor" at={[c1[0] - 0.1, 0.12, -0.3]} />
    </group>
  )
}

function DrivenShaft({ cl, z, m0, geo, at }: { cl: ReturnType<typeof twoSprocketLoop>; z: number; m0: () => number; geo: THREE.BufferGeometry; at: [number, number] }) {
  const ref = useRef<THREE.Group>(null)
  useSimFrame(() => {
    const p = cl.M / cl.links
    ref.current?.rotation.set(0, 0, (m0() / p) * ((2 * PI) / z))
  })
  return (
    <Part id="shaft2" name="Driven shaft" role="moving" material="steel">
      <group position={[at[0], at[1], 0]}>
        <group ref={ref}>
          <PartMesh geometry={geo} />
        </group>
      </group>
    </Part>
  )
}

/* ------------------------------ planter train ------------------------------ */

function Planter() {
  const speed = useChains((s) => s.speed)
  const pm = PLANTER.pitch
  const loopA = useMemo(() => twoSprocketLoop(PLANTER.zWheel, PLANTER.zLayIn, pm, PLANTER.pitchesA, [0, 0], PLANTER.angleA), [pm])
  const lay = loopA.centres[1]
  const loopB = useMemo(() => twoSprocketLoop(PLANTER.zLayOut, PLANTER.zMeter, pm, PLANTER.pitchesB, lay, PLANTER.angleB), [pm, lay])
  const meter = loopB.centres[1]
  const mA = useRef(0)
  const mB = useRef(0)
  const wheel = useRef<THREE.Group>(null)
  const plate = useRef<THREE.Group>(null)
  const th = useRef({ w: 0, m: 0 })
  const zA = 0.07
  const zB = 0.1

  const geo = useMemo(() => {
    const R = PLANTER.wheelR
    const tyre = xform(lathe([[R * 0.62, -0.05], [R - 0.02, -0.055], [R, -0.03], [R, 0.03], [R - 0.02, 0.055], [R * 0.62, 0.05]], 64), mat4.rx(PI / 2))
    const disc = xform(lathe([[0.012, -0.03], [R * 0.64, -0.012], [R * 0.64, 0.012], [0.012, 0.03]], 48), mat4.rx(PI / 2))
    const cells: THREE.BufferGeometry[] = []
    const plateR = 0.075
    const plateDisc = xform(cylinder(plateR, 0.006, 48), mat4.rx(PI / 2))
    for (let i = 0; i < PLANTER.cells; i++) {
      const a = (2 * PI * i) / PLANTER.cells
      cells.push(xform(box(0.012, 0.008, 0.0065), mat4.c(mat4.rz(a), mat4.t(plateR - 0.004, 0, 0))))
    }
    const beam = xform(box(0.9, 0.08, 0.08), mat4.t(0.2, lay[1] + 0.12, -0.06))
    const arm = merge(xform(box(0.05, lay[1] + 0.16, 0.03), mat4.t(0, (lay[1] + 0.16) / 2 - 0.04, -0.03)), xform(box(meter[0] - lay[0] + 0.06, 0.04, 0.03), mat4.t((lay[0] + meter[0]) / 2, (lay[1] + meter[1]) / 2, -0.03)))
    const hopper = xform(lathe([[0, 0], [0.04, 0], [0.11, 0.14], [0.11, 0.2], [0, 0.2]], 4, PI / 4), mat4.t(meter[0], meter[1] + 0.03, -0.06))
    const axleA = shaft(0.012, -0.08, zA + 0.03)
    const axleL = shaft(0.012, -0.06, zB + 0.03)
    const axleM = shaft(0.01, -0.09, zB + 0.03)
    return { tyre, disc, plateDisc, cells: merge(...cells), beam, arm, hopper, axleA, axleL, axleM }
  }, [lay, meter])

  useSimFrame((dt) => {
    const t = planterTrain(speed)
    const ww = (t.wheelRpm * 2 * PI) / 60
    mA.current = (mA.current + (ww * pm * PLANTER.zWheel) / (2 * PI) * dt) % loopA.M
    const wl = ww * (PLANTER.zWheel / PLANTER.zLayIn)
    mB.current = (mB.current + (wl * pm * PLANTER.zLayOut) / (2 * PI) * dt) % loopB.M
    th.current.w += ww * dt
    th.current.m += ww * t.meterPerWheel * dt
    wheel.current?.rotation.set(0, 0, th.current.w)
    plate.current?.rotation.set(0, 0, th.current.m)
  })

  const INFO = {
    wheel: { summary: 'Press wheel (ground drive).', role: 'Rolls on the firmed seed row; because it is driven by the ground, the seed rate per metre stays the same whatever the forward speed.' },
    lay: { summary: 'Lay shaft (counter-shaft).', role: 'Carries a large sprocket from the press wheel and a small one to the meter: changing these sprockets changes the seed spacing.' },
    meter: { summary: 'Seed-metering plate.', role: 'A celled plate under the hopper: each cell picks one seed and drops it down the tube.' },
  }
  const C = [A503.mg16('Q1 planter chain drive'), A503.m(3)]
  return (
    <group position={[-0.2, FLOOR + PLANTER.wheelR, 0]}>
      <Part id="planter" name="Planter drive train" role="moving" material="steel" info={{ summary: 'Planter drive: press wheel → lay shaft → seed meter, all by roller chain.', role: 'Chains give a positive (slip-free) drive, so seed spacing does not drift.' }} cites={C}>
        <Part id="frame" name="Planter frame" role="housing" material="paintRed" info={{ summary: 'Toolbar and drive arm.', role: 'Hold the shafts at fixed centres.' }} beyondNotes>
          <PartMesh geometry={geo.beam} />
          <PartMesh geometry={geo.arm} />
        </Part>
        <Part id="hopper" name="Seed hopper" role="housing" material="paintYellow" info={{ summary: 'Seed hopper.', role: 'Feeds seed onto the metering plate.' }} beyondNotes explode={[0, 0.12, 0]}>
          <PartMesh geometry={geo.hopper} />
        </Part>
        <Part id="press-wheel" name="Press wheel" role="moving" material="rubber" info={INFO.wheel} cites={C}>
          <group ref={wheel}>
            <PartMesh geometry={geo.tyre} />
            <PartMesh geometry={geo.disc} material="paintGrey" />
            <PartMesh geometry={geo.axleA} material="steel" />
          </group>
        </Part>
        <SprocketPart id="wheel-sprocket" name={`Press-wheel sprocket, ${PLANTER.zWheel} T`} cl={loopA} i={0} z={PLANTER.zWheel} p={pm} strands={1} m0={() => mA.current} at={[0, 0]} zOffset={zA} info={{ summary: 'Sprocket on the press-wheel axle.', role: 'Drives the lay shaft.' }} />
        <SprocketPart id="lay-in" name={`Lay-shaft sprocket, ${PLANTER.zLayIn} T`} cl={loopA} i={1} z={PLANTER.zLayIn} p={pm} strands={1} m0={() => mA.current} at={lay} zOffset={zA} info={INFO.lay} />
        <SprocketPart id="lay-out" name={`Lay-shaft sprocket, ${PLANTER.zLayOut} T`} cl={loopB} i={0} z={PLANTER.zLayOut} p={pm} strands={1} m0={() => mB.current} at={lay} zOffset={zB} info={INFO.lay} />
        <SprocketPart id="meter-sprocket" name={`Meter sprocket, ${PLANTER.zMeter} T`} cl={loopB} i={1} z={PLANTER.zMeter} p={pm} strands={1} m0={() => mB.current} at={meter} zOffset={zB} info={INFO.meter} />
        <Part id="lay-shaft" name="Lay shaft" role="moving" material="steel" info={INFO.lay}>
          <PartMesh geometry={geo.axleL} position={[lay[0], lay[1], 0]} />
        </Part>
        <Part id="seed-plate" name="Seed plate" role="moving" material="nylon" info={INFO.meter} beyondNotes>
          <group position={[meter[0], meter[1], -0.02]}>
            <group ref={plate}>
              <PartMesh geometry={geo.plateDisc} />
              <PartMesh geometry={geo.cells} material="paintBlack" />
            </group>
            <PartMesh geometry={geo.axleM} material="steel" />
          </group>
        </Part>
        <group position={[0, 0, zA]}>
          <ChainStrands cl={loopA} p={pm} strands={1} m0={() => mA.current} idPrefix="a-" />
        </group>
        <group position={[0, 0, zB]}>
          <ChainStrands cl={loopB} p={pm} strands={1} m0={() => mB.current} idPrefix="b-" />
        </group>
      </Part>
      <PartLabel partId="press-wheel" at={[0.05, -0.12, 0.12]} />
      <PartLabel partId="lay-shaft" at={[lay[0] + 0.04, lay[1] + 0.05, 0.12]} />
      <PartLabel partId="seed-plate" at={[meter[0] + 0.05, meter[1] - 0.08, 0.05]} />
      <PartLabel partId="hopper" at={[meter[0], meter[1] + 0.25, 0]} />
    </group>
  )
}
