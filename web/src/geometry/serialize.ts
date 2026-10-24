import * as THREE from 'three'

/** Structured-clone-friendly form of a tree of BufferGeometries (functions are dropped). */
export type Packed = { __geo: { attrs: Record<string, { array: Float32Array; itemSize: number }>; index: Uint32Array | null } } | { [k: string]: Packed } | number | string | boolean | null

export function pack(value: unknown, transfers: Transferable[]): Packed {
  if (value instanceof THREE.BufferGeometry) {
    const attrs: Record<string, { array: Float32Array; itemSize: number }> = {}
    for (const [name, attr] of Object.entries(value.attributes)) {
      const a = attr as THREE.BufferAttribute
      const array = new Float32Array(a.array as ArrayLike<number>)
      attrs[name] = { array, itemSize: a.itemSize }
      transfers.push(array.buffer)
    }
    const index = value.index ? new Uint32Array(value.index.array as ArrayLike<number>) : null
    if (index) transfers.push(index.buffer)
    return { __geo: { attrs, index } }
  }
  if (value === null || typeof value !== 'object') return typeof value === 'function' ? null : (value as Packed)
  const out: Record<string, Packed> = {}
  for (const [k, v] of Object.entries(value)) if (typeof v !== 'function') out[k] = pack(v, transfers)
  return out
}

export function unpack<T>(p: Packed): T {
  if (p && typeof p === 'object' && '__geo' in p) {
    const g = new THREE.BufferGeometry()
    const { attrs, index } = (p as { __geo: { attrs: Record<string, { array: Float32Array; itemSize: number }>; index: Uint32Array | null } }).__geo
    for (const [name, a] of Object.entries(attrs)) g.setAttribute(name, new THREE.BufferAttribute(a.array, a.itemSize))
    if (index) g.setIndex(new THREE.BufferAttribute(index, 1))
    g.computeBoundingBox()
    g.computeBoundingSphere()
    return g as T
  }
  if (p === null || typeof p !== 'object') return p as T
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(p)) out[k] = unpack(v as Packed)
  return out as T
}
