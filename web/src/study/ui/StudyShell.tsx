import { useEffect, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAcademic } from '@/ui/audience'
import { AccountMenu } from '@/cloud/ui/AccountMenu'
import { AudienceSwitch } from '@/ui/AudienceSwitch'
import { Logo } from '@/ui/Logo'
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
            `rounded-md px-2 py-1 text-[12.5px] font-medium transition-colors ${isActive ? 'bg-accent/15 text-accent' : 'text-mute hover:bg-panel-3 hover:text-ink'}`
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
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link to="/" aria-label="Solidify home">
            <Logo />
          </Link>
          <StudyLinks always className="ml-2 hidden sm:flex" />
          <div className="ml-auto flex items-center gap-2">
            <AudienceSwitch compact />
            <AccountMenu compact />
          </div>
        </div>
        <StudyLinks always compact className="justify-center border-t border-line py-1 sm:hidden" />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight">{title}</h1>
            {lead ? <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-mute">{lead}</p> : null}
          </div>
          {right}
        </div>
        {children}
      </main>
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
            value === o.value ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line-2 text-mute hover:border-accent/40 hover:text-ink'
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
