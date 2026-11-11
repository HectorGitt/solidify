import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { partObjects } from '@/parts/registry'
import { useBuild } from '@/render/build'
import { useView } from '@/render/view'
import { useInside } from '@/ui/inside'

const seeThroughNow = (m: THREE.Mesh) => (Array.isArray(m.material) ? m.material : [m.material]).some((x) => x.transparent || x.opacity < 1)

/** layer nothing renders or picks on (the same one looking inside a part uses) */
const ASIDE = 31
const SIZE = 384

/**
 * In a headset, the parts nobody can see are not drawn while the machine is closed. A whole tractor is over
 * four hundred meshes, more than half of them inside the engine, gearbox and axles; drawing them anyway costs
 * a headset more than half its frame.
 *
 * Which ones can't be seen is measured, not guessed: each mesh is drawn in its own flat colour from about
 * thirty directions (around, above, below, near and far), a few views per frame while the student places the
 * rig, and a mesh whose colour never shows is set aside. They all come back the moment anything opens the
 * machine (a cut, X-ray, taking it apart, building it, looking inside a part), and the measure is taken again
 * if the machine's parts change.
 */
export function useHideEnclosed(active: boolean) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const job = useRef<{ meshes: THREE.Mesh[]; views: THREE.Vector3[]; at: number; seen: Set<number>; key: string } | null>(null)
  const hidden = useRef(new Map<THREE.Object3D, number>())
  const doneKey = useRef('')
  const rt = useRef<THREE.WebGLRenderTarget | null>(null)
  const buf = useRef(new Uint8Array(SIZE * SIZE * 4))
  const cam = useRef(new THREE.PerspectiveCamera(40, 1, 0.01, 1000))

  const restore = () => {
    for (const [o, mask] of hidden.current) o.layers.mask = mask
    hidden.current.clear()
  }
  useEffect(
    () => () => {
      restore()
      rt.current?.dispose()
      rt.current = null
    },
    [],
  )

  useFrame(() => {
    const v = useView.getState()
    // (development: window.__xrNoHide turns it off, to compare)
    const off = import.meta.env.DEV && !!(window as unknown as { __xrNoHide?: boolean }).__xrNoHide
    const closed = active && !off && !v.cut.enabled && !v.xray && v.explode === 0 && !useBuild.getState().def && !useInside.getState().id
    if (!closed) {
      restore()
      job.current = null
      return
    }
    // the machine's meshes now (a slider can rebuild parts): a new set means measuring again
    const meshes: THREE.Mesh[] = []
    const set = new Set<THREE.Object3D>()
    for (const o of partObjects.values())
      o.traverse((m) => {
        if ((m as THREE.Mesh).isMesh && !set.has(m)) {
          set.add(m)
          meshes.push(m as THREE.Mesh)
        }
      })
    const key = `${meshes.length}:${meshes[0]?.uuid ?? ''}:${meshes[meshes.length - 1]?.uuid ?? ''}`
    if (doneKey.current === key && !job.current) {
      // keep them aside (a part that remounts gets its layer back)
      for (const o of hidden.current.keys()) if (o.layers.mask !== 1 << ASIDE) o.layers.set(ASIDE)
      return
    }
    if (!job.current || job.current.key !== key) {
      restore()
      if (meshes.length < 40) {
        // small rigs: nothing worth hiding
        doneKey.current = key
        return
      }
      const box = new THREE.Box3()
      for (const m of meshes) if (m.visible) box.expandByObject(m)
      if (box.isEmpty()) return
      const c = box.getCenter(new THREE.Vector3())
      const r = box.getBoundingSphere(new THREE.Sphere()).radius
      const views: THREE.Vector3[] = []
      for (const [n, el, d] of [
        [12, 0.3, 2.4],
        [8, 0.9, 2.4],
        [8, -0.15, 2.4],
        [8, 0.35, 1.5],
      ] as const)
        for (let k = 0; k < n; k++) {
          const az = (k / n) * Math.PI * 2 + el
          views.push(new THREE.Vector3(c.x + Math.cos(el) * Math.sin(az) * r * d, c.y + Math.sin(el) * r * d, c.z + Math.cos(el) * Math.cos(az) * r * d))
        }
      views.push(new THREE.Vector3(c.x, c.y + r * 2.6, c.z + r * 0.01))
      cam.current.near = r / 200
      cam.current.far = r * 20
      cam.current.updateProjectionMatrix()
      job.current = { meshes, views, at: 0, seen: new Set(), key }
      ;(cam.current.userData as { c?: THREE.Vector3 }).c = c
    }
    const j = job.current
    rt.current ??= new THREE.WebGLRenderTarget(SIZE, SIZE)
    // draw only the machine, each mesh in its own colour
    const swapped = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
    const flat: THREE.Material[] = []
    const seeThrough = (m: THREE.Mesh) => (Array.isArray(m.material) ? m.material : [m.material]).some((x) => x.transparent || x.opacity < 1)
    j.meshes.forEach((m, i) => {
      swapped.set(m, m.material)
      // the id as the colour, written as it is (no colour management), so it reads back exactly
      const id = i + 1
      const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
      mat.color.setRGB(((id >> 16) & 255) / 255, ((id >> 8) & 255) / 255, (id & 255) / 255, THREE.LinearSRGBColorSpace)
      mat.toneMapped = false
      // see-through parts (glass, oil, gas) are not drawn: what is behind them can be seen
      if (seeThrough(m)) mat.visible = false
      flat.push(mat)
      m.material = mat
    })
    const others: THREE.Object3D[] = []
    const machine = new Set<THREE.Object3D>(j.meshes)
    scene.traverse((o) => {
      if (((o as THREE.Mesh).isMesh || (o as THREE.Line).isLine || (o as THREE.Points).isPoints) && !machine.has(o) && o.visible) {
        others.push(o)
        o.visible = false
      }
    })
    const bg = scene.background
    const fog = scene.fog
    scene.background = new THREE.Color(0)
    scene.fog = null
    const xrOn = gl.xr.enabled
    gl.xr.enabled = false
    const prev = gl.getRenderTarget()
    const tone = gl.toneMapping
    gl.toneMapping = THREE.NoToneMapping
    // two views a frame, so the placing never stutters
    for (let n = 0; n < 2 && j.at < j.views.length; n++, j.at++) {
      cam.current.position.copy(j.views[j.at])
      cam.current.lookAt((cam.current.userData as { c: THREE.Vector3 }).c)
      cam.current.updateMatrixWorld()
      gl.setRenderTarget(rt.current)
      gl.clear()
      gl.render(scene, cam.current)
      gl.readRenderTargetPixels(rt.current, 0, 0, SIZE, SIZE, buf.current)
      const b = buf.current
      for (let i = 0; i < b.length; i += 4) {
        const id = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2]
        if (id) j.seen.add(id - 1)
      }
    }
    gl.setRenderTarget(prev)
    gl.toneMapping = tone
    gl.xr.enabled = xrOn
    scene.background = bg
    scene.fog = fog
    for (const o of others) o.visible = true
    for (const [m, mat] of swapped) m.material = mat
    for (const m of flat) m.dispose()
    if (j.at < j.views.length) return
    // measured: set aside every mesh never seen
    j.meshes.forEach((m, i) => {
      if (j.seen.has(i) || !m.visible || seeThroughNow(m)) return
      hidden.current.set(m, m.layers.mask)
      m.layers.set(ASIDE)
    })
    doneKey.current = j.key
    job.current = null
    if (import.meta.env.DEV) (window as unknown as { __xrHidden?: number }).__xrHidden = hidden.current.size
  })
}
