import { Link } from 'react-router-dom'
import { ERRATA } from '@/content/errata'
import { useAcademic } from './audience'
import { AudienceSwitch } from './AudienceSwitch'
import { Icon } from './icons'
import { Logo } from './Logo'

/** Course codes are internal reference only — keep them out of user-facing text. */
const clean = (t: string) => t.replace(/\s*\((?:[^)]*\bAEE\s?\d{3}[^)]*)\)/g, '').replace(/\bAEE\s?\d{3}\s*/g, '').trim()

const POINTS = [
  {
    title: 'Exact mechanisms',
    text: 'Gear trains, differentials, planetary sets, slider-cranks and Hooke’s joints are driven by a kinematic solver, so speeds, ratios and phase relationships are exact — teeth stay in mesh and a Cardan joint really does fluctuate twice per revolution.',
  },
  {
    title: 'Tested calculations',
    text: 'Every formula lives in a typed physics library with more than a thousand automated tests, pinned to worked reference answers. When a reference answer is wrong, the test asserts the correct value.',
  },
  {
    title: 'Engineering-drawing sections',
    text: 'Cut planes slice any assembly in real time. Cut faces are capped and hatched by material — cast iron, steel, bronze, rubber, fluids — while moving parts stay whole, like a museum cutaway.',
  },
  {
    title: 'Procedural models',
    text: 'Parts are generated from their dimensions — involute gears, cams shaped from valve-timing curves, tyres from size codes — so the geometry follows the engineering, and the download stays small.',
  },
]

export function About() {
  const academic = useAcademic()
  return (
    <div className="h-full overflow-y-auto bg-bg">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-5">
          <Link to="/" aria-label="Solidify home">
            <Logo />
          </Link>
          <div className="ml-auto">
            <AudienceSwitch />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-5 py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-1 text-[13px] text-mute hover:text-ink">
          <Icon.back width={16} height={16} /> Home
        </Link>
        <h1 className="text-[32px] font-semibold tracking-tight">How Solidify works</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-mute">
          Solidify turns agricultural machinery into interactive models you can slice, explode and run — with the engineering behind every motion shown alongside.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {POINTS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-line bg-panel p-5">
              <h2 className="text-[15px] font-semibold text-ink">{p.title}</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-mute">{p.text}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-[20px] font-semibold">Modes</h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-mute">
          <span className="text-ink">Professional</span> shows mechanisms, sections and calculations only. <span className="text-ink">Academic</span> adds past-question
          examples, frequently examined topics, study flags such as “beyond the course notes”, and the corrections below. Switch at the top of any page.
        </p>

        {academic ? (
          <>
            <h2 className="mt-12 text-[20px] font-semibold">Corrections to worked answers</h2>
            <p className="mt-2 max-w-2xl text-[13.5px] text-mute">
              Where a worked answer or marking guide disagrees with a careful computation, scenes show the computed value and mark it. Confirm these with your lecturer.
            </p>
            <div className="mt-4 space-y-2">
              {ERRATA.map((e) => (
                <div key={e.id} className="rounded-xl border border-line bg-panel px-4 py-3">
                  <div className="text-[13.5px] font-semibold text-ink">{clean(e.topic)}</div>
                  <p className="mt-1 text-[13px] text-mute">
                    <span className="text-warn">Given: </span>
                    {clean(e.says)}
                  </p>
                  <p className="text-[13px] text-ink/90">
                    <span className="text-accent">Computed: </span>
                    {clean(e.correct)}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <p className="mt-12 border-t border-line pt-6 text-[12px] text-dim">
          Generic colours are used throughout; no manufacturer branding is reproduced. Dimensions are typical of farm machinery where no specific machine is modelled. · solidify.studio
        </p>
      </div>
    </div>
  )
}
