import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'

/**
 * Soft, world-space particles (smoke, dust) drawn as round point sprites with per-particle
 * size, colour and opacity. Emitters live inside a moving model; the particles are added to
 * the scene root so they stay where they were released and trail behind it.
 */

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uPx;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // capped so a plume right in front of the camera cannot fill the screen
  gl_PointSize = min(aSize * uPx / max(0.05, -mv.z), 120.0);
  vAlpha = aAlpha;
  vColor = aColor;
}
`

const FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float a = vAlpha * (1.0 - smoothstep(0.35, 1.0, r));
  gl_FragColor = vec4(vColor, a);
}
`

export interface ParticlePool {
  n: number
  next: number
  pos: Float32Array
  vel: Float32Array
  age: Float32Array
  life: Float32Array
  size0: Float32Array
  grow: Float32Array
  alpha0: Float32Array
  color: Float32Array
  /** upward acceleration (buoyancy, m/s²) and air drag (1/s) */
  lift: Float32Array
  drag: Float32Array
}

export function makePool(n: number): ParticlePool {
  return {
    n,
    next: 0,
    pos: new Float32Array(n * 3),
    vel: new Float32Array(n * 3),
    age: new Float32Array(n).fill(1e9),
    life: new Float32Array(n).fill(1),
    size0: new Float32Array(n),
    grow: new Float32Array(n),
    alpha0: new Float32Array(n),
    color: new Float32Array(n * 3),
    lift: new Float32Array(n),
    drag: new Float32Array(n),
  }
}

export interface EmitOpts {
  life: number
  size: number
  grow: number
  alpha: number
  color: THREE.Color
  lift: number
  drag: number
}

export function emitParticle(p: ParticlePool, x: number, y: number, z: number, vx: number, vy: number, vz: number, o: EmitOpts) {
  const i = p.next
  p.next = (p.next + 1) % p.n
  p.pos[3 * i] = x
  p.pos[3 * i + 1] = y
  p.pos[3 * i + 2] = z
  p.vel[3 * i] = vx
  p.vel[3 * i + 1] = vy
  p.vel[3 * i + 2] = vz
  p.age[i] = 0
  p.life[i] = o.life
  p.size0[i] = o.size
  p.grow[i] = o.grow
  p.alpha0[i] = o.alpha
  p.color[3 * i] = o.color.r
  p.color[3 * i + 1] = o.color.g
  p.color[3 * i + 2] = o.color.b
  p.lift[i] = o.lift
  p.drag[i] = o.drag
}

/** Advance every live particle by dt; `wind` drifts them (m/s, world). */
export function stepPool(p: ParticlePool, dt: number, wind: [number, number, number]) {
  for (let i = 0; i < p.n; i++) {
    if (p.age[i] >= p.life[i]) continue
    p.age[i] += dt
    const k = Math.exp(-p.drag[i] * dt)
    for (let a = 0; a < 3; a++) {
      const j = 3 * i + a
      p.vel[j] = wind[a] + (p.vel[j] - wind[a]) * k
    }
    p.vel[3 * i + 1] += p.lift[i] * dt
    p.pos[3 * i] += p.vel[3 * i] * dt
    p.pos[3 * i + 1] = Math.max(0.02, p.pos[3 * i + 1] + p.vel[3 * i + 1] * dt)
    p.pos[3 * i + 2] += p.vel[3 * i + 2] * dt
  }
}

/** Draws a pool. Mount it anywhere: it adds itself to the scene root. */
export function ParticleCloud({ pool, blending = THREE.NormalBlending }: { pool: ParticlePool; blending?: THREE.Blending }) {
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pool.n * 3), 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(pool.n), 1))
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(pool.n), 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(pool.n * 3), 3))
    return g
  }, [pool])
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uPx: { value: 500 } }, transparent: true, depthWrite: false, blending }), [blending])
  const pts = useMemo(() => {
    const p = new THREE.Points(geo, mat)
    p.frustumCulled = false
    p.renderOrder = 10
    return p
  }, [geo, mat])
  useEffect(() => {
    scene.add(pts)
    return () => {
      scene.remove(pts)
      geo.dispose()
      mat.dispose()
    }
  }, [scene, pts, geo, mat])

  useSimFrame(() => {
    const persp = camera as THREE.PerspectiveCamera
    const fov = ((persp.fov ?? 45) * Math.PI) / 180
    mat.uniforms.uPx.value = (size.height * 0.5) / Math.tan(fov / 2)
    const P = geo.getAttribute('position') as THREE.BufferAttribute
    const S = geo.getAttribute('aSize') as THREE.BufferAttribute
    const A = geo.getAttribute('aAlpha') as THREE.BufferAttribute
    const C = geo.getAttribute('aColor') as THREE.BufferAttribute
    let live = 0
    for (let i = 0; i < pool.n; i++) {
      if (pool.age[i] >= pool.life[i]) continue
      const t = pool.age[i] / pool.life[i]
      ;(P.array as Float32Array).set([pool.pos[3 * i], pool.pos[3 * i + 1], pool.pos[3 * i + 2]], 3 * live)
      ;(C.array as Float32Array).set([pool.color[3 * i], pool.color[3 * i + 1], pool.color[3 * i + 2]], 3 * live)
      ;(S.array as Float32Array)[live] = pool.size0[i] + pool.grow[i] * pool.age[i]
      // quick fade-in, long fade-out
      ;(A.array as Float32Array)[live] = pool.alpha0[i] * Math.min(1, t * 12) * (1 - t) * (1 - t)
      live++
    }
    geo.setDrawRange(0, live)
    P.needsUpdate = S.needsUpdate = A.needsUpdate = C.needsUpdate = true
  })

  return null
}

/* ------------------------------ tractor exhaust and dust ------------------------------ */

/** What the effects need from the scene each frame (all optional; nothing = no effects). */
export interface EffectsInput {
  /** engine load 0…1 (fraction of the torque available at this speed) */
  load?: number
  /** engine speed, rpm */
  rpm?: number
  /** rated engine speed, rpm (lugging below it darkens the smoke) */
  ratedRpm?: number
  /** ground speed, m/s */
  speed?: number
  /** driving-wheel slip 0…1 */
  slip?: number
  /** how dusty the surface is, 0 (wet / grass) … 1 (dry tilled soil) */
  dust?: number
}

/**
 * Diesel smoke density for a load and engine speed (display model, beyond notes). Below about
 * 70 % load a diesel burns clean; near full load it is over-fuelled and smokes, worse when it is
 * lugged below rated speed (less air per stroke). A sudden load rise gives a puff.
 */
export function smokeDensity(load: number, rpm: number, ratedRpm: number, puff = 0) {
  const over = Math.max(0, (load - 0.7) / 0.3)
  const lug = Math.max(0, Math.min(1, (ratedRpm - rpm) / (0.35 * ratedRpm)))
  return Math.min(1, over * over * (0.55 + 0.45 * lug) + puff)
}

const HAZE = new THREE.Color('#b9bcc2')
const SOOT = new THREE.Color('#141414')
const DUST = new THREE.Color('#9c7d58')

export function TractorEffects({ input, exhaustAt, wheelsAt }: { input: () => EffectsInput; exhaustAt: [number, number, number]; wheelsAt: [number, number, number][] }) {
  const smoke = useMemo(() => makePool(420), [])
  const dust = useMemo(() => makePool(520), [])
  const anchor = useRef<THREE.Group>(null)
  const st = useMemo(
    () => ({ acc: 0, dacc: 0, lastLoad: 0, puff: 0, col: new THREE.Color(), w: new THREE.Vector3(), q: new THREE.Quaternion(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), has: false }),
    [],
  )
  const wind: [number, number, number] = [-0.6, 0, 0.25]

  useSimFrame((dt) => {
    const a = anchor.current
    if (!a || dt <= 0) return
    const inp = input()
    stepPool(smoke, dt, wind)
    stepPool(dust, dt, wind)
    a.updateWorldMatrix(true, false)
    // vehicle velocity (world), so particles leave the pipe with the tractor's motion
    a.getWorldPosition(st.w)
    if (st.has) st.vel.subVectors(st.w, st.prev).divideScalar(dt)
    // a scene that jumps the model back to its start would otherwise fling the particles
    if (st.vel.lengthSq() > 15 * 15) st.vel.set(0, 0, 0)
    st.prev.copy(st.w)
    st.has = true
    const vx = st.vel.x
    const vz = st.vel.z
    a.getWorldQuaternion(st.q)

    // exhaust
    if (inp.load !== undefined && inp.rpm !== undefined && inp.rpm > 50) {
      const load = Math.max(0, Math.min(1, inp.load))
      const rise = (load - st.lastLoad) / dt
      st.lastLoad = load
      if (rise > 0.8) st.puff = Math.min(1, st.puff + rise * dt * 1.5)
      st.puff = Math.max(0, st.puff - dt * 0.8)
      const d = smokeDensity(load, inp.rpm, inp.ratedRpm ?? inp.rpm, st.puff)
      const rate = 10 + 40 * (inp.rpm / 2300)
      st.acc += rate * dt
      const p = new THREE.Vector3(...exhaustAt).applyMatrix4(a.matrixWorld)
      const up = 1.2 + 2.6 * (inp.rpm / 2300)
      while (st.acc >= 1) {
        st.acc -= 1
        st.col.copy(HAZE).lerp(SOOT, d)
        emitParticle(smoke, p.x, p.y, p.z, vx + (Math.random() - 0.5) * 0.3, up + Math.random() * 0.4, vz + (Math.random() - 0.5) * 0.3, {
          life: 1.2 + 1.2 * d + Math.random() * 0.5,
          size: 0.07,
          grow: 0.22 + 0.22 * d,
          alpha: 0.08 + 0.42 * d,
          color: st.col,
          lift: 0.25,
          drag: 1.2,
        })
      }
    }

    // dust behind the driving wheels
    const sp = Math.abs(inp.speed ?? 0)
    const dusty = inp.dust ?? 0
    if (dusty > 0 && sp > 0.3) {
      const slip = Math.max(0, inp.slip ?? 0)
      st.dacc += dusty * (sp * 9 + slip * 60) * dt
      while (st.dacc >= 1) {
        st.dacc -= 1
        const w = wheelsAt[Math.floor(Math.random() * wheelsAt.length)]
        const p = new THREE.Vector3(w[0], w[1], w[2] + (Math.random() - 0.5) * 0.3).applyMatrix4(a.matrixWorld)
        const back = new THREE.Vector3(-(0.4 + slip * 3), 0.9 + Math.random() * 0.8 + slip * 2, (Math.random() - 0.5) * 0.8).applyQuaternion(st.q)
        st.col.copy(DUST).offsetHSL(0, 0, (Math.random() - 0.5) * 0.08)
        emitParticle(dust, p.x, p.y, p.z, vx * 0.3 + back.x, back.y, vz * 0.3 + back.z, {
          life: 1.4 + Math.random() * 1.2,
          size: 0.15,
          grow: 0.45,
          alpha: 0.1 + 0.16 * dusty,
          color: st.col,
          lift: -0.15,
          drag: 1.6,
        })
      }
    }
  })

  return (
    <group ref={anchor}>
      <ParticleCloud pool={smoke} />
      <ParticleCloud pool={dust} />
    </group>
  )
}
