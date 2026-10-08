import { useId } from 'react'

/**
 * Solidify mark: an isometric solid whose right face is a hatched section — a cutaway.
 */
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <clipPath id={`${id}-r`}>
          <path d="M12 12 L20.66 7 L20.66 17 L12 22 Z" />
        </clipPath>
      </defs>
      <path d="M12 2 L20.66 7 L12 12 L3.34 7 Z" fill="#e7eee9" />
      <path d="M3.34 7 L12 12 L12 22 L3.34 17 Z" fill="#7d8b83" />
      <path d="M12 12 L20.66 7 L20.66 17 L12 22 Z" fill="#9bd17a" />
      <g clipPath={`url(#${id}-r)`} stroke="#0c110f" strokeWidth="1.1" opacity="0.55">
        {[-6, -2, 2, 6, 10, 14].map((o) => (
          <line key={o} x1={8 + o} y1={24} x2={24 + o} y2={4} />
        ))}
      </g>
      <path d="M12 2 L20.66 7 L20.66 17 L12 22 L3.34 17 L3.34 7 Z M12 12 L12 22 M12 12 L3.34 7 M12 12 L20.66 7" fill="none" stroke="#0c110f" strokeWidth="0.9" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ size = 22, wordmark = true, className }: { size?: number; wordmark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <LogoMark size={size} />
      {wordmark ? <span className="text-[15px] font-semibold tracking-tight text-ink">Solidify</span> : null}
    </span>
  )
}
