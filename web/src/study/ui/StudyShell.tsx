import { useEffect, type ReactNode } from 'react'
import { SiteHeader } from '@/ui/SiteHeader'
import { SiteFooter } from '@/ui/SiteFooter'
import { courseTitle } from '../types'

export const STUDY_LINKS = [
  { to: '/exam', label: 'Exam practice', short: 'Exam' },
  { to: '/progress', label: 'Progress', short: 'Progress' },
  { to: '/formulas', label: 'Formula sheet', short: 'Formulas' },
  { to: '/challenges', label: 'Challenges', short: 'Challenges' },
  { to: '/read', label: 'Read notes in 3D', short: 'Notes 3D' },
  { to: '/create', label: 'Create in 3D', short: 'Create 3D' },
] as const

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
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
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
    <div role="radiogroup" aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
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
