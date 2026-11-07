import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useSim } from '@/core/sim'
import { partObjects, useParts } from '@/parts/registry'
import { getCameraControls } from '@/ui/camera'
import { buildOffsets, buildSnappy, nextSteps, useBuild, type BuildDef } from './build'
import { useView } from './view'

type Slot = { home: THREE.Vector3; size: THREE.Vector3; tray: THREE.Vector3; at: THREE.Vector3 }

const _b = new THREE.Box3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _v = new THREE.Vector3()
const ZERO = new THREE.Vector3()

/** world-space centre and size of a part at home (its build/explode offset taken back out) */
function measure(id: string) {
  const outer = partObjects.get(id)
  if (!outer) return null
  outer.updateWorldMatrix(true, true)
  _b.setFromObject(outer)
  if (_b.isEmpty()) return null
  const centre = _b.getCenter(new THREE.Vector3())
  const size = _b.getSize(new THREE.Vector3())
  const inner = outer.children[0]
  if (inner) {
    _v.copy(inner.position)
    outer.getWorldScale(_s)
    _v.multiply(_s).applyQuaternion(outer.getWorldQuaternion(_q))
    centre.sub(_v)
  }
  return { centre, size }
}

const name = (id: string) => useParts.getState().parts[id]?.name ?? id
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
/** a stable shuffle, so the tray doesn't give the order away but is the same every time */
const shuffleKey = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 997

/**
 * Hands in a headset (set while build mode is on): pick up the loose part at a point (fingers pinched on
 * it), carry it, and let it go, with the same rules as dragging it with a mouse. Points are in the scene.
 */
/**
 * The tray's layout: which side of the machine it goes, as seen by the viewer (1 right, -1 left: the headset
 * panel is on the right), and how long a row is (× the machine's size; short in a headset, so every part is
 * within reach of someone sitting at the table), and whether the rows run back from the viewer or, starting
 * level with the back of the machine, towards them (in a headset: the parts come to hand)
 */
export const buildTray = { side: 1, row: 1.7, toward: false }

export const buildHands: {
  grab?: (p: THREE.Vector3, reach: number) => string | null
  carry?: (id: string, p: THREE.Vector3) => void
  release?: (id: string) => void
} = {}

/**
 * Lays the loose parts out on a tray in front of the machine, lets them be dragged (or tapped) home,
 * and checks each one against what it needs. Lives inside the Canvas; reads and writes useBuild.
 */
export function BuildController({ floorY = 0 }: { floorY?: number }) {
  const { camera, gl, scene } = useThree()
  const def = useBuild((s) => s.def)
  const layout = useBuild((s) => s.layout)
  const slots = useRef(new Map<string, Slot>())
  const drag = useRef<{ id: string; plane: THREE.Plane; grab: THREE.Vector3; x: number; y: number; moved: boolean } | null>(null)
  const snapR = useRef(0.2)
  const onMachine = useRef(new THREE.Box3())
  const saved = useRef<{ cut: boolean; hidden: string[]; playing: boolean } | null>(null)

  // ---------------------------------------------------------------- enter / leave, and laying out the tray
  useEffect(() => {
    if (!def) return
    const view = useView.getState()
    if (!saved.current) {
      saved.current = { cut: view.cut.enabled, hidden: [...view.hidden], playing: useSim.getState().playing }
      view.setCut({ enabled: false })
      view.setExplode(0)
      view.select(null)
      for (const id of def.hideUntilBuilt ?? []) if (!view.hidden.includes(id)) view.toggleHidden(id)
    }
    useSim.getState().setPlaying(false)
    // measure every part at home, then the machine as a whole
    const all = new THREE.Box3()
    const m = new Map<string, { centre: THREE.Vector3; size: THREE.Vector3 }>()
    for (const s of def.steps) {
      const r = measure(s.id)
      if (!r) continue
      m.set(s.id, r)
      all.union(new THREE.Box3().setFromCenterAndSize(r.centre, r.size))
    }
    if (all.isEmpty()) return
    const C = all.getCenter(new THREE.Vector3())
    const S = all.getSize(new THREE.Vector3())
    const big = Math.max(S.x, S.y, S.z)
    snapR.current = 0.28 * big
    // a part let go over the machine counts as an attempt to fit it
    onMachine.current = all.clone().expandByScalar(0.08 * big)
    // the tray lies on the floor beside the machine (to the right as seen from the camera), in rows
    // running back from the camera, so nothing on it hides the machine being built
    const front = camera.position.clone().sub(C).setY(0)
    if (front.lengthSq() < 1e-6) front.set(0, 0, 1)
    front.normalize()
    const across = new THREE.Vector3(front.z, 0, -front.x).multiplyScalar(buildTray.side)
    const gap = 0.14 * big
    const rowW = buildTray.row * big
    const ids = [...m.keys()].sort((a, b) => shuffleKey(a) - shuffleKey(b))
    const rows: string[][] = [[]]
    let w = 0
    for (const id of ids) {
      const sz = m.get(id)!.size
      const pw = Math.abs(sz.x * across.x) + Math.abs(sz.z * across.z) + gap
      if (w + pw > rowW && rows[rows.length - 1].length) {
        rows.push([])
        w = 0
      }
      rows[rows.length - 1].push(id)
      w += pw
    }
    const next = new Map<string, Slot>()
    const side = 0.5 * (Math.abs(S.x * across.x) + Math.abs(S.z * across.z)) + 0.3 * big
    // first row level with the front of the machine, the rest stepping back (or level with its back, the rest
    // stepping towards the viewer)
    const toward = buildTray.toward
    let dist = (toward ? -0.5 : 0.5) * (Math.abs(S.x * front.x) + Math.abs(S.z * front.z))
    for (const row of rows) {
      const widths = row.map((id) => { const sz = m.get(id)!.size; return Math.abs(sz.x * across.x) + Math.abs(sz.z * across.z) + gap })
      const depth = Math.max(...row.map((id) => { const sz = m.get(id)!.size; return Math.abs(sz.x * front.x) + Math.abs(sz.z * front.z) }))
      let x = side
      row.forEach((id, i) => {
        const { centre, size } = m.get(id)!
        const t = C.clone().addScaledVector(front, toward ? dist + depth / 2 : dist - depth / 2).addScaledVector(across, x + widths[i] / 2)
        t.y = floorY + size.y / 2 + 0.002
        next.set(id, { home: centre, size, tray: t, at: t.clone() })
        x += widths[i]
      })
      dist += toward ? depth + gap : -(depth + gap)
    }
    slots.current = next
    // frame the machine and the tray together
    const box = all.clone()
    for (const s of next.values()) box.union(new THREE.Box3().setFromCenterAndSize(s.tray, s.size))
    // looking down on the bench at about 40°, so the rows of the tray don't hide one another
    const cc = getCameraControls()
    if (cc) {
      const target = box.getCenter(new THREE.Vector3())
      const r = box.getBoundingSphere(new THREE.Sphere()).radius
      const cam = camera as THREE.PerspectiveCamera
      const vfov = THREE.MathUtils.degToRad(cam.fov ?? 40)
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (cam.aspect ?? 1.6))
      const dist = (0.98 * r) / Math.sin(Math.min(vfov, hfov) / 2)
      // keep the side we were looking from, tip down to 40° below the horizon
      const polar = THREE.MathUtils.degToRad(50)
      const eye = target.clone().add(new THREE.Vector3(Math.sin(polar) * front.x, Math.cos(polar), Math.sin(polar) * front.z).multiplyScalar(dist))
      void cc.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, true)
    }
  }, [def, layout, camera, floorY])

  // leaving: put everything back as it was
  useEffect(() => {
    if (def) return
    buildOffsets.clear()
    buildSnappy.clear()
    const s = saved.current
    if (!s) return
    saved.current = null
    const view = useView.getState()
    view.setCut({ enabled: s.cut })
    for (const id of view.hidden) if (!s.hidden.includes(id)) view.toggleHidden(id)
    view.hover(null)
    useSim.getState().setPlaying(s.playing)
  }, [def])

  // finished: the fluids go in and the engine runs
  const finishedAt = useBuild((s) => s.finishedAt)
  useEffect(() => {
    if (!finishedAt || !def) return
    const view = useView.getState()
    for (const id of def.hideUntilBuilt ?? []) if (view.hidden.includes(id)) view.toggleHidden(id)
    useSim.getState().setPlaying(true)
  }, [finishedAt, def])

  // ---------------------------------------------------------------- pointer: pick up, drag, drop, tap
  useEffect(() => {
    if (!def) return
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const hit = new THREE.Vector3()
    const setRay = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
    }
    const looseUnder = (e: PointerEvent) => {
      setRay(e)
      const placed = useBuild.getState().placed
      const owner = new Map<THREE.Object3D, string>()
      for (const id of slots.current.keys()) if (!placed.includes(id)) { const o = partObjects.get(id); if (o) owner.set(o, id) }
      for (const h of ray.intersectObjects(scene.children, true)) {
        for (let o: THREE.Object3D | null = h.object; o; o = o.parent) {
          const id = owner.get(o)
          if (id) return { id, point: h.point }
        }
      }
      // nothing solid under the pointer (a gasket's bore, the gap in a spring): take the loose part
      // whose outline on screen holds the pointer, the smallest if several do
      let best: { id: string; area: number } | null = null
      const box = new THREE.Box3()
      for (const [o, id] of owner) {
        box.setFromObject(o)
        if (box.isEmpty()) continue
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
        for (let k = 0; k < 8; k++) {
          _v.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(camera)
          x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y)
        }
        if (ndc.x < x0 || ndc.x > x1 || ndc.y < y0 || ndc.y > y1) continue
        const area = (x1 - x0) * (y1 - y0)
        if (!best || area < best.area) best = { id, area }
      }
      return best ? { id: best.id, point: slots.current.get(best.id)!.at.clone() } : null
    }
    const allowed = (id: string) => nextSteps(def, useBuild.getState().placed).some((s) => s.id === id)
    const refuse = (id: string) => {
      const step = def.steps.find((s) => s.id === id)!
      const missing = (step.needs ?? []).filter((n) => !useBuild.getState().placed.includes(n)).map((n) => lower(name(n)))
      useBuild.getState().reject(step.why ?? `Not yet: the ${missing.join(' and the ')} must go in first.`)
    }
    const accept = (id: string) => {
      const info = useParts.getState().parts[id]?.info
      useBuild.getState().place(id, `${name(id)} fitted`, info?.role ?? info?.summary)
    }

    const down = (e: PointerEvent) => {
      if (e.button !== 0 || e.target !== el || useBuild.getState().finishedAt) return
      const got = looseUnder(e)
      if (!got) return
      // ours: keep the orbit controls and part selection out of it (this listener runs first, on the
      // window in the capture phase, so nothing on the canvas sees the press)
      e.stopImmediatePropagation()
      e.preventDefault()
      const slot = slots.current.get(got.id)!
      const n = camera.getWorldDirection(new THREE.Vector3())
      drag.current = { id: got.id, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, slot.at), grab: got.point.clone().sub(slot.at), x: e.clientX, y: e.clientY, moved: false }
      useBuild.getState().hold(got.id)
      buildSnappy.add(got.id)
      const cc = getCameraControls()
      if (cc) cc.enabled = false
      el.setPointerCapture?.(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true
      if (!d.moved) return
      setRay(e)
      if (!ray.ray.intersectPlane(d.plane, hit)) return
      const slot = slots.current.get(d.id)!
      slot.at.copy(hit).sub(d.grab)
      slot.at.y = Math.max(slot.at.y, floorY + slot.size.y / 2)
      // close to home: light it up if it may go in
      const near = slot.at.distanceTo(slot.home) < snapR.current || ray.ray.intersectsBox(onMachine.current)
      useView.getState().hover(near && allowed(d.id) ? d.id : null)
    }
    const up = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      setRay(e)
      drag.current = null
      buildSnappy.delete(d.id)
      const cc = getCameraControls()
      if (cc) cc.enabled = true
      useView.getState().hover(null)
      const slot = slots.current.get(d.id)!
      // let go over the machine (or right by its home): that is an attempt to fit it
      const near = slot.at.distanceTo(slot.home) < snapR.current || ray.ray.intersectsBox(onMachine.current)
      if (!d.moved || near) {
        if (allowed(d.id)) accept(d.id)
        else refuse(d.id)
      } else useBuild.getState().hold(null)
      // anything that didn't go in goes back to its place on the tray
      if (!useBuild.getState().placed.includes(d.id)) slot.at.copy(slot.tray)
    }
    // the same, for fingers in a headset: the part under the pinch, carried with it, fitted if let go by its home
    const held = new Map<string, THREE.Vector3>()
    buildHands.grab = (p, reach) => {
      if (useBuild.getState().finishedAt) return null
      const placed = useBuild.getState().placed
      const box = new THREE.Box3()
      let best: { id: string; size: number } | null = null
      for (const id of slots.current.keys()) {
        if (placed.includes(id) || held.has(id)) continue
        const o = partObjects.get(id)
        if (!o) continue
        box.setFromObject(o)
        if (box.isEmpty()) continue
        const size = box.getSize(_v).length()
        box.expandByScalar(Math.max(reach, size * 0.1))
        if (box.containsPoint(p) && (!best || size < best.size)) best = { id, size }
      }
      if (!best) return null
      const slot = slots.current.get(best.id)!
      held.set(best.id, p.clone().sub(slot.at))
      useBuild.getState().hold(best.id)
      buildSnappy.add(best.id)
      return best.id
    }
    buildHands.carry = (id, p) => {
      const slot = slots.current.get(id)
      const grab = held.get(id)
      if (!slot || !grab) return
      slot.at.copy(p).sub(grab)
      slot.at.y = Math.max(slot.at.y, floorY + slot.size.y / 2)
      const near = slot.at.distanceTo(slot.home) < snapR.current || onMachine.current.containsPoint(p)
      useView.getState().hover(near && allowed(id) ? id : null)
    }
    buildHands.release = (id) => {
      const slot = slots.current.get(id)
      if (!slot || !held.has(id)) return
      held.delete(id)
      buildSnappy.delete(id)
      useView.getState().hover(null)
      const near = slot.at.distanceTo(slot.home) < snapR.current || onMachine.current.containsPoint(slot.at)
      if (near) {
        if (allowed(id)) accept(id)
        else refuse(id)
      } else useBuild.getState().hold(null)
      if (!useBuild.getState().placed.includes(id)) slot.at.copy(slot.tray)
    }

    window.addEventListener('pointerdown', down, { capture: true })
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerdown', down, { capture: true })
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      buildHands.grab = buildHands.carry = buildHands.release = undefined
      const cc = getCameraControls()
      if (cc) cc.enabled = true
    }
  }, [def, gl, camera, scene, floorY])

  // ---------------------------------------------------------------- every frame: where each loose part is
  useFrame(() => {
    if (!def) return
    const { placed, held, hinted } = useBuild.getState()
    for (const [id, slot] of slots.current) {
      let o = buildOffsets.get(id)
      if (!o) buildOffsets.set(id, (o = new THREE.Vector3()))
      if (placed.includes(id)) o.copy(ZERO)
      else o.copy(slot.at).sub(slot.home)
    }
    // the hint lights its part up on the tray, gently pulsing
    if (hinted && !held) useView.getState().hover(Math.floor(performance.now() / 450) % 2 ? hinted : null)
  })

  return null
}

/** ask for a hint: names a part that can go in now and lights it up */
export function buildHint(def: BuildDef) {
  const { placed } = useBuild.getState()
  const can = nextSteps(def, placed)
  if (!can.length) return
  // the earliest step in the list that can go in: the order the scene suggests
  useBuild.getState().hint(can[0].id, `Try the ${lower(name(can[0].id))}. It's lit up on the tray.`)
}
