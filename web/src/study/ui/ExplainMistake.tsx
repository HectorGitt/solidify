import { useEffect, useRef, useState } from 'react'
import { ApiError, stream } from '@/cloud/api'
import { useAuth } from '@/cloud/auth'
import { useAudience } from '@/ui/audience'
import { RichText } from '@/ui/RichText'
import type { Diagnosis } from '../marking'
import type { Question } from '../types'

interface Result {
  a: Question['answers'][number]
  computed: number
  ok: boolean
  carried?: boolean
  diagnosis?: Diagnosis | null
}

const show = (x: number) => (Number.isFinite(x) ? Number(x.toPrecision(5)).toString() : '—')

/**
 * "Explain my mistake": the tutor gets the problem, the student's answers, the correct answers,
 * the mistakes the marker recognised and the worked solution, and explains what went wrong.
 */
export function ExplainMistake({ q, results, inputs }: { q: Question; results: Result[]; inputs: Record<string, string> }) {
  const status = useAuth((s) => s.status)
  const audience = useAudience((s) => s.audience)
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const abort = useRef<AbortController | null>(null)

  // a new check or a new question resets the explanation
  const key = `${q.id}:${String(q.variant)}:${results.map((r) => `${r.a.key}=${inputs[r.a.key] ?? ''}`).join('|')}`
  useEffect(() => {
    abort.current?.abort()
    setText('')
    setState('idle')
  }, [key])
  useEffect(() => () => abort.current?.abort(), [])

  if (results.every((r) => r.ok)) return null

  const explain = async () => {
    if (status !== 'signed-in') {
      useAuth.getState().openDialog()
      return
    }
    const live: Record<string, string> = {}
    for (const r of results) {
      live[`Your ${r.a.key} (${r.a.unit || 'no unit'})`] = (inputs[r.a.key] ?? '').trim() || 'blank'
      live[`Correct ${r.a.key} (${r.a.unit || 'no unit'})`] = show(r.computed)
      if (r.diagnosis) live[`Marker's note on ${r.a.key}`] = r.diagnosis.message
    }
    const r = q.solve()
    const working = q.working(r).map((s) => [s.label, s.tex, s.sub, s.result].filter(Boolean).join(' | '))
    const ac = new AbortController()
    abort.current = ac
    setText('')
    setState('busy')
    try {
      for await (const ev of stream(
        '/v1/tutor',
        {
          question:
            'I answered this exam question and got some parts wrong. Using my answers, the correct answers and the worked solution, explain where my working most likely went wrong and how to do those steps correctly. Be specific and short.',
          context: { scene: q.title, sceneSummary: q.statement, live, working, mode: audience },
        },
        ac.signal,
      )) {
        const data = JSON.parse(ev.data) as { text?: string; error?: string }
        if (ev.event === 'delta' && data.text) setText((t) => t + data.text)
        else if (ev.event === 'error') {
          setText(data.error ?? 'The tutor could not answer just now.')
          setState('error')
          return
        }
      }
      setState('done')
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setText(e instanceof ApiError ? e.message : 'The tutor could not answer just now.')
      setState('error')
    }
  }

  return (
    <div className="mt-3">
      {state === 'idle' ? (
        <button onClick={() => void explain()} className="rounded-lg border border-info/50 px-3 py-1.5 text-[12.5px] text-info hover:bg-info/10">
          Explain my mistake{status !== 'signed-in' ? ' (sign in)' : ''}
        </button>
      ) : (
        <div className={`rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed ${state === 'error' ? 'border-warn/40 bg-warn/10 text-warn' : 'border-info/30 bg-info/5 text-ink/90'}`}>
          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-info">Tutor</div>
          {text ? <RichText text={text} /> : <span className="text-mute">Looking at your answers…</span>}
        </div>
      )}
    </div>
  )
}
