import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { XR, XROrigin, createXRStore, useXRHitTest, useXRInputSourceEvent } from '@react-three/xr'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { useSim } from '@/core/sim'
import type { SceneDef } from '@/modules/types'
import { useParts } from '@/parts/registry'
import { useView } from '@/render/view'
import { handlers, items, mirrorChange, useMirror, type Mirrored } from './mirror'
import { PANEL_H, PANEL_M, PANEL_W, drawPanel, hitAt, hitKey, type Hit, type PanelButton } from './panel'
import { useXRSession } from './session'

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
  handTracking: true,
  frameRate: 'high',
  foveation: 1,
  hand: { teleportPointer: false },
  controller: { teleportPointer: false },
})

export async function enter(mode: 'ar' | 'vr') {
  await (mode === 'ar' ? xrStore.enterAR() : xrStore.enterVR())
}

/** how wide the rig is made on the table, in metres */
const TABLE_SIZE = 0.42

/** where the rig is in the room (real metres, the headset's own frame): changed every frame while placing, so not React state */
const place = {
  /** the spot the rig's base sits on */
  at: new THREE.Vector3(0, 0.75, -0.55),
  /** the rig's turn about the vertical */
  turn: 0,
  /** which way the panel faces (towards where the student was when it was placed) */
  face: 0,
  placingSince: 0,
}

interface LabUi {
  placing: boolean
  full: boolean
  /** a surface was found under the student's gaze */
  surface: boolean
  setPlacing: (v: boolean) => void
}
const useLab = create<LabUi>((set) => ({
  placing: true,
  full: false,
  surface: false,
  setPlacing: (placing) => {
    if (placing) place.placingSince = performance.now()
    set({ placing })
  },
}))

xrStore.subscribe((s, p) => {
  if (s.session === p.session) return
  const on = !!s.session
  useXRSession.setState({ active: on, mode: on ? (s.mode === 'immersive-ar' ? 'ar' : 'vr') : null })
  useMirror.getState().setOn(on)
  if (on) {
    useLab.setState({ full: false, surface: false })
    useLab.getState().setPlacing(true)
    useView.setState({ explode: 0 })
  }
})

export function XRLayer({ scene }: { scene: SceneDef }) {
  const active = useXRSession((s) => s.active)
  return <XR store={xrStore}>{active ? <Lab scene={scene} /> : null}</XR>
}

const UP = new THREE.Vector3(0, 1, 0)

function Lab({ scene }: { scene: SceneDef }) {
  const origin = useRef<THREE.Group>(null)
  const roomThings = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Group>(null)
  const gl = useThree((s) => s.gl)
  const full = useLab((s) => s.full)
  const placing = useLab((s) => s.placing)
  const ar = useXRSession((s) => s.mode === 'ar')

  // the rig's base point in its own scene
  const base = useMemo(() => new THREE.Vector3(scene.camera.target[0], scene.floorY ?? 0, scene.camera.target[2]), [scene])
  const scale = full ? 1 : Math.max(scene.extent, 0.05) / TABLE_SIZE

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
  const q = useMemo(() => new THREE.Quaternion(), [])
  useXRHitTest(
    (results, getWorldMatrix) => {
      const o = origin.current
      if (!o || !useLab.getState().placing) return
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

  // a pinch anywhere puts it down
  useXRInputSourceEvent(
    'all',
    'select',
    () => {
      if (useLab.getState().placing && performance.now() - place.placingSince > 700) useLab.getState().setPlacing(false)
    },
    [],
  )

  const head = useMemo(() => new THREE.Vector3(), [])
  const fwd = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    const o = origin.current
    if (!o) return
    o.updateMatrixWorld()
    camera.getWorldPosition(head)
    o.worldToLocal(head)
    if (useLab.getState().placing) {
      // follow the gaze: on the surface looked at, or half a metre ahead and a little below the eyes
      let target = hit.current
      if (!target) {
        camera.getWorldDirection(fwd)
        fwd.transformDirection(new THREE.Matrix4().copy(o.matrixWorld).invert())
        fwd.y = 0
        if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1)
        fwd.normalize()
        target = tmp.copy(head).addScaledVector(fwd, 0.55)
        target.y = head.y - 0.42
      }
      place.at.lerp(target, 0.35)
      place.face = Math.atan2(head.x - place.at.x, head.z - place.at.z)
    }
    // the origin, so the rig's base lands on the chosen spot, turned and scaled
    o.scale.setScalar(scale)
    o.rotation.set(0, place.turn, 0)
    o.position.copy(base).sub(tmp.copy(place.at).applyAxisAngle(UP, place.turn).multiplyScalar(scale))
    if (roomThings.current) {
      roomThings.current.position.copy(place.at)
      roomThings.current.rotation.set(0, place.face, 0)
    }
    if (ring.current) ring.current.visible = useLab.getState().placing
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
                <circleGeometry args={[TABLE_SIZE * 0.62, 64]} />
                <meshBasicMaterial color="#0c0f10" transparent opacity={ar ? 0.45 : 0.9} depthWrite={false} />
              </mesh>
              <mesh rotation-x={-Math.PI / 2} {...turnHandlers}>
                <torusGeometry args={[TABLE_SIZE * 0.62, 0.014, 12, 96]} />
                <meshBasicMaterial color="#c6f24e" transparent opacity={0.85} />
              </mesh>
              {/* arrows on the rim: it turns */}
              {[0, Math.PI].map((a) => (
                <mesh key={a} position={[Math.sin(a) * TABLE_SIZE * 0.62, 0.012, Math.cos(a) * TABLE_SIZE * 0.62]} rotation={[0, a + Math.PI / 2, Math.PI / 2]}>
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
  const surface = useLab((s) => s.surface)

  const cutLabel = !cutOn ? 'Cut: off' : `Cut: ${presets.find((p) => p.id === preset)?.label.replace(/ (section|cut)$/i, '') ?? 'on'}`
  const buttons: PanelButton[][] = placing
    ? [[{ id: 'place', label: 'Put it here', primary: true }, { id: 'exit', label: 'Exit' }]]
    : [
        [
          { id: 'play', label: playing ? 'Pause' : 'Run', primary: !playing },
          { id: 'cut', label: cutLabel, on: cutOn },
          { id: 'apart', label: explode > 0 ? 'Put together' : 'Take apart', on: explode > 0 },
          { id: 'xray', label: 'X-ray', on: xray },
        ],
        [
          { id: 'move', label: 'Move' },
          { id: 'size', label: full ? 'Table size' : 'Full size', on: full },
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
  }, [version, playing, selected, explode, xray, cutOn, preset, part, full, surface, placing, page, hover, dom.groups])
  useFrame(() => {
    const t = performance.now()
    if (!dirty.current || t - last.current < 66) return
    dirty.current = false
    last.current = t
    const g = canvas.getContext('2d')!
    const all = [...items.entries()]
    const drawn = drawPanel(g, {
      title: scene.title,
      hint: placing ? (surface ? 'Pinch to put it on this surface' : 'Look at your table, then pinch') : null,
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
    if (import.meta.env.DEV) (window as unknown as { __xrPanel?: unknown }).__xrPanel = { hits: drawn.hits, mesh: mesh.current }
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
    } else if (id === 'size') useLab.setState((s) => ({ full: !s.full }))
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
      position={[PANEL_M * 0.5 + TABLE_SIZE * 0.55, 0.26, 0.02]}
      rotation={[-0.18, -0.42, 0, 'YXZ']}
      onPointerDown={(e) => {
        e.stopPropagation()
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
