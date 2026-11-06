import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MODULES } from '@/modules/catalog'
import type { ModuleDef, SceneEntry } from '@/modules/types'
import { ModuleProgress } from '@/study/ui/badges'
import { Pills, StudyShell } from '@/study/ui/StudyShell'
import { useAcademic } from './audience'
import { Icon } from './icons'
import { ALL_ORDER, DISCIPLINES, FEATURED, Media, READY, SOON } from './labsCatalog'
import { RigEquations, RigReadings, rigFacts } from './rigFacts'

const ordered = ALL_ORDER.map((id) => READY.find((m) => m.id === id)).filter((m): m is ModuleDef => !!m)
const live = (m: ModuleDef) => m.scenes.filter((s) => s.load)
const sceneLink = (m: ModuleDef, s: SceneEntry) => `/m/${m.id}/${s.id}`

/** a rig's own picture (public/media/scenes, made by scripts/capture-tiles.mjs) */
function RigThumb({ m, s, className = '' }: { m: ModuleDef; s: SceneEntry; className?: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-lg bg-[var(--color-stage)] ${className}`}>
      <Media name={`scenes/${m.id}--${s.id}`} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
    </span>
  )
}

/** on hover (pointer devices), what a rig shows: its summary, its own readings and its first equations */
function RigPeek({ m, s }: { m: ModuleDef; s: SceneEntry }) {
  const facts = rigFacts(m.id, s.id)
  return (
    <div className="pointer-events-none absolute inset-x-0 top-full z-30 hidden pt-1 [@media(hover:hover)]:group-hover/rig:block">
      <div className="rounded-2xl border border-line-2 bg-panel p-4 shadow-2xl">
        <p className="text-[12.5px] leading-snug text-mute">{s.summary}</p>
        {facts?.readings.length ? (
          <div className="mt-3">
            <RigReadings readings={facts.readings} max={3} />
          </div>
        ) : null}
        {facts?.equations.length ? (
          <div className="mt-3 border-t border-line pt-3">
            <RigEquations equations={facts.equations} max={2} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** a system: its picture, what it covers, and every rig in it */
function SystemCard({ m, academic }: { m: ModuleDef; academic: boolean }) {
  const [all, setAll] = useState(false)
  const rigs = live(m)
  const shown = all ? rigs : rigs.slice(0, 5)
  const featured = rigs.find((s) => s.id === FEATURED[m.id]) ?? rigs[0]
  return (
    <article className="flex min-w-0 flex-col rounded-3xl border border-line bg-panel">
      <Link to={featured ? sceneLink(m, featured) : '#'} className="group relative block aspect-[16/9] overflow-hidden rounded-t-3xl bg-[var(--color-stage)]">
        <Media name={`modules/${m.id}`} alt={`${m.title}: interactive 3D cutaway`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">{m.title}</h2>
          <span className="shrink-0 font-mono text-[11.5px] text-dim">{rigs.length} rigs</span>
        </div>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-mute">{m.blurb}</p>
        {academic ? (
          <div className="mt-3">
            <ModuleProgress moduleId={m.id} />
          </div>
        ) : null}
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {shown.map((s) => (
            <li key={s.id} className="group/rig relative">
              <Link to={sceneLink(m, s)} className="group flex items-center gap-3 py-2">
                <RigThumb m={m} s={s} className="h-10 w-16" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink/90 group-hover:text-accent">{s.title}</span>
                  <span className="block truncate text-[11.5px] text-dim">{s.summary}</span>
                </span>
                {academic && s.exam ? <span className="shrink-0 text-[11px] text-warn">often examined</span> : null}
              </Link>
              <RigPeek m={m} s={s} />
            </li>
          ))}
        </ul>
        {rigs.length > 5 ? (
          <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 self-start text-[12.5px] font-medium text-mute hover:text-ink">
            {all ? 'Show fewer' : `All ${rigs.length} rigs`}
          </button>
        ) : null}
      </div>
    </article>
  )
}

/** search results: every rig that matches, under its system */
function Results({ query, systems, academic }: { query: string; systems: ModuleDef[]; academic: boolean }) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const groups = systems
    .map((m) => ({ m, hits: live(m).filter((s) => words.every((w) => `${s.title} ${s.summary} ${m.title}`.toLowerCase().includes(w))) }))
    .filter((g) => g.hits.length)
  if (!groups.length)
    return (
      <p className="rounded-2xl border border-dashed border-line-2 px-6 py-10 text-center text-[13px] text-mute">
        No lab matches “{query}”. Try the{' '}
        <Link to="/library" className="text-accent hover:underline">
          library
        </Link>
        , or{' '}
        <Link to="/create/new" className="text-accent hover:underline">
          build it yourself
        </Link>
        .
      </p>
    )
  return (
    <div className="space-y-5">
      {groups.map(({ m, hits }) => (
        <section key={m.id}>
          <h2 className="mb-2 text-[13px] font-semibold text-dim">{m.title}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
            {hits.map((s) => (
              <li key={s.id}>
                <Link to={sceneLink(m, s)} className="group flex items-start gap-3 px-4 py-3 hover:bg-panel-2">
                  <RigThumb m={m} s={s} className="h-16 w-28" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-ink group-hover:text-accent">
                      {s.title}
                      {academic && s.exam ? <span className="ml-2 text-[11px] font-normal text-warn">often examined</span> : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-mute">{s.summary}</p>
                    {rigFacts(m.id, s.id)?.readings.length ? (
                      <div className="mt-2">
                        <RigReadings readings={rigFacts(m.id, s.id)!.readings} max={3} />
                      </div>
                    ) : null}
                  </div>
                  <Icon.chevron width={14} height={14} className="mt-1 shrink-0 text-dim group-hover:text-accent" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** every hand-built system and test rig, to search and open */
export default function LabsPage() {
  const academic = useAcademic()
  const [query, setQuery] = useState('')
  const [discipline, setDiscipline] = useState('all')
  const total = ordered.reduce((n, m) => n + live(m).length, 0)
  const systems = useMemo(() => {
    const d = DISCIPLINES.find((x) => x.id === discipline) ?? DISCIPLINES[0]
    return d.id === 'all' ? ordered : ordered.filter((m) => d.modules.includes(m.id))
  }, [discipline])
  const preview = MODULES.filter((m) => SOON.has(m.id))

  return (
    <StudyShell title="Labs" lead={`${ordered.length} systems and ${total} rigs, built by hand: run each one, cut it open, take it apart and read the results as the test runs.`}>
      <div className="pb-16">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:w-80">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rigs: torsion, PTO, venturi…"
              aria-label="Search the labs"
              className="w-full rounded-full border border-line-2 bg-panel-2 px-4 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-dim focus:border-accent/60 focus:ring-2 focus:ring-accent/15"
            />
          </div>
          <Pills label="Systems" value={discipline} onChange={setDiscipline} options={DISCIPLINES.map((d) => ({ value: d.id, label: d.label }))} />
        </div>

        {query.trim() ? (
          <Results query={query.trim()} systems={systems} academic={academic} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {systems.map((m) => (
              <SystemCard key={m.id} m={m} academic={academic} />
            ))}
          </div>
        )}

        {discipline === 'all' && !query.trim() && preview.length ? (
          <section className="mt-10">
            <h2 className="mb-3 text-[13px] font-medium text-dim">In preview: early builds</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {preview.map((m) => {
                const first = m.scenes.find((s) => s.id === FEATURED[m.id]) ?? m.scenes.find((s) => s.load) ?? m.scenes[0]
                return (
                  <li key={m.id}>
                    <Link to={first ? sceneLink(m, first) : '#'} className="block h-full rounded-2xl border border-dashed border-line-2 px-5 py-4 transition-colors hover:border-accent/50 hover:bg-panel/60">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink/85">{m.title}</span>
                        <span className="font-mono text-[11px] text-dim">{m.scenes.length} scenes</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-dim">{m.blurb}</p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        <section className="mt-10 flex flex-col items-start justify-between gap-4 rounded-3xl border border-line bg-panel p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-[16px] font-semibold text-ink">Looking for something else?</h2>
            <p className="mt-1 text-[13px] text-mute">The library has more machines, built by Solidify and checked by the team. Or describe any machine and watch it built.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link to="/library" className="inline-flex items-center rounded-full border border-line-2 bg-panel-2 px-4 py-2 text-[13px] font-medium text-ink hover:border-ink/40">
              Browse the library
            </Link>
            <Link to="/create/new" className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink hover:opacity-90">
              Build your own
            </Link>
          </div>
        </section>
      </div>
    </StudyShell>
  )
}
