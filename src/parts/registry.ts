import type * as THREE from 'three'
import { create } from 'zustand'
import type { Citation } from '@/content/citations'
import type { MaterialKey } from '@/render/materials'

/**
 * housing: stationary structure (sectioned by default)
 * moving:  pistons, shafts, gears… (left whole in museum-style cutaways)
 * fluid:   oil, coolant, gas volumes
 * static:  stationary internal parts that are sectioned with the housing
 */
export type PartRole = 'housing' | 'moving' | 'fluid' | 'static'

export interface PartInfo {
  /** one-line description */
  summary?: string
  /** what it does (function) */
  role?: string
  /** longer notes, construction, materials */
  details?: string
}

export interface PartMeta {
  id: string
  name: string
  parentId: string | null
  material?: MaterialKey
  role: PartRole
  info?: PartInfo
  cites?: Citation[]
  beyondNotes?: boolean
  order: number
}

interface Registry {
  parts: Record<string, PartMeta>
  register: (meta: PartMeta) => void
  unregister: (id: string) => void
}

let orderCounter = 0
export const nextOrder = () => orderCounter++

export const useParts = create<Registry>((set) => ({
  parts: {},
  register: (meta) => set((s) => ({ parts: { ...s.parts, [meta.id]: meta } })),
  unregister: (id) =>
    set((s) => {
      const next = { ...s.parts }
      delete next[id]
      return { parts: next }
    }),
}))

/** Non-reactive map from part id to its root object (for focus/fit-to-box). */
export const partObjects = new Map<string, THREE.Object3D>()

export interface PartNode extends PartMeta {
  children: PartNode[]
}

export function buildTree(parts: Record<string, PartMeta>): PartNode[] {
  const nodes = new Map<string, PartNode>()
  for (const p of Object.values(parts)) nodes.set(p.id, { ...p, children: [] })
  const roots: PartNode[] = []
  for (const n of nodes.values()) {
    const parent = n.parentId ? nodes.get(n.parentId) : undefined
    if (parent) parent.children.push(n)
    else roots.push(n)
  }
  const sort = (arr: PartNode[]) => {
    arr.sort((a, b) => a.order - b.order)
    arr.forEach((c) => sort(c.children))
  }
  sort(roots)
  return roots
}
