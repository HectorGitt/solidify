import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SLFY_MIME, SLFY_VERSION, fromSlfy, type SlfyRead } from '@/note3d/slfyFormat'
import { StudyShell } from '@/study/ui/StudyShell'
import { Icon } from '@/ui/icons'
import { setPreviewModel } from '../previewModel'
import { ghostBtn, primaryBtn } from './Modal'

const MAX_BYTES = 2_000_000

interface ExampleCard {
  file: string
  title: string
  summary: string
  parts: number
  calculations: number
  question: boolean
}

type Ready = Extract<SlfyRead, { ok: true }> & { name: string }

/**
 * Opens a .slfy model file (the open model format) in the workspace, with no account: from the computer,
 * from a link (?url=), or from the examples. The file is cleaned like anything from outside before it draws.
 */
export default function OpenFilePage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Ready | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [examples, setExamples] = useState<ExampleCard[] | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const [params, setParams] = useSearchParams()

  const open = (r: Ready) => {
    setPreviewModel({ title: r.title, prompt: r.title, spec: r.spec, backTo: '/create/open' })
    navigate('/create/preview')
  }

  // read text as a model file; open at once, or show what was skipped first
  const take = (text: string, name: string) => {
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      setError(`${name} isn’t a model file: it isn’t valid JSON.`)
      return
    }
    const r = fromSlfy(raw)
    if (!r.ok) {
      setError(`${name}: ${r.error}`)
      return
    }
    setError(null)
    if (r.warnings.length) setPending({ ...r, name })
    else open({ ...r, name })
  }

  const readFile = (f: File | undefined) => {
    if (!f) return
    if (f.size > MAX_BYTES) {
      setError(`${f.name} is ${(f.size / 1e6).toFixed(1)} MB; a model file is at most 2 MB.`)
      return
    }
    setBusy(true)
    f.text()
      .then((t) => take(t, f.name))
      .catch(() => setError(`Couldn’t read ${f.name}.`))
      .finally(() => setBusy(false))
  }

  const readUrl = (url: string, name = url.split('/').pop() || 'the file') => {
    setBusy(true)
    setError(null)
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`The link answered ${res.status}.`)
        const size = Number(res.headers.get('content-length') || 0)
        if (size > MAX_BYTES) throw new Error('The file is over 2 MB.')
        return res.text()
      })
      .then((t) => take(t, name))
      .catch((e) => setError(`Couldn’t open ${name}: ${e instanceof Error && e.message !== 'Failed to fetch' ? e.message : 'the site that holds it doesn’t allow it to be opened from here, or it is offline.'}`))
      .finally(() => setBusy(false))
  }

  // /create/open?url=… opens a file from a link (a teacher's site, a repository)
  const linked = params.get('url')
  useEffect(() => {
    if (!linked) return
    setParams({}, { replace: true })
    if (!/^https:\/\//i.test(linked) && !linked.startsWith('/')) {
      setError('Only https links can be opened.')
      return
    }
    readUrl(linked)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked])

  useEffect(() => {
    fetch('/slfy/examples/index.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setExamples(Array.isArray(list) ? (list as ExampleCard[]) : []))
      .catch(() => setExamples([]))
  }, [])

  return (
    <StudyShell
      title="Open a model file"
      lead="A Solidify model file (.slfy) holds a whole model: its parts, how they fit and move, its sizes as sliders and its working. Open one from your computer, or try an example. No account needed."
    >
      <div className="pb-16">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            readFile(e.dataTransfer.files?.[0])
          }}
          className={`flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors ${dragging ? 'border-accent bg-accent/5' : 'border-line-2 bg-panel'}`}
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/12 text-accent">
            <Icon.upload width={22} height={22} />
          </span>
          <p className="text-[15px] font-semibold text-ink">Drop a .slfy file here</p>
          <p className="max-w-md text-[13px] text-mute">Older Solidify model downloads (.json) open too.</p>
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className={`${primaryBtn} mt-1`}>
            {busy ? 'Opening…' : 'Choose a file'}
          </button>
          <input
            ref={input}
            type="file"
            accept=".slfy,.json,application/json,application/vnd.solidify+json"
            className="hidden"
            onChange={(e) => {
              readFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13.5px] text-ink">
            {error}
          </p>
        ) : null}

        {pending ? (
          <div className="mt-4 rounded-2xl border border-line-2 bg-panel px-5 py-4">
            <p className="text-[14px] font-semibold text-ink">{pending.title}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-mute">
              {pending.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => open(pending)} className={primaryBtn}>
                Open it
              </button>
              <button type="button" onClick={() => setPending(null)} className={ghostBtn}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <h2 className="mb-3 mt-10 text-[19px] font-semibold tracking-[-0.01em]">Examples</h2>
        {examples === null ? (
          <p className="text-[13px] text-mute">Loading…</p>
        ) : examples.length === 0 ? (
          <p className="text-[13px] text-mute">The examples couldn’t be loaded.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {examples.map((ex) => (
              <div key={ex.file} className="relative flex flex-col rounded-2xl border border-line bg-panel p-4 transition hover:border-ink/30">
                {/* the whole card opens the model; the buttons below sit above this layer */}
                <button type="button" disabled={busy} onClick={() => readUrl(`/slfy/examples/${ex.file}`, ex.file)} aria-label={`Open ${ex.title}`} className="absolute inset-0 cursor-pointer rounded-2xl" />
                <div className="pointer-events-none flex items-start justify-between gap-2">
                  <h3 className="text-[14.5px] font-semibold leading-snug text-ink">{ex.title}</h3>
                  {ex.question ? <span className="shrink-0 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent">Question</span> : null}
                </div>
                <p className="mt-1 line-clamp-3 flex-1 text-[12.5px] leading-relaxed text-mute">{ex.summary}</p>
                <p className="mt-2 text-[11.5px] text-dim">
                  {ex.parts} part{ex.parts === 1 ? '' : 's'}
                  {ex.calculations ? ` · ${ex.calculations} calculation${ex.calculations === 1 ? '' : 's'}` : ''}
                </p>
                <div className="relative mt-3 flex gap-2">
                  <button type="button" disabled={busy} onClick={() => readUrl(`/slfy/examples/${ex.file}`, ex.file)} className={`${primaryBtn} px-4 py-1.5 text-[12.5px]`}>
                    Open
                  </button>
                  <a href={`/slfy/examples/${ex.file}`} download={ex.file} className={`${ghostBtn} inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px]`}>
                    <Icon.download width={14} height={14} /> File
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="mb-2 mt-10 text-[19px] font-semibold tracking-[-0.01em]">For developers</h2>
        <div className="max-w-3xl space-y-2 text-[13.5px] leading-relaxed text-mute">
          <p>
            A .slfy file is JSON (<code className="text-ink">{SLFY_MIME}</code>), version {SLFY_VERSION}. It describes a model the way Solidify draws, moves and works it out: parameters with ranges and units, parts
            built from shapes and placed by relation (on a shaft, meshing with a gear, driven by a crank), motion, forces and dimensions, calculations with their equations, charts, and the question a model answers. Sizes
            can be formulas of the parameters, so a file is a model you can resize, not a fixed shape.
          </p>
          <p>
            Check a file against the{' '}
            <a href={`/slfy/slfy-${SLFY_VERSION}.schema.json`} className="font-medium text-accent hover:underline">
              JSON Schema
            </a>
            . Link straight to a model with <code className="text-ink">solidify.studio/#/create/open?url=https://…/model.slfy</code> (the site holding it must allow it to be fetched).
          </p>
        </div>
      </div>
    </StudyShell>
  )
}
