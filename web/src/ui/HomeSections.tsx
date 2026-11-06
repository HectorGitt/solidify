import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listLibrary, type LibraryCard } from '@/cloud/admin'
import { useAuth } from '@/cloud/auth'
import { useOpenLibrary } from '@/cloud/library'
import { setPendingBuild } from '@/cloud/pendingBuild'
import { LibraryCardView } from '@/cloud/ui/LibraryCardView'
import { MODULES } from '@/modules/catalog'
import { Icon } from './icons'
import { Media, SOON } from './labsCatalog'
import { RIGS_WITH_FACTS, RigEquations, RigReadings, rigFacts } from './rigFacts'
import { toast } from './toast'

/** one rig a day, the same for everyone that day, with its own figures and equations */
export function RigOfTheDay() {
  const rigs = RIGS_WITH_FACTS.map((key) => {
    const [moduleId, sceneId] = key.split('/')
    const m = MODULES.find((x) => x.id === moduleId)
    const s = m?.scenes.find((x) => x.id === sceneId && x.load)
    return m && s && !SOON.has(m.id) ? { m, s, facts: rigFacts(moduleId, sceneId)! } : null
  }).filter((r): r is NonNullable<typeof r> => !!r && (r.facts.readings.length > 0 || r.facts.equations.length > 0))
  if (!rigs.length) return null
  const { m, s, facts } = rigs[Math.floor(Date.now() / 86_400_000) % rigs.length]
  const to = `/m/${m.id}/${s.id}`
  return (
    <section className="mx-auto grid max-w-[1360px] items-center gap-8 px-5 pt-20 sm:px-10 lg:grid-cols-12 lg:gap-12">
      <Link to={to} className="group relative block overflow-hidden rounded-3xl border border-line bg-[var(--color-stage)] lg:col-span-7">
        <span className="relative block aspect-[16/10]">
          <Media name={`scenes/${m.id}--${s.id}`} alt={`${s.title}, in 3D`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        </span>
        <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-scrim)] px-3.5 py-1.5 text-[12.5px] font-medium text-ink backdrop-blur-md">
          Run this rig <Icon.chevron width={13} height={13} />
        </span>
      </Link>
      <div className="lg:col-span-5">
        <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-accent">Rig of the day</div>
        <div className="mt-3 text-[13px] text-dim">{m.title}</div>
        <h2 className="mt-0.5 text-[30px] font-semibold tracking-[-0.03em] sm:text-[36px]">{s.title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-mute">{s.summary}</p>
        {facts.readings.length ? (
          <div className="mt-5">
            <RigReadings readings={facts.readings} max={3} size="lg" />
          </div>
        ) : null}
        {facts.equations.length ? (
          <div className="mt-5 rounded-2xl border border-line bg-panel p-4">
            <RigEquations equations={facts.equations} max={2} />
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to={to} className="inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-accent-ink hover:opacity-90">
            Open the rig
          </Link>
          <Link to="/labs" className="inline-flex items-center rounded-full border border-line-2 px-5 py-2.5 text-[13.5px] font-medium text-ink hover:border-accent/50">
            All labs
          </Link>
        </div>
      </div>
    </section>
  )
}

const EXAMPLES = ['A worm gear reducer, 30 : 1', 'A propped cantilever with a UDL', 'A single-cylinder diesel engine']

/** the AI side: describe a machine and watch it built, or start from a checked library model */
export function BuildYourOwn() {
  const navigate = useNavigate()
  const signedIn = useAuth((s) => s.status) === 'signed-in'
  const [prompt, setPrompt] = useState('')
  const [library, setLibrary] = useState<LibraryCard[]>([])
  const { opening, open } = useOpenLibrary()
  useEffect(() => {
    listLibrary()
      .then((r) => setLibrary(r.items.slice(0, 4)))
      .catch(() => {})
  }, [])

  const build = (e: FormEvent) => {
    e.preventDefault()
    const p = prompt.trim()
    if (!p) return
    if (!signedIn) {
      toast('Sign in to build your own model. Solidify’s AI builds it part by part, and it’s saved to your account.', { tone: 'warn', action: { label: 'Sign in', run: () => useAuth.getState().openDialog() } })
      return
    }
    setPendingBuild({ prompt: p })
    navigate('/create/new')
  }

  return (
    <section className="mx-auto grid max-w-[1360px] gap-8 px-5 pt-20 sm:px-10 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-5">
        <h2 className="text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">Or describe your own machine.</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-mute">Type what you need, or upload a photo. Solidify builds it part by part in front of you, works out the engineering, and lets you change anything by chatting.</p>
        <form onSubmit={build} className="mt-6 flex flex-col gap-2 sm:flex-row">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={400}
            placeholder={EXAMPLES[0]}
            aria-label="Describe a machine"
            className="min-w-0 flex-1 rounded-full border border-line-2 bg-panel px-4 py-3 text-[14px] text-ink outline-none placeholder:text-dim focus:border-accent/60 focus:ring-2 focus:ring-accent/15"
          />
          <button type="submit" className="rounded-full bg-accent px-5 py-3 text-[14px] font-semibold text-accent-ink hover:opacity-90">
            Build it
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((x) => (
            <button key={x} type="button" onClick={() => setPrompt(x)} className="rounded-full border border-line-2 px-3 py-1 text-[12px] text-mute hover:border-ink/40 hover:text-ink">
              {x}
            </button>
          ))}
          <Link to="/create/new" className="rounded-full border border-line-2 px-3 py-1 text-[12px] text-mute hover:border-ink/40 hover:text-ink">
            From a photo
          </Link>
        </div>
      </div>
      <div className="lg:col-span-7">
        {library.length ? (
          <>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-[13px] font-semibold text-ink">From the library</h3>
              <Link to="/library" className="text-[12.5px] text-mute hover:text-ink">
                See all
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {library.map((item) => (
                <LibraryCardView key={item.id} item={item} opening={opening === item.id} onOpen={() => void open(item)} />
              ))}
            </div>
          </>
        ) : (
          <ol className="grid h-full gap-3 sm:grid-cols-3">
            {[
              ['Describe it', 'In words, with sizes if you have them, or from a photo.'],
              ['Watch it built', 'Parts land one by one as Solidify works out the sizes and the engineering.'],
              ['Change anything', 'Drag the sliders, swap materials, or ask for a change in plain words.'],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-3xl border border-line bg-panel p-5">
                <div className="font-mono text-[12px] text-accent">0{i + 1}</div>
                <div className="mt-2 text-[15px] font-semibold text-ink">{t}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-mute">{d}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
