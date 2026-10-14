import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import type { PartInfo } from '@/parts/registry'
import { Part } from '@/render/Part'
import { useView } from '@/render/view'
import { TRACTOR } from './dims'
import type { TractorPose } from './Tractor'

/**
 * Detailed tractor exterior from a downloaded model: "Tractor Fiat 480 Low Poly Model" by
 * usama_javaid (Sketchfab), CC BY 4.0 — see public/models/tractor-fiat-480-LICENSE.txt.
 *
 * The file faces −X with Y up and is about 2.5× real size. Its wheel nodes are already pivoted at
 * their hubs. We turn it half round (to face +X, right = +Z), scale its wheelbase onto ours and
 * stand the rear tyres on the ground, then wrap each wheel in pivots so it rolls (and the fronts
 * steer) from the tractor pose.
 *
 * Each separate object in the file becomes an inspectable part: it can be clicked, highlighted,
 * hidden, isolated and exploded like the built-in parts, and the body turns see-through in x-ray.
 */
export const MODEL_URL = `${import.meta.env.BASE_URL}models/tractor-fiat-480.glb`

/** measured from the file: rear and front hub x, hub heights, rear tyre radius (model units) */
const M = { rearX: 1.966, frontX: -2.825, rearHubY: 1.599, rearR: 1.6915 }
export const MODEL_SCALE = TRACTOR.wheelbase / (M.rearX - M.frontX)
/** top of the model's exhaust stack in the tractor frame (measured from the mesh) — where the smoke leaves */
export const MODEL_EXHAUST: [number, number, number] = [1.25, 2.0, -0.3]
/** lifts the model so the rear tyres touch the ground (y = 0) */
const LIFT = (M.rearR - M.rearHubY) * MODEL_SCALE

type Key = 'rearL' | 'rearR' | 'frontL' | 'frontR' | 'steering' | 'driver'

const PARTS: Record<Key | 'body', { name: string; info: PartInfo }> = {
  body: {
    name: 'Body, bonnet & fenders',
    info: {
      summary: 'Detailed tractor body — a Fiat 480-type 2WD utility tractor.',
      role: 'Bonnet over the engine, fuel tank, fenders, platform and four-post frame. Turn on X-ray to see the drivetrain inside. Model by usama_javaid (Sketchfab), CC BY 4.0.',
    },
  },
  rearL: { name: 'Rear wheel (left)', info: { summary: 'Rear driving wheel and tyre.', role: 'Turns the axle torque into pull at the soil: pull = 2·T/D, less rolling resistance and slip. Bar-lug tread for grip in soft soil.' } },
  rearR: { name: 'Rear wheel (right)', info: { summary: 'Rear driving wheel and tyre.', role: 'Turns the axle torque into pull at the soil: pull = 2·T/D, less rolling resistance and slip. Bar-lug tread for grip in soft soil.' } },
  frontL: { name: 'Front wheel (left)', info: { summary: 'Front steering wheel and tyre.', role: 'Carries the front weight and steers on its king pin; the rib tread resists sideways slip.' } },
  frontR: { name: 'Front wheel (right)', info: { summary: 'Front steering wheel and tyre.', role: 'Carries the front weight and steers on its king pin; the rib tread resists sideways slip.' } },
  steering: { name: 'Steering wheel', info: { summary: 'Steering wheel and column.', role: 'Turns the front wheels through the steering box and linkage.' } },
  driver: { name: 'Driver', info: { summary: 'Operator, seated.', role: 'Shows the operator’s position, reach and view — seat height, wheel and controls within easy reach.' } },
}

/** a piece that moves out in the exploded view: its rest position and full-explode offset (model frame) */
interface Exploding {
  obj: THREE.Object3D
  base: THREE.Vector3
  off: THREE.Vector3
}

interface Rig {
  /** the outer group of each separate piece (mounted under its own Part) */
  pieces: Partial<Record<Key, THREE.Object3D>>
  rear: THREE.Object3D[]
  front: { steer: THREE.Object3D; spin: THREE.Object3D; left: boolean }[]
  explode: Exploding[]
  /** meshes of each piece and of the remaining body, with their own (cloned) materials */
  meshes: Record<Key | 'body', THREE.Mesh[]>
}

/** Wrap a wheel node in pivots at its hub (model frame, axle along Z) without moving it. */
function pivot(root: THREE.Object3D, node: THREE.Object3D) {
  root.updateMatrixWorld(true)
  const hub = node.getWorldPosition(new THREE.Vector3())
  root.worldToLocal(hub)
  const steer = new THREE.Group()
  steer.position.copy(hub)
  const spin = new THREE.Group()
  steer.add(spin)
  root.add(steer)
  root.updateMatrixWorld(true)
  spin.attach(node)
  // steer: the outer group at the hub (moves, and yaws for front wheels); spin: rolls inside it
  return { steer, spin }
}

/** Wrap a node in a group at the model origin (so it can be moved in the model frame) without moving it. */
function lift(root: THREE.Object3D, node: THREE.Object3D) {
  const g = new THREE.Group()
  root.add(g)
  root.updateMatrixWorld(true)
  g.attach(node)
  return g
}

function meshesOf(o: THREE.Object3D) {
  const out: THREE.Mesh[] = []
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) out.push(c as THREE.Mesh)
  })
  return out
}

function rig(scene: THREE.Group): Rig {
  const find = (name: string) => scene.getObjectByName(name)
  const r: Rig = { pieces: {}, rear: [], front: [], explode: [], meshes: { body: [], rearL: [], rearR: [], frontL: [], frontR: [], steering: [], driver: [] } }
  /** metres in the tractor frame → model units */
  const m = (x: number) => x / MODEL_SCALE
  const out = (obj: THREE.Object3D, off: THREE.Vector3) => r.explode.push({ obj, base: obj.position.clone(), off })
  // every mesh gets its own material so one part can glow without the others
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).clone()
  })
  for (const [name, key] of [['Back_Left_Wheel', 'rearL'], ['Back_Right_Wheel', 'rearR']] as const) {
    const n = find(name)
    if (!n) continue
    const p = pivot(scene, n)
    r.rear.push(p.spin)
    r.pieces[key] = p.steer
    // straight out along the axle (the model's left wheels are on +Z)
    out(p.steer, new THREE.Vector3(0, 0, Math.sign(p.steer.position.z) * m(0.6)))
  }
  for (const [name, key] of [['Front_Left_Wheel', 'frontL'], ['Front_Right_Wheel', 'frontR']] as const) {
    const n = find(name)
    if (!n) continue
    const p = pivot(scene, n)
    r.front.push({ ...p, left: key === 'frontL' })
    r.pieces[key] = p.steer
    out(p.steer, new THREE.Vector3(0, 0, Math.sign(p.steer.position.z) * m(0.45)))
  }
  const steering = find('Steering')
  if (steering) {
    r.pieces.steering = lift(scene, steering)
    out(r.pieces.steering, new THREE.Vector3(0, m(0.45), 0))
  }
  const driver = find('Driver')
  if (driver) {
    r.pieces.driver = lift(scene, driver)
    out(r.pieces.driver, new THREE.Vector3(0, m(0.9), 0))
  }
  for (const k of Object.keys(r.pieces) as Key[]) r.meshes[k] = meshesOf(r.pieces[k]!)
  const taken = new Set(Object.values(r.meshes).flat())
  r.meshes.body = meshesOf(scene).filter((x) => !taken.has(x))
  return r
}

const HOVER = new THREE.Color('#1f6f55')
const SELECT = new THREE.Color('#10b981')
const BLACK = new THREE.Color('#000000')

export function ModelTractor({ pose, id, driver = true, steerAngles }: { pose: TractorPose; id: string; driver?: boolean; steerAngles: (steer: number) => { left: number; right: number } }) {
  const gltf = useGLTF(MODEL_URL)
  const { scene, r } = useMemo(() => {
    const s = gltf.scene.clone(true)
    return { scene: s, r: rig(s) }
  }, [gltf.scene])
  const pid = (k: Key | 'body') => `${id}-${k === 'body' ? 'body' : `model-${k}`}`

  useSimFrame(() => {
    // the file's wheels roll forward (towards its −X) for a positive turn about +Z
    for (const w of r.rear) w.rotation.z = pose.rearAngle
    const st = steerAngles(pose.steer)
    for (const f of r.front) {
      f.spin.rotation.z = pose.frontAngle
      f.steer.rotation.y = f.left ? st.left : st.right
    }
  })

  // exploded view: wheels out along their axles, steering wheel and driver lifted
  const k = useRef(0)
  useFrame((_, dt) => {
    const target = useView.getState().explode
    k.current += (target - k.current) * (1 - Math.exp(-dt * 10))
    for (const e of r.explode) e.obj.position.copy(e.base).addScaledVector(e.off, k.current)
  })

  // selection / hover glow, hide / isolate, see-through body in x-ray
  const selectedId = useView((s) => s.selectedId)
  const hoveredId = useView((s) => s.hoveredId)
  const hidden = useView((s) => s.hidden)
  const isolatedId = useView((s) => s.isolatedId)
  const xray = useView((s) => s.xray)
  useEffect(() => {
    const bodyId = pid('body')
    for (const key of Object.keys(r.meshes) as (Key | 'body')[]) {
      const own = pid(key)
      const path = key === 'body' ? [id, own] : [id, bodyId, own]
      const off = path.some((p) => hidden.includes(p)) || (isolatedId !== null && !path.includes(isolatedId)) || (key === 'driver' && !driver)
      const glow = selectedId && path.includes(selectedId) ? SELECT : hoveredId === own ? HOVER : BLACK
      for (const mesh of r.meshes[key]) {
        mesh.visible = !off
        const mat = mesh.material as THREE.MeshStandardMaterial
        if (mat.emissive) mat.emissive.copy(glow)
        const see = xray && key === 'body'
        mat.transparent = see
        mat.opacity = see ? 0.22 : 1
        mat.depthWrite = !see
        mesh.castShadow = !see
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, hoveredId, hidden, isolatedId, xray, driver, r, id])

  const handlers = (key: Key | 'body') => ({
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 4) return
      e.stopPropagation()
      useView.getState().select(pid(key))
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      useView.getState().hover(pid(key))
    },
    onPointerOut: () => {
      if (useView.getState().hoveredId === pid(key)) useView.getState().hover(null)
    },
  })

  return (
    <Part id={pid('body')} name={PARTS.body.name} role="static" cut={false} explode={false} info={PARTS.body.info}>
      <group position={[M.rearX * MODEL_SCALE, LIFT, 0]} rotation={[0, Math.PI, 0]} scale={MODEL_SCALE}>
        <group {...handlers('body')}>
          <primitive object={scene} />
        </group>
        {(Object.keys(r.pieces) as Key[]).map((key) => (
          <Part key={key} id={pid(key)} name={PARTS[key].name} role={key === 'driver' || key === 'steering' ? 'static' : 'moving'} cut={false} explode={false} info={PARTS[key].info}>
            <group {...handlers(key)}>
              <primitive object={r.pieces[key]!} />
            </group>
          </Part>
        ))}
      </group>
    </Part>
  )
}

