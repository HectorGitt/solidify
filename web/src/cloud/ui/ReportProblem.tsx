import { useState } from 'react'
import { toast } from '@/ui/toast'
import { api, ApiError } from '../api'
import { Modal, ghostBtn, inputCls, primaryBtn } from './Modal'

export type ReportKind = 'floating' | 'hitting' | 'motion' | 'numbers' | 'labels' | 'other'

const KINDS: [ReportKind, string][] = [
  ['floating', 'A part is floating or in the wrong place'],
  ['hitting', 'Parts pass through each other'],
  ['motion', 'It moves the wrong way'],
  ['numbers', 'A number or equation looks wrong'],
  ['labels', 'A label or arrow is wrong'],
  ['other', 'Something else'],
]

export const sendReport = (r: { title: string; prompt?: string; kinds: ReportKind[]; note?: string }) => api<{ ok: true; library: boolean }>('/v1/reports', { method: 'POST', body: r })

/**
 * "Something looks wrong": a student tells the review team what they saw on a model, in a tap or two. A
 * library model's report is counted on it (Admin → Library); any report is kept for the team.
 */
export function ReportProblem({ title, prompt, className = '' }: { title: string; prompt?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [kinds, setKinds] = useState<ReportKind[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async () => {
    setBusy(true)
    try {
      await sendReport({ title: title.slice(0, 200), prompt: prompt?.slice(0, 2000), kinds: kinds.length ? kinds : ['other'], note: note.trim() || undefined })
      toast('Thanks: the team will look at this model.')
      setOpen(false)
      setKinds([])
      setNote('')
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t send that. Please try again.', { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Tell us if something about this model looks wrong" className={`${ghostBtn} px-3 py-1.5 text-[12.5px] ${className}`}>
        <span className="max-sm:hidden">Report a problem</span>
        <span className="sm:hidden" aria-label="Report a problem">!</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="What looks wrong?">
        <div className="space-y-1.5">
          {KINDS.map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-[13px] text-ink hover:bg-panel-2">
              <input type="checkbox" checked={kinds.includes(k)} onChange={(e) => setKinds((cur) => (e.target.checked ? [...cur, k] : cur.filter((x) => x !== k)))} className="accent-[var(--color-accent)]" />
              {label}
            </label>
          ))}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="Which part, and what you see (optional)" aria-label="What you see" className={`${inputCls} mt-3 text-[13px]`} />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className={`${ghostBtn} px-4 py-1.5 text-[13px]`}>
            Cancel
          </button>
          <button type="button" disabled={busy || (!kinds.length && !note.trim())} onClick={() => void send()} className={`${primaryBtn} px-4 py-1.5 text-[13px]`}>
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </Modal>
    </>
  )
}
