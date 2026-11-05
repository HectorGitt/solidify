import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SUPPORT_EMAIL } from '@/cloud/config'
import { useReport } from '@/cloud/ui/ReportDialog'
import { useSales } from '@/cloud/ui/SalesDialog'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

const linkCls = 'text-[13.5px] text-mute transition-colors hover:text-ink'

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-dim">{title}</h2>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  )
}

/** Footer for every page except the full-screen viewer: where to go, and how to reach us. */
export function SiteFooter() {
  const openReport = useReport((s) => s.open)
  const openSales = useSales((s) => s.show)
  return (
    <footer className="mt-16 border-t border-line bg-panel/60">
      <div className="mx-auto grid max-w-[1360px] gap-10 px-5 py-14 sm:grid-cols-2 sm:px-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Logo size={22} />
          <p className="mt-4 text-[13.5px] leading-relaxed text-mute">Interactive 3D machinery and engineering laboratories, with the physics and bench tests worked live. For the workshop and the lecture hall.</p>
          <button
            onClick={openSales}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-bg transition-opacity hover:opacity-90"
          >
            Schools &amp; companies
          </button>
        </div>
        <Column title="Explore">
          <li>
            <Link to="/" className={linkCls}>
              Systems
            </Link>
          </li>
          <li>
            <Link to="/about" className={linkCls}>
              How it works
            </Link>
          </li>
          <li>
            <Link to="/challenges" className={linkCls}>
              Challenges
            </Link>
          </li>
          <li>
            <Link to="/create" className={linkCls}>
              Create in 3D
            </Link>
          </li>
        </Column>
        <Column title="Study">
          <li>
            <Link to="/exam" className={linkCls}>
              Exam practice
            </Link>
          </li>
          <li>
            <Link to="/progress" className={linkCls}>
              Progress
            </Link>
          </li>
          <li>
            <Link to="/formulas" className={linkCls}>
              Formula sheet
            </Link>
          </li>
          <li>
            <Link to="/read" className={linkCls}>
              Read notes in 3D
            </Link>
          </li>
          <li>
            <Link to="/classes" className={linkCls}>
              Classes
            </Link>
          </li>
        </Column>
        <Column title="Contact">
          <li>
            <button onClick={() => openReport({ mode: 'feature' })} className={linkCls}>
              Request a feature
            </button>
          </li>
          <li>
            <button onClick={openSales} className={linkCls}>
              Sales: schools &amp; companies
            </button>
          </li>
          <li>
            <button onClick={() => openReport({})} className={linkCls}>
              Report a problem
            </button>
          </li>
          <li>
            <a href={`mailto:${SUPPORT_EMAIL}`} className={linkCls}>
              {SUPPORT_EMAIL}
            </a>
          </li>
        </Column>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-4 px-5 py-5 text-[12.5px] text-dim sm:px-10">
          <span>© {new Date().getFullYear()} Solidify · solidify.studio</span>
          <div className="flex items-center gap-3">
            <a
              href="https://x.com/solidify_studio"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Solidify on X"
              className="grid h-9 w-9 place-items-center rounded-full border border-line-2 text-mute transition-colors hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z" />
              </svg>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  )
}
