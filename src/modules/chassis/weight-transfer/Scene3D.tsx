import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { box } from '@/geometry'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { TRACTOR } from '@/tractor/dims'
import { AXLE_Y, FRONT_Y, FRONT_Z, REAR_Z } from '@/tractor/geometry'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { AdjustableDrawbar, ForceArrow, Ground, LiveTag } from '../common/three'
import { live, solve, solveCg, useWT } from './model'

const deg = Math.PI / 180
/** metres of arrow per kN */
export const KN = 0.04

export const pose = createTractorPose({ hitchHeight: 0.8 })

const UNIT_X = (() => {
  const c = new THREE.CylinderGeometry(1, 1, 1, 10)
  c.rotateZ(-Math.PI / 2)
  c.translate(0.5, 0, 0)
  return c
})()

/** Point (x, y) of the tractor body after pitching nose-up by `p` about the rear-axle centre. */
function pitched(x: number, y: number, p: number): [number, number] {
  const dy = y - AXLE_Y
  return [x * Math.cos(p) - dy * Math.sin(p), AXLE_Y + x * Math.sin(p) + dy * Math.cos(p)]
}

/** The hitch line from the drawbar pin to the load, re-aimed every frame. */
function HitchLine({ eye }: { eye: [number, number] }) {
  const g = useRef<THREE.Mesh>(null)
  useSimFrame(() => {
    const p = useWT.getState()
    const [px, py] = pitched(-p.xd, p.yd, live.pitch)
    const dx = eye[0] - px
    const dy = eye[1] - py
    const m = g.current
    if (!m) return
    m.position.set(px, py, 0)
    m.rotation.set(0, 0, Math.atan2(dy, dx))
    m.scale.set(Math.hypot(dx, dy), 0.014, 0.014)
  })
  return (
    <mesh ref={g} geometry={UNIT_X}>
      <meshStandardMaterial color="#3a3f44" metalness={0.6} roughness={0.4} />
    </mesh>
  )
}

/** Drag sled used as the drawbar load; its hitch eye sits on a post at the front. */
function LoadSled({ eye }: { eye: [number, number] }) {
  const g = useMemo(() => {
    const body = box(0.9, 0.3, 0.8)
    body.translate(eye[0] - 0.47, 0.15, 0)
    const postH = Math.max(0.05, eye[1] - 0.3 + 0.05)
    const post = box(0.06, postH, 0.06)
    post.translate(eye[0] - 0.05, 0.3 + postH / 2 - 0.02, 0)
    return { body, post }
  }, [eye])
  return (
    <Part id="load" name="Drawbar load (drag sled)" role="static" material="concrete" info={{ summary: 'Drawbar load.', role: 'Stands in for a trailed implement: it resists with the pull P along the hitch line, at the angle θ below the horizontal.' }} cites={[SRC.mac502('Ch 6, Fig 6.6')]} cut={false}>
      <PartMesh geometry={g.body} />
      <PartMesh geometry={g.post} material="steelDark" />
    </Part>
  )
}

/** Weighing platform under the front wheels for the "raise the front" CG method. */
function FrontPlatform({ beta }: { beta: number }) {
  const geo = useMemo(() => {
    const [fx, fy] = pitched(TRACTOR.wheelbase, FRONT_Y, beta)
    const top = Math.max(0.02, fy - TRACTOR.front.radius)
    const g = box(0.7, top, 1.9)
    g.translate(fx, top / 2, 0)
    return g
  }, [beta])
  return (
    <Part id="scale" name="Front scale platform" role="static" material="paintGrey" info={{ summary: 'Weighing platform.', role: 'Raises the front axle to height y′ and reads the front-axle load W′f. With Wf from the level reading, moments about the rear axle give the CG position xr and height yg.' }} cites={[SRC.mac502('Ch 6, eqs 6.1–6.3'), SRC.hitch502('centre of gravity')]} cut={false}>
      <PartMesh geometry={geo} />
    </Part>
  )
}

export function Scene3D() {
  const st = useWT()
  const slope = useRef<THREE.Group>(null)
  const pivot = useRef<THREE.Group>(null)
  const cg = useRef<THREE.Group>(null)
  const sphere = useMemo(() => new THREE.SphereGeometry(0.055, 20, 14), [])
  const cgMode = st.mode === 'cg'
  const cgSol = cgMode ? solveCg(st) : null

  // where the hitch line meets the sled (fixed in the slope frame for the current θ, y′, x′)
  const eye = useMemo<[number, number]>(() => {
    const th = st.theta * deg
    const L = th > 2 * deg ? Math.min(2.4, (st.yd - 0.14) / Math.sin(th)) : 2.4
    return [-st.xd - L * Math.cos(th), Math.min(1.1, st.yd - L * Math.sin(th))]
  }, [st.theta, st.yd, st.xd])

  useSimFrame((dt) => {
    const p = useWT.getState()
    const s = solve(p)
    const target = p.mode === 'cg' ? solveCg(p).beta : s.Vf <= 0 ? 7 * deg : 0
    live.pitch = dt > 0 ? live.pitch + (target - live.pitch) * Math.min(1, dt * 5) : target
    live.lifted = p.mode === 'pull' && s.Vf <= 0
    if (slope.current) slope.current.rotation.z = s.al
    if (pivot.current) pivot.current.rotation.z = live.pitch
    if (cg.current) cg.current.position.set(s.c.xr, s.c.r + s.c.yg, 0)
    // wheels creep forward at ≈ 1 m/s in pull mode (spin a little faster when the front is up)
    if (p.mode === 'pull' && p.pull > 0) {
      pose.rearAngle += (dt * (live.lifted ? 1.6 : 1)) / TRACTOR.rear.rolling
      if (!live.lifted) pose.frontAngle += dt / TRACTOR.front.radius
    }
  })

  const fz = FRONT_Z + 0.32
  const rz = REAR_Z + 0.4

  return (
    <group>
      <group ref={slope}>
        <Ground length={11} x={-0.4} cites={[SRC.mac502('Ch 6, Fig 6.6')]} />
        <group ref={pivot} position={[0, AXLE_Y, 0]}>
          <group position={[0, -AXLE_Y, 0]}>
            <Tractor pose={pose} drawbar={false} internals={false} labels={false} />
            <AdjustableDrawbar xd={st.xd} yd={st.yd} cites={[SRC.mac502('Ch 6, eqs 6.4–6.5'), SRC.hitch502('drawbar height y′')]} />
            <group ref={cg}>
              <Part id="cg" name="Centre of gravity" role="static" material="paintYellow" info={{ summary: 'Centre of gravity G.', role: 'The whole weight W acts here: xr ahead of the rear axle and yg above it (Farmland: 0.54 m and 0.13 m). Its height sets how much weight a slope moves to the rear axle.', details: 'Rule of thumb: xr ≈ 30 % of the wheelbase (Farmland 0.54/1.88 = 29 %).' }} cites={[SRC.mac502('App. II; eq 6.1')]} cut={false}>
                <PartMesh geometry={sphere} />
              </Part>
            </group>
            {/* weight W at G (always vertical in the world) */}
            <ForceArrow
              color="#f5b942"
              get={(a) => {
                const s = solve(useWT.getState())
                a.x = s.c.xr
                a.y = s.c.r + s.c.yg
                a.z = 0
                a.angle = -Math.PI / 2 - s.al - live.pitch
                a.length = (s.c.W / 1000) * KN * 0.6
              }}
            />
            {/* pull P on the tractor at the drawbar pin, rearward and θ below horizontal */}
            <ForceArrow
              color="#e8794f"
              get={(a) => {
                const p = useWT.getState()
                if (p.mode !== 'pull') return
                a.x = -p.xd
                a.y = p.yd
                a.z = 0.12
                a.angle = Math.PI + (p.theta * deg) - live.pitch
                a.length = p.pull * KN
              }}
            />
          </group>
        </group>
        {/* reactions on the tyres (upward, tips at the contact points) */}
        <ForceArrow
          color="#6fb3e0"
          get={(a) => {
            const p = useWT.getState()
            const s = solve(p)
            const v = p.mode === 'cg' ? solveCg(p).Wf2 : s.Vf
            const [fx, fy] = p.mode === 'cg' ? pitched(TRACTOR.wheelbase, FRONT_Y - TRACTOR.front.radius, live.pitch) : [TRACTOR.wheelbase, 0]
            a.x = fx
            a.y = fy
            a.z = fz
            a.angle = Math.PI / 2
            a.tipAt = true
            a.length = Math.max(0, v / 1000) * KN
            a.color = v < 0.25 * s.Wf ? '#e0564a' : undefined
          }}
        />
        <ForceArrow
          color="#9bd17a"
          get={(a) => {
            const p = useWT.getState()
            const s = solve(p)
            const v = p.mode === 'cg' ? s.c.W - solveCg(p).Wf2 : s.Vr
            a.x = 0
            a.y = 0
            a.z = rz
            a.angle = Math.PI / 2
            a.tipAt = true
            a.length = (v / 1000) * KN
          }}
        />
        {/* static loads (thin grey) for comparison */}
        <ForceArrow color="#93a59a" radius={0.008} get={(a) => {
          const s = solve(useWT.getState())
          a.x = TRACTOR.wheelbase
          a.y = 0
          a.z = fz + 0.12
          a.angle = Math.PI / 2
          a.tipAt = true
          a.length = (s.Wf / 1000) * KN * Math.cos(s.al)
        }} />
        <ForceArrow color="#93a59a" radius={0.008} get={(a) => {
          const s = solve(useWT.getState())
          a.x = 0
          a.y = 0
          a.z = rz + 0.12
          a.angle = Math.PI / 2
          a.tipAt = true
          a.length = (s.Wr / 1000) * KN * Math.cos(s.al)
        }} />
        {/* gross traction H at the rear contact (Eq 6.8 numerator) */}
        <ForceArrow color="#c792ea" get={(a) => {
          const p = useWT.getState()
          if (p.mode !== 'pull') return
          const s = solve(p)
          a.x = 0
          a.y = 0.02
          a.z = rz
          a.angle = 0
          a.length = (s.H / 1000) * KN
        }} />
        {!cgMode && <HitchLine eye={eye} />}
        {!cgMode && <LoadSled eye={eye} />}
        {cgMode && cgSol && <FrontPlatform beta={cgSol.beta} />}
        <LiveTag get={() => {
          const p = useWT.getState()
          const s = solve(p)
          if (p.mode === 'cg') {
            const c = solveCg(p)
            const [fx, fy] = pitched(TRACTOR.wheelbase, FRONT_Y, live.pitch)
            return { text: `W′f = ${(c.Wf2 / 1000).toFixed(2)} kN`, x: fx, y: fy + 0.55, z: fz }
          }
          return { text: s.Vf <= 0 ? 'Vf = 0 — front lifts!' : `Vf = ${(s.Vf / 1000).toFixed(2)} kN`, x: TRACTOR.wheelbase, y: Math.max(0.3, (s.Vf / 1000) * KN + 0.15), z: fz, warn: s.Vf <= 0.25 * s.Wf }
        }} />
        <LiveTag get={() => {
          const p = useWT.getState()
          const s = solve(p)
          const v = p.mode === 'cg' ? s.c.W - solveCg(p).Wf2 : s.Vr
          return { text: `Vr = ${(v / 1000).toFixed(2)} kN`, x: 0, y: (v / 1000) * KN + 0.15, z: rz }
        }} />
        <LiveTag get={() => {
          const p = useWT.getState()
          if (p.mode !== 'pull') return null
          const [px, py] = pitched(-p.xd, p.yd, live.pitch)
          return { text: `P = ${p.pull.toFixed(1)} kN`, x: px - 0.5, y: py + 0.25, z: 0.3 }
        }} />
        <PartLabel partId="cg" at={[0.6, 1.15, 0.3]} />
        <PartLabel partId="drawbar" at={[-0.7, 0.75, 0.2]} />
        {!cgMode && <PartLabel partId="load" at={[eye[0] - 0.5, 0.65, 0.4]} />}
      </group>
    </group>
  )
}
