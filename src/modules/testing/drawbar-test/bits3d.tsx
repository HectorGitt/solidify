import { Html } from '@react-three/drei'
import { useRef } from 'react'
import type * as THREE from 'three'
import { useSimFrame } from '@/core/sim'

/** Floating value tag; text and visibility set every frame by `get` (no React state per frame). */
export function LiveTag({ position, get }: { position: [number, number, number]; get: () => { text: string; warn?: boolean } | null }) {
  const g = useRef<THREE.Group>(null)
  const div = useRef<HTMLDivElement>(null)
  useSimFrame(() => {
    const v = get()
    if (!g.current || !div.current) return
    g.current.visible = !!v
    div.current.style.display = v ? '' : 'none'
    if (!v) return
    if (div.current.textContent !== v.text) div.current.textContent = v.text
    div.current.style.color = v.warn ? '#ff8a7a' : ''
  })
  return (
    <group ref={g} position={position}>
      <Html zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }} center>
        <div ref={div} className="part-label" style={{ whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace' }} />
      </Html>
    </group>
  )
}
