import { useState, type ClipboardEvent, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { setPendingBuild } from '@/cloud/pendingBuild'
import { Modal, ghostBtn, inputCls, primaryBtn } from '@/cloud/ui/Modal'
import { Icon } from '@/ui/icons'
import { toast } from '@/ui/toast'

const MAX_TEXT = 3800
const MAX_IMAGE = 8_000_000

/** what the model view is asked: solve the problem as given, in 3D, step by step */
export function solvePrompt(text: string, hasImage: boolean) {
  const t = text.trim()
  if (!t) return 'Solve the problem in this screenshot in 3D, step by step.'
  return `Solve this problem in 3D, step by step${hasImage ? ' (its screenshot is attached)' : ''}:\n\n${t}`
}

/**
 * Paste a question (an exam, tutorial or textbook problem), as text, a screenshot or both, and get it built in
 * 3D with its worked solution: it opens the model view, which builds it as a background task.
 */
export function SolveQuestionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [image, setImage] = useState<{ name: string; url: string } | null>(null)
  const [over, setOver] = useState(false)

  const take = (file: File | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return false
    if (file.size > MAX_IMAGE) {
      toast('That picture is too large. Please use one under 8 MB.', { tone: 'warn' })
      return true
    }
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' && setImage({ name: file.name || 'screenshot.png', url: reader.result })
    reader.readAsDataURL(file)
    return true
  }
  const onPaste = (e: ClipboardEvent) => {
    const file = [...e.clipboardData.items].find((i) => i.kind === 'file' && i.type.startsWith('image/'))?.getAsFile()
    if (take(file)) e.preventDefault()
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    take(e.dataTransfer.files?.[0])
  }
  const solve = () => {
    if (!text.trim() && !image) return
    setPendingBuild({ prompt: solvePrompt(text, !!image), photo: image ?? undefined })
    onClose()
    setText('')
    setImage(null)
    navigate('/create/new')
  }

  return (
    <Modal open={open} onClose={onClose} title="Solve a question in 3D" width={560}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          solve()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className="space-y-3"
      >
        <p className="text-[12.5px] leading-relaxed text-mute">
          Paste an exam, tutorial or textbook problem, or a screenshot of it. Solidify builds its setup in 3D and works it out step by step; move the givens to see how the answer changes.
        </p>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          rows={7}
          maxLength={MAX_TEXT}
          aria-label="The question"
          placeholder={'e.g. A simply supported beam of span 6 m carries a point load of 20 kN at 2 m from A and a uniformly distributed load of 5 kN/m over its whole length. Determine the reactions at A and B and the maximum bending moment.\n\nOr paste a screenshot here (Ctrl+V).'}
          className={`${inputCls} min-h-[150px] resize-y text-[13px] leading-relaxed ${over ? 'border-accent' : ''}`}
        />
        <div className="flex flex-wrap items-center gap-2">
          {image ? (
            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-line-2 p-1.5 pr-2">
              <img src={image.url} alt="The question's screenshot" className="h-12 w-16 rounded-md object-cover" />
              <span className="min-w-0 truncate text-[12px] text-mute">{image.name}</span>
              <button type="button" onClick={() => setImage(null)} aria-label="Remove the screenshot" className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-mute hover:bg-panel-3 hover:text-ink">
                <Icon.close width={13} height={13} />
              </button>
            </div>
          ) : (
            <label className={`${ghostBtn} cursor-pointer px-3 py-1.5 text-[12.5px]`}>
              <Icon.camera width={15} height={15} />
              Add a screenshot or photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => (take(e.target.files?.[0]), (e.target.value = ''))} />
            </label>
          )}
          <span className="text-[11.5px] text-dim">or paste or drop one here</span>
          <button type="submit" disabled={!text.trim() && !image} className={`${primaryBtn} ml-auto px-4 py-2 text-[13px]`}>
            Solve in 3D
          </button>
        </div>
        <p className="text-[11px] text-dim">Uses one 3D build from today’s allowance.</p>
      </form>
    </Modal>
  )
}
