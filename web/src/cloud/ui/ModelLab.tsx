import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSim } from '@/core/sim'
import type { SceneDef } from '@/modules/types'
import { previewSpec, streamOrEdit3DScene } from '@/note3d/ai3dCompiler'
import type { CatalogSceneMatch } from '@/note3d/createCatalog'
import type { LiveProgress } from '@/note3d/liveBuild'
import { createSceneDefFromSpec, liveAssembly } from '@/note3d/NoteSceneRenderer'
import { ALLOWED_MATERIALS, evaluateCalculations, type NotePartSpec, type NoteSceneSpec, type NoteShapeKind } from '@/note3d/schema'
import { MATERIALS, type MaterialKey } from '@/render/materials'
import { requestSnapshot } from '@/render/snapshot'
import { useView } from '@/render/view'
import { BuildScreen } from '@/ui/BuildScreen'
import { Icon } from '@/ui/icons'
import { SiteHeader } from '@/ui/SiteHeader'
import { Stage } from '@/ui/Stage'
import { Tex } from '@/ui/Tex'
import { toast } from '@/ui/toast'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { getCreation, saveNewCreation, updateCreation } from '../creations'
import { clearPendingBuild, peekPendingBuild } from '../pendingBuild'
import { ghostBtn, inputCls, primaryBtn } from './Modal'

/** one turn of the conversation about a model (saved newest first, shown oldest first) */
interface Turn {
  id: string
  prompt: string
  response: string
  kind?: 'build' | 'answer' | 'error'
  photoUrl?: string
}

type Tab = 'calculations' | 'dimensions' | 'parts'

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

/** where a live build has got to, from what has actually arrived */
function liveStage(p: LiveProgress | null) {
  if (!p) return 0
  if (p.parts.length) return 3
  if (p.calculations.length) return 2
  if (p.parameters.length) return 1
  return 0
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

  const [spec, setSpec] = useState<NoteSceneSpec | null>(null)
  const [params, setParams] = useState<Record<string, number>>({})
  const [turns, setTurns] = useState<Turn[]>([])
  const [live, setLive] = useState<{ prompt: string; photoUrl?: string; isNew: boolean; progress: LiveProgress | null } | null>(null)
  const [input, setInput] = useState('')
  /** a photo attached to the next message */
  const [attached, setAttached] = useState<{ name: string; url: string } | null>(null)
  const attachRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<Tab>('calculations')
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
  const abortRef = useRef<AbortController | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const cut = useView((s) => s.cut)
  const explode = useView((s) => s.explode)
  const xray = useView((s) => s.xray)
  const labels = useView((s) => s.labels)
  const caliperMode = useView((s) => s.caliperMode)
  const selectedId = useView((s) => s.selectedId)
  const playing = useSim((s) => s.playing)
  const timeScale = useSim((s) => s.timeScale)
  const [cutAxis, setCutAxis] = useState<'x' | 'y' | 'z'>('z')
  const [cutPos, setCutPos] = useState(0.02)

  useEffect(() => {
    document.title = `${spec?.title ?? 'Model'} · Solidify`
  }, [spec?.title])

  // a freshly built model opens with its recommended section, and nothing else switched on
  useEffect(() => {
    if (!spec) return
    const rec = spec.recommendedCut
    if (rec) {
      setCutAxis(Math.abs(rec.normal[0]) > 0.5 ? 'x' : Math.abs(rec.normal[1]) > 0.5 ? 'y' : 'z')
      setCutPos(rec.pos)
      useView.getState().setCut({ enabled: rec.enabled, planes: [{ normal: rec.normal, pos: rec.pos }] })
    } else useView.getState().setCut({ enabled: false, planes: [{ normal: [0, 0, 1], pos: 0 }] })
    useView.getState().setExplode(0)
    useView.getState().setXray(false)
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
  // leaving the page stops a build that is still streaming (a remount straight after, as React's
  // development checks do, keeps it going)
  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      window.setTimeout(() => {
        if (!mountedRef.current) abortRef.current?.abort()
      }, 0)
    }
  }, [])

  const applyCutPlane = (enabled: boolean, axis: 'x' | 'y' | 'z', pos: number) => {
    const normal: [number, number, number] = axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1]
    useView.getState().setCut({ enabled, planes: [{ normal, pos }] })
  }

  /* ----------------------------------------------------------------- saving */

  const savedHistory = (list: Turn[]) => list.filter((t) => t.kind !== 'error').slice(0, 30).map(({ prompt, response }) => ({ prompt: prompt.slice(0, 2000), response: response.slice(0, 2000) }))

  const saveThumbnail = (id: string) => {
    window.setTimeout(() => {
      void requestSnapshot().then((thumbnail) => {
        if (thumbnail && creationIdRef.current === id) void updateCreation(id, { thumbnail }).catch(() => {})
      })
    }, 1600)
  }

  const persist = async (next: { spec: NoteSceneSpec; params: Record<string, number>; turns: Turn[]; prompt: string; fromPhoto: boolean }, asNew: boolean) => {
    const payload = { title: next.spec.title.slice(0, 120) || 'Untitled model', spec: next.spec as unknown as Record<string, unknown>, params: next.params, history: savedHistory(next.turns) }
    lastSavedRef.current = JSON.stringify([next.spec, next.params])
    setSaveState('saving')
    try {
      let id = creationIdRef.current
      if (asNew || !id) {
        id = (await saveNewCreation({ ...payload, prompt: next.prompt.slice(0, 2000), fromPhoto: next.fromPhoto })).id
        creationIdRef.current = id
        setCreationId(id)
        navigate(`/create/${id}`, { replace: true })
      } else await updateCreation(id, payload)
      setSaveState('saved')
      saveThumbnail(id)
    } catch (e) {
      setSaveState('error')
      if (e instanceof ApiError && e.status === 409) toast(e.message, { tone: 'warn', action: { label: 'My models', run: () => navigate('/create/lab') } })
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
    setInput('')
    setAttached(null)
    setLive({ prompt: asked, photoUrl: withPhoto?.url, isNew, progress: null })
    builtHereRef.current = true
    liveAssembly.active = true
    liveAssembly.landed = new Set(isNew ? [] : (spec?.parts ?? []).map((p) => p.id))
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const res = await streamOrEdit3DScene(
        { prompt, currentSpec: isNew ? undefined : (spec ?? undefined), photoDataUrl: withPhoto?.url, history: isNew ? [] : savedHistory(turns).reverse() },
        (progress) => setLive((l) => (l ? { ...l, progress } : l)),
        ac.signal,
      )
      if (res.isQuestion) {
        const next = [{ id: `t-${Date.now()}`, prompt: asked, response: res.explanation, kind: 'answer' as const, photoUrl: withPhoto?.url }, ...turns]
        setTurns(next)
        if (creationIdRef.current) void updateCreation(creationIdRef.current, { history: savedHistory(next) }).catch(() => {})
        return
      }
      const asNew = isNew || res.isNewMachine || !creationIdRef.current
      const next = [{ id: `t-${Date.now()}`, prompt: asked, response: res.explanation, kind: 'build' as const, photoUrl: withPhoto?.url }, ...(asNew ? [] : turns)]
      const p = Object.fromEntries(res.spec.parameters.map((x) => [x.id, x.value]))
      setTurns(next)
      setSpec(res.spec)
      setParams(p)
      if (withPhoto) setPhoto(withPhoto)
      if (asNew || res.matchedCatalogScene) {
        setMatchedCatalog(res.matchedCatalogScene)
        setViewMode('parametric')
      }
      await persist({ spec: res.spec, params: p, turns: next, prompt: asked, fromPhoto: !!withPhoto }, asNew)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      const message =
        e instanceof ApiError && e.status === 401
          ? 'Your sign-in has expired. Sign in again and resend this.'
          : e instanceof ApiError
            ? e.message
            : 'That didn’t work. Please try again.'
      setTurns((list) => [{ id: `t-${Date.now()}`, prompt: asked, response: message, kind: 'error', photoUrl: withPhoto?.url }, ...list])
    } finally {
      setLive(null)
      window.setTimeout(() => {
        liveAssembly.active = false
      }, 900)
    }
  }

  // /create/new: start the build the Create page handed over (once, even under StrictMode)
  useEffect(() => {
    if (routeId !== 'new' || startedRef.current || authStatus === 'loading') return
    const pending = peekPendingBuild()
    if (!pending) {
      void navigate('/create', { replace: true })
      return
    }
    startedRef.current = true
    clearPendingBuild()
    void send(pending.prompt, pending.photo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, authStatus])

  // /create/:id opens a saved model
  useEffect(() => {
    if (!routeId || routeId === 'new' || routeId === creationIdRef.current) return
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
        lastSavedRef.current = JSON.stringify([loaded, p])
        setSpec(loaded)
        setParams(p)
        setTurns(c.history.map((h, i) => ({ id: `saved-${i}`, ...h })))
        setSaveState('saved')
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
  const { results: calcResults } = useMemo(() => evaluateCalculations(shownSpec?.calculations, shownParams), [shownSpec?.calculations, shownParams])
  const parametricScene = useMemo(() => (shownSpec ? createSceneDefFromSpec(shownSpec, shownParams) : null), [shownSpec, shownParams])
  const scene = viewMode === 'catalog' && loadedCatalogScene && !live ? loadedCatalogScene : parametricScene
  const extent = scene?.extent ?? 0.45
  const firstBuild = !!live && live.isNew && !preview
  const messages = [...turns].reverse()

  return (
    <div className="flex h-full flex-col bg-bg text-ink">
      <SiteHeader width="max-w-none" />

      {/* the model's own bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2 sm:px-6">
        <Link to="/create/lab" className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12.5px] text-mute hover:bg-panel-2 hover:text-ink">
          <Icon.back width={14} height={14} /> My models
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
            {live?.progress?.title ?? spec?.title ?? (live ? 'Building…' : 'Model')}
          </button>
        )}
        <span className="text-[12px] text-dim">
          {live ? (live.progress?.title || spec ? 'Building…' : '') : creationId ? (saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved: check your connection' : 'Saved') : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {spec && matchedCatalog && loadedCatalogScene && !live ? (
            <button type="button" onClick={() => setViewMode((m) => (m === 'parametric' ? 'catalog' : 'parametric'))} className={`${viewMode === 'catalog' ? ghostBtn : primaryBtn} px-4 py-1.5 text-[12.5px]`}>
              {viewMode === 'parametric' ? `Open the lab model: ${matchedCatalog.scene.title}` : 'Back to your model'}
            </button>
          ) : null}
          <Link to="/create" className={`${ghostBtn} px-4 py-1.5 text-[12.5px]`}>
            New model
          </Link>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(380px,58vh)_auto] lg:grid-cols-[340px_minmax(0,1fr)_360px] lg:grid-rows-1">
        {/* the conversation */}
        <aside className={`${mobilePane === 'chat' ? 'flex' : 'hidden'} order-2 min-h-[360px] flex-col border-line lg:order-1 lg:flex lg:min-h-0 lg:border-r`}>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {!messages.length && !live ? (
              <p className="rounded-2xl border border-dashed border-line-2 p-4 text-[13px] leading-relaxed text-mute">
                {routeId === 'new' ? 'Starting your build…' : 'Ask for a change, or ask a question about this model.'}
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

          <div className="border-t border-line p-3">
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
                className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] text-ink placeholder:text-dim focus:outline-none disabled:opacity-60"
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
              <div className="flex items-center gap-1 overflow-x-auto border-b border-line px-3 py-1.5 scrollbar-none">
                <Tool on={cut.enabled} onClick={() => applyCutPlane(!cut.enabled, cutAxis, cutPos)}>Section</Tool>
                <Tool on={explode > 0.05} onClick={() => useView.getState().setExplode(explode > 0.05 ? 0 : 0.7)}>Take apart</Tool>
                <Tool on={xray} onClick={() => useView.getState().setXray(!xray)}>X-ray</Tool>
                <Tool on={labels} onClick={() => useView.getState().setLabels(!labels)}>Labels</Tool>
                <Tool on={caliperMode} onClick={() => useView.getState().setCaliperMode(!caliperMode)} title="Click two points on the model to measure between them">Measure</Tool>
                <span className="mx-1 h-4 w-px shrink-0 bg-line" />
                <Tool onClick={() => useSim.getState().toggle()}>{playing ? 'Pause' : 'Play'}</Tool>
                {[0.5, 1, 2].map((spd) => (
                  <Tool key={spd} on={Math.abs(timeScale - spd) < 0.05} onClick={() => useSim.getState().setTimeScale(spd)}>{spd}×</Tool>
                ))}
              </div>
              {cut.enabled || explode > 0.05 ? (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-panel-2/40 px-4 py-2 text-[12px] text-mute">
                  {cut.enabled ? (
                    <div className="flex min-w-55 flex-1 items-center gap-2" role="group" aria-label="Section plane">
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
                    <label className="flex min-w-45 flex-1 items-center gap-2">
                      Apart
                      <input type="range" aria-label="How far apart" min={0} max={1} step={0.02} value={explode} onChange={(e) => useView.getState().setExplode(parseFloat(e.target.value))} className="slider flex-1" />
                    </label>
                  ) : null}
                </div>
              ) : null}
              <div className="relative min-h-0 flex-1">
                <Stage scene={scene} cover={!live && !builtHereRef.current} />
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
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-[13px] text-mute">{authStatus === 'loading' || routeId !== 'new' ? 'Opening your model…' : 'Nothing to show yet.'}</div>
          )}

          {/* phones: choose what sits under the model */}
          <div className="flex gap-1 border-t border-line p-2 lg:hidden" role="tablist" aria-label="Panels">
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
        <aside className={`${mobilePane === 'engineering' ? 'flex' : 'hidden'} order-3 min-h-[360px] flex-col border-line lg:flex lg:min-h-0 lg:border-l`}>
          {viewMode === 'catalog' && loadedCatalogScene?.Panel && !live ? (
            <div className="flex-1 overflow-y-auto p-4">
              <loadedCatalogScene.Panel />
            </div>
          ) : !shownSpec ? (
            <p className="p-4 text-[13px] text-mute">{live ? 'Sizes and calculations appear here as they are worked out.' : ''}</p>
          ) : (
            <>
              <div className="flex gap-1 border-b border-line p-2" role="tablist" aria-label="Model details">
                {(
                  [
                    ['calculations', `Calculations`],
                    ['dimensions', 'Dimensions'],
                    ['parts', `Parts (${shownSpec.parts.length})`],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[12.5px] font-medium transition-colors ${tab === id ? 'bg-ink text-bg' : 'text-mute hover:text-ink'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {tab === 'calculations' ? (
                  calcResults.length ? (
                    <div className="space-y-2">
                      {calcResults.map(({ spec: c, formatted, status }) => (
                        <div key={c.id} className={`bp-fade rounded-2xl border p-3 ${status === 'warn' ? 'border-warn/50 bg-warn/5' : 'border-line-2'}`}>
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
                    <p className="text-[13px] text-mute">{live ? 'Working out the engineering…' : 'This model has no calculations yet. Ask for some in the chat.'}</p>
                  )
                ) : null}

                {tab === 'dimensions' ? (
                  <div className="space-y-3">
                    {shownSpec.parameters.map((p) => {
                      const val = shownParams[p.id] ?? p.value
                      return (
                        <label key={p.id} className="block">
                          <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]">
                            <span className="text-ink">{p.label}</span>
                            <span className="font-mono text-mute">{fmt(val, p.unit)}</span>
                          </div>
                          <input
                            type="range"
                            min={p.min}
                            max={p.max}
                            step={p.step}
                            value={val}
                            disabled={!!live}
                            onChange={(e) => {
                              setViewMode('parametric')
                              setParams((prev) => ({ ...prev, [p.id]: parseFloat(e.target.value) }))
                            }}
                            className="slider w-full"
                          />
                        </label>
                      )
                    })}
                    {spec && !live ? (
                      <button type="button" onClick={() => setParams(Object.fromEntries(spec.parameters.map((p) => [p.id, p.value])))} className={`${ghostBtn} text-[12px]`}>
                        Reset dimensions
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {tab === 'parts' ? (
                  <div className="space-y-2">
                    {shownSpec.parts.map((pt) => (
                      <div
                        key={pt.id}
                        onClick={() => useView.getState().select(selectedId === pt.id ? null : pt.id)}
                        className={`bp-fade flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 transition-colors ${selectedId === pt.id ? 'border-accent bg-accent/10' : 'border-line-2 hover:border-ink/30'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-ink">{pt.name}</div>
                          {pt.info?.summary ? <div className="truncate text-[11.5px] text-mute">{pt.info.summary}</div> : null}
                        </div>
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
                ) : null}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
