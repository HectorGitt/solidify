import { useId } from 'react'

/**
 * The Solidify mark assembling itself: top, left and right faces land in turn, then the hatched
 * section sweeps across the cut face, on a loop. Motion stops under prefers-reduced-motion (the
 * global rule in index.css), leaving the finished mark.
 */
export function LoaderMark({ size = 44 }: { size?: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="solid-loader overflow-visible">
      <defs>
        <clipPath id={`${id}-r`}>
          <path d="M12 12 L20.66 7 L20.66 17 L12 22 Z" />
        </clipPath>
      </defs>
      <path className="sl-top" d="M12 2 L20.66 7 L12 12 L3.34 7 Z" fill="var(--color-ink)" />
      <path className="sl-left" d="M3.34 7 L12 12 L12 22 L3.34 17 Z" fill="var(--color-mute)" />
      <path className="sl-right" d="M12 12 L20.66 7 L20.66 17 L12 22 Z" fill="var(--color-accent)" />
      <g clipPath={`url(#${id}-r)`}>
        <g className="sl-hatch" stroke="var(--color-bg)" strokeWidth="1.1" opacity="0.55">
          {[-10, -6, -2, 2, 6, 10, 14].map((o) => (
            <line key={o} x1={8 + o} y1={24} x2={24 + o} y2={4} />
          ))}
        </g>
      </g>
    </svg>
  )
}

/** Centred loader with an optional caption, for scenes and pages. */
export function Loader({ label, size = 44, className = '' }: { label?: string; size?: number; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <LoaderMark size={size} />
      {label ? <p className="text-[12.5px] font-medium tracking-wide text-mute">{label}</p> : <span className="sr-only">Loading</span>}
    </div>
  )
}
