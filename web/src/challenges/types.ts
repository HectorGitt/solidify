/**
 * A challenge is a goal set inside a scene: a starting setup, live pass/fail checks on numbers
 * the scene already computes, and how long they must all hold. A score (optional) ranks wins.
 *
 * Challenges live next to their scene in `src/modules/<module>/<folder>/challenges.ts`
 * (default export: ChallengeDef[]); the registry finds them automatically.
 */

export interface CriterionResult {
  pass: boolean
  /** current value, as shown to the player, e.g. "13.2 %" */
  value: string
}

export interface Criterion {
  label: string
  check: () => CriterionResult
}

export interface ChallengeScore {
  label: string
  unit: string
  value: () => number
  better: 'lower' | 'higher'
  digits?: number
}

export interface ChallengeDef {
  /** unique across the app */
  id: string
  title: string
  /** what to achieve, one or two sentences */
  brief: string
  /** 1 easy … 3 hard */
  difficulty: 1 | 2 | 3
  /** passed to the scene's applyParams when the challenge starts */
  setup?: Record<string, unknown>
  criteria: Criterion[]
  /** seconds every criterion must hold together (default 2; 0 = the moment they all pass) */
  hold?: number
  score?: ChallengeScore
  /** a nudge, revealed on request */
  hint: string
  /** the lesson, shown on success */
  explain: string
}

/** A challenge with the scene it belongs to. */
export interface ChallengeEntry extends ChallengeDef {
  moduleId: string
  /** scene folder (also the scene id unless the catalogue maps it) */
  folder: string
}
