import type { ThreeElements } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import type * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import type { MaterialKey } from '@/render/materials'

type GroupProps = ThreeElements['group']

/**
 * A group updated every frame (after the scene's physics step, which runs at priority −1).
 * Use it for spinning gears, sliding collars, rocking levers — mutate the group, never React state.
 */
export function Animated({ update, children, ...group }: { update: (g: THREE.Group) => void; children?: ReactNode } & GroupProps) {
  const ref = useRef<THREE.Group>(null)
  useSimFrame(() => {
    if (ref.current) update(ref.current)
  })
  return (
    <group ref={ref} {...group}>
      {children}
    </group>
  )
}

/** Rotate about the group's local Z axis to `angle()` each frame. */
export function Spin({ angle, children, ...group }: { angle: () => number; children?: ReactNode } & GroupProps) {
  return (
    <Animated update={(g) => (g.rotation.z = angle())} {...group}>
      {children}
    </Animated>
  )
}

/** Material for a part on the live power path (power-flow colouring). */
export const POWER: MaterialKey = 'paintOrange'
export const flowMat = (on: boolean, base: MaterialKey): MaterialKey => (on ? POWER : base)

/** Smoothly approach a target (first-order lag with time constant tau, seconds). */
export function approach(current: number, target: number, dt: number, tau: number) {
  if (tau <= 0) return target
  return target + (current - target) * Math.exp(-dt / tau)
}

/** Move at most `rate·dt` towards target (constant-speed actuator, e.g. a selector fork). */
export function slew(current: number, target: number, dt: number, rate: number) {
  const d = target - current
  const step = rate * dt
  return Math.abs(d) <= step ? target : current + Math.sign(d) * step
}
