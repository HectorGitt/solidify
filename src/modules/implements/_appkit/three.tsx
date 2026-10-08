import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, lathe, merge } from '@/geometry'
import { rim, tyre } from '@/geometry/parts'
import { SRC } from '@/content/citations'
import { Part, PartMesh } from '@/render/Part'
import { rod } from '../_shared/geom'

/**
 * Helpers shared by the sprayer, spreader and mower–baler scenes. These scenes use a
 * "treadmill": the tractor stays put (so the camera can frame it) and the field scrolls
 * backwards under it at the forward speed.
 */

export type V3 = [number, number, number]

/** Flat field block, top face at y = 0. */
export function Ground({ x0 = -14, x1 = 6, z0 = -9, z1 = 9, depth = 0.4, id = 'ground', name = 'Field' }: { x0?: number; x1?: number; z0?: number; z1?: number; depth?: number; id?: string; name?: string }) {
  const g = useMemo(() => box(x1 - x0, depth, z1 - z0), [x0, x1, z0, z1, depth])
  return (
    <Part id={id} name={name} role="static" material="soil" info={{ summary: 'Field surface.', role: 'The ground scrolls under the machine at the forward speed (the tractor is held in view).' }}>
      <PartMesh geometry={g} position={[(x0 + x1) / 2, -depth / 2, (z0 + z1) / 2]} receiveShadow />
    </Part>
  )
}

/** Wrap a scrolled x into [x0, x1). */
export const wrapX = (x: number, x0: number, x1: number) => {
  const L = x1 - x0
  return x0 + ((((x - x0) % L) + L) % L)
}

/** Shared scroll distance (m) that the scenes advance by v·dt each frame. */
export interface Treadmill {
  s: number
}

/**
 * Rows of small plants scrolling with the ground (instanced). `rows` gives the lateral z of each
 * row; plants every `pitch` metres between x0 and x1.
 */
export function CropRows({ mill, rows, pitch = 0.3, x0 = -12, x1 = 5, height = 0.25, color = '#5f8f34', tint }: { mill: Treadmill; rows: number[]; pitch?: number; x0?: number; x1?: number; height?: number; color?: string; tint?: (x: number, z: number, out: THREE.Color) => void }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => {
    const g = lathe(
      [
        [0, 0],
        [0.012, 0],
        [0.05, height * 0.6],
        [0.02, height],
        [0, height],
      ],
      6,
    )
    return g
  }, [height])
  const perRow = Math.max(1, Math.floor((x1 - x0) / pitch))
  const count = perRow * rows.length
  const m = useMemo(() => new THREE.Matrix4(), [])
  const c = useMemo(() => new THREE.Color(), [])
  const base = useMemo(() => new THREE.Color(color), [color])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), [])
  useSimFrame(() => {
    const im = ref.current
    if (!im) return
    let k = 0
    for (let r = 0; r < rows.length; r++) {
      for (let i = 0; i < perRow; i++) {
        const x = wrapX(x0 + i * pitch + ((r * 0.37) % pitch) - mill.s, x0, x1)
        const s = 0.8 + 0.4 * (((i * 7919 + r * 104729) % 97) / 97)
        m.makeScale(s, s, s).setPosition(x, 0, rows[r])
        im.setMatrixAt(k, m)
        c.copy(base)
        tint?.(x, rows[r], c)
        im.setColorAt(k, c)
        k++
      }
    }
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, mat, count]} castShadow={false} frustumCulled={false} />
}

/** Implement road wheel: tyre + rim, axis along Z. */
export function wheelGeometry(radius: number, width: number) {
  const t = tyre({ radius, width, rimRadius: radius * 0.58, pattern: 'F2' })
  const r = rim(radius * 0.58, width * 0.9, radius * 0.18, width * 0.1)
  const m = new THREE.Matrix4().makeRotationX(Math.PI / 2)
  t.applyMatrix4(m)
  r.applyMatrix4(m)
  return { tyre: t, rim: r }
}

/**
 * PTO driveline (telescoping shaft with a Hooke's joint at each end) between two points. The
 * shaft is drawn along +X in its own frame and spun about that axis by `angle()`.
 */
export function PtoDriveline({ id, from, to, angle, name = 'PTO driveline' }: { id: string; from: V3; to: V3; angle: () => number; name?: string }) {
  const spin = useRef<THREE.Group>(null)
  const { geo, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const d = b.clone().sub(a)
    const L = d.length()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize())
    // bell-shaped end guards over the joints (the middle of the shaft is left visible)
    const cone = (x: number, dir: number) => {
      const g = lathe([[0.02, 0], [0.05, 0], [0.032, 0.12], [0.026, 0.12]], 20)
      g.applyMatrix4(new THREE.Matrix4().makeRotationZ(dir > 0 ? -Math.PI / 2 : Math.PI / 2))
      g.translate(x - dir * 0.06, 0, 0)
      return g
    }
    const yoke = (x: number) =>
      merge(
        rod([x, 0.024, 0], [x + 0.06 * Math.sign(L / 2 - x || 1), 0.024, 0], 0.008, 8),
        rod([x, -0.024, 0], [x + 0.06 * Math.sign(L / 2 - x || 1), -0.024, 0], 0.008, 8),
        rod([x, 0, 0.026], [x, 0, -0.026], 0.007, 8),
        rod([x, 0.03, 0], [x, -0.03, 0], 0.007, 8),
      )
    return {
      geo: {
        outer: rod([0.08, 0, 0], [L * 0.6, 0, 0], 0.022, 14),
        inner: rod([L * 0.5, 0, 0], [L - 0.08, 0, 0], 0.016, 14),
        yokes: merge(yoke(0.02), yoke(L - 0.02)),
        shield: merge(cone(0.11, 1), cone(L - 0.11, -1)),
      },
      quat: q,
      len: L,
    }
  }, [from, to])
  useSimFrame(() => {
    if (spin.current) spin.current.rotation.x = angle()
  })
  void len
  return (
    <Part id={id} name={name} role="moving" material="steel" cites={[SRC.pto502('implement driveline, shields')]} info={{ summary: 'Telescoping PTO shaft with a Hooke’s (universal) joint at each end.', role: 'Carries PTO power from the tractor stub to the machine; the telescoping tubes let the length change as the linkage moves. The shaft guard keeps clothing off the spinning shaft.' }}>
      <group position={from} quaternion={quat}>
        <group ref={spin}>
          <PartMesh geometry={geo.outer} material="steel" />
          <PartMesh geometry={geo.inner} material="chrome" />
          <PartMesh geometry={geo.yokes} material="forged" />
        </group>
        <Part id={`${id}-guard`} name="PTO shaft guard" role="static" material="paintYellow" cut={false} info={{ summary: 'Plastic shaft guard (shield).', role: 'Stays still on plastic bearing bushes while the shaft turns inside it.' }}>
          <PartMesh geometry={geo.shield} material="paintYellow" />
        </Part>
      </group>
    </Part>
  )
}

/** Simple hub + axle for implement wheels. */
export function axleGeometry(halfTrack: number, r = 0.03) {
  const g = cylinder(r, 2 * halfTrack, 16)
  g.rotateX(Math.PI / 2)
  return g
}

/* ------------------------------ appended: particles and Y-axis helpers ------------------------------ */

/**
 * A cloud of small instanced particles (granules, manure, soil clods, chopped crop). `update`
 * is called every sim frame with a setter and returns how many particles to draw.
 */
export function Particles({ max, radius, color, update, roughness = 0.9 }: { max: number; radius: number; color: string; update: (set: (i: number, x: number, y: number, z: number, s?: number) => void, dt: number) => number; roughness?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.IcosahedronGeometry(radius, 0), [radius])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness }), [color, roughness])
  const m = useMemo(() => new THREE.Matrix4(), [])
  useSimFrame((dt) => {
    const im = ref.current
    if (!im) return
    const set = (i: number, x: number, y: number, z: number, s = 1) => {
      m.makeScale(s, s, s).setPosition(x, y, z)
      im.setMatrixAt(i, m)
    }
    im.count = Math.min(max, Math.max(0, update(set, dt)))
    im.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, mat, max]} frustumCulled={false} castShadow={false} />
}

/** Simple ring buffer of ballistic particles (world frame) with ground contact and scrolling. */
export interface Ballistic {
  x: Float32Array
  y: Float32Array
  z: Float32Array
  vx: Float32Array
  vy: Float32Array
  vz: Float32Array
  /** 0 = free, 1 = flying, 2 = landed */
  st: Uint8Array
  age: Float32Array
  next: number
  n: number
}

export function ballistic(n: number): Ballistic {
  return { x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n), vz: new Float32Array(n), st: new Uint8Array(n), age: new Float32Array(n), next: 0, n }
}

export function emit(b: Ballistic, x: number, y: number, z: number, vx: number, vy: number, vz: number) {
  const i = b.next
  b.next = (b.next + 1) % b.n
  b.x[i] = x
  b.y[i] = y
  b.z[i] = z
  b.vx[i] = vx
  b.vy[i] = vy
  b.vz[i] = vz
  b.st[i] = 1
  b.age[i] = 0
}

/**
 * Advance the particles: gravity, quadratic drag k (1/m), land on y = ground, then scroll
 * landed ones rearward at the forward speed v and retire them behind xMin or after `life` s.
 */
export function stepBallistic(b: Ballistic, dt: number, k: number, v: number, xMin: number, life = 12, ground = 0.004) {
  for (let i = 0; i < b.n; i++) {
    if (b.st[i] === 0) continue
    b.age[i] += dt
    if (b.st[i] === 1) {
      const s = Math.hypot(b.vx[i], b.vy[i], b.vz[i])
      b.vx[i] -= k * s * b.vx[i] * dt
      b.vz[i] -= k * s * b.vz[i] * dt
      b.vy[i] -= (9.81 + k * s * b.vy[i]) * dt
      b.x[i] += b.vx[i] * dt
      b.y[i] += b.vy[i] * dt
      b.z[i] += b.vz[i] * dt
      if (b.y[i] <= ground) {
        b.y[i] = ground
        b.st[i] = 2
      }
    }
    // the ground (and everything lying on it) moves rearward under the held tractor
    else b.x[i] -= v * dt
    if (b.x[i] < xMin || b.age[i] > life) b.st[i] = 0
  }
}

/** Draw a Ballistic cloud through a Particles setter; returns the count. */
export function drawBallistic(b: Ballistic, set: (i: number, x: number, y: number, z: number, s?: number) => void) {
  let c = 0
  for (let i = 0; i < b.n; i++) if (b.st[i] !== 0) set(c++, b.x[i], b.y[i], b.z[i], b.st[i] === 2 ? 0.8 : 1)
  return c
}
