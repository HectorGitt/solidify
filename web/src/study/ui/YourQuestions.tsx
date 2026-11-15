import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '@/cloud/api'
import { useAuth } from '@/cloud/auth'
import { listCreations, type CreationSummary } from '@/cloud/creations'
import { SolveQuestionDialog } from '@/note3d/SolveQuestionDialog'
import { useProgress } from '../progress'

/**
 * Exam practice's "Your questions": every question the student has pasted and had solved (each is saved in
 * My models), beside the checked problems. Each opens in the model view, as practice (answers first) or at its
 * worked solution; tries are recorded in Progress like any other problem.
 */
export function YourQuestions({ showSolve = true }: { showSolve?: boolean }) {
  const status = useAuth((s) => s.status)
  const [items, setItems] = useState<CreationSummary[] | null>(null)
  const [error, setError] = useState('')
  const [solving, setSolving] = useState(false)
  const qp = useProgress((s) => s.questions)

  useEffect(() => {
    if (status !== 'signed-in') return
    let alive = true
    setError('')
    listCreations()
      .then((r) => alive && setItems(r.items.filter((i) => i.question)))
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : 'Your questions could not be loaded. Please try again.'))
    return () => {
      alive = false
    }
  }, [status])

  const head = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-2xl text-[12.5px] leading-relaxed text-mute">
        Questions you have pasted (or photographed) and had solved in 3D. Try one again, answers first, or with new numbers; each try counts in Progress.
      </p>
      {showSolve ? (
        <>
          <button type="button" onClick={() => setSolving(true)} className="rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink hover:brightness-110">
            Solve a new question
          </button>
          <SolveQuestionDialog open={solving} onClose={() => setSolving(false)} />
        </>
      ) : null}
    </div>
  )

  if (status !== 'signed-in')
    return (
      <div className="rounded-3xl border border-line bg-panel p-5 text-[13px] text-mute">
        Sign in to keep the questions you solve and practise them here.{' '}
        <button type="button" onClick={() => useAuth.getState().openDialog()} className="font-medium text-accent hover:underline">
          Sign in
        </button>
      </div>
    )
  if (error)
    return (
      <>
        {head}
        <p className="rounded-3xl border border-warn/40 bg-warn/5 p-5 text-[13px] text-warn">{error}</p>
      </>
    )
  if (!items)
    return (
      <>
        {head}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-3xl border border-line bg-panel-2/60" />
          ))}
        </div>
      </>
    )
  return (
    <>
      {head}
      {items.length ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => {
            const stat = qp[`own:${c.id}`]
            return (
              <li key={c.id} className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-line bg-panel">
                <Link to={`/create/${c.id}`} className="relative block aspect-[16/8] bg-[var(--color-stage)]">
                  {c.thumbnail ? (
                    <img src={c.thumbnail} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  ) : c.question!.written ? (
                    <span className="absolute inset-0 grid place-items-center text-[12.5px] font-medium text-mute">Worked answer, no model</span>
                  ) : null}
                  {c.shareId ? <span className="absolute bottom-2 left-2 rounded-full bg-panel/90 px-2 py-0.5 text-[11px] text-mute backdrop-blur">Shared by link</span> : null}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col p-4">
                  <h3 className="truncate text-[14px] font-semibold text-ink">{c.title}</h3>
                  <p className="mt-1 line-clamp-3 text-[12.5px] leading-relaxed text-mute">{c.question!.text}</p>
                  {c.question!.find.length ? (
                    <p className="mt-1.5 line-clamp-2 text-[12px] text-ink/80">
                      <span className="text-dim">Find: </span>
                      {c.question!.find.join('; ')}
                    </p>
                  ) : null}
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                    {c.question!.written ? (
                      <Link to={`/create/${c.id}`} className="rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-ink hover:brightness-110">
                        Read the answer
                      </Link>
                    ) : (
                      <>
                        <Link to={`/create/${c.id}?try=1`} className="rounded-full bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-ink hover:brightness-110">
                          Try it
                        </Link>
                        <Link to={`/create/${c.id}`} className="rounded-full border border-line-2 px-3 py-1.5 text-[12.5px] font-medium text-ink hover:border-ink/40">
                          See the solution
                        </Link>
                      </>
                    )}
                    {c.question!.written ? null : <span className="ml-auto text-[11.5px] text-dim">{stat ? `${stat.correct}/${stat.attempts} right` : 'not tried yet'}</span>}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-3xl border border-line bg-panel p-5 text-[13px] leading-relaxed text-mute">
          No questions yet. Paste one from a tutorial sheet or a past paper (or a screenshot of it) with “Solve a new question”: it is built in 3D, worked out step by step, and kept here to practise.
        </div>
      )}
    </>
  )
}
