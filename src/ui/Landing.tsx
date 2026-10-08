import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MODULES, countScenes } from '@/modules/catalog'
import type { ModuleDef } from '@/modules/types'
import { useAcademic, useAudience } from './audience'
import { AudienceSwitch } from './AudienceSwitch'
import { Icon } from './icons'
import { Logo } from './Logo'

const MEDIA = './media'

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
}

const COPY = {
  professional: {
    eyebrow: 'Interactive engineering for agricultural machinery',
    title: (
      <>
        See inside every tractor system.
        <br />
        <span className="text-accent">Then run the numbers.</span>
      </>
    ),
    lead: 'Cut open engines, transmissions, hydraulics, hitches and implements in real time. Watch every mechanism move in slow motion, and size it with the calculations engineers use — gear forces, pump flows, traction, weight transfer and more.',
    primary: { label: 'Explore the tractor', to: '/m/powertrain/line-of-drive' },
    features: [
      { icon: 'cut', title: 'True cutaways', text: 'Slice any assembly at any angle. Cut faces are hatched by material like an engineering drawing; moving parts stay whole so you can watch them work.' },
      { icon: 'sliders', title: 'Live calculations', text: 'Every slider drives the physics: belt tensions, clutch capacity, hydrostatic flow, slip and tractive efficiency, transmissibility — with the working shown.' },
      { icon: 'target', title: 'Verified physics', text: 'Over a thousand automated checks pin the calculations to reference answers, and mechanisms follow exact kinematics: gears mesh, joints fluctuate, differentials split.' },
      { icon: 'tractor', title: 'Runs anywhere', text: 'Nothing to install. A procedural engine keeps downloads small enough for site laptops, workshop PCs and phones in the field.' },
    ],
  },
  academic: {
    eyebrow: 'For agricultural engineering students and lecturers',
    title: (
      <>
        Farm power and machinery,
        <br />
        <span className="text-accent">brought to life in 3D.</span>
      </>
    ),
    lead: 'Every topic from engines to implements as an interactive cutaway. Work through past-paper examples step by step, see the formula with the numbers substituted, and spot where worked answers go wrong.',
    primary: { label: 'Start with the diesel engine', to: '/m/engine/four-stroke-diesel' },
    features: [
      { icon: 'cut', title: 'See what the diagrams mean', text: 'Every textbook figure becomes a model you can turn, slice, explode and run in slow motion, down to 1/200 of real speed.' },
      { icon: 'book', title: 'Worked examples', text: 'Load past-question data into any scene and follow the working: the formula, the numbers substituted, then the answer.' },
      { icon: 'target', title: 'Corrections flagged', text: 'Where a worked answer or marking guide slips, the scene shows the computed value and marks the discrepancy.' },
      { icon: 'tour', title: 'Guided tours', text: 'Each scene has a short guided tour for revision or for teaching a class from the projector.' },
    ],
  },
} as const

function FeatureIcon({ name }: { name: string }) {
  const I = Icon[name as keyof typeof Icon] ?? Icon.target
  return (
    <span className="grid h-9 w-9 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
      <I width={18} height={18} />
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
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(155,209,122,0.08) 0 2px, transparent 2px 12px)' }}
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
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-panel transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_18px_40px_-20px_rgba(155,209,122,0.35)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-panel-2">
        <Media src={`${MEDIA}/modules/${m.id}.jpg`} alt={`${m.title} — 3D scene`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-panel via-transparent to-transparent" />
        <span className="absolute left-3 top-3 rounded-full border border-line-2 bg-bg/70 px-2 py-0.5 text-[11px] font-medium text-ink/80 backdrop-blur">
          {m.scenes.length} scenes
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[16px] font-semibold text-ink group-hover:text-accent">{m.title}</h3>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-mute">{m.blurb}</p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {m.scenes.slice(0, 3).map((s) => (
            <li key={s.id} className="rounded-md bg-panel-3 px-2 py-0.5 text-[11.5px] text-ink/75">
              {s.title}
            </li>
          ))}
          {m.scenes.length > 3 ? <li className="px-1 py-0.5 text-[11.5px] text-dim">+{m.scenes.length - 3} more</li> : null}
        </ul>
        {academic && exam > 0 ? (
          <div className="mt-auto pt-3 text-[11.5px] text-warn/85">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-warn align-middle" />
            {exam} frequently examined {exam === 1 ? 'topic' : 'topics'}
          </div>
        ) : null}
      </div>
    </Link>
  )
}

function AudienceCard({ who, title, points, active, onChoose }: { who: string; title: string; points: string[]; active: boolean; onChoose: () => void }) {
  return (
    <div className={`flex flex-col rounded-2xl border p-6 transition-colors ${active ? 'border-accent/60 bg-accent/[0.06]' : 'border-line bg-panel'}`}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-accent">{who}</p>
      <h3 className="mt-2 text-[20px] font-semibold text-ink">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5 text-[14px] leading-relaxed text-ink/85">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            {p}
          </li>
        ))}
      </ul>
      <button
        onClick={onChoose}
        className={`mt-6 self-start rounded-lg px-4 py-2 text-[13.5px] font-semibold transition-colors ${active ? 'bg-accent text-accent-ink' : 'border border-line-2 text-ink hover:border-accent/50'}`}
      >
        {active ? 'Current mode' : `Switch to ${who.toLowerCase()} mode`}
      </button>
    </div>
  )
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[28px] font-semibold tracking-tight text-ink">{value}</div>
      <div className="text-[13px] text-mute">{label}</div>
    </div>
  )
}

export function Landing() {
  const academic = useAcademic()
  const setAudience = useAudience((s) => s.setAudience)
  const copy = academic ? COPY.academic : COPY.professional
  const { total } = countScenes()

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-5">
          <Link to="/" aria-label="Solidify home">
            <Logo />
          </Link>
          <nav className="ml-4 hidden items-center gap-5 text-[13.5px] text-mute md:flex">
            <a href="#systems" className="hover:text-ink">
              Systems
            </a>
            <a href="#audiences" className="hover:text-ink">
              Who it's for
            </a>
            <Link to="/about" className="hover:text-ink">
              How it works
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <AudienceSwitch />
            <Link to={copy.primary.to} className="hidden rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-accent-ink hover:brightness-110 sm:inline-block">
              Open Solidify
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(60% 60% at 75% 30%, rgba(155,209,122,0.16), transparent 70%), linear-gradient(rgba(147,165,154,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(147,165,154,0.06) 1px, transparent 1px)',
            backgroundSize: 'auto, 48px 48px, 48px 48px',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-12 lg:grid-cols-[1.02fr_1fr] lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-panel/70 px-3 py-1 text-[12px] font-medium text-ink/80">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {copy.eyebrow}
            </p>
            <h1 className="mt-5 text-[38px] font-semibold leading-[1.06] tracking-tight text-ink sm:text-[54px]">{copy.title}</h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-mute">{copy.lead}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={copy.primary.to} className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-[14.5px] font-semibold text-accent-ink hover:brightness-110">
                {copy.primary.label} <Icon.chevron width={16} height={16} />
              </Link>
              <a href="#systems" className="rounded-lg border border-line-2 px-5 py-3 text-[14.5px] text-ink hover:border-accent/40 hover:bg-panel">
                Browse all {MODULES.length} systems
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 rounded-[28px] bg-accent/10 blur-3xl" aria-hidden />
            <div className="relative overflow-hidden rounded-2xl border border-line-2 bg-panel shadow-2xl shadow-black/50">
              <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-line-2" />
                <span className="h-2.5 w-2.5 rounded-full bg-line-2" />
                <span className="h-2.5 w-2.5 rounded-full bg-line-2" />
                <span className="ml-2 truncate text-[11.5px] text-dim">solidify.studio · Line of drive — section view</span>
              </div>
              <Media src={`${MEDIA}/hero.jpg`} alt="Cutaway tractor showing the engine, gearbox and rear axle in section" className="aspect-[16/11] w-full object-cover" />
            </div>
            <div className="absolute -bottom-4 left-5 hidden rounded-xl border border-line-2 bg-panel/95 px-3.5 py-2.5 shadow-xl backdrop-blur sm:block">
              <div className="text-[10.5px] uppercase tracking-wide text-dim">Section view</div>
              <div className="text-[13px] text-ink">Hatched by material · running at 1/50×</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-line bg-panel/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-line md:grid-cols-4">
          <Stat value={total} label="interactive 3D scenes" />
          <Stat value={MODULES.length} label="machine systems" />
          <Stat value="1,000+" label="verified calculations" />
          <Stat value="Any device" label="runs in the browser, nothing to install" />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {copy.features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-line bg-panel p-5">
              <FeatureIcon name={f.icon} />
              <h3 className="mt-4 text-[15px] font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-mute">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Systems */}
      <section id="systems" className="mx-auto max-w-6xl scroll-mt-16 px-5 pb-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[28px] font-semibold tracking-tight text-ink">Every system on the tractor — and what it pulls</h2>
            <p className="mt-1.5 text-[14.5px] text-mute">From the combustion chamber to the soil, each system opens straight into a working 3D scene.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <ModuleCard key={m.id} m={m} academic={academic} />
          ))}
        </div>
      </section>

      {/* Audiences */}
      <section id="audiences" className="scroll-mt-16 border-t border-line bg-panel/30">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-[28px] font-semibold tracking-tight text-ink">Built for the workshop and the lecture hall</h2>
          <p className="mt-1.5 max-w-2xl text-[14.5px] text-mute">Same models, two ways of working. Switch at any time from the top of any page.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <AudienceCard
              who="Professional"
              title="Engineers, technicians and operators"
              active={!academic}
              onChoose={() => setAudience('professional')}
              points={[
                'Clean engineering view — mechanisms, sections and calculations only',
                'Size drives, pumps, clutches and hitches with live, shown working',
                'Explain a machine to a client or trainee with exploded and X-ray views',
              ]}
            />
            <AudienceCard
              who="Academic"
              title="Students and lecturers"
              active={academic}
              onChoose={() => setAudience('academic')}
              points={[
                'Past-question examples loaded into the scenes, solved step by step',
                'Frequently examined topics highlighted across the catalogue',
                'Discrepancies in worked answers flagged with the computed value',
              ]}
            />
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="relative overflow-hidden rounded-3xl border border-line-2 bg-panel p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/15 blur-3xl" aria-hidden />
          <h2 className="relative max-w-xl text-[28px] font-semibold leading-tight tracking-tight text-ink">Open a machine and see how it works.</h2>
          <p className="relative mt-2 max-w-xl text-[14.5px] text-mute">No sign-up, no install. Pick a system and start slicing.</p>
          <div className="relative mt-6 flex flex-wrap gap-3">
            <Link to={copy.primary.to} className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-[14.5px] font-semibold text-accent-ink hover:brightness-110">
              {copy.primary.label} <Icon.chevron width={16} height={16} />
            </Link>
            <Link to="/m/implements/mouldboard" className="rounded-lg border border-line-2 px-5 py-3 text-[14.5px] text-ink hover:border-accent/40">
              Watch a plough at work
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-6 text-[12.5px] text-dim">
          <Logo size={18} />
          <span>solidify.studio</span>
          <nav className="ml-auto flex gap-4">
            <a href="#systems" className="hover:text-ink">
              Systems
            </a>
            <Link to="/about" className="hover:text-ink">
              How it works
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
