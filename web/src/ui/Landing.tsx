import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useSim } from '@/core/sim'
import { MODULES, countScenes } from '@/modules/catalog'
import type { ModuleDef, SceneDef } from '@/modules/types'
import { DEFAULT_CUT_PRESETS, useView } from '@/render/view'
import { useAcademic, useAudience } from './audience'
import { AccountMenu } from '@/cloud/ui/AccountMenu'
import { AudienceSwitch } from './AudienceSwitch'
import { Icon } from './icons'
import { Logo } from './Logo'
import { Stage } from './Stage'
import { ModuleProgress } from '@/study/ui/badges'
import { StudyLinks } from '@/study/ui/StudyShell'

const MEDIA = './media'

const HERO_SCENES = [
  { moduleId: 'engine', sceneId: 'four-stroke-diesel', label: '4-Stroke Diesel', metric: 'bmep 7.2 bar · η 48.6%' },
  { moduleId: 'powertrain', sceneId: 'mf-16-speed', label: '16-Speed Gearbox', metric: '16F / 12R Synchromesh' },
  { moduleId: 'powertrain', sceneId: 'differential', label: 'Bevel Differential', metric: 'Crown & Pinion Lock' },
  { moduleId: 'hydraulics', sceneId: 'pumps', label: 'Hydraulic Pump', metric: '42.5 L/min · 185 bar' },
] as const

const DISCIPLINES: { id: string; label: string; modules: string[] }[] = [
  { id: 'all', label: 'All Systems', modules: [] },
  { id: 'power', label: 'Power & Drivetrain', modules: ['engine', 'powertrain', 'pto', 'hydraulics', 'elements', 'vibration'] },
  { id: 'field', label: 'Traction & Implements', modules: ['traction', 'steering', 'chassis', 'implements', 'testing', 'field'] },
  { id: 'processing', label: 'Crop Processing', modules: ['processing'] },
  { id: 'water-structures', label: 'Water & Structures', modules: ['water', 'structures'] },
]

/** Scene shown on each module card / opened by it. */
const FEATURED: Record<string, string> = {
  engine: 'four-stroke-diesel',
  powertrain: 'differential',
  pto: 'hookes-joint',
  hydraulics: 'pumps',
  steering: 'boxes',
  traction: 'tracks',
  chassis: 'weight-transfer',
  implements: 'mouldboard',
  elements: 'gears',
  testing: 'dynamometers',
  vibration: 'isolation',
  field: 'field',
  processing: 'size-reduction',
  water: 'irrigation-methods',
  structures: 'farmstead',
}

const COPY = {
  professional: {
    eyebrow: 'Interactive Engineering for Farm Machinery',
    title: (
      <>
        See inside every tractor system.
        <br />
        <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
          Then run the numbers.
        </span>
      </>
    ),
    lead: 'Cut open engines, transmissions, hydraulics, hitches and implements in real time. Watch every mechanism move in slow motion, and size it with the calculations engineers use — gear forces, pump flows, traction, weight transfer and more.',
    primary: { label: 'Explore the tractor', to: '/m/powertrain/line-of-drive' },
    features: [
      { icon: 'cut', title: 'True Cutaways', text: 'Slice any assembly at any angle. Cut faces are hatched by material like an engineering drawing; moving parts stay whole so you can watch them work.' },
      { icon: 'sliders', title: 'Live Calculations', text: 'Every slider drives the physics: belt tensions, clutch capacity, hydrostatic flow, slip and tractive efficiency, transmissibility — with the working shown.' },
      { icon: 'target', title: 'Verified Physics', text: 'Over a thousand automated checks pin the calculations to reference answers, and mechanisms follow exact kinematics: gears mesh, joints fluctuate, differentials split.' },
      { icon: 'tractor', title: 'Runs Anywhere', text: 'Nothing to install. A procedural engine keeps downloads small enough for site laptops, workshop PCs and phones in the field.' },
    ],
  },
  academic: {
    eyebrow: 'For Agricultural Engineering Students & Lecturers',
    title: (
      <>
        Farm power and machinery,
        <br />
        <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
          brought to life in 3D.
        </span>
      </>
    ),
    lead: 'Every topic from engines to implements as an interactive cutaway. Work through past-paper examples step by step, see the formula with the numbers substituted, and spot where worked answers go wrong.',
    primary: { label: 'Start with the diesel engine', to: '/m/engine/four-stroke-diesel' },
    features: [
      { icon: 'cut', title: 'Interactive Diagrams', text: 'Every textbook figure becomes a model you can turn, slice, explode and run in slow motion, down to 1/200 of real speed.' },
      { icon: 'book', title: 'Worked Examples', text: 'Load past-question data into any scene and follow the working: the formula, the numbers substituted, then the answer.' },
      { icon: 'target', title: 'Corrections Flagged', text: 'Where a worked answer or marking guide slips, the scene shows the computed value and marks the discrepancy.' },
      { icon: 'tour', title: 'Guided Tours', text: 'Each scene has a short guided tour for revision or for teaching a class from the projector.' },
    ],
  },
} as const

function FeatureIcon({ name }: { name: string }) {
  const I = Icon[name as keyof typeof Icon] ?? Icon.target
  return (
    <span className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 shadow-sm">
      <I width={20} height={20} />
    </span>
  )
}

/** An image that quietly falls back to a hatched placeholder if it hasn't been generated. */
function Media({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed)
    return (
      <div
        className={`${className ?? ''} bg-panel-2`}
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(16,185,129,0.06) 0 2px, transparent 2px 14px)' }}
        aria-label={alt}
      />
    )
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={className} onError={() => setFailed(true)} />
}

function ModuleCard({ m, academic }: { m: ModuleDef; academic: boolean }) {
  const live = m.scenes.filter((s) => s.load)
  const featured = FEATURED[m.id] ?? live[0]?.id
  const exam = m.scenes.filter((s) => s.exam).length
  return (
    <Link
      to={`/m/${m.id}/${featured}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-panel-2/70 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.2)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-panel-3">
        <Media src={`${MEDIA}/modules/${m.id}.jpg`} alt={`${m.title} — 3D scene`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-panel via-panel/20 to-transparent" />
        <span className="absolute left-3 top-3 rounded-full border border-line-2 bg-bg/80 px-2.5 py-0.5 font-mono text-[11px] font-medium text-ink/90 backdrop-blur-md shadow-sm">
          {m.scenes.length} scenes
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[16px] font-semibold text-ink group-hover:text-accent transition-colors">{m.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-mute">{m.blurb}</p>
        <ul className="mt-3.5 flex flex-wrap gap-1.5">
          {m.scenes.slice(0, 3).map((s) => (
            <li key={s.id} className="rounded-md border border-line-2/70 bg-panel-3/70 px-2 py-0.5 text-[11.5px] text-ink/80">
              {s.title}
            </li>
          ))}
          {m.scenes.length > 3 ? <li className="px-1 py-0.5 text-[11.5px] text-dim">+{m.scenes.length - 3} more</li> : null}
        </ul>
        {academic ? (
          <div className="mt-3">
            <ModuleProgress moduleId={m.id} />
          </div>
        ) : null}
        {academic && exam > 0 ? (
          <div className="mt-auto pt-3.5 flex items-center gap-1.5 text-[11.5px] font-medium text-warn">
            <span className="h-1.5 w-1.5 rounded-full bg-warn animate-pulse" />
            {exam} frequently examined {exam === 1 ? 'topic' : 'topics'}
          </div>
        ) : null}
      </div>
    </Link>
  )
}

function AudienceCard({ who, title, points, active, onChoose }: { who: string; title: string; points: string[]; active: boolean; onChoose: () => void }) {
  return (
    <div className={`flex flex-col rounded-2xl border p-6 transition-all duration-300 ${active ? 'border-accent/50 bg-accent/[0.04] shadow-lg shadow-accent/5 ring-1 ring-accent/20' : 'border-line bg-panel-2/60 hover:border-line-2'}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">{who}</p>
        {active ? (
          <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[10.5px] font-semibold text-accent">Active Mode</span>
        ) : null}
      </div>
      <h3 className="mt-2.5 text-[20px] font-semibold text-ink">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink/85">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            {p}
          </li>
        ))}
      </ul>
      <button
        onClick={onChoose}
        className={`mt-6 self-start rounded-xl px-4 py-2 text-[13px] font-semibold transition-all ${
          active
            ? 'bg-accent text-accent-ink shadow-md shadow-accent/20'
            : 'border border-line-2 text-ink hover:border-accent/40 hover:bg-panel-3'
        }`}
      >
        {active ? 'Current view' : `Switch to ${who.toLowerCase()} view`}
      </button>
    </div>
  )
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="px-6 py-5">
      <div className="font-mono text-[30px] font-semibold tracking-tight text-ink">{value}</div>
      <div className="mt-0.5 text-[12.5px] text-mute">{label}</div>
    </div>
  )
}

function HeroInteractiveStage() {
  const [heroIdx, setHeroIdx] = useState(0)
  const [live3D, setLive3D] = useState(true)
  const [scene, setScene] = useState<SceneDef | null>(null)
  const cutEnabled = useView((s) => s.cut.enabled)
  const explode = useView((s) => s.explode)
  const currentHero = HERO_SCENES[heroIdx]

  useEffect(() => {
    if (!live3D) return
    let alive = true
    setScene(null)
    const mod = MODULES.find((m) => m.id === currentHero.moduleId)
    const entry = mod?.scenes.find((s) => s.id === currentHero.sceneId)
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
  }, [heroIdx, live3D, currentHero.moduleId, currentHero.sceneId])

  return (
    <div className="relative">
      {/* Ambient specular bloom */}
      <div className="absolute -inset-4 rounded-[32px] bg-accent/15 blur-3xl pointer-events-none" aria-hidden />

      {/* Browser Window Container */}
      <div className="relative overflow-hidden rounded-2xl border border-line-2 bg-panel shadow-2xl shadow-black/80 ring-1 ring-white/[0.06]">
        <div className="flex items-center gap-2 border-b border-line bg-panel-2/90 px-4 py-2.5 backdrop-blur-md">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <span className="ml-2 truncate font-mono text-[11px] text-dim">
            solidify.studio · {currentHero.label}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {live3D && scene ? (
              <>
                <button
                  onClick={() => useView.getState().setCut({ enabled: !cutEnabled })}
                  className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                    cutEnabled ? 'bg-accent text-accent-ink' : 'border border-line-2 text-mute hover:text-ink'
                  }`}
                >
                  {cutEnabled ? 'Cutaway: ON' : 'Cutaway: OFF'}
                </button>
                <button
                  onClick={() => useView.getState().setExplode(explode > 0.1 ? 0 : 0.75)}
                  className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                    explode > 0.1 ? 'bg-accent text-accent-ink' : 'border border-line-2 text-mute hover:text-ink'
                  }`}
                >
                  {explode > 0.1 ? 'Assembled' : 'Explode'}
                </button>
              </>
            ) : null}
            <button
              onClick={() => setLive3D((v) => !v)}
              className="rounded-md bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent hover:bg-accent/25 transition-colors"
              title="Toggle live interactive WebGL 3D stage"
            >
              {live3D ? '● LIVE 3D' : 'STATIC IMG'}
            </button>
          </div>
        </div>

        <div className="relative aspect-[16/11] w-full bg-[#09090b]">
          {live3D && scene ? (
            <Stage key={scene.id} scene={scene} />
          ) : (
            <Media
              src={`${MEDIA}/hero.jpg`}
              alt="Cutaway tractor showing the engine, gearbox and rear axle in section"
              className="h-full w-full object-cover"
            />
          )}

          {/* Scene Quick-Switch Bar inside Hero */}
          <div className="absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-panel/90 px-2.5 py-2 backdrop-blur-xl shadow-lg">
            <div className="flex flex-wrap items-center gap-1">
              {HERO_SCENES.map((h, i) => (
                <button
                  key={`${h.moduleId}/${h.sceneId}`}
                  onClick={() => {
                    setHeroIdx(i)
                    setLive3D(true)
                  }}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                    i === heroIdx
                      ? 'bg-accent text-accent-ink font-semibold shadow-sm'
                      : 'text-mute hover:bg-panel-3 hover:text-ink'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
            <Link
              to={`/m/${currentHero.moduleId}/${currentHero.sceneId}`}
              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-[10.5px] font-semibold text-accent hover:bg-accent/20 transition-colors"
            >
              Full Workspace →
            </Link>
          </div>
        </div>
      </div>

      {/* Floating Telemetry Indicator Chip */}
      <div className="absolute -top-3.5 right-5 hidden rounded-xl border border-line-2 bg-panel-2/95 px-3.5 py-2 shadow-2xl backdrop-blur-xl ring-1 ring-white/[0.06] sm:block">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
            {currentHero.metric}
          </span>
        </div>
      </div>
    </div>
  )
}

export function Landing() {
  const academic = useAcademic()
  const setAudience = useAudience((s) => s.setAudience)
  const copy = academic ? COPY.academic : COPY.professional
  const { total } = countScenes()
  const [discipline, setDiscipline] = useState('all')

  const activeDiscipline = DISCIPLINES.find((d) => d.id === discipline) ?? DISCIPLINES[0]
  const filteredModules =
    activeDiscipline.modules.length === 0
      ? MODULES
      : MODULES.filter((m) => activeDiscipline.modules.includes(m.id))

  return (
    <div className="h-full overflow-y-auto bg-bg text-ink selection:bg-accent/20 selection:text-accent">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-5">
          <Link to="/" aria-label="Solidify home" className="transition-transform active:scale-95">
            <Logo />
          </Link>
          <nav className="ml-6 hidden items-center gap-6 text-[13.5px] font-medium text-mute md:flex">
            <a href="#systems" className="hover:text-ink transition-colors">
              Systems
            </a>
            <a href="#audiences" className="hover:text-ink transition-colors">
              Who it's for
            </a>
            <Link to="/about" className="hover:text-ink transition-colors">
              How it works
            </Link>
            <Link to="/create" className="flex items-center gap-1.5 hover:text-ink transition-colors">
              Create
              <span className="rounded-full bg-warn/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-warn">Soon</span>
            </Link>
            {/* in Study mode the study links (below) already include it */}
            {academic ? null : (
              <Link to="/challenges" className="hover:text-ink transition-colors">
                Challenges
              </Link>
            )}
          </nav>
          <StudyLinks compact className="hidden md:flex" />
          <div className="ml-auto flex items-center gap-3">
            <AudienceSwitch />
            <AccountMenu compact />
            <Link
              to={copy.primary.to}
              className="hidden rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-accent-ink shadow-sm shadow-accent/20 transition-all hover:brightness-110 active:scale-95 sm:inline-block"
            >
              Open Solidify
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:pt-16 lg:pb-24">
        {/* Modern glow & ambient mesh */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(16,185,129,0.18), transparent 75%), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: 'auto, 48px 48px, 48px 48px',
          }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <div className="inline-flex items-center gap-2.5 rounded-full border border-accent/25 bg-accent/[0.08] px-3.5 py-1 text-[12px] font-medium text-accent backdrop-blur-md shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              {copy.eyebrow}
            </div>

            <h1 className="mt-5 text-[38px] font-semibold leading-[1.06] tracking-[-0.03em] text-ink sm:text-[56px]">
              {copy.title}
            </h1>

            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-mute">{copy.lead}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={copy.primary.to}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-[14.5px] font-semibold text-accent-ink shadow-lg shadow-accent/20 transition-all hover:brightness-110 active:scale-[0.98]"
              >
                {copy.primary.label} <Icon.chevron width={16} height={16} />
              </Link>
              <Link
                to="/promo"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-5 py-3.5 text-[14.5px] font-semibold text-accent backdrop-blur-md transition-all hover:bg-accent/20 active:scale-[0.98]"
              >
                <Icon.tour width={16} height={16} /> Watch 30s Promo
              </Link>
              <a
                href="#systems"
                className="inline-flex items-center justify-center rounded-xl border border-line-2 bg-panel-2/80 px-5 py-3.5 text-[14.5px] font-medium text-ink transition-all hover:border-accent/40 hover:bg-panel-3 active:scale-[0.98]"
              >
                Browse all {MODULES.length} systems
              </a>
            </div>
          </div>

          <HeroInteractiveStage />
        </div>
      </section>

      {/* Stats Band */}
      <section className="border-y border-line bg-panel-2/40 backdrop-blur-sm">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-line md:grid-cols-4">
          <Stat value={total} label="interactive 3D scenes" />
          <Stat value={MODULES.length} label="machine systems" />
          <Stat value="1,000+" label="verified calculations" />
          <Stat value="Any device" label="zero install, runs in browser" />
        </div>
      </section>

      {/* Features Grid */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mb-10 text-center sm:text-left">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-accent">Precision Engineering</p>
          <h2 className="mt-1 text-[26px] font-semibold tracking-tight text-ink sm:text-[32px]">
            Designed for mechanical depth
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {copy.features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-line bg-panel-2/60 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-line-2 hover:bg-panel-2"
            >
              <FeatureIcon name={f.icon} />
              <h3 className="mt-4 text-[15px] font-semibold text-ink group-hover:text-accent transition-colors">{f.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-mute">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Systems Catalogue */}
      <section id="systems" className="mx-auto max-w-6xl scroll-mt-16 px-5 pb-24">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-panel-2 px-3 py-0.5 text-[11px] font-medium text-mute">
              <span>{MODULES.length} Mechanical Assemblies</span>
            </div>
            <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-ink sm:text-[34px]">
              Every system on the tractor — and what it pulls
            </h2>
            <p className="mt-1.5 text-[14.5px] text-mute">
              From the combustion chamber to the soil, each system opens straight into an active 3D cutaway.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-panel-2/70 p-1.5">
            {DISCIPLINES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDiscipline(d.id)}
                className={`rounded-xl px-3 py-1.5 text-[12px] font-medium transition-all ${
                  discipline === d.id
                    ? 'bg-accent text-accent-ink font-semibold shadow-sm'
                    : 'text-mute hover:bg-panel-3 hover:text-ink'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredModules.map((m) => (
            <ModuleCard key={m.id} m={m} academic={academic} />
          ))}
        </div>
      </section>

      {/* Audience Section */}
      <section id="audiences" className="scroll-mt-16 border-t border-line bg-panel-2/30">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-accent">Two Modes</p>
          <h2 className="mt-1 text-[28px] font-semibold tracking-tight text-ink sm:text-[34px]">
            Built for the workshop and the lecture hall
          </h2>
          <p className="mt-1.5 max-w-2xl text-[14.5px] text-mute">
            Same kinematic models, two distinct workflows. Toggle anytime from the top bar on any page.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <AudienceCard
              who="Professional"
              title="Engineers, technicians & operators"
              active={!academic}
              onChoose={() => setAudience('professional')}
              points={[
                'Clean engineering view — mechanisms, sections and sizing calculations only',
                'Size drives, pumps, clutches and hitches with live formulas and parameter sweeps',
                'Demonstrate complex kinematics to clients or teams with exploded and X-ray views',
              ]}
            />
            <AudienceCard
              who="Academic"
              title="Students, educators & researchers"
              active={academic}
              onChoose={() => setAudience('academic')}
              points={[
                'Past-question exam examples loaded directly into the scenes, solved step by step',
                'Frequently examined syllabus topics highlighted across the entire catalogue',
                'Discrepancies in textbook reference answers flagged with exact computed values',
              ]}
            />
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="relative overflow-hidden rounded-3xl border border-line-2 bg-gradient-to-br from-panel-2 via-panel to-panel-2 p-8 sm:p-14 shadow-2xl ring-1 ring-white/[0.05]">
          <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-accent/15 blur-3xl" aria-hidden />
          <h2 className="relative max-w-xl text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
            Open a machine and see how it works.
          </h2>
          <p className="relative mt-2.5 max-w-xl text-[15px] text-mute">
            No registration, no software downloads. Select any system and start slicing.
          </p>
          <div className="relative mt-8 flex flex-wrap gap-3">
            <Link
              to={copy.primary.to}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-[14.5px] font-semibold text-accent-ink shadow-lg shadow-accent/20 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              {copy.primary.label} <Icon.chevron width={16} height={16} />
            </Link>
            <Link
              to="/m/implements/mouldboard"
              className="rounded-xl border border-line-2 bg-panel-3/50 px-6 py-3.5 text-[14.5px] font-medium text-ink transition-all hover:border-accent/40 hover:bg-panel-3 active:scale-[0.98]"
            >
              Watch a plough at work
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-bg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-8 text-[13px] text-dim">
          <Logo size={18} />
          <span className="font-mono text-[12px]">solidify.studio</span>
          <nav className="ml-auto flex items-center gap-6">
            <a href="#systems" className="hover:text-ink transition-colors">
              Systems
            </a>
            <a href="#audiences" className="hover:text-ink transition-colors">
              Audience Modes
            </a>
            <Link to="/about" className="hover:text-ink transition-colors">
              How it works
            </Link>
            <StudyLinks always compact />
          </nav>
        </div>
      </footer>
    </div>
  )
}
