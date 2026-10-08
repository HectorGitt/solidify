import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { DriveGraph, hookeJoint } from '@/core/drive'
import { useSimFrame } from '@/core/sim'
import { cylinder, extrude, lathe, mat4, merge, box, xform } from '@/geometry'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { hookeAcceleration, hookeVelocityRatio, inertiaFromWeight, rad, rpmToRad } from '@/physics/joints'
import {
  J,
  crossGeometry,
  cupsGeometry,
  needlesGeometry,
  pillowBlock,
  sealsGeometry,
  shaftGeometry,
  yawQuat,
  yokeGeometry,
} from '../shared/cardan'
import { HJ2 } from '../shared/cites'
import { RIG, jointPose, live, useHooke, type JointPose } from './model'

const { PI } = Math


export const C = {
  hj: [SRC.hj502('slides 2–5'), SRC.uj502('p1–3, Figs 1–2')],
  theory: [HJ2('§26.2.2, Figs 26.9–26.10'), SRC.uj502('p2–3')],
  cross: [HJ2('§26.2.1 Hardy Spicer cross-type joint'), SRC.hj502('components')],
  pto: [SRC.top510('p4–5, Fig A2.7'), SRC.pto502('implement driveline')],
}

const INFO = {
  rig: {
    summary: "A single Hooke's (cardan, Hardy Spicer) joint between two shafts at an angle δ.",
    details: 'Test-rig layout for study: constant-speed motor in, a driven mass out. Proportions are those of a medium tractor PTO joint (typical values).',
  },
  inYoke: {
    summary: 'Driving yoke (fork), forged integral with the driving shaft hub.',
    role: 'Carries one pair of cross trunnions in its ears. When its ears lie in the plane of the two shafts (θ = 0°, 180°) the driven shaft runs fastest, ω_B = ω_A/cos δ.',
  },
  outYoke: {
    summary: 'Driven yoke (fork) on the driven shaft.',
    role: 'Its ears hold the second pair of trunnions at right angles to the first. When the driving yoke is at 90° to the plane of the shafts the driven shaft runs slowest, ω_B = ω_A·cos δ.',
  },
  cross: {
    summary: 'Cross (spider, trunnion block) — the connecting link.',
    role: 'Its four arms are at right angles. One pair pivots in the driving yoke and the other in the driven yoke, so torque passes through the cross while the shafts are at an angle. The centre is drilled as a grease reservoir.',
  },
  cups: {
    summary: 'Needle-roller bearing cups with circlips.',
    role: 'Hardened steel cups pressed into the yoke ears and held by circlips; the bottom of each cup locates the cross centrally.',
  },
  needles: {
    summary: 'Needle rollers (16 per cup).',
    role: 'Let the trunnions oscillate in the cups with little friction. They only rock back and forth through ±δ each revolution, so loss of lubrication lets them indent the trunnions (brinelling) — the cause of the "clonk" of a worn joint.',
  },
  seals: { summary: 'Trunnion seals.', role: 'Keep the grease in the cups and dirt out.' },
  inShaft: { summary: 'Driving shaft.', role: 'Turns at a constant speed ω_A.' },
  outShaft: {
    summary: 'Driven shaft.',
    role: 'Speeds up and slows down twice per revolution: fast, slow, fast, slow. The angle it has turned through equals the driver’s only at every quarter turn.',
  },
  bearings: { summary: 'Pillow-block bearings.', role: 'Support the shafts so that only the joint is at an angle.' },
  motor: {
    summary: 'Driving motor (constant speed).',
    role: 'Stands in for the PTO or gearbox: the driving shaft turns uniformly, as the analysis assumes.',
  },
  mass: {
    summary: 'Driven rotating mass (index flywheel).',
    role: 'Its inertia resists the speed fluctuation: accelerating it needs an inertia torque I·α_B every quarter turn (e.g. 147 N, k = 0.25 m). The red marks show the driver and driven angles drifting apart and back.',
    details: 'Drawn smaller than a 0.25 m radius of gyration.',
  },
  gauge: { summary: 'Shaft angle δ.', role: 'The angle between the two shaft axes.' },
}

export function HookeScene3D() {
  const delta = useHooke((s) => s.delta)
  const g = useMemo(() => {
    const pb = pillowBlock(J.shaftR, RIG.drop)
    const disc = xform(cylinder(RIG.discR, 0.014, 48), mat4.rz(PI / 2))
    const motor = merge(
      xform(
        lathe(
          [
            [0, -0.075],
            [0.064, -0.075],
            [0.07, -0.068],
            [0.07, 0.068],
            [0.064, 0.075],
            [0, 0.075],
          ],
          48,
        ),
        mat4.rz(PI / 2),
      ),
      xform(box(0.12, 0.08 - 0.002, 0.14), mat4.t(0, -RIG.drop + 0.04, 0)),
    )
    return {
      yoke: yokeGeometry(),
      cross: crossGeometry(),
      cups: cupsGeometry(),
      needles: needlesGeometry(),
      seals: sealsGeometry(),
      inShaft: shaftGeometry(-RIG.shaftLen - 0.04, -J.hubEnd),
      outShaft: shaftGeometry(J.hubEnd, RIG.shaftLen),
      pb,
      disc,
      markIn: box(0.02, 0.012, 0.014),
      markOut: box(0.046, 0.012, 0.014),
      motor,
      flywheel: xform(
        lathe(
          [
            [J.shaftR, -0.02],
            [0.11, -0.02],
            [0.12, -0.012],
            [0.12, 0.012],
            [0.11, 0.02],
            [J.shaftR, 0.02],
          ],
          64,
        ),
        mat4.rz(PI / 2),
      ),
    }
  }, [])

  const gauge = useMemo(() => {
    const d = Math.max(rad(delta), 0.004)
    const s = new THREE.Shape()
    s.absarc(0, 0, 0.21, 0, d, false)
    s.absarc(0, 0, 0.19, d, 0, true)
    return xform(extrude(s, 0.002, { curveSegments: 48 }), mat4.c(mat4.t(0, -RIG.drop + 0.016, 0), mat4.rx(-PI / 2)))
  }, [delta])

  const outBase = useMemo(() => yawQuat(rad(delta)), [delta])

  const inRot = useRef<THREE.Group>(null)
  const outRot = useRef<THREE.Group>(null)
  const crossRef = useRef<THREE.Group>(null)
  const graph = useMemo(() => {
    const d = new DriveGraph()
    d.body('in')
    d.body('out')
    d.addMap(hookeJoint('uj', 'in', 'out', () => rad(useHooke.getState().delta)))
    return d
  }, [])
  const pose = useMemo<JointPose>(() => ({ u1: new THREE.Vector3(), u2: new THREE.Vector3(), a2: new THREE.Vector3(), cross: new THREE.Quaternion(), phi: 0 }), [])

  useSimFrame((dt) => {
    const st = useHooke.getState()
    const w = rpmToRad(st.rpm)
    graph.drive('in', w)
    graph.step(dt)
    const th = graph.get('in').theta
    // driven-shaft angle from DriveGraph.hookeJoint (tan θ_B = tan θ / cos δ); the cross is
    // oriented from the yoke pins — model.test.ts checks the two agree exactly
    const thB = graph.get('out').theta
    const d = rad(st.delta)
    jointPose(th, d, pose)
    inRot.current?.rotation.set(th, 0, 0)
    outRot.current?.rotation.set(thB + PI, 0, 0)
    crossRef.current?.quaternion.copy(pose.cross)

    const thDeg = (((th * 180) / PI) % 360 + 360) % 360
    live.theta = thDeg
    live.thetaB = (((thB * 180) / PI) % 360 + 360) % 360
    let lag = ((thB - th) * 180) / PI
    lag -= Math.round(lag / 360) * 360
    live.lag = lag
    live.ratio = hookeVelocityRatio(d, th)
    live.omegaB = st.rpm * live.ratio
    live.alphaB = hookeAcceleration(d, th, w)
    live.torque = inertiaFromWeight(st.weight, st.k) * live.alphaB
  })

  const floor = -RIG.drop
  return (
    <group>
      <Part id="rig" name="Hooke's joint rig" role="housing" material="castIron" info={INFO.rig} cites={C.hj}>
        {/* ---------------- driving side ---------------- */}
        <Part id="motor" name="Driving motor" material="paintBlue" role="housing" info={INFO.motor} beyondNotes explode={[-0.12, 0, 0]}>
          <PartMesh geometry={g.motor} position={[-0.545, 0, 0]} />
        </Part>
        <Part id="bearings" name="Pillow-block bearings" material="castIron" role="housing" info={INFO.bearings}>
          <PartMesh geometry={g.pb.housing} position={[-RIG.bearingAt, 0, 0]} />
          <PartMesh geometry={g.pb.insert} material="bronze" position={[-RIG.bearingAt, 0, 0]} />
          <group quaternion={outBase}>
            <PartMesh geometry={g.pb.housing} position={[RIG.bearingAt, 0, 0]} />
            <PartMesh geometry={g.pb.insert} material="bronze" position={[RIG.bearingAt, 0, 0]} />
          </group>
        </Part>

        <Part id="input" name="Driving shaft & yoke" role="moving" material="forged" explode={[-0.1, 0, 0]}>
          <group ref={inRot}>
            <Part id="in-yoke" name="Driving yoke" material="forged" info={INFO.inYoke} cites={C.cross}>
              <PartMesh geometry={g.yoke} rotation={[PI / 2, 0, 0]} />
            </Part>
            <Part id="in-shaft" name="Driving shaft" material="steel" info={INFO.inShaft} cites={C.theory}>
              <PartMesh geometry={g.inShaft} />
              <PartMesh geometry={g.disc} material="paintGrey" position={[-RIG.discAt, 0, 0]} />
              <PartMesh geometry={g.markIn} material="paintRed" position={[-RIG.discAt, 0, RIG.discR + 0.007]} />
            </Part>
          </group>
        </Part>

        {/* ---------------- the cross ---------------- */}
        <Part id="spider" name="Cross & bearings" role="moving" material="steel" info={INFO.cross} cites={C.cross} explode={[0, 0.16, 0]}>
          <group ref={crossRef}>
            <Part id="cross" name="Cross (spider)" material="steel" info={INFO.cross} cites={C.cross}>
              <PartMesh geometry={g.cross} />
            </Part>
            <Part id="cups" name="Needle-bearing cups" material="steelDark" info={INFO.cups} cites={C.cross}>
              <PartMesh geometry={g.cups} />
            </Part>
            <Part id="needles" name="Needle rollers" material="chrome" info={INFO.needles} cites={[HJ2('§26.2.1 needle rollers, lubrication failure')]}>
              <PartMesh geometry={g.needles} />
            </Part>
            <Part id="seals" name="Trunnion seals" material="rubber" info={INFO.seals} cites={[HJ2('§26.2.1 oil seal on each arm')]}>
              <PartMesh geometry={g.seals} />
            </Part>
          </group>
        </Part>

        {/* ---------------- driven side ---------------- */}
        <group quaternion={outBase}>
          <Part id="output" name="Driven shaft & yoke" role="moving" material="forged" explode={[0.1, 0, 0]}>
            <group ref={outRot}>
              <Part id="out-yoke" name="Driven yoke" material="forged" info={INFO.outYoke} cites={C.cross}>
                <PartMesh geometry={g.yoke} rotation={[0, PI, 0]} />
              </Part>
              <Part id="out-shaft" name="Driven shaft" material="steel" info={INFO.outShaft} cites={C.theory}>
                <PartMesh geometry={g.outShaft} />
              </Part>
              <Part id="mass" name="Driven mass (index flywheel)" material="castIron" info={INFO.mass} cites={[HJ2('Example 26.3')]}>
                <PartMesh geometry={g.flywheel} position={[RIG.discAt, 0, 0]} />
                <PartMesh geometry={g.markOut} material="paintRed" position={[RIG.discAt, 0, -0.127]} />
              </Part>
            </group>
          </Part>
        </group>

        <Part id="gauge" name="Shaft angle δ" material="paintYellow" role="static" cut={false} info={INFO.gauge} cites={C.theory}>
          <PartMesh geometry={gauge} />
        </Part>
      </Part>

      <PartLabel partId="in-yoke" at={[-0.07, 0.08, 0.02]} />
      <PartLabel partId="out-yoke" at={[0.08 * Math.cos(rad(delta)), 0.08, -0.08 * Math.sin(rad(delta))]} />
      <PartLabel partId="cross" at={[0.0, 0.065, 0.04]} />
      <PartLabel partId="needles" at={[0.03, -0.06, 0.05]} />
      <PartLabel partId="in-shaft" at={[-0.22, 0.04, 0]} />
      <PartLabel partId="mass" at={[0.41 * Math.cos(rad(delta)), 0.15, -0.41 * Math.sin(rad(delta))]} />
      <PartLabel partId="bearings" at={[-RIG.bearingAt, -0.06, 0.07]} />
      <PartLabel partId="motor" at={[-0.55, 0.09, 0]} />
      <PartLabel partId="gauge" at={[0.21, floor + 0.03, -0.04]} text={`δ = ${Math.round(delta * 10) / 10}°`} />
    </group>
  )
}
