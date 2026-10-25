import { Link } from 'react-router-dom'
import { MODULES } from '@/modules/catalog'
import { useProgress, summarise } from '../progress'
import { QUESTIONS } from '../questions'
import { suggestTopic, topicMastery, type TopicMastery } from '../review'
import { COURSES } from '../types'
import { SceneMark } from './badges'
import { Bar, CourseLabel, StudyShell } from './StudyShell'

const liveScenes = (moduleIds?: string[]) =>
  MODULES.filter((m) => !moduleIds || moduleIds.includes(m.id)).flatMap((m) => m.scenes.filter((s) => s.load).map((s) => ({ m, s })))

function Stat({ label, value, total, tone }: { label: string; value: number; total: number; tone?: 'accent' | 'info' | 'warn' }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex justify-between text-[11.5px] text-mute">
        <span>{label}</span>
        <span className="font-mono text-ink/80">
          {value}/{total}
        </span>
      </div>
      <Bar value={value} total={total} tone={tone} />
    </div>
  )
}

function MasteryRow({ t }: { t: TopicMastery }) {
  const pct = Math.round(t.mastery * 100)
  return (
    <li className="flex items-center gap-3 text-[12.5px]">
      <Link to={`/exam?q=${encodeURIComponent(t.ids[0])}`} className="w-44 shrink-0 truncate text-ink/85 hover:text-accent" title={`Practise ${t.topic}`}>
        {t.topic}
      </Link>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-3">
        <div className={`h-full rounded-full ${pct >= 75 ? 'bg-accent' : pct >= 35 ? 'bg-info' : 'bg-warn'}`} style={{ width: `${Math.max(pct, t.attempted ? 3 : 0)}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-[11.5px] text-ink/80">{pct}%</span>
      <span className="w-14 shrink-0 text-right text-[11px] text-dim">{t.due ? `${t.due} due` : t.attempted ? '' : 'new'}</span>
    </li>
  )
}

/** Review queue, what to practise next, and mastery per topic for each subject. */
function Learning() {
  const qp = useProgress((s) => s.questions)
  const now = Date.now()
  const all = topicMastery(qp, QUESTIONS, now)
  const due = all.reduce((n, t) => n + t.due, 0)
  const next = suggestTopic(all)
  return (
    <>
      <section className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-panel p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">Review</div>
          <p className="mt-1 text-[14px] text-ink">{due ? `${due} question${due === 1 ? '' : 's'} due now` : 'Nothing due right now'}</p>
          <p className="mt-0.5 text-[12px] text-dim">Missed questions come back tomorrow with new numbers, then after 3, 7 and 21 days as you get them right.</p>
          {due ? (
            <Link to="/exam?mode=review" className="mt-3 inline-block rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-ink hover:brightness-110">
              Start review
            </Link>
          ) : null}
        </div>
        <div className="rounded-2xl border border-line bg-panel p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">Practise next</div>
          {next ? (
            <>
              <p className="mt-1 text-[14px] text-ink">{next.topic}</p>
              <p className="mt-0.5 text-[12px] text-dim">{next.due ? `${next.due} review${next.due === 1 ? '' : 's'} due` : next.attempted ? `${Math.round(next.mastery * 100)}% mastered so far` : 'Not started yet'}</p>
              <Link to={`/exam?q=${encodeURIComponent((next.due ? next.ids.find((id) => (qp[id]?.due ?? Infinity) <= now) : undefined) ?? next.ids[0])}`} className="mt-3 inline-block rounded-lg border border-accent/50 px-3 py-1.5 text-[12.5px] text-accent hover:bg-accent/10">
                Practise this topic
              </Link>
            </>
          ) : (
            <p className="mt-1 text-[14px] text-ink">Everything mastered. Nice work.</p>
          )}
        </div>
      </section>

      <h2 className="mb-2 text-[15px] font-semibold">Mastery by topic</h2>
      <section className="mb-8 grid gap-3 lg:grid-cols-2">
        {COURSES.map((c) => {
          const qs = QUESTIONS.filter((q) => q.course === c.id)
          const topics = topicMastery(qp, qs, now)
          const overall = topics.length ? topics.reduce((s, t) => s + t.mastery * t.ids.length, 0) / qs.length : 0
          return (
            <div key={c.id} className="rounded-2xl border border-line bg-panel-2/60 p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[14px] font-semibold">
                  <CourseLabel course={c.id} />
                </span>
                <span className="font-mono text-[12px] text-mute">{Math.round(overall * 100)}%</span>
              </div>
              <ul className="space-y-1.5">
                {topics.map((t) => (
                  <MasteryRow key={t.topic} t={t} />
                ))}
              </ul>
            </div>
          )
        })}
      </section>
    </>
  )
}

export function ProgressPage() {
  const p = useProgress()
  const allScenes = liveScenes()
  const all = summarise(p, allScenes.map((x) => x.s.id), QUESTIONS.map((q) => q.id))

  return (
    <StudyShell
      title="Your progress"
      lead="Scenes you have opened, guided tours you have finished and exam questions you have answered. Saved in this browser, and synced to your account when you’re signed in."
      right={
        <button
          onClick={() => {
            if (window.confirm('Clear all study progress on this device?')) p.reset()
          }}
          className="rounded-lg border border-danger/50 px-3 py-1.5 text-[12.5px] text-danger hover:bg-danger/10"
        >
          Reset progress
        </button>
      }
    >
      <section className="mb-6 flex flex-wrap gap-4 rounded-2xl border border-line bg-panel p-4">
        <Stat label="Scenes opened" value={all.opened} total={all.scenes} />
        <Stat label="Tours finished" value={all.toured} total={all.scenes} tone="info" />
        <Stat label="Questions solved" value={all.solved} total={all.questions} tone="warn" />
      </section>

      <Learning />

      <h2 className="mb-2 text-[15px] font-semibold">By subject</h2>
      <section className="mb-8 grid gap-3 sm:grid-cols-2">
        {COURSES.map((c) => {
          const mods = MODULES.filter((m) => m.courses.includes(c.id)).map((m) => m.id)
          const qs = QUESTIONS.filter((q) => q.course === c.id)
          const sc = liveScenes(mods)
          const s = summarise(p, sc.map((x) => x.s.id), qs.map((q) => q.id))
          return (
            <div key={c.id} className="rounded-2xl border border-line bg-panel-2/60 p-4">
              <div className="mb-3 text-[14px] font-semibold">
                <CourseLabel course={c.id} />
              </div>
              <div className="space-y-2.5">
                <Stat label="Scenes opened" value={s.opened} total={s.scenes} />
                <Stat label="Tours finished" value={s.toured} total={s.scenes} tone="info" />
                <Stat label={`Questions solved (${s.attempted} attempted)`} value={s.solved} total={s.questions} tone="warn" />
              </div>
            </div>
          )
        })}
      </section>

      <h2 className="mb-2 text-[15px] font-semibold">By system</h2>
      <section className="space-y-3">
        {MODULES.map((m) => {
          const scenes = m.scenes.filter((s) => s.load)
          if (!scenes.length) return null
          const qs = QUESTIONS.filter((q) => q.moduleId === m.id)
          const s = summarise(p, scenes.map((x) => x.id), qs.map((q) => q.id))
          return (
            <details key={m.id} className="rounded-2xl border border-line bg-panel p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-4">
                <span className="w-48 text-[14px] font-semibold">{m.title}</span>
                <Stat label="Opened" value={s.opened} total={s.scenes} />
                <Stat label="Tours" value={s.toured} total={s.scenes} tone="info" />
                {s.questions ? <Stat label="Questions" value={s.solved} total={s.questions} tone="warn" /> : <div className="flex-1" />}
              </summary>
              <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                {scenes.map((sc) => {
                  const r = p.scenes[sc.id]
                  const sq = qs.filter((q) => q.sceneId === sc.id)
                  const solved = sq.filter((q) => (p.questions[q.id]?.correct ?? 0) > 0).length
                  return (
                    <li key={sc.id}>
                      <Link to={`/m/${m.id}/${sc.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-panel-2">
                        <SceneMark sceneId={sc.id} />
                        <span className="truncate text-ink/85">{sc.title}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-dim">
                          {r?.tour ? 'tour ✓' : ''}
                          {sq.length ? ` · ${solved}/${sq.length} Q` : ''}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </details>
          )
        })}
      </section>
    </StudyShell>
  )
}

export default ProgressPage
