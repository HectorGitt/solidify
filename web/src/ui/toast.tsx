import { useEffect } from 'react'
import { create } from 'zustand'
import { Icon } from './icons'

export interface ToastAction {
  label: string
  run: () => void
}

interface ToastItem {
  id: number
  message: string
  tone: 'info' | 'warn' | 'ok'
  action?: ToastAction
}

interface ToastState {
  items: ToastItem[]
  push: (t: Omit<ToastItem, 'id'>) => void
  dismiss: (id: number) => void
}

let seq = 1

const useToasts = create<ToastState>((set) => ({
  items: [],
  // the same message twice in a row is shown once
  push: (t) => set((s) => ({ items: [...s.items.filter((i) => i.message !== t.message), { ...t, id: seq++ }].slice(-3) })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}))

/** shows a short message in the corner of the screen, with an optional action */
export function toast(message: string, opts: { tone?: ToastItem['tone']; action?: ToastAction } = {}) {
  useToasts.getState().push({ message, tone: opts.tone ?? 'info', action: opts.action })
}

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToasts((s) => s.dismiss)
  useEffect(() => {
    // messages with an action stay a little longer, so there is time to use it
    const t = setTimeout(() => dismiss(item.id), item.action ? 9000 : 6000)
    return () => clearTimeout(t)
  }, [item.id, item.action, dismiss])
  const dot = { info: 'bg-mute', warn: 'bg-warn', ok: 'bg-accent' }[item.tone]
  return (
    <div
      role={item.tone === 'warn' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-line bg-panel px-4 py-3 text-[13px] text-ink shadow-xl sm:w-[380px]"
    >
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <p className="flex-1 leading-snug">{item.message}</p>
      {item.action ? (
        <button
          type="button"
          onClick={() => {
            item.action?.run()
            dismiss(item.id)
          }}
          className="shrink-0 rounded-full bg-ink px-3 py-1 text-[12px] font-medium text-bg hover:opacity-90"
        >
          {item.action.label}
        </button>
      ) : null}
      <button type="button" aria-label="Dismiss" onClick={() => dismiss(item.id)} className="shrink-0 text-dim hover:text-ink">
        <Icon.close width={14} height={14} />
      </button>
    </div>
  )
}

/** mounted once at the app root */
export function Toaster() {
  const items = useToasts((s) => s.items)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:right-5">
      {items.map((i) => (
        <ToastCard key={i.id} item={i} />
      ))}
    </div>
  )
}
