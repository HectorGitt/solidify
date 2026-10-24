import * as THREE from 'three'
import { create } from 'zustand'
import { partObjects, useParts, type PartInfo } from '@/parts/registry'
import { useSim } from '@/core/sim'
import { useView } from '@/render/view'
import { focusPart, getCameraControls, setTracked, trackedPartId } from './camera'
import { currentCamera, restoreCamera } from './trail'

/**
 * "Look inside": open an assembly in place, in the scene you are in. The part's hidden internals
 * mount, the rest of the machine is set aside, the casing goes see-through, time slows so the
 * moving parts can be followed, and the camera closes in. Back puts every setting as it was.
 *
 * Opening a whole machine (PartInfo.insideMode 'whole') mounts every system at once, colour-coded,
 * with an exploded layout one toggle away.
 */
interface Saved {
  xray: boolean
  isolatedId: string | null
  explode: number
  explodeScope: string | null
  explodeDepth: number | null
  tints: boolean
  timeScale: number
  tracked: string | null
  camera: ReturnType<typeof currentCamera>
}

interface Inside {
  id: string | null
  name: string
  saved: Saved | null
  /** the internals are still being built (shown on the pill) */
  loading: boolean
  /** one assembly, or the whole machine with every system */
  mode: 'part' | 'whole'
  /** whole machine: systems pulled apart into a labelled layout */
  exploded: boolean
}

export const useInside = create<Inside>(() => ({ id: null, name: '', saved: null, loading: false, mode: 'part', exploded: false }))

let view: [number, number, number] | undefined

/** sim seconds per real second while inside: a 2400 rpm engine turns about once every 2.5 s */
export const INSIDE_TIME_SCALE = 1 / 100

/** the container of a whole machine's systems (see WholeTractor) */
export const systemsOf = (rootId: string) => `${rootId}-systems`

export function enterInside(part: { id: string; name: string; info?: PartInfo }) {
  const v = useView.getState()
  const cur = useInside.getState()
  const saved: Saved = cur.saved ?? {
    xray: v.xray,
    isolatedId: v.isolatedId,
    explode: v.explode,
    explodeScope: v.explodeScope,
    explodeDepth: v.explodeDepth,
    tints: v.tints,
    timeScale: useSim.getState().timeScale,
    tracked: trackedPartId,
    camera: currentCamera(),
  }
  const mode = part.info?.insideMode ?? 'part'
  useInside.setState({ id: part.id, name: part.name, saved, loading: false, mode, exploded: false })
  view = part.info?.insideView
  v.isolate(part.id)
  v.setXray(true)
  v.setExplodeScope(null)
  v.setExplodeDepth(null)
  v.setExplode(0)
  v.setTints(mode === 'whole')
  // nothing selected, so every part shows its own material; click one for its card
  v.select(null)
  useSim.getState().setTimeScale(Math.min(saved.timeScale, INSIDE_TIME_SCALE))
  // let the internals mount before framing them
  window.setTimeout(() => frameInside(mode === 'whole' ? systemsOf(part.id) : part.id, part.info?.insideView), 80)
}

export function exitInside() {
  const { id, saved } = useInside.getState()
  if (!id) return
  useInside.setState({ id: null, name: '', saved: null, loading: false, mode: 'part', exploded: false })
  if (!saved) return
  const v = useView.getState()
  v.isolate(saved.isolatedId)
  v.setXray(saved.xray)
  v.setExplodeScope(saved.explodeScope)
  v.setExplodeDepth(saved.explodeDepth)
  v.setExplode(saved.explode)
  v.setTints(saved.tints)
  useSim.getState().setTimeScale(saved.timeScale)
  restoreCamera(saved.camera)
  setTracked(saved.tracked)
}

/** Whole machine: pull the systems apart (body set aside), or put them back in the body. */
export function setExploded(on: boolean) {
  const { id, mode } = useInside.getState()
  if (!id || mode !== 'whole') return
  const v = useView.getState()
  const systems = systemsOf(id)
  useInside.setState({ exploded: on })
  v.select(null)
  if (on) {
    v.isolate(systems)
    v.setExplodeScope(systems)
    v.setExplodeDepth(1)
    v.setExplode(1)
  } else {
    v.isolate(id)
    v.setExplode(0)
    v.setExplodeScope(null)
    v.setExplodeDepth(null)
  }
  // frame once the systems have moved
  // the exploded layout spreads along the tractor and upwards: look at it from the side
  window.setTimeout(() => frameInside(systems, on ? EXPLODED_VIEW : view, !on), on ? 700 : 80)
}

/** forget without restoring (the scene is being left) */
export function dropInside() {
  useInside.setState({ id: null, name: '', saved: null, loading: false, mode: 'part', exploded: false })
}

/** Internals that load asynchronously call this once they are in place: frame them and clear the pill. */
export function insideReady() {
  const { id, exploded, mode } = useInside.getState()
  useInside.setState({ loading: false })
  if (id && !exploded) frameInside(mode === 'whole' ? systemsOf(id) : id, view)
}

/** side-on, a little from the front and above, for the exploded layout */
const EXPLODED_VIEW: [number, number, number] = [0.35, 0.45, -1]

/** three-quarter view from the front, above and to the left, in the machine's own frame (+X forward, +Z right) */
const VIEW_DIR = new THREE.Vector3(0.95, 0.8, -1.05).normalize()

/** the moving parts inside `id` (what there is to watch), or the whole part if none */
function movingBox(id: string, obj: THREE.Object3D) {
  const parts = useParts.getState().parts
  const box = new THREE.Box3()
  for (const p of Object.values(parts)) {
    if (p.role !== 'moving' || p.id === id) continue
    let inside = false
    for (let q: string | null = p.parentId; q; q = parts[q]?.parentId ?? null) if (q === id) inside = true
    const o = inside ? partObjects.get(p.id) : undefined
    if (o) box.expandByObject(o)
  }
  return box.isEmpty() ? box.setFromObject(obj) : box
}

/** the whole-tractor legend covers the right of the view; frame the machine in the space beside it */
const PANEL_PX = 290

function frameInside(id: string, view?: [number, number, number], moving = true) {
  const obj = partObjects.get(id)
  const c = getCameraControls()
  if (!obj || !c) return focusPart(id)
  const box = moving ? movingBox(id, obj) : new THREE.Box3().setFromObject(obj)
  if (box.isEmpty()) return focusPart(id)
  const centre = box.getCenter(new THREE.Vector3())
  const radius = box.getSize(new THREE.Vector3()).length() / 2
  const dir = (view ? new THREE.Vector3(...view).normalize() : VIEW_DIR.clone()).applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion()))
  // far enough that the whole sphere fits the camera's view
  const cam = c.camera as THREE.PerspectiveCamera
  const fov = ((cam.fov ?? 32) * Math.PI) / 180
  const whole = useInside.getState().mode === 'whole'
  const el = (c as unknown as { _domElement?: HTMLElement })._domElement ?? document.querySelector('main canvas')
  const w = el?.clientWidth ?? 1000
  // with the legend open, fit the machine into the narrower space beside it
  const fit = whole ? w / Math.max(200, w - PANEL_PX) : 1
  const dist = (radius / Math.sin(fov / 2)) * 1.05 * fit
  const eye = centre.clone().addScaledVector(dir, dist)
  if (whole) {
    // slide the view right by half the panel, so the machine centres in the free space
    const halfW = dist * Math.tan(fov / 2) * (cam.aspect ?? 1.6)
    const right = new THREE.Vector3().crossVectors(dir.clone().negate(), new THREE.Vector3(0, 1, 0)).normalize()
    const shift = right.multiplyScalar(((PANEL_PX / 2) / w) * 2 * halfW)
    centre.add(shift)
    eye.add(shift)
  }
  void c.setLookAt(eye.x, eye.y, eye.z, centre.x, centre.y, centre.z, true)
  setTracked(id)
}
