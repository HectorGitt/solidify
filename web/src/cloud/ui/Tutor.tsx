import { useEffect, useRef, useState, type FormEvent } from 'react'
import { create } from 'zustand'
import { useAudience } from '@/ui/audience'
import { Icon } from '@/ui/icons'
import { RichText } from '@/ui/RichText'
import { ApiError, stream } from '../api'
import { useAuth } from '../auth'
import { collectReadouts, collectWorking, selectedPart } from '../onScreen'
import { primaryBtn } from './Modal'

interface Msg {
  role: 'user' | 'model'
  text: string
  /** what was on screen when asked (shown as a chip) */
  about?: string
  error?: boolean
}

export const useTutor = create<{ open: boolean; setOpen: (o: boolean) => void }>((set) => ({ open: false, setOpen: (open) => set({ open }) }))

const SUGGESTIONS = ['How does this work?', 'Explain the numbers on screen', 'What would happen if I changed the main setting?']

/**
 * The tutor: answers questions about the open scene, using the selected part, the live
 * readouts and the worked solution on screen as context.
 */
export function TutorPanel({ scene, route }: { scene?: { title: string; summary?: string }; route: string }) {
  const open = useTutor((s) => s.open)
  const status = useAuth((s) => s.status)
  const audience = useAudience((s) => s.audience)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const abort = useRef<AbortController | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // a new scene starts a new conversation
  useEffect(() => {
    abort.current?.abort()
    setMsgs([])
  }, [route])

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [msgs])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  if (!open) return null

  const ask = async (question: string) => {
    const q = question.trim()
    if (!q || busy) return
    const part = selectedPart()
    const history = msgs.filter((m) => !m.error && m.text).map((m) => ({ role: m.role, text: m.text.slice(0, 4000) })).slice(-10)
    setMsgs((m) => [...m, { role: 'user', text: q, about: part?.name }, { role: 'model', text: '' }])
    setInput('')
    setBusy(true)
    const ac = new AbortController()
    abort.current = ac
    const update = (f: (last: Msg) => Msg) => setMsgs((m) => [...m.slice(0, -1), f(m[m.length - 1])])
    try {
      const events = stream(
        '/v1/tutor',
        {
          question: q,
          history,
          context: {
            route,
            scene: scene?.title,
            sceneSummary: scene?.summary?.slice(0, 1500),
            part,
            live: collectReadouts(),
            working: collectWorking(),
            mode: audience,
          },
        },
        ac.signal,
      )
      for await (const ev of events) {
        const data = JSON.parse(ev.data) as { text?: string; remaining?: number; error?: string }
        if (ev.event === 'meta' && data.remaining !== undefined) setRemaining(data.remaining)
        else if (ev.event === 'delta' && data.text) update((l) => ({ ...l, text: l.text + data.text }))
        else if (ev.event === 'error') update((l) => ({ ...l, text: data.error ?? 'The tutor could not answer just now.', error: true }))
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') update((l) => ({ ...l, text: e instanceof ApiError ? e.message : 'The tutor could not answer just now.', error: true }))
    } finally {
      setBusy(false)
      abort.current = null
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void ask(input)
  }

  return (
    <aside className="absolute inset-y-0 right-0 z-30 flex w-[min(400px,100%)] flex-col border-l border-line bg-panel shadow-2xl" aria-label="Tutor">
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
        <div>
          <div className="text-[13.5px] font-semibold text-ink">Ask the tutor</div>
          <div className="text-[11.5px] text-dim">Sees this scene, the part you select and the numbers on screen</div>
        </div>
        <div className="flex items-center gap-1">
          {msgs.length ? (
            <button onClick={() => (abort.current?.abort(), setMsgs([]))} className="rounded-md px-2 py-1 text-[12px] text-mute hover:bg-panel-3 hover:text-ink">
              New chat
            </button>
          ) : null}
          <button onClick={() => useTutor.getState().setOpen(false)} aria-label="Close tutor" className="grid h-7 w-7 place-items-center rounded-md text-mute hover:bg-panel-3 hover:text-ink">
            <Icon.close width={15} height={15} />
          </button>
        </div>
      </div>

      {status !== 'signed-in' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-[13px] leading-relaxed text-mute">Sign in to ask questions about any part or calculation. It’s free.</p>
          <button className={primaryBtn} onClick={() => useAuth.getState().openDialog()}>
            Sign in
          </button>
        </div>
      ) : (
        <>
          <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-3 text-[13px] leading-relaxed">
            {msgs.length === 0 ? (
              <div className="space-y-2">
                <p className="text-[12.5px] text-mute">{scene ? `Ask anything about “${scene.title}”. Select a part first to ask about it.` : 'Ask anything about the machine on screen.'}</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => void ask(s)} className="block w-full rounded-md border border-line-2 px-3 py-2 text-left text-[12.5px] text-ink/90 hover:border-accent/40 hover:text-accent">
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              msgs.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="ml-8 rounded-lg bg-accent/12 px-3 py-2 text-ink">
                    {m.about ? <div className="mb-0.5 text-[10.5px] font-medium uppercase tracking-wider text-accent/80">About: {m.about}</div> : null}
                    {m.text}
                  </div>
                ) : (
                  <div key={i} className={m.error ? 'rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-warn' : 'text-ink/90'}>
                    {m.text ? <RichText text={m.text} /> : <span className="inline-flex gap-1 text-mute" aria-label="Thinking">●<span className="animate-pulse">●</span>●</span>}
                  </div>
                ),
              )
            )}
          </div>
          <form onSubmit={submit} className="border-t border-line p-2.5">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                maxLength={2000}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void ask(input)
                  }
                }}
                placeholder="Ask a question…"
                className="min-h-[40px] flex-1 resize-none rounded-md border border-line-2 bg-panel-2 px-3 py-2 text-[13px] text-ink outline-none placeholder:text-dim focus:border-accent/60"
              />
              {busy ? (
                <button type="button" onClick={() => abort.current?.abort()} className="rounded-md border border-line-2 px-3 py-2 text-[12.5px] text-mute hover:text-ink">
                  Stop
                </button>
              ) : (
                <button type="submit" disabled={!input.trim()} className={primaryBtn}>
                  Ask
                </button>
              )}
            </div>
            {remaining !== null ? <div className="mt-1.5 text-right text-[11px] text-dim">{remaining} questions left today</div> : null}
          </form>
        </>
      )}
    </aside>
  )
}

/** Header button that opens the tutor. */
export function TutorButton() {
  const open = useTutor((s) => s.open)
  return (
    <button
      onClick={() => useTutor.getState().setOpen(!open)}
      aria-pressed={open}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${open ? 'bg-accent text-accent-ink' : 'border border-line-2 bg-panel-2 text-ink/90 hover:border-accent/40 hover:text-accent'}`}
      title="Ask the tutor about what’s on screen"
    >
      <Icon.book width={14} height={14} />
      <span className="hidden sm:inline">Ask</span>
    </button>
  )
}
