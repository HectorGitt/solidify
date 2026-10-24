import type { SceneDef } from '@/modules/types'
import { A503 } from '../_shared/cites'
import { DEFAULTS, useBearings } from './model'
import { BearingsPanel, PRESETS } from './Panel'
import { Bearings3D, FLOOR } from './Scene3D'

const home = { position: [0.17, 0.11, 0.2] as [number, number, number], target: [0, -0.005, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'bearings',
  title: 'Bearings',
  summary:
    'Cutaways of a deep-groove ball, cylindrical roller, tapered roller, needle and thrust bearing — plus a journal bearing with its oil film — on a Ø40 shaft, with Stribeck and AFBMA static capacity and the L10 rating-life working.',
  Viewport: Bearings3D,
  Panel: BearingsPanel,
  camera: home,
  extent: 0.2,
  floorY: FLOOR,
  hatchScale: 0.0012,
  timeScale: 1 / 20,
  cutPresets: [
    { id: 'quarter', label: 'Quarter cutaway', planes: [{ normal: [1, 0, 0], pos: 0 }, { normal: [0, 0, 1], pos: 0 }], intersection: true },
    { id: 'axial', label: 'Through the axis', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [0, 1, 0], pos: 0 }], intersection: true, sectionMoving: true },
    { id: 'side', label: 'Side section (groove profile)', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [1, 0, 0], pos: 0 }, { normal: [0, 0, 1], pos: 0 }], intersection: true, sectionMoving: true },
  ],
  defaultPreset: 'quarter',
  cites: [A503.m(7, 'Bearings'), A503.mg15('Q4'), A503.mg16('Q4'), A503.mg17('Q6c'), A503.mg19('Q4')],
  reset: () => useBearings.getState().reset(),
  applyParams: (p) => {
    const pr = p.preset ? PRESETS.find((x) => x.id === p.preset) : undefined
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) useBearings.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'What a bearing does',
      body:
        'A bearing **supports a part that rotates, slides or oscillates** in or on it. **Rolling (anti-friction) bearings** pass the load through balls or rollers in rolling contact; **journal (sliding) bearings** let the shaft slide on an oil film.\n\nThis is a single-row deep-groove ball bearing of the 208 series: Ø40 bore, 9 balls of 12 mm.',
      camera: home,
      cut: 'quarter',
      select: null,
      explode: 0,
      playing: true,
      params: { type: 'ball', preset: 'stribeck' },
      cites: [A503.m(7, 'slides 2–4'), A503.mg19('Q4a')],
    },
    {
      title: 'Races, balls and cage',
      body: 'The **inner race** is fixed to the shaft, the **outer race** to the housing. The **cage** keeps the balls apart; it orbits at a little under half shaft speed. Pull the parts apart with the explode slider.',
      camera: { position: [0.09, 0.07, 0.12], target: [0, 0, 0] },
      explode: 1,
      select: 'cage',
      cites: [A503.m(7, 'features of rolling bearing'), A503.mg15('Q4a')],
    },
    {
      title: 'Straight rollers carry more',
      body: 'Rollers touch along a line, so a roller bearing carries more than a ball bearing of the same size — but it needs almost perfect geometry, and a **straight roller bearing takes no thrust**.',
      camera: { position: [0.12, 0.08, 0.16], target: [0, 0, 0] },
      explode: 0,
      select: 'elements',
      params: { type: 'roller' },
      cites: [A503.m(7, 'slide 11')],
    },
    {
      title: 'Tapered rollers: radial and thrust',
      body: 'The cone, rollers and cup all point at one apex on the shaft axis. The angled contact lets a **tapered roller bearing** take radial and thrust load together with a high capacity.',
      camera: { position: [0.03, 0.1, 0.18], target: [0, 0, 0] },
      cut: 'side',
      select: 'elements',
      params: { type: 'taper', Fa: 4000 },
      cites: [A503.m(7, 'slide 11'), A503.mg16('Q4c')],
    },
    {
      title: 'Needle and thrust bearings',
      body: '**Needle** bearings pack many thin rollers into a small radial space. A **thrust** bearing (shaft washer, ball set, housing washer) takes only axial load.',
      camera: { position: [0.12, 0.09, 0.15], target: [0, 0, 0] },
      cut: 'quarter',
      select: null,
      params: { type: 'needle' },
      cites: [A503.m(7, 'slide 9')],
    },
    {
      title: 'The journal bearing',
      body:
        'Here the journal turns inside a stationary **bronze bush**. The turning shaft drags oil into the narrowing gap (shown about 50× thicker) and floats on it. Journal bearings are quiet and radially compact, but **fail suddenly**; rolling bearings give warning by becoming noisy.',
      camera: { position: [0.06, 0.05, 0.16], target: [0, 0, 0] },
      select: 'oil-film',
      params: { type: 'journal' },
      cites: [A503.m(7, 'slides 12–14')],
    },
    {
      title: 'Capacity and life',
      body:
        'Static capacity (Stribeck): **C₀ = KZD²/5 = 15 760 N** for this bearing. The **rating life** under an equivalent load **P = XVFᵣ + YFₐ** is **L = (C/P)³ million revolutions** — the life that 90 % of bearings reach. Try the presets on the Controls tab.',
      camera: home,
      cut: 'quarter',
      select: null,
      params: { type: 'ball' },
      cites: [A503.m(7, 'slides 16–22')],
    },
  ],
}

export default scene
