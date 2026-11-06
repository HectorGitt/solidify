import { useEffect, useMemo, useState } from 'react'
import { requestSnapshot } from '@/render/snapshot'
import { scoreBuild } from '@/evals/score'
import { toast } from '@/ui/toast'
import { ApiError } from '../api'
import { addDraft, publishModel } from '../admin'
import { Field, Modal, ghostBtn, inputCls, primaryBtn } from './Modal'

/**
 * For admins, from the workspace: put the model in the library for everyone, or in the review queue first.
 * It is scored with the nightly checks so its problems show before it goes out.
 */
export function PublishDialog({ open, onClose, spec, prompt, explanation }: { open: boolean; onClose: () => void; spec: Record<string, unknown>; prompt: string; explanation?: string }) {
  const [title, setTitle] = useState(typeof spec.title === 'string' ? spec.title : '')
  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState<null | 'publish' | 'queue'>(null)
  // the card's picture: the workspace's view as it is now
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  useEffect(() => {
    void requestSnapshot({ width: 480 }).then(setThumbnail)
  }, [])
  const { score, checks } = useMemo(() => scoreBuild({ id: 'draft', prompt }, { spec, explanation }, 0), [spec, prompt, explanation])
  const failed = checks.filter((c) => !c.ok && c.name !== 'under two minutes')

  const go = async (kind: 'publish' | 'queue') => {
    const t = title.trim()
    if (!t) return
    setBusy(kind)
    try {
      const fields = { title: t.slice(0, 120), prompt: prompt.slice(0, 2000) || t, topic: topic.trim() || undefined, spec, explanation: explanation?.slice(0, 4000), score, checks, ...(thumbnail ? { thumbnail } : {}) }
      if (kind === 'publish') await publishModel(fields)
      else await addDraft(fields)
      toast(kind === 'publish' ? `Published “${t}” to the library.` : `“${t}” is in the review queue.`)
      onClose()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'That didn’t work. Please try again.', { tone: 'warn' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Publish to the library" width={460}>
      <p className="mb-4 text-[12.5px] leading-relaxed text-mute">Everyone sees library models on the Create page; opening one gives a student their own copy. Your model stays as it is.</p>
      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputCls} />
      </Field>
      <Field label="Topic (optional)">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={60} placeholder="e.g. Strength of materials" className={inputCls} />
      </Field>
      <div className="mb-4 rounded-xl border border-line px-3.5 py-3">
        <div className="flex items-baseline gap-2">
          <span className={`text-[20px] font-semibold tabular-nums ${score >= 90 ? 'text-accent' : score >= 70 ? 'text-ink' : 'text-warn'}`}>{score}</span>
          <span className="text-[12px] text-mute">on the nightly checks</span>
        </div>
        {failed.length ? (
          <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-warn">
            {failed.map((c) => (
              <li key={c.name}>
                ✗ {c.name}
                {c.detail ? <span className="text-ink/75">: {c.detail}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[11.5px] text-accent">All checks passed.</p>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={!!busy || !title.trim()} onClick={() => void go('queue')} className={ghostBtn}>
          {busy === 'queue' ? 'Sending…' : 'Send to review queue'}
        </button>
        <button type="button" disabled={!!busy || !title.trim()} onClick={() => void go('publish')} className={primaryBtn}>
          {busy === 'publish' ? 'Publishing…' : 'Publish now'}
        </button>
      </div>
    </Modal>
  )
}
