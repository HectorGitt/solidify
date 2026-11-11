import { isValidElement, useEffect, useId, useRef, type ReactNode } from 'react'
import { create } from 'zustand'

/**
 * A copy of the controls a rig's panel is showing, for the panel in the headset. The page's panel keeps
 * rendering (hidden behind the headset view) and each shared control (Slider, Segmented, Toggle, Readout)
 * reports itself here while a session is on, so every rig's own controls appear in VR without a VR version
 * of each panel. Off (and costing nothing) the rest of the time.
 */
export type Mirrored =
  | { kind: 'slider'; label: string; value: number; min: number; max: number; step: number; unit?: string; digits: number }
  | { kind: 'segmented'; label: string; value: string; options: { value: string; label: string }[] }
  | { kind: 'toggle'; label: string; checked: boolean }
  | { kind: 'readout'; label: string; value: string; unit?: string; tone: string }

type Handler = (v: never) => void

interface MirrorState {
  on: boolean
  /** bumped when anything shown changes */
  version: number
  setOn: (on: boolean) => void
}

export const useMirror = create<MirrorState>((set) => ({
  on: false,
  version: 0,
  setOn: (on) => {
    if (!on) items.clear()
    set((s) => ({ on, version: s.version + 1 }))
  },
}))

/** in the order they first appeared (the panel's own order) */
export const items = new Map<string, Mirrored>()
/** latest change handlers; kept apart so a new closure on every render does not count as a change */
export const handlers = new Map<string, Handler>()

let pending = false
const bump = () => {
  if (pending) return
  pending = true
  queueMicrotask(() => {
    pending = false
    useMirror.setState((s) => ({ version: s.version + 1 }))
  })
}

const same = (a: Mirrored | undefined, b: Mirrored) => !!a && JSON.stringify(a) === JSON.stringify(b)

/** the words in a label or value, whatever elements wrap them */
export function nodeText(n: ReactNode): string {
  if (n == null || typeof n === 'boolean') return ''
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  if (Array.isArray(n)) return n.map(nodeText).join('')
  if (isValidElement(n)) return nodeText((n.props as { children?: ReactNode }).children)
  return ''
}

/** called by the shared controls: reports this one while a session is on */
export function useMirrored(item: Mirrored, onChange?: (v: never) => void) {
  const id = useId()
  const on = useMirror((s) => s.on)
  const latest = useRef(onChange)
  latest.current = onChange
  useEffect(() => {
    if (!on) return
    if (latest.current) handlers.set(id, latest.current as Handler)
    if (same(items.get(id), item)) return
    items.set(id, item)
    bump()
  })
  useEffect(() => {
    if (!on) return
    return () => {
      items.delete(id)
      handlers.delete(id)
      bump()
    }
  }, [on, id])
}

/** the panel in the headset changes a control as if it were moved on the page */
export function mirrorChange(id: string, v: unknown) {
  const h = handlers.get(id)
  if (h) (h as (v: unknown) => void)(v)
}
