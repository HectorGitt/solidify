import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})

export const Icon = {
  sun: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  moon: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  ),
  monitor: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  ),
  play:(p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M7 5v14l11-7z" fill="currentColor" stroke="none" />
    </svg>
  ),
  pause: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M8 5v14M16 5v14" strokeWidth={3} />
    </svg>
  ),
  step: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M6 5v14l9-7z" fill="currentColor" stroke="none" />
      <path d="M18 5v14" strokeWidth={2.4} />
    </svg>
  ),
  ruler: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M21 16.5V20H3V4h3.5v5.5m5.5-5.5V11m5.5-7v3.5" />
      <path d="M6.5 4v16" />
    </svg>
  ),
  cut: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M4 20 20 4" />
      <rect x="4" y="9" width="11" height="11" rx="1" />
      <path d="M7 17l5-5M7 13l2-2M11 17l2-2" strokeWidth={1.2} />
    </svg>
  ),
  explode: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M4 4l3 3M20 4l-3 3M4 20l3-3M20 20l-3-3" />
    </svg>
  ),
  xray: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <rect x="3" y="5" width="18" height="14" rx="2" strokeDasharray="3 2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  label: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M4 7h10l4 5-4 5H4z" />
    </svg>
  ),
  reset: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M4 4v6h6" />
      <path d="M20 12a8 8 0 1 1-2.3-5.7L20 9" transform="scale(-1,1) translate(-24,0)" />
    </svg>
  ),
  camera: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  ),
  eye: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.2 7.4C3.6 9.2 2 12 2 12s4 7 10 7c1.6 0 3-.4 4.3-1" />
    </svg>
  ),
  target: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  ),
  isolate: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <rect x="8" y="8" width="8" height="8" rx="1" />
      <path d="M3 3h4M3 3v4M21 3h-4M21 3v4M3 21h4M3 21v-4M21 21h-4M21 21v-4" />
    </svg>
  ),
  chevron: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  back: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  ),
  close: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  chat: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  ),
  tour: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M4 5h11l5 5-5 5H4z" />
      <path d="M4 19h8" />
    </svg>
  ),
  book: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5" />
    </svg>
  ),
  panel: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  ),
  sliders: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  ),
  build: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
      <path d="M8 9.5 12 3l4 6.5z" />
      <path d="M12 9.5V13" strokeDasharray="1.5 1.5" />
    </svg>
  ),
  wrench: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 8-8-1.3-1.3a4 4 0 0 0-5-5L14 5z" />
      <path d="M3 21l6-6" />
    </svg>
  ),
  bolt: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M13 3 5 14h6l-1 7 8-11h-6z" />
    </svg>
  ),
  trophy: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4" />
    </svg>
  ),
  check: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  tractor: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <circle cx="7" cy="16" r="4" />
      <circle cx="18" cy="17.5" r="2.5" />
      <path d="M4 11V6h7l2 5h5l2 4M11 11h2" />
    </svg>
  ),
  upload: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" />
    </svg>
  ),
  page: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  ),
  text: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M5 6h14M5 10h14M5 14h14M5 18h9" />
    </svg>
  ),
  select: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  ),
  thumbUp: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3zM7 11l4-7.5a2 2 0 0 1 2.7 1.9L13 10h5.4a2 2 0 0 1 2 2.4l-1.4 6A2 2 0 0 1 17 20H7" />
    </svg>
  ),
  thumbDown: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3zM17 13l-4 7.5a2 2 0 0 1-2.7-1.9L11 14H5.6a2 2 0 0 1-2-2.4l1.4-6A2 2 0 0 1 7 4h10" />
    </svg>
  ),
}
