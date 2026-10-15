import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { cylinder } from '@/geometry'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { TRACTOR } from '@/tractor/dims'
import { AXLE_Y, FRONT_Z, REAR_Z } from '@/tractor/geometry'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { AdjustableDrawbar, ForceArrow, Ground, LiveTag } from '../common/three'
import { FARMLAND } from '@/physics/chassis'
import { frontAt, hitchOf, live, solve, useStab } from './model'

const deg = Math.PI / 180
const KN = 0.04
const STUMP_X = -3.3

export const pose = createTractorPose({ hitchHeight: 0.75 })

const UNIT_X = (() => {
  const c = new THREE.CylinderGeometry(1, 1, 1, 10)
  c.rotateZ(-Math.PI / 2)
  c.translate(0.5, 0, 0)
  return c
})()

function pitched(x: number, y: number, p: number): [number, number] {
  const dy = y - AXLE_Y
  return [x * Math.cos(p) - dy * Math.sin(p), AXLE_Y + x * Math.sin(p) + dy * Math.cos(p)]
}

function Chain() {
  const m = useRef<THREE.Mesh>(null)
  useSimFrame(() => {
    const p = useStab.getState()
    const h = hitchOf(p)
    const [px, py] = pitched(-h.xd, h.yd, live.pitch)
    const ex = STUMP_X + 0.2
    const ey = 0.3
    if (!m.current) return
    m.current.visible = p.mode === 'rear'
    m.current.position.set(px, py, 0)
    m.current.rotation.set(0, 0, Math.atan2(ey - py, ex - px))
    m.current.scale.set(Math.hypot(ex - px, ey - py), 0.016, 0.016)
  })
  return (
    <mesh ref={m} geometry={UNIT_X}>
      <meshStandardMaterial color="#9aa3a8" metalness={0.8} roughness={0.35} />
    </mesh>
  )
}

function Stump() {
  const geo = useMemo(() => {
    const g = cylinder(0.24, 0.7, 20)
    g.translate(STUMP_X, 0.15, 0)
    return g
  }, [])
  return (
    <Part id="stump" name="Tree stump (anchored load)" role="static" material="wood" info={{ summary: 'A load that will not move.', role: 'Pulling a stump or a stuck load makes the pull rise until either the rear tyres slip or the front lifts. If the tyres can grip harder than the overturn ψ′, the tractor rears over backwards.' }} cites={[SRC.mac502('eq 6.35; Problem 6.16')]} cut={false}>
      <PartMesh geometry={geo} />
    </Part>
  )
}

export function Scene3D() {
  const st = useStab()
  const tilt = useRef<THREE.Group>(null)
  const pivot = useRef<THREE.Group>(null)
  const roll = useRef<THREE.Group>(null)
  const key = useRef('')
  const vel = useRef(0)
  const h = hitchOf(st)
  const zc = REAR_Z

  useSimFrame((dt) => {
    const p = useStab.getState()
    const s = solve(p)
    const k = `${p.mode}|${p.hitchPoint}|${p.yd}|${p.alpha}|${p.psiMax}|${p.beta}`
    if (k !== key.current) {
      key.current = k
      live.P = 0
      live.pitch = 0
      live.roll = 0
      live.t = 0
      vel.current = 0
      live.phase = 'pulling'
    }
    if (tilt.current) {
      tilt.current.rotation.set(p.mode === 'side' ? -p.beta * deg : 0, 0, p.mode === 'side' ? 0 : s.al)
    }
    let spin = 0
    if (p.mode === 'rear') {
      const Pslip = s.Pslip > 0 ? s.Pslip : Infinity
      if (live.phase === 'pulling') {
        live.P += 5000 * dt
        spin = 0.15
        if (live.P >= s.Plift && s.Plift < Pslip) {
          live.P = s.Plift
          live.phase = 'rearing'
        } else if (live.P >= Pslip) {
          live.P = Pslip
          live.phase = 'slipping'
        }
      } else if (live.phase === 'rearing') {
        vel.current += dt * (1.2 + 3 * live.pitch)
        live.pitch += vel.current * dt
        spin = 1
        if (live.pitch > 100 * deg) {
          live.pitch = 100 * deg
          live.phase = 'over'
        }
      } else {
        live.t += dt
        spin = live.phase === 'slipping' ? 2.5 : 0
        if (live.t > 3) key.current = ''
      }
    } else if (p.mode === 'slope') {
      // climbing at ≈ 1 m/s; past the climb limit the tyres spin; past αs it overturns backwards
      if (s.staticOver) {
        vel.current += dt * (1 + 3 * live.pitch)
        live.pitch = Math.min(100 * deg, live.pitch + vel.current * dt)
        live.phase = live.pitch >= 100 * deg ? 'over' : 'rearing'
      } else {
        live.phase = s.al > s.slopes.up ? 'slipping' : 'pulling'
      }
      spin = live.phase === 'slipping' ? 2.5 : 1
    } else {
      if (s.sideTips) {
        vel.current += dt * (1 + 3 * live.roll)
        live.roll = Math.min(95 * deg, live.roll + vel.current * dt)
        live.phase = 'rolling'
      } else live.phase = 'pulling'
      spin = 0.6
    }
    if (pivot.current) pivot.current.rotation.z = live.pitch
    if (roll.current) roll.current.rotation.x = -live.roll
    pose.rearAngle += (dt * spin) / TRACTOR.rear.rolling
    if (live.phase !== 'rearing' && live.phase !== 'over') pose.frontAngle += (dt * Math.min(spin, 1)) / TRACTOR.front.radius
  })

  return (
    <group>
      <group ref={tilt}>
        <Ground length={12} width={5} x={-0.8} cites={[SRC.mac502('Figs 6.8–6.9')]} />
        {st.mode === 'rear' ? <Stump /> : null}
        <Chain />
        <group position={[0, 0, -zc]}>
          <group ref={roll}>
            <group position={[0, 0, zc]}>
              <group ref={pivot} position={[0, AXLE_Y, 0]}>
                <group position={[0, -AXLE_Y, 0]}>
                  <Tractor pose={pose} drawbar={false} labels={false} />
                  <AdjustableDrawbar xd={FARMLAND.xd} yd={st.hitchPoint === 'custom' ? st.yd : FARMLAND.yd} cites={[SRC.mac502('Problem 6.16')]} />
                  {/* pull on the tractor at the chosen hitch point, towards the stump */}
                  <ForceArrow
                    color="#e8794f"
                    get={(a) => {
                      const p = useStab.getState()
                      if (p.mode !== 'rear') return
                      const hh = hitchOf(p)
                      const [px, py] = pitched(-hh.xd, hh.yd, live.pitch)
                      a.x = -hh.xd
                      a.y = hh.yd
                      a.z = 0.15
                      a.angle = Math.atan2(0.3 - py, STUMP_X + 0.2 - px) - live.pitch
                      a.length = (live.P / 1000) * KN
                    }}
                  />
                  {/* weight at the CG */}
                  <ForceArrow
                    color="#f5b942"
                    get={(a) => {
                      const p = useStab.getState()
                      if (p.mode === 'side') return
                      a.x = FARMLAND.xr
                      a.y = FARMLAND.r + FARMLAND.yg
                      a.z = 0.2
                      a.angle = -Math.PI / 2 - solve(p).al - live.pitch
                      a.length = (FARMLAND.W / 1000) * KN * 0.6
                    }}
                  />
                </group>
              </group>
            </group>
          </group>
        </group>
        {/* front reaction falling as the pull rises */}
        <ForceArrow
          color="#6fb3e0"
          get={(a) => {
            const p = useStab.getState()
            if (p.mode !== 'rear' || live.pitch > 0.01) return
            a.x = TRACTOR.wheelbase
            a.y = 0
            a.z = FRONT_Z + 0.32
            a.angle = Math.PI / 2
            a.tipAt = true
            a.length = Math.max(0, frontAt(p, live.P) / 1000) * KN
            a.color = frontAt(p, live.P) < 2500 ? '#e0564a' : undefined
          }}
        />
        <LiveTag
          get={() => {
            const p = useStab.getState()
            const s = solve(p)
            const msg =
              p.mode === 'rear'
                ? { pulling: `Pull rising: ${(live.P / 1000).toFixed(1)} kN`, slipping: `Tyres slip at ${(live.P / 1000).toFixed(1)} kN — safe`, rearing: 'FRONT LIFTS — rearing!', over: 'REAR OVERTURN', rolling: '' }[live.phase]
                : p.mode === 'slope'
                  ? s.staticOver
                    ? 'Beyond αs — overturns backwards'
                    : s.al > s.slopes.up
                      ? `Too steep: tyres slip (max ${(s.slopes.up / deg).toFixed(1)}°)`
                      : `Climbing (max ${(s.slopes.up / deg).toFixed(1)}°)`
                  : s.sideTips
                    ? 'SIDE OVERTURN'
                    : `Side slope ${p.beta}° < ${(Math.atan(s.sideTan) / deg).toFixed(1)}° (static)`
            return { text: msg, x: 0.6, y: 2.75, z: 0, warn: live.phase === 'rearing' || live.phase === 'over' || live.phase === 'rolling' || (p.mode === 'slope' && s.staticOver) }
          }}
        />
        {st.mode === 'rear' ? <PartLabel partId="stump" at={[STUMP_X, 0.8, 0.3]} /> : null}
        <PartLabel partId="tractor-rops" at={[-0.3, 2.35, 0.5]} />
        {st.mode === 'rear' && st.hitchPoint !== 'toplink' ? <PartLabel partId="drawbar" at={[-h.xd - 0.1, h.yd + 0.3, 0.3]} /> : null}
        {st.mode === 'rear' && st.hitchPoint === 'toplink' ? <PartLabel partId="tractor-top-link" at={[-0.6, 1.2, 0.2]} /> : null}
      </group>
    </group>
  )
}
