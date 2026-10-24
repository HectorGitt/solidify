import { useEffect, type ReactNode } from 'react'
import { Icon } from '@/ui/icons'

/** Centered dialog in the app's style; closes on Escape and backdrop click. */
export function Modal({ open, onClose, title, children, width = 420 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-black/55 p-4 pt-[10vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full overflow-hidden rounded-xl border border-line-2 bg-panel shadow-2xl"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[14.5px] font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-md text-mute hover:bg-panel-3 hover:text-ink">
            <Icon.close width={15} height={15} />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[12px] font-medium text-mute">{label}</span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full rounded-md border border-line-2 bg-panel-2 px-3 py-2 text-[13.5px] text-ink outline-none placeholder:text-dim focus:border-accent/60 focus:ring-2 focus:ring-accent/15'

export const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-md bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'

export const ghostBtn =
  'inline-flex items-center justify-center gap-2 rounded-md border border-line-2 bg-panel-2 px-3.5 py-2 text-[13px] font-medium text-ink/90 transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50'

export function Notice({ tone = 'mute', children }: { tone?: 'mute' | 'warn' | 'ok'; children: ReactNode }) {
  const cls = { mute: 'border-line-2 text-mute', warn: 'border-warn/40 bg-warn/10 text-warn', ok: 'border-accent/40 bg-accent/10 text-accent' }[tone]
  return <p className={`rounded-md border px-3 py-2 text-[12.5px] leading-snug ${cls}`}>{children}</p>
}
