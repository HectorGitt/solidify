import { MODULES } from '@/modules/catalog'
import type { ModuleDef, SceneEntry } from '@/modules/types'
import type { NoteSceneSpec } from './schema'

// ============================================================================
// LAB RIG MATCHER: links a model the AI built to the closest ready-made lab rig
// ============================================================================
export interface CatalogSceneMatch {
  module: ModuleDef
  scene: SceneEntry
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'for', 'with', 'and', 'or', 'in', 'on', 'to', 'at', 'by', 'from',
  'model', 'machine', 'build', 'create', 'make', 'design', 'show', 'me', 'our', 'my', '3d',
])

export function matchCatalogSceneFromPrompt(prompt: string): CatalogSceneMatch | null {
  const lower = prompt.toLowerCase()
  const tokens = lower
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  if (tokens.length === 0) return null

  let best: CatalogSceneMatch | null = null
  let bestScore = 0

  for (const mod of MODULES) {
    for (const sc of mod.scenes) {
      if (!sc.load) continue
      const titleLower = sc.title.toLowerCase()
      const idLower = sc.id.toLowerCase()
      const summaryLower = sc.summary.toLowerCase()

      let score = 0
      if (lower.includes(titleLower)) score += 12
      if (lower.includes(idLower.replace(/-/g, ' '))) score += 10

      for (const tok of tokens) {
        if (idLower.split('-').includes(tok)) score += 5
        else if (titleLower.includes(tok)) score += 4
        else if (summaryLower.includes(tok)) score += 1.5
      }

      if (score > bestScore) {
        bestScore = score
        best = { module: mod, scene: sc }
      }
    }
  }

  return bestScore >= 4 ? best : null
}

export interface BuildOrRefineResult {
  spec: NoteSceneSpec
  explanation: string
  isNewMachine: boolean
  matchedCatalogScene: CatalogSceneMatch | null
}
