import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AccountMenu } from '@/cloud/ui/AccountMenu'
import { AudienceSwitch } from '@/ui/AudienceSwitch'
import { AUDIENCE_SWITCH } from '@/ui/audience'
import { Icon } from '@/ui/icons'
import { Logo } from '@/ui/Logo'
import { ThemeToggle } from '@/ui/ThemeToggle'

interface NavItem {
  to: string
  label: string
  /** a line under the label in the menu */
  hint?: string
}

interface NavGroup {
  label: string
  /** a group with one item is a plain link */
  items: NavItem[]
  /** the paths that count as being in this section */
  match: (path: string) => boolean
}

/** the site's sections, the same on every page and in both views */
const NAV: NavGroup[] = [
  { label: 'Labs', items: [{ to: '/labs', label: 'Labs' }], match: (p) => p === '/labs' || p.startsWith('/m/') },
  {
    label: 'Create',
    items: [
      { to: '/create/new', label: 'Build a new model', hint: 'Describe it or upload a photo' },
      { to: '/create', label: 'Create in 3D', hint: 'Samples and your recent models' },
      { to: '/create/lab', label: 'My models', hint: 'Everything you have built' },
      { to: '/library', label: 'Library', hint: 'Models checked by the team' },
      { to: '/questions', label: 'Solve a question', hint: 'Paste a problem or a screenshot; get it in 3D, worked out' },
    ],
    match: (p) => p.startsWith('/create') || p === '/library',
  },
  { label: 'Read notes', items: [{ to: '/read', label: 'Read notes in 3D' }], match: (p) => p === '/read' },
  {
    label: 'Study',
    items: [
      { to: '/questions', label: 'Solve a question', hint: 'Paste a problem or a screenshot; get it in 3D, worked out' },
      { to: '/exam', label: 'Exam practice', hint: 'Worked problems, checked live' },
      { to: '/formulas', label: 'Formula sheet' },
      { to: '/challenges', label: 'Challenges', hint: 'Goals set inside the labs' },
      { to: '/progress', label: 'Progress' },
      { to: '/classes', label: 'Classes' },
    ],
    match: (p) => ['/questions', '/exam', '/formulas', '/challenges', '/progress', '/classes'].some((x) => p === x || p.startsWith(`${x}/`)),
  },
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

/** exact match for an item, so "Create in 3D" is not lit on "My models" */
const itemActive = (path: string, to: string) => path === to

/** a section with several pages: a pill that opens its menu */
function GroupMenu({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const { pathname } = useLocation()
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)} className={`${pill(group.match(pathname))} inline-flex items-center gap-1`}>
        {group.label}
        <Icon.chevron width={12} height={12} className={`transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>
      {open ? (
        <div role="menu" className="absolute left-0 top-full z-50 mt-2 w-64 rounded-2xl border border-line bg-panel p-1.5 shadow-xl">
          {group.items.map((it) => (
            <Link key={it.to} role="menuitem" to={it.to} className={`block rounded-xl px-3 py-2 ${itemActive(pathname, it.to) ? 'bg-ink text-bg' : 'text-ink hover:bg-panel-2'}`}>
              <span className="block text-[13px] font-medium">{it.label}</span>
              {it.hint ? <span className={`block text-[11.5px] ${itemActive(pathname, it.to) ? 'text-bg/70' : 'text-mute'}`}>{it.hint}</span> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** below laptop width every section folds into one menu, so the header never wraps */
function MobileMenu() {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const { pathname } = useLocation()
  const link = (active: boolean) => `block rounded-xl px-3 py-2 text-[13.5px] ${active ? 'bg-ink text-bg' : 'text-ink hover:bg-panel-2'}`
  return (
    // not positioned itself: the sheet hangs from the header bar, so it spans the screen with even margins
    <div ref={ref} className="lg:hidden">
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
        <div role="menu" className="absolute inset-x-4 top-full z-50 mt-1 max-h-[80vh] overflow-y-auto rounded-2xl border border-line bg-panel p-1.5 shadow-xl sm:left-6 sm:right-auto sm:w-80">
          {NAV.map((g, i) =>
            g.items.length === 1 ? (
              <Link key={g.label} role="menuitem" to={g.items[0].to} className={link(g.match(pathname))}>
                {g.items[0].label}
              </Link>
            ) : (
              <div key={g.label}>
                {i > 0 ? <div className="mx-3 my-1.5 border-t border-line" /> : null}
                <p className="px-3 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wider text-dim">{g.label}</p>
                {/* one list here: a link that a later section also has (Solve a question) is listed there only */}
                {g.items.filter((it) => !NAV.slice(i + 1).some((x) => x.items.some((y) => y.to === it.to))).map((it) => (
                  <Link key={it.to} role="menuitem" to={it.to} className={link(itemActive(pathname, it.to))}>
                    {it.label}
                  </Link>
                ))}
                {i < NAV.length - 1 ? <div className="mx-3 my-1.5 border-t border-line" /> : null}
              </div>
            ),
          )}
          <div className="mx-3 my-1.5 border-t border-line sm:hidden" />
          <div className="flex items-center justify-between gap-2 px-2 py-1 sm:hidden">
            {AUDIENCE_SWITCH ? <AudienceSwitch compact /> : null}
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
  const { pathname } = useLocation()
  const frosted = !floating || scrolled
  return (
    <header
      className={`${floating ? 'pointer-events-none fixed inset-x-0' : 'sticky'} top-0 z-40 transition-colors duration-300 ${
        frosted ? 'border-b border-line bg-[var(--color-scrim)] backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <div className={`relative mx-auto flex ${width} items-center gap-3 px-4 transition-[padding] duration-300 sm:px-6 lg:px-8 ${floating && !scrolled ? 'py-4' : 'py-2.5'}`}>
        <Link to="/" aria-label="Solidify home" className="pointer-events-auto shrink-0 rounded-full border border-line-2 bg-[var(--color-scrim)] py-1.5 pl-2.5 pr-3.5 backdrop-blur-xl">
          <Logo />
        </Link>
        <div className="pointer-events-auto">
          <MobileMenu />
        </div>
        <nav aria-label="Main" className="pointer-events-auto hidden items-center gap-0.5 rounded-full border border-line-2 bg-[var(--color-scrim)] p-1 text-[13px] font-medium backdrop-blur-xl lg:flex">
          {NAV.map((g) =>
            g.items.length === 1 ? (
              <Link key={g.label} to={g.items[0].to} className={pill(g.match(pathname))}>
                {g.label}
              </Link>
            ) : (
              <GroupMenu key={g.label} group={g} />
            ),
          )}
        </nav>
        <div className="pointer-events-auto ml-auto flex shrink-0 items-center gap-2">
          {AUDIENCE_SWITCH ? (
            <div className="hidden sm:block">
              <AudienceSwitch compact />
            </div>
          ) : null}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <AccountMenu compact />
        </div>
      </div>
    </header>
  )
}
