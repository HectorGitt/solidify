import type { CompareDef } from '@/modules/types'

/** The settings of a scene store: only the keys of its defaults (drops actions and counters). */
export function pickParams<T extends object>(defaults: T, state: object, drop: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(defaults)) if (!drop.includes(k)) out[k] = (state as Record<string, unknown>)[k]
  return out
}

/** Columns (one per variant) and rows (one per readout), with the best value in each row marked. */
export function compareTable(def: CompareDef, current: Record<string, unknown>) {
  const cols = def.variants.map((v) => ({ label: v.label, params: { ...current, ...v.params }, metrics: def.metrics({ ...current, ...v.params }) }))
  const rows = (cols[0]?.metrics ?? []).map((m, r) => {
    const vals = cols.map((c) => c.metrics[r])
    // compare as shown, so equal-looking values are treated alike
    const shown = (v: (typeof vals)[number]) => Number(v.value.toFixed(v.digits ?? 1))
    const nums = vals.filter((v) => !v.text && Number.isFinite(v.value)).map(shown)
    let best: number | null = null
    if (m.better && nums.length > 1 && Math.max(...nums) !== Math.min(...nums)) best = m.better === 'high' ? Math.max(...nums) : Math.min(...nums)
    return { label: m.label, unit: m.unit, cells: vals.map((v) => ({ v, best: best !== null && !v.text && shown(v) === best })) }
  })
  return { cols, rows }
}
