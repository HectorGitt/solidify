import type { SceneDef } from '@/modules/types'
import { CITES } from './cites'
import { DEFAULTS, useSizeReduction } from './model'
import { EXAM_PRESETS, Panel } from './Panel'
import { SizeReduction3D } from './Scene3D'

const scene: SceneDef = {
  id: 'size-reduction',
  title: 'Size reduction: hammer, burr & roller mills',
  summary:
    'Cutaways of a hammer mill, a burr (plate) mill and a roller mill with feed breaking down to product, a sieve shaker beside them, and live Kick, Rittinger and Bond energy, fineness modulus, average size and uniformity index.',
  Viewport: SizeReduction3D,
  Panel,
  camera: { position: [1.7, 1.7, 3.3], target: [0.55, 0.75, 0] },
  extent: 2.6,
  floorY: 0,
  hatchScale: 0.015,
  timeScale: 1 / 50,
  cutPresets: [
    { id: 'half', label: 'Half section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
    { id: 'side', label: 'Side section', planes: [{ normal: [1, 0, 0], pos: 0 }] },
  ],
  defaultPreset: 'half',
  cites: [CITES.red('Notes 2: Size reduction'), CITES.fel('Ch 4 eqs 4.1–4.3')],
  reset: () => useSizeReduction.getState().reset(),
  applyParams: (p) => {
    const pr = EXAM_PRESETS.find((x) => x.id === p.preset)
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) useSizeReduction.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'Hammer mill',
      body: 'Swinging **hammers** pivoted on a rotor at 1500–4000 rpm beat the feed until it passes the **screen**. Screen size, speed and feed rate set the fineness. Simple and robust, but the grind is not uniform and power is high.',
      camera: { position: [1.0, 1.2, 1.8], target: [0.2, 0.7, 0] },
      cut: 'half',
      select: 'hm-hammers',
      explode: 0,
      playing: true,
      params: { machine: 'hammer' },
      cites: [CITES.red('Hammer Mills')],
    },
    {
      title: 'Burr (plate) mill',
      body: 'Feed enters the **eye** and is crushed and sheared between a fixed and a turning grooved plate (350–700 rpm). The **handwheel** sets the gap; the spring lets the plates part for a stone. Closing the gap lowers the fineness modulus.',
      camera: { position: [0.9, 1.1, 1.4], target: [0, 0.75, 0] },
      cut: 'half',
      select: 'bm-plates',
      params: { machine: 'burr' },
      cites: [CITES.red('Burr mills or plate mills'), CITES.pq('p1 Q3c')],
    },
    {
      title: 'Roller mill',
      body: 'Two **fluted rolls** turning towards each other squeeze the material through the nip — compression, with some shear if the rolls run at different speeds. High capacity and uniform, but costly.',
      camera: { position: [0.6, 1.2, 1.5], target: [0, 0.7, 0] },
      cut: 'half',
      select: 'rm-rolls',
      params: { machine: 'roller' },
      cites: [CITES.red('Roller mills')],
    },
    {
      title: 'Energy laws',
      body: 'dE/dL = −C/Lⁿ. **Kick** (n = 1): E = C ln(L₁/L₂), coarse grinding. **Rittinger** (n = 2): E = C(1/L₂ − 1/L₁), fine grinding. **Bond** (n = 1.5) lies between. Use them to scale a known motor power to a new product size.',
      camera: { position: [1.4, 1.5, 2.6], target: [0.5, 0.7, 0] },
      cut: 'half',
      select: null,
      params: { machine: 'hammer' },
      cites: [CITES.red('Energy requirements'), CITES.fel('Ch 4')],
    },
    {
      title: 'Sieve analysis',
      body: 'A 250 g sample through IS sieves 100…15 and a pan: FM = Σ(% × 7…0)/100, D = 0.135(1.366)^FM mm, and the uniformity index coarse : medium : fine.',
      camera: { position: [0.7, 0.8, 1.0], target: [0, 0.45, 0] },
      cut: false,
      select: 'ss-trays',
      params: { machine: 'shaker' },
      cites: [CITES.red('fineness modulus method')],
    },
  ],
}

export default scene
