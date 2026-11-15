import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { sanitizeGeneratedSpec } from '@/note3d/sanitize'
import { SiteHeader } from '@/ui/SiteHeader'
import { WorkspaceSkeleton } from '@/ui/Skeleton'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { getShared } from '../creations'
import { setPreviewModel } from '../previewModel'
import ModelLab from './ModelLab'

/**
 * /s/:shareId: a model a student shared by link (often a solved question with its worked solution). It opens
 * in the workspace to look at, signed in or not; nothing is saved unless the reader keeps a copy. The link
 * itself loads it, so a reload or a link sent on works.
 */
export default function SharedPage() {
  const { shareId = '' } = useParams()
  const auth = useAuth((s) => s.status)
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'error'>('loading')

  useEffect(() => {
    // wait for sign-in to settle: the answer says whether the link is the reader's own
    if (auth === 'loading') return
    let alive = true
    setState('loading')
    getShared(shareId)
      .then((m) => {
        if (!alive) return
        // the sharer's slider settings become the model's values
        const raw = m.spec as { parameters?: { id: string; value: number }[] }
        const withParams = Array.isArray(raw.parameters) ? { ...m.spec, parameters: raw.parameters.map((p) => (typeof m.params?.[p.id] === 'number' ? { ...p, value: m.params[p.id] } : p)) } : m.spec
        const spec = (sanitizeGeneratedSpec({ spec: withParams }, m.prompt) as unknown as Record<string, unknown> | null) ?? withParams
        const question = !!(spec as { question?: unknown }).question
        setPreviewModel({ title: m.title, prompt: m.prompt, spec, explanation: m.explanation, backTo: question ? '/questions' : '/library', shared: { id: m.id, by: m.by, yours: m.yours } })
        setState('ready')
      })
      .catch((e) => alive && setState(e instanceof ApiError && e.status === 404 ? 'gone' : 'error'))
    return () => {
      alive = false
    }
  }, [shareId, auth])

  useEffect(() => {
    if (state === 'gone' || state === 'error') document.title = 'Shared link · Solidify'
  }, [state])

  if (state === 'loading') return <WorkspaceSkeleton />
  if (state === 'ready') return <ModelLab route="preview" key={shareId} />
  return (
    <div className="flex h-full flex-col bg-bg">
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg px-4 py-16 text-center">
        <h1 className="text-[20px] font-semibold text-ink">{state === 'gone' ? 'This link no longer opens' : 'This link couldn’t be opened'}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-mute">
          {state === 'gone' ? 'Whoever shared it has stopped sharing it or deleted the model. Ask them for a new link.' : 'Check your connection and try again.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {state === 'error' ? (
            <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-accent-ink hover:opacity-90">
              Try again
            </button>
          ) : null}
          <Link to="/questions" className="rounded-full border border-line-2 bg-panel-2 px-5 py-2.5 text-[13.5px] font-medium text-ink hover:border-ink/40">
            Exam practice
          </Link>
          <Link to="/library" className="rounded-full border border-line-2 bg-panel-2 px-5 py-2.5 text-[13.5px] font-medium text-ink hover:border-ink/40">
            Model library
          </Link>
        </div>
      </main>
    </div>
  )
}
