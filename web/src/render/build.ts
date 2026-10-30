import * as THREE from 'three'
import { create } from 'zustand'

/**
 * Build mode: put a machine together from its loose parts. The parts start on a tray beside an empty
 * base; drag one to where it goes (or tap it) and it snaps home if everything it sits on is already in.
 * A scene opts in with SceneDef.build. The geometry side lives in BuildController (inside the canvas)
 * and Part (which moves each loose part to the place the controller gives it).
 */

export interface BuildStep {
  /** part id: the part and everything nested in it go in as one piece */
  id: string
  /** parts that must already be in */
  needs?: string[]
  /** why it can't go in yet, shown when it's tried too early */
  why?: string
}

export interface BuildDef {
  steps: BuildStep[]
  /** parts that only appear once it's assembled (oil, coolant, gas) */
  hideUntilBuilt?: string[]
  /** what the finished machine is called in messages */
  noun?: string
}

export type BuildMessage = { kind: 'ok' | 'no' | 'hint' | 'done'; text: string; detail?: string; at: number }

interface BuildState {
  def: BuildDef | null
  placed: string[]
  held: string | null
  /** a part the hint is pointing at */
  hinted: string | null
  message: BuildMessage | null
  startedAt: number
  finishedAt: number | null
  wrong: number
  hints: number
  /** bumped to make the controller lay the tray out again */
  layout: number
  start: (def: BuildDef) => void
  stop: () => void
  restart: () => void
  hold: (id: string | null) => void
  place: (id: string, text: string, detail?: string) => void
  reject: (text: string) => void
  hint: (id: string | null, text: string) => void
  say: (m: Omit<BuildMessage, 'at'>) => void
}

export const useBuild = create<BuildState>((set, get) => ({
  def: null,
  placed: [],
  held: null,
  hinted: null,
  message: null,
  startedAt: 0,
  finishedAt: null,
  wrong: 0,
  hints: 0,
  layout: 0,
  start: (def) => set({ def, placed: [], held: null, hinted: null, message: null, startedAt: performance.now(), finishedAt: null, wrong: 0, hints: 0, layout: get().layout + 1 }),
  stop: () => set({ def: null, placed: [], held: null, hinted: null, message: null, finishedAt: null }),
  restart: () => {
    const d = get().def
    if (d) get().start(d)
  },
  hold: (held) => set({ held, hinted: held ? null : get().hinted }),
  place: (id, text, detail) => {
    const s = get()
    if (!s.def || s.placed.includes(id)) return
    const placed = [...s.placed, id]
    const done = placed.length === s.def.steps.length
    set({ placed, held: null, hinted: null, finishedAt: done ? performance.now() : null, message: { kind: done ? 'done' : 'ok', text, detail, at: performance.now() } })
  },
  reject: (text) => set((s) => ({ held: null, wrong: s.wrong + 1, message: { kind: 'no', text, at: performance.now() } })),
  hint: (hinted, text) => set((s) => ({ hinted, hints: s.hints + 1, message: { kind: 'hint', text, at: performance.now() } })),
  say: (m) => set({ message: { ...m, at: performance.now() } }),
}))

/** the steps that can go in now */
export function nextSteps(def: BuildDef, placed: string[]) {
  return def.steps.filter((s) => !placed.includes(s.id) && (s.needs ?? []).every((n) => placed.includes(n)))
}

/**
 * Where each loose part should be, as a world-space offset from its home (zero once it's in). Written
 * by BuildController every frame, read by Part. Not React state: it changes every frame.
 */
export const buildOffsets = new Map<string, THREE.Vector3>()
/** parts the controller is driving right now (held parts follow the pointer without easing) */
export const buildSnappy = new Set<string>()
