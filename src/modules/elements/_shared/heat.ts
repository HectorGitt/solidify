import { useMemo } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { cutPlanes } from '@/render/materials'
import { useView } from '@/render/view'

/** Map 0…1 to a heat-map colour: deep blue → teal → yellow → red. */
export function heatColor(t: number, out = new THREE.Color()) {
  const x = Math.max(0, Math.min(1, t))
  const stops: [number, number, number, number][] = [
    [0, 0.13, 0.25, 0.62],
    [0.35, 0.12, 0.62, 0.62],
    [0.65, 0.95, 0.82, 0.25],
    [1, 0.86, 0.2, 0.12],
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (x <= b[0]) {
      const u = (x - a[0]) / (b[0] - a[0])
      return out.setRGB(a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u)
    }
  }
  return out.setRGB(0.86, 0.2, 0.12)
}

/** CSS gradient matching heatColor, for legends. */
export const HEAT_CSS = 'linear-gradient(90deg, rgb(33,64,158), rgb(31,158,158), rgb(242,209,64), rgb(219,51,31))'

/** Write a per-vertex colour attribute from a scalar field 0…1 evaluated at each vertex. */
export function paintVertices(g: THREE.BufferGeometry, field: (p: THREE.Vector3) => number) {
  const pos = g.getAttribute('position')
  let col = g.getAttribute('color') as THREE.BufferAttribute | undefined
  if (!col || col.count !== pos.count) {
    col = new THREE.Float32BufferAttribute(new Float32Array(pos.count * 3), 3)
    g.setAttribute('color', col)
  }
  const p = new THREE.Vector3()
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    heatColor(field(p), c)
    col.setXYZ(i, c.r, c.g, c.b)
  }
  col.needsUpdate = true
  return g
}

/** Vertex-coloured material for heat maps; follows the section cut when `clip` is set. */
export function useHeatMaterial(clip = true, emissive = 0.25) {
  const m = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide })
    mat.onBeforeCompile = (shader) => {
      // a little self-illumination so the map reads in shadow
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * ${emissive.toFixed(2)};`)
    }
    if (clip) mat.clippingPlanes = cutPlanes
    return mat
  }, [clip, emissive])
  useSimFrame(() => {
    if (clip) m.clipIntersection = useView.getState().cut.intersection
  })
  return m
}
