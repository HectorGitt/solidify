import { useEffect } from 'react'
import { checkXRSupport, enterXR, useXRSession } from './session'

/**
 * "On your table" (passthrough) or "In VR": shown only on a headset (or the emulator on a developer's
 * machine). `what` names the thing in its tooltip: this rig, this model, this question.
 */
export function HeadsetButton({ what = 'this rig', disabled = false, className = '' }: { what?: string; disabled?: boolean; className?: string }) {
  const supported = useXRSession((s) => s.supported)
  useEffect(() => void checkXRSupport(), [])
  if (!supported) return null
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void enterXR()}
      className={`flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[12.5px] font-semibold text-accent-ink hover:brightness-110 disabled:opacity-50 ${className}`}
      title={supported === 'ar' ? `Put ${what} on your real table, and work it with your hands` : `Open ${what} in VR, and work it with your hands`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3.5l-2-2.5h-3l-2 2.5H5a2 2 0 0 1-2-2z" />
        <circle cx="8" cy="11.5" r="1.5" />
        <circle cx="16" cy="11.5" r="1.5" />
      </svg>
      <span>{supported === 'ar' ? 'On your table' : 'In VR'}</span>
    </button>
  )
}
