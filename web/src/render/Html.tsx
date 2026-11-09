import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import * as THREE from 'three'

/**
 * A label in the 3D scene, drawn as page content over the canvas at a point (what drei's `Html` does, for the
 * simple case this app uses: a point, optionally centred on it, above or below other labels by distance).
 *
 * Why our own: drei 10's `Html` cleans up by taking its wrapper off the page and then unmounting the label's
 * React root straight away, in the middle of React removing the figure. React 19 defers that unmount, and it then
 * removes the label a second time from a wrapper that is already empty: "removeChild: not a child of this node",
 * after which a page could stop drawing its 3D figures (Read notes, switching documents). Here the label's root
 * is unmounted first, just after the current update, and only then is its wrapper taken off.
 */
export function Html({
  position = [0, 0, 0],
  center = false,
  className,
  style,
  zIndexRange = [16777271, 0],
  children,
}: {
  position?: [number, number, number] | THREE.Vector3
  center?: boolean
  className?: string
  style?: CSSProperties
  /** [nearest, furthest]: a nearer label is drawn above a further one */
  zIndexRange?: [number, number]
  children?: ReactNode
}) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const group = useRef<THREE.Group>(null)
  const [el] = useState(() => document.createElement('div'))
  const root = useRef<Root | null>(null)
  const target = gl.domElement.parentNode as HTMLElement | null

  useLayoutEffect(() => {
    const r = createRoot(el)
    root.current = r
    el.style.cssText = 'position:absolute;top:0;left:0;transform-origin:0 0;pointer-events:none;will-change:transform;'
    target?.appendChild(el)
    return () => {
      root.current = null
      // after this update: unmount the label, then take its wrapper off the page (never the other way round)
      queueMicrotask(() => {
        r.unmount()
        el.remove()
      })
    }
  }, [el, target])

  // the label itself, re-rendered with the component
  useLayoutEffect(() => {
    root.current?.render(
      <div className={className} style={{ position: 'absolute', transform: center ? 'translate3d(-50%,-50%,0)' : 'none', ...style }}>
        {children}
      </div>,
    )
  })

  const at = useRef(new THREE.Vector3())
  useFrame(() => {
    const g = group.current
    if (!g) return
    g.updateWorldMatrix(true, false)
    const p = at.current.setFromMatrixPosition(g.matrixWorld)
    const dist = camera.position.distanceTo(p)
    p.project(camera)
    // behind the camera or outside the view's depth: hidden
    const hidden = p.z < -1 || p.z > 1
    el.style.display = hidden ? 'none' : ''
    if (hidden) return
    el.style.transform = `translate3d(${((p.x + 1) / 2) * size.width}px,${((1 - p.y) / 2) * size.height}px,0)`
    const far = 'far' in camera ? (camera as THREE.PerspectiveCamera).far || 1000 : 1000
    const t = Math.min(1, Math.max(0, dist / far))
    el.style.zIndex = String(Math.round(zIndexRange[0] + (zIndexRange[1] - zIndexRange[0]) * t))
  })

  return <group ref={group} position={position} />
}
