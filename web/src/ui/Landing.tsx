import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useSim } from '@/core/sim'
import { MODULES } from '@/modules/catalog'
import type { ModuleDef, SceneDef } from '@/modules/types'
import { DEFAULT_CUT_PRESETS, useView } from '@/render/view'
import { useAcademic, useAudience } from './audience'
import { AccountMenu } from '@/cloud/ui/AccountMenu'
import { SUPPORT_EMAIL } from '@/cloud/config'
import { useReport } from '@/cloud/ui/ReportDialog'
import { useSales } from '@/cloud/ui/SalesDialog'
import { AudienceSwitch } from './AudienceSwitch'
import { Icon } from './icons'
import { Logo } from './Logo'
import { Loader, LoaderMark } from './Loader'
import { Stage, type StageFrame } from './Stage'
import { ThemeToggle } from './ThemeToggle'
import { useTheme } from './theme'
import { ModuleProgress } from '@/study/ui/badges'
import { StudyLinks } from '@/study/ui/StudyShell'
import { SiteFooter } from './SiteFooter'

const MEDIA = './media'

/**
 * The live hero scenes: picked to look their best and to load quickly (the first one downloads with
 * the page; the rest only when chosen). Gauge figures are each scene's own panel readouts at its
 * default settings; `fill` draws a bar only where the figure is a fraction of a limit.
 */
type HeroReadout = { label: string; value: string; unit: string; fill?: number }
const HERO_SCENES: { moduleId: string; sceneId: string; label: string; frame: StageFrame; readouts: HeroReadout[] }[] = [
  { moduleId: 'vibration', sceneId: 'seat', label: 'Seat suspension', frame: { back: 1.6, shift: 0.55 }, readouts: [{ label: 'Operator vibration', value: '0.666', unit: 'm/s² RMS' }, { label: 'Seat transmissibility', value: '0.549', unit: 'floor to operator' }] },
  { moduleId: 'traction', sceneId: 'traction-lab', label: 'Traction & drawbar pull', frame: { back: 1.25, shift: 0.2, lift: 0.12 }, readouts: [{ label: 'Drawbar pull', value: '12', unit: 'kN at 14.6 % slip' }, { label: 'Drawbar power', value: '11.4', unit: 'kW of 17.3', fill: 11.4 / 17.3 }] },
  { moduleId: 'powertrain', sceneId: 'differential', label: 'Differential & diff lock', frame: { back: 1.8, shift: 0.35 }, readouts: [{ label: 'Pinion', value: '600', unit: 'rpm' }, { label: 'Crown wheel', value: '140', unit: 'rpm' }] },
  { moduleId: 'engine', sceneId: 'cooling', label: 'Engine cooling', frame: { back: 1.4, shift: 0.45 }, readouts: [{ label: 'Heat to coolant', value: '36', unit: 'kW' }] },
]

const DISCIPLINES: { id: string; label: string; modules: string[] }[] = [
  { id: 'all', label: 'All systems', modules: [] },
  { id: 'power', label: 'Power & drivetrain', modules: ['engine', 'powertrain', 'pto', 'hydraulics', 'elements', 'vibration'] },
  { id: 'field', label: 'Traction & implements', modules: ['traction', 'steering', 'chassis', 'implements', 'testing', 'field'] },
]

/** Systems still being finished: listed as coming soon on the home page, not shown as tiles. */
const SOON = new Set(['processing', 'water', 'structures', 'precision'])
const READY = MODULES.filter((m) => !SOON.has(m.id))

/** Scene shown on each module card / opened by it. */
const FEATURED: Record<string, string> = {
  engine: 'cooling',
  powertrain: 'differential',
  pto: 'pto-shaft',
  hydraulics: 'draft-control',
  steering: 'boxes',
  traction: 'tracks',
  chassis: 'stability',
  implements: 'combine',
  elements: 'chains',
  testing: 'dynamometers',
  vibration: 'seat',
  field: 'field',
  processing: 'palm-oil',
  water: 'irrigation-methods',
  structures: 'farmstead',
  precision: 'see-and-spray',
}

const COPY = {
  professional: {
    eyebrow: 'Interactive 3D tractor & farm machinery simulator',
    title: 'Open up the machine.',
    lead: 'Cut through a running tractor, slow it to 1/200 speed, and size every system with the calculations engineers use: gear forces, pump flows, traction and weight transfer.',
    primary: { label: 'Explore the tractor', to: '/m/powertrain/line-of-drive' },
    features: [
      { icon: 'cut', title: 'True cutaways', text: 'Slice any assembly at any angle. Cut faces are hatched by material like an engineering drawing; moving parts stay whole so you can watch them work.' },
      { icon: 'sliders', title: 'Live calculations', text: 'Every slider drives the physics: belt tensions, clutch capacity, hydrostatic flow, slip and tractive efficiency, with the working shown.' },
      { icon: 'target', title: 'Verified physics', text: 'Over a thousand automated checks pin the calculations to reference answers, and mechanisms follow exact kinematics.' },
      { icon: 'tractor', title: 'Runs anywhere', text: 'Nothing to install. Downloads stay small enough for site laptops, workshop PCs and phones in the field.' },
    ],
  },
  academic: {
    eyebrow: '3D farm power & machinery for agricultural engineering',
    title: 'Farm machinery, brought to life.',
    lead: 'Every topic from engines to implements as an interactive cutaway. Practise with fresh numbers each attempt, see the formula with the numbers substituted, and find the slip behind a wrong answer.',
    primary: { label: 'Start with the diesel engine', to: '/m/engine/four-stroke-diesel' },
    features: [
      { icon: 'cut', title: 'Interactive diagrams', text: 'Every textbook figure becomes a model you can turn, slice, explode and run in slow motion, down to 1/200 of real speed.' },
      { icon: 'book', title: 'Worked examples', text: 'Load exam-style data into any scene and follow the working: the formula, the numbers substituted, then the answer.' },
      { icon: 'target', title: 'Marked like an examiner', text: 'Method marks carry an early slip forward, and each wrong answer names the likely mistake.' },
      { icon: 'tour', title: 'Guided tours', text: 'Each scene has a short guided tour with checkpoints, for revision or for teaching from the projector.' },
    ],
  },
} as const

/**
 * A scene render for the current theme (`<name>-light.webp` / `<name>-dark.webp`, made by
 * scripts/capture-tiles.mjs), quietly falling back to a hatched placeholder if it's missing.
 */
function Media({ name, alt, className }: { name: string; alt: string; className?: string }) {
  const theme = useTheme((s) => s.theme)
  const src = `${MEDIA}/${name}-${theme}.webp`
  const [failed, setFailed] = useState<string | null>(null)
  if (failed === src)
    return (
      <div
        className={`${className ?? ''} bg-[var(--color-stage)]`}
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 10%, transparent) 0 2px, transparent 2px 16px)' }}
        aria-label={alt}
      />
    )
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={className} onError={() => setFailed(src)} />
}

function Gauge({ label, value, unit, fill }: HeroReadout) {
  return (
    <div className="rounded-2xl border border-line-2 bg-[var(--color-scrim)] px-4 py-3.5 backdrop-blur-xl">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-dim">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-[26px] font-medium tracking-tight text-ink">{value}</span>
        {unit ? <span className="text-[12px] text-mute">{unit}</span> : null}
      </div>
      {fill !== undefined ? (
        <div className="mt-2.5 h-1 rounded-full bg-line-2">
          <div className="h-1 rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.round(fill * 100)}%` }} />
        </div>
      ) : null}
    </div>
  )
}

/** Full-bleed hero: a live scene behind the headline, with a scene dock and gauges floating over it. */
function Hero({ copy }: { copy: (typeof COPY)[keyof typeof COPY] }) {
  const [heroIdx, setHeroIdx] = useState(0)
  // falls back to the still render if a scene fails to load
  const [live3D, setLive3D] = useState(true)
  const [scene, setScene] = useState<SceneDef | null>(null)
  const cutEnabled = useView((s) => s.cut.enabled)
  const explode = useView((s) => s.explode)
  const hero = HERO_SCENES[heroIdx]
  const shownFrame = HERO_SCENES.find((h) => h.sceneId === scene?.id)?.frame
  const switching = !!scene && scene.id !== hero.sceneId

  useEffect(() => {
    if (!live3D) return
    let alive = true
    const mod = MODULES.find((m) => m.id === hero.moduleId)
    const entry = mod?.scenes.find((s) => s.id === hero.sceneId)
    if (!entry?.load) return
    entry
      .load()
      .then(async ({ default: def }) => {
        await def.prepare?.()
        return def
      })
      .then((def) => {
        if (!alive) return
        const v = useView.getState()
        v.resetView()
        v.setPresets(def.cutPresets ?? DEFAULT_CUT_PRESETS)
        v.applyPreset(def.defaultPreset ?? (def.cutPresets ?? DEFAULT_CUT_PRESETS)[0].id)
        useSim.setState({ playing: true, timeScale: def.timeScale ?? 1 / 40, time: 0 })
        def.reset?.()
        setScene(def)
      })
      .catch(() => {
        if (alive) setLive3D(false)
      })
    return () => {
      alive = false
    }
  }, [heroIdx, live3D, hero.moduleId, hero.sceneId])

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${on ? 'bg-ink text-bg' : 'text-mute hover:bg-ink/[0.06] hover:text-ink'}`

  return (
    <section className="relative overflow-hidden bg-panel-3 lg:h-[min(92vh,860px)] lg:min-h-[620px]">
      {/* touch screens: the hero is look-only so a swipe always scrolls the page (camera controls
          otherwise capture the touch); "Open scene" is the way in. Mouse users can still drag it. */}
      <div className="absolute inset-0 [&_canvas]:!touch-pan-y pointer-coarse:[&_*]:!pointer-events-none">
        {/* the current scene stays up while the next one's code loads; then the new scene builds
            under a frosted veil, so switching never blanks the hero */}
        {live3D && scene ? (
          <Stage key={scene.id} scene={scene} pageScroll frame={shownFrame} veil />
        ) : live3D ? (
          <Loader size={52} className="h-full bg-[var(--color-stage)] lg:pl-[40%]" />
        ) : (
          <div className="h-full bg-[var(--color-stage)]" />
        )}
      </div>
      {/* scrims keep the headline readable in either theme; they never take pointer events, so the scene stays draggable */}
      <div
        className="pointer-events-none absolute inset-0 lg:hidden"
        style={{ background: 'linear-gradient(0deg, var(--color-bg) 0%, var(--color-bg) 42%, transparent 62%), linear-gradient(180deg, color-mix(in srgb, var(--color-bg) 70%, transparent) 0%, transparent 14%)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          background:
            'linear-gradient(90deg, var(--color-bg) 0%, color-mix(in srgb, var(--color-bg) 70%, transparent) 34%, transparent 62%), linear-gradient(0deg, var(--color-bg) 0%, transparent 26%), linear-gradient(180deg, color-mix(in srgb, var(--color-bg) 70%, transparent) 0%, transparent 18%)',
        }}
        aria-hidden
      />

      <div className="pointer-events-none absolute right-5 top-24 hidden w-[230px] flex-col gap-2.5 lg:flex">
        {hero.readouts.map((r) => (
          <Gauge key={r.label} {...r} />
        ))}
      </div>

      {/* phones: the text sits below the scene (which fills the top half); large screens: over its left side */}
      <div className="pointer-events-none relative pt-[54vh] lg:absolute lg:inset-x-0 lg:bottom-0 lg:pt-0">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-end justify-between gap-6 px-5 pb-10 sm:px-10 sm:pb-14 lg:gap-8">
          <div className="max-w-[640px]">
            {/* the keyword line is part of the h1, so search engines read "3D tractor & farm machinery simulator: Open up the machine." */}
            <h1>
              <span className="block text-[13.5px] font-medium tracking-normal text-accent">{copy.eyebrow}</span>
              <span className="mt-4 block text-[48px] font-semibold leading-[0.98] tracking-[-0.045em] text-ink sm:text-[84px]">{copy.title}</span>
            </h1>
            <p className="mt-5 max-w-[540px] text-[15px] leading-relaxed text-mute sm:mt-6 sm:text-[17.5px]">{copy.lead}</p>
            <div className="pointer-events-auto mt-7 flex flex-wrap gap-3 sm:mt-9">
              <Link to={copy.primary.to} className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-[15px] font-semibold text-accent-ink transition-transform hover:brightness-105 active:scale-[0.98]">
                {copy.primary.label} <Icon.chevron width={16} height={16} />
              </Link>
              <Link to="/promo" className="hidden items-center gap-2 rounded-full sm:inline-flex border border-line-2 bg-[var(--color-scrim)] px-6 py-4 text-[15px] font-medium text-ink backdrop-blur-xl transition-colors hover:border-accent/50">
                <Icon.tour width={16} height={16} /> Watch the 30 s tour
              </Link>
            </div>
          </div>

          <div className="pointer-events-auto flex max-w-full flex-col items-start gap-2 sm:items-end">
            <div className="flex max-w-[calc(100vw-2.5rem)] items-center gap-1 overflow-x-auto rounded-full border border-line-2 bg-[var(--color-scrim)] p-1 backdrop-blur-xl [scrollbar-width:none] sm:flex-wrap" role="group" aria-label="Hero scene">
              {HERO_SCENES.map((h, i) => (
                <button
                  key={`${h.moduleId}/${h.sceneId}`}
                  onClick={() => {
                    setHeroIdx(i)
                    setLive3D(true)
                  }}
                  aria-pressed={i === heroIdx}
                  className={`${chip(i === heroIdx)} inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap`}
                >
                  {i === heroIdx && switching ? <LoaderMark size={12} /> : null}
                  {h.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1 rounded-full border border-line-2 bg-[var(--color-scrim)] p-1 backdrop-blur-xl">
              {live3D && scene ? (
                <>
                  <button onClick={() => useView.getState().setCut({ enabled: !cutEnabled })} aria-pressed={cutEnabled} className={chip(cutEnabled)}>
                    Cutaway
                  </button>
                  <button onClick={() => useView.getState().setExplode(explode > 0.1 ? 0 : 0.75)} aria-pressed={explode > 0.1} className={chip(explode > 0.1)}>
                    Explode
                  </button>
                </>
              ) : null}
              <Link to={`/m/${hero.moduleId}/${hero.sceneId}`} className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-accent hover:bg-accent/10">
                Open scene →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ModuleTile({ m, academic, big }: { m: ModuleDef; academic: boolean; big: boolean }) {
  const live = m.scenes.filter((s) => s.load)
  const featured = FEATURED[m.id] ?? live[0]?.id
  const exam = m.scenes.filter((s) => s.exam).length
  return (
    <Link
      to={`/m/${m.id}/${featured}`}
      className={`group relative block overflow-hidden rounded-3xl border border-line bg-[var(--color-stage)] ${big ? 'h-[380px] lg:col-span-6' : 'h-[300px] lg:col-span-4'} sm:col-span-1`}
    >
      <Media name={`modules/${m.id}`} alt={`${m.title}: interactive 3D cutaway`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--color-stage)] via-[color-mix(in_srgb,var(--color-stage)_80%,transparent)] to-transparent p-6 pt-24">
        <div className="flex items-center gap-2 text-[12px] font-medium text-accent">
          {m.scenes.length} scenes
          {academic && exam > 0 ? <span className="text-warn">· {exam} often examined</span> : null}
        </div>
        <h3 className={`mt-1.5 font-semibold tracking-[-0.02em] text-ink ${big ? 'text-[28px]' : 'text-[21px]'}`}>{m.title}</h3>
        <p className={`mt-1 text-[13.5px] leading-relaxed text-mute ${big ? 'line-clamp-2 max-w-[480px]' : 'line-clamp-1'}`}>{m.blurb}</p>
        {academic ? (
          <div className="mt-3 max-w-[260px]">
            <ModuleProgress moduleId={m.id} />
          </div>
        ) : null}
      </div>
      <span className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-[var(--color-scrim)] text-ink opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100" aria-hidden>
        <Icon.chevron width={16} height={16} />
      </span>
    </Link>
  )
}

function FeatureIcon({ name }: { name: string }) {
  const I = Icon[name as keyof typeof Icon] ?? Icon.target
  return (
    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/12 text-accent">
      <I width={20} height={20} />
    </span>
  )
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-3xl border border-line bg-panel p-7">
      <div className="font-mono text-[40px] font-medium tracking-tight text-accent">{value}</div>
      <div className="mt-1 text-[14px] text-mute">{label}</div>
    </div>
  )
}

function AudienceCard({ who, title, points, active, onChoose }: { who: string; title: string; points: string[]; active: boolean; onChoose: () => void }) {
  return (
    <div className={`flex flex-col rounded-3xl border p-7 transition-colors ${active ? 'border-accent/50 bg-accent/[0.05]' : 'border-line bg-panel hover:border-line-2'}`}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-accent">{who}</p>
        {active ? <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">Current mode</span> : null}
      </div>
      <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-ink">{title}</h3>
      <ul className="mt-5 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex gap-3 text-[14px] leading-relaxed text-mute">
            <Icon.check width={16} height={16} className="mt-[3px] shrink-0 text-accent" />
            {p}
          </li>
        ))}
      </ul>
      <button
        onClick={onChoose}
        className={`mt-7 self-start rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition-colors ${active ? 'bg-accent text-accent-ink' : 'border border-line-2 text-ink hover:border-accent/50'}`}
      >
        {active ? 'Current view' : `Switch to ${who.toLowerCase()}`}
      </button>
    </div>
  )
}

const HOME_TITLE = 'Solidify — Interactive 3D Tractor & Farm Machinery'

/** Two ways to reach us: ask for a feature, or talk to us about a school or company plan. */
function Contact() {
  const openReport = useReport((s) => s.open)
  const openSales = useSales((s) => s.show)
  return (
    <section id="contact" className="mx-auto grid max-w-[1360px] scroll-mt-20 gap-4 px-5 pt-20 sm:px-10 md:grid-cols-2">
      <div className="flex flex-col rounded-3xl border border-line bg-panel p-7">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Missing something?</h2>
        <p className="mt-2 flex-1 text-[14px] leading-relaxed text-mute">A machine, a calculation, an exam topic or a feature for your class. Requests decide what we build next.</p>
        <button onClick={() => openReport({ mode: 'feature' })} className="mt-6 self-start rounded-full border border-line-2 px-5 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:border-accent/50">
          Request a feature
        </button>
      </div>
      <div className="flex flex-col rounded-3xl border border-line bg-panel p-7">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">For schools &amp; companies</h2>
        <p className="mt-2 flex-1 text-[14px] leading-relaxed text-mute">Licences for a department or a team, classes and papers for your students, and Create in 3D for your engineers.</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button onClick={openSales} className="rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-accent-ink transition-opacity hover:opacity-90">
            Talk to us
          </button>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[13px] text-mute hover:text-ink">
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </section>
  )
}

export function Landing() {
  useEffect(() => {
    document.title = HOME_TITLE
  }, [])
  const academic = useAcademic()
  const setAudience = useAudience((s) => s.setAudience)
  const copy = academic ? COPY.academic : COPY.professional
  const total = READY.reduce((n, m) => n + m.scenes.length, 0)
  const [discipline, setDiscipline] = useState('all')
  const [scrolled, setScrolled] = useState(false)

  const activeDiscipline = DISCIPLINES.find((d) => d.id === discipline) ?? DISCIPLINES[0]
  const filteredModules = activeDiscipline.modules.length === 0 ? READY : READY.filter((m) => activeDiscipline.modules.includes(m.id))

  return (
    <div className="h-full overflow-y-auto bg-bg text-ink selection:bg-accent/25" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 24)}>
      {/* floating header over the hero */}
      {/* floats over the hero; once the page scrolls it gets a frosted band so it never sits on content */}
      <header className={`pointer-events-none fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${scrolled ? 'border-b border-line bg-[var(--color-scrim)] backdrop-blur-xl' : 'border-b border-transparent'}`}>
        <div className={`mx-auto flex max-w-[1360px] items-center gap-4 px-5 transition-[padding] duration-300 sm:px-10 ${scrolled ? 'py-2.5' : 'py-4'}`}>
          <Link to="/" aria-label="Solidify home" className="pointer-events-auto rounded-full border border-line-2 bg-[var(--color-scrim)] py-2 pl-3 pr-4 backdrop-blur-xl">
            <Logo />
          </Link>
          <nav className="pointer-events-auto hidden items-center gap-0.5 rounded-full border border-line-2 bg-[var(--color-scrim)] p-1 text-[13px] font-medium backdrop-blur-xl md:flex">
            <a href="#systems" className="rounded-full px-3.5 py-1.5 text-mute transition-colors hover:bg-ink/[0.06] hover:text-ink">
              Systems
            </a>
            <Link to="/about" className="rounded-full px-3.5 py-1.5 text-mute transition-colors hover:bg-ink/[0.06] hover:text-ink">
              How it works
            </Link>
            <Link to="/create" className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-mute transition-colors hover:bg-ink/[0.06] hover:text-ink">
              Create
              <span className="rounded-full bg-warn/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-warn">Soon</span>
            </Link>
            {academic ? null : (
              <Link to="/challenges" className="rounded-full px-3.5 py-1.5 text-mute transition-colors hover:bg-ink/[0.06] hover:text-ink">
                Challenges
              </Link>
            )}
            <StudyLinks compact />
          </nav>
          <div className="pointer-events-auto ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <AudienceSwitch />
            </div>
            <ThemeToggle />
            <AccountMenu compact />
          </div>
        </div>
      </header>

      <Hero copy={copy} />

      <section id="systems" className="mx-auto max-w-[1360px] scroll-mt-20 px-5 pt-16 sm:px-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">Every tractor system, in 3D</h2>
            <p className="mt-1.5 text-[15px] text-mute">From the combustion chamber to the soil, each one opens straight into a working cutaway.</p>
          </div>
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-panel p-1 [scrollbar-width:none]" role="group" aria-label="Filter systems">
            {DISCIPLINES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDiscipline(d.id)}
                aria-pressed={discipline === d.id}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${discipline === d.id ? 'bg-ink text-bg' : 'text-mute hover:text-ink'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {filteredModules.map((m, i) => (
            <ModuleTile key={m.id} m={m} academic={academic} big={i < 2} />
          ))}
        </div>
        {discipline === 'all' ? (
          <div className="mt-6">
            <h3 className="mb-3 text-[13px] font-medium text-dim">Coming soon</h3>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {MODULES.filter((m) => SOON.has(m.id)).map((m) => (
                <li key={m.id} className="rounded-2xl border border-dashed border-line-2 px-5 py-4">
                  <div className="text-[15px] font-semibold tracking-[-0.01em] text-ink/80">{m.title}</div>
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-dim">{m.blurb}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mx-auto grid max-w-[1360px] gap-4 px-5 pt-20 sm:grid-cols-2 sm:px-10 lg:grid-cols-4">
        <Stat value={total} label="interactive 3D scenes" />
        <Stat value={READY.length} label="machine systems" />
        <Stat value="1,000+" label="verified calculations" />
        <Stat value="0 MB" label="to install: it runs in the browser" />
      </section>

      <section className="mx-auto max-w-[1360px] px-5 pt-20 sm:px-10">
        <h2 className="max-w-[620px] text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">Built for mechanical depth</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {copy.features.map((f) => (
            <div key={f.title} className="rounded-3xl border border-line bg-panel p-7">
              <FeatureIcon name={f.icon} />
              <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.01em]">{f.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-mute">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="audiences" className="mx-auto max-w-[1360px] scroll-mt-20 px-5 pt-20 sm:px-10">
        <h2 className="text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">The workshop and the lecture hall</h2>
        <p className="mt-1.5 max-w-2xl text-[15px] text-mute">The same models, two ways of working. Switch any time from the top bar.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <AudienceCard
            who="Professional"
            title="Engineers, technicians and operators"
            active={!academic}
            onChoose={() => setAudience('professional')}
            points={[
              'A clean engineering view: mechanisms, sections and sizing calculations',
              'Size drives, pumps, clutches and hitches with live formulas and sweeps',
              'Show clients and teams how it works with exploded and X-ray views',
            ]}
          />
          <AudienceCard
            who="Academic"
            title="Students and lecturers"
            active={academic}
            onChoose={() => setAudience('academic')}
            points={[
              'Exam-style questions with fresh numbers, solved step by step in the scenes',
              'Method marks, spaced review and topic mastery that follow you between devices',
              'Classes and papers with per-student numbers and a weak-spot report',
            ]}
          />
        </div>
      </section>

      <Contact />

      <section className="mx-auto max-w-[1360px] px-5 py-20 sm:px-10">
        <div className="relative overflow-hidden rounded-[32px] border border-line bg-[var(--color-stage)]">
          <Media name="modules/implements" alt="Tractor and implement in 3D" className="absolute inset-0 h-full w-full object-cover object-right" />
          <div className="relative bg-gradient-to-r from-[var(--color-stage)] via-[color-mix(in_srgb,var(--color-stage)_85%,transparent)] to-transparent p-8 sm:p-14">
            <h2 className="max-w-xl text-[32px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[44px]">Open a machine and see how it works.</h2>
            <p className="mt-3 max-w-xl text-[15.5px] text-mute">No sign-up, nothing to download. Pick any system and start cutting.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={copy.primary.to} className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-[15px] font-semibold text-accent-ink">
                {copy.primary.label} <Icon.chevron width={16} height={16} />
              </Link>
              <Link to="/m/implements/mouldboard" className="rounded-full border border-line-2 bg-[var(--color-scrim)] px-6 py-4 text-[15px] font-medium text-ink backdrop-blur-xl hover:border-accent/50">
                Watch a plough at work
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
