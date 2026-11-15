import { useState } from 'react'
import { Icon } from '@/ui/icons'
import { toast } from '@/ui/toast'
import { ApiError } from '../api'
import { shareCreation, shareUrl, unshareCreation } from '../creations'
import { Modal, ghostBtn, inputCls, primaryBtn } from './Modal'

/**
 * Share a saved model by link, from the workspace: a solved question with its worked solution, or any model.
 * Anyone with the link opens it in 3D (no account needed) and can keep a copy in their own My models. The
 * link follows the student's later changes; stopping sharing ends it. A question can go out as practice, its
 * answers hidden until the reader has tried.
 */
export function ShareDialog({
  open,
  onClose,
  creationId,
  title,
  isQuestion,
  shareId,
  onChange,
}: {
  open: boolean
  onClose: () => void
  creationId: string
  title: string
  isQuestion: boolean
  shareId: string | null
  onChange: (shareId: string | null) => void
}) {
  const [busy, setBusy] = useState<null | 'share' | 'stop'>(null)
  const [practice, setPractice] = useState(false)
  const url = shareId ? `${shareUrl(shareId)}${practice ? '?try=1' : ''}` : ''
  const what = isQuestion ? 'this question and its worked solution' : 'this model'

  const make = async () => {
    setBusy('share')
    try {
      const r = await shareCreation(creationId)
      onChange(r.shareId)
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'The link couldn’t be made. Please try again.', { tone: 'warn' })
    } finally {
      setBusy(null)
    }
  }
  const stop = async () => {
    setBusy('stop')
    try {
      await unshareCreation(creationId)
      onChange(null)
      toast('Sharing stopped: the link no longer opens.')
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'That didn’t work. Please try again.', { tone: 'warn' })
    } finally {
      setBusy(null)
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied.', { tone: 'ok' })
    } catch {
      toast('Couldn’t copy: select the link and copy it.', { tone: 'warn' })
    }
  }
  const text = isQuestion ? `${title}: ${practice ? 'try this question' : 'worked solution'} in 3D on Solidify` : `${title}, in 3D on Solidify`
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <Modal open={open} onClose={onClose} title={isQuestion ? 'Share this solution' : 'Share this model'} width={460}>
      {!shareId ? (
        <>
          <p className="text-[13px] leading-relaxed text-mute">
            Anyone with the link can open {what} in 3D, without an account: turn it, cut it, move its sliders, and keep a copy in their own My models. Changes you make here show in the link. It
            says it was shared by you (your first name).
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className={`${ghostBtn} px-4 py-2 text-[13px]`}>
              Cancel
            </button>
            <button type="button" disabled={!!busy} onClick={() => void make()} className={`${primaryBtn} px-4 py-2 text-[13px]`}>
              {busy ? 'Making the link…' : 'Make a link'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-[13px] leading-relaxed text-mute">Anyone with this link can open {what}. Changes you make here show in the link.</p>
          {isQuestion ? (
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-full border border-line-2 bg-panel-2 p-1 text-[12.5px]" role="radiogroup" aria-label="How the link opens">
              {[
                { on: false, label: 'Show the solution' },
                { on: true, label: 'As practice' },
              ].map((o) => (
                <button key={o.label} type="button" role="radio" aria-checked={practice === o.on} onClick={() => setPractice(o.on)} className={`rounded-full px-3 py-1.5 font-medium ${practice === o.on ? 'bg-ink text-bg' : 'text-mute hover:text-ink'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          ) : null}
          {isQuestion ? <p className="-mt-1 mb-3 text-[12px] text-dim">{practice ? 'The answers stay hidden until they have tried the question.' : 'It opens at the worked solution, step by step.'}</p> : null}
          <div className="flex gap-2">
            <input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} className={`${inputCls} min-w-0 flex-1 py-2 text-[12.5px]`} />
            <button type="button" onClick={() => void copy()} className={`${primaryBtn} shrink-0 px-4 py-2 text-[13px]`}>
              Copy
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canShare ? (
              <button type="button" onClick={() => void navigator.share({ title, text, url }).catch(() => {})} className={`${ghostBtn} px-4 py-1.5 text-[12.5px]`}>
                <Icon.share width={14} height={14} /> Send…
              </button>
            ) : null}
            <a href={`https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`} target="_blank" rel="noreferrer" className={`${ghostBtn} px-4 py-1.5 text-[12.5px]`}>
              WhatsApp
            </a>
            <button type="button" disabled={!!busy} onClick={() => void stop()} className="ml-auto rounded-full px-3 py-1.5 text-[12.5px] font-medium text-warn hover:bg-warn/10 disabled:opacity-50">
              {busy === 'stop' ? 'Stopping…' : 'Stop sharing'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
