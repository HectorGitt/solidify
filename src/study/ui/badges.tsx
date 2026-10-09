import { MODULES } from '@/modules/catalog'
import { useProgress } from '../progress'
import { Bar } from './StudyShell'

/** Small status dot for a scene: hollow (new), filled (opened), ringed (tour finished). */
export function SceneMark({ sceneId }: { sceneId: string }) {
  const r = useProgress((s) => s.scenes[sceneId])
  const title = r?.tour ? 'Tour finished' : r?.opened ? 'Opened' : 'Not opened yet'
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${r?.tour ? 'bg-accent ring-2 ring-accent/30' : r?.opened ? 'bg-accent/70' : 'border border-line-2'}`}
    />
  )
}

/** "3/10 explored" badge for a module card. */
export function ModuleProgress({ moduleId }: { moduleId: string }) {
  const scenes = useProgress((s) => s.scenes)
  const m = MODULES.find((x) => x.id === moduleId)
  if (!m) return null
  const live = m.scenes.filter((s) => s.load)
  const opened = live.filter((s) => scenes[s.id]?.opened).length
  if (!live.length) return null
  return (
    <div className="flex items-center gap-2 text-[11px] text-mute" title={`${opened} of ${live.length} scenes opened`}>
      <div className="w-16">
        <Bar value={opened} total={live.length} />
      </div>
      <span>
        {opened}/{live.length} explored
      </span>
    </div>
  )
}
