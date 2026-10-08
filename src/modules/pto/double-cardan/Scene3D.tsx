import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC, cite } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, lathe, mat4, merge, xform } from '@/geometry'
import { splineShaft } from '@/geometry/parts'
import { doubleHooke, rpmToRad } from '@/physics/joints'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { J, crossGeometry, crossQuaternion, cupsGeometry, needlesGeometry, pillowBlock, sealsGeometry, shaftGeometry, tubeShaftGeometry, yokeGeometry } from '../shared/cardan'
import { HJ2 } from '../shared/cites'
import { RIG, effectiveSpec, frames, live, makeGraph, outBodyAngle, pins, useDC } from './model'

const { PI } = Math

export const MS1718 = (where: string) => cite('AEE502', 'AEE 502 -2017-2018-marking scheme.docx', where)

const C = {
  dj: [HJ2('§26.2.3 Double Hooke’s joint, Figs 26.11–26.14'), SRC.uj502('p2, Fig 3'), MS1718('Q4(b) double Hooke’s joint')],
  rules: [SRC.top510('p5 (book p392): conditions for uniform velocity; BS 1495 hitch midway')],
  pto: [SRC.top510('p4, Fig A2.7 PTO drive shaft: telescopic lemon-profile shaft')],
}

const INFO = {
  rig: {
    summary: "Two Hooke's joints connected by a telescopic intermediate shaft — the layout of every tractor PTO drive shaft.",
    role: 'The second joint undoes the speed fluctuation of the first, provided the three conditions hold: all shafts in one plane, equal joint angles, and the intermediate yokes in line.',
    details: 'Test-rig proportions of a medium tractor PTO shaft (typical values).',
  },
  input: { summary: 'Driving shaft and yoke.', role: 'Turned at constant speed by the motor (the tractor PTO).' },
  cross1: { summary: 'First cross (spider) with needle-roller cups.', role: 'Joint 1: makes the intermediate shaft speed up and slow down twice per revolution.' },
  mid: {
    summary: 'Intermediate (propeller) shaft with a yoke at each end.',
    role: 'Its speed always fluctuates — it is the output of joint 1. Because it speeds up and slows down it should be light. Its two yokes must be in line (in the same plane) so that joint 2 is a quarter turn out of phase with joint 1.',
  },
  tube: { summary: 'Outer telescopic tube.', role: 'Slides over the inner shaft so the length can change as the implement moves and the tractor turns.' },
  inner: { summary: 'Inner sliding shaft (splined).', role: 'Transmits torque while sliding inside the tube. Many PTO shafts use a "lemon-profile" section to do the same job.' },
  cross2: { summary: 'Second cross (spider) with needle-roller cups.', role: 'Joint 2: driven by the fluctuating intermediate shaft. With equal angles and yokes in line it cancels the fluctuation exactly.' },
  output: { summary: 'Driven shaft, yoke and index flywheel.', role: 'Turns uniformly only when all three conditions are met; the red mark then stays level with the input mark.' },
  bearings: { summary: 'Pillow-block bearings.', role: 'Fix the input and output shafts; the intermediate shaft is carried only by the joints.' },
  motor: { summary: 'Driving motor (constant speed).', role: 'Stands in for the tractor PTO stub.' },
}

export function DoubleCardan3D() {
  const st = useDC()
  const spec = useMemo(() => effectiveSpec(st), [st])
  const f = useMemo(() => frames(spec), [spec])
  const specRef = useRef(spec)
  specRef.current = spec
  const fRef = useRef(f)
  fRef.current = f

  const g = useMemo(() => {
    const pb = pillowBlock(J.shaftR, RIG.drop)
    const L = RIG.L
    const half = L / 2
    return {
      yoke: yokeGeometry(),
      cross: crossGeometry(),
      cups: cupsGeometry(),
      needles: needlesGeometry(),
      seals: sealsGeometry(),
      inShaft: shaftGeometry(-0.5, -J.hubEnd),
      tube: tubeShaftGeometry(J.hubEnd - 0.004, half + 0.05, 0.024, 0.0195),
      inner: (() => {
        const xa = half - 0.03
        const xb = L - J.hubEnd + 0.004
        return xform(splineShaft(8, 0.019, 0.0165, xb - xa), mat4.c(mat4.t((xa + xb) / 2, 0, 0), mat4.rz(PI / 2)))
      })(),
      outShaft: shaftGeometry(J.hubEnd, RIG.outLen),
      pb,
      disc: xform(cylinder(RIG.discR, 0.014, 48), mat4.rz(PI / 2)),
      mark: box(0.02, 0.012, 0.014),
      flywheel: xform(lathe([[J.shaftR, -0.018], [0.1, -0.018], [0.108, -0.01], [0.108, 0.01], [0.1, 0.018], [J.shaftR, 0.018]], 64), mat4.rz(PI / 2)),
      motor: merge(
        xform(lathe([[0, -0.07], [0.06, -0.07], [0.066, -0.063], [0.066, 0.063], [0.06, 0.07], [0, 0.07]], 48), mat4.rz(PI / 2)),
        xform(box(0.11, 0.08, 0.13), mat4.t(0, -RIG.drop + 0.04, 0)),
      ),
    }
  }, [])

  const graph = useMemo(() => makeGraph(() => specRef.current), [])
  const inRot = useRef<THREE.Group>(null)
  const midRot = useRef<THREE.Group>(null)
  const outRot = useRef<THREE.Group>(null)
  const cross1 = useRef<THREE.Group>(null)
  const cross2 = useRef<THREE.Group>(null)
  const q1 = useMemo(() => new THREE.Quaternion(), [])
  const q2 = useMemo(() => new THREE.Quaternion(), [])

  useSimFrame((dt) => {
    const s = useDC.getState()
    const sp = specRef.current
    const w = rpmToRad(s.rpm)
    graph.drive('in', w)
    graph.step(dt)
    const a = { theta: graph.get('in').theta, thetaC: graph.get('mid').theta, thetaOut2: outBodyAngle(graph.get('out').theta, sp) }
    inRot.current?.rotation.set(a.theta, 0, 0)
    midRot.current?.rotation.set(a.thetaC + PI, 0, 0)
    outRot.current?.rotation.set(a.thetaOut2 + PI, 0, 0)
    const p = pins(fRef.current, a, sp.phase)
    cross1.current?.quaternion.copy(crossQuaternion(p.u0, p.u1, q1))
    cross2.current?.quaternion.copy(crossQuaternion(p.u2, p.u3, q2))

    const d = doubleHooke(sp, a.theta)
    live.theta = (((a.theta * 180) / PI) % 360 + 360) % 360
    live.ratioC = d.ratioC
    live.ratio = d.ratio
    live.omegaC = s.rpm * d.ratioC
    live.omegaOut = s.rpm * d.ratio
    let lag = ((graph.get('out').theta - a.theta) * 180) / PI
    lag -= Math.round(lag / 360) * 360
    live.lag = lag
  })

  const L = RIG.L
  return (
    <group>
      <Part id="rig" name="Double Hooke's joint rig" role="housing" material="castIron" info={INFO.rig} cites={[...C.dj, ...C.rules]}>
        <Part id="motor" name="Driving motor" material="paintBlue" role="housing" info={INFO.motor} beyondNotes explode={[-0.12, 0, 0]}>
          <PartMesh geometry={g.motor} position={[-0.58, 0, 0]} />
        </Part>
        <Part id="bearings" name="Pillow-block bearings" material="castIron" role="housing" info={INFO.bearings}>
          <PartMesh geometry={g.pb.housing} position={[-RIG.inBearing, 0, 0]} />
          <PartMesh geometry={g.pb.insert} material="bronze" position={[-RIG.inBearing, 0, 0]} />
          <group position={f.j2} quaternion={f.b2}>
            <PartMesh geometry={g.pb.housing} position={[RIG.outBearing, 0, 0]} />
            <PartMesh geometry={g.pb.insert} material="bronze" position={[RIG.outBearing, 0, 0]} />
          </group>
        </Part>

        <Part id="input" name="Driving shaft & yoke" role="moving" material="forged" info={INFO.input} cites={C.dj} explode={[-0.1, 0, 0]}>
          <group ref={inRot}>
            <PartMesh geometry={g.yoke} rotation={[PI / 2, 0, 0]} />
            <PartMesh geometry={g.inShaft} material="steel" />
            <PartMesh geometry={g.disc} material="paintGrey" position={[-0.4, 0, 0]} />
            <PartMesh geometry={g.mark} material="paintRed" position={[-0.4, 0, RIG.discR + 0.007]} />
          </group>
        </Part>

        <Part id="cross-1" name="Joint 1 cross & bearings" role="moving" material="steel" info={INFO.cross1} cites={[HJ2('§26.2.1')]} explode={[0, 0.16, 0]}>
          <group ref={cross1}>
            <PartMesh geometry={g.cross} />
            <PartMesh geometry={g.cups} material="steelDark" />
            <PartMesh geometry={g.needles} material="chrome" />
            <PartMesh geometry={g.seals} material="rubber" />
          </group>
        </Part>

        <group quaternion={f.b1}>
          <Part id="intermediate" name="Intermediate shaft" role="moving" material="forged" info={INFO.mid} cites={C.dj} explode={[0, -0.12, 0]}>
            <group ref={midRot}>
              <Part id="mid-yoke-1" name="Intermediate yoke (joint 1)" material="forged" info={INFO.mid} cites={C.dj}>
                <PartMesh geometry={g.yoke} rotation={[0, PI, 0]} />
              </Part>
              <Part id="tube" name="Telescopic tube" material="paintYellow" info={INFO.tube} cites={C.pto} explode={[-0.04, 0, 0]}>
                <PartMesh geometry={g.tube} />
              </Part>
              <Part id="inner" name="Sliding inner shaft" material="steel" info={INFO.inner} cites={C.pto} explode={[0.06, 0, 0]}>
                <PartMesh geometry={g.inner} />
                <PartMesh geometry={g.yoke} material="forged" position={[L, 0, 0]} rotation={[spec.phase, 0, 0]} />
              </Part>
            </group>
          </Part>
        </group>

        <group position={f.j2}>
          <Part id="cross-2" name="Joint 2 cross & bearings" role="moving" material="steel" info={INFO.cross2} cites={[HJ2('§26.2.1')]} explode={[0, 0.16, 0]}>
            <group ref={cross2}>
              <PartMesh geometry={g.cross} />
              <PartMesh geometry={g.cups} material="steelDark" />
              <PartMesh geometry={g.needles} material="chrome" />
              <PartMesh geometry={g.seals} material="rubber" />
            </group>
          </Part>
        </group>

        <group position={f.j2} quaternion={f.b2}>
          <Part id="output" name="Driven shaft & flywheel" role="moving" material="forged" info={INFO.output} cites={C.rules} explode={[0.1, 0, 0]}>
            <group ref={outRot}>
              <PartMesh geometry={g.yoke} rotation={[0, PI, 0]} />
              <PartMesh geometry={g.outShaft} material="steel" />
              <PartMesh geometry={g.flywheel} material="castIron" position={[0.28, 0, 0]} />
              <PartMesh geometry={g.mark} material="paintRed" position={[0.28, 0, -0.115]} />
            </group>
          </Part>
        </group>
      </Part>

      <PartLabel partId="cross-1" at={[0, 0.07, 0.03]} />
      <PartLabel partId="cross-2" at={[f.j2.x, f.j2.y + 0.07, f.j2.z + 0.03]} />
      <PartLabel partId="tube" at={[f.a1.x * L * 0.35, 0.05, f.a1.z * L * 0.35]} />
      <PartLabel partId="inner" at={[f.a1.x * L * 0.7, 0.05, f.a1.z * L * 0.7]} />
      <PartLabel partId="input" at={[-0.2, 0.05, 0]} />
      <PartLabel partId="output" at={[f.j2.x + f.a2.x * 0.28, f.j2.y + f.a2.y * 0.28 + 0.13, f.j2.z + f.a2.z * 0.28]} />
      <PartLabel partId="motor" at={[-0.58, 0.09, 0]} />
      <PartLabel partId="bearings" at={[-RIG.inBearing, -0.06, 0.07]} />
    </group>
  )
}
