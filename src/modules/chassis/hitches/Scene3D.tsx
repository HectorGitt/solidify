import { useMemo } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { merge } from '@/geometry'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { TRACTOR } from '@/tractor/dims'
import { FRONT_Z, REAR_Z } from '@/tractor/geometry'
import { phiForHitchHeight, solveLinkage } from '@/tractor/linkage'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { ForceArrow, Ground, LiveTag, type ArrowState } from '../common/three'
import { implementWheel, wheel } from '@/parts/lib/wheels'
import { bar, slab } from '../common/wheel'
import { CH, solve, useHitch, type Hitch } from './model'

const deg = Math.PI / 180
const KN = 0.04
const SKN = 0.07

export const pose = createTractorPose({ hitchHeight: 0.45 })

const WORK = solveLinkage(phiForHitchHeight(0.45))
const RAISED = solveLinkage(phiForHitchHeight(0.85))
const PIN: [number, number] = [-CH.xd, CH.yd]
const TINE_Z = [-0.72, -0.36, 0, 0.36, 0.72]
const W = 1.9

/** Implement road wheel; on the −Z side the rim and hub are turned to face outward. */
function Wheel({ x, y, z, r, w }: { x: number; y: number; z: number; r: number; w: number }) {
  const g = wheel(implementWheel(r, w))
  return (
    <group position={[x, y, z]}>
      <PartMesh geometry={g.tyre} material="rubber" />
      <group rotation={[0, z < 0 ? Math.PI : 0, 0]}>
        <PartMesh geometry={g.rim} material="paintYellow" />
        {g.hub ? <PartMesh geometry={g.hub} material="steelDark" /> : null}
      </group>
    </group>
  )
}

/** Toolbar with five rigid tines; the soil-force resultant acts at (xs, −z). */
function tines(xs: number, barY: number, z: number) {
  const parts = [slab(xs - 0.06, barY - 0.05, xs + 0.06, barY + 0.05, W)]
  for (const tz of TINE_Z) {
    parts.push(bar([xs, barY, tz], [xs - 0.08, -z + 0.06, tz], 0.04))
    parts.push(bar([xs - 0.08, -z + 0.06, tz], [xs + 0.06, -z, tz], 0.035))
  }
  return merge(...parts)
}

function Implement({ hitch, b, z, a }: { hitch: Hitch; b: number; z: number; a: number }) {
  const xs = -(CH.xd + b)
  const geo = useMemo(() => {
    const barY = 0.5
    if (hitch === 'trailed' || hitch === 'wth') {
      const xw = Math.min(xs - 0.5, PIN[0] - 1.2)
      return {
        frame: merge(bar([PIN[0], PIN[1], 0], [xs + 0.1, barY, 0], 0.07), slab(xw - 0.05, barY - 0.04, xs + 0.1, barY + 0.04, 0.08, 0.95), slab(xw - 0.05, barY - 0.04, xs + 0.1, barY + 0.04, 0.08, -0.95), slab(xw - 0.04, 0.26, xw + 0.04, barY, 0.06, 0.95), slab(xw - 0.04, 0.26, xw + 0.04, barY, 0.06, -0.95)),
        tines: tines(xs, barY, z),
        wheels: [[xw, 0.28, 1.1, 0.28, 0.15]] as number[][],
        mast: null as THREE.BufferGeometry | null,
      }
    }
    if (hitch === 'semi') {
      const xc = -(CH.xd + a)
      return {
        frame: merge(slab(WORK.L.x - 0.05, WORK.L.y - 0.05, WORK.L.x + 0.05, WORK.L.y + 0.05, 0.9), bar([WORK.L.x, WORK.L.y, 0], [xs, barY, 0], 0.08), bar([xs, barY, 0], [xc, 0.55, 0], 0.08), slab(xc - 0.04, 0.3, xc + 0.04, 0.58, 0.06)),
        tines: tines(xs, barY, z),
        wheels: [[xc, 0.25, 0, 0.25, 0.14]],
        mast: null,
      }
    }
    // fully mounted: mast on the three-point linkage, frame rigid with the tractor
    return {
      frame: merge(slab(WORK.L.x - 0.05, WORK.L.y - 0.05, WORK.L.x + 0.05, WORK.L.y + 0.05, 0.9), bar([WORK.L.x, WORK.L.y, 0.3], [xs, barY, 0.3], 0.07), bar([WORK.L.x, WORK.L.y, -0.3], [xs, barY, -0.3], 0.07), bar([WORK.U.x, WORK.U.y, 0], [xs, barY, 0], 0.06)),
      tines: tines(xs, barY, z),
      wheels: [] as number[][],
      mast: merge(bar([WORK.L.x, WORK.L.y, 0.12], [WORK.U.x, WORK.U.y, 0.02], 0.05), bar([WORK.L.x, WORK.L.y, -0.12], [WORK.U.x, WORK.U.y, -0.02], 0.05)),
    }
  }, [hitch, xs, z, a])
  const info = {
    trailed: { summary: 'Trailed cultivator.', role: 'Hitched at a single point, the drawbar pin. It carries its own weight and the vertical soil force on its wheels, so only the horizontal pull S cos θ acts on the tractor — at the drawbar height y′.' },
    semi: { summary: 'Semi-mounted cultivator.', role: 'Pinned to the lower links and supported at the rear on a castor wheel a behind the hitch: free to pivot vertically, rigid in plan. Part of the vertical soil force comes onto the tractor.' },
    mounted: { summary: 'Fully mounted cultivator.', role: 'Carried rigidly on the three-point linkage, so the whole soil force — vertical part included — acts on the tractor. With a downward soil force it adds weight to the rear axle.' },
    wth: { summary: 'Trailed cultivator with a weight-transfer hitch.', role: 'A chain from the raised three-point linkage holds a constant lift force F on the implement tongue, set by a hydraulic valve. Part of the implement weight and the lift force move onto the tractor rear axle.' },
  }[hitch]
  return (
    <Part id="implement" name="Cultivator" role="static" material="paintBlue" info={info} cites={[SRC.mac502('Figs 6.1–6.3, 6.10–6.12, 6.15'), SRC.hitch502('hitching')]}>
      <PartMesh geometry={geo.frame} />
      {geo.mast ? <PartMesh geometry={geo.mast} material="paintBlue" /> : null}
      <Part id="tines" name="Tines" role="static" material="steelDark" info={{ summary: 'Rigid cultivator tines.', role: 'The soil force on all tines is lumped into one resultant S at angle θ below the horizontal, b behind the hitch and z below the surface (Fig 6.10).' }} cites={[SRC.mac502('Fig 6.10')]}>
        <PartMesh geometry={geo.tines} />
      </Part>
      {geo.wheels.map(([x, y, zz, r, w], i) =>
        zz ? (
          <group key={i}>
            <Wheel x={x} y={y} z={zz} r={r} w={w} />
            <Wheel x={x} y={y} z={-zz} r={r} w={w} />
          </group>
        ) : (
          <Wheel key={i} x={x} y={y} z={0} r={r} w={w} />
        ),
      )}
      {hitch === 'wth' ? (
        <Part id="wth-chain" name="Weight-transfer chain" role="static" material="galvanised" info={{ summary: 'Weight-transfer chain and rigid link.', role: 'Links the raised lower links to the implement tongue. A hydraulic valve keeps the lift force F constant, so weight moves from the implement to the tractor rear axle.' }} cites={[SRC.mac502('Fig 6.15, eqs 6.30–6.31')]}>
          <PartMesh geometry={bar([RAISED.L.x, RAISED.L.y, 0], [-1.25, 0.47, 0], 0.025)} />
        </Part>
      ) : null}
    </Part>
  )
}

export function Scene3D() {
  const hitch = useHitch((s) => s.hitch)
  const b = useHitch((s) => s.b)
  const z = useHitch((s) => s.z)
  const a = useHitch((s) => s.a)
  useSimFrame((dt) => {
    pose.hitchHeight = useHitch.getState().hitch === 'wth' ? 0.85 : 0.45
    pose.rearAngle += (dt * 1.2) / TRACTOR.rear.rolling
    pose.frontAngle += (dt * 1.2) / TRACTOR.front.radius
  })
  const fz = FRONT_Z + 0.32
  const rz = REAR_Z + 0.4
  const reaction = (front: boolean, ghost: boolean) => (a: ArrowState) => {
    const s = solve(useHitch.getState())
    const v = ghost ? (front ? s.Wf : s.Wr) : front ? s.sel.Vf : s.sel.Vr
    a.x = front ? TRACTOR.wheelbase : 0
    a.y = 0
    a.z = (front ? fz : rz) + (ghost ? 0.12 : 0)
    a.angle = Math.PI / 2
    a.tipAt = true
    a.length = Math.max(0, v / 1000) * KN
    if (!ghost && front && s.sel.lossFront > 0.3 * s.Wf) a.color = '#e0564a'
  }
  return (
    <group>
      <Tractor pose={pose} internals={false} labels={false} />
      <Implement hitch={hitch} b={b} z={z} a={a} />
      <Ground length={10} x={-0.8} depth={0.5} cut cites={[SRC.mac502('Fig 6.10')]} />
      {/* soil force S on the implement, θ below horizontal, drawn through the ground */}
      <ForceArrow
        color="#e8794f"
        onTop
        get={(ar) => {
          const p = useHitch.getState()
          ar.x = -(CH.xd + p.b)
          ar.y = -p.z
          ar.z = 0
          ar.angle = Math.PI + p.theta * deg
          ar.length = p.S * SKN
        }}
      />
      {/* lift force F in the weight-transfer chain, acting up on the tongue */}
      <ForceArrow
        color="#c792ea"
        get={(ar) => {
          const p = useHitch.getState()
          if (p.hitch !== 'wth') return
          ar.x = -1.25
          ar.y = 0.47
          ar.z = 0.1
          ar.angle = Math.atan2(RAISED.L.y - 0.47, RAISED.L.x + 1.25)
          ar.length = p.F * SKN
        }}
      />
      <ForceArrow color="#6fb3e0" get={reaction(true, false)} />
      <ForceArrow color="#9bd17a" get={reaction(false, false)} />
      <ForceArrow color="#93a59a" radius={0.008} get={reaction(true, true)} />
      <ForceArrow color="#93a59a" radius={0.008} get={reaction(false, true)} />
      <LiveTag get={() => {
        const s = solve(useHitch.getState())
        return { text: `Vf ${(s.sel.Vf / 1000).toFixed(2)} kN (${s.sel.lossFront >= 0 ? '−' : '+'}${Math.abs(s.sel.lossFront / 1000).toFixed(2)})`, x: TRACTOR.wheelbase, y: (s.sel.Vf / 1000) * KN + 0.18, z: fz, warn: s.sel.lossFront > 0.3 * s.Wf }
      }} />
      <LiveTag get={() => {
        const s = solve(useHitch.getState())
        return { text: `Vr ${(s.sel.Vr / 1000).toFixed(2)} kN (${s.sel.gainRear >= 0 ? '+' : '−'}${Math.abs(s.sel.gainRear / 1000).toFixed(2)})`, x: 0, y: (s.sel.Vr / 1000) * KN + 0.18, z: rz }
      }} />
      <LiveTag get={() => {
        const p = useHitch.getState()
        return { text: `S = ${p.S.toFixed(1)} kN at ${p.theta.toFixed(0)}°`, x: -(CH.xd + p.b) - 0.4, y: -p.z - 0.25, z: 0.9 }
      }} />
      <PartLabel partId="implement" at={[-(CH.xd + b) - 0.2, 0.85, 0.9]} />
      <PartLabel partId="tines" at={[-(CH.xd + b) + 0.1, 0.2, 1.05]} />
      {hitch === 'wth' ? <PartLabel partId="wth-chain" at={[-1.1, 0.75, 0.2]} /> : null}
    </group>
  )
}
