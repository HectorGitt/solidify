import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useSim } from '@/core/sim'
import { findModule } from '@/modules/catalog'
import type { SceneDef } from '@/modules/types'
import { generateOrEdit3DScene } from '@/note3d/ai3dCompiler'
import type { CatalogSceneMatch } from '@/note3d/createCatalog'
import { createSceneDefFromSpec } from '@/note3d/NoteSceneRenderer'
import { ALLOWED_MATERIALS, evaluateCalculations, type NotePartSpec, type NoteSceneSpec, type NoteShapeKind } from '@/note3d/schema'
import { MATERIALS, type MaterialKey } from '@/render/materials'
import { useView } from '@/render/view'
import { StudyShell } from '@/study/ui/StudyShell'
import { Stage } from '@/ui/Stage'
import { Icon } from '@/ui/icons'
import { toast } from '@/ui/toast'
import { Tex } from '@/ui/Tex'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { SUPPORT_EMAIL } from '../config'
import { Field, Notice, ghostBtn, inputCls, primaryBtn } from './Modal'

type Role = 'student' | 'teacher' | 'engineer' | 'other'
type Interest = 'describe' | 'photo' | 'customize' | 'chat' | 'classroom'

/** edits to suggest once there is a model; each goes to the AI like anything typed */
const QUICK_EDITS = ['Add a cooling fan', 'Change the housing to aluminium', 'Make it 25% larger', 'Show the fasteners']

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

interface HistoryItem {
  id: string
  prompt: string
  response: string
}

type Tab = 'calculations' | 'dimensions' | 'parts'

/** a toolbar toggle in the app's own style */
function Tool({ on, onClick, children, title }: { on?: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${on ? 'bg-ink text-bg' : 'text-mute hover:bg-panel-2 hover:text-ink'}`}
    >
      {children}
    </button>
  )
}

const selectCls = 'rounded-lg border border-line-2 bg-bg px-2 py-1 text-[12px] text-ink focus:border-accent focus:outline-none'

export default function CreatePage() {
  const [spec, setSpec] = useState<NoteSceneSpec | null>(null)
  const [params, setParams] = useState<Record<string, number>>({})
  const [promptInput, setPromptInput] = useState('')
  const [uploadedPhoto, setUploadedPhoto] = useState<{ name: string; url: string } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [matchedCatalog, setMatchedCatalog] = useState<CatalogSceneMatch | null>(null)
  const [loadedCatalogScene, setLoadedCatalogScene] = useState<SceneDef | null>(null)
  const [viewMode, setViewMode] = useState<'parametric' | 'catalog'>('parametric')
  const [tab, setTab] = useState<Tab>('calculations')

  const [showAddPart, setShowAddPart] = useState(false)
  const [newPartName, setNewPartName] = useState('New part')
  const [newPartKind, setNewPartKind] = useState<NoteShapeKind>('gear')
  const [newPartMaterial, setNewPartMaterial] = useState<MaterialKey>('steel')
  const [newPartMotion, setNewPartMotion] = useState<'none' | 'rotate' | 'translate'>('rotate')

  const [history, setHistory] = useState<HistoryItem[]>([])

  const cut = useView((s) => s.cut)
  const explode = useView((s) => s.explode)
  const xray = useView((s) => s.xray)
  const labels = useView((s) => s.labels)
  const caliperMode = useView((s) => s.caliperMode)
  const playing = useSim((s) => s.playing)
  const timeScale = useSim((s) => s.timeScale)
  const signedIn = useAuth((s) => s.status) === 'signed-in'

  const [cutAxis, setCutAxis] = useState<'x' | 'y' | 'z'>('z')
  const [cutPos, setCutPos] = useState(0.02)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const promptRef = useRef<HTMLInputElement>(null)

  // each new model opens with its recommended section, and nothing else switched on
  useEffect(() => {
    const rec = spec?.recommendedCut
    if (rec) {
      setCutAxis(Math.abs(rec.normal[0]) > 0.5 ? 'x' : Math.abs(rec.normal[1]) > 0.5 ? 'y' : 'z')
      setCutPos(rec.pos)
      useView.getState().setCut({ enabled: rec.enabled, planes: [{ normal: rec.normal, pos: rec.pos }] })
    } else {
      useView.getState().setCut({ enabled: false, planes: [{ normal: [0, 0, 1], pos: 0 }] })
    }
    useView.getState().setExplode(0)
    useView.getState().setXray(false)
    useView.getState().setLabels(false)
  }, [spec?.id])

  useEffect(() => {
    let cancelled = false
    if (!matchedCatalog?.scene.load) {
      setLoadedCatalogScene(null)
      return
    }
    matchedCatalog.scene
      .load()
      .then((mod) => !cancelled && setLoadedCatalogScene(mod.default))
      .catch(() => !cancelled && setLoadedCatalogScene(null))
    return () => {
      cancelled = true
    }
  }, [matchedCatalog])

  const applyCutPlane = (enabled: boolean, axis: 'x' | 'y' | 'z', pos: number) => {
    const normal: [number, number, number] = axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1]
    useView.getState().setCut({ enabled, planes: [{ normal, pos }] })
  }

  const remember = (item: Omit<HistoryItem, 'id'>) => setHistory((prev) => [{ id: `h-${Date.now()}`, ...item }, ...prev.slice(0, 6)])

  /** a failed build says why: not signed in, out of builds for today, or something else */
  const showError = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401)
      toast('Sign in to build a model. Every model is built by Solidify’s AI, which needs an account.', { tone: 'warn', action: { label: 'Sign in', run: () => useAuth.getState().openDialog() } })
    else toast(e instanceof ApiError ? e.message : 'That build didn’t work. Please try again.', { tone: 'warn' })
  }

  const needSignIn = () => {
    toast('Sign in to build your own model, change a sample or build from a photo. Models are built by Solidify’s AI, which needs an account.', { tone: 'warn', action: { label: 'Sign in', run: () => useAuth.getState().openDialog() } })
  }

  const [sampleId, setSampleId] = useState<string | null>(null)
  const sample = SAMPLES.find((x) => x.sceneId === sampleId) ?? null

  /** a sample opens its lab rig right away; nothing is built */
  const openSample = (x: (typeof SAMPLES)[number]) => {
    const mod = findModule(x.moduleId)
    const scene = mod?.scenes.find((sc) => sc.id === x.sceneId)
    if (!mod || !scene) return
    setSpec(null)
    setUploadedPhoto(null)
    setSampleId(x.sceneId)
    setMatchedCatalog({ module: mod, scene })
    setViewMode('catalog')
  }

  // the page opens on the first sample, so there is always something to turn and cut open
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => openSample(SAMPLES[0]), [])

  const build = async (text: string, photo?: { name: string; url: string }) => {
    if (!signedIn) return needSignIn()
    setIsGenerating(true)
    try {
      const res = await generateOrEdit3DScene(text, photo ? undefined : (spec ?? undefined), photo?.url)
      setSpec(res.spec)
      setSampleId(null)
      setParams(Object.fromEntries(res.spec.parameters.map((p) => [p.id, p.value])))
      if (res.isNewMachine || photo || sample) {
        setMatchedCatalog(res.matchedCatalogScene)
        setViewMode('parametric')
      }
      if (photo) setUploadedPhoto(photo)
      remember({ prompt: photo ? `From a photo: ${photo.name}${text ? ` (${text})` : ''}` : text, response: res.explanation })
      setPromptInput('')
    } catch (e) {
      showError(e)
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePromptSubmit = (e?: FormEvent, custom?: string) => {
    e?.preventDefault()
    const text = (custom ?? promptInput).trim()
    if (text) void build(text)
  }

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      void build(promptInput.trim() || file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), { name: file.name, url })
    }
    reader.readAsDataURL(file)
  }

  const handleMaterialChange = (partId: string, nextMat: MaterialKey) => {
    setSpec((prev) => {
      if (!prev) return prev
      const cloned = JSON.parse(JSON.stringify(prev)) as NoteSceneSpec
      const walk = (list: NotePartSpec[]) => {
        for (const pt of list) {
          if (pt.id === partId) pt.material = nextMat
          if (pt.children?.length) walk(pt.children)
        }
      }
      walk(cloned.parts)
      return cloned
    })
  }

  const handleDeletePart = (partId: string) => {
    setSpec((prev) => {
      if (!prev || prev.parts.length <= 1) return prev
      const cloned = JSON.parse(JSON.stringify(prev)) as NoteSceneSpec
      cloned.parts = cloned.parts.filter((p) => p.id !== partId)
      return cloned
    })
  }

  const handleManualAddPart = (e: FormEvent) => {
    e.preventDefault()
    if (!spec) return
    const housing = newPartKind === 'tube' || newPartKind === 'cone'
    const newPart: NotePartSpec = {
      id: `custom-part-${Date.now() % 10000}`,
      name: newPartName.trim() || `Custom ${newPartKind}`,
      material: newPartMaterial,
      role: housing ? 'housing' : newPartMotion === 'none' ? 'static' : 'moving',
      cut: housing,
      position: [0, ((spec.parts.length % 3) - 1) * 0.08, 0.1],
      explode: [0, 0.12, 0.12],
      motion: newPartMotion === 'rotate' ? { kind: 'rotate', axis: 'y', speed: 2.2 } : newPartMotion === 'translate' ? { kind: 'translate', axis: 'y', speed: 1.2, amplitude: 0.03 } : undefined,
      info: { summary: `Added ${newPartKind} (${MATERIALS[newPartMaterial].label}).` },
      shapes:
        newPartKind === 'gear'
          ? [{ kind: 'gear', teeth: 24, module: 0.003, h: 0.028, rInner: 0.012 }]
          : newPartKind === 'pulley'
            ? [{ kind: 'pulley', rOuter: 0.075, rInner: 0.016, h: 0.032 }]
            : newPartKind === 'spring'
              ? [{ kind: 'spring', r: 0.04, wireRadius: 0.006, h: 0.1, turns: 6 }]
              : newPartKind === 'tube'
                ? [{ kind: 'tube', rOuter: 0.085, rInner: 0.068, h: 0.16 }]
                : newPartKind === 'cone'
                  ? [{ kind: 'cone', rTop: 0.09, rBot: 0.04, h: 0.12 }]
                  : newPartKind === 'cylinder'
                    ? [{ kind: 'cylinder', r: 0.035, h: 0.18 }]
                    : [{ kind: 'box', sx: 0.14, sy: 0.06, sz: 0.1 }],
    }
    setSpec((prev) => (prev ? { ...(JSON.parse(JSON.stringify(prev)) as NoteSceneSpec), parts: [...prev.parts, newPart] } : prev))
    setViewMode('parametric')
    setShowAddPart(false)
  }

  const { results: calcResults } = useMemo(() => evaluateCalculations(spec?.calculations, params), [spec?.calculations, params])
  const parametricSceneDef = useMemo(() => (spec ? createSceneDefFromSpec(spec, params) : null), [spec, params])
  const activeSceneDef = viewMode === 'catalog' && loadedCatalogScene ? loadedCatalogScene : parametricSceneDef
  const extent = activeSceneDef?.extent ?? 0.45
  const latest = history[0]

  return (
    <StudyShell
      title="Create in 3D"
      lead="Describe a machine or upload a photo, and get a 3D model you can cut open, take apart, animate and change, with the engineering worked out live."
      right={
        <Link to="/read" className="rounded-full border border-line-2 bg-panel px-3.5 py-1.5 text-[12.5px] font-medium text-ink hover:border-accent/50">
          Read notes in 3D →
        </Link>
      }
    >
      {/* describe, or start from an example */}
      <section className="mb-5 rounded-3xl border border-line bg-panel p-4">
        <form onSubmit={handlePromptSubmit} className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={promptRef}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="Describe a machine, or how to change this one…"
            aria-label="Describe a machine"
            maxLength={2000}
            className="min-w-0 flex-1 rounded-2xl border border-line-2 bg-bg px-4 py-3 text-[14px] text-ink placeholder:text-dim focus:border-accent focus:outline-none"
          />
          <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          <div className="flex gap-2">
            <button type="button" onClick={() => (signedIn ? photoInputRef.current?.click() : needSignIn())} disabled={isGenerating} className={`${ghostBtn} rounded-2xl px-4`} title="Build from a photo or drawing">
              From a photo
            </button>
            <button type="submit" disabled={isGenerating || !promptInput.trim()} className={`${primaryBtn} rounded-2xl px-5`}>
              {isGenerating ? 'Building…' : 'Build'}
            </button>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <span className="mr-1 text-dim">Try</span>
          {SAMPLES.map((x) => (
            <button key={x.sceneId} type="button" aria-pressed={sampleId === x.sceneId} onClick={() => openSample(x)} disabled={isGenerating} className={`rounded-full border px-3 py-1 transition-colors disabled:opacity-50 ${sampleId === x.sceneId ? 'border-ink bg-ink text-bg' : 'border-line-2 text-mute hover:border-ink/40 hover:text-ink'}`}>
              {x.label}
            </button>
          ))}
        </div>
      </section>

      {!activeSceneDef ? (
        <section className="relative flex h-[420px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-line-2 bg-panel px-6 text-center">
          {isGenerating || sample ? (
            <p className="text-[14px] text-ink">{sample ? `Opening the ${sample.label.toLowerCase()}…` : 'Building the model… this can take up to a minute.'}</p>
          ) : (
            <>
              <Icon.build width={30} height={30} className="text-dim" />
              <h2 className="text-[16px] font-semibold text-ink">Your model appears here</h2>
              <p className="max-w-md text-[13px] leading-relaxed text-mute">
                Open a sample above, or describe a machine or build from a photo once you’re signed in. You can section it, take it apart, run it and change it by asking.
              </p>
              {!signedIn ? (
                <button type="button" className={`${primaryBtn} mt-1`} onClick={() => useAuth.getState().openDialog()}>
                  Sign in to build
                </button>
              ) : null}
            </>
          )}
        </section>
      ) : (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* the model */}
        <section className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-line bg-panel">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold text-ink">{activeSceneDef.title}</h2>
              {sample ? <p className="truncate text-[12px] text-mute">Ready-made lab rig, free to explore</p> : latest?.prompt ? <p className="truncate text-[12px] text-mute">“{latest.prompt}”</p> : null}
            </div>
            {spec && matchedCatalog && loadedCatalogScene ? (
              <button type="button" onClick={() => setViewMode((m) => (m === 'parametric' ? 'catalog' : 'parametric'))} className={`${ghostBtn} text-[12px]`}>
                {viewMode === 'parametric' ? `Open the ${matchedCatalog.scene.title} lab` : 'Back to the model'}
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-1.5">
            <Tool on={cut.enabled} onClick={() => applyCutPlane(!cut.enabled, cutAxis, cutPos)}>Section</Tool>
            <Tool on={explode > 0.05} onClick={() => useView.getState().setExplode(explode > 0.05 ? 0 : 0.7)}>Take apart</Tool>
            <Tool on={xray} onClick={() => useView.getState().setXray(!xray)}>X-ray</Tool>
            <Tool on={labels} onClick={() => useView.getState().setLabels(!labels)}>Labels</Tool>
            <Tool on={caliperMode} onClick={() => useView.getState().setCaliperMode(!caliperMode)} title="Click two points on the model to measure between them">Measure</Tool>
            <span className="mx-1 h-4 w-px bg-line" />
            <Tool onClick={() => useSim.getState().toggle()}>{playing ? 'Pause' : 'Play'}</Tool>
            {[0.5, 1, 2].map((spd) => (
              <Tool key={spd} on={Math.abs(timeScale - spd) < 0.05} onClick={() => useSim.getState().setTimeScale(spd)}>{spd}×</Tool>
            ))}
          </div>

          {cut.enabled || explode > 0.05 ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-panel-2/40 px-4 py-2 text-[12px] text-mute">
              {cut.enabled ? (
                <div className="flex min-w-[220px] flex-1 items-center gap-2" role="group" aria-label="Section plane">
                  Section through
                  {(['x', 'y', 'z'] as const).map((ax) => (
                    <button key={ax} type="button" aria-label={`Section across ${ax}`} aria-pressed={cutAxis === ax} onClick={() => { setCutAxis(ax); applyCutPlane(true, ax, cutPos) }} className={`rounded px-1.5 font-mono uppercase ${cutAxis === ax ? 'bg-ink text-bg' : 'hover:text-ink'}`}>
                      {ax}
                    </button>
                  ))}
                  <input type="range" aria-label="Section position" min={-extent * 0.6} max={extent * 0.6} step={extent / 100} value={cutPos} onChange={(e) => { const v = parseFloat(e.target.value); setCutPos(v); applyCutPlane(true, cutAxis, v) }} className="slider flex-1" />
                </div>
              ) : null}
              {explode > 0.05 ? (
                <label className="flex min-w-[180px] flex-1 items-center gap-2">
                  Apart
                  <input type="range" aria-label="How far apart" min={0} max={1} step={0.02} value={explode} onChange={(e) => useView.getState().setExplode(parseFloat(e.target.value))} className="slider flex-1" />
                </label>
              ) : null}
            </div>
          ) : null}

          <div className="relative h-[460px] w-full sm:h-[520px]">
            <Stage scene={activeSceneDef} />
            {isGenerating ? (
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-bg/40 backdrop-blur-[2px]">
                <div className="rounded-full border border-line bg-panel px-4 py-2 text-[12.5px] text-ink shadow-lg">Building the model…</div>
              </div>
            ) : null}
            {uploadedPhoto ? (
              <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-2xl border border-line bg-panel/95 p-1.5 pr-3 shadow-lg backdrop-blur">
                <img src={uploadedPhoto.url} alt={`Reference: ${uploadedPhoto.name}`} className="h-12 w-12 rounded-lg bg-white object-contain" />
                <div className="text-[11.5px]">
                  <div className="font-medium text-ink">Your photo</div>
                  <button type="button" onClick={() => setUploadedPhoto(null)} className="text-mute hover:text-ink">Hide</button>
                </div>
              </div>
            ) : null}
          </div>

          {sample && !isGenerating ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5 text-[12.5px]">
              <span className="flex-1 text-mute">{signedIn ? 'Want your own version? Solidify can build it from a description, then you can change anything.' : 'Sign in to build your own version, change this one, or build from a photo.'}</span>
              <button type="button" onClick={() => (signedIn ? void build(sample.prompt) : needSignIn())} className={`${primaryBtn} px-4 py-1.5 text-[12.5px]`}>
                {signedIn ? 'Build my own version' : 'Sign in to customise'}
              </button>
            </div>
          ) : null}
          {spec && viewMode === 'parametric' && !isGenerating ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-2.5 text-[12px]">
              <span className="mr-1 text-dim">Change it</span>
              {QUICK_EDITS.map((q) => (
                <button key={q} type="button" onClick={() => handlePromptSubmit(undefined, q)} className="rounded-full border border-line-2 px-2.5 py-0.5 text-mute transition-colors hover:border-accent/40 hover:text-ink">
                  {q}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {/* the engineering */}
        <section className="flex min-w-0 flex-col rounded-3xl border border-line bg-panel">
          {viewMode === 'catalog' && loadedCatalogScene?.Panel ? (
            <div className="max-h-[680px] overflow-y-auto p-4">
              <loadedCatalogScene.Panel />
            </div>
          ) : !spec ? (
            <p className="p-4 text-[13px] text-mute">Readings for this sample appear here.</p>
          ) : (
            <>
              <div className="flex gap-1 border-b border-line p-2" role="tablist" aria-label="Model details">
                {(
                  [
                    ['calculations', 'Calculations'],
                    ['dimensions', 'Dimensions'],
                    ['parts', 'Parts'],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex-1 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${tab === id ? 'bg-ink text-bg' : 'text-mute hover:text-ink'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="max-h-[620px] flex-1 overflow-y-auto p-4">
                {tab === 'calculations' ? (
                  calcResults.length ? (
                    <div className="space-y-2">
                      {calcResults.map(({ spec: c, formatted, status }) => (
                        <div key={c.id} className={`rounded-2xl border p-3 ${status === 'warn' ? 'border-warn/50 bg-warn/5' : 'border-line-2'}`}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[12.5px] text-mute">{c.label}</span>
                            <span className="font-mono text-[16px] font-semibold text-ink">
                              {formatted} <span className="text-[12px] font-normal text-mute">{c.unit}</span>
                            </span>
                          </div>
                          {status === 'warn' && c.limit ? <p className="mt-1 text-[11.5px] text-warn">Over the limit: {c.limit.label ?? 'check this value'}</p> : null}
                          {c.latex ? (
                            <div className="mt-1.5 overflow-x-auto text-[11.5px] text-mute">
                              <Tex tex={c.latex} />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-mute">This model has no calculations yet.</p>
                  )
                ) : null}

                {tab === 'dimensions' ? (
                  <div className="space-y-3">
                    {spec.parameters.map((p) => {
                      const val = params[p.id] ?? p.value
                      return (
                        <label key={p.id} className="block">
                          <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]">
                            <span className="text-ink">{p.label}</span>
                            <span className="font-mono text-mute">{p.unit === 'm' ? `${(val * 1000).toFixed(1)} mm` : `${Number(val.toPrecision(4))} ${p.unit}`}</span>
                          </div>
                          <input
                            type="range"
                            min={p.min}
                            max={p.max}
                            step={p.step}
                            value={val}
                            onChange={(e) => {
                              setViewMode('parametric')
                              setParams((prev) => ({ ...prev, [p.id]: parseFloat(e.target.value) }))
                            }}
                            className="slider w-full"
                          />
                        </label>
                      )
                    })}
                    <button type="button" onClick={() => setParams(Object.fromEntries(spec.parameters.map((p) => [p.id, p.value])))} className={`${ghostBtn} text-[12px]`}>
                      Reset dimensions
                    </button>
                  </div>
                ) : null}

                {tab === 'parts' ? (
                  <div className="space-y-2">
                    {spec.parts.map((pt) => (
                      <div key={pt.id} className="flex items-center gap-2 rounded-2xl border border-line-2 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-ink">{pt.name}</div>
                          {pt.info?.summary ? <div className="truncate text-[11.5px] text-mute">{pt.info.summary}</div> : null}
                        </div>
                        <select aria-label={`Material of ${pt.name}`} value={pt.material && pt.material in MATERIALS ? pt.material : 'steel'} onChange={(e) => { setViewMode('parametric'); handleMaterialChange(pt.id, e.target.value as MaterialKey) }} className={selectCls}>
                          {ALLOWED_MATERIALS.slice(0, 26).map((mk) => (
                            <option key={mk} value={mk}>{MATERIALS[mk].label}</option>
                          ))}
                        </select>
                        {spec.parts.length > 1 ? (
                          <button type="button" onClick={() => handleDeletePart(pt.id)} aria-label={`Remove ${pt.name}`} className="rounded-full px-2 text-[13px] text-dim hover:text-danger">×</button>
                        ) : null}
                      </div>
                    ))}

                    {showAddPart ? (
                      <form onSubmit={handleManualAddPart} className="space-y-2 rounded-2xl border border-line-2 p-3">
                        <input aria-label="Part name" value={newPartName} onChange={(e) => setNewPartName(e.target.value)} className={`${inputCls} w-full`} />
                        <div className="grid grid-cols-3 gap-2">
                          <select aria-label="Shape" value={newPartKind} onChange={(e) => setNewPartKind(e.target.value as NoteShapeKind)} className={selectCls}>
                            <option value="gear">Spur gear</option>
                            <option value="pulley">Pulley</option>
                            <option value="spring">Spring</option>
                            <option value="cylinder">Shaft</option>
                            <option value="tube">Tube</option>
                            <option value="cone">Cone</option>
                            <option value="box">Block</option>
                          </select>
                          <select aria-label="Material" value={newPartMaterial} onChange={(e) => setNewPartMaterial(e.target.value as MaterialKey)} className={selectCls}>
                            {ALLOWED_MATERIALS.slice(0, 26).map((mk) => (
                              <option key={mk} value={mk}>{MATERIALS[mk].label}</option>
                            ))}
                          </select>
                          <select aria-label="Motion" value={newPartMotion} onChange={(e) => setNewPartMotion(e.target.value as 'none' | 'rotate' | 'translate')} className={selectCls}>
                            <option value="rotate">Turns</option>
                            <option value="translate">Slides</option>
                            <option value="none">Fixed</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className={primaryBtn}>Add part</button>
                          <button type="button" onClick={() => setShowAddPart(false)} className={ghostBtn}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => setShowAddPart(true)} className={`${ghostBtn} text-[12px]`}>Add a part</button>
                        <button type="button" onClick={() => useView.getState().showAll()} className={`${ghostBtn} text-[12px]`}>Show hidden parts</button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {history.length > 1 ? (
                <details className="border-t border-line px-4 py-2.5 text-[12px]">
                  <summary className="cursor-pointer text-mute">Earlier changes ({history.length - 1})</summary>
                  <ul className="mt-2 space-y-2">
                    {history.slice(1).map((h) => (
                      <li key={h.id}>
                        <div className="text-ink">“{h.prompt}”</div>
                        <div className="text-mute">{h.response}</div>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          )}
        </section>
      </div>
      )}

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
