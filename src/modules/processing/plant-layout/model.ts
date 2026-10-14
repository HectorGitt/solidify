import { create } from 'zustand'
import { cite, SRC } from '@/content/citations'
import { flowCrossings, handlingEffort, routeLength, type XY } from '@/physics/processing'
import type { MaterialKey } from '@/render/materials'

export const C = {
  hand: (where?: string) => cite('AEE504', 'AGE 504 Handling and planning new.docx', where),
  pq: (where?: string) => cite('AEE504', 'AEE 504 past question.pdf', where),
  gstd: (where?: string) => cite('AEE504', 'garri standards.pdf', where),
  beyond: (what: string) => SRC.beyond(what),
}

export type LayoutPattern = 'straight' | 'u-shape' | 'serpentine' | 'circular' | 'odd-angle'
export type ProcessingLine = 'garri' | 'feed-mill'
export type AsmeSymbol = 'operation' | 'transport' | 'inspection' | 'storage' | 'delay'

export interface StationDef {
  id: string
  name: string
  short: string
  asme: AsmeSymbol
  asmeLabel: string
  conveyorToNext: 'belt' | 'screw' | 'bucket' | 'pneumatic' | 'gravity' | 'trolley'
  /** Fraction of raw input batch mass present at this station */
  massFraction: number
  /** [width (x), height (y), depth (z)] in metres */
  dim: [number, number, number]
  hazards: { noise?: boolean; dust?: boolean; heat?: boolean; steam?: boolean; water?: boolean }
  material: MaterialKey
  color: string
  summary: string
  role: string
  details?: string
}

export const ASME_SYMBOLS: Record<AsmeSymbol, { name: string; glyph: string; color: string; desc: string }> = {
  operation: { name: 'Operation', glyph: '◯', color: '#2dd4bf', desc: 'Intentional change in physical or chemical properties.' },
  transport: { name: 'Transportation', glyph: '→', color: '#60a5fa', desc: 'Movement from one work center to another.' },
  inspection: { name: 'Inspection', glyph: '□', color: '#fbbf24', desc: 'Verification of quality, quantity, or grade specification.' },
  storage: { name: 'Storage', glyph: '▽', color: '#a78bfa', desc: 'Controlled retention of raw materials or finished product.' },
  delay: { name: 'Delay', glyph: 'D', color: '#f87171', desc: 'Temporary process wait or fermentation incubation period.' },
}

export const GARRI_STATIONS: StationDef[] = [
  {
    id: 'intake',
    name: 'Raw Cassava Reception & Inspection',
    short: 'Reception',
    asme: 'storage',
    asmeLabel: 'Raw Storage & Weighing',
    conveyorToNext: 'belt',
    massFraction: 1.0,
    dim: [3.4, 2.0, 3.0],
    hazards: {},
    material: 'crop',
    color: '#855938',
    summary: 'Fresh cassava root unloading, inspection, and weighing hopper.',
    role: 'Receives fresh tubers from farms; rejects spoiled roots before processing.',
    details: 'Fresh tubers have 65–70 % moisture. Siting near the receiving dock minimizes heavy manual handling.',
  },
  {
    id: 'washer',
    name: 'Rotary Washer & Peeler',
    short: 'Washing / Peeling',
    asme: 'operation',
    asmeLabel: 'Washing & Peeling',
    conveyorToNext: 'belt',
    massFraction: 0.75,
    dim: [4.0, 2.2, 2.4],
    hazards: { water: true },
    material: 'galvanised',
    color: '#38bdf8',
    summary: 'Perforated rotary drum washer with high-pressure water jets.',
    role: 'Removes soil, stones, and abrasive peel cortex (20–25 % peel waste to effluent sump).',
    details: 'Washing effluent contains starch and cyanogenic glucosides, drained to external treatment sump.',
  },
  {
    id: 'grater',
    name: 'Motorized Cassava Grater',
    short: 'Grating',
    asme: 'operation',
    asmeLabel: 'Grating (Size Reduction)',
    conveyorToNext: 'screw',
    massFraction: 0.75,
    dim: [2.6, 2.5, 2.4],
    hazards: { noise: true },
    material: 'steel',
    color: '#22c55e',
    summary: 'High-speed rasper/hammer cylinder with perforated screen.',
    role: 'Ruptures tuber cells to liberate bound moisture and start cyanogenic enzymatic detoxification.',
    details: 'Operates at 1500–2800 rpm; creates high acoustic noise requiring vibration isolation pad.',
  },
  {
    id: 'press',
    name: 'Fermentation Dewatering Press',
    short: 'Dewatering Press',
    asme: 'delay',
    asmeLabel: 'Fermentation & Pressing',
    conveyorToNext: 'trolley',
    massFraction: 0.52,
    dim: [3.6, 2.6, 2.8],
    hazards: { water: true },
    material: 'steelDark',
    color: '#f97316',
    summary: 'Hydraulic parallel-rack press with slotted drainage basin.',
    role: 'Presses cassava mash bags for 24–72 h to dewater to ≈ 45 % moisture and allow lactic acid fermentation.',
    details: 'Cassava waste liquor is expressed and drained through dedicated stainless floor troughs.',
  },
  {
    id: 'sifter',
    name: 'Wet Granulator & Sifter',
    short: 'Granulator',
    asme: 'operation',
    asmeLabel: 'Disintegration & Sifting',
    conveyorToNext: 'belt',
    massFraction: 0.5,
    dim: [2.8, 2.2, 2.2],
    hazards: { noise: true },
    material: 'galvanised',
    color: '#a855f7',
    summary: 'High-speed disintegrator with round-hole screen.',
    role: 'Breaks compressed dewatered mash cake into loose, uniform granules ready for toasting.',
    details: 'Fibrous ungrated lumps are separated and recycled or dried for animal feed.',
  },
  {
    id: 'fryer',
    name: 'Continuous Garri Fryer / Roaster',
    short: 'Garri Roaster',
    asme: 'operation',
    asmeLabel: 'Gelatinization & Roasting',
    conveyorToNext: 'screw',
    massFraction: 0.28,
    dim: [4.8, 2.6, 2.6],
    hazards: { heat: true, steam: true },
    material: 'castIron',
    color: '#ef4444',
    summary: 'Stainless roasting trough with mechanical paddles and gas burner heat exchanger.',
    role: 'Gelatinizes cassava starch (80–85 °C) and dehydrates product to ≤ 12 % moisture (Codex STAN 151).',
    details: 'Generates intense heat and steam; located near external wall under exhaust canopy hoods.',
  },
  {
    id: 'cooler',
    name: 'Vibratory Cooler & Granule Grader',
    short: 'Cooler / Grader',
    asme: 'inspection',
    asmeLabel: 'Cooling & Sieve Grading',
    conveyorToNext: 'belt',
    massFraction: 0.26,
    dim: [3.6, 2.2, 2.2],
    hazards: { dust: true },
    material: 'aluminium',
    color: '#eab308',
    summary: 'Multi-deck vibratory sifter with ambient forced-air cooling bed.',
    role: 'Cools garri to ambient temperature and sorts into Extra-fine, Fine, Medium, and Coarse grades.',
    details: 'Complies with AFNOR sieve specifications (extra-fine < 0.5 mm, fine < 1.0 mm, medium < 1.25 mm).',
  },
  {
    id: 'bagging',
    name: 'Weighing & Automatic Bagging Station',
    short: 'Bagging / Dispatch',
    asme: 'storage',
    asmeLabel: 'Finished Goods Storage',
    conveyorToNext: 'gravity',
    massFraction: 0.25,
    dim: [3.2, 2.8, 3.0],
    hazards: { dust: true },
    material: 'paintYellow',
    color: '#10b981',
    summary: 'Automatic net-weigher, bag sewing head, and pallet accumulation conveyor.',
    role: 'Packages high-quality garri into airtight woven polypropylene sacks (25/50 kg) for dispatch.',
    details: 'Placed directly beside the dispatch loading dock to eliminate internal re-handling.',
  },
]

export const FEED_MILL_STATIONS: StationDef[] = [
  {
    id: 'intake',
    name: 'Grain Intake Pit & Pre-Cleaner',
    short: 'Intake & Scalper',
    asme: 'storage',
    asmeLabel: 'Grain Intake & Scalping',
    conveyorToNext: 'bucket',
    massFraction: 1.0,
    dim: [3.4, 2.2, 3.0],
    hazards: { dust: true },
    material: 'steelDark',
    color: '#ca8a04',
    summary: 'Intake hopper with floor grating and rotary drum scalper screen.',
    role: 'Receives bulk maize and soybean; screens out straw, stones, and tramp metal via magnet.',
    details: 'Includes suction air aspiration hood to capture intake dust.',
  },
  {
    id: 'silos',
    name: 'Raw Material Silo Battery',
    short: 'Storage Silos',
    asme: 'storage',
    asmeLabel: 'Ingredient Storage Silos',
    conveyorToNext: 'screw',
    massFraction: 1.0,
    dim: [4.0, 4.6, 4.0],
    hazards: {},
    material: 'galvanised',
    color: '#64748b',
    summary: 'Corrugated steel silos with conical discharge hoppers and aeration fans.',
    role: 'Stores bulk ingredients (maize, sorghum, bran) under safe moisture conditions (≤ 12 %).',
    details: 'Discharges through slide gates into screw conveyors feeding batch weighing hoppers.',
  },
  {
    id: 'grinder',
    name: 'High-Speed Hammer Mill',
    short: 'Hammer Mill',
    asme: 'operation',
    asmeLabel: 'Size Reduction (Grinding)',
    conveyorToNext: 'pneumatic',
    massFraction: 0.99,
    dim: [3.0, 3.2, 2.8],
    hazards: { noise: true, dust: true },
    material: 'castIron',
    color: '#0284c7',
    summary: 'Heavy hammer rotor spinning at 3000 rpm inside 3.0 mm screen ring.',
    role: 'Grinds coarse grains to required fineness modulus (FM ≈ 2.8–3.2) for balanced digestion.',
    details: 'Equipped with pneumatic conveying duct and cyclone collector to prevent choking.',
  },
  {
    id: 'mixer',
    name: 'Horizontal Ribbon Batch Mixer',
    short: 'Ribbon Mixer',
    asme: 'operation',
    asmeLabel: 'Ingredient Batch Blending',
    conveyorToNext: 'bucket',
    massFraction: 1.0,
    dim: [3.6, 2.6, 2.8],
    hazards: { dust: true },
    material: 'steel',
    color: '#16a34a',
    summary: 'Counter-helical ribbon flight rotor in U-shaped mixing trough.',
    role: 'Uniformly incorporates protein meals, premixes, minerals, and liquid fats within 3–4 min.',
    details: 'Achieves coefficient of variation (CV) < 5 %; center bottom pneumatic discharge gate.',
  },
  {
    id: 'pellet',
    name: 'Steam Conditioner & Pellet Mill',
    short: 'Pellet Press',
    asme: 'operation',
    asmeLabel: 'Steam Conditioning & Pelleting',
    conveyorToNext: 'bucket',
    massFraction: 1.02,
    dim: [3.2, 3.4, 3.0],
    hazards: { heat: true, steam: true, noise: true },
    material: 'steelMatte',
    color: '#d97706',
    summary: 'Rotary paddle steam conditioner above ring-die extrusion pellet mill.',
    role: 'Conditioning mash to 82 °C with boiler steam gelatinizes starch; dies extrude durable pellets.',
    details: 'Increases feed conversion ratio (FCR) and sterilizes potential pathogens (Salmonella).',
  },
  {
    id: 'cooler',
    name: 'Counter-Flow Pellet Cooler',
    short: 'Pellet Cooler',
    asme: 'operation',
    asmeLabel: 'Counter-Flow Cooling',
    conveyorToNext: 'bucket',
    massFraction: 0.98,
    dim: [3.0, 4.2, 3.0],
    hazards: { dust: true },
    material: 'galvanised',
    color: '#2563eb',
    summary: 'Vertical counter-flow cooling bin with cyclone exhaust air fan.',
    role: 'Brings hot pellets down to within 3 °C of ambient temperature and removes excess moisture.',
    details: 'Prevents condensation mold inside storage bags and hardens pellet texture.',
  },
  {
    id: 'crumbler',
    name: 'Pellet Crumbler & Rotary Sifter',
    short: 'Crumbler / Sifter',
    asme: 'inspection',
    asmeLabel: 'Crumbling & Screen Grading',
    conveyorToNext: 'screw',
    massFraction: 0.97,
    dim: [2.8, 2.6, 2.6],
    hazards: { noise: true },
    material: 'aluminium',
    color: '#9333ea',
    summary: 'Corrugated cracking roller pair and multi-tier vibratory grading screen.',
    role: 'Crumbles full-size pellets into starter crumbles for chicks; recycles fines to pellet mill.',
    details: 'Two-deck screen returns oversize back to rolls and underflow dust to mixer.',
  },
  {
    id: 'bagging',
    name: 'Automatic Bagging & Pallet Station',
    short: 'Bagging / Dispatch',
    asme: 'storage',
    asmeLabel: 'Packaging & Warehouse',
    conveyorToNext: 'gravity',
    massFraction: 0.97,
    dim: [3.4, 2.8, 3.2],
    hazards: { dust: true },
    material: 'paintGreen',
    color: '#059669',
    summary: 'Load-cell bag filler, conveyor belt, pneumatic sewing head, and pallet stretch wrapper.',
    role: 'Packs finished livestock feed into 25/50 kg bags and stacks on wooden pallets for shipping.',
    details: 'Located adjacent to the warehouse vehicle dispatch bay.',
  },
]

export interface PlantLayoutParams {
  line: ProcessingLine
  pattern: LayoutPattern
  /** Total raw input batch mass, metric tonnes */
  batchMass: number
  /** Minimum handling aisle width between rows/walls, metres */
  aisleWidth: number
  showFlow: boolean
  showAsme: boolean
  showAisles: boolean
  showHazards: boolean
  showHandling: boolean
  checklist: Record<string, boolean>
}

export const DEFAULTS: PlantLayoutParams = {
  line: 'garri',
  pattern: 'u-shape',
  batchMass: 5.0,
  aisleWidth: 3.0,
  showFlow: true,
  showAsme: true,
  showAisles: true,
  showHazards: true,
  showHandling: true,
  checklist: {},
}

/**
 * 2D Plan Coordinates [x, z] in metres for each of the 8 stations.
 * Origin (0, 0) is the center of the factory floor (Building footprint ≈ 36 m × 26 m).
 * X is East-West, Z is North-South.
 * Front entrance / loading yard is at +Z (South).
 */
export function getStationPositions(pattern: LayoutPattern): [number, number][] {
  switch (pattern) {
    case 'straight':
      // Straight linear progression from West (-X) to East (+X)
      return [
        [-13.5, 0],
        [-9.5, 0],
        [-5.5, 0],
        [-1.5, 0],
        [2.5, 0],
        [6.5, 0],
        [10.5, 0],
        [14.0, 0],
      ]
    case 'u-shape':
      // U-turn loop: Starts at South-West dock, heads North, turns East, returns South to South-East dock
      return [
        [-10.5, 7.5], // 0: Intake at front-left dock
        [-10.5, 2.5], // 1: Washer
        [-10.5, -3.0], // 2: Grater
        [-10.5, -8.0], // 3: Press (turn corner)
        [2.0, -8.0], // 4: Sifter (back wall cross)
        [10.5, -5.0], // 5: Fryer (turn southward)
        [10.5, 1.0], // 6: Cooler
        [10.5, 7.5], // 7: Bagging at front-right dock
      ]
    case 'serpentine':
      // S-curve zig-zag across three rows
      return [
        [-11.0, -7.5], // Row 1 (back): Left to Right
        [-3.0, -7.5],
        [5.0, -7.5],
        [11.0, -7.5],
        [11.0, 0.0], // Row 2 (middle): Right to Left
        [0.0, 0.0],
        [-11.0, 0.0],
        [-11.0, 7.5], // Row 3 (front): Left to Right
      ]
    case 'circular':
      // Elliptical ring around a central maintenance atrium
      {
        const rX = 11.5
        const rZ = 7.5
        const angles = [1.2, 0.7, 0.1, -0.6, -1.3, -2.1, -2.7, 2.3]
        return angles.map((a) => [Number((rX * Math.cos(a)).toFixed(2)), Number((rZ * Math.sin(a)).toFixed(2))])
      }
    case 'odd-angle':
      // Disjointed, backtracking layout with crossing material paths!
      // Path 0->1 crosses 2->3, 4->5 crosses 6->7!
      return [
        [-11.0, 7.0], // 0: Front left
        [11.0, -7.0], // 1: Back right (crosses entire factory diagonal)
        [-11.0, -7.0], // 2: Back left
        [11.0, 7.0], // 3: Front right (crosses line 0->1!)
        [-4.0, 5.0], // 4: Front center
        [4.0, -6.0], // 5: Back center
        [-4.0, -6.0], // 6: Back mid-left
        [4.0, 5.0], // 7: Front mid-right (crosses 4->5!)
      ]
  }
}

export interface BuildingLayout {
  width: number
  depth: number
  height: number
  docks: { in: [number, number]; out: [number, number] }
  admin: { x: number; z: number; w: number; d: number }
  utility: { x: number; z: number; w: number; d: number }
  effluent: { x: number; z: number; w: number; d: number }
}

export const BUILDING: BuildingLayout = {
  width: 36,
  depth: 26,
  height: 7.2,
  docks: {
    in: [-11.0, 13.0],
    out: [11.0, 13.0],
  },
  admin: { x: -14.0, z: 15.5, w: 8.0, d: 5.0 },
  utility: { x: 14.5, z: -10.0, w: 7.0, d: 5.5 },
  effluent: { x: -15.0, z: -10.0, w: 5.0, d: 5.0 },
}

export function assessLayout(p: PlantLayoutParams) {
  const stations = p.line === 'garri' ? GARRI_STATIONS : FEED_MILL_STATIONS
  const positions = getStationPositions(p.pattern)

  const pts: XY[] = positions.map(([x, z]) => [x, z])
  const totalLength = routeLength(pts)

  // Subdivided segments for crossing detection
  const routes: XY[][] = [pts]
  const crossings = flowCrossings(routes)

  // Handling effort Σ(mass × distance) across all consecutive transfers
  const legs = pts.slice(1).map((pt, i) => {
    const prev = pts[i]
    const dist = Math.hypot(pt[0] - prev[0], pt[1] - prev[1])
    const mass = p.batchMass * stations[i].massFraction
    return { mass, dist }
  })
  const totalEffort = handlingEffort(legs)

  // Baseline optimal effort (U-shape has compact flow)
  const uPositions = getStationPositions('u-shape')
  const uPts: XY[] = uPositions.map(([x, z]) => [x, z])
  const uLegs = uPts.slice(1).map((pt, i) => {
    const prev = uPts[i]
    const dist = Math.hypot(pt[0] - prev[0], pt[1] - prev[1])
    const mass = p.batchMass * stations[i].massFraction
    return { mass, dist }
  })
  const baseEffort = handlingEffort(uLegs)
  const relativeHandlingEffort = baseEffort > 0 ? (totalEffort / baseEffort) * 100 : 100

  // Minimum aisle clearance calculation
  let minClearance = Infinity
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const d = Math.hypot(positions[i][0] - positions[j][0], positions[i][1] - positions[j][1])
      const rSum = (stations[i].dim[0] + stations[j].dim[0]) / 4
      const gap = Math.max(0, d - rSum)
      if (gap < minClearance) minClearance = gap
    }
  }
  const aisleOk = minClearance >= p.aisleWidth

  // Count ASME symbols
  const asmeCounts: Record<AsmeSymbol, number> = {
    operation: 0,
    transport: stations.length - 1, // transfers between each pair
    inspection: 0,
    storage: 0,
    delay: 0,
  }
  stations.forEach((s) => {
    asmeCounts[s.asme]++
  })

  // Good layout rule checks
  const rules = {
    noCrossings: crossings === 0,
    aislesAdequate: aisleOk,
    effortOptimal: relativeHandlingEffort <= 115,
    adminAtApproach: true, // admin at front approach
    utilitiesIsolated: true, // generator/utility in external sound bay
    expansionRoom: p.pattern !== 'odd-angle',
  }
  const rulesPassed = Object.values(rules).filter(Boolean).length

  return {
    stations,
    positions,
    pts,
    totalLength,
    crossings,
    totalEffort,
    baseEffort,
    relativeHandlingEffort,
    minClearance,
    aisleOk,
    asmeCounts,
    rules,
    rulesPassed,
  }
}

export const AGE504_PLANNING_STEPS = [
  { id: 1, step: 'Activities and inputs', desc: 'Identify incoming raw crops, varieties, moisture content, daily throughput, and target product specifications.' },
  { id: 2, step: 'Stage flow chart with hazards', desc: 'Map sequential operations, noting noise, heat, dust, steam, and effluent at each machine.' },
  { id: 3, step: 'Equipment flow diagram & heights', desc: 'Determine machine physical envelopes, overhead clearances, discharge chutes, and service accesses.' },
  { id: 4, step: 'Building assignment', desc: 'Allocate clean food processing, noisy milling, dirty peeling, and packaging into appropriate compartments.' },
  { id: 5, step: 'Conveying modes', desc: 'Select appropriate handling: belt for roots/bags, screw for wet mash, bucket for grain, pneumatic for meal.' },
  { id: 6, step: 'Office and administration', desc: 'Position manager and quality assurance lab at the front approach to supervise intake and dispatch.' },
  { id: 7, step: 'Site works and drainage', desc: 'Design all-weather lorry approach roads, surface drainage, wash-water effluent slopes, and sumps.' },
  { id: 8, step: 'Utilities and auxiliary', desc: 'Locate standby generator downwind, water borehole tank elevated, and boiler steam pipes safely.' },
]

export const AGE504_LAYOUT_RULES = [
  { id: 'min_handling', title: 'Minimise material handling', desc: 'Handle in large unit loads or continuous flows; eliminate manual re-handling.' },
  { id: 'no_crossing', title: 'Continuous non-crossing flow', desc: 'Material routes must never cross each other or backtrack to prevent collisions.' },
  { id: 'group_like', title: 'Group like operations in rows', desc: 'Organize machinery in standardized rows with parallel conveying alignments.' },
  { id: 'clear_aisles', title: 'Keep aisles clear', desc: 'Maintain ≥ 2.5 m width for powered forklifts and ≥ 1.5 m for hand push trolleys.' },
  { id: 'admin_approach', title: 'Admin block at first approach', desc: 'Visitors and drivers report directly to reception before entering the plant floor.' },
  { id: 'utilities_sited', title: 'Locate utilities suitably', desc: 'Generator in sound-damped bay; effluent sumps away from clean food zones.' },
  { id: 'expansion_room', title: 'Leave room for expansion', desc: 'Ensure building ends have knockdown gables for extending processing capacity.' },
]

interface Store extends PlantLayoutParams {
  set: (p: Partial<PlantLayoutParams>) => void
  reset: () => void
}

export const usePlantLayout = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set({ ...DEFAULTS, checklist: {} }),
}))

export const live = {
  forkliftPos: [0, 0, 0] as [number, number, number],
  flowPhase: 0,
}
