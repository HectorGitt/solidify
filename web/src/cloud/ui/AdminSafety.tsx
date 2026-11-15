import { useCallback, useEffect, useState } from 'react'
import { ListSkeleton } from '@/ui/Skeleton'
import { toast } from '@/ui/toast'
import { ApiError } from '../api'
import { getAiLimits, getCrashes, markCrashFixed, saveAiLimits, type AiLimits, type CrashGroup } from '../admin'
import { ghostBtn, inputCls, primaryBtn } from './Modal'

/*
 * What keeps the app safe while nobody is changing it: the AI help controls (pause, allowances, a cap on
 * everyone's total) and the crash list from students' browsers.
 */

const card = 'rounded-2xl border border-line bg-panel'

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

function Failed({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <section className={`${card} flex flex-col items-center gap-3 px-6 py-10 text-center`}>
      <p className="text-[13.5px] text-ink">{error}</p>
      <button type="button" className={ghostBtn} onClick={onRetry}>
        Try again
      </button>
    </section>
  )
}

/* ------------------------------------------------------------------ AI help */

/** a number field where empty means "the default" */
function Allowance({ label, value, fallback, unit, onChange, max = 1000 }: { label: string; value: number | null; fallback?: number; unit: string; onChange: (v: number | null) => void; max?: number }) {
  return (
    <label className="text-[12px] text-mute">
      {label}
      <input
        type="number"
        min={0}
        max={max}
        value={value ?? ''}
        placeholder={fallback === undefined ? 'no cap' : String(fallback)}
        onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Math.min(max, Math.round(Number(e.target.value) || 0))))}
        className={`${inputCls} mt-1 w-28`}
      />
      <span className="mt-1 block text-[11px] text-dim">{value === null ? (fallback === undefined ? 'No cap' : `Default: ${fallback} ${unit}`) : `${value} ${unit}`}</span>
    </label>
  )
}

export function AiHelpPanel() {
  const { data, error, reload } = useLoad(getAiLimits)
  const [form, setForm] = useState<AiLimits | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (data) setForm(data.limits)
  }, [data])
  if (error) return <Failed error={error} onRetry={reload} />
  if (!data || !form) return <ListSkeleton rows={2} />
  const set = (patch: Partial<AiLimits>) => setForm((f) => (f ? { ...f, ...patch } : f))
  const changed = JSON.stringify(form) !== JSON.stringify(data.limits)
  const save = async (patch?: Partial<AiLimits>) => {
    setBusy(true)
    try {
      const { limits } = await saveAiLimits(patch ?? form)
      setForm(limits)
      reload()
      toast(patch?.aiPaused === true ? 'AI help paused for students.' : patch?.aiPaused === false ? 'AI help is back on.' : 'AI limits saved.')
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t save the limits.', { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }
  const capLeft = form.aiDailyCap === null ? null : Math.max(0, form.aiDailyCap - data.today)
  return (
    <section className={`${card} space-y-4 p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">AI help</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${form.aiPaused ? 'bg-warn/15 text-warn' : 'bg-accent/15 text-accent'}`}>{data.limits.aiPaused ? 'Paused' : 'On'}</span>
      </div>
      <p className="text-[12.5px] text-mute">
        The tutor, Create in 3D, Solve a question and Read notes use the AI model, which costs money per use. These take effect within a minute, with no deploy. Staff are never held back.
      </p>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3 text-[13px]">
        <span>
          Pause AI help for students
          <span className="block text-[11.5px] text-dim">They see that it is paused; the labs, the library and saved models work as usual.</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={data.limits.aiPaused}
          aria-label="Pause AI help for students"
          disabled={busy}
          onClick={() => void save({ aiPaused: !data.limits.aiPaused })}
          className={`relative h-[20px] w-9 shrink-0 rounded-full transition-colors ${data.limits.aiPaused ? 'bg-warn' : 'bg-line-2'}`}
        >
          <span className={`absolute top-[3px] h-[14px] w-[14px] rounded-full bg-ink transition-all ${data.limits.aiPaused ? 'left-[19px]' : 'left-[3px]'}`} />
        </button>
      </div>
      <div>
        <h3 className="text-[13px] font-semibold text-ink">Each student, each day</h3>
        <p className="mt-0.5 text-[11.5px] text-dim">Leave empty for the default.</p>
        <div className="mt-2 flex flex-wrap gap-5">
          <Allowance label="Tutor questions" value={form.tutorDaily} fallback={data.defaults.tutor} unit="a day" onChange={(v) => set({ tutorDaily: v })} />
          <Allowance label="3D builds and questions" value={form.createDaily} fallback={data.defaults.create} unit="a day" onChange={(v) => set({ createDaily: v })} />
          <Allowance label="Note pages read" value={form.notePagesDaily} fallback={data.defaults.notePages} unit="a day" onChange={(v) => set({ notePagesDaily: v })} />
        </div>
      </div>
      <div>
        <h3 className="text-[13px] font-semibold text-ink">Everyone together, each day</h3>
        <p className="mt-0.5 text-[11.5px] text-dim">A ceiling on the day’s AI actions across all students (UTC days), so the bill can’t run away. Students who reach it are told it comes back tomorrow.</p>
        <div className="mt-2 flex flex-wrap items-end gap-5">
          <Allowance label="AI actions a day" value={form.aiDailyCap} unit="a day" max={1_000_000} onChange={(v) => set({ aiDailyCap: v })} />
          <p className="pb-6 text-[12px] text-mute">
            Counted today: <b className="font-mono tabular-nums text-ink">{data.today}</b>
            {capLeft !== null ? <span className="text-dim"> · {capLeft} left</span> : data.limits.aiDailyCap === null ? <span className="text-dim"> (counted only while a cap is set)</span> : null}
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <button type="button" disabled={!changed || busy} onClick={() => void save()} className={`${primaryBtn} px-4 py-2 text-[13px]`}>
          {busy ? 'Saving…' : 'Save limits'}
        </button>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ crashes */

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}

function CrashRow({ c, onFixed }: { c: CrashGroup; onFixed: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const fixed = async () => {
    setBusy(true)
    try {
      await markCrashFixed(c.id)
      onFixed()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'That didn’t work. Please try again.', { tone: 'warn' })
      setBusy(false)
    }
  }
  const last7 = Object.entries(c.days)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-7)
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <span className="grid h-7 min-w-9 place-items-center rounded-lg bg-warn/15 px-1.5 font-mono text-[12.5px] font-semibold tabular-nums text-warn" title="Times reported">
          {c.count}×
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-[13px] font-medium text-ink">{c.message}</p>
          <p className="mt-0.5 text-[11.5px] text-dim">
            {c.where} · last {ago(c.lastAt)} · first {ago(c.firstAt)}
            {c.device ? ` · ${c.device}` : ''}
            {c.headset ? ` · ${c.headset} in a headset` : ''}
          </p>
          {c.routes.length ? <p className="mt-0.5 truncate font-mono text-[11px] text-mute">{c.routes.join('  ')}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 max-sm:basis-full max-sm:justify-end">
          {c.stack ? (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="rounded-full px-3 py-1 text-[12px] font-medium text-mute hover:bg-panel-2 hover:text-ink">
              {open ? 'Hide details' : 'Details'}
            </button>
          ) : null}
          <button type="button" disabled={busy} onClick={() => void fixed()} className={`${ghostBtn} px-3 py-1 text-[12px]`} title="Remove it from the list; if it happens again it comes back">
            Fixed
          </button>
        </div>
      </div>
      {open ? (
        <div className="mt-2 space-y-2 pl-12">
          {last7.length ? (
            <p className="text-[11.5px] text-mute">
              By day: {last7.map(([d, n]) => `${d.slice(5)} ${n}`).join(' · ')}
              {c.build ? ` · build ${c.build}` : ''}
            </p>
          ) : null}
          <pre className="max-h-64 overflow-auto rounded-xl border border-line bg-panel-2 p-3 font-mono text-[11px] leading-relaxed text-mute">{c.stack}</pre>
        </div>
      ) : null}
    </li>
  )
}

export function Crashes() {
  const { data, setData, error, reload } = useLoad(getCrashes)
  if (error) return <Failed error={error} onRetry={reload} />
  if (!data) return <ListSkeleton rows={4} />
  return (
    <section className={`${card} p-5`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Crashes</h2>
          <p className="mt-1 max-w-2xl text-[12.5px] text-mute">
            Faults in students’ browsers, reported by the app itself (no names): the same fault from many students is one line. Newest first. Mark one Fixed once a fix is out; it comes back if it happens again.
          </p>
        </div>
        <button type="button" onClick={reload} className={`${ghostBtn} px-3 py-1.5 text-[12.5px]`}>
          Refresh
        </button>
      </div>
      {data.items.length ? (
        <ul className="mt-2 divide-y divide-line">
          {data.items.map((c) => (
            <CrashRow key={c.id} c={c} onFixed={() => setData({ items: data.items.filter((x) => x.id !== c.id) })} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-line-2 px-4 py-8 text-center text-[13px] text-mute">No crashes reported. Good.</p>
      )}
    </section>
  )
}
