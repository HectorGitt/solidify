import { create } from 'zustand'
import { SRC, cite } from '@/content/citations'
import { CHAIN_LIMIT, CLEARING_1819, MANUAL_GUIDE, acresFromHa, chainingSuitable, clearingCost, stemsPerHa, stripAreaHa } from '@/physics/harvest'

export const C = {
  am: (w: string) => SRC.am502(w),
  bush: (w: string) => SRC.bush501(w),
  guide1819: (w: string) => cite('AEE502', 'AEE 502 -2018-2019-Marking Guide.docx', w),
}

/* ------------------------------ the plot ------------------------------ */

/** Plot: 100 m along X (the tree-count line) × 24 m across; the count strip is the middle 10 m. */
export const PLOT = { x0: -50, x1: 50, z0: -12, z1: 12 }
export const STRIP_HALF = 5

export type Stage = 'survey' | 'knockdown' | 'windrow' | 'burn' | 'till'
export const STAGES: { id: Stage; label: string; text: string }[] = [
  { id: 'survey', label: '1 · Survey', text: 'Measure the area, the vegetation type and density, and the topography. Count stems along a 100 m line, 5 m each side (0.1 ha).' },
  { id: 'knockdown', label: '2 · Knock down', text: 'Push the trees over — by chaining between two crawlers, by a single dozer or tree pusher, or shear them at ground level.' },
  { id: 'windrow', label: '3 · Windrow', text: 'A rake blade gathers the debris into windrows; soil falls through the slats, so the topsoil stays on the field.' },
  { id: 'burn', label: '4 · Burn', text: 'Burn the dried windrows and remove what is left.' },
  { id: 'till', label: '5 · Till', text: 'Root-plough to undercut and shatter the remaining roots at 20–50 cm, then plough and harrow.' },
]

export type Method = 'chain' | 'dozer' | 'shear'
export const METHODS: Record<Method, { label: string; text: string }> = {
  chain: { label: 'Anchor chaining', text: 'A heavy chain slung between two crawlers, one running along the edge and one through the bush. Effective up to 45 cm diameter and 2500 stems/ha.' },
  dozer: { label: 'Bulldozer / tree pusher', text: 'Single knockdown: the blade or pusher frame pushes each tree over and uproots it — but a straight blade takes topsoil with it.' },
  shear: { label: 'Shear blade', text: 'A sharp blade with a stinger that splits the tree first, cutting it at ground level; stumps are left to rot or be root-ploughed.' },
}

export type Vegetation = 'regrowth' | 'savanna' | 'forest'
export const VEG: Record<Vegetation, { label: string; density: number; dMax: number; text: string }> = {
  regrowth: { label: 'Secondary regrowth', density: 1800, dMax: 30, text: 'Young regrowth: many small stems — cheaper to clear than virgin forest.' },
  savanna: { label: 'Savanna woodland', density: 700, dMax: 40, text: 'Scattered trees in grass.' },
  forest: { label: 'Virgin forest', density: 900, dMax: 75, text: 'Large, old trees: too big for the chain; needs heavy dozers or shear blades.' },
}

export interface ClearingParams {
  stage: Stage
  method: Method
  veg: Vegetation
  /** play the stages one after another */
  auto: boolean
  /* costing (2018/19 Q2c) */
  hectares: number
  /** round the acres as the marking guide does (40 ha → 100 acres) */
  guideRound: boolean
  manualPerAcre: number
  manualAcresDay: number
  dozerAcresDay: number
  dozerPerDay: number
  loaderAcresDay: number
  loaderPerDay: number
}

export const DEFAULTS: ClearingParams = {
  stage: 'survey',
  method: 'chain',
  veg: 'regrowth',
  auto: true,
  hectares: 40,
  guideRound: true,
  manualPerAcre: CLEARING_1819.manual.perAcre!,
  manualAcresDay: CLEARING_1819.manual.acresPerDay,
  dozerAcresDay: CLEARING_1819.dozer.acresPerDay,
  dozerPerDay: CLEARING_1819.dozer.perDay!,
  loaderAcresDay: CLEARING_1819.baleLoader.acresPerDay,
  loaderPerDay: CLEARING_1819.baleLoader.perDay!,
}

interface Store extends ClearingParams {
  set: (p: Partial<ClearingParams>) => void
  reset: () => void
}

export const useClearing = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set({ ...DEFAULTS }) }))

/* ------------------------------ derived ------------------------------ */

/** Acres the guide uses: 40 ha ≈ 98.8 acres, rounded to 100 in the marking guide. */
export const acresOf = (ha: number) => acresFromHa(ha)

export function costing(p: ClearingParams, acres = p.guideRound ? Math.round(acresOf(p.hectares) / 5) * 5 : acresOf(p.hectares)) {
  const manual = clearingCost(acres, { perAcre: p.manualPerAcre, acresPerDay: p.manualAcresDay })
  const dozer = clearingCost(acres, { acresPerDay: p.dozerAcresDay, perDay: p.dozerPerDay })
  const loader = clearingCost(acres, { acresPerDay: p.loaderAcresDay, perDay: p.loaderPerDay })
  const guideManual = clearingCost(acres, { ...MANUAL_GUIDE, perAcre: p.manualPerAcre })
  const cheapest = [
    { id: 'Manual', ...manual },
    { id: 'Dozer', ...dozer },
    { id: 'Bale loader', ...loader },
  ].sort((a, b) => a.cost - b.cost || a.days - b.days)[0]
  return { acres, manual, dozer, loader, guideManual, cheapest }
}

/** Strip survey: count in the 100 m × 10 m strip → stems/ha; is chaining suitable? */
export function survey(count: number, dMax: number) {
  const density = stemsPerHa(count)
  return { area: stripAreaHa(), density, chain: chainingSuitable(dMax, density), limit: CHAIN_LIMIT }
}

/** The method the notes' factors point to for this vegetation (teaching summary of BUSH p3 and §11). */
export function recommend(veg: Vegetation, hectares: number) {
  const v = VEG[veg]
  const chain = chainingSuitable(v.dMax, v.density)
  if (hectares < 2) return { method: 'hand' as const, why: 'A small plot: hand clearing (axe, matchet, hoe) is the cheapest.' }
  if (chain.ok) return { method: 'chain' as Method, why: `Trees ≤ ${CHAIN_LIMIT.diameterCm} cm and ≤ ${CHAIN_LIMIT.stemsPerHa} stems/ha over a large area: anchor chaining is fastest.` }
  if (!chain.sizeOk) return { method: 'shear' as Method, why: `Trees over ${CHAIN_LIMIT.diameterCm} cm: the chain rides over them. Shear (or push) them individually; a hydraulic shear cuts softwood up to 76 cm.` }
  return { method: 'dozer' as Method, why: `Too dense for the chain (> ${CHAIN_LIMIT.stemsPerHa} stems/ha): single knockdown with a dozer or tree pusher.` }
}

/* ------------------------------ live (3D → panel) ------------------------------ */

export const live = {
  /** progress through the current stage 0…1 */
  progress: 0,
  /** trees counted in the strip, trees down */
  counted: 0,
  down: 0,
  total: 0,
}
