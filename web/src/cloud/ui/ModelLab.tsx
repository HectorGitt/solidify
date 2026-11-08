import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSim } from '@/core/sim'
import type { SceneDef } from '@/modules/types'
import { previewSpec, streamOrEdit3DScene } from '@/note3d/ai3dCompiler'
import type { CatalogSceneMatch } from '@/note3d/createCatalog'
import type { LiveProgress } from '@/note3d/liveBuild'
import { liveAssembly, useLiveSceneDef } from '@/note3d/NoteSceneRenderer'
import { ChartView, fmtNum } from '@/note3d/ChartView'
import { resolveAssembly } from '@/note3d/assembly'
import { cleanCut, sanitizeGeneratedSpec } from '@/note3d/sanitize'
import { findPart } from '@/note3d/partInfo'
import { ALLOWED_MATERIALS, evaluateCalculations, evaluateChart, type EvaluatedCalculation, type EvaluatedChart, type NoteParameterSpec, type NotePartSpec, type NoteSceneSpec, type NoteShapeKind } from '@/note3d/schema'
import { MATERIALS, type MaterialKey } from '@/render/materials'
import { requestSnapshot } from '@/render/snapshot'
import { useView } from '@/render/view'
import { BuildScreen } from '@/ui/BuildScreen'
import { Icon } from '@/ui/icons'
import { SiteHeader } from '@/ui/SiteHeader'
import { OrientationGizmo, Stage } from '@/ui/Stage'
import { Toolbar } from '@/ui/Toolbar'
import { Readout, Section, Slider } from '@/ui/controls'
import { FoldChevron, usePersisted } from '@/ui/usePersisted'
import { Tex } from '@/ui/Tex'
import { toast } from '@/ui/toast'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { getCreation, saveNewCreation, updateCreation } from '../creations'
import { logEvent } from '../events'
import { useProfile } from '../profile'
import { PublishDialog } from './PublishDialog'
import { LibraryMatches } from './LibraryMatches'
import { clearPendingBuild, peekPendingBuild } from '../pendingBuild'
import { peekPreviewModel, setPreviewModel } from '../previewModel'
import { updateDraft } from '../admin'
import { scoreBuild } from '@/evals/score'
import { ghostBtn, inputCls, primaryBtn } from './Modal'
import { PartInspector } from './PartInspector'
import { WorkspaceBodySkeleton } from '@/ui/Skeleton'
import { dismissTask, startTask } from '@/ui/tasks'
import { ErrorBoundary } from '@/ui/ErrorBoundary'

/** one turn of the conversation about a model (saved newest first, shown oldest first) */
interface Turn {
  id: string
  prompt: string
  response: string
  kind?: 'build' | 'answer' | 'error'
  photoUrl?: string
}

type Tab = 'graphs' | 'calculations' | 'dimensions' | 'parts'

const SUGGESTIONS = ['Make it 25% larger', 'Change the housing to aluminium', 'Add a cooling fan', 'What does each part do?', 'Why is it designed this way?']
const NEW_STEPS = ['Reading your description', 'Choosing the sizes', 'Working out the engineering', 'Placing the parts']
const PHOTO_STEPS = ['Studying your photo', 'Choosing the sizes', 'Working out the engineering', 'Placing the parts']
const BUILD_TIPS = [
  'Parts appear in the 3D view as soon as each one is ready.',
  'Once it’s built, drag the sliders in Dimensions to resize it.',
  'Ask for changes in plain words, like “make the shaft 40 mm longer”.',
  'You can also ask questions, like “why is the tappet there?”.',
  'Every model you build is saved in My models.',
]

const selectCls = 'rounded-lg border border-line-2 bg-bg px-2 py-1 text-[12px] text-ink focus:border-accent focus:outline-none'
const fmt = (v: number, unit?: string) => (unit === 'm' ? `${(v * 1000).toFixed(1)} mm` : `${Number(v.toPrecision(4))}${unit ? ` ${unit}` : ''}`)


/** where a live build has got to, from what has actually arrived */
function liveStage(p: LiveProgress | null) {
  if (!p) return 0
  if (p.parts.length) return 3
  if (p.calculations.length) return 2
  if (p.parameters.length) return 1
  return 0
}

const EXAMPLES = [
  { label: 'Spur gear reducer', prompt: 'A single-stage spur gear reducer, 3 : 1, for a 15 kW motor at 1450 rpm' },
  { label: 'Centrifugal pump', prompt: 'A single-stage centrifugal water pump with volute casing and closed impeller at 2900 rpm' },
  { label: 'Hydraulic cylinder', prompt: 'A double-acting hydraulic cylinder, 80 mm bore, 400 mm stroke, at 160 bar' },
  { label: 'Belt drive', prompt: 'A V-belt drive between a 150 mm and a 400 mm pulley on two shafts with bearings' },
  { label: 'Screw jack', prompt: 'A 5-tonne screw jack with Acme thread, nut, handle and base' },
  { label: 'Bench vice', prompt: 'A cast-iron workshop bench vice with sliding jaw and Acme lead screw' },
]

/** a new workspace: what to build, from words, a photo or an example */
function StartPanel({ onBuild, signedIn }: { onBuild: (text: string, photo?: { name: string; url: string }) => void; signedIn: boolean }) {
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<{ name: string; url: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 8_000_000) return toast('That photo is too large. Please use one under 8 MB.', { tone: 'warn' })
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' && setPhoto({ name: file.name, url: reader.result })
    reader.readAsDataURL(file)
  }
  const go = (e?: FormEvent) => {
    e?.preventDefault()
    if (text.trim() || photo) onBuild(text, photo ?? undefined)
  }
  return (
    <div className="relative isolate flex flex-1 items-center justify-center overflow-y-auto px-5 py-10">
      <div className="bp-grid pointer-events-none absolute inset-0 -z-10 opacity-70" aria-hidden />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--color-bg)_95%)]" aria-hidden />
      <div className="w-full max-w-xl">
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-accent">New model</p>
        <h2 className="mt-1.5 text-[28px] font-semibold tracking-[-0.02em] text-ink">What should we build?</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-mute">Describe a machine or part, or attach a photo or drawing. Solidify builds it part by part in front of you.</p>
        <form onSubmit={go} className="mt-5 rounded-3xl border border-line-2 bg-panel p-2 shadow-xl focus-within:border-accent">
          {photo ? (
            <div className="mb-2 flex items-center gap-2 rounded-2xl bg-panel-2 p-1.5 pr-2">
              <img src={photo.url} alt="" className="h-10 w-10 rounded-lg bg-white object-cover" />
              <span className="min-w-0 flex-1 truncate text-[12px] text-mute">Build from this photo · {photo.name}</span>
              <button type="button" aria-label="Remove the photo" onClick={() => setPhoto(null)} className="rounded-full p-1 text-dim hover:text-ink">
                <Icon.close width={13} height={13} />
              </button>
            </div>
          ) : null}
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                go()
              }
            }}
            rows={3}
            maxLength={2000}
            placeholder={photo ? 'Anything to add? (optional)' : 'e.g. a two-stage gear reducer for a 15 kW motor at 1450 rpm'}
            aria-label="Describe a machine"
            className="w-full resize-none bg-transparent px-3 py-2 text-[15px] text-ink placeholder:text-dim field-bare focus:outline-none"
          />
          <input ref={fileRef} type="file" accept="image/*" onChange={pick} className="hidden" />
          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-mute transition-colors hover:bg-panel-2 hover:text-ink">
              <Icon.camera width={16} height={16} /> Photo or drawing
            </button>
            <button type="submit" disabled={!text.trim() && !photo} className={`${primaryBtn} px-5 py-2`}>
              {signedIn ? 'Build' : 'Sign in to build'}
            </button>
          </div>
        </form>
        {/* checked models already in the library that match what is being typed */}
        <LibraryMatches query={text} className="mt-3" />
        <div className="mt-4 flex flex-wrap gap-1.5">
          {EXAMPLES.map((x) => (
            <button key={x.label} type="button" onClick={() => onBuild(x.prompt)} title={x.prompt} className="rounded-full border border-line-2 bg-panel/70 px-3 py-1 text-[12.5px] text-mute backdrop-blur transition-colors hover:border-ink/40 hover:text-ink">
              {x.label}
            </button>
          ))}
        </div>
        <p className="mt-6 text-[12.5px] text-dim">
          Or{' '}
          <Link to="/create" className="text-mute underline-offset-2 hover:text-ink hover:underline">
            explore the ready-made lab samples
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g
const FUNCS = new Set(['pi', 'PI', 'sqrt', 'sin', 'cos', 'tan', 'atan', 'exp', 'log', 'abs', 'min', 'max', 'step', 'mac'])

function CalcCard({
  result,
  scope,
  parameters,
  units,
  disabled,
  onParam,
  onExplain,
}: {
  result: EvaluatedCalculation
  scope: Record<string, number>
  parameters: NoteParameterSpec[]
  /** unit of each earlier calculation, by id */
  units: Record<string, string>
  disabled: boolean
  onParam: (id: string, v: number) => void
  onExplain: (label: string) => void
}) {
  const [open, setOpen] = useState(false)
  const { spec: c, formatted, status } = result
  const used = [...new Set(c.formula.match(IDENT) ?? [])].filter((id) => !FUNCS.has(id))
  const inputs = parameters.filter((p) => used.includes(p.id))
  const fromResults = used.filter((id) => units[id] !== undefined && !inputs.some((p) => p.id === id))
  // the formula with the numbers it used, e.g. "4.5 × 0.32"
  const worked = c.formula
    .replace(IDENT, (id) => (FUNCS.has(id) ? id : scope[id] !== undefined ? fmtNum(scope[id]) : id))
    .replace(/\*/g, ' × ')
    .replace(/\s+/g, ' ')
  return (
    <div className={`bp-fade rounded-2xl border transition-colors ${status === 'warn' ? 'border-warn/50 bg-warn/5' : open ? 'border-ink/30' : 'border-line-2'}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full p-3 text-left">
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
      </button>
      {open ? (
        <div className="space-y-3 border-t border-line px-3 pb-3 pt-2.5">
          <p className="font-mono text-[11.5px] leading-relaxed text-mute">
            = {worked} = <span className="text-ink">{formatted}</span> {c.unit}
          </p>
          {inputs.map((p) => {
            const v = scope[p.id] ?? p.value
            return (
              <label key={p.id} className="block">
                <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="text-ink">{p.label}</span>
                  <span className="font-mono text-mute">{fmt(v, p.unit)}</span>
                </div>
                <input type="range" min={p.min} max={p.max} step={p.step} value={v} disabled={disabled} onChange={(e) => onParam(p.id, parseFloat(e.target.value))} className="slider w-full" />
              </label>
            )
          })}
          {fromResults.length ? (
            <div className="flex flex-wrap gap-1">
              <span className="text-[11.5px] text-dim">Uses</span>
              {fromResults.map((id) => (
                <span key={id} className="rounded-full border border-line-2 px-2 py-0.5 font-mono text-[11px] text-mute">
                  {id} = {fmtNum(scope[id])} {units[id]}
                </span>
              ))}
            </div>
          ) : null}
          <button type="button" disabled={disabled} onClick={() => onExplain(c.label)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline disabled:opacity-50">
            <Icon.tour width={13} height={13} /> Explain this
          </button>
        </div>
      ) : null}
    </div>
  )
}

/** the student's side of a turn: their words, with a small thumbnail of a photo they sent */
function UserBubble({ text, photoUrl }: { text: string; photoUrl?: string }) {
  return (
    <div className="ml-6 flex items-center gap-2.5 rounded-2xl rounded-br-md bg-ink px-3 py-2.5 text-[13px] leading-snug text-bg">
      {photoUrl ? <img src={photoUrl} alt="Your photo" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-bg/20" /> : null}
      <span className="min-w-0">{text}</span>
    </div>
  )
}

/** layout problems already counted in this visit */
const flaggedLayouts = new Set<string>()

/** turns rated in this visit, so a re-render (or opening the same model again) does not ask twice */
const rated = new Map<string, 'up' | 'down'>()

/** thumbs up or down on a reply; a thumbs down asks, optionally, what was wrong */
function Rating({ turnId, subject, prompt }: { turnId: string; subject: string; prompt: string }) {
  const [value, setValue] = useState(rated.get(turnId) ?? null)
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const rate = (v: 'up' | 'down', detail?: string) => {
    rated.set(turnId, v)
    setValue(v)
    logEvent(v === 'up' ? 'rating-up' : 'rating-down', subject, detail)
  }
  if (asking)
    return (
      <form
        className="mt-2 flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          setAsking(false)
          rate('down', `${note.trim() || 'no note'} · asked: ${prompt}`)
        }}
      >
        <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="What was wrong? (optional)" aria-label="What was wrong" className={`${inputCls} py-1! text-[12px]`} />
        <button type="submit" className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium text-accent hover:bg-panel-2">
          Send
        </button>
      </form>
    )
  const btn = 'grid h-6 w-6 place-items-center rounded-full transition-colors disabled:cursor-default'
  return (
    <div className="mt-1.5 flex items-center gap-0.5 text-dim">
      {value ? (
        <span className="text-[11.5px]">{value === 'up' ? 'Thanks!' : 'Thanks, we’ll look into it.'}</span>
      ) : (
        <>
          <button type="button" title="Good reply" aria-label="Good reply" onClick={() => rate('up')} className={`${btn} hover:bg-panel-2 hover:text-accent`}>
            <Icon.thumbUp width={13} height={13} />
          </button>
          <button type="button" title="Something’s wrong" aria-label="Something’s wrong" onClick={() => setAsking(true)} className={`${btn} hover:bg-panel-2 hover:text-warn`}>
            <Icon.thumbDown width={13} height={13} />
          </button>
        </>
      )}
    </div>
  )
}

/** the assistant's side of a turn that is still being written */
function LiveReply({ progress, isNew, photo }: { progress: LiveProgress | null; isNew: boolean; photo: boolean }) {
  const stage = liveStage(progress)
  const steps = isNew ? (photo ? PHOTO_STEPS : NEW_STEPS) : ['Reading your request', 'Updating the sizes', 'Re-checking the engineering', 'Rebuilding the parts']
  if (progress?.isQuestion) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-mute">
        <span className="relative flex h-3 w-3 items-center justify-center">
          <span className="bp-ping absolute inset-0 rounded-full bg-accent/50" />
          <span className="h-2 w-2 rounded-full bg-accent" />
        </span>
        Thinking about your question…
      </div>
    )
  }
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
        <span className="relative flex h-3 w-3 items-center justify-center">
          <span className="bp-ping absolute inset-0 rounded-full bg-accent/50" />
          <span className="h-2 w-2 rounded-full bg-accent" />
        </span>
        {steps[stage]}…
      </div>
      {progress?.parameters.length ? (
        <div className="flex flex-wrap gap-1">
          {progress.parameters.map((p) => (
            <span key={p.id} className="bp-fade rounded-full border border-line-2 bg-bg px-2 py-0.5 text-[11.5px] text-mute">
              {p.label ?? p.id} <span className="font-mono text-ink">{p.value !== undefined ? fmt(p.value, p.unit) : ''}</span>
            </span>
          ))}
        </div>
      ) : null}
      {progress?.calculations.length ? (
        <p className="bp-fade flex items-center gap-1.5 text-[12px] text-mute">
          <Icon.check width={12} height={12} className="text-accent" />
          Worked out {progress.calculations.length} {progress.calculations.length === 1 ? 'formula' : 'formulas'}
        </p>
      ) : null}
      {progress?.parts.length ? (
        <p className="bp-fade text-[12px] text-mute">
          Placed {progress.parts.length} {progress.parts.length === 1 ? 'part' : 'parts'}:{' '}
          <span className="text-ink">{progress.parts.map((p) => String(p.name ?? p.id)).join(', ')}</span>
        </p>
      ) : null}
    </div>
  )
}

/**
 * The model workspace: a conversation on the left, the model in the middle (parts appear as Gemini writes
 * them), and the engineering on the right. /create/new starts the build the Create page handed over;
 * /create/:id opens a saved model. Every change is saved to My models.
 */
export default function ModelLab() {
  const { id: routeId } = useParams()
  const navigate = useNavigate()
  const authStatus = useAuth((s) => s.status)
  const signedIn = authStatus === 'signed-in'
  const isAdmin = useProfile((s) => !!s.profile?.isAdmin)
  const [publishing, setPublishing] = useState(false)

  const [spec, setSpec] = useState<NoteSceneSpec | null>(null)
  const [params, setParams] = useState<Record<string, number>>({})
  const [turns, setTurns] = useState<Turn[]>([])
  const [live, setLive] = useState<{ prompt: string; photoUrl?: string; isNew: boolean; progress: LiveProgress | null } | null>(null)
  const [input, setInput] = useState('')
  /** a photo attached to the next message */
  const [attached, setAttached] = useState<{ name: string; url: string } | null>(null)
  const attachRef = useRef<HTMLInputElement>(null)
  const [, setTab] = useState<Tab>('calculations')
  const [mobilePane, setMobilePane] = useState<'chat' | 'engineering'>('chat')
  const [matchedCatalog, setMatchedCatalog] = useState<CatalogSceneMatch | null>(null)
  const [loadedCatalogScene, setLoadedCatalogScene] = useState<SceneDef | null>(null)
  const [viewMode, setViewMode] = useState<'parametric' | 'catalog'>('parametric')
  const [photo, setPhoto] = useState<{ name: string; url: string } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [showAddPart, setShowAddPart] = useState(false)
  const [newPart, setNewPart] = useState<{ name: string; kind: NoteShapeKind; material: MaterialKey; motion: 'none' | 'rotate' | 'translate' }>({ name: 'New part', kind: 'gear', material: 'steel', motion: 'rotate' })

  const [creationId, setCreationId] = useState<string | null>(null)
  const creationIdRef = useRef<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const lastSavedRef = useRef('')
  const startedRef = useRef(false)
  /** once a build has streamed here, the finished model replaces the preview without a loading cover */
  const builtHereRef = useRef(false)
  /** the camera resets only for a new model or a different saved one, not as a build turns into the finished model */
  const [viewKey, setViewKey] = useState(routeId ?? 'model')
  const abortRef = useRef<AbortController | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const selectedId = useView((s) => s.selectedId)
  const [detailsOpen, setDetailsOpen] = usePersisted('solidify.panel.details', true)
  const hiddenParts = useView((s) => s.hidden)
  const isolatedId = useView((s) => s.isolatedId)

  useEffect(() => {
    document.title = `${spec?.title ?? 'Model'} · Solidify`
  }, [spec?.title])

  // a freshly built model opens with its recommended section, and nothing else switched on
  useEffect(() => {
    if (!spec) return
    // saved models may hold a section plane written before it was checked
    const rec = spec.recommendedCut ? cleanCut(spec.recommendedCut) : undefined
    if (rec) {
      useView.getState().setCut({ enabled: rec.enabled, planes: [{ normal: rec.normal, pos: rec.pos }] })
    } else useView.getState().setCut({ enabled: false, planes: [{ normal: [0, 0, 1], pos: 0 }] })
    useView.getState().setExplode(0)
    useView.getState().setXray(false)
    useView.getState().showAll()
    // generated motion is in real time: open at 1×, running (slow motion is one click away on the toolbar)
    useSim.setState({ playing: true, timeScale: 1 })
    setTab(spec.charts?.length ? 'graphs' : 'calculations')
    useView.getState().select(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec?.id])

  useEffect(() => {
    let cancelled = false
    if (!matchedCatalog?.scene.load) {
      setLoadedCatalogScene(null)
      return
    }
    matchedCatalog.scene
      .load()
      .then((m) => !cancelled && setLoadedCatalogScene(m.default))
      .catch(() => !cancelled && setLoadedCatalogScene(null))
    return () => {
      cancelled = true
    }
  }, [matchedCatalog])

  // (scrollIntoView returns a promise in some browsers; an effect must not return it)
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [turns.length, live?.progress?.parts.length, live?.progress?.parameters.length, !!live])
  // leaving the page does not stop a build: it carries on as a background task and saves to My models
  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  /** each build's number: a build only writes to the screen while it is still this page's current one */
  const buildSeq = useRef(0)


  /* ----------------------------------------------------------------- saving */

  const savedHistory = (list: Turn[]) => list.filter((t) => t.kind !== 'error').slice(0, 30).map(({ prompt, response }) => ({ prompt: prompt.slice(0, 2000), response: response.slice(0, 2000) }))

  const saveThumbnail = (id: string) => {
    window.setTimeout(() => {
      void requestSnapshot().then((thumbnail) => {
        if (thumbnail && creationIdRef.current === id) void updateCreation(id, { thumbnail }).catch(() => {})
      })
    }, 1600)
  }

  /** saves a build: `id` is the model it changed (none for a new one); `attached` says whether this page still shows it */
  const persist = async (
    next: { spec: NoteSceneSpec; params: Record<string, number>; turns: Turn[]; prompt: string; fromPhoto: boolean },
    asNew: boolean,
    ctx: { id: string | null; attached: () => boolean },
  ): Promise<string | null> => {
    const payload = { title: next.spec.title.slice(0, 120) || 'Untitled model', spec: next.spec as unknown as Record<string, unknown>, params: next.params, history: savedHistory(next.turns) }
    if (ctx.attached()) {
      lastSavedRef.current = JSON.stringify([next.spec, next.params])
      setSaveState('saving')
    }
    try {
      let id = ctx.id
      if (asNew || !id) {
        id = (await saveNewCreation({ ...payload, prompt: next.prompt.slice(0, 2000), fromPhoto: next.fromPhoto })).id
        if (ctx.attached()) {
          creationIdRef.current = id
          setCreationId(id)
          navigate(`/create/${id}`, { replace: true })
        }
      } else await updateCreation(id, payload)
      if (ctx.attached()) {
        setSaveState('saved')
        saveThumbnail(id)
      }
      return id
    } catch (e) {
      if (ctx.attached()) setSaveState('error')
      if (e instanceof ApiError && e.status === 409) toast(e.message, { tone: 'warn', action: { label: 'My models', run: () => navigate('/create/lab') } })
      return null
    }
  }

  // changes by hand (sliders, materials, parts) save a moment after the last one
  useEffect(() => {
    const id = creationIdRef.current
    if (!id || !spec || live) return
    const snapshot = JSON.stringify([spec, params])
    if (snapshot === lastSavedRef.current) return
    setSaveState('saving')
    const t = window.setTimeout(() => {
      lastSavedRef.current = snapshot
      updateCreation(id, { spec: spec as unknown as Record<string, unknown>, params, title: spec.title.slice(0, 120) || 'Untitled model' })
        .then(() => {
          setSaveState('saved')
          saveThumbnail(id)
        })
        .catch(() => setSaveState('error'))
    }, 1500)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, params, live])

  /* ----------------------------------------------------------------- the conversation */

  const send = async (text: string, withPhoto?: { name: string; url: string }) => {
    const prompt = text.trim() || (withPhoto ? (spec ? 'Change the model to match this photo' : 'Build what this photo shows') : '')
    if (!prompt || live) return
    if (!signedIn) {
      toast('Sign in to build and change models. They are built by Solidify’s AI, which needs an account.', { tone: 'warn', action: { label: 'Sign in', run: () => useAuth.getState().openDialog() } })
      return
    }
    const isNew = !spec
    const asked = withPhoto && !text.trim() ? (isNew ? `From a photo: ${withPhoto.name}` : 'Change it to match this photo') : prompt
    // a background task: it keeps going if the student leaves, and writes to this screen only while it is still here
    const token = ++buildSeq.current
    const attached = () => mountedRef.current && buildSeq.current === token
    const startId = creationIdRef.current
    const short = asked.length > 48 ? `${asked.slice(0, 46)}…` : asked
    const task = startTask(isNew ? `Building: ${short}` : `Changing ${spec?.title ?? 'your model'}`, startId ? `/create/${startId}` : '/create/new')
    setInput('')
    setAttached(null)
    setLive({ prompt: asked, photoUrl: withPhoto?.url, isNew, progress: null })
    builtHereRef.current = true
    if (isNew) setViewKey(`build-${Date.now()}`)
    // a model being assembled holds still: the scene is rebuilt as each part lands, which would restart
    // every moving part and make it jerk; motion resumes once the build is done
    const wasPlaying = useSim.getState().playing
    useSim.getState().setPlaying(false)
    liveAssembly.active = true
    liveAssembly.landed = new Set(isNew ? [] : (spec?.parts ?? []).map((p) => p.id))
    liveAssembly.dropping = new Map()
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const res = await streamOrEdit3DScene(
        { prompt, currentSpec: isNew ? undefined : (spec ?? undefined), photoDataUrl: withPhoto?.url, history: isNew ? [] : savedHistory(turns).reverse() },
        (progress) => {
          if (attached()) setLive((l) => (l ? { ...l, progress } : l))
          task.update(progress.isQuestion ? 'Answering' : progress.parts.length ? `${progress.parts.length} ${progress.parts.length === 1 ? 'part' : 'parts'} placed` : 'Working out the engineering')
        },
        ac.signal,
      )
      if (res.isQuestion) {
        const next = [{ id: `t-${Date.now()}`, prompt: asked, response: res.explanation, kind: 'answer' as const, photoUrl: withPhoto?.url }, ...turns]
        if (attached()) setTurns(next)
        if (startId) void updateCreation(startId, { history: savedHistory(next) }).catch(() => {})
        // an answer is quick: only worth a notice if the student has moved on
        if (attached()) dismissTask(task.id)
        else task.finish({ message: 'Your answer is ready.' })
        return
      }
      const asNew = isNew || res.isNewMachine || !startId
      const next = [{ id: `t-${Date.now()}`, prompt: asked, response: res.explanation, kind: 'build' as const, photoUrl: withPhoto?.url }, ...(asNew ? [] : turns)]
      const p = Object.fromEntries(res.spec.parameters.map((x) => [x.id, x.value]))
      if (attached()) {
        setTurns(next)
        setSpec(res.spec)
        setParams(p)
        if (withPhoto) setPhoto(withPhoto)
        if (asNew || res.matchedCatalogScene) {
          setMatchedCatalog(res.matchedCatalogScene)
          setViewMode('parametric')
        }
      }
      const savedId = await persist({ spec: res.spec, params: p, turns: next, prompt: asked, fromPhoto: !!withPhoto }, asNew, { id: asNew ? null : startId, attached })
      task.finish({ href: savedId ? `/create/${savedId}` : undefined, message: `${res.spec.title || 'Your model'} is ready.` })
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        dismissTask(task.id)
        return
      }
      const message =
        e instanceof ApiError && e.status === 401
          ? 'Your sign-in has expired. Sign in again and resend this.'
          : e instanceof ApiError
            ? e.message
            : 'That didn’t work. Please try again.'
      if (attached()) {
        setTurns((list) => [{ id: `t-${Date.now()}`, prompt: asked, response: message, kind: 'error', photoUrl: withPhoto?.url }, ...list])
        dismissTask(task.id)
      } else task.fail(message)
    } finally {
      if (attached()) setLive(null)
      if (wasPlaying && attached()) useSim.getState().setPlaying(true)
      window.setTimeout(() => {
        liveAssembly.active = false
      }, 900)
    }
  }

  // /create/new after a saved model was open: start afresh
  useEffect(() => {
    if (routeId !== 'new' || !creationIdRef.current) return
    // a build still running carries on in the background (and saves); this page starts afresh
    buildSeq.current++
    creationIdRef.current = null
    lastSavedRef.current = ''
    startedRef.current = false
    builtHereRef.current = false
    setCreationId(null)
    setSaveState('idle')
    setSpec(null)
    setParams({})
    setTurns([])
    setLive(null)
    setPhoto(null)
    setAttached(null)
    setMatchedCatalog(null)
    setViewMode('parametric')
    setViewKey(`new-${Date.now()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId])

  // /create/new: start the build the Create page handed over (once, even under StrictMode)
  useEffect(() => {
    if (routeId !== 'new' || startedRef.current || authStatus === 'loading') return
    const pending = peekPendingBuild()
    if (!pending) return // the start panel asks what to build
    startedRef.current = true
    clearPendingBuild()
    void send(pending.prompt, pending.photo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, authStatus])

  // /create/preview shows a model without saving it (a draft under review, a library model)
  const viewing = routeId === 'preview' ? peekPreviewModel() : null
  useEffect(() => {
    if (routeId !== 'preview') return
    if (!viewing) {
      navigate('/admin', { replace: true })
      return
    }
    // drafts made before they were cleaned on saving: clean on the way in, so a bad field cannot crash the view
    const loaded = sanitizeGeneratedSpec({ spec: viewing.spec }, viewing.prompt) ?? (viewing.spec as unknown as NoteSceneSpec)
    creationIdRef.current = null
    setCreationId(null)
    setViewKey(`preview-${Date.now()}`)
    setSpec(loaded)
    setParams(Object.fromEntries((loaded.parameters ?? []).map((x) => [x.id, x.value])))
    setTurns(viewing.explanation ? [{ id: 'preview', prompt: viewing.prompt, response: viewing.explanation, kind: 'build' }] : [])
    setSaveState('idle')
    draftBaseRef.current = JSON.stringify([loaded, Object.fromEntries((loaded.parameters ?? []).map((x) => [x.id, x.value]))])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId])

  /* a draft under review: what the reviewer changes here (sizes, materials, parts) can go back into the draft */
  const draftBaseRef = useRef('')
  const [savingDraft, setSavingDraft] = useState(false)
  const draftChanged = !!viewing?.draftId && !!spec && !live && JSON.stringify([spec, params]) !== draftBaseRef.current
  const saveToDraft = async () => {
    if (!viewing?.draftId || !spec) return
    setSavingDraft(true)
    try {
      // the slider settings become the model's own values, then it is scored and pictured again
      const next = { ...spec, parameters: spec.parameters.map((p) => ({ ...p, value: params[p.id] ?? p.value })) }
      const { score, checks } = scoreBuild({ id: 'draft', prompt: viewing.prompt }, { spec: next, explanation: viewing.explanation }, 0)
      const thumbnail = await requestSnapshot({ width: 480 })
      await updateDraft(viewing.draftId, { spec: next as unknown as Record<string, unknown>, score, checks: checks.filter((c) => c.name !== 'under two minutes'), ...(thumbnail ? { thumbnail } : {}) })
      draftBaseRef.current = JSON.stringify([spec, params])
      setPreviewModel({ ...viewing, spec: next as unknown as Record<string, unknown> })
      toast(`Saved to the draft: now scores ${score}.`, { tone: 'ok' })
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t save to the draft.', { tone: 'warn' })
    } finally {
      setSavingDraft(false)
    }
  }

  // /create/:id opens a saved model
  useEffect(() => {
    if (!routeId || routeId === 'new' || routeId === 'preview' || routeId === creationIdRef.current) return
    if (authStatus !== 'signed-in') {
      if (authStatus === 'signed-out') toast('Sign in to open your saved models.', { tone: 'warn', action: { label: 'Sign in', run: () => useAuth.getState().openDialog() } })
      return
    }
    let cancelled = false
    getCreation(routeId)
      .then((c) => {
        if (cancelled) return
        const loaded = c.spec as unknown as NoteSceneSpec
        const p = { ...Object.fromEntries((loaded.parameters ?? []).map((x) => [x.id, x.value])), ...c.params }
        creationIdRef.current = routeId
        setCreationId(routeId)
        setViewKey(routeId)
        lastSavedRef.current = JSON.stringify([loaded, p])
        setSpec(loaded)
        setParams(p)
        setTurns(c.history.map((h, i) => ({ id: `saved-${i}`, ...h })))
        setSaveState('saved')
        // built while the student was elsewhere: no card picture yet
        if (!c.thumbnail) saveThumbnail(routeId)
      })
      .catch((e) => {
        if (cancelled) return
        toast(e instanceof ApiError && e.status === 404 ? 'That saved model no longer exists.' : 'Couldn’t open that saved model.', { tone: 'warn' })
        navigate('/create/lab', { replace: true })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, authStatus])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    void send(input, attached ?? undefined)
  }

  const attach = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 8_000_000) return toast('That photo is too large. Please use one under 8 MB.', { tone: 'warn' })
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' && setAttached({ name: file.name, url: reader.result })
    reader.readAsDataURL(file)
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  /* ----------------------------------------------------------------- editing by hand */

  const editSpec = (fn: (s: NoteSceneSpec) => void) =>
    setSpec((prev) => {
      if (!prev) return prev
      const cloned = JSON.parse(JSON.stringify(prev)) as NoteSceneSpec
      fn(cloned)
      return cloned
    })

  const setMaterial = (partId: string, mat: MaterialKey) =>
    editSpec((s) => {
      const walk = (list: NotePartSpec[]) => list.forEach((pt) => (pt.id === partId ? (pt.material = mat) : pt.children?.length && walk(pt.children)))
      walk(s.parts)
    })

  const removePart = (partId: string) => editSpec((s) => (s.parts = s.parts.length > 1 ? s.parts.filter((p) => p.id !== partId) : s.parts))

  const rename = (e: FormEvent) => {
    e.preventDefault()
    const t = titleDraft.trim()
    if (t && spec) editSpec((s) => (s.title = t.slice(0, 120)))
    setRenaming(false)
  }

  const addPart = (e: FormEvent) => {
    e.preventDefault()
    if (!spec) return
    const { name, kind, material, motion } = newPart
    const housing = kind === 'tube' || kind === 'cone'
    const part: NotePartSpec = {
      id: `custom-part-${Date.now() % 100000}`,
      name: name.trim() || `Custom ${kind}`,
      material,
      role: housing ? 'housing' : motion === 'none' ? 'static' : 'moving',
      cut: housing,
      position: [0, ((spec.parts.length % 3) - 1) * 0.08, 0.1],
      explode: [0, 0.12, 0.12],
      motion: motion === 'rotate' ? { kind: 'rotate', axis: 'y', speed: 2.2 } : motion === 'translate' ? { kind: 'translate', axis: 'y', speed: 1.2, amplitude: 0.03 } : undefined,
      info: { summary: `Added ${kind} (${MATERIALS[material].label}).` },
      shapes:
        kind === 'gear'
          ? [{ kind: 'gear', teeth: 24, module: 0.003, h: 0.028, rInner: 0.012 }]
          : kind === 'pulley'
            ? [{ kind: 'pulley', rOuter: 0.075, rInner: 0.016, h: 0.032 }]
            : kind === 'spring'
              ? [{ kind: 'spring', r: 0.04, wireRadius: 0.006, h: 0.1, turns: 6 }]
              : kind === 'tube'
                ? [{ kind: 'tube', rOuter: 0.085, rInner: 0.068, h: 0.16 }]
                : kind === 'cone'
                  ? [{ kind: 'cone', rTop: 0.09, rBot: 0.04, h: 0.12 }]
                  : kind === 'cylinder'
                    ? [{ kind: 'cylinder', r: 0.035, h: 0.18 }]
                    : kind === 'hexNut'
                      ? [{ kind: 'hexNut', d: 0.05 }]
                      : [{ kind: 'box', sx: 0.14, sy: 0.06, sz: 0.1 }],
    }
    editSpec((s) => s.parts.push(part))
    setViewMode('parametric')
    setShowAddPart(false)
  }

  /* ----------------------------------------------------------------- what is on screen */

  // while a build streams, the parts written so far; otherwise the model
  const preview = useMemo(() => (live?.progress ? previewSpec(live.progress) : null), [live?.progress])
  const shownSpec = preview ?? spec
  const shownParams = useMemo(() => (preview ? Object.fromEntries(preview.parameters.map((p) => [p.id, p.value])) : params), [preview, params])
  const { results: calcResults, scope: calcScope } = useMemo(() => evaluateCalculations(shownSpec?.calculations, shownParams), [shownSpec?.calculations, shownParams])
  const charts = useMemo(() => (shownSpec?.charts ?? []).map((ch) => evaluateChart(ch, calcScope)).filter((ch): ch is EvaluatedChart => !!ch), [shownSpec?.charts, calcScope])
  // the assembly check: parts left floating or buried, which Gemini can be asked to fix
  const layoutIssues = useMemo(() => (spec && !live && viewMode === 'parametric' ? resolveAssembly(spec, calcScope).issues : []), [spec, live, viewMode, calcScope])
  const [layoutDismissed, setLayoutDismissed] = useState('')
  const layoutKey = layoutIssues.map((i) => i.message).join('|')
  // each layout problem a student is shown is counted once, so the team sees which kinds of model go wrong
  useEffect(() => {
    if (!layoutKey || flaggedLayouts.has(layoutKey)) return
    flaggedLayouts.add(layoutKey)
    logEvent('layout-issue', spec?.title, layoutIssues.slice(0, 3).map((i) => i.message).join('; '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey])
  const selectedPart = useMemo(() => (viewMode === 'parametric' ? findPart(shownSpec, selectedId) : null), [shownSpec, selectedId, viewMode])
  // on a phone, choosing a part brings its details up under the model
  useEffect(() => {
    if (selectedPart) setMobilePane('engineering')
  }, [selectedPart?.id])
  const calcUnits = useMemo(() => Object.fromEntries((shownSpec?.calculations ?? []).map((c) => [c.id, c.unit])), [shownSpec?.calculations])
  // one viewport for the page, fed the latest model: parts and arrows update in place as sizes change and parts stream in
  const parametricScene = useLiveSceneDef(shownSpec, shownParams)
  const scene = viewMode === 'catalog' && loadedCatalogScene && !live ? loadedCatalogScene : parametricScene
  const firstBuild = !!live && live.isNew && !preview
  /** a new, empty workspace: the start panel takes the input */
  const blank = routeId === 'new' && !spec && !live && !turns.length
  /** a saved model is being fetched */
  const opening = routeId !== 'new' && routeId !== 'preview' && !spec && !live && authStatus !== 'signed-out'
  const messages = [...turns].reverse()

  return (
    <div className="flex h-full flex-col bg-bg text-ink">
      <SiteHeader width="max-w-none" />
      {publishing && spec ? (
        <PublishDialog
          open
          onClose={() => setPublishing(false)}
          spec={spec as unknown as Record<string, unknown>}
          prompt={turns.at(-1)?.prompt ?? spec.title}
          explanation={turns.find((t) => t.kind !== 'error' && t.kind !== 'answer')?.response}
        />
      ) : null}

      {/* the model's own bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2 sm:px-6">
        <Link to={viewing ? viewing.backTo : '/create/lab'} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12.5px] text-mute hover:bg-panel-2 hover:text-ink">
          <Icon.back width={14} height={14} /> {viewing ? 'Back' : 'My models'}
        </Link>
        <span className="h-4 w-px bg-line" />
        {renaming && spec ? (
          <form onSubmit={rename} className="flex items-center gap-1.5">
            <input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={rename} maxLength={120} aria-label="Model name" className={`${inputCls} py-1 text-[14px]`} />
          </form>
        ) : (
          <button
            type="button"
            disabled={!spec || !!live}
            onClick={() => {
              setTitleDraft(spec?.title ?? '')
              setRenaming(true)
            }}
            className="min-w-0 truncate text-left text-[15px] font-semibold text-ink enabled:hover:underline disabled:cursor-default"
            title={spec ? 'Rename' : undefined}
          >
            {live?.progress?.title ?? spec?.title ?? (live ? 'Building…' : routeId === 'new' ? 'New model' : 'Model')}
          </button>
        )}
        <span className="text-[12px] text-dim">
          {live ? (live.progress?.title || spec ? 'Building…' : '') : routeId === 'preview' && !creationId ? 'Preview, not saved' : creationId ? (saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved: check your connection' : 'Saved') : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {spec && matchedCatalog && loadedCatalogScene && !live ? (
            <button type="button" onClick={() => setViewMode((m) => (m === 'parametric' ? 'catalog' : 'parametric'))} className={`${viewMode === 'catalog' ? ghostBtn : primaryBtn} px-4 py-1.5 text-[12.5px]`}>
              {viewMode === 'parametric' ? `Open the lab model: ${matchedCatalog.scene.title}` : 'Back to your model'}
            </button>
          ) : null}
          {viewing?.draftId ? (
            <button type="button" disabled={!draftChanged || savingDraft} onClick={() => void saveToDraft()} title={draftChanged ? 'Save your changes into the draft under review' : 'Change sizes, materials or parts to save them to the draft'} className={`${primaryBtn} px-4 py-1.5 text-[12.5px]`}>
              {savingDraft ? 'Saving…' : 'Save changes to the draft'}
            </button>
          ) : null}
          {isAdmin && spec && !live && !viewing?.draftId ? (
            <button type="button" onClick={() => setPublishing(true)} className={`${ghostBtn} px-4 py-1.5 text-[12.5px]`}>
              Publish
            </button>
          ) : null}
          {spec || live ? (
            <Link to="/create/new" className={`${ghostBtn} px-4 py-1.5 text-[12.5px]`}>
              New model
            </Link>
          ) : null}
        </div>
      </div>

      {opening ? <WorkspaceBodySkeleton /> : null}
      <div className={`${opening ? 'hidden' : 'grid'} min-h-0 flex-1 ${blank ? 'grid-rows-1' : 'grid-rows-[minmax(380px,58vh)_auto]'} lg:grid-cols-[340px_minmax(0,1fr)_360px] lg:grid-rows-1`}>
        {/* the conversation */}
        <aside className={`${mobilePane === 'chat' && !blank ? 'flex' : 'hidden'} order-2 min-h-[360px] flex-col border-line lg:order-1 lg:flex lg:min-h-0 lg:border-r`}>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {!messages.length && !live ? (
              <p className="rounded-2xl border border-dashed border-line-2 p-4 text-[13px] leading-relaxed text-mute">
                {blank ? 'Your conversation about the model appears here: ask for changes or ask questions once it is built.' : routeId === 'new' ? 'Starting your build…' : 'Ask for a change, or ask a question about this model.'}
              </p>
            ) : null}
            {messages.map((m) => (
              <div key={m.id} className="space-y-2">
                <UserBubble text={m.prompt} photoUrl={m.photoUrl} />
                <div className={`mr-6 rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-[13px] leading-relaxed ${m.kind === 'error' ? 'border-warn/50 bg-warn/5 text-ink' : 'border-line bg-panel text-ink'}`}>
                  {m.kind === 'answer' ? <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-accent">Answer</p> : null}
                  {m.response}
                  {m.kind === 'error' ? (
                    <button type="button" onClick={() => void send(m.prompt)} className="mt-2 block text-[12px] font-medium text-accent hover:underline">
                      Try again
                    </button>
                  ) : signedIn ? (
                    <Rating turnId={`${creationId ?? 'new'}:${m.id}`} subject={spec?.title ?? 'Model'} prompt={m.prompt} />
                  ) : null}
                </div>
              </div>
            ))}
            {live ? (
              <div className="space-y-2">
                <UserBubble text={live.prompt} photoUrl={live.photoUrl} />
                {/* while the build screen tells the story, the chat does not repeat it */}
                {firstBuild ? null : (
                  <div className="mr-6 rounded-2xl rounded-bl-md border border-accent/40 bg-panel px-3.5 py-3">
                    <LiveReply progress={live.progress} isNew={live.isNew} photo={!!live.photoUrl} />
                  </div>
                )}
              </div>
            ) : null}
            <div ref={chatEndRef} />
          </div>

          <div className={`border-t border-line p-3 ${blank ? 'hidden' : ''}`}>
            {spec && !live ? (
              <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-none">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)} className="shrink-0 rounded-full border border-line-2 px-2.5 py-1 text-[11.5px] text-mute transition-colors hover:border-ink/40 hover:text-ink">
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            {attached ? (
              <div className="mb-2 flex items-center gap-2 rounded-2xl border border-line-2 bg-panel p-1.5 pr-2">
                <img src={attached.url} alt="" className="h-10 w-10 rounded-lg bg-white object-cover" />
                <span className="min-w-0 flex-1 truncate text-[12px] text-mute">{spec ? 'Photo for this change' : 'Build from this photo'} · {attached.name}</span>
                <button type="button" aria-label="Remove the photo" onClick={() => setAttached(null)} className="rounded-full p-1 text-dim hover:text-ink">
                  <Icon.close width={13} height={13} />
                </button>
              </div>
            ) : null}
            <input ref={attachRef} type="file" accept="image/*" onChange={attach} className="hidden" />
            <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-line-2 bg-panel p-1.5 focus-within:border-accent">
              <button type="button" aria-label="Attach a photo" title="Attach a photo or drawing" disabled={!!live} onClick={() => attachRef.current?.click()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-mute transition-colors hover:bg-panel-2 hover:text-ink disabled:opacity-40">
                <Icon.camera width={17} height={17} />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                rows={2}
                maxLength={2000}
                disabled={!!live}
                placeholder={attached ? (spec ? 'What should change? (optional)' : 'Anything to add? (optional)') : spec ? 'Ask for a change, or ask a question…' : 'Describe a machine…'}
                aria-label="Message"
                className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] text-ink placeholder:text-dim field-bare focus:outline-none disabled:opacity-60"
              />
              <button type="submit" disabled={!!live || (!input.trim() && !attached)} aria-label="Send" className={`${primaryBtn} h-9 w-9 shrink-0 !p-0`}>
                <Icon.chevron width={16} height={16} className="-rotate-90" />
              </button>
            </form>
          </div>
        </aside>

        {/* the model */}
        <main className="order-1 flex min-h-0 min-w-0 flex-col border-line lg:order-2">
          {firstBuild ? (
            <div className="relative flex-1 overflow-y-auto p-3">
              <BuildScreen
                title={live.photoUrl ? 'Building from your photo' : 'Building your model'}
                prompt={live.photoUrl ? undefined : live.prompt}
                photoUrl={live.photoUrl}
                steps={live.photoUrl ? PHOTO_STEPS : NEW_STEPS}
                stage={liveStage(live.progress)}
                expectedSeconds={60}
                tips={BUILD_TIPS}
              />
            </div>
          ) : scene ? (
            <>
              {layoutIssues.length > 0 && layoutDismissed !== layoutKey ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-warn/10 px-4 py-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 text-ink">
                    <span className="font-semibold">{layoutIssues.length === 1 ? 'A part looks out of place' : `${layoutIssues.length} parts look out of place`}:</span>{' '}
                    {layoutIssues.slice(0, 3).map((i) => i.message).join('; ')}
                    {layoutIssues.length > 3 ? '…' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      logEvent('fix-layout', spec?.title, layoutIssues.slice(0, 3).map((i) => i.message).join('; '))
                      void send(`Fix the layout so every part sits where it belongs, using mounts (coaxial, mesh, against, centered) rather than coordinates. The problems: ${layoutIssues.map((i) => i.message).join('; ')}.`)
                    }}
                    className={`${primaryBtn} px-3.5 py-1 text-[12px]`}
                  >
                    Fix the layout
                  </button>
                  <button type="button" onClick={() => setLayoutDismissed(layoutKey)} className="text-[12px] text-mute hover:text-ink">
                    Dismiss
                  </button>
                </div>
              ) : null}
              <div className="relative min-h-0 flex-1">
                <ErrorBoundary label="3D model" resetKey={scene}>
                <Stage scene={scene} cover={!live && !builtHereRef.current} viewKey={viewMode === 'catalog' && loadedCatalogScene && !live ? undefined : viewKey} />
                </ErrorBoundary>
                {/* the same controls as the lab rigs: views, play and step, slow motion, cuts, taking apart, x-ray,
                    labels, measuring */}
                <div className="pointer-events-none absolute right-3 top-3 z-10 hidden sm:block">
                  <OrientationGizmo scene={scene} />
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 hidden justify-center px-2 sm:flex">
                  <Toolbar scene={scene} />
                </div>
                {live ? (
                  <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2">
                    <div className="flex items-center gap-2 rounded-full border border-line bg-panel/95 px-3.5 py-1.5 text-[12.5px] text-ink shadow-lg backdrop-blur">
                      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                        <span className="bp-ping absolute inset-0 rounded-full bg-accent/50" />
                        <span className="h-2 w-2 rounded-full bg-accent" />
                      </span>
                      {live.progress?.isQuestion ? 'Thinking about your question…' : preview ? `Placing parts · ${preview.parts.length} in place` : 'Working on your change…'}
                    </div>
                  </div>
                ) : null}
                {spec && !live && !selectedPart && viewMode === 'parametric' ? (
                  <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full border border-line bg-panel/90 px-3 py-1 text-[11.5px] text-mute shadow-sm backdrop-blur">
                    Click a part to inspect it
                  </div>
                ) : null}
                {photo && !live ? (
                  <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-2xl border border-line bg-panel/95 p-1.5 pr-3 shadow-lg backdrop-blur">
                    <img src={photo.url} alt={`Reference: ${photo.name}`} className="h-12 w-12 rounded-lg bg-white object-contain" />
                    <div className="text-[11.5px]">
                      <div className="font-medium text-ink">Your photo</div>
                      <button type="button" onClick={() => setPhoto(null)} className="text-mute hover:text-ink">Hide</button>
                    </div>
                  </div>
                ) : null}
              </div>
              {/* phones: the toolbar under the view, so it never covers the model */}
              <div className="flex justify-center border-t border-line px-2 py-2 sm:hidden">
                <Toolbar scene={scene} />
              </div>
            </>
          ) : (
            routeId === 'new' ? (
              <StartPanel
                onBuild={(text, withPhoto) => void send(text, withPhoto)}
                signedIn={signedIn}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-[13px] text-mute">
                {authStatus === 'signed-out' ? (
                  <>
                    <p>Sign in to open your saved models.</p>
                    <button type="button" className={primaryBtn} onClick={() => useAuth.getState().openDialog()}>
                      Sign in
                    </button>
                  </>
                ) : (
                  'Opening your model…'
                )}
              </div>
            )
          )}

          {/* phones: choose what sits under the model */}
          <div className={`flex gap-1 border-t border-line p-2 lg:hidden ${blank ? 'hidden' : ''}`} role="tablist" aria-label="Panels">
            {(
              [
                ['chat', 'Chat'],
                ['engineering', 'Engineering'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={mobilePane === id} onClick={() => setMobilePane(id)} className={`flex-1 rounded-full px-3 py-1.5 text-[12.5px] font-medium ${mobilePane === id ? 'bg-ink text-bg' : 'text-mute'}`}>
                {label}
              </button>
            ))}
          </div>
        </main>

        {/* the engineering */}
        <aside className={`${mobilePane === 'engineering' && !blank ? 'flex' : 'hidden'} order-3 min-h-[360px] flex-col border-line lg:flex lg:min-h-0 lg:border-l`}>
          <ErrorBoundary label="engineering panel" resetKey={shownSpec}>
          {selectedPart && shownSpec ? (
            <>
              <div className="flex items-center gap-2 border-b border-line p-2">
                <button type="button" onClick={() => useView.getState().select(null)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-mute hover:bg-panel-2 hover:text-ink">
                  <Icon.back width={14} height={14} /> All details
                </button>
                <span className="ml-auto pr-2 text-[11.5px] text-dim">Part</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <PartInspector
                  spec={shownSpec}
                  part={selectedPart}
                  scope={calcScope}
                  calcResults={calcResults}
                  editable={!!spec && !live}
                  onParam={(id, v) => setParams((prev) => ({ ...prev, [id]: v }))}
                  onMaterial={(m) => setMaterial(selectedPart.id, m)}
                  onRemove={() => {
                    removePart(selectedPart.id)
                    useView.getState().select(null)
                  }}
                  onAsk={(q) => void send(q)}
                />
              </div>
            </>
          ) : viewMode === 'catalog' && loadedCatalogScene?.Panel && !live ? (
            <div className="flex-1 overflow-y-auto p-4">
              <loadedCatalogScene.Panel />
            </div>
          ) : !shownSpec ? (
            <p className="p-4 text-[13px] text-mute">{live ? 'Sizes and calculations appear here as they are worked out.' : blank ? 'Calculations, sizes and parts appear here once the model is built.' : ''}</p>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="border-b border-line px-4 py-3">
                  <div className="flex items-start gap-2">
                    <h2 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-ink">{shownSpec.title}</h2>
                    {shownSpec.summary ? (
                      <button
                        type="button"
                        onClick={() => setDetailsOpen(!detailsOpen)}
                        aria-expanded={detailsOpen}
                        aria-label={detailsOpen ? 'Hide the description' : 'Show the description'}
                        title={detailsOpen ? 'Hide the description' : 'Show the description'}
                        className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-mute hover:bg-panel-2 hover:text-ink"
                      >
                        <FoldChevron open={detailsOpen} />
                      </button>
                    ) : null}
                  </div>
                  {shownSpec.summary && detailsOpen ? <p className="mt-1 text-[12.5px] leading-relaxed text-mute">{shownSpec.summary}</p> : null}
                </div>
                {calcResults.length ? (
                  <Section title="Live">
                    <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                      {calcResults.slice(0, 9).map((r) => (
                        <Readout key={r.spec.id} label={r.spec.label} value={r.formatted} unit={r.spec.unit} tone={r.status === 'warn' ? 'warn' : 'ink'} />
                      ))}
                    </div>
                  </Section>
                ) : null}
                {shownSpec.parameters.length ? (
                  <Section title="Dimensions">
                    {shownSpec.parameters.map((p) => {
                      const val = shownParams[p.id] ?? p.value
                      // lengths in millimetres, as on the rigs
                      const mm = p.unit === 'm'
                      const k = mm ? 1000 : 1
                      return (
                        <Slider
                          key={p.id}
                          label={p.label}
                          value={val * k}
                          min={p.min * k}
                          max={p.max * k}
                          step={p.step * k}
                          unit={mm ? 'mm' : p.unit}
                          digits={4}
                          onChange={(v) => {
                            if (live) return
                            setViewMode('parametric')
                            setParams((prev) => ({ ...prev, [p.id]: v / k }))
                          }}
                        />
                      )
                    })}
                    {spec && !live ? (
                      <button type="button" onClick={() => setParams(Object.fromEntries(spec.parameters.map((p) => [p.id, p.value])))} className={`${ghostBtn} text-[12px]`}>
                        Reset dimensions
                      </button>
                    ) : null}
                  </Section>
                ) : null}
                {charts.length ? (
                  <Section title="Graphs">
                  <div className="space-y-3">
                    {charts.map((ch) => (
                      <ChartView key={ch.spec.id} chart={ch} />
                    ))}
                    <p className="text-[11.5px] text-dim">Graphs redraw as you change the sizes. Hover or tap a graph to read any point.</p>
                  </div>
                  </Section>
                ) : null}
                <Section title="Working">
                  {calcResults.length ? (
                    <div className="space-y-2">
                      {calcResults.map((r) => (
                        <CalcCard
                          key={r.spec.id}
                          result={r}
                          scope={calcScope}
                          parameters={shownSpec.parameters}
                          units={calcUnits}
                          disabled={!!live}
                          onParam={(id, v) => {
                            setViewMode('parametric')
                            setParams((prev) => ({ ...prev, [id]: v }))
                          }}
                          onExplain={(label) => void send(`Explain how the ${label.toLowerCase()} is worked out, step by step with this model's numbers.`)}
                        />
                      ))}
                      <p className="pt-1 text-[11.5px] text-dim">Open a result to see the numbers it used and change its inputs.</p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-mute">{live ? 'Working out the engineering…' : 'This model has no calculations yet. Ask for some in the chat.'}</p>
                  )}
                </Section>


                <Section title={`Parts (${shownSpec.parts.length})`}>
                  <div className="space-y-2">
                    {shownSpec.parts.map((pt) => (
                      <div
                        key={pt.id}
                        onClick={() => useView.getState().select(selectedId === pt.id ? null : pt.id)}
                        className={`bp-fade flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 transition-colors ${selectedId === pt.id ? 'border-accent bg-accent/10' : 'border-line-2 hover:border-ink/30'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className={`truncate text-[13px] font-medium ${hiddenParts.includes(pt.id) ? 'text-dim line-through' : 'text-ink'}`}>{pt.name}</div>
                          {pt.info?.summary ? <div className="truncate text-[11.5px] text-mute">{pt.info.summary}</div> : null}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            useView.getState().toggleHidden(pt.id)
                          }}
                          aria-label={hiddenParts.includes(pt.id) ? `Show ${pt.name}` : `Hide ${pt.name}`}
                          title={hiddenParts.includes(pt.id) ? 'Show' : 'Hide'}
                          className="rounded-full px-1.5 text-[11.5px] text-dim hover:text-ink"
                        >
                          {hiddenParts.includes(pt.id) ? 'Show' : 'Hide'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            useView.getState().isolate(isolatedId === pt.id ? null : pt.id)
                          }}
                          aria-pressed={isolatedId === pt.id}
                          title="Show only this part"
                          className={`rounded-full px-1.5 text-[11.5px] ${isolatedId === pt.id ? 'text-accent' : 'text-dim hover:text-ink'}`}
                        >
                          Only
                        </button>
                        {spec && !live ? (
                          <>
                            <select
                              aria-label={`Material of ${pt.name}`}
                              value={pt.material && pt.material in MATERIALS ? pt.material : 'steel'}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                setViewMode('parametric')
                                setMaterial(pt.id, e.target.value as MaterialKey)
                              }}
                              className={selectCls}
                            >
                              {ALLOWED_MATERIALS.slice(0, 26).map((mk) => (
                                <option key={mk} value={mk}>
                                  {MATERIALS[mk].label}
                                </option>
                              ))}
                            </select>
                            {spec.parts.length > 1 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removePart(pt.id)
                                }}
                                aria-label={`Remove ${pt.name}`}
                                className="rounded-full px-1.5 text-dim hover:text-danger"
                              >
                                <Icon.close width={13} height={13} />
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    ))}

                    {spec && !live ? (
                      showAddPart ? (
                        <form onSubmit={addPart} className="space-y-2 rounded-2xl border border-line-2 p-3">
                          <input aria-label="Part name" value={newPart.name} onChange={(e) => setNewPart((p) => ({ ...p, name: e.target.value }))} className={`${inputCls} w-full`} />
                          <div className="grid grid-cols-3 gap-2">
                            <select aria-label="Shape" value={newPart.kind} onChange={(e) => setNewPart((p) => ({ ...p, kind: e.target.value as NoteShapeKind }))} className={selectCls}>
                              <option value="gear">Spur gear</option>
                              <option value="pulley">Pulley</option>
                              <option value="spring">Spring</option>
                              <option value="cylinder">Shaft</option>
                              <option value="tube">Tube</option>
                              <option value="cone">Cone</option>
                              <option value="hexNut">Hex nut</option>
                              <option value="box">Block</option>
                            </select>
                            <select aria-label="Material" value={newPart.material} onChange={(e) => setNewPart((p) => ({ ...p, material: e.target.value as MaterialKey }))} className={selectCls}>
                              {ALLOWED_MATERIALS.slice(0, 26).map((mk) => (
                                <option key={mk} value={mk}>
                                  {MATERIALS[mk].label}
                                </option>
                              ))}
                            </select>
                            <select aria-label="Motion" value={newPart.motion} onChange={(e) => setNewPart((p) => ({ ...p, motion: e.target.value as 'none' | 'rotate' | 'translate' }))} className={selectCls}>
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
                      )
                    ) : null}
                  </div>
                </Section>
              </div>
            </>
          )}
        </ErrorBoundary>
        </aside>
      </div>
    </div>
  )
}
