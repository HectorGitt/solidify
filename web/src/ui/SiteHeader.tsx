import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AccountMenu } from '@/cloud/ui/AccountMenu'
import { useAcademic } from '@/ui/audience'
import { AudienceSwitch } from '@/ui/AudienceSwitch'
import { Icon } from '@/ui/icons'
import { Logo } from '@/ui/Logo'
import { ThemeToggle } from '@/ui/ThemeToggle'

interface NavItem {
  to: string
  label: string
}

/** the main tools, the same on every page */
const MAIN: NavItem[] = [
  { to: '/', label: 'Labs' },
  { to: '/create', label: 'Create in 3D' },
  { to: '/read', label: 'Read notes in 3D' },
  { to: '/challenges', label: 'Challenges' },
]

/** study tools, shown in Academic mode */
const STUDY: NavItem[] = [
  { to: '/exam', label: 'Exam practice' },
  { to: '/progress', label: 'Progress' },
  { to: '/formulas', label: 'Formula sheet' },
  { to: '/classes', label: 'Classes' },
]

const pill = (active: boolean) =>
  `whitespace-nowrap rounded-full px-3.5 py-1.5 transition-colors ${active ? 'bg-ink text-bg' : 'text-mute hover:bg-ink/[0.06] hover:text-ink'}`

/** closes a popover on an outside click, Escape or a route change */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  useEffect(() => close(), [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close])
  return ref
}

function StudyMenu() {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const { pathname } = useLocation()
  const active = STUDY.some((s) => pathname.startsWith(s.to))
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)} className={`${pill(active)} inline-flex items-center gap-1`}>
        Study
        <Icon.chevron width={12} height={12} className={`transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>
      {open ? (
        <div role="menu" className="absolute left-0 top-full z-50 mt-2 w-48 rounded-2xl border border-line bg-panel p-1.5 shadow-xl">
          {STUDY.map((s) => (
            <NavLink key={s.to} role="menuitem" to={s.to} className={({ isActive }) => `block rounded-xl px-3 py-2 text-[13px] ${isActive ? 'bg-ink text-bg' : 'text-ink hover:bg-panel-2'}`}>
              {s.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** below laptop width every link folds into one menu, so the header never wraps */
function MobileMenu({ academic }: { academic: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const link = ({ isActive }: { isActive: boolean }) => `block rounded-xl px-3 py-2 text-[13.5px] ${isActive ? 'bg-ink text-bg' : 'text-ink hover:bg-panel-2'}`
  return (
    <div ref={ref} className="relative lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-[var(--color-scrim)] px-3.5 py-2 text-[13px] font-medium text-ink backdrop-blur-xl"
      >
        {open ? <Icon.close width={14} height={14} /> : <Icon.text width={14} height={14} />}
        Menu
      </button>
      {open ? (
        <div role="menu" className="absolute left-0 top-full z-50 mt-2 w-60 rounded-2xl border border-line bg-panel p-1.5 shadow-xl">
          {MAIN.map((m) => (
            <NavLink key={m.to} role="menuitem" to={m.to} end={m.to === '/'} className={link}>
              {m.label}
            </NavLink>
          ))}
          {academic ? (
            <>
              <div className="mx-3 my-1.5 border-t border-line" />
              <p className="px-3 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wider text-dim">Study</p>
              {STUDY.map((s) => (
                <NavLink key={s.to} role="menuitem" to={s.to} className={link}>
                  {s.label}
                </NavLink>
              ))}
            </>
          ) : null}
          <div className="mx-3 my-1.5 border-t border-line sm:hidden" />
          <div className="flex items-center justify-between gap-2 px-2 py-1 sm:hidden">
            <AudienceSwitch compact />
            <ThemeToggle />
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * The one site header. `floating` is for the landing page, where it sits over the hero and frosts once the
 * page scrolls; everywhere else it is a sticky band.
 */
export function SiteHeader({ floating = false, scrolled = false, width = 'max-w-7xl' }: { floating?: boolean; scrolled?: boolean; width?: string }) {
  const academic = useAcademic()
  const frosted = !floating || scrolled
  return (
    <header
      className={`${floating ? 'pointer-events-none fixed inset-x-0' : 'sticky'} top-0 z-40 transition-colors duration-300 ${
        frosted ? 'border-b border-line bg-[var(--color-scrim)] backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <div className={`mx-auto flex ${width} items-center gap-3 px-4 transition-[padding] duration-300 sm:px-6 lg:px-8 ${floating && !scrolled ? 'py-4' : 'py-2.5'}`}>
        <Link to="/" aria-label="Solidify home" className="pointer-events-auto shrink-0 rounded-full border border-line-2 bg-[var(--color-scrim)] py-1.5 pl-2.5 pr-3.5 backdrop-blur-xl">
          <Logo />
        </Link>
        <div className="pointer-events-auto">
          <MobileMenu academic={academic} />
        </div>
        <nav aria-label="Main" className="pointer-events-auto hidden items-center gap-0.5 rounded-full border border-line-2 bg-[var(--color-scrim)] p-1 text-[13px] font-medium backdrop-blur-xl lg:flex">
          {MAIN.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.to === '/'} className={({ isActive }) => pill(isActive && m.to !== '/')}>
              {m.label}
            </NavLink>
          ))}
          {academic ? <StudyMenu /> : null}
        </nav>
        <div className="pointer-events-auto ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden sm:block">
            <AudienceSwitch compact />
          </div>
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <AccountMenu compact />
        </div>
      </div>
    </header>
  )
}
