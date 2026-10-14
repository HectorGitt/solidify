import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { findModule } from '@/modules/catalog'
import { useProgress } from '@/study/progress'
import { Bar, StudyShell } from '@/study/ui/StudyShell'
import { fmt } from '@/ui/controls'
import { Icon } from '@/ui/icons'
import { allChallenges } from './registry'
import type { ChallengeEntry } from './types'

const LEVEL = ['', 'Easy', 'Medium', 'Hard'] as const

function Card({ c }: { c: ChallengeEntry }) {
  const rec = useProgress((p) => p.challenges[c.id])
  const mod = findModule(c.moduleId)
  const scene = mod?.scenes.find((s) => s.id === c.folder)
  return (
    <li className={`flex flex-col rounded-xl border px-4 py-3 ${rec ? 'border-accent/40 bg-accent/5' : 'border-line bg-panel-2/50'}`}>
      <div className="flex items-center gap-2">
        {rec ? <Icon.check width={16} height={16} className="shrink-0 text-accent" /> : <Icon.trophy width={16} height={16} className="shrink-0 text-warn" />}
        <span className="text-[14px] font-medium text-ink">{c.title}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-medium ${c.difficulty === 3 ? 'bg-danger/15 text-danger' : c.difficulty === 2 ? 'bg-warn/15 text-warn' : 'bg-accent/15 text-accent'}`}>{LEVEL[c.difficulty]}</span>
      </div>
      <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-mute">{c.brief}</p>
      <div className="mt-2 flex items-center gap-2 text-[11.5px]">
        <span className="truncate text-dim">
          {mod?.title} › {scene?.title ?? c.folder}
        </span>
        {rec && c.score && rec.best !== undefined ? (
          <span className="ml-auto shrink-0 font-mono text-ink/80">
            best {fmt(rec.best, c.score.digits ?? 3)} {c.score.unit}
          </span>
        ) : null}
        <Link to={`/m/${c.moduleId}/${c.folder}?challenge=${c.id}`} className={`${rec && c.score ? '' : 'ml-auto'} shrink-0 rounded-md border border-accent/50 px-2.5 py-1 font-medium text-accent hover:bg-accent/10`}>
          {rec ? (c.score ? 'Beat it' : 'Replay') : 'Start'}
        </Link>
      </div>
    </li>
  )
}

export default function ChallengesPage() {
  const [list, setList] = useState<ChallengeEntry[] | null>(null)
  const done = useProgress((p) => p.challenges)
  useEffect(() => {
    allChallenges().then(setList)
  }, [])
  const n = list ? list.filter((c) => done[c.id]).length : 0
  return (
    <StudyShell
      title="Challenges"
      lead="Goals set inside the simulations. Each one starts from a set-up that does not work yet; change the settings until every goal turns green and holds."
      right={
        list ? (
          <div className="w-48">
            <div className="mb-1 text-right text-[12px] text-mute">
              {n} of {list.length} complete
            </div>
            <Bar value={n} total={list.length} />
          </div>
        ) : null
      }
    >
      {list ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((c) => (
            <Card key={c.id} c={c} />
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-mute">Loading…</p>
      )}
    </StudyShell>
  )
}
