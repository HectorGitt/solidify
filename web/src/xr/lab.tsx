import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { XR, XROrigin, createXRStore, useXRHitTest, useXRInputSourceEvent } from '@react-three/xr'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSim } from '@/core/sim'
import type { SceneDef } from '@/modules/types'
import { partObjects, useParts } from '@/parts/registry'
import { useView } from '@/render/view'
import { useBuild } from '@/render/build'
import { buildHands, buildHint, buildTray } from '@/render/BuildController'
import { handlers, items, mirrorChange, useMirror, type Mirrored } from './mirror'
import { PANEL_H, PANEL_M, PANEL_W, drawPanel, hitAt, hitKey, type Hit, type PanelButton } from './panel'
import { useXRSession } from './session'
import { useHideEnclosed } from './hideEnclosed'

/**
 * A rig in the headset. On a Quest it sits on the student's real table (passthrough), at tabletop size,
 * with a turntable to spin it and a panel beside it carrying the rig's own controls and readings. Everything
 * is hands-first: pinch or poke the panel, pinch the turntable rim and drag to turn it, touch a part to
 * name it.
 *
 * How it is sized and placed: the rig is left exactly where it is in its own scene (so cuts, readings and
 * every rig's code work unchanged) and the player is moved instead. The XR origin is scaled up, which makes
 * the rig look small, and placed so the rig's base lands on the spot chosen on the table. Things that belong
 * to the room (the panel, the turntable, the placing ring) are children of the origin, in real metres.
 */

const local = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)

export const xrStore = createXRStore({
  offerSession: false,
  // on a developer's machine without a headset: an emulated Quest 3, with hands, for testing
  emulate: local && !(window as unknown as { __xrDevice?: unknown }).__xrDevice ? { type: 'metaQuest3', primaryInputMode: 'hand' } : false,
  hitTest: true,
  anchors: true,
  handTracking: true,
  frameRate: 'high',
  foveation: 1,
  hand: { teleportPointer: false },
  controller: { teleportPointer: false },
})

export async function enter(mode: 'ar' | 'vr') {
  await (mode === 'ar' ? xrStore.enterAR() : xrStore.enterVR())
}

/** a big machine's largest size as a table model, in metres */
const TABLE_SIZE = 0.5
/** larger than this (largest size, metres), a machine stands on the floor at real size rather than on the table */
const BIG = 1.3

/** where the rig is in the room (real metres, the headset's own frame): changed every frame while placing, so not React state */
const place = {
  /** the spot the rig's base sits on */
  at: new THREE.Vector3(0, 0.75, -0.55),
  /** the rig's turn about the vertical */
  turn: 0,
  /** which way the panel faces (towards where the student was when it was placed) */
  face: 0,
  /** where a big machine stands at real size, on the floor (null: worked out from the table spot) */
  floor: null as THREE.Vector3 | null,
  placingSince: 0,
}

/*
 * The first visit: three tips on the panel, each gone once it has been done (turn it, touch a part, take it
 * apart). Remembered on this headset, so later visits go straight to the rig.
 */
const GUIDE_KEY = 'solidify.xr.guided'
const guidedBefore = () => {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1'
  } catch {
    return false
  }
}
const TIPS = [
  { done: 'turned', text: 'Tip 1 of 3: pinch the green ring and drag to turn it' },
  { done: 'touched', text: 'Tip 2 of 3: point at a part and pinch to see what it is' },
  { done: 'apart', text: 'Tip 3 of 3: Take apart shows how it fits together' },
] as const

interface LabUi {
  placing: boolean
  /** standing on the floor at real size (a big machine); otherwise on the table */
  full: boolean
  /** too big for a table at real size (a tractor): on the floor, or as a table model */
  big: boolean
  /** the turntable's radius, metres in the room */
  ring: number
  /** what the student has tried, for the first-visit tips */
  tried: { turned: boolean; touched: boolean; apart: boolean }
  guided: boolean
  /** when the rig came back to the remembered spot (a note shows for a few seconds) */
  restoredAt: number
  /** a surface was found under the student's gaze */
  surface: boolean
  setPlacing: (v: boolean) => void
}
const useLab = create<LabUi>((set) => ({
  placing: true,
  tried: { turned: false, touched: false, apart: false },
  guided: guidedBefore(),
  restoredAt: 0,
  full: false,
  big: false,
  ring: 0.3,
  surface: false,
  setPlacing: (placing) => {
    if (placing) {
      place.placingSince = performance.now()
      anchorState.anchor = null
    }
    // put down by the student: remember the spot (made on the next frame, which has the pose)
    else anchorState.want = true
    set({ placing })
  },
}))

xrStore.subscribe((s, p) => {
  if (s.session === p.session) return
  const on = !!s.session
  useXRSession.setState({ active: on, mode: on ? (s.mode === 'immersive-ar' ? 'ar' : 'vr') : null })
  useMirror.getState().setOn(on)
  // in the headset the panel is to the right of the rig, so a build tray goes to the left
  buildTray.side = on ? -1 : 1
  buildTray.row = on ? 1.1 : 1.7
  buildTray.toward = on
  if (on) {
    // a big machine (a whole tractor) opens closed in a headset: drawing it cut open, insides and all, is
    // more than a headset can keep smooth; Cut opens it as usual
    let meshes = 0
    for (const o of partObjects.values()) o.traverse((m) => void ((m as THREE.Mesh).isMesh && meshes++))
    if (meshes > 250) useView.getState().setCut({ enabled: false })
    useLab.setState({ surface: false })
    useLab.getState().setPlacing(true)
    place.floor = null
    anchorState.anchor = null
    void restoreSpot(s.session as AnchorSession)
    useView.setState({ explode: 0 })
  }
})

export function XRLayer({ scene }: { scene: SceneDef }) {
  const active = useXRSession((s) => s.active)
  return <XR store={xrStore}>{active ? <Lab scene={scene} /> : null}</XR>
}

const UP = new THREE.Vector3(0, 1, 0)
/** when the panel or turntable was last pressed: that pinch is theirs, not a part's */
let uiPressedAt = 0

/*
 * The student's spot on their desk, remembered between visits with a persistent anchor (Quest keeps it tied
 * to the real room): next time any rig appears there at once, without placing. One spot for every rig.
 */
const SPOT_KEY = 'solidify.xr.spot'
type AnchorSession = XRSession & { restorePersistentAnchor?: (uuid: string) => Promise<XRAnchor>; deletePersistentAnchor?: (uuid: string) => Promise<void> }
type PersistentAnchor = XRAnchor & { requestPersistentHandle?: () => Promise<string> }
const readSpot = (): { uuid: string; face: number } | null => {
  try {
    return JSON.parse(localStorage.getItem(SPOT_KEY) ?? 'null')
  } catch {
    return null
  }
}
const anchorState: { anchor: XRAnchor | null; want: boolean; restoring: boolean } = { anchor: null, want: false, restoring: false }

/** after a session starts: the remembered spot, if the headset still knows it */
async function restoreSpot(session: AnchorSession) {
  const spot = readSpot()
  if (!spot || !session.restorePersistentAnchor) return
  anchorState.restoring = true
  try {
    anchorState.anchor = await session.restorePersistentAnchor(spot.uuid)
    place.face = spot.face
  } catch {
    // forgotten (another room, or cleared): place it again
    try {
      localStorage.removeItem(SPOT_KEY)
    } catch {
      /* storage off */
    }
  } finally {
    anchorState.restoring = false
  }
}

/** a new spot chosen: the old one is let go and this one remembered */
async function saveSpot(frame: XRFrame, space: XRReferenceSpace) {
  const session = frame.session as AnchorSession
  const old = readSpot()
  if (old && session.deletePersistentAnchor) await session.deletePersistentAnchor(old.uuid).catch(() => {})
  if (!frame.createAnchor) return
  const a = (await frame.createAnchor(new XRRigidTransform({ x: place.at.x, y: place.at.y, z: place.at.z }), space).catch(() => undefined)) as PersistentAnchor | undefined
  if (!a) return
  anchorState.anchor = a
  const uuid = await a.requestPersistentHandle?.().catch(() => undefined)
  if (!uuid) return
  try {
    localStorage.setItem(SPOT_KEY, JSON.stringify({ uuid, face: place.face }))
  } catch {
    /* storage off: it just isn't remembered */
  }
}

function Lab({ scene }: { scene: SceneDef }) {
  const origin = useRef<THREE.Group>(null)
  const roomThings = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Group>(null)
  const gl = useThree((s) => s.gl)
  const full = useLab((s) => s.full)
  const placing = useLab((s) => s.placing)
  const ar = useXRSession((s) => s.mode === 'ar')

  // the rig's base point in its own scene
  // sized and centred by the machine itself, not the scene round it: flat ground (a strip of soil, a floor
  // plate) doesn't count, so a tractor is as big on the table as a gearbox is
  const fit = useMemo(() => {
    const parts = useParts.getState().parts
    const boxes: THREE.Box3[] = []
    for (const p of Object.values(parts)) {
      if (p.parentId && parts[p.parentId]) continue
      const o = partObjects.get(p.id)
      if (!o) continue
      const b = new THREE.Box3().setFromObject(o)
      if (!b.isEmpty()) boxes.push(b)
    }
    const tallest = Math.max(0, ...boxes.map((b) => b.max.y - b.min.y))
    const box = new THREE.Box3()
    for (const b of boxes) if (b.max.y - b.min.y > tallest * 0.05) box.union(b)
    if (box.isEmpty()) return { size: Math.max(scene.extent, 0.05), foot: Math.max(scene.extent, 0.05), x: scene.camera.target[0], z: scene.camera.target[2] }
    const s = box.getSize(new THREE.Vector3())
    const c = box.getCenter(new THREE.Vector3())
    return { size: Math.max(s.x, s.y, s.z), foot: Math.max(s.x, s.z), x: c.x, z: c.z }
  }, [scene])
  // everything at its real size: on the table if it fits there, standing on the floor if not (a tractor);
  // a big machine can be made a table model to turn in the hands
  const big = fit.size > BIG
  useEffect(() => useLab.setState({ big, full: big }), [big])
  const base = useMemo(() => new THREE.Vector3(fit.x, scene.floorY ?? 0, fit.z), [fit, scene])
  const scale = big && !full ? fit.size / TABLE_SIZE : 1
  // the turntable just round the machine's footprint as it is shown
  const turntable = Math.max(0.16, (fit.foot / scale) * 0.5 * 1.18)
  useEffect(() => useLab.setState({ ring: turntable }), [turntable])

  // the parts nobody can see are not drawn while the machine is closed
  useHideEnclosed(true)

  // shadows cost too much on a headset; the page gets them back afterwards
  useEffect(() => {
    const was = gl.shadowMap.enabled
    gl.shadowMap.enabled = false
    return () => {
      gl.shadowMap.enabled = was
    }
  }, [gl])

  // the surface under the student's gaze, while placing
  const hit = useRef<THREE.Vector3 | null>(null)
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const tmp2 = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  useXRHitTest(
    (results, getWorldMatrix) => {
      const o = origin.current
      if (!o || !useLab.getState().placing) return
      // development: window.__xrNoHit ignores surfaces (a recording places things at the usual distance)
      if (import.meta.env.DEV && (window as unknown as { __xrNoHit?: boolean }).__xrNoHit) {
        hit.current = null
        return
      }
      let found = false
      for (const r of results) {
        if (!getWorldMatrix(m4, r)) continue
        m4.decompose(tmp, q, new THREE.Vector3())
        // a table or the floor: facing up
        if (new THREE.Vector3(0, 1, 0).applyQuaternion(q).dot(UP) < 0.85) continue
        o.updateMatrixWorld()
        hit.current = o.worldToLocal(tmp.clone())
        found = true
        break
      }
      if (!found) hit.current = null
      if (found !== useLab.getState().surface) useLab.setState({ surface: found })
    },
    'viewer',
  )

  // a pinch anywhere puts it down; once down, a pinch names the part the hand is pointing at (a natural pinch
  // is too slow to count as a click on the part itself)
  // only the part the hand was on when the pinch began: a pinch on a panel button that changes the scene
  // (Full size) must not pick whatever ends up under the hand when it lets go
  const pinchedOn = useRef<string | null>(null)
  const pinchedAt = useRef(0)
  useXRInputSourceEvent(
    'all',
    'selectstart',
    () => {
      pinchedOn.current = useView.getState().hoveredId
      pinchedAt.current = performance.now()
    },
    [],
  )
  useXRInputSourceEvent(
    'all',
    'select',
    () => {
      const lab = useLab.getState()
      if (lab.placing) {
        if (performance.now() - place.placingSince > 700) lab.setPlacing(false)
        return
      }
      const v = useView.getState()
      const onUi = uiPressedAt >= pinchedAt.current - 150
      if (!onUi && v.hoveredId && v.hoveredId === pinchedOn.current && !useBuild.getState().def) v.select(v.hoveredId)
      pinchedOn.current = null
    },
    [],
  )

  // development only: what each frame costs, for the headset speed budget
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __xrInfo?: unknown }).__xrInfo = gl.info
  }, [gl])
  const pinches = useRef(new Map<XRHandedness, { on: boolean; held: string | null }>())
  const head = useMemo(() => new THREE.Vector3(), [])
  const fwd = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }, _dt, frame?: XRFrame) => {
    const o = origin.current
    if (!o) return
    const space = gl.xr.getReferenceSpace()
    if (frame && space) {
      if (anchorState.want) {
        anchorState.want = false
        void saveSpot(frame, space)
      }
      // on the remembered (or just made) spot: follow it, as the headset refines where it is
      const a = anchorState.anchor
      const pose = a && frame.trackedAnchors?.has(a) ? frame.getPose(a.anchorSpace, space) : undefined
      if (pose) {
        place.at.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z)
        if (useLab.getState().placing) {
          // back where it was left: no placing needed
          useLab.setState({ placing: false, restoredAt: performance.now() })
        }
      }
      // building it by hand: thumb and index fingertip coming together on a loose part pick it up; it moves
      // with the fingers, and opening them lets it go (fitted if it is by its home)
      if (useBuild.getState().def && !useLab.getState().placing) {
        for (const src of frame.session.inputSources) {
          const hand = src.hand
          if (!hand || !frame.getJointPose) continue
          const it = hand.get('index-finger-tip')
          const th = hand.get('thumb-tip')
          const a = it && frame.getJointPose(it, space)
          const b = th && frame.getJointPose(th, space)
          if (!a || !b) continue
          const pa = a.transform.position
          const pb = b.transform.position
          const gap = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z)
          const st = pinches.current.get(src.handedness) ?? { on: false, held: null }
          pinches.current.set(src.handedness, st)
          o.updateMatrixWorld()
          const at = o.localToWorld(new THREE.Vector3((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, (pa.z + pb.z) / 2))
          if (!st.on && gap < 0.02) {
            st.on = true
            // within 2.5 cm of a part, in the room, counts as on it
            st.held = buildHands.grab?.(at, 0.025 * o.scale.x) ?? null
          } else if (st.on && gap > 0.04) {
            st.on = false
            if (st.held) buildHands.release?.(st.held)
            st.held = null
          } else if (st.on && st.held) buildHands.carry?.(st.held, at)
        }
      }
    }
    o.updateMatrixWorld()
    camera.getWorldPosition(head)
    o.worldToLocal(head)
    if (useLab.getState().placing) {
      camera.getWorldDirection(fwd)
      fwd.transformDirection(new THREE.Matrix4().copy(o.matrixWorld).invert())
      fwd.y = 0
      if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1)
      fwd.normalize()
      if (full) {
        // a big machine at real size: it stands where the student looks on the floor (or a little way off);
        // the panel comes to rest in front of them, within reach
        const onFloor = hit.current && hit.current.y < head.y - 0.9 ? hit.current : null
        const target = onFloor ? tmp.copy(onFloor).setY(0) : tmp.copy(head).addScaledVector(fwd, fit.size * 0.75 + 1.3).setY(0)
        if (!place.floor) place.floor = target.clone()
        place.floor.lerp(target, 0.35)
        // low, at desk height, so it never stands between the student and the machine
        tmp2.copy(head).addScaledVector(fwd, 0.45)
        tmp2.y = head.y - 0.62
        place.at.lerp(tmp2, 0.35)
      } else {
        // on the surface looked at, or far enough ahead to see it whole (half a metre for a small one), a
        // little below the eyes
        let target = hit.current
        if (!target) {
          target = tmp.copy(head).addScaledVector(fwd, Math.max(0.55, (fit.foot / scale) * 0.6 + 0.3))
          target.y = head.y - 0.42
        }
        place.at.lerp(target, 0.35)
      }
      place.face = Math.atan2(head.x - place.at.x, head.z - place.at.z)
    }
    // the origin, so the rig's base lands on the chosen spot, turned and scaled
    o.scale.setScalar(scale)
    o.rotation.set(0, place.turn, 0)
    // real size, on the floor: where it was put, or (coming from the table model) set back from the table by
    // its own size so the student sees it whole, with the panel still within reach
    if (full && !place.floor) place.floor = new THREE.Vector3(place.at.x - Math.sin(place.face) * (fit.size * 0.6 + 0.4), 0, place.at.z - Math.cos(place.face) * (fit.size * 0.6 + 0.4))
    const spot = full && place.floor ? place.floor : place.at
    o.position.copy(base).sub(tmp.copy(spot).applyAxisAngle(UP, place.turn).multiplyScalar(scale))
    if (roomThings.current) {
      roomThings.current.position.copy(place.at)
      roomThings.current.rotation.set(0, place.face, 0)
    }
    if (ring.current) {
      ring.current.visible = useLab.getState().placing
      // the placing mark: where the machine will stand (the floor spot for a big one), in the panel's frame
      if (full && place.floor) ring.current.position.copy(place.floor).sub(place.at).applyAxisAngle(UP, -place.face)
      else ring.current.position.set(0, 0, 0)
    }
  })

  // turning the rig: pinch (or poke) the turntable rim and drag round it
  const drag = useRef<{ id: number; last: number } | null>(null)
  const angleOf = (p: THREE.Vector3) => {
    const o = origin.current!
    o.updateMatrixWorld()
    const l = o.worldToLocal(p.clone()).sub(place.at)
    return Math.atan2(l.x, l.z)
  }
  const turnHandlers = {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      uiPressedAt = performance.now()
      ;(e.target as unknown as Element).setPointerCapture?.(e.pointerId)
      drag.current = { id: e.pointerId, last: angleOf(e.point) }
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const d = drag.current
      if (!d || d.id !== e.pointerId) return
      const a = angleOf(e.point)
      let da = a - d.last
      if (da > Math.PI) da -= Math.PI * 2
      if (da < -Math.PI) da += Math.PI * 2
      place.turn -= da
      if (!useLab.getState().tried.turned) useLab.setState((s) => ({ tried: { ...s.tried, turned: true } }))
      d.last = a
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      if (drag.current?.id === e.pointerId) drag.current = null
    },
  }

  return (
    <>
      {ar ? null : <color attach="background" args={['#0b0e0f']} />}
      <XROrigin ref={origin}>
        <group ref={roomThings}>
          {/* turntable: the rig's stage on the table */}
          {full ? null : (
            <group>
              <mesh rotation-x={-Math.PI / 2} position-y={-0.002} renderOrder={-1}>
                <circleGeometry args={[turntable, 64]} />
                <meshBasicMaterial color="#0c0f10" transparent opacity={ar ? 0.45 : 0.9} depthWrite={false} />
              </mesh>
              <mesh rotation-x={-Math.PI / 2} {...turnHandlers}>
                <torusGeometry args={[turntable, 0.014, 12, 96]} />
                <meshBasicMaterial color="#c6f24e" transparent opacity={0.85} />
              </mesh>
              {/* arrows on the rim: it turns */}
              {[0, Math.PI].map((a) => (
                <mesh key={a} position={[Math.sin(a) * turntable, 0.012, Math.cos(a) * turntable]} rotation={[0, a + Math.PI / 2, Math.PI / 2]}>
                  <coneGeometry args={[0.016, 0.04, 16]} />
                  <meshBasicMaterial color="#c6f24e" />
                </mesh>
              ))}
            </group>
          )}
          <group ref={ring}>
            <mesh rotation-x={-Math.PI / 2} position-y={0.003}>
              <ringGeometry args={[0.05, 0.065, 48]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
          <Panel scene={scene} placing={placing} />
        </group>
      </XROrigin>
    </>
  )
}

/**
 * The rig panel's own buttons (gear levers, Start test, mode pickers), which are not shared controls: read
 * from the page's panel, grouped by the label above them, and pressed for real when touched in the headset.
 */
function useDomButtons(active: boolean) {
  const els = useRef(new Map<string, HTMLButtonElement>())
  const [groups, setGroups] = useState<[string, Mirrored & { kind: 'segmented' }][]>([])
  const sig = useRef('')
  useEffect(() => {
    if (!active) return
    const read = () => {
      const root = document.querySelector('[data-xr-panel]')
      const out: [string, Mirrored & { kind: 'segmented' }][] = []
      els.current.clear()
      if (root) {
        const byParent = new Map<Element, HTMLButtonElement[]>()
        root.querySelectorAll('button').forEach((b) => {
          // shared controls (choices, switches) are already copied; skip disabled and empty ones
          if (b.disabled || b.getAttribute('role') === 'radio' || b.getAttribute('role') === 'switch') return
          if (!b.textContent?.trim() || b.offsetParent === null) return
          const p = b.parentElement!
          byParent.set(p, [...(byParent.get(p) ?? []), b])
        })
        let n = 0
        for (const [p, bs] of byParent) {
          const prev = p.previousElementSibling?.textContent?.trim() ?? ''
          const sectionTitle = p.closest('section')?.querySelector('h3')?.textContent?.trim() ?? ''
          const label = prev && prev.length <= 40 ? prev : sectionTitle
          // six to a row at most
          for (let i = 0; i < bs.length; i += 6) {
            const row = bs.slice(i, i + 6)
            const id = `dom:${n++}`
            const options = row.map((b, j) => {
              const key = `${id}:${j}`
              els.current.set(key, b)
              return { value: key, label: b.textContent!.trim().replace(/\s+/g, ' ') }
            })
            const on = row.findIndex(
              (b) => b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-checked') === 'true' || b.getAttribute('aria-selected') === 'true' || /(^|\s)bg-accent(\s|$)/.test(b.className),
            )
            out.push([id, { kind: 'segmented', label: i === 0 ? label : '', value: on >= 0 ? `${id}:${on}` : '', options }])
          }
        }
      }
      const s = JSON.stringify(out)
      if (s !== sig.current) {
        sig.current = s
        setGroups(out)
      }
    }
    read()
    const t = window.setInterval(read, 400)
    return () => window.clearInterval(t)
  }, [active])
  const press = (key: string) => els.current.get(key)?.click()
  return { groups, press }
}

/** the panel beside the rig */
function Panel({ scene, placing }: { scene: SceneDef; placing: boolean }) {
  const mesh = useRef<THREE.Mesh>(null)
  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = PANEL_W
    c.height = PANEL_H
    return c
  }, [])
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [canvas])
  useEffect(() => () => tex.dispose(), [tex])

  const [page, setPage] = useState(0)
  const [hover, setHover] = useState<string | null>(null)
  const dom = useDomButtons(!placing)
  const version = useMirror((s) => s.version)
  const playing = useSim((s) => s.playing)
  const selected = useView((s) => s.selectedId)
  const explode = useView((s) => s.explode)
  const xray = useView((s) => s.xray)
  const cutOn = useView((s) => s.cut.enabled)
  const preset = useView((s) => s.activePreset)
  const presets = useView((s) => s.cutPresets)
  const part = useParts((s) => (selected ? s.parts[selected] : undefined))
  const full = useLab((s) => s.full)
  const big = useLab((s) => s.big)
  const ring = useLab((s) => s.ring)
  const surface = useLab((s) => s.surface)
  const tried = useLab((s) => s.tried)
  const guided = useLab((s) => s.guided)
  const restoredAt = useLab((s) => s.restoredAt)
  const [, tick] = useState(0)
  // touching a part, and taking it apart, count as tried
  useEffect(() => {
    if (selected && !tried.touched) useLab.setState((s) => ({ tried: { ...s.tried, touched: true } }))
    if (explode > 0 && !tried.apart) useLab.setState((s) => ({ tried: { ...s.tried, apart: true } }))
  }, [selected, explode, tried])
  const tip = guided || placing ? null : TIPS.find((t) => !tried[t.done])
  // all three done: not shown again on this headset
  useEffect(() => {
    if (guided || placing || tip) return
    try {
      localStorage.setItem(GUIDE_KEY, '1')
    } catch {
      /* storage off: the tips show again next time */
    }
    useLab.setState({ guided: true })
  }, [guided, placing, tip])
  const restoredNote = restoredAt > 0 && performance.now() - restoredAt < 5000
  // the note goes after five seconds
  useEffect(() => {
    if (!restoredAt) return
    const t = window.setTimeout(() => tick((n) => n + 1), 5100)
    return () => window.clearTimeout(t)
  }, [restoredAt])
  const building = useBuild((s) => s.def)
  const fitted = useBuild((s) => s.placed.length)
  const buildMsg = useBuild((s) => s.message)

  const cutLabel = !cutOn ? 'Cut: off' : `Cut: ${presets.find((p) => p.id === preset)?.label.replace(/ (section|cut)$/i, '') ?? 'on'}`
  const buttons: PanelButton[][] = placing
    ? [[{ id: 'place', label: 'Put it here', primary: true }, { id: 'exit', label: 'Exit' }]]
    : building
      ? [
          [
            { id: 'hint', label: 'Hint' },
            { id: 'restart', label: 'Start over' },
            { id: 'stopbuild', label: 'Stop building' },
          ],
          [
            { id: 'move', label: 'Move' },
            { id: 'exit', label: 'Exit' },
          ],
        ]
      : [
        [
          { id: 'play', label: playing ? 'Pause' : 'Run', primary: !playing },
          { id: 'cut', label: cutLabel, on: cutOn },
          { id: 'apart', label: explode > 0 ? 'Put together' : 'Take apart', on: explode > 0 },
          { id: 'xray', label: 'X-ray', on: xray },
        ],
        [
          { id: 'move', label: 'Move' },
          ...(scene.build ? [{ id: 'build', label: 'Build it', primary: true }] : []),
          ...(big ? [{ id: 'size', label: full ? 'Table model' : 'Real size', on: !full }] : []),
          { id: 'reset', label: 'Reset' },
          { id: 'exit', label: 'Exit' },
        ],
      ]

  const hits = useRef<Hit[]>([])
  const pageCount = useRef(1)
  const dirty = useRef(true)
  const last = useRef(0)
  useEffect(() => {
    dirty.current = true
  }, [version, playing, selected, explode, xray, cutOn, preset, part, full, big, ring, surface, placing, page, hover, dom.groups, building, fitted, buildMsg, tip, restoredNote])
  useFrame(() => {
    const t = performance.now()
    if (!dirty.current || t - last.current < 66) return
    dirty.current = false
    last.current = t
    const g = canvas.getContext('2d')!
    const all = [...items.entries()]
    const drawnHint = placing
      ? full
        ? 'Look at the floor where it should stand, then pinch'
        : surface
          ? 'Pinch to put it on this surface'
          : 'Look at your table, then pinch'
      : building
        ? `${fitted}/${building.steps.length} · ${buildMsg?.text ?? 'Pinch a part on the table, put it where it goes'}`
        : restoredNote
          ? 'Back where you left it. Move puts it somewhere else'
          : (tip?.text ?? null)
    const drawn = drawPanel(g, {
      title: scene.title,
      hint: drawnHint,
      buttons,
      part: part ? { name: part.name, summary: part.info?.summary } : null,
      controls: [...dom.groups, ...all.filter(([, m]) => m.kind !== 'readout')],
      readouts: all.filter((e): e is [string, Mirrored & { kind: 'readout' }] => e[1].kind === 'readout'),
      page,
      hover,
    })
    hits.current = drawn.hits
    pageCount.current = drawn.pages
    // development only: where things are on the panel, for the headset tests
    if (import.meta.env.DEV) (window as unknown as { __xrPanel?: unknown }).__xrPanel = { hits: drawn.hits, mesh: mesh.current, hint: drawnHint, controls: [...dom.groups, ...all], ring, full }
    tex.needsUpdate = true
  })

  const act = (id: string) => {
    const v = useView.getState()
    if (id === 'place') useLab.getState().setPlacing(false)
    else if (id === 'exit') void xrStore.getState().session?.end()
    else if (id === 'play') useSim.getState().toggle()
    else if (id === 'apart') v.setExplode(v.explode > 0 ? 0 : 1)
    else if (id === 'xray') v.setXray(!v.xray)
    else if (id === 'move') useLab.getState().setPlacing(true)
    else if (id === 'reset') {
      v.resetView()
      place.turn = 0
    } else if (id === 'size') {
      place.floor = null
      useLab.setState((s) => ({ full: !s.full }))
    }
    else if (id === 'build' && scene.build) {
      if (useLab.getState().big) useLab.setState({ full: false })
      v.setExplode(0)
      useBuild.getState().start(scene.build)
    } else if (id === 'hint') {
      const d = useBuild.getState().def
      if (d) buildHint(d)
    } else if (id === 'restart') useBuild.getState().restart()
    else if (id === 'stopbuild') useBuild.getState().stop()
    else if (id === 'cut') {
      // off → each cut in turn → off
      const ids = v.cutPresets.map((p) => p.id)
      if (!v.cut.enabled) v.applyPreset(ids[0])
      else {
        const i = ids.indexOf(v.activePreset ?? '')
        if (i < 0 || i === ids.length - 1) v.setCut({ enabled: false })
        else v.applyPreset(ids[i + 1])
      }
    }
  }

  // a point on the panel, in canvas pixels
  const toPx = (p: THREE.Vector3) => {
    const l = mesh.current!.worldToLocal(p.clone())
    const h = (PANEL_M * PANEL_H) / PANEL_W
    return { x: (l.x / PANEL_M + 0.5) * PANEL_W, y: (0.5 - l.y / h) * PANEL_H }
  }
  const sliding = useRef<{ id: number; hit: Hit & { kind: 'slider' } } | null>(null)
  const lastTap = useRef(0)
  const setSlider = (h: Hit & { kind: 'slider' }, x: number) => {
    const f = Math.max(0, Math.min(1, (x - h.x) / h.w))
    const raw = h.min + f * (h.max - h.min)
    const v = h.step > 0 ? Math.round((raw - h.min) / h.step) * h.step + h.min : raw
    mirrorChange(h.id, Number(Math.min(h.max, Math.max(h.min, v)).toPrecision(10)))
  }

  const h = (PANEL_M * PANEL_H) / PANEL_W
  return (
    <mesh
      ref={mesh}
      position={[PANEL_M * 0.5 + (full ? 0.18 : ring + 0.05), 0.26, 0.02]}
      rotation={[-0.18, -0.42, 0, 'YXZ']}
      onPointerDown={(e) => {
        e.stopPropagation()
        uiPressedAt = performance.now()
        const { x, y } = toPx(e.point)
        const hit = hitAt(hits.current, x, y)
        if (!hit) return
        if (hit.kind === 'slider') {
          ;(e.target as unknown as Element).setPointerCapture?.(e.pointerId)
          sliding.current = { id: e.pointerId, hit }
          setSlider(hit, x)
          return
        }
        // a poke can bounce: one press per 300 ms
        const t = performance.now()
        if (t - lastTap.current < 300) return
        lastTap.current = t
        if (hit.kind === 'button') act(hit.id)
        else if (hit.kind === 'page') setPage((p) => Math.max(0, Math.min(pageCount.current - 1, p + hit.dir)))
        else if (hit.kind === 'option') hit.id.startsWith('dom:') ? dom.press(hit.value) : mirrorChange(hit.id, hit.value)
        else if (hit.kind === 'toggle' && handlers.has(hit.id)) mirrorChange(hit.id, !hit.checked)
        dirty.current = true
      }}
      onPointerMove={(e) => {
        // pointing at the panel: no part is under the hand
        if (useView.getState().hoveredId) useView.getState().hover(null)
        const { x, y } = toPx(e.point)
        const s = sliding.current
        if (s && s.id === e.pointerId) return setSlider(s.hit, x)
        const k = hitKey(hitAt(hits.current, x, y))
        if (k !== hover) setHover(k)
      }}
      onPointerUp={(e) => {
        if (sliding.current?.id === e.pointerId) sliding.current = null
      }}
      onPointerLeave={() => setHover(null)}
    >
      <planeGeometry args={[PANEL_M, h]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  )
}
