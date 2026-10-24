import type { SceneDef } from '@/modules/types'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'
import { C, usePlantLayout } from './model'

const scene: SceneDef = {
  id: 'plant-layout',
  title: 'Processing plant layout',
  summary: 'Planning a factory: flow, handling routes and equipment placement.',
  Viewport: Scene3D,
  Panel,
  camera: {
    position: [34, 30, 38],
    target: [0, 1.5, 0],
  },
  extent: 44,
  floorY: 0,
  hatchScale: 0.28,
  timeScale: 1,
  cutPresets: [
    {
      id: 'roofs',
      label: 'Roofs off / Plan view',
      planes: [{ normal: [0, 1, 0], pos: 4.8 }],
    },
    {
      id: 'long-section',
      label: 'Longitudinal section',
      planes: [{ normal: [0, 0, 1], pos: 0 }],
    },
    {
      id: 'cross-section',
      label: 'Cross section',
      planes: [{ normal: [1, 0, 0], pos: 0 }],
    },
    {
      id: 'none',
      label: 'Full building enclosure',
      planes: [{ normal: [0, 1, 0], pos: 50 }],
    },
  ],
  defaultPreset: 'roofs',
  cites: [
    C.hand('Note 4 Factory Layout'),
    C.hand('Note 3 Materials Handling'),
    C.pq('plant layout & flow diagrams'),
  ],
  reset: () => usePlantLayout.getState().reset(),
  applyParams: (p) => usePlantLayout.getState().set(p as any),
  tour: [
    {
      title: 'Factory Building & Site Organization',
      body: 'Clear-span industrial plant envelope (36 m × 26 m) designed for continuous crop processing. The administration office and quality control lab are positioned at the front approach (Rule 5) to screen visitors and inspect transport trucks before entering the loading yard.',
      camera: { position: [28, 26, 34], target: [0, 1.5, 2] },
      select: 'admin',
      cut: 'roofs',
      params: { pattern: 'u-shape', line: 'garri', showAisles: true, showFlow: true, showAsme: true },
      cites: [C.hand('Note 4 Good layout rule 5')],
    },
    {
      title: 'Intake Bay & Raw Crop Preparation',
      body: 'Raw cassava roots or bulk grain arrive at the receiving dock and discharge into the intake hopper. Immediate washing and stone removal protect downstream size-reduction equipment from abrasive wear. Peel and washing wastewater drain to an external treatment sump.',
      camera: { position: [-16, 12, 18], target: [-10.5, 2, 5] },
      select: 'station-intake',
      cut: 'roofs',
      params: { pattern: 'u-shape', line: 'garri' },
      cites: [C.hand('Note 4 Planning step 1')],
    },
    {
      title: 'Size Reduction & Vibration Isolation',
      body: 'High-speed raspers and hammer mills break down cell structures to liberate bound moisture or achieve required particle fineness. These high-speed rotating machines create severe acoustic noise and vibration (Step 2), requiring heavy inertia concrete plinths and acoustic damping.',
      camera: { position: [-15, 8, 3], target: [-10.5, 2, -3] },
      select: 'station-grater',
      cut: 'roofs',
      params: { pattern: 'u-shape', line: 'garri', showHazards: true },
      cites: [C.hand('Note 4 Planning step 2')],
    },
    {
      title: 'Thermal Processing & Flue Gas Exhaust',
      body: 'Continuous roasting and steam conditioning generate substantial latent heat and moisture. Roasting units are placed along external walls under high-capacity ventilation hoods to discharge steam directly outside, preventing moisture condensation on dry packaging stock.',
      camera: { position: [16, 9, -2], target: [10.5, 2, -4] },
      select: 'station-fryer',
      cut: 'roofs',
      params: { pattern: 'u-shape', line: 'garri', showHazards: true },
      cites: [C.hand('Note 4 heat and steam isolation')],
    },
    {
      title: 'ASME Process Chart Flow Classification',
      body: 'Every station is categorized using standard ASME symbols: Operations (◯) for physical/chemical alterations, Transportation (→) between centers, Inspections (□) for moisture and grade verification, Storage (▽) for raw crops and finished sacks, and Delays (D) for fermentation press holds.',
      camera: { position: [20, 24, 26], target: [0, 2, 0] },
      cut: 'roofs',
      params: { showAsme: true, showFlow: true },
      cites: [C.hand('Note 4 ASME process chart symbols')],
    },
    {
      title: 'Clear Aisles & Non-Crossing Flow Integrity',
      body: 'The U-shape flow ensures zero route crossings (Rule 2) and minimizes handling effort (Rule 1) by returning finished goods to the front dispatch dock. Dedicated 3.0 m wide aisles allow powered forklifts and hand pallet trucks to operate with safe clearances and uninhibited emergency egress.',
      camera: { position: [0, 18, 22], target: [0, 1, 6] },
      select: 'forklift',
      cut: 'roofs',
      params: { pattern: 'u-shape', showHandling: true, showAisles: true },
      cites: [C.hand('Note 4 Good layout rules 1, 2, 4')],
    },
  ],
}

export default scene
