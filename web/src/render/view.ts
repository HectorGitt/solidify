import { create } from 'zustand'

/**
 * A cut plane is described by the direction pointing INTO the material that gets removed
 * and its position along that direction: everything with n·p > pos is cut away.
 */
export interface CutPlaneDef {
  normal: [number, number, number]
  pos: number
}

export interface CutState {
  enabled: boolean
  planes: CutPlaneDef[]
  /** true: remove only where ALL planes cut (quarter/wedge cut). false: remove where ANY plane cuts. */
  intersection: boolean
  /** also section moving parts (pistons, shafts, gears). Off = museum-style cutaway. */
  sectionMoving: boolean
}

export interface CutPreset {
  id: string
  label: string
  planes: CutPlaneDef[]
  intersection?: boolean
  sectionMoving?: boolean
}

export const DEFAULT_CUT_PRESETS: CutPreset[] = [
  { id: 'half', label: 'Half section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
  { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: 0 }], intersection: true },
  { id: 'side', label: 'Side section', planes: [{ normal: [1, 0, 0], pos: 0 }] },
  { id: 'plan', label: 'Plan section', planes: [{ normal: [0, 1, 0], pos: 0 }] },
]

export interface ViewState {
  selectedId: string | null
  hoveredId: string | null
  isolatedId: string | null
  hidden: string[]
  explode: number
  /** explode only this part's sub-parts (null = the whole scene) */
  explodeScope: string | null
  /** with a scope: how many levels below it move (null = all) */
  explodeDepth: number | null
  setExplodeDepth: (d: number | null) => void
  setExplodeScope: (id: string | null) => void
  xray: boolean
  /** tint every part that has known common faults */
  faultMode: boolean
  /** colour parts by the system they belong to (Part `tint`) */
  tints: boolean
  setTints: (v: boolean) => void
  setFaultMode: (v: boolean) => void
  /** Viewport lighting & background preset */
  studioMode: 'dark' | 'workshop' | 'blueprint'
  setStudioMode: (mode: 'dark' | 'workshop' | 'blueprint') => void
  labels: boolean
  caliperMode: boolean
  caliperPoints: [number, number, number][]
  cut: CutState
  cutPresets: CutPreset[]
  activePreset: string | null
  /** draw the cut-plane outlines (while the section menu is open) */
  showPlanes: boolean
  setCaliperMode: (v: boolean) => void
  setCaliperPoints: (pts: [number, number, number][]) => void
  setShowPlanes: (v: boolean) => void
  select: (id: string | null) => void
  hover: (id: string | null) => void
  isolate: (id: string | null) => void
  toggleHidden: (id: string) => void
  showAll: () => void
  setExplode: (v: number) => void
  setXray: (v: boolean) => void
  setLabels: (v: boolean) => void
  setCut: (patch: Partial<CutState>) => void
  setPlane: (i: number, patch: Partial<CutPlaneDef>) => void
  applyPreset: (id: string) => void
  setPresets: (p: CutPreset[]) => void
  resetView: () => void
}

const initialCut: CutState = {
  enabled: true,
  planes: DEFAULT_CUT_PRESETS[0].planes,
  intersection: false,
  sectionMoving: false,
}

export const useView = create<ViewState>((set, get) => ({
  selectedId: null,
  hoveredId: null,
  isolatedId: null,
  hidden: [],
  explode: 0,
  explodeScope: null,
  explodeDepth: null,
  setExplodeDepth: (explodeDepth) => set({ explodeDepth }),
  setExplodeScope: (explodeScope) => set({ explodeScope }),
  xray: false,
  labels: false,
  caliperMode: false,
  caliperPoints: [],
  cut: initialCut,
  cutPresets: DEFAULT_CUT_PRESETS,
  activePreset: 'half',
  showPlanes: false,
  setCaliperMode: (caliperMode) => set({ caliperMode, caliperPoints: [] }),
  setCaliperPoints: (caliperPoints) => set({ caliperPoints }),
  setShowPlanes: (showPlanes) => set({ showPlanes }),
  select: (selectedId) => set({ selectedId }),
  hover: (hoveredId) => set({ hoveredId }),
  isolate: (isolatedId) => set({ isolatedId }),
  toggleHidden: (id) => set((s) => ({ hidden: s.hidden.includes(id) ? s.hidden.filter((h) => h !== id) : [...s.hidden, id] })),
  showAll: () => set({ hidden: [], isolatedId: null }),
  setExplode: (explode) => set({ explode }),
  setXray: (xray) => set({ xray }),
  faultMode: false,
  tints: false,
  studioMode: 'dark',
  setTints: (tints) => set({ tints }),
  setFaultMode: (faultMode) => set({ faultMode }),
  setStudioMode: (studioMode) => set({ studioMode }),
  setLabels: (labels) => set({ labels }),
  setCut: (patch) => set((s) => ({ cut: { ...s.cut, ...patch } })),
  setPlane: (i, patch) =>
    set((s) => ({
      activePreset: null,
      cut: { ...s.cut, planes: s.cut.planes.map((p, j) => (j === i ? { ...p, ...patch } : p)) },
    })),
  applyPreset: (id) => {
    const p = get().cutPresets.find((x) => x.id === id)
    if (!p) return
    set((s) => ({
      activePreset: id,
      cut: {
        ...s.cut,
        enabled: true,
        planes: p.planes.map((pl) => ({ normal: [...pl.normal] as [number, number, number], pos: pl.pos })),
        intersection: p.intersection ?? false,
        sectionMoving: p.sectionMoving ?? s.cut.sectionMoving,
      },
    }))
  },
  setPresets: (cutPresets) => set({ cutPresets }),
  resetView: () =>
    set({
      selectedId: null,
      hoveredId: null,
      isolatedId: null,
      hidden: [],
      explode: 0,
      explodeScope: null,
      explodeDepth: null,
      xray: false,
      tints: false,
      cut: initialCut,
      activePreset: 'half',
    }),
}))

/** Is world point p kept (not cut away) under the current cut? */
export function isKept(p: { x: number; y: number; z: number }, cut: CutState) {
  if (!cut.enabled || cut.planes.length === 0) return true
  const removedBy = cut.planes.map((pl) => pl.normal[0] * p.x + pl.normal[1] * p.y + pl.normal[2] * p.z > pl.pos)
  return cut.intersection ? !removedBy.every(Boolean) : !removedBy.some(Boolean)
}
