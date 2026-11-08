import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { create } from 'zustand'
import { startTask } from '@/ui/tasks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EVAL_CASES } from '@/evals/cases'
import { scoreBuild } from '@/evals/score'
import { mechanismProblems } from '@/note3d/kinematics'
import { sanitizeGeneratedSpec } from '@/note3d/sanitize'
import { evaluateCalculations } from '@/note3d/schema'
import { DRAFT_TOPICS, type DraftTopic } from '@/evals/topics'
import { Pills, StudyShell } from '@/study/ui/StudyShell'
import { ListSkeleton } from '@/ui/Skeleton'
import { toast } from '@/ui/toast'
import { ApiError, download } from '../api'
import { useAuth } from '../auth'
import { setPreviewModel } from '../previewModel'
import { can, useProfile, type Perm, type StaffRole } from '../profile'
import {
  addDraft,
  adminBuild,
  approveDraft,
  costOf,
  getAdminSettings,
  getPeople,
  getAccounts,
  accountQuery,
  type Account,
  type AccountFilter,
  setRoles,
  lookupPerson,
  setFeedbackStatus,
  getAppCheckStats,
  type Lookup,
  getAudit,
  getHistory,
  type AuditEntry,
  type ReviewChecklist,
  nextTopics,
  getLibraryItem,
  listLibrary,
  unpublish,
  updateLibraryItem,
  type LibraryCard,
  resetTopics,
  saveRun,
  saveSettings,
  saveTopics,
  updateDraft,
  type BuildReply,
  type EvalCheck,
  type QualitySettings,
  getAiUsage,
  getDrafts,
  getEvals,
  getEventSummary,
  getFeedback,
  getWaitlist,
  rejectDraft,
  type EvalRun,
  type EventDay,
  type EventNote,
  type FeedbackItem,
  type LibraryDraft,
  type ModelPrice,
  type WaitlistEntry,
} from '../admin'
import { ghostBtn, inputCls, primaryBtn } from './Modal'
import { ThumbnailMaker } from './ThumbnailMaker'

type Tab = 'quality' | 'review' | 'library' | 'users' | 'activity' | 'feedback' | 'waitlist' | 'settings'

/** scores a build made from the admin page with the nightly run's own checks */
function scoreReply(prompt: string, reply: BuildReply, caseId?: string) {
  const c = EVAL_CASES.find((x) => x.id === caseId) ?? { id: 'draft', prompt }
  const { score, checks, spec } = scoreBuild(c, reply as unknown as Record<string, unknown>, reply.ms / 1000)
  // drafts keep the cleaned model, as the app builds it, not Gemini's raw answer
  return { score, checks, spec: (spec ?? reply.spec) as unknown as Record<string, unknown> }
}

function FailedChecks({ checks }: { checks: EvalCheck[] }) {
  const failed = checks.filter((x) => !x.ok)
  if (!failed.length) return <p className="text-[11.5px] text-accent">All checks passed.</p>
  return (
    <ul className="space-y-0.5 text-[11.5px] text-warn">
      {failed.map((x) => (
        <li key={x.name}>
          ✗ {x.name}
          {x.detail ? <span className="text-ink/75">: {x.detail}</span> : null}
        </li>
      ))}
    </ul>
  )
}

const BUILD_NOTE = 'Building… about a minute'

/** what is wrong with a draft's mechanism, checked now with today's rules (a draft may predate them) */
const mechCache = new WeakMap<object, string[]>()
function draftMechanism(d: LibraryDraft): string[] {
  const hit = mechCache.get(d.spec)
  if (hit) return hit
  let out: string[] = []
  try {
    const spec = sanitizeGeneratedSpec({ spec: d.spec }, d.title)
    if (spec) {
      const { scope } = evaluateCalculations(spec.calculations, Object.fromEntries(spec.parameters.map((p) => [p.id, p.value])))
      out = mechanismProblems(spec, scope, `${d.prompt} ${d.title}`).problems
    }
  } catch {
    out = []
  }
  mechCache.set(d.spec, out)
  return out
}

/**
 * A draft's checks and score as they stand today: run again on the draft as it is now (the stored ones are
 * from when it was drafted, before later checks and fixes), keeping only the build time from then. The card
 * then agrees with what the workspace shows when the draft is opened.
 */
/**
 * The checks that make a draft worth rebuilding: the engineering is broken (it doesn't build, parts are dropped,
 * floating or buried, moving parts aren't joined or move wrongly, sums don't work). Overlapping labels, build
 * time and the like show on the card but don't call for a rebuild.
 */
const SERIOUS: Record<string, string> = {
  builds: 'do not build',
  'every shape drawable': 'shapes dropped',
  layout: 'parts out of place',
  'moving parts connected': 'moving parts not connected',
  'mechanism moves right': 'move wrongly',
  'calculations work': 'calculations broken',
}
/** what makes a draft worth rebuilding, by today's checks */
function draftFaults(d: LibraryDraft): string[] {
  return draftLive(d)
    .checks.filter((x) => !x.ok && x.name in SERIOUS)
    .map((x) => SERIOUS[x.name])
}

const liveCache = new WeakMap<object, { score: number; checks: EvalCheck[] }>()
function draftLive(d: LibraryDraft): { score: number; checks: EvalCheck[] } {
  const hit = liveCache.get(d.spec)
  if (hit) return hit
  let out = { score: d.score, checks: d.checks ?? [] }
  try {
    const timed = (d.checks ?? []).find((x) => x.name === 'under two minutes')
    const { checks } = scoreBuild({ id: 'draft', prompt: d.prompt }, { spec: d.spec, explanation: d.explanation ?? '' }, 0)
    const merged = checks.map((x) => (x.name === 'under two minutes' && timed ? timed : x))
    out = { score: Math.round((100 * merged.filter((x) => x.ok).length) / Math.max(1, merged.length)), checks: merged }
  } catch {
    // keep the stored ones
  }
  liveCache.set(d.spec, out)
  return out
}

const date = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const dateTime = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const smallBtn = 'rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50'
const card = 'rounded-2xl border border-line bg-panel'

/** loads once, with a retry; the shape every tab uses */
function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(() => {
    setError(null)
    load()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Couldn’t load this.'))
  }, [load])
  useEffect(run, [run])
  return { data, setData, error, reload: run }
}

function Loading({ error, onRetry, children }: { error: string | null; onRetry: () => void; children: ReactNode | null }) {
  if (error)
    return (
      <section className={`${card} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
        <p className="text-[13.5px] text-ink">{error}</p>
        <button type="button" className={ghostBtn} onClick={onRetry}>
          Try again
        </button>
      </section>
    )
  return children ?? <ListSkeleton rows={5} />
}

function Empty({ children }: { children: ReactNode }) {
  return <section className="rounded-2xl border border-dashed border-line-2 bg-panel px-6 py-12 text-center text-[13.5px] text-mute">{children}</section>
}

const usd = (v: number | null) => (v === null ? '' : v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(v < 1 ? 3 : 2)}`)
const tokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)))

const scoreTone = (s: number) => (s >= 90 ? 'text-accent' : s >= 70 ? 'text-ink' : 'text-warn')

/* ------------------------------------------------------------------ quality */

/** one bar per night, tallest = 100 */
function Trend({ runs }: { runs: { runAt: number; summary: { score: number } }[] }) {
  const shown = runs.slice(0, 30).reverse()
  return (
    <div className="flex h-24 items-end gap-[3px]" role="img" aria-label={`Night scores, last ${shown.length} runs`}>
      {shown.map((r) => (
        <div
          key={r.runAt}
          title={`${date(r.runAt)}: ${r.summary.score}`}
          className={`min-w-[6px] flex-1 rounded-t ${r.summary.score >= 90 ? 'bg-accent' : r.summary.score >= 70 ? 'bg-ink/50' : 'bg-warn'}`}
          style={{ height: `${Math.max(4, r.summary.score)}%` }}
        />
      ))}
    </div>
  )
}

const EVENT_LABELS: [string, string][] = [
  ['rating-up', 'Thumbs up'],
  ['rating-down', 'Thumbs down'],
  ['layout-issue', 'Layout flagged'],
  ['fix-layout', 'Fix the layout'],
  ['rebuild', 'Rebuilt'],
  ['delete', 'Deleted'],
]

function Usage({ days, notes }: { days: EventDay[]; notes: EventNote[] }) {
  const total = (k: string) => days.reduce((n, d) => n + (Number(d[k]) || 0), 0)
  return (
    <section className={`${card} p-5`}>
      <h2 className="text-[15px] font-semibold">What students did with their models</h2>
      <p className="mt-1 text-[12.5px] text-mute">Last 14 days. Counted without names.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {EVENT_LABELS.map(([k, label]) => (
          <div key={k} className="rounded-xl border border-line px-3 py-2.5">
            <div className="text-[20px] font-semibold tabular-nums">{total(k)}</div>
            <div className="text-[11.5px] text-mute">{label}</div>
          </div>
        ))}
      </div>
      {notes.length ? (
        <>
          <h3 className="mt-5 text-[13px] font-semibold">Latest notes</h3>
          <ul className="mt-2 divide-y divide-line">
            {notes.slice(0, 15).map((n, i) => (
              <li key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 py-2 text-[12.5px]">
                <span className="w-24 shrink-0 text-dim">{n.day}</span>
                <span className="w-28 shrink-0 text-mute">{EVENT_LABELS.find(([k]) => k === n.kind)?.[1] ?? n.kind}</span>
                <span className="min-w-0 flex-1 text-ink/90">
                  {n.subject ? <span className="font-medium">{n.subject}</span> : null}
                  {n.subject && n.detail ? ': ' : null}
                  {n.detail}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}

function LatestRun({ run }: { run: EvalRun }) {
  const [open, setOpen] = useState<string | null>(null)
  const [retest, setRetest] = useState<Record<string, { busy: boolean; score?: number; checks?: EvalCheck[]; error?: string }>>({})
  const runRetest = async (id: string, prompt: string) => {
    setRetest((r) => ({ ...r, [id]: { busy: true } }))
    try {
      const reply = await adminBuild({ prompt })
      const { score, checks } = scoreReply(prompt, reply, id)
      setRetest((r) => ({ ...r, [id]: { busy: false, score, checks } }))
    } catch (e) {
      setRetest((r) => ({ ...r, [id]: { busy: false, error: e instanceof ApiError ? e.message : 'The build failed.' } }))
    }
  }
  const cases = [...run.cases].sort((a, b) => a.score - b.score)
  return (
    <section className={`${card} p-5`}>
      <h2 className="text-[15px] font-semibold">Last night, case by case</h2>
      <p className="mt-1 text-[12.5px] text-mute">
        {dateTime(run.runAt)}
        {run.label ? ` · ${run.label}` : ''}. Weakest first; open one to see which checks failed.
      </p>
      <ul className="mt-3 divide-y divide-line">
        {cases.map((c) => {
          const failed = c.checks.filter((x) => !x.ok)
          const isOpen = open === c.id
          return (
            <li key={c.id}>
              <button type="button" onClick={() => setOpen(isOpen ? null : c.id)} className="flex w-full items-center gap-3 py-2.5 text-left" aria-expanded={isOpen}>
                <span className={`w-9 shrink-0 text-right text-[14px] font-semibold tabular-nums ${scoreTone(c.score)}`}>{c.score}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink/90">{c.prompt}</span>
                <span className="shrink-0 text-[11.5px] text-dim">{failed.length ? `${failed.length} failed` : 'all passed'}</span>
                <span className="w-10 shrink-0 text-right text-[11.5px] tabular-nums text-dim">{c.seconds}s</span>
              </button>
              {isOpen ? (
                <div className="mb-3 ml-12 space-y-2">
                  <ul className="space-y-1 text-[12.5px]">
                    {c.checks.map((x) => (
                      <li key={x.name} className={x.ok ? 'text-mute' : 'text-warn'}>
                        {x.ok ? '✓' : '✗'} {x.name}
                        {!x.ok && x.detail ? <span className="text-ink/80">: {x.detail}</span> : null}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={retest[c.id]?.busy} onClick={() => void runRetest(c.id, c.prompt)} className={`${smallBtn} border border-line-2 text-ink/90 hover:border-ink/40`}>
                      {retest[c.id]?.busy ? BUILD_NOTE : 'Re-test this case'}
                    </button>
                    {retest[c.id]?.score !== undefined ? <span className={`text-[13px] font-semibold tabular-nums ${scoreTone(retest[c.id]!.score!)}`}>Now {retest[c.id]!.score}</span> : null}
                    {retest[c.id]?.error ? <span className="text-[12px] text-warn">{retest[c.id]!.error}</span> : null}
                  </div>
                  {retest[c.id]?.checks ? <FailedChecks checks={retest[c.id]!.checks!} /> : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const ACTIONS: [string, string, string][] = [
  ['build', 'New model from words', 'the full prompt in, a whole model out'],
  ['photo', 'New model from a photo', 'as above, plus the image'],
  ['edit', 'Change to a model', 'the current model goes back in'],
  ['question', 'Question about a model', 'the model in, a short answer out'],
]

/** output tokens cost roughly 8 times input; used for the relative weights when no price is set */
const OUT_WEIGHT = 8

/** what each kind of action really costs: the numbers to set credit prices from */
function AiCost() {
  const { data, error, reload } = useLoad(getAiUsage)
  return (
    <Loading error={error} onRetry={reload}>
      {data ? <AiCostTable days={data.days} price={data.price} /> : null}
    </Loading>
  )
}

function AiCostTable({ days, price }: { days: Record<string, number | string>[]; price: ModelPrice | null }) {
  const sum = (k: string) => days.reduce((n, d) => n + (Number(d[k]) || 0), 0)
  const rows = ACTIONS.map(([k, label, note]) => {
    const n = sum(`${k}_n`)
    const inT = sum(`${k}_in`)
    const outT = sum(`${k}_out`)
    const avgIn = n ? inT / n : 0
    const avgOut = n ? outT / n : 0
    return { k, label, note, n, avgIn, avgOut, each: costOf(price, avgIn, avgOut), weight: avgIn + avgOut * OUT_WEIGHT, total: costOf(price, inT, outT) }
  })
  const cheapest = Math.min(...rows.filter((r) => r.n).map((r) => r.weight))
  const totalCost = rows.reduce((n, r) => n + (r.total ?? 0), 0)
  return (
    <section className={`${card} p-5`}>
      <h2 className="text-[15px] font-semibold">What AI actions cost</h2>
      <p className="mt-1 text-[12.5px] text-mute">
        Students’ real use over the last 30 days, averaged per action (nightly tests not included).{' '}
        {price ? `At $${price.inputPerM} in and $${price.outputPerM} out per million tokens: ${usd(totalCost)} in all.` : 'No price is known for the model in use: set it in Settings to see costs in dollars.'}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[12.5px]">
          <thead className="text-[11.5px] text-dim">
            <tr className="border-b border-line">
              <th className="py-2 font-medium">Action</th>
              <th className="py-2 text-right font-medium">Count</th>
              <th className="py-2 text-right font-medium">Tokens in</th>
              <th className="py-2 text-right font-medium">Tokens out</th>
              <th className="py-2 text-right font-medium">Cost each</th>
              <th className="py-2 text-right font-medium" title="How many of the cheapest action this one is worth: a starting point for credit prices">
                Relative
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums">
            {rows.map((r) => (
              <tr key={r.k}>
                <td className="py-2">
                  <div className="text-ink">{r.label}</div>
                  <div className="text-[11px] text-dim">{r.note}</div>
                </td>
                <td className="py-2 text-right">{r.n}</td>
                <td className="py-2 text-right">{r.n ? tokens(r.avgIn) : '–'}</td>
                <td className="py-2 text-right">{r.n ? tokens(r.avgOut) : '–'}</td>
                <td className="py-2 text-right">{r.n && r.each !== null ? usd(r.each) : '–'}</td>
                <td className="py-2 text-right">{r.n && Number.isFinite(cheapest) ? `${(r.weight / cheapest).toFixed(1)}×` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] text-dim">“Relative” weighs output tokens at {OUT_WEIGHT} times input, as they are roughly priced.</p>
    </section>
  )
}

interface LiveCase {
  id: string
  prompt: string
  kind: 'case' | 'draft'
  topic?: string
  state: 'waiting' | 'building' | 'done' | 'failed'
  score?: number
  seconds?: number
  checks?: EvalCheck[]
  error?: string
  queued?: boolean
  tokensIn?: number
  tokensOut?: number
}

/**
 * Runs the tests here, in this tab: the same cases, the same Gemini call and the same checks as the nightly
 * run, three builds at a time, with each score appearing as it lands. The run is saved with the nightly ones,
 * and drafts that reach the minimum score go to the review queue.
 */
const useLiveRun = create<{ rows: LiveCase[] | null; running: boolean }>(() => ({ rows: null, running: false }))
const liveRunStop = { current: false }

function RunNow({ onFinished }: { onFinished: () => void }) {
  const admin = useLoad(getAdminSettings)
  const [limit, setLimit] = useState('3')
  const [drafts, setDrafts] = useState('0')
  // the run lives outside the page, so it carries on (and is shown again) when the admin comes back
  const { rows, running } = useLiveRun()
  const setRows = (r: LiveCase[] | null) => useLiveRun.setState({ rows: r })
  const setRunning = (v: boolean) => useLiveRun.setState({ running: v })
  const stopRef = liveRunStop

  // leaving mid-run loses the builds still going: ask first
  useEffect(() => {
    if (!running) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [running])

  const start = async () => {
    const settings = admin.data?.settings
    const n = limit ? Math.min(EVAL_CASES.length, Number(limit)) : EVAL_CASES.length
    const d = drafts === '' ? (settings?.draftsPerNight ?? 0) : Number(drafts)
    // from the drafting pool: each topic once, topped up by Gemini when the list runs low
    let topics: DraftTopic[] = []
    if (d > 0) {
      try {
        const got = await nextTopics(Math.min(100, d), admin.data?.topics?.length ? admin.data.topics : DRAFT_TOPICS)
        topics = got.topics
        if (got.added) toast(`${got.added} new topics were suggested and added to the list.`)
      } catch (e) {
        toast(e instanceof ApiError ? e.message : 'Couldn’t get topics to draft.', { tone: 'warn' })
        return
      }
    }
    const list: LiveCase[] = [
      ...EVAL_CASES.slice(0, n).map((c) => ({ id: c.id, prompt: c.prompt, kind: 'case' as const, state: 'waiting' as const })),
      ...topics.map((t, i) => ({ id: `draft-${i}`, prompt: t.prompt, topic: t.topic, kind: 'draft' as const, state: 'waiting' as const })),
    ]
    if (!list.length) return
    stopRef.current = false
    setRows(list)
    setRunning(true)
    const task = startTask(`Test run: ${list.length} builds`, '/admin')
    const done: LiveCase[] = list.map((r) => ({ ...r }))
    const update = (i: number, patch: Partial<LiveCase>) => {
      Object.assign(done[i], patch)
      setRows(done.map((r) => ({ ...r })))
      const finished = done.filter((r) => r.state === 'done' || r.state === 'failed').length
      task.update(`${finished} of ${done.length} built`, finished, done.length)
    }
    let next = 0
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (next < list.length && !stopRef.current) {
          const i = next++
          const r = list[i]
          update(i, { state: 'building' })
          try {
            const reply = await adminBuild({ prompt: r.prompt })
            const { score, checks, spec } = scoreReply(r.prompt, reply, r.kind === 'case' ? r.id : undefined)
            let queued = false
            if (r.kind === 'draft' && score >= (settings?.draftMin ?? 85)) {
              const title = typeof spec.title === 'string' && spec.title.trim() ? spec.title.trim().slice(0, 120) : r.prompt.slice(0, 120)
              await addDraft({ title, prompt: r.prompt, topic: r.topic, spec, explanation: reply.explanation.slice(0, 4000), score, checks })
              queued = true
            }
            update(i, { state: 'done', score, checks, seconds: Math.round(reply.ms / 1000), queued, tokensIn: reply.usage?.input, tokensOut: reply.usage?.output })
          } catch (e) {
            update(i, { state: 'failed', score: 0, error: e instanceof ApiError ? e.message : 'The build failed.' })
          }
        }
      }),
    )
    const cases = done.filter((r) => r.kind === 'case' && (r.state === 'done' || r.state === 'failed'))
    if (cases.length) {
      try {
        await saveRun({
          runAt: Date.now(),
          label: 'manual',
          cases: cases.map((r) => ({
            id: r.id,
            prompt: r.prompt,
            score: r.score ?? 0,
            seconds: r.seconds ?? 0,
            checks: r.checks ?? [{ name: 'builds', ok: false, detail: r.error }],
            ...(r.error ? { error: r.error.slice(0, 300) } : {}),
            ...(r.tokensIn !== undefined ? { tokensIn: r.tokensIn, tokensOut: r.tokensOut ?? 0 } : {}),
          })),
          summary: {
            score: Math.round(cases.reduce((t, r) => t + (r.score ?? 0), 0) / cases.length),
            passed: cases.filter((r) => r.score === 100).length,
            total: cases.length,
            tokensIn: cases.reduce((t, r) => t + (r.tokensIn ?? 0), 0),
            tokensOut: cases.reduce((t, r) => t + (r.tokensOut ?? 0), 0),
          },
        })
        onFinished()
      } catch (e) {
        toast(e instanceof ApiError ? e.message : 'The run finished but couldn’t be saved.', { tone: 'warn' })
      }
    }
    setRunning(false)
    const queued = done.filter((r) => r.queued).length
    task.finish({ message: `Test run finished${stopRef.current ? ' (stopped early)' : ''}.${queued ? ` ${queued} draft${queued > 1 ? 's' : ''} in the review queue.` : ''}` })
  }

  const finished = rows?.filter((r) => r.state === 'done' || r.state === 'failed').length ?? 0
  const num = 'w-20 rounded-lg border border-line-2 bg-panel-2 px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent/60'
  return (
    <section className={`${card} p-5`}>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="min-w-48 flex-1">
          <h2 className="text-[15px] font-semibold">Run the tests now</h2>
          <p className="mt-1 text-[12.5px] text-mute">Runs here in this tab, three builds at a time, with the nightly checks. Each case or draft is one build; keep the tab open until it finishes.</p>
        </div>
        <label className="text-[11.5px] text-dim">
          Cases
          <input value={limit} disabled={running} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} placeholder={`all ${EVAL_CASES.length}`} inputMode="numeric" className={`${num} mt-1 block`} />
        </label>
        <label className="text-[11.5px] text-dim">
          Drafts
          <input value={drafts} disabled={running} onChange={(e) => setDrafts(e.target.value.replace(/\D/g, ''))} placeholder="setting" inputMode="numeric" className={`${num} mt-1 block`} />
        </label>
        {running ? (
          <button type="button" onClick={() => (stopRef.current = true)} className={`${ghostBtn} px-4 py-2 text-[13px]`}>
            Stop after these
          </button>
        ) : (
          <button type="button" disabled={!admin.data} onClick={() => void start()} className={`${primaryBtn} px-4 py-2 text-[13px]`}>
            Start run
          </button>
        )}
      </div>
      {rows ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-3 text-[11.5px] text-dim">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-2">
              <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.round((100 * finished) / rows.length)}%` }} />
            </div>
            {finished} of {rows.length}
          </div>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="py-2">
                <div className="flex items-center gap-3">
                  <span className={`w-9 shrink-0 text-right text-[13.5px] font-semibold tabular-nums ${r.score !== undefined ? scoreTone(r.score) : 'text-dim'}`}>
                    {r.state === 'building' ? <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" /> : (r.score ?? '–')}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink/90">
                    {r.kind === 'draft' ? <span className="mr-1.5 rounded bg-panel-3 px-1.5 py-0.5 text-[10.5px] text-mute">draft</span> : null}
                    {r.prompt}
                  </span>
                  <span className="shrink-0 text-[11.5px] text-dim">
                    {r.state === 'waiting'
                      ? 'waiting'
                      : r.state === 'building'
                        ? 'building…'
                        : r.state === 'failed'
                          ? 'failed'
                          : r.kind === 'draft'
                            ? r.queued
                              ? 'queued for review'
                              : 'below the minimum'
                            : `${r.seconds}s`}
                  </span>
                </div>
                {r.error ? <p className="ml-12 mt-1 text-[11.5px] text-warn">{r.error}</p> : null}
                {r.checks && r.checks.some((x) => !x.ok) ? (
                  <div className="ml-12 mt-1">
                    <FailedChecks checks={r.checks} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function Quality({ admin }: { admin: boolean }) {
  const evals = useLoad(getEvals)
  const events = useLoad(useCallback(() => (admin ? getEventSummary() : Promise.resolve(null)), [admin]))
  const runs = evals.data?.runs ?? []
  const [last, prev] = runs
  const delta = last && prev ? last.summary.score - prev.summary.score : null
  return (
    <div className="space-y-5">
      <RunNow onFinished={evals.reload} />
      <Loading error={evals.error} onRetry={evals.reload}>
        {evals.data ? (
          last ? (
            <>
              <section className={`${card} grid gap-6 p-5 sm:grid-cols-[auto_1fr]`}>
                <div>
                  <div className="text-[12px] uppercase tracking-wide text-dim">Night score</div>
                  <div className={`text-[44px] font-semibold leading-none tabular-nums ${scoreTone(last.summary.score)}`}>{last.summary.score}</div>
                  <div className="mt-2 text-[12.5px] text-mute">
                    {last.summary.passed} of {last.summary.total} builds perfect
                    {last.summary.tokensIn
                      ? ` · ${tokens(last.summary.tokensIn)} tokens in, ${tokens(last.summary.tokensOut ?? 0)} out${evals.data.price ? ` (${usd(costOf(evals.data.price, last.summary.tokensIn, last.summary.tokensOut ?? 0))})` : ''}`
                      : ''}
                    {delta !== null ? <span className={delta >= 0 ? ' text-accent' : ' text-warn'}>{` · ${delta >= 0 ? '+' : ''}${delta} on the night before`}</span> : null}
                  </div>
                  <div className="mt-1 text-[11.5px] text-dim">{dateTime(last.runAt)}</div>
                </div>
                <div>
                  <Trend runs={runs} />
                  <div className="mt-1.5 text-[11.5px] text-dim">Last {Math.min(30, runs.length)} runs</div>
                </div>
              </section>
              {evals.data.latest ? <LatestRun run={evals.data.latest} /> : null}
            </>
          ) : (
            <Empty>No test runs yet. The first one runs tonight, or start one above.</Empty>
          )
        ) : null}
      </Loading>
      {admin ? <AiCost /> : null}
      {admin ? (
        <Loading error={events.error} onRetry={events.reload}>
          {events.data ? <Usage days={events.data.days} notes={events.data.notes} /> : null}
        </Loading>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ review queue */

/** one line of the trail: when, who, what, and the detail */
function AuditLine({ e, showTarget = false }: { e: AuditEntry; showTarget?: boolean }) {
  return (
    <li className="flex flex-wrap gap-x-2 py-1.5 text-[12px]">
      <span className="w-28 shrink-0 tabular-nums text-dim">{dateTime(e.at)}</span>
      <span className="min-w-0 flex-1">
        <span className="font-medium text-ink">{e.by.name}</span> <span className="text-ink/85">{e.action}</span>
        {showTarget && e.target.title ? <span className="text-ink/85"> “{e.target.title}”</span> : null}
        {e.detail ? <span className="block text-mute">{e.detail}</span> : null}
      </span>
    </li>
  )
}

/** a draft as a JSON file (request, score, checks, explanation and the model itself), to look at or send on */
function downloadDraft(d: LibraryDraft) {
  const { thumbnail: _t, ...rest } = d
  void _t
  const slug = d.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'draft'
  const url = URL.createObjectURL(new Blob([JSON.stringify(rest, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `${slug}.json` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function DraftHistory({ id }: { id: string }) {
  const load = useCallback(() => getHistory(id), [id])
  const { data, error, reload } = useLoad(load)
  return (
    <div className="rounded-xl border border-line px-3 py-1">
      <Loading error={error} onRetry={reload}>
        {data ? (
          data.entries.length ? (
            <ul className="divide-y divide-line">
              {data.entries.map((e, i) => (
                <AuditLine key={i} e={e} />
              ))}
            </ul>
          ) : (
            <p className="py-2 text-[12px] text-dim">Nothing recorded yet.</p>
          )
        ) : null}
      </Loading>
    </div>
  )
}

const CHECKS: [keyof ReviewChecklist, string][] = [
  ['calculations', 'Calculations and graphs checked'],
  ['model', 'Model looks right: every part in place and held'],
  ['text', 'Title, labels and explanation clear'],
]

function DraftCard({ d, onDone, onChanged, backTo }: { d: LibraryDraft; onDone: (approved: boolean) => void; onChanged: (d: LibraryDraft) => void; backTo: string }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(d.title)
  const [busy, setBusy] = useState<null | 'open' | 'approve' | 'reject' | 'fix' | 'rebuild'>(null)
  const [fixing, setFixing] = useState(false)
  const [note, setNote] = useState('')
  // the review: what has been checked, and the reviewer's notes (kept on the draft)
  const [checklist, setChecklist] = useState<ReviewChecklist>(d.checklist ?? {})
  const [notes, setNotes] = useState(d.reviewNotes ?? '')
  const [rejecting, setRejecting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [reason, setReason] = useState('')
  const allChecked = CHECKS.every(([k]) => checklist[k])
  const mech = draftMechanism(d)
  const now = draftLive(d)
  const tick = (k: keyof ReviewChecklist, v: boolean) => {
    const next = { ...checklist, [k]: v }
    setChecklist(next)
    void updateDraft(d.id, { checklist: next }).catch(() => toast('Couldn’t save that tick.', { tone: 'warn' }))
  }
  const saveNotes = () => {
    if ((d.reviewNotes ?? '') === notes.trim()) return
    void updateDraft(d.id, { reviewNotes: notes.trim() })
      .then(() => onChanged({ ...d, reviewNotes: notes.trim() }))
      .catch(() => toast('Couldn’t save the notes.', { tone: 'warn' }))
  }

  /** a change asked of Gemini (or a fresh build), scored again and saved over the draft */
  const remake = async (kind: 'fix' | 'rebuild') => {
    setBusy(kind)
    try {
      const reply =
        kind === 'fix'
          ? await adminBuild({ prompt: note.trim(), currentSpec: d.spec, history: d.explanation ? [{ prompt: d.prompt, response: d.explanation.slice(0, 2000) }] : [] })
          : await adminBuild({ prompt: d.prompt })
      const { score, checks, spec } = scoreReply(d.prompt, reply)
      const updated = await updateDraft(d.id, { thumbnail: undefined, spec, explanation: reply.explanation.slice(0, 4000), score, checks })
      onChanged({ ...updated, thumbnail: undefined })
      setFixing(false)
      setNote('')
      toast(`${kind === 'fix' ? 'Fixed' : 'Rebuilt'}: now scores ${score}.`)
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'The build failed. Please try again.', { tone: 'warn' })
    } finally {
      setBusy(null)
    }
  }

  const act = async (kind: 'open' | 'approve' | 'reject') => {
    setBusy(kind)
    try {
      if (kind === 'open') {
        // the full workspace, as a preview: nothing is saved to My models
        setPreviewModel({ title: d.title, prompt: d.prompt, spec: d.spec, explanation: d.explanation, backTo, draftId: d.id })
        navigate('/create/preview')
        return
      }
      if (kind === 'approve') await approveDraft(d.id, title.trim() && title.trim() !== d.title ? title.trim() : undefined)
      else await rejectDraft(d.id, reason.trim() || undefined)
      toast(kind === 'approve' ? `Published “${title.trim() || d.title}”.` : 'Draft rejected.')
      onDone(kind === 'approve')
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'That didn’t work. Please try again.', { tone: 'warn' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <article className={`${card} flex flex-col gap-3 overflow-hidden p-4`}>
      <div className="relative -mx-4 -mt-4 mb-1 aspect-[16/10] overflow-hidden rounded-t-2xl bg-[var(--color-stage)]">
        {d.thumbnail ? <img src={d.thumbnail} alt="" className="h-full w-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-[11.5px] text-dim">Drawing a picture…</span>}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {d.topic ? <div className="text-[11.5px] uppercase tracking-wide text-dim">{d.topic}</div> : null}
          <input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={`${inputCls} mt-1 py-1.5! font-semibold`} />
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-[22px] font-semibold leading-none tabular-nums ${scoreTone(now.score)}`} title={now.score !== d.score ? `Scored ${d.score} when drafted` : undefined}>
            {now.score}
          </div>
          <div className="mt-1 text-[11px] text-dim">score</div>
        </div>
      </div>
      <p className="text-[12.5px] leading-snug text-mute">{d.prompt}</p>
      <p className="text-[11.5px] text-dim">
        {d.parts} parts · drafted {dateTime(d.createdAt)} ·{' '}
        <button type="button" onClick={() => setShowHistory((v) => !v)} className="text-mute underline-offset-2 hover:text-ink hover:underline">
          {showHistory ? 'Hide history' : 'History'}
        </button>
      </p>
      {showHistory ? <DraftHistory id={d.id} /> : null}
      {mech.length ? (
        <div className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-[11.5px] leading-snug">
          <div className="font-medium text-warn">Moves wrongly: rebuild it</div>
          <ul className="mt-0.5 space-y-0.5 text-ink/80">
            {mech.map((m) => (
              <li key={m}>· {m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <FailedChecks checks={now.checks.filter((x) => x.name !== 'mechanism moves right')} />
      <fieldset className="rounded-xl border border-line px-3 py-2.5">
        <legend className="px-1 text-[11px] font-medium uppercase tracking-wide text-dim">Review</legend>
        {CHECKS.map(([k, label]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 py-0.5 text-[12.5px] text-ink/90">
            <input type="checkbox" checked={!!checklist[k]} onChange={(e) => tick(k, e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-accent)]" />
            {label}
          </label>
        ))}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          rows={2}
          maxLength={2000}
          placeholder="Notes: what you checked, what you changed"
          className={`${inputCls} mt-2 text-[12.5px]`}
        />
      </fieldset>
      {rejecting ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void act('reject')
          }}
        >
          <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Why? e.g. the rods don’t reach the crank" className={`${inputCls} text-[12.5px]`} />
          <div className="flex gap-2">
            <button type="submit" disabled={!!busy} className={`${smallBtn} bg-warn/15 text-warn hover:bg-warn/25`}>
              {busy === 'reject' ? 'Rejecting…' : 'Reject the draft'}
            </button>
            <button type="button" disabled={!!busy} onClick={() => setRejecting(false)} className={`${smallBtn} text-mute hover:text-ink`}>
              Keep it
            </button>
          </div>
        </form>
      ) : null}
      {fixing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (note.trim()) void remake('fix')
          }}
        >
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={1500}
            placeholder="What’s wrong, e.g. “the connecting rods don’t reach the crank and the flywheel is tilted”"
            className={`${inputCls} text-[12.5px]`}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={!!busy || !note.trim()} className={`${smallBtn} bg-ink text-bg hover:opacity-90`}>
              {busy === 'fix' ? BUILD_NOTE : 'Ask Gemini to fix it'}
            </button>
            <button type="button" disabled={!!busy} onClick={() => setFixing(false)} className={`${smallBtn} text-mute hover:text-ink`}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <button type="button" disabled={!!busy} onClick={() => void act('open')} className={`${smallBtn} border border-line-2 text-ink/90 hover:border-ink/40`}>
          {busy === 'open' ? 'Opening…' : 'Open in 3D'}
        </button>
        <button
          type="button"
          disabled={!!busy || !allChecked}
          onClick={() => void act('approve')}
          title={allChecked ? 'Publish it to the library' : 'Tick all three checks first'}
          className={`${smallBtn} bg-accent text-accent-ink hover:opacity-90`}
        >
          {busy === 'approve' ? 'Publishing…' : 'Approve'}
        </button>
        {fixing ? null : (
          <button type="button" disabled={!!busy} onClick={() => setFixing(true)} className={`${smallBtn} border border-line-2 text-ink/90 hover:border-ink/40`}>
            Fix…
          </button>
        )}
        <button type="button" disabled={!!busy} onClick={() => void remake('rebuild')} className={`${smallBtn} border border-line-2 text-ink/90 hover:border-ink/40`}>
          {busy === 'rebuild' ? BUILD_NOTE : 'Rebuild'}
        </button>
        <button type="button" onClick={() => downloadDraft(d)} title="The draft as a file: its request, score, checks and model" className={`${smallBtn} border border-line-2 text-ink/90 hover:border-ink/40`}>
          Download
        </button>
        {rejecting ? null : (
          <button type="button" disabled={!!busy} onClick={() => setRejecting(true)} className={`${smallBtn} ml-auto text-mute hover:bg-panel-2 hover:text-warn`}>
            Reject…
          </button>
        )}
      </div>
    </article>
  )
}

/** a draft from any prompt, built and scored now, and added to the queue whatever it scores */
function NewDraft({ onAdded }: { onAdded: () => void }) {
  const [prompt, setPrompt] = useState('')
  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState(false)
  const build = async (e: FormEvent) => {
    e.preventDefault()
    const p = prompt.trim()
    if (!p) return
    setBusy(true)
    try {
      const reply = await adminBuild({ prompt: p })
      const { score, checks, spec } = scoreReply(p, reply)
      const title = typeof spec.title === 'string' && spec.title.trim() ? spec.title.trim().slice(0, 120) : p.slice(0, 120)
      await addDraft({ title, prompt: p, topic: topic.trim() || undefined, spec, explanation: reply.explanation.slice(0, 4000), score, checks })
      toast(`Drafted “${title}”: scores ${score}.`)
      setPrompt('')
      onAdded()
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'The build failed. Please try again.', { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={build} className={`${card} mb-4 flex flex-wrap items-end gap-3 p-4`}>
      <label className="min-w-60 flex-[3] text-[11.5px] text-dim">
        Draft a model
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={400} placeholder="e.g. A worm gear reducer, 30 : 1, on a cast-iron base" className={`${inputCls} mt-1`} />
      </label>
      <label className="min-w-36 flex-1 text-[11.5px] text-dim">
        Topic (optional)
        <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={60} placeholder="Gears and drives" className={`${inputCls} mt-1`} />
      </label>
      <button type="submit" disabled={busy || !prompt.trim()} className={`${primaryBtn} px-4 py-2.5 text-[13px]`}>
        {busy ? BUILD_NOTE : 'Build and score'}
      </button>
    </form>
  )
}

/** the review queue: on the admin page (with drafting) and on the reviewers' page */
/** one run at a time across the page (it carries on as a background task when the page is left) */
let rebuilding = false

/**
 * Rebuilds every draft that fails a serious check today (broken layout or motion, dropped shapes, broken sums; a fresh build from its request, with today's
 * prompt), one after another, as a background task; each is scored again and saved over the draft. Each
 * rebuild is a Gemini build, so it asks first.
 */
function RebuildFlagged({ flagged, onChanged }: { flagged: LibraryDraft[]; onChanged: (d: LibraryDraft) => void }) {
  const [asking, setAsking] = useState(false)
  const [running, setRunning] = useState(rebuilding)
  if (!flagged.length) return null
  const run = async () => {
    setAsking(false)
    if (rebuilding) return
    rebuilding = true
    setRunning(true)
    const list = [...flagged]
    const task = startTask(`Rebuilding ${list.length} flagged draft${list.length === 1 ? '' : 's'}`, '/admin?tab=review')
    let ok = 0
    let fixed = 0
    try {
      for (let i = 0; i < list.length; i++) {
        const d = list[i]
        task.update(`“${d.title}”`, i, list.length)
        try {
          const reply = await adminBuild({ prompt: d.prompt })
          const { score, checks, spec } = scoreReply(d.prompt, reply)
          const updated = await updateDraft(d.id, { thumbnail: undefined, spec, explanation: reply.explanation.slice(0, 4000), score, checks })
          const next = { ...d, ...updated, thumbnail: undefined }
          onChanged(next)
          ok++
          if (!draftFaults(next).length) fixed++
        } catch {
          // one failed build doesn't stop the rest
        }
      }
      task.update(undefined, list.length, list.length)
      if (ok) task.finish({ message: `Rebuilt ${ok} of ${list.length} drafts; ${fixed} now pass today’s checks.` })
      else task.fail('none of the rebuilds worked')
    } finally {
      rebuilding = false
      setRunning(false)
    }
  }
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-warn/40 bg-warn/10 px-3 py-2 text-[12.5px]">
      <span className="text-ink/90">
        <b className="font-semibold text-warn">{flagged.length}</b> draft{flagged.length === 1 ? '' : 's'} fail{flagged.length === 1 ? 's' : ''} today’s checks
        {(() => {
          const counts = new Map<string, number>()
          for (const d of flagged) for (const f of new Set(draftFaults(d))) counts.set(f, (counts.get(f) ?? 0) + 1)
          return counts.size ? ` (${[...counts].map(([f, n]) => `${n} ${f}`).join(', ')})` : ''
        })()}
        .
      </span>
      {running ? (
        <span className="text-mute">Rebuilding: see the task tray.</span>
      ) : asking ? (
        <>
          <span className="text-mute">
            {flagged.length} new Gemini build{flagged.length === 1 ? '' : 's'}, about a minute each.
          </span>
          <button type="button" onClick={() => void run()} className={`${smallBtn} bg-warn/20 text-warn hover:bg-warn/30`}>
            Rebuild {flagged.length}
          </button>
          <button type="button" onClick={() => setAsking(false)} className={`${smallBtn} text-mute hover:text-ink`}>
            Cancel
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className={`${smallBtn} border border-warn/50 text-warn hover:bg-warn/15`}>
          Rebuild all flagged
        </button>
      )}
    </div>
  )
}

export function ReviewQueue({ canDraft = true, backTo = '/admin?tab=review' }: { canDraft?: boolean; backTo?: string }) {
  const { data, setData, error, reload } = useLoad(getDrafts)
  // drafts without a picture get one drawn, one at a time (each uses the page's one 3D view)
  const tried = useRef(new Set<string>())
  const [, bump] = useState(0)
  const missing = data?.drafts.find((d) => !d.thumbnail && !tried.current.has(`${d.id}:${d.score}:${d.parts}`))
  return (
    <>
      {missing ? (
        <ThumbnailMaker
          key={`${missing.id}:${missing.score}:${missing.parts}`}
          spec={missing.spec}
          prompt={missing.prompt}
          onDone={(url) => {
            tried.current.add(`${missing.id}:${missing.score}:${missing.parts}`)
            bump((n) => n + 1)
            if (!url) return
            setData((cur) => (cur ? { drafts: cur.drafts.map((x) => (x.id === missing.id ? { ...x, thumbnail: url } : x)) } : cur))
            void updateDraft(missing.id, { thumbnail: url }).catch(() => {})
          }}
        />
      ) : null}
      {canDraft ? <NewDraft onAdded={reload} /> : null}
      <Loading error={error} onRetry={reload}>
        {data ? (
          data.drafts.length ? (
            <>
              <RebuildFlagged
                flagged={data.drafts.filter((d) => draftFaults(d).length)}
                onChanged={(u) => setData((cur) => (cur ? { drafts: cur.drafts.map((x) => (x.id === u.id ? { ...x, ...u } : x)) } : cur))}
              />
              <p className="mb-3 text-[12.5px] text-mute">
                Scored by the same checks as the test set. Approved models appear on the Create page for everyone; open one first to look round it in the workspace (a preview: nothing is saved), or ask Gemini to fix
                what’s wrong.
              </p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.drafts.map((d) => (
                  <DraftCard
                    key={d.id}
                    d={d}
                    backTo={backTo}
                    onDone={() => setData({ drafts: data.drafts.filter((x) => x.id !== d.id) })}
                    onChanged={(u) => setData({ drafts: data.drafts.map((x) => (x.id === d.id ? { ...x, ...u } : x)) })}
                  />
                ))}
              </div>
            </>
          ) : (
            <Empty>Nothing waiting. Each night’s run drafts new models from the topic list and queues the ones that reach the minimum score in Settings.</Empty>
          )
        ) : null}
      </Loading>
    </>
  )
}

/* ------------------------------------------------------------------ library */

function LibraryRow({ item, onChanged, onRemoved }: { item: LibraryCard; onChanged: (patch: Partial<LibraryCard>) => void; onRemoved: () => void }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(item.title)
  const [topic, setTopic] = useState(item.topic ?? '')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState<null | 'save' | 'open' | 'remove' | 'free'>(null)
  const dirty = title.trim() !== item.title || topic.trim() !== (item.topic ?? '')
  const toggleFree = async () => {
    setBusy('free')
    try {
      await updateLibraryItem(item.id, { open: !item.free })
      onChanged({ open: !item.free, free: !item.free })
      toast(item.free ? `“${item.title}” now needs sign-in to open.` : `Anyone can open “${item.title}”, signed in or not.`)
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'That didn’t work. Please try again.', { tone: 'warn' })
    }
    setBusy(null)
  }

  const run = async (kind: 'save' | 'open' | 'remove') => {
    setBusy(kind)
    try {
      if (kind === 'save') {
        await updateLibraryItem(item.id, { title: title.trim(), topic: topic.trim() })
        onChanged({ title: title.trim(), topic: topic.trim() || undefined })
        toast('Saved.')
      } else if (kind === 'open') {
        const full = await getLibraryItem(item.id)
        setPreviewModel({ title: full.title, prompt: full.prompt, spec: full.spec, explanation: full.explanation, backTo: '/admin?tab=library' })
        navigate('/create/preview')
        return
      } else {
        await unpublish(item.id)
        toast(`“${item.title}” is no longer in the library.`)
        onRemoved()
        return
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'That didn’t work. Please try again.', { tone: 'warn' })
    }
    setBusy(null)
  }

  return (
    <li className="grid gap-3 px-4 py-3 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-center">
      <div className="hidden aspect-[16/10] overflow-hidden rounded-lg bg-[var(--color-stage)] md:block">{item.thumbnail ? <img src={item.thumbnail} alt="" className="h-full w-full object-cover" /> : null}</div>
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={`${inputCls} py-1.5! font-semibold`} />
        <input aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={60} placeholder="Topic" className={`${inputCls} py-1.5!`} />
        <p className="truncate text-[11.5px] text-dim sm:col-span-2">
          {item.parts} parts · score {item.score} · published {item.publishedAt ? date(item.publishedAt) : '—'}
          {item.reviewedBy ? ` by ${item.reviewedBy.name}` : ''} · {item.prompt}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {dirty ? (
          <button type="button" disabled={!!busy || !title.trim()} onClick={() => void run('save')} className={`${smallBtn} bg-ink text-bg hover:opacity-90`}>
            {busy === 'save' ? 'Saving…' : 'Save'}
          </button>
        ) : null}
        <button type="button" disabled={!!busy} onClick={() => void run('open')} className={`${smallBtn} border border-line-2 text-ink/90 hover:border-ink/40`}>
          {busy === 'open' ? 'Opening…' : 'Open in 3D'}
        </button>
        <button
          type="button"
          disabled={!!busy}
          aria-pressed={!!item.free}
          onClick={() => void toggleFree()}
          title={item.free ? 'Anyone can open it, signed in or not. Press to make it sign-in only.' : 'Only people signed in can open it. Press to let anyone open it.'}
          className={`${smallBtn} border ${item.free ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line-2 text-mute hover:border-ink/40'}`}
        >
          {busy === 'free' ? 'Saving…' : item.free ? 'Free to view' : 'Sign-in only'}
        </button>
        {confirm ? (
          <>
            <button type="button" disabled={!!busy} onClick={() => void run('remove')} className={`${smallBtn} bg-warn/15 text-warn hover:bg-warn/25`}>
              {busy === 'remove' ? 'Removing…' : 'Yes, unpublish'}
            </button>
            <button type="button" disabled={!!busy} onClick={() => setConfirm(false)} className={`${smallBtn} text-mute hover:text-ink`}>
              Keep
            </button>
          </>
        ) : (
          <button type="button" disabled={!!busy} onClick={() => setConfirm(true)} className={`${smallBtn} text-mute hover:bg-panel-2 hover:text-warn`}>
            Unpublish
          </button>
        )}
      </div>
    </li>
  )
}

function Library() {
  const { data, setData, error, reload } = useLoad(listLibrary)
  // published before pictures were kept: draw them, one at a time
  const tried = useRef(new Set<string>())
  const [drawing, setDrawing] = useState<{ id: string; spec: Record<string, unknown>; prompt: string } | null>(null)
  useEffect(() => {
    if (drawing || !data) return
    const item = data.items.find((x) => !x.thumbnail && !tried.current.has(x.id))
    if (!item) return
    tried.current.add(item.id)
    getLibraryItem(item.id)
      .then((full) => setDrawing({ id: item.id, spec: full.spec, prompt: full.prompt }))
      .catch(() => setDrawing(null))
  }, [data, drawing])
  return (
    <Loading error={error} onRetry={reload}>
      {drawing ? (
        <ThumbnailMaker
          key={drawing.id}
          spec={drawing.spec}
          prompt={drawing.prompt}
          onDone={(url) => {
            const id = drawing.id
            setDrawing(null)
            if (!url) return
            setData((cur) => (cur ? { items: cur.items.map((x) => (x.id === id ? { ...x, thumbnail: url } : x)) } : cur))
            void updateLibraryItem(id, { thumbnail: url }).catch(() => {})
          }}
        />
      ) : null}
      {data ? (
        data.items.length ? (
          <>
            <p className="mb-3 text-[12.5px] text-mute">
              {data.items.length} published, shown to everyone on the Create page, newest first. Unpublishing removes it from the page; students who already opened it keep their own copy. Models free to view can be opened by anyone, signed in or not (until you choose any, the six best scored are); the rest need sign-in.
            </p>
            <ul className={`${card} divide-y divide-line`}>
              {data.items.map((item) => (
                <LibraryRow
                  key={item.id}
                  item={item}
                  onChanged={(patch) => setData({ items: data.items.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) })}
                  onRemoved={() => setData({ items: data.items.filter((x) => x.id !== item.id) })}
                />
              ))}
            </ul>
          </>
        ) : (
          <Empty>Nothing published yet. Approve a draft in the Review queue, or use Publish in the workspace on any model you build.</Empty>
        )
      ) : null}
    </Loading>
  )
}

/* ------------------------------------------------------------------ activity */

/** the audit trail: who did what to drafts, the library and the settings, filterable by person and action */
function Activity() {
  const [by, setBy] = useState('')
  const [action, setAction] = useState('')
  const load = useCallback(() => getAudit({ by, action }), [by, action])
  const { data, error, reload } = useLoad(load)
  const select = 'rounded-lg border border-line-2 bg-panel-2 px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-accent/60'
  return (
    <section className={`${card} p-5`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Activity</h2>
          <p className="mt-1 text-[12.5px] text-mute">Everything done to drafts, the library, reviewers and settings, newest first. Nothing here can be edited.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Person" value={by} onChange={(e) => setBy(e.target.value)} className={select}>
            <option value="">Everyone</option>
            {data?.people.map((p) => (
              <option key={p.uid} value={p.uid}>
                {p.name}
              </option>
            ))}
          </select>
          <select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)} className={select}>
            <option value="">Every action</option>
            {data?.actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <Loading error={error} onRetry={reload}>
          {data ? (
            data.entries.length ? (
              <ul className="divide-y divide-line">
                {data.entries.map((e, i) => (
                  <AuditLine key={i} e={e} showTarget />
                ))}
              </ul>
            ) : (
              <Empty>Nothing recorded yet.</Empty>
            )
          ) : null}
        </Loading>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ users */

const ROLE_INFO: [StaffRole, string, string][] = [
  ['admin', 'Admin', 'everything, people included'],
  ['curator', 'Curator', 'the library: drafting, topics, publishing, editing; and reviewing'],
  ['reviewer', 'Reviewer', 'checks drafts and publishes them'],
  ['support', 'Support', 'feedback and the waitlist'],
  ['ambassador', 'Ambassador', 'a student who brings their school: referral link and dashboard'],
]

function RolePicker({ value, onChange, disabled, owner }: { value: StaffRole[]; onChange: (r: StaffRole[]) => void; disabled?: boolean; owner?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ROLE_INFO.map(([r, label, hint]) => {
        const on = value.includes(r)
        const locked = owner && r === 'admin'
        return (
          <button
            key={r}
            type="button"
            title={locked ? 'An owner (set on the server): always an admin' : hint}
            aria-pressed={on}
            disabled={disabled || locked}
            onClick={() => onChange(on ? value.filter((x) => x !== r) : [...value, r])}
            className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors disabled:cursor-default ${on ? 'border-ink bg-ink text-bg' : 'border-line-2 text-mute hover:border-ink/40 hover:text-ink'} ${locked ? 'opacity-80' : ''}`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

/** staff and their roles; anyone looked up by email */
function Users() {
  const { data, setData, error, reload } = useLoad(getPeople)
  const [email, setEmail] = useState('')
  const [roles, setNewRoles] = useState<StaffRole[]>(['reviewer'])
  const [busy, setBusy] = useState<string | null>(null)
  const [found, setFound] = useState<Lookup | null>(null)
  const [query, setQuery] = useState('')

  const save = async (who: string, next: StaffRole[]) => {
    setBusy(who)
    try {
      const res = await setRoles(who, next)
      setData((cur) => {
        if (!cur) return cur
        const rest = cur.people.filter((p) => p.email !== res.email)
        const had = cur.people.find((p) => p.email === res.email)
        return {
          ...cur,
          people: res.roles.length ? [...rest, { ...(had ?? { email: res.email, owner: false }), roles: res.roles }].sort((x, y) => Number(y.owner) - Number(x.owner) || x.email.localeCompare(y.email)) : rest,
        }
      })
      if (found?.email === res.email) setFound({ ...found, roles: res.roles })
      return true
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t change the roles.', { tone: 'warn' })
      return false
    } finally {
      setBusy(null)
    }
  }
  const look = async (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim().toLowerCase()
    if (!q) return
    setBusy('lookup')
    try {
      setFound(await lookupPerson(q))
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Couldn’t look that up.', { tone: 'warn' })
    } finally {
      setBusy(null)
    }
  }
  const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

  return (
    <div className="space-y-5">
      <Loading error={error} onRetry={reload}>
        {data ? (
          <section className={`${card} p-5`}>
            <h2 className="text-[15px] font-semibold">Staff</h2>
            <p className="mt-1 text-[12.5px] text-mute">
              Roles are given by email, to the Google account the person signs in with; they apply from their next page load. Owners are set on the server and are always admins. Every change is in Activity.
            </p>
            <ul className="mt-3 divide-y divide-line">
              {data.people.map((p) => (
                <li key={p.email} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium text-ink">
                      {p.name ?? p.email}
                      {p.owner ? <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-medium text-accent">owner</span> : null}
                    </div>
                    <div className="truncate text-[12px] text-mute">
                      {p.name ? p.email : 'Not signed in yet'}
                      {p.joined ? ` · joined ${date(p.joined)}` : ''}
                    </div>
                  </div>
                  <RolePicker value={p.roles} owner={p.owner} disabled={busy === p.email} onChange={(next) => void save(p.email, next)} />
                </li>
              ))}
            </ul>
            <form
              className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4"
              onSubmit={(e) => {
                e.preventDefault()
                const v = email.trim().toLowerCase()
                if (!validEmail(v)) return toast('That doesn’t look like an email address.', { tone: 'warn' })
                if (!roles.length) return toast('Pick at least one role.', { tone: 'warn' })
                void save(v, roles).then((ok) => ok && setEmail(''))
              }}
            >
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@example.com" aria-label="Email" className={`${inputCls} max-w-xs`} />
              <RolePicker value={roles} onChange={setNewRoles} />
              <button type="submit" disabled={!!busy || !email.trim()} className={`${primaryBtn} ml-auto`}>
                Add
              </button>
            </form>
          </section>
        ) : null}
      </Loading>

      <Everyone onRoles={save} busy={busy} />

      <section className={`${card} p-5`}>
        <h2 className="text-[15px] font-semibold">Look someone up</h2>
        <form onSubmit={look} className="mt-3 flex flex-wrap gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} type="email" placeholder="student@example.com" aria-label="Email to look up" className={`${inputCls} max-w-xs`} />
          <button type="submit" disabled={busy === 'lookup' || !query.trim()} className={ghostBtn}>
            {busy === 'lookup' ? 'Looking…' : 'Look up'}
          </button>
        </form>
        {found ? (
          found.found ? (
            <div className="mt-4 space-y-3 rounded-xl border border-line p-4">
              <div>
                <div className="text-[14px] font-semibold text-ink">{found.name}</div>
                <div className="text-[12px] text-mute">
                  {found.email} · {found.role === 'teacher' ? 'teacher' : 'student'}
                  {found.joined ? ` · joined ${date(found.joined)}` : ''} · {found.models ?? 0} saved models
                </div>
              </div>
              {found.today ? (
                <div className="flex flex-wrap gap-3 text-[12px]">
                  <span className="rounded-lg border border-line px-2.5 py-1.5">
                    3D builds today: <b className="tabular-nums">{found.today.builds}</b>
                  </span>
                  <span className="rounded-lg border border-line px-2.5 py-1.5">
                    Note pages today: <b className="tabular-nums">{found.today.notePages}</b>
                  </span>
                  <span className="rounded-lg border border-line px-2.5 py-1.5">
                    Tutor questions today: <b className="tabular-nums">{found.today.tutor}</b>
                  </span>
                  <span className="rounded-lg border border-line px-2.5 py-1.5">
                    Library models today: <b className="tabular-nums">{found.today.libraryModels ?? 0}</b> of 100
                  </span>
                </div>
              ) : null}
              <div>
                <div className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wide text-dim">Roles</div>
                <RolePicker value={found.roles} owner={data?.people.find((p) => p.email === found.email)?.owner} disabled={busy === found.email} onChange={(next) => void save(found.email, next)} />
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[12.5px] text-mute">No account with that email yet. You can still give it a role above; it applies when they sign in.</p>
          )
        ) : null}
      </section>
    </div>
  )
}

const ago = (t: number | null) => {
  if (!t) return 'never'
  const d = Math.floor((Date.now() - t) / 86_400_000)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d} days ago` : date(t)
}
const selectCls = 'rounded-lg border border-line-2 bg-panel-2 px-2 py-1.5 text-[12.5px] text-ink'

/** every account: searched, filtered, sorted, fifty to a page; a row opens to show today's use and roles */
function Everyone({ onRoles, busy }: { onRoles: (email: string, roles: StaffRole[]) => Promise<boolean>; busy: string | null }) {
  const [f, setF] = useState<AccountFilter>({ q: '', type: 'all', role: 'all', active: 'all', sort: 'joined', dir: 'desc', page: 1 })
  const [typed, setTyped] = useState('')
  const [data, setData] = useState<Awaited<ReturnType<typeof getAccounts>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [detail, setDetail] = useState<Lookup | null>(null)
  const set = (patch: Partial<AccountFilter>) => setF((cur) => ({ ...cur, page: 1, ...patch }))

  // search as you type, after a pause
  useEffect(() => {
    const t = window.setTimeout(() => setF((cur) => (cur.q === typed.trim() ? cur : { ...cur, page: 1, q: typed.trim() })), 300)
    return () => window.clearTimeout(t)
  }, [typed])
  useEffect(() => {
    let alive = true
    setLoading(true)
    getAccounts(f)
      .then((d) => {
        if (!alive) return
        setData(d)
        setError(null)
      })
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : 'Couldn’t load the accounts.'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [f])
  useEffect(() => {
    setDetail(null)
    if (!open) return
    let alive = true
    lookupPerson(open)
      .then((d) => alive && setDetail(d))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [open])

  const changeRoles = async (a: Account, next: StaffRole[]) => {
    if (!(await onRoles(a.email, next))) return
    setData((cur) => (cur ? { ...cur, accounts: cur.accounts.map((x) => (x.email === a.email ? { ...x, roles: next } : x)) } : cur))
  }
  const sortBtn = (key: AccountFilter['sort'], label: string) => (
    <button
      type="button"
      onClick={() => set({ sort: key, dir: f.sort === key && f.dir === 'desc' ? 'asc' : 'desc' })}
      className={`inline-flex items-center gap-1 uppercase ${f.sort === key ? 'text-ink' : 'text-dim hover:text-ink'}`}
    >
      {label}
      {f.sort === key ? <span aria-hidden>{f.dir === 'desc' ? '↓' : '↑'}</span> : null}
    </button>
  )
  const badges = (a: Account) => (
    <div className="flex flex-wrap gap-1">
      {a.owner ? <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-medium text-accent">owner</span> : null}
      {a.roles.map((r) => (
        <span key={r} className="rounded-full border border-line-2 px-2 py-0.5 text-[10.5px] text-mute">
          {r}
        </span>
      ))}
    </div>
  )
  const details = (a: Account) =>
    !detail ? (
      <p className="text-[12px] text-mute">Loading…</p>
    ) : (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 text-[12px]">
          <span className="rounded-lg border border-line px-2.5 py-1.5">
            Saved models: <b className="tabular-nums">{detail.models ?? 0}</b>
          </span>
          <span className="rounded-lg border border-line px-2.5 py-1.5">
            3D builds today: <b className="tabular-nums">{detail.today?.builds ?? 0}</b>
          </span>
          <span className="rounded-lg border border-line px-2.5 py-1.5">
            Note pages today: <b className="tabular-nums">{detail.today?.notePages ?? 0}</b>
          </span>
          <span className="rounded-lg border border-line px-2.5 py-1.5">
            Tutor questions today: <b className="tabular-nums">{detail.today?.tutor ?? 0}</b>
          </span>
          <span className="rounded-lg border border-line px-2.5 py-1.5">
            Library models today: <b className="tabular-nums">{detail.today?.libraryModels ?? 0}</b> of 100
          </span>
          {a.referredBy ? (
            <span className="rounded-lg border border-line px-2.5 py-1.5">
              Came through ambassador <b>{a.referredBy}</b>
            </span>
          ) : null}
        </div>
        {a.email ? (
          <div>
            <div className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wide text-dim">Roles</div>
            <RolePicker value={a.roles} owner={a.owner} disabled={busy === a.email} onChange={(next) => void changeRoles(a, next)} />
          </div>
        ) : null}
      </div>
    )
  const c = data?.counts
  const from = data && data.total ? (data.page - 1) * data.size + 1 : 0
  const to = data ? Math.min(data.total, data.page * data.size) : 0

  return (
    <section className={`${card} p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Everyone</h2>
        {c ? (
          <p className="text-[12px] text-mute">
            {c.all} accounts · {c.students} students · {c.teachers} teachers · {c.staff} staff · {c.active7} active this week · {c.new7} new this week
          </p>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={typed} onChange={(e) => setTyped(e.target.value)} type="search" placeholder="Search name or email" aria-label="Search accounts" className={`${inputCls} min-w-0 flex-1 basis-48`} />
        <select aria-label="Student or teacher" value={f.type} onChange={(e) => set({ type: e.target.value as AccountFilter['type'] })} className={selectCls}>
          <option value="all">Students and teachers</option>
          <option value="student">Students</option>
          <option value="teacher">Teachers</option>
        </select>
        <select aria-label="Role" value={f.role} onChange={(e) => set({ role: e.target.value as AccountFilter['role'] })} className={selectCls}>
          <option value="all">Any role</option>
          <option value="staff">Staff (any role)</option>
          <option value="none">No role</option>
          {ROLE_INFO.map(([r, label]) => (
            <option key={r} value={r}>
              {label}s
            </option>
          ))}
        </select>
        <select aria-label="Last seen" value={f.active} onChange={(e) => set({ active: e.target.value as AccountFilter['active'] })} className={selectCls}>
          <option value="all">Seen any time</option>
          <option value="7">Seen this week</option>
          <option value="30">Seen this month</option>
          <option value="inactive">Not seen for a month</option>
        </select>
        {/* phones have no column headers to sort by */}
        <select
          aria-label="Sort"
          value={`${f.sort}:${f.dir}`}
          onChange={(e) => {
            const [sort, dir] = e.target.value.split(':')
            set({ sort: sort as AccountFilter['sort'], dir: dir as AccountFilter['dir'] })
          }}
          className={`${selectCls} sm:hidden`}
        >
          <option value="joined:desc">Newest first</option>
          <option value="joined:asc">Oldest first</option>
          <option value="seen:desc">Seen most recently</option>
          <option value="seen:asc">Seen longest ago</option>
          <option value="name:asc">Name A–Z</option>
          <option value="email:asc">Email A–Z</option>
        </select>
        <button type="button" className={ghostBtn} onClick={() => void download(`/v1/admin/accounts.csv?${accountQuery(f)}`, 'solidify-accounts.csv').catch(() => toast('Couldn’t download the list.', { tone: 'warn' }))}>
          Download CSV
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-[12.5px] text-danger">{error}</p>
      ) : !data ? (
        <div className="mt-4">
          <ListSkeleton rows={5} />
        </div>
      ) : (
        <>
          {/* phones: one card per account */}
          <ul className={`mt-4 divide-y divide-line transition-opacity sm:hidden ${loading ? 'opacity-60' : ''}`}>
            {data.accounts.map((a) => (
              <li key={a.uid} className={open === a.email ? 'bg-panel-2' : ''}>
                <button type="button" onClick={() => setOpen(open === a.email ? null : a.email)} aria-expanded={open === a.email} className="block w-full px-1 py-2.5 text-left">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-ink">{a.name || '—'}</span>
                    <span className="shrink-0 text-[11.5px] text-mute">{a.type}</span>
                  </div>
                  <div className="truncate text-[12px] text-mute">{a.email || '—'}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-dim">
                    <span>joined {a.joined ? date(a.joined) : '—'}</span>
                    <span>seen {ago(a.lastSeen)}</span>
                    {badges(a)}
                  </div>
                </button>
                {open === a.email ? <div className="px-1 pb-3">{details(a)}</div> : null}
              </li>
            ))}
          </ul>
          <div className={`mt-4 hidden overflow-x-auto transition-opacity sm:block ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead className="border-b border-line text-[11px] tracking-wide">
                <tr>
                  <th className="py-2 pr-3 font-medium">{sortBtn('name', 'Name')}</th>
                  <th className="py-2 pr-3 font-medium">{sortBtn('email', 'Email')}</th>
                  <th className="py-2 pr-3 font-medium uppercase text-dim">Type</th>
                  <th className="py-2 pr-3 font-medium">{sortBtn('joined', 'Joined')}</th>
                  <th className="py-2 pr-3 font-medium">{sortBtn('seen', 'Last seen')}</th>
                  <th className="py-2 font-medium uppercase text-dim">Roles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.accounts.map((a) => (
                  <Fragment key={a.uid}>
                    <tr onClick={() => setOpen(open === a.email ? null : a.email)} className={`cursor-pointer hover:bg-panel-2 ${open === a.email ? 'bg-panel-2' : ''}`} aria-expanded={open === a.email}>
                      <td className="max-w-[200px] truncate py-2 pr-3 font-medium text-ink">{a.name || '—'}</td>
                      <td className="max-w-[240px] truncate py-2 pr-3 text-mute">{a.email || '—'}</td>
                      <td className="py-2 pr-3 text-mute">{a.type}</td>
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-mute">{a.joined ? date(a.joined) : '—'}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-mute">{ago(a.lastSeen)}</td>
                      <td className="py-2">{badges(a)}</td>
                    </tr>
                    {open === a.email ? (
                      <tr className="bg-panel-2">
                        <td colSpan={6} className="px-3 pb-4 pt-1">
                          {details(a)}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {!data.accounts.length ? <p className="py-6 text-center text-[12.5px] text-mute">No accounts match.</p> : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-mute">
            <span className="tabular-nums">{data.total ? `${from}–${to} of ${data.total}` : '0 accounts'}</span>
            <div className="flex items-center gap-1">
              <button type="button" className={ghostBtn} disabled={data.page <= 1} onClick={() => setF((cur) => ({ ...cur, page: cur.page - 1 }))}>
                ‹ Previous
              </button>
              <span className="px-2 tabular-nums">
                Page {data.page} of {data.pages}
              </span>
              <button type="button" className={ghostBtn} disabled={data.page >= data.pages} onClick={() => setF((cur) => ({ ...cur, page: cur.page + 1 }))}>
                Next ›
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ settings */

/** topics as text: a "# Topic" line, then one request per line */
const topicsToText = (items: DraftTopic[]) => {
  const out: string[] = []
  let last = ''
  for (const t of items) {
    if (t.topic !== last) out.push(`${out.length ? '\n' : ''}# ${t.topic}`)
    last = t.topic
    out.push(t.prompt)
  }
  return out.join('\n')
}
const textToTopics = (text: string): DraftTopic[] => {
  let topic = 'General'
  const items: DraftTopic[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#')) topic = line.replace(/^#+\s*/, '').slice(0, 60) || 'General'
    else if (line.length >= 3) items.push({ topic, prompt: line.slice(0, 400) })
  }
  return items
}

/** App Check: which mode the API is in, and how many requests a day arrive without proof they came from the app */
function AppCheckPanel() {
  const { data, error, reload } = useLoad(getAppCheckStats)
  const total = (d: Record<string, number | string>) => (Number(d.missing) || 0) + (Number(d.invalid) || 0)
  return (
    <Loading error={error} onRetry={reload}>
      {data ? (
        <section className={`${card} space-y-3 p-5`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-semibold">Scraping protection</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${data.mode === 'enforce' ? 'bg-accent/15 text-accent' : data.mode === 'monitor' ? 'bg-warn/15 text-warn' : 'bg-panel-3 text-mute'}`}>
              App Check: {data.mode}
            </span>
          </div>
          <p className="text-[12.5px] text-mute">
            Full library models need sign-in (100 a day each, staff not counted); each address has limits per minute. App Check proves a request came from the app, not a script: run it in
            <b> monitor</b> for a few days and enforce it once the count below is only scripts (set APP_CHECK on the API).
          </p>
          {data.mode === 'off' ? (
            <p className="text-[12.5px] text-dim">Off: requests are not checked yet.</p>
          ) : (
            <ul className="grid grid-cols-7 gap-1.5 text-center text-[11px]">
              {data.days.map((d) => (
                <li key={String(d.day)} className="rounded-lg border border-line px-1 py-1.5">
                  <div className="text-dim">{String(d.day).slice(5)}</div>
                  <div className="mt-0.5 font-mono text-[13px] tabular-nums text-ink">{total(d)}</div>
                </li>
              ))}
            </ul>
          )}
          {data.mode !== 'off' ? <p className="text-[11.5px] text-dim">Requests a day without a valid App Check token{data.mode === 'enforce' ? ', refused' : ', let through'}.</p> : null}
        </section>
      ) : null}
    </Loading>
  )
}

function Settings({ admin }: { admin: boolean }) {
  const { data, setData, error, reload } = useLoad(getAdminSettings)
  const [form, setForm] = useState<QualitySettings | null>(null)
  const [topicText, setTopicText] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'settings' | 'topics'>(null)
  useEffect(() => {
    if (!data) return
    setForm(data.settings)
    setTopicText(topicsToText(data.topics ?? DRAFT_TOPICS))
  }, [data])

  const save = async () => {
    if (!form) return
    setBusy('settings')
    try {
      const { settings } = await saveSettings(form)
      setForm(settings)
      toast('Settings saved.')
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t save the settings.', { tone: 'warn' })
    } finally {
      setBusy(null)
    }
  }
  const saveList = async (reset: boolean) => {
    setBusy('topics')
    try {
      if (reset) {
        await resetTopics()
        setTopicText(topicsToText(DRAFT_TOPICS))
        if (data) setData({ ...data, topics: null })
        toast('Back to the built-in topic list.')
      } else {
        const items = textToTopics(topicText ?? '')
        if (!items.length) throw new Error('Add at least one request.')
        const { topics } = await saveTopics(items)
        if (data) setData({ ...data, topics })
        toast(`Saved ${items.length} topics.`)
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t save the topics.', { tone: 'warn' })
    } finally {
      setBusy(null)
    }
  }

  const num = `${inputCls} mt-1 w-28`
  const set = (patch: Partial<QualitySettings>) => setForm((f) => (f ? { ...f, ...patch } : f))
  return (
    <Loading error={error} onRetry={reload}>
      {data && form ? (
        <div className="space-y-5">
          {admin ? <AppCheckPanel /> : null}
          {admin ? (
            <section className={`${card} space-y-4 p-5`}>
              <h2 className="text-[15px] font-semibold">Nightly run</h2>
              <label className="flex items-center justify-between gap-4 text-[13px]">
                <span>
                  Pause the nightly run
                  <span className="block text-[11.5px] text-dim">Skips the scheduled run, for when credit is low. A run started by hand still goes.</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.paused}
                  onClick={() => set({ paused: !form.paused })}
                  className={`relative h-[20px] w-9 shrink-0 rounded-full transition-colors ${form.paused ? 'bg-warn' : 'bg-line-2'}`}
                >
                  <span className={`absolute top-[3px] h-[14px] w-[14px] rounded-full bg-ink transition-all ${form.paused ? 'left-[19px]' : 'left-[3px]'}`} />
                </button>
              </label>
              <div className="flex flex-wrap gap-5">
                <label className="text-[12px] text-mute">
                  Drafts per night
                  <input type="number" min={0} max={100} value={form.draftsPerNight} onChange={(e) => set({ draftsPerNight: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })} className={num} />
                  <span className="mt-1 block text-[11px] text-dim">{form.draftsPerNight} builds a night on top of the tests; the Quality tab shows what each one really costs</span>
                </label>
                <label className="text-[12px] text-mute">
                  Minimum score for the queue
                  <input type="number" min={0} max={100} value={form.draftMin} onChange={(e) => set({ draftMin: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} className={num} />
                </label>
              </div>
              <h2 className="pt-2 text-[15px] font-semibold">Model price</h2>
              <p className="text-[12px] text-mute">
                US dollars per million tokens. Leave blank to use Google’s list price, built in for Gemini 3.8 Flash (0.75 in and 3.75 out until 31 December 2026, then 1.50 and 7.50 on its own). Fill in only for a
                discount or a different model.
              </p>
              <div className="flex flex-wrap items-end gap-5">
                <label className="text-[12px] text-mute">
                  Input
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.price?.inputPerM ?? ''}
                    placeholder="list"
                    onChange={(e) => set({ price: e.target.value === '' ? null : { inputPerM: Number(e.target.value), outputPerM: form.price?.outputPerM ?? 0 } })}
                    className={num}
                  />
                </label>
                <label className="text-[12px] text-mute">
                  Output
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.price?.outputPerM ?? ''}
                    placeholder="list"
                    onChange={(e) => set({ price: e.target.value === '' ? null : { inputPerM: form.price?.inputPerM ?? 0, outputPerM: Number(e.target.value) } })}
                    className={num}
                  />
                </label>
              </div>
              <button type="button" disabled={busy === 'settings'} onClick={() => void save()} className={primaryBtn}>
                {busy === 'settings' ? 'Saving…' : 'Save settings'}
              </button>
            </section>
          ) : null}

          <section className={`${card} space-y-3 p-5`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold">Topics to draft</h2>
              <span className="text-[11.5px] text-dim">{data.topics ? `Your list · ${data.topics.length}` : `Built-in list · ${DRAFT_TOPICS.length}`}</span>
            </div>
            <p className="text-[12px] text-mute">
              One request per line, under a <code className="rounded bg-panel-3 px-1">#&nbsp;Topic</code> heading. Each night drafts the next few in turn, so the whole list comes round.
            </p>
            <textarea value={topicText ?? ''} onChange={(e) => setTopicText(e.target.value)} rows={16} spellCheck={false} className={`${inputCls} font-mono text-[12px] leading-relaxed`} />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!!busy} onClick={() => void saveList(false)} className={primaryBtn}>
                {busy === 'topics' ? 'Saving…' : 'Save topics'}
              </button>
              {data.topics ? (
                <button type="button" disabled={!!busy} onClick={() => void saveList(true)} className={ghostBtn}>
                  Use the built-in list
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </Loading>
  )
}

/* ------------------------------------------------------------------ feedback and waitlist */

const KIND_LABEL: Record<FeedbackItem['kind'], string> = { bug: 'Bug', error: 'Error', idea: 'Idea', sales: 'Sales' }

function Feedback() {
  const { data, setData, error, reload } = useLoad(getFeedback)
  const [kind, setKind] = useState<'all' | FeedbackItem['kind']>('all')
  const [show, setShow] = useState<'open' | 'all'>('open')
  const items = data?.feedback.filter((f) => (kind === 'all' || f.kind === kind) && (show === 'all' || f.status !== 'done')) ?? []
  const mark = async (f: FeedbackItem) => {
    const status = f.status === 'done' ? 'new' : 'done'
    try {
      await setFeedbackStatus(f.id, status)
      setData((cur) => (cur ? { feedback: cur.feedback.map((x) => (x.id === f.id ? { ...x, status } : x)) } : cur))
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t update it.', { tone: 'warn' })
    }
  }
  return (
    <Loading error={error} onRetry={reload}>
      {data ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Pills
              label="Show"
              value={show}
              onChange={setShow}
              options={[
                { value: 'open', label: `Open ${data.feedback.filter((f) => f.status !== 'done').length}` },
                { value: 'all', label: 'All' },
              ]}
            />
            <Pills
              label="Kind"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'all', label: `All ${data.feedback.length}` },
                ...(['bug', 'error', 'idea', 'sales'] as const).map((k) => ({ value: k, label: `${KIND_LABEL[k]} ${data.feedback.filter((f) => f.kind === k).length}` })),
              ]}
            />
          </div>
          {items.length ? (
            <ul className={`${card} divide-y divide-line`}>
              {items.map((f) => (
                <li key={f.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-dim">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${f.kind === 'sales' ? 'bg-accent/15 text-accent' : f.kind === 'idea' ? 'bg-panel-3 text-ink/80' : 'bg-warn/15 text-warn'}`}>
                      {KIND_LABEL[f.kind]}
                    </span>
                    <span>{dateTime(f.createdAt)}</span>
                    {f.route ? <span className="truncate">{f.route}</span> : null}
                    <button
                      type="button"
                      onClick={() => void mark(f)}
                      className={`ml-auto rounded-full px-2.5 py-0.5 font-medium ${f.status === 'done' ? 'bg-accent/15 text-accent' : 'border border-line-2 text-mute hover:text-ink'}`}
                    >
                      {f.status === 'done' ? 'Dealt with ✓' : 'Mark dealt with'}
                    </button>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink/90">{f.message}</p>
                  {f.contact || f.name || f.organisation ? (
                    <p className="mt-1 text-[12px] text-mute">
                      {[f.name, f.organisation, f.seats ? `${f.seats} seats` : null].filter(Boolean).join(' · ')}
                      {f.contact ? (
                        <>
                          {f.name || f.organisation ? ' · ' : ''}
                          <a className="text-accent underline-offset-2 hover:underline" href={`mailto:${f.contact}`}>
                            {f.contact}
                          </a>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No messages here yet.</Empty>
          )}
        </>
      ) : null}
    </Loading>
  )
}

function Waitlist() {
  const { data, error, reload } = useLoad(getWaitlist)
  const list = (v: WaitlistEntry['interest']) => (Array.isArray(v) ? v.join(', ') : (v ?? ''))
  return (
    <Loading error={error} onRetry={reload}>
      {data ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[13px] text-mute">{data.count} on the list</p>
            <button type="button" className={ghostBtn} onClick={() => void download('/v1/waitlist.csv', 'solidify-waitlist.csv').catch(() => toast('Couldn’t download the list.', { tone: 'warn' }))}>
              Download CSV
            </button>
          </div>
          {data.entries.length ? (
            <ul className={`${card} divide-y divide-line`}>
              {[...data.entries].reverse().map((w) => (
                <li key={w.email} className="grid gap-1 px-4 py-3 text-[12.5px] sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:gap-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">{w.name || w.email}</div>
                    {w.name ? <div className="truncate text-mute">{w.email}</div> : null}
                  </div>
                  <div className="min-w-0 text-mute">
                    {[w.role, w.organisation, list(w.interest)].filter(Boolean).join(' · ')}
                    {w.useCase ? <div className="mt-0.5 text-ink/85">{w.useCase}</div> : null}
                  </div>
                  <div className="text-dim">{date(w.createdAt)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No one yet.</Empty>
          )}
        </>
      ) : null}
    </Loading>
  )
}

/* ------------------------------------------------------------------ page */

/** each tab, and the permission it needs (the API checks the same) */
const TABS: { value: Tab; label: string; perm: Perm }[] = [
  { value: 'quality', label: 'Quality', perm: 'curate' },
  { value: 'review', label: 'Review queue', perm: 'review' },
  { value: 'library', label: 'Library', perm: 'curate' },
  { value: 'users', label: 'Users', perm: 'admin' },
  { value: 'activity', label: 'Activity', perm: 'admin' },
  { value: 'feedback', label: 'Feedback', perm: 'support' },
  { value: 'waitlist', label: 'Waitlist', perm: 'support' },
  { value: 'settings', label: 'Settings', perm: 'curate' },
]

/** for the team: how good the builds are each night, models waiting for review, and what people have sent in */
export default function AdminPage() {
  const status = useAuth((s) => s.status)
  const profile = useProfile((s) => s.profile)
  const [params, setParams] = useSearchParams()
  // the tabs this person's roles open
  const roles = profile?.roles ?? (profile?.isAdmin ? (['admin'] as StaffRole[]) : [])
  const mine = TABS.filter((t) => can(roles, t.perm))
  const tab = (mine.find((t) => t.value === params.get('tab'))?.value ?? mine[0]?.value ?? 'quality') as Tab
  const admin = can(roles, 'admin')

  let body: ReactNode
  if (status === 'loading' || (status === 'signed-in' && !profile)) body = <ListSkeleton rows={5} />
  else if (status !== 'signed-in')
    body = (
      <Empty>
        <button type="button" className={primaryBtn} onClick={() => useAuth.getState().openDialog()}>
          Sign in
        </button>
      </Empty>
    )
  else if (!mine.length || (mine.length === 1 && mine[0].value === 'review'))
    body = (
      <Empty>
        This page is for the Solidify team.
        {can(roles, 'review') ? (
          <>
            {' '}
            Your review queue is{' '}
            <a href="#/review" className="text-accent hover:underline">
              here
            </a>
            .
          </>
        ) : null}
      </Empty>
    )
  else
    body = (
      <>
        <div className="mb-5">
          <Pills label="Section" value={tab} onChange={(t) => setParams(t === mine[0]?.value ? {} : { tab: t }, { replace: true })} options={mine.map(({ value, label }) => ({ value, label }))} />
        </div>
        {tab === 'quality' ? (
          <Quality admin={admin} />
        ) : tab === 'review' ? (
          <ReviewQueue canDraft={can(roles, 'curate')} />
        ) : tab === 'library' ? (
          <Library />
        ) : tab === 'users' ? (
          <Users />
        ) : tab === 'activity' ? (
          <Activity />
        ) : tab === 'feedback' ? (
          <Feedback />
        ) : tab === 'waitlist' ? (
          <Waitlist />
        ) : (
          <Settings admin={admin} />
        )}
      </>
    )

  return (
    <StudyShell title="Admin" lead="Nightly build quality, new models waiting for review, and what people have sent in.">
      <div className="pb-16">{body}</div>
    </StudyShell>
  )
}
