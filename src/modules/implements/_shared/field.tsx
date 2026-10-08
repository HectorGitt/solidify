import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box } from '@/geometry'
import { PartMesh } from '@/render/Part'
import { createSoil, pressPrint, roughen, type SoilGrid } from '@/render/soil'
import { SoilSurface } from '@/render/SoilSurface'
import { TRACTOR } from '@/tractor/dims'
import { Tractor, type TractorPose } from '@/tractor/Tractor'
import { smooth } from './geom'

/** Default hitch-ball x behind the rear axle before the linkage is first solved. */
export const HITCH_X0 = -1.05

export interface FieldSpec {
  length: number
  width: number
  cell: number
  /** first column x (default −length/2) */
  x0?: number
  /** z of the strip centre */
  zc?: number
}

export function makeSoil(f: FieldSpec, seed = 3) {
  const g = createSoil(f.length, f.width, f.cell, f.x0 ?? -f.length / 2, (f.zc ?? 0) - f.width / 2)
  roughen(g, 0.008, seed)
  return g
}

export function resetSoil(g: SoilGrid, seed = 3) {
  g.disturbed.fill(0)
  g.compacted.fill(0)
  roughen(g, 0.008, seed)
}

export interface StepCtx {
  /** tractor rear-axle x */
  X: number
  /** distance moved this frame */
  dx: number
  dt: number
  /** world x of the lower hitch-ball midpoint */
  hitchX: number
  /** world y of the lower hitch balls */
  hitchY: number
  /** 0 raised … 1 fully lowered into work */
  lowered: number
}

export interface DriveRun {
  X: number
  lowered: number
  passes: number
}

export interface FieldRunProps {
  grid: SoilGrid
  pose: TractorPose
  /** forward speed, m/s */
  speed: () => number
  /** x range the rear axle travels; the soil is reset each time it loops */
  start: number
  end: number
  /** hitch height when working (may depend on depth) and when raised */
  hitchWork: () => number
  hitchRaised: number
  /** distance (m) over which the implement is lowered at the start / raised at the end */
  ramp?: number
  ptoRpm?: () => number
  onStep?: (c: StepCtx) => void
  onReset?: () => void
  run?: DriveRun
  mounted?: ReactNode
  trailed?: ReactNode
  /** tractor lateral offset */
  z?: number
  prints?: boolean
}

/**
 * Drives the shared tractor along +X across a soil strip, lowering the mounted implement into
 * work after the start and lifting it before the end, then resets the soil and loops.
 */
export function FieldRun({ grid, pose, speed, start, end, hitchWork, hitchRaised, ramp = 1.2, ptoRpm, onStep, onReset, run, mounted, trailed, z = 0, prints = true }: FieldRunProps) {
  const tractor = useRef<THREE.Group>(null)
  const own = useRef<DriveRun>({ X: start, lowered: 0, passes: 0 })
  const st = run ?? own.current
  if (st.X < start || st.X > end) st.X = start
  useSimFrame((dt) => {
    if (dt <= 0) return
    const v = speed()
    let dx = v * dt
    st.X += dx
    if (st.X > end) {
      st.X = start
      dx = 0
      st.passes++
      resetSoil(grid, 3 + (st.passes % 5))
      onReset?.()
    }
    const lowered = smooth((st.X - start) / ramp) * smooth((end - st.X) / (ramp * 0.6))
    st.lowered = lowered
    pose.hitchHeight = hitchRaised + (hitchWork() - hitchRaised) * lowered
    pose.rearAngle += dx / TRACTOR.rear.rolling
    pose.frontAngle += dx / TRACTOR.front.radius
    pose.engineAngle += dt * 2 * Math.PI * 30
    if (ptoRpm) pose.ptoAngle += (dt * 2 * Math.PI * ptoRpm()) / 60
    if (tractor.current) tractor.current.position.set(st.X, 0, z)
    if (prints && dx > 0) {
      for (const s of [1, -1]) {
        pressPrint(grid, st.X, z + s * TRACTOR.rear.track / 2, 0.14, TRACTOR.rear.width / 2, 0.012, 0.8)
        pressPrint(grid, st.X + TRACTOR.wheelbase, z + s * TRACTOR.front.track / 2, 0.08, TRACTOR.front.width / 2, 0.008, 0.6)
      }
    }
    const L = pose.linkage?.L
    onStep?.({ X: st.X, dx, dt, hitchX: st.X + (L?.x ?? HITCH_X0), hitchY: L?.y ?? pose.hitchHeight, lowered })
  })
  return (
    <group ref={tractor} position={[start, 0, z]}>
      <Tractor pose={pose} labels={false} internals={false} mounted={mounted ? <Level pose={pose}>{mounted}</Level> : undefined} trailed={trailed} />
    </group>
  )
}

/** Cancels the mast tilt so a mounted implement stays level (as if the top link were re-set). */
export function Level({ pose, children }: { pose: TractorPose; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useSimFrame(() => {
    if (ref.current) ref.current.rotation.z = pose.linkage?.mastTilt ?? 0
  })
  return <group ref={ref}>{children}</group>
}

/** Soil strip plus untouched ground around it (so furrows are not hidden by a ground plane). */
export function FieldGround({ grid, margin = 14 }: { grid: SoilGrid; margin?: number }) {
  const unit = useMemo(() => box(1, 1, 1), [])
  const L = (grid.nx - 1) * grid.cell
  const W = (grid.nz - 1) * grid.cell
  const cx = grid.x0 + L / 2
  const cz = grid.z0 + W / 2
  const y = -0.03
  const t = 0.06
  return (
    <group>
      <SoilSurface grid={grid} depth={0.5} />
      <PartMesh geometry={unit} material="crop" position={[cx, y, grid.z0 - margin / 2]} scale={[L + 2 * margin, t, margin]} receiveShadow />
      <PartMesh geometry={unit} material="crop" position={[cx, y, grid.z0 + W + margin / 2]} scale={[L + 2 * margin, t, margin]} receiveShadow />
      <PartMesh geometry={unit} material="crop" position={[grid.x0 - margin / 2, y, cz]} scale={[margin, t, W]} receiveShadow />
      <PartMesh geometry={unit} material="crop" position={[grid.x0 + L + margin / 2, y, cz]} scale={[margin, t, W]} receiveShadow />
    </group>
  )
}

/** Mirror a soil profile left ↔ right (PROFILES.mouldboard throws to +z; a right-hand plough throws to −z). */
export const mirror = (f: (dz: number) => number) => (dz: number) => f(-dz)
