import { useEffect, useState } from 'react'
import { postponeUpdate, reloadNow, useAppUpdate } from './appUpdate'

/** "Solidify has been updated", with a countdown to the reload, Reload now and Not now */
export function UpdateNotice() {
  const { shown, due } = useAppUpdate()
  const [, tick] = useState(0)
  useEffect(() => {
    if (!due) return
    const t = window.setInterval(() => tick((n) => n + 1), 250)
    return () => window.clearInterval(t)
  }, [due])
  if (!shown) return null
  const left = due ? Math.max(1, Math.ceil((due - Date.now()) / 1000)) : null
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-5 z-[200] flex justify-center px-4">
      <div className="flex max-w-xl flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line-2 bg-panel px-4 py-3 shadow-2xl">
        <div className="min-w-0 flex-1 text-[13px]">
          <div className="font-semibold text-ink">Solidify has been updated</div>
          <div className="text-mute">{left ? `Reloading to the new version in ${left} s. Nothing you saved is lost.` : 'Reload to get the new version. Nothing you saved is lost.'}</div>
        </div>
        <div className="flex gap-2">
          {left ? (
            <button type="button" onClick={postponeUpdate} className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-mute hover:text-ink">
              Not now
            </button>
          ) : null}
          <button type="button" onClick={reloadNow} className="rounded-full bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-accent-ink hover:opacity-90">
            Reload now
          </button>
        </div>
      </div>
    </div>
  )
}
