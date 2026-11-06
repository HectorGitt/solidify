import { useEffect, useMemo, useState } from 'react'
import type { QuestionProgress } from '@/study/progress'
import { QUESTIONS } from '@/study/questions'
import { topicMastery } from '@/study/review'
import { courseTitle } from '@/study/types'
import { api } from '../api'
import { SLIP_NAMES, type Paper } from '../papers'
import { Notice } from './Modal'
import { ListSkeleton } from '@/ui/Skeleton'

interface ClassProgress {
  students: { uid: string; displayName: string; questions: Record<string, QuestionProgress> }[]
}

/**
 * Where the class is weakest: mastery per topic averaged over the students who have started it,
 * and the mistakes the marker named most often on the class's papers.
 */
export function ClassReport({ classId, papers }: { classId: string; papers: Paper[] | null }) {
  const [progress, setProgress] = useState<ClassProgress | null>(null)
  const [slips, setSlips] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    api<ClassProgress>(`/v1/classes/${classId}/progress`)
      .then(setProgress)
      .catch(() => setProgress({ students: [] }))
  }, [classId])

  useEffect(() => {
    if (!papers) return
    Promise.all(papers.map((p) => api<{ students: { results: Record<string, { slips: string[] }> | null }[] }>(`/v1/classes/${classId}/papers/${p.id}/results`).catch(() => ({ students: [] }))))
      .then((all) => {
        const count: Record<string, number> = {}
        for (const r of all) for (const s of r.students) for (const q of Object.values(s.results ?? {})) for (const k of q.slips) count[k] = (count[k] ?? 0) + 1
        setSlips(count)
      })
  }, [classId, papers])

  const topics = useMemo(() => {
    if (!progress?.students.length) return []
    const now = Date.now()
    const per = progress.students.map((s) => topicMastery(s.questions, QUESTIONS, now))
    const subjectOf = new Map(QUESTIONS.map((q) => [q.topic, q.course]))
    return per[0]
      .map((t, i) => {
        const started = per.map((p) => p[i]).filter((x) => x.attempted > 0)
        return {
          topic: t.topic,
          subject: courseTitle(subjectOf.get(t.topic) ?? ''),
          students: started.length,
          mastery: started.length ? started.reduce((s, x) => s + x.mastery, 0) / started.length : 0,
        }
      })
      .filter((t) => t.students > 0)
      .sort((a, b) => a.mastery - b.mastery)
  }, [progress])

  const topSlips = Object.entries(slips ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  const totalSlips = topSlips.reduce((s, [, n]) => s + n, 0)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-3xl border border-line bg-panel-2/50 p-4">
        <h3 className="mb-1 text-[13.5px] font-semibold">Weakest topics</h3>
        <p className="mb-3 text-[11.5px] text-dim">Average mastery among students who have started each topic.</p>
        {!progress ? (
          <ListSkeleton rows={3} />
        ) : !topics.length ? (
          <Notice>No practice yet. Topics appear here once students start answering questions.</Notice>
        ) : (
          <ul className="space-y-1.5">
            {topics.slice(0, 8).map((t) => {
              const p = Math.round(t.mastery * 100)
              return (
                <li key={t.topic} className="flex items-center gap-3 text-[12.5px]">
                  <span className="w-40 shrink-0 truncate text-ink/90" title={`${t.subject} · ${t.topic}`}>
                    {t.topic}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-3">
                    <div className={`h-full rounded-full ${p >= 75 ? 'bg-accent' : p >= 35 ? 'bg-info' : 'bg-warn'}`} style={{ width: `${Math.max(p, 3)}%` }} />
                  </div>
                  <span className="w-10 text-right font-mono text-[11.5px]">{p}%</span>
                  <span className="w-16 text-right text-[11px] text-dim">
                    {t.students} student{t.students === 1 ? '' : 's'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className="rounded-3xl border border-line bg-panel-2/50 p-4">
        <h3 className="mb-1 text-[13.5px] font-semibold">Most common mistakes</h3>
        <p className="mb-3 text-[11.5px] text-dim">From the marker’s notes on this class’s papers.</p>
        {!slips ? (
          <ListSkeleton rows={3} />
        ) : !topSlips.length ? (
          <Notice>None recorded yet. They appear after students hand in papers.</Notice>
        ) : (
          <ul className="space-y-1.5">
            {topSlips.map(([k, n]) => (
              <li key={k} className="flex items-center justify-between text-[12.5px]">
                <span className="text-ink/90">{SLIP_NAMES[k] ?? k}</span>
                <span className="font-mono text-[11.5px] text-mute">
                  {n} · {Math.round((n / totalSlips) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
