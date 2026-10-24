import { MODULES } from '@/modules/catalog'
import type { ChallengeDef, ChallengeEntry } from './types'

const FILES = import.meta.glob<{ default: ChallengeDef[] }>('../modules/*/*/challenges.ts')

/** Scene id for a module folder (the catalogue may map ids to other folders). */
function sceneIdFor(moduleId: string, folder: string) {
  const m = MODULES.find((x) => x.id === moduleId)
  return m?.scenes.find((s) => (s.folder ?? s.id) === folder)?.id ?? folder
}

function parse(path: string) {
  const m = /\.\.\/modules\/([^/]+)\/([^/]+)\/challenges\.ts$/.exec(path)
  return m ? { moduleId: m[1], folder: m[2] } : null
}

/** Challenges of one scene (empty if it has none). */
export async function challengesFor(moduleId: string, sceneId: string): Promise<ChallengeEntry[]> {
  for (const [path, load] of Object.entries(FILES)) {
    const p = parse(path)
    if (!p || p.moduleId !== moduleId || sceneIdFor(p.moduleId, p.folder) !== sceneId) continue
    const defs = (await load()).default
    return defs.map((d) => ({ ...d, moduleId: p.moduleId, folder: sceneIdFor(p.moduleId, p.folder) }))
  }
  return []
}

/** Every challenge in the app, in catalogue order. */
export async function allChallenges(): Promise<ChallengeEntry[]> {
  const out: ChallengeEntry[] = []
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([path, load]) => {
      const p = parse(path)
      if (!p) return []
      const defs = (await load()).default
      return defs.map((d) => ({ ...d, moduleId: p.moduleId, folder: sceneIdFor(p.moduleId, p.folder) }))
    }),
  )
  for (const e of entries) out.push(...e)
  const order = (c: ChallengeEntry) => {
    const mi = MODULES.findIndex((m) => m.id === c.moduleId)
    const si = MODULES[mi]?.scenes.findIndex((s) => s.id === c.folder) ?? 0
    return mi * 1000 + si * 10 + c.difficulty
  }
  return out.sort((a, b) => order(a) - order(b))
}

/** Has this scene folder got a challenges file? (cheap, no loading) */
export function hasChallenges(moduleId: string, sceneId: string) {
  return Object.keys(FILES).some((path) => {
    const p = parse(path)
    return !!p && p.moduleId === moduleId && sceneIdFor(p.moduleId, p.folder) === sceneId
  })
}
