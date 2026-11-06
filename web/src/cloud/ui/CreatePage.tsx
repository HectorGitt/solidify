import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSim } from '@/core/sim'
import { findModule } from '@/modules/catalog'
import type { SceneDef } from '@/modules/types'
import { useView } from '@/render/view'
import { StudyShell } from '@/study/ui/StudyShell'
import { Loader } from '@/ui/Loader'
import { Stage } from '@/ui/Stage'
import { toast } from '@/ui/toast'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { SUPPORT_EMAIL } from '../config'
import { getLibraryItem, listLibrary, type LibraryCard } from '../admin'
import { listCreations, saveNewCreation, type CreationSummary } from '../creations'
import { setPendingBuild } from '../pendingBuild'
import { Field, Notice, ghostBtn, inputCls, primaryBtn } from './Modal'

type Role = 'student' | 'teacher' | 'engineer' | 'other'
type Interest = 'describe' | 'photo' | 'customize' | 'chat' | 'classroom'

/** samples: the app's own lab rigs, open to everyone. Building or changing a model uses the AI and needs sign-in. */
const SAMPLES = [
  { label: 'Diesel engine', moduleId: 'engine', sceneId: 'four-stroke-diesel', prompt: 'A single-cylinder four-stroke diesel engine with crankshaft, piston, valves and injector' },
  { label: 'Gearbox', moduleId: 'powertrain', sceneId: 'gearboxes', prompt: 'A constant-mesh tractor gearbox with layshaft and dog clutches' },
  { label: 'Planetary gear set', moduleId: 'powertrain', sceneId: 'planetary', prompt: 'A planetary gear set with sun, three planets, carrier and ring gear' },
  { label: 'Differential', moduleId: 'powertrain', sceneId: 'differential', prompt: 'A crown wheel and pinion differential with spider gears and diff lock' },
  { label: 'Gear pump', moduleId: 'hydraulics', sceneId: 'pumps', prompt: 'An external gear pump with two spur gears in a housing, 16 cc/rev at 2000 rpm' },
  { label: 'Hydraulic cylinder', moduleId: 'hydraulics', sceneId: 'cylinder', prompt: 'A double-acting hydraulic cylinder, 80 mm bore, 400 mm stroke, at 160 bar' },
  { label: 'Belt drive', moduleId: 'elements', sceneId: 'belts', prompt: 'A V-belt drive between a 150 mm and a 400 mm pulley on two shafts with bearings' },
]

const INTERESTS: { value: Interest; label: string }[] = [
  { value: 'describe', label: 'Describing a design' },
  { value: 'photo', label: 'Modelling from a photo' },
  { value: 'customize', label: 'Detailed customization' },
  { value: 'chat', label: 'Designing by chat' },
  { value: 'classroom', label: 'Using it with a class' },
]

function Choice({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[12.5px] transition-colors ${
        checked ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line-2 text-ink/85 hover:border-accent/40'
      }`}
    >
      {children}
    </button>
  )
}

function WaitlistForm() {
  const user = useAuth((s) => s.user)
  const [email, setEmail] = useState(user?.email ?? '')
  const [name, setName] = useState(user?.name ?? '')
  const [role, setRole] = useState<Role>('student')
  const [interest, setInterest] = useState<Interest[]>([])
  const [useCase, setUseCase] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  const toggle = (v: Interest) => setInterest((xs) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setState('sending')
    setError(null)
    try {
      await api('/v1/waitlist', {
        body: {
          email,
          name: name.trim() || undefined,
          role,
          interest,
          useCase: useCase.trim() || undefined,
          organisation: organisation.trim() || undefined,
          website: website || undefined,
        },
      })
      setState('done')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t join just now. Please try again.')
      setState('idle')
    }
  }

  if (state === 'done')
    return (
      <div className="rounded-2xl border border-accent/40 bg-accent/5 p-5">
        <h2 className="text-[16px] font-semibold text-ink">You’re on the list</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-mute">
          We’ll email {email} with classroom &amp; team rollout updates.
        </p>
      </div>
    )

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-3xl border border-line bg-panel p-5">
      <h2 className="mb-1 text-[16px] font-semibold">Schools &amp; Teams Rollout List</h2>
      <p className="mb-4 text-[12.5px] text-mute">
        Request institutional access or custom department part libraries.
      </p>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Email">
          <input
            className={inputCls}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            maxLength={200}
          />
        </Field>
        <Field label="Name (optional)">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={80}
          />
        </Field>
      </div>
      <div className="mb-3">
        <span className="mb-1.5 block text-[12px] font-medium text-mute">I am a…</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Role">
          {(['student', 'teacher', 'engineer', 'other'] as const).map((r) => (
            <Choice key={r} checked={role === r} onClick={() => setRole(r)}>
              {{ student: 'Student', teacher: 'Teacher / lecturer', engineer: 'Engineer / technician', other: 'Something else' }[r]}
            </Choice>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <span className="mb-1.5 block text-[12px] font-medium text-mute">Most interested in</span>
        <div className="flex flex-wrap gap-1.5">
          {INTERESTS.map((i) => (
            <Choice key={i.value} checked={interest.includes(i.value)} onClick={() => toggle(i.value)}>
              {i.label}
            </Choice>
          ))}
        </div>
      </div>
      <Field label="What would you make? (optional)">
        <textarea
          className={`${inputCls} min-h-[64px] resize-y`}
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          maxLength={1000}
          placeholder="e.g. a model of our maize sheller drive for my final-year project"
        />
      </Field>
      <Field label="School or company (optional)">
        <input
          className={inputCls}
          value={organisation}
          onChange={(e) => setOrganisation(e.target.value)}
          maxLength={120}
          autoComplete="organization"
        />
      </Field>
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        name="website"
      />
      {error ? (
        <div className="mb-3">
          <Notice tone="warn">{error}</Notice>
        </div>
      ) : null}
      <button type="submit" className={`${primaryBtn} w-full py-2.5`} disabled={state === 'sending'}>
        {state === 'sending' ? 'Joining…' : 'Join the rollout list'}
      </button>
    </form>
  )
}

/** a toolbar toggle in the app's own style */
function Tool({ on, onClick, children, title }: { on?: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${on ? 'bg-ink text-bg' : 'text-mute hover:bg-panel-2 hover:text-ink'}`}
    >
      {children}
    </button>
  )
}

/**
 * Create in 3D: the starting point. Describe a machine or upload a photo and the model workspace opens and
 * builds it live; the samples are the app's own lab rigs, open to everyone; recent models are one click away.
 */
export default function CreatePage() {
  const navigate = useNavigate()
  const signedIn = useAuth((s) => s.status) === 'signed-in'
  const [sampleId, setSampleId] = useState<string>(SAMPLES[0].sceneId)
  const [sampleScene, setSampleScene] = useState<SceneDef | null>(null)
  const [recent, setRecent] = useState<CreationSummary[]>([])
  const [library, setLibrary] = useState<LibraryCard[]>([])
  const [showAll, setShowAll] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)

  const cut = useView((s) => s.cut)
  const explode = useView((s) => s.explode)
  const xray = useView((s) => s.xray)
  const labels = useView((s) => s.labels)
  const playing = useSim((s) => s.playing)
  const sample = SAMPLES.find((x) => x.sceneId === sampleId) ?? SAMPLES[0]

  // the chosen sample's lab rig
  useEffect(() => {
    let cancelled = false
    setSampleScene(null)
    const scene = findModule(sample.moduleId)?.scenes.find((sc) => sc.id === sample.sceneId)
    scene
      ?.load?.()
      .then((m) => !cancelled && setSampleScene(m.default))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [sample.moduleId, sample.sceneId])

  useEffect(() => {
    if (!signedIn) return setRecent([])
    listCreations()
      .then((r) => setRecent(r.items.slice(0, 4)))
      .catch(() => {})
  }, [signedIn])

  // approved models from the library: anyone can see them
  useEffect(() => {
    listLibrary()
      .then((r) => setLibrary(r.items))
      .catch(() => {})
  }, [])

  /** a library model opens as the student's own copy, so they can change it like anything they built */
  const openLibrary = async (item: LibraryCard) => {
    if (!signedIn) return needSignIn()
    setOpening(item.id)
    try {
      const full = await getLibraryItem(item.id)
      const { id } = await saveNewCreation({ title: full.title, prompt: full.prompt, spec: full.spec, history: full.explanation ? [{ prompt: full.prompt, response: full.explanation.slice(0, 2000) }] : [] })
      navigate(`/create/${id}`)
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t open that model. Please try again.', { tone: 'warn' })
      setOpening(null)
    }
  }

  const needSignIn = () => {
    toast('Sign in to build your own model, change a sample or build from a photo. Models are built by Solidify’s AI, which needs an account.', { tone: 'warn', action: { label: 'Sign in', run: () => useAuth.getState().openDialog() } })
  }

  /** hands the build to the model workspace, which builds it live */
  const start = (prompt: string, photo?: { name: string; url: string }) => {
    if (!signedIn) return needSignIn()
    setPendingBuild({ prompt, photo })
    navigate('/create/new')
  }

  return (
    <StudyShell
      title="Create in 3D"
      lead="Describe a machine or upload a photo. Solidify builds it part by part in front of you, as a 3D model you can cut open, take apart, run and change by chatting."
      right={
        <div className="flex flex-wrap gap-2">
          <Link to="/create/lab" className={ghostBtn}>
            My models
          </Link>
          <Link to="/create/new" className={primaryBtn}>
            Build a new model
          </Link>
        </div>
      }
    >
      {recent.length ? (
        <section className="mb-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold text-ink">Your recent models</h2>
            <Link to="/create/lab" className="text-[12.5px] text-mute hover:text-ink">
              See all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {recent.map((r) => (
              <Link key={r.id} to={`/create/${r.id}`} className="group overflow-hidden rounded-2xl border border-line bg-panel transition-colors hover:border-line-2">
                <div className="aspect-[4/3] bg-stage">{r.thumbnail ? <img src={r.thumbnail} alt="" className="h-full w-full object-cover" /> : null}</div>
                <div className="truncate px-3 py-2 text-[12.5px] font-medium text-ink group-hover:underline">{r.title}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* samples: real lab rigs */}
      <section className="overflow-hidden rounded-3xl border border-line bg-panel">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-3 text-[12.5px]">
          <span className="mr-1 text-dim">Samples</span>
          {SAMPLES.map((x) => (
            <button key={x.sceneId} type="button" aria-pressed={sampleId === x.sceneId} onClick={() => setSampleId(x.sceneId)} className={`rounded-full border px-3 py-1 transition-colors ${sampleId === x.sceneId ? 'border-ink bg-ink text-bg' : 'border-line-2 text-mute hover:border-ink/40 hover:text-ink'}`}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col border-line lg:border-r">
            <div className="flex items-center gap-1 overflow-x-auto border-b border-line px-3 py-1.5 scrollbar-none">
              <Tool on={cut.enabled} onClick={() => useView.getState().setCut({ enabled: !cut.enabled })}>Section</Tool>
              <Tool on={explode > 0.05} onClick={() => useView.getState().setExplode(explode > 0.05 ? 0 : 0.7)}>Take apart</Tool>
              <Tool on={xray} onClick={() => useView.getState().setXray(!xray)}>X-ray</Tool>
              <Tool on={labels} onClick={() => useView.getState().setLabels(!labels)}>Labels</Tool>
              <span className="mx-1 h-4 w-px shrink-0 bg-line" />
              <Tool onClick={() => useSim.getState().toggle()}>{playing ? 'Pause' : 'Play'}</Tool>
            </div>
            <div className="relative h-[440px] sm:h-[500px]">
              {sampleScene ? <Stage scene={sampleScene} /> : <Loader label={`Opening the ${sample.label.toLowerCase()}…`} className="h-full bg-stage" />}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5 text-[12.5px]">
              <span className="flex-1 text-mute">{signedIn ? 'Want your own version? Solidify builds it part by part, then you can change anything by chatting.' : 'A ready-made lab rig, free to explore. Sign in to build your own version.'}</span>
              <button type="button" onClick={() => start(sample.prompt)} className={`${primaryBtn} px-4 py-1.5 text-[12.5px]`}>
                {signedIn ? 'Build my own version' : 'Sign in to customise'}
              </button>
            </div>
          </div>
          <div className="max-h-[560px] overflow-y-auto p-4">{sampleScene?.Panel ? <sampleScene.Panel /> : <p className="text-[13px] text-mute">Readings for this sample appear here.</p>}</div>
        </div>
      </section>

      {library.length ? (
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">From the library</h2>
              <p className="mt-0.5 text-[12.5px] text-mute">Models built by Solidify and checked by the team. Open one to get your own copy to change.</p>
            </div>
            {library.length > 8 ? (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[12.5px] text-mute hover:text-ink">
                {showAll ? 'Show fewer' : `Show all ${library.length}`}
              </button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(showAll ? library : library.slice(0, 8)).map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!!opening}
                onClick={() => void openLibrary(item)}
                className="group flex flex-col rounded-2xl border border-line bg-panel p-4 text-left transition-colors hover:border-line-2 disabled:opacity-60"
              >
                {item.topic ? <span className="text-[11px] uppercase tracking-wide text-dim">{item.topic}</span> : null}
                <span className="mt-1 text-[13.5px] font-semibold text-ink group-hover:underline">{item.title}</span>
                <span className="mt-1 line-clamp-2 text-[12px] leading-snug text-mute">{item.prompt}</span>
                <span className="mt-auto pt-3 text-[11.5px] text-dim">{opening === item.id ? 'Opening…' : `${item.parts} parts`}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <details className="mt-8 rounded-3xl border border-line p-4">
        <summary className="cursor-pointer text-[13.5px] font-medium text-ink">Using this with a class or a team?</summary>
        <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_420px]">
          <div className="space-y-2 text-[13px] leading-relaxed text-mute">
            <p>Create in 3D uses the same parts library, section tools and tested calculations as every Solidify lab.</p>
            <p>
              For school or company access, or custom templates, email{' '}
              <a className="text-accent hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </div>
          <WaitlistForm />
        </div>
      </details>
    </StudyShell>
  )
}
