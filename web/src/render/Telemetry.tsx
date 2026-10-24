import { useRef } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSimFrame } from '@/core/sim'
import { partObjects } from '@/parts/registry'
import { useView } from './view'

/**
 * Live telemetry for the part under the pointer, measured rather than declared: how fast its
 * geometry turns (rpm) and moves (m/s) in simulated time, so it works for any moving part in any
 * scene. Smoothed so the reading is steady.
 */
export interface Telemetry {
  id: string | null
  rpm: number
  speed: number
  /** turning more than ~0.4 rev per frame: too fast to measure (it aliases); rpm is then a lower bound */
  tooFast: boolean
}

export const useTelemetry = create<Telemetry>(() => ({ id: null, rpm: 0, speed: 0, tooFast: false }))

const q0 = new THREE.Quaternion()
const q1 = new THREE.Quaternion()
const p1 = new THREE.Vector3()

/** the first mesh under a part: the bit that actually moves */
function probe(id: string): THREE.Object3D | null {
  const o = partObjects.get(id)
  if (!o) return null
  let m: THREE.Object3D | null = null
  o.traverse((c) => {
    if (!m && (c as THREE.Mesh).isMesh) m = c
  })
  return m
}

/** Mount inside the Canvas. */
export function HoverTelemetry() {
  const st = useRef({ id: null as string | null, obj: null as THREE.Object3D | null, q: new THREE.Quaternion(), p: new THREE.Vector3(), rpm: 0, speed: 0, fresh: true, acc: 0, fast: 0 })
  useSimFrame((dt) => {
    const s = st.current
    const id = useView.getState().hoveredId ?? useView.getState().selectedId
    if (id !== s.id) {
      s.id = id
      s.obj = id ? probe(id) : null
      s.fresh = true
      s.rpm = 0
      s.speed = 0
      if (!s.obj) useTelemetry.setState({ id: null, rpm: 0, speed: 0, tooFast: false })
    }
    const o = s.obj
    if (!o || !id) return
    o.getWorldQuaternion(q1)
    o.getWorldPosition(p1)
    if (!s.fresh && dt > 1e-6) {
      q0.copy(s.q).invert().multiply(q1)
      const angle = 2 * Math.acos(Math.min(1, Math.abs(q0.w)))
      const rpm = (angle / dt) * (60 / (2 * Math.PI))
      // near half a turn per frame the reading folds back: hold it as a lower bound instead
      s.fast = angle > 2.5 ? 12 : Math.max(0, s.fast - 1)
      const speed = p1.distanceTo(s.p) / dt
      const k = Math.min(1, dt * 8 + 0.1)
      s.rpm += (rpm - s.rpm) * k
      s.speed += (speed - s.speed) * k
    }
    s.q.copy(q1)
    s.p.copy(p1)
    s.fresh = false
    // publish a few times a second
    s.acc += 1
    if (s.acc % 6 === 0) useTelemetry.setState({ id, rpm: s.fast ? (2.5 / Math.max(dt, 1e-6)) * (60 / (2 * Math.PI)) : s.rpm, speed: s.speed, tooFast: s.fast > 0 })
  })
  return null
}
