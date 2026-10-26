import { useEffect, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAcademic } from '@/ui/audience'
import { AccountMenu } from '@/cloud/ui/AccountMenu'
import { AudienceSwitch } from '@/ui/AudienceSwitch'
import { ThemeToggle } from '@/ui/ThemeToggle'
import { Logo } from '@/ui/Logo'
import { SiteFooter } from '@/ui/SiteFooter'
import { courseTitle } from '../types'

export const STUDY_LINKS = [
  { to: '/exam', label: 'Exam practice', short: 'Exam' },
  { to: '/progress', label: 'Progress', short: 'Progress' },
  { to: '/formulas', label: 'Formula sheet', short: 'Formulas' },
  { to: '/challenges', label: 'Challenges', short: 'Challenges' },
] as const

/** Header links to the study pages. Shown in Study mode, or always when `always` is set. */
export function StudyLinks({ compact = false, always = false, className = '' }: { compact?: boolean; always?: boolean; className?: string }) {
  const academic = useAcademic()
  if (!academic && !always) return null
  return (
    <nav aria-label="Study tools" className={`flex items-center gap-1 ${className}`}>
      {STUDY_LINKS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          className={({ isActive }) =>
            `rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${isActive ? 'bg-ink text-bg' : 'text-mute hover:bg-ink/[0.06] hover:text-ink'}`
          }
        >
          {compact ? l.short : l.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** Subject label. The platform serves many schools, so internal course codes are never shown. */
export function CourseLabel({ course }: { course: string }) {
  return <>{courseTitle(course)}</>
}

/** Page frame for the study pages: header with logo, study links and the audience switch. */
export function StudyShell({ title, lead, children, right }: { title: string; lead?: string; children: ReactNode; right?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Solidify`
  }, [title])
  return (
    <div className="h-full overflow-y-auto bg-bg text-ink">
      <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="Solidify home" className="rounded-full border border-line-2 bg-panel/70 py-1.5 pl-2.5 pr-3.5">
            <Logo />
          </Link>
          <StudyLinks always className="ml-1 hidden rounded-full border border-line-2 bg-panel/70 p-1 sm:flex" />
          <div className="ml-auto flex items-center gap-2">
            <AudienceSwitch compact />
            <ThemeToggle />
            <AccountMenu compact />
          </div>
        </div>
        <StudyLinks always compact className="justify-center border-y border-line py-1.5 sm:hidden" />
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">{title}</h1>
            {lead ? <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-mute">{lead}</p> : null}
          </div>
          {right}
        </div>
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}

/** Simple pill select used by the study pages. */
export function Pills<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
            value === o.value ? 'border-ink bg-ink text-bg' : 'border-line-2 text-mute hover:border-ink/40 hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Thin progress bar. */
export function Bar({ value, total, tone = 'accent' }: { value: number; total: number; tone?: 'accent' | 'info' | 'warn' }) {
  const pct = total > 0 ? Math.round((100 * value) / total) : 0
  const bg = tone === 'info' ? 'bg-info' : tone === 'warn' ? 'bg-warn' : 'bg-accent'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${bg}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
