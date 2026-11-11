import type { EvalCase } from './cases'
import { repairRequest, seriousFaults } from './faults'
import { scoreBuild, type EvalCheck } from './score'

/** a reply from the build API: the model, what it says about it, how long it took and what it cost */
export interface BuiltReply {
  spec?: Record<string, unknown>
  explanation?: string
  ms?: number
  usage?: { input?: number; output?: number }
  [k: string]: unknown
}

export interface RepairedBuild {
  reply: BuiltReply
  score: number
  checks: EvalCheck[]
  /** the cleaned model, as the app builds it */
  spec: Record<string, unknown>
  /** how many times it was sent back */
  repairs: number
  /** everything the builds used, the repairs included */
  tokensIn: number
  tokensOut: number
  seconds: number
}

/**
 * Builds a model and, while it fails a serious check, sends it back with the faults named, up to `tries` times;
 * the best attempt is kept (fewest serious faults, then the higher score). A build that passes first time costs
 * one call; each repair is one more.
 *   build(req)   one call to the build API ({ prompt } for a new model; with currentSpec and history, a change)
 */
export async function buildWithRepair(
  build: (req: { prompt: string; currentSpec?: Record<string, unknown>; history?: { prompt: string; response: string }[] }) => Promise<BuiltReply>,
  prompt: string,
  opts: { case?: EvalCase; tries?: number; onRepair?: (n: number, faults: EvalCheck[]) => void } = {},
): Promise<RepairedBuild> {
  const c = opts.case ?? { id: 'draft', prompt }
  const tries = opts.tries ?? 2
  let tokensIn = 0
  let tokensOut = 0
  let seconds = 0
  const take = (reply: BuiltReply) => {
    tokensIn += reply.usage?.input ?? 0
    tokensOut += reply.usage?.output ?? 0
    const s = (reply.ms ?? 0) / 1000
    seconds += s
    const scored = scoreBuild(c, reply as Record<string, unknown>, s)
    return { reply, score: scored.score, checks: scored.checks, spec: (scored.spec ?? reply.spec ?? {}) as unknown as Record<string, unknown>, faults: seriousFaults(scored.checks) }
  }
  let best = take(await build({ prompt }))
  let repairs = 0
  while (best.faults.length && repairs < tries && best.reply.spec) {
    repairs++
    opts.onRepair?.(repairs, best.faults)
    let next: ReturnType<typeof take>
    try {
      next = take(await build({ prompt: repairRequest(best.checks), currentSpec: best.spec, history: [{ prompt, response: String(best.reply.explanation ?? '').slice(0, 2000) }] }))
    } catch {
      break
    }
    // a repair that answered without a model, or made things worse, is not kept
    if (next.reply.spec && (next.faults.length < best.faults.length || (next.faults.length === best.faults.length && next.score > best.score))) best = next
  }
  // the time check is on the whole job's first build only; the totals are reported apart
  return { reply: best.reply, score: best.score, checks: best.checks, spec: best.spec, repairs, tokensIn, tokensOut, seconds }
}
