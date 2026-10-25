import type { SceneDef } from '@/modules/types'
import { A503 } from '../_shared/cites'
import { DEFAULTS, useChains } from './model'
import { ChainsPanel, PRESETS } from './Panel'
import { Chains3D, FLOOR } from './Scene3D'

const scene: SceneDef = {
  id: 'chains',
  title: 'Chain drives',
  summary:
    'A roller chain running on two sprockets — simplex or duplex — that explodes into its inner plates, outer plates, pins, bushes and rollers; the chain selection steps with worked drives; and a planter’s press-wheel → lay-shaft → seed-meter chain train.',
  Viewport: Chains3D,
  Panel: ChainsPanel,
  camera: { position: [0.25, 0.3, 1.25], target: [0, -0.03, 0] },
  extent: 1.2,
  floorY: FLOOR,
  hatchScale: 0.0035,
  timeScale: 1 / 2,
  cutPresets: [
    { id: 'pitch-plane', label: 'Through the strand centre', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
    { id: 'half', label: 'Half section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'cross', label: 'Across the chain', planes: [{ normal: [1, 0, 0], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [A503.m(3, 'selection of chain'), A503.table('chain selection'), A503.mg17('Q1c'), A503.mg16('planter drive'), A503.mg19('chain drive')],
  reset: () => useChains.getState().reset(),
  applyParams: (p) => {
    const pr = p.preset ? PRESETS.find((x) => x.id === p.preset) : undefined
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) useChains.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'A roller-chain drive',
      body:
        'A chain is a **positive** drive: the rollers sit in the sprocket teeth, so there is no slip and the ratio is exactly z₂/z₁. It is compact and easy to fit, but it needs lubrication, is noisier and costs more than a belt.\n\nThis is the 2 kW palm-nut separator drive: 200 → 60 rpm through 17- and 57-tooth sprockets.',
      camera: { position: [0.25, 0.3, 1.25], target: [0, -0.03, 0] },
      cut: false,
      explode: 0,
      select: null,
      playing: true,
      params: { preset: 'mg17' },
      cites: [A503.m(1, 'merits of chain drives'), A503.mg17('Q1c')],
      check: {
        question: 'The 17-tooth sprocket turns at 200 rpm and drives the 57-tooth sprocket. How fast does the 57-tooth sprocket turn?',
        options: ['About 670 rpm', 'About 60 rpm', 'Exactly 200 rpm'],
        answer: 1,
        explain: 'A chain cannot slip, so speeds go inversely as the teeth: **200 × 17/57 ≈ 59.6 rpm**.',
      },
    },
    {
      title: 'Inside a roller chain',
      body:
        'Each pitch alternates an **inner (roller) link** — two inner plates with two bushes pressed in, and a free **roller** on each bush — with an **outer (pin) link** — two outer plates pressed onto two **pins**. The pin turns inside the bush as the chain bends round the sprocket.',
      camera: { position: [-0.32, 0.12, 0.3], target: [-0.33, 0.05, 0] },
      explode: 1,
      select: 'chain',
      cut: false,
      timeScale: 1 / 20,
      cites: [A503.m(3), A503.manual('roller chain parts')],
    },
    {
      title: 'Pin, bush and roller, cut',
      body: 'Sectioned through the middle of the strand: the **pin** sits inside the **bush**, and the **roller** turns on the bush. The roller rolls into the tooth seat instead of rubbing on it.',
      camera: { position: [-0.28, 0.1, 0.2], target: [-0.33, 0.05, 0] },
      explode: 0,
      cut: 'pitch-plane',
      select: 'rollers',
      cites: [A503.m(3)],
    },
    {
      title: 'Simplex and duplex',
      body:
        'The chart rating of one strand is 2.5 kW — less than the 2.6 kW design power — so a **duplex** chain is used: two strands on one set of long pins, rated 1.7 × 2.5 = **4.25 kW**. (A duplex chain carries 1.7×, not 2×, because the load never shares perfectly.)',
      camera: { position: [0.6, 0.25, 0.55], target: [0.35, 0, 0] },
      cut: 'cross',
      select: 'sprocket2',
      params: { preset: 'mg17', strands: 2 },
      cites: [A503.mg17('Q1c'), A503.mg21('chain drive')],
      check: {
        question: 'Keep the same pitch and sprockets, but let the design power rise to 5 kW. Is the duplex chain still enough?',
        options: ['No, a duplex is rated only 4.25 kW', 'Yes, two strands give 2 × 2.5 = 5 kW', 'Yes, as long as it is well lubricated'],
        answer: 0,
        explain: 'Two strands never share the load perfectly, so a duplex is rated **1.7 ×** simplex = 4.25 kW, below 5 kW. A larger pitch or more teeth on the small sprocket would be needed.',
      },
    },
    {
      title: 'Selecting a chain',
      body:
        '**Service factor** (1.3 moderate, 1.5 heavy shock) × power = **design power** → choose the **pitch** from the chart at the small-sprocket speed → **sprocket teeth** for the ratio → read the **rated power** (simplex, or duplex = 1.7 × simplex). The steps are worked out on the Controls tab.',
      camera: { position: [0.3, 0.3, 1.1], target: [0, -0.03, 0] },
      cut: 'half',
      params: { preset: 'mg19' },
      cites: [A503.m(3), A503.mg19('chain selection')],
    },
    {
      title: 'Chains on a planter',
      body:
        'On a planter the **press wheel** is driven by the ground and turns the **lay shaft** by chain; a second chain drives the **seed plate**. Because the drive is positive and ground-driven, the seed spacing stays the same at any forward speed — change a sprocket to change the spacing.',
      camera: { position: [0.55, 0.15, 1.15], target: [0, -0.05, 0] },
      cut: false,
      select: 'planter',
      params: { preset: 'planter' },
      cites: [A503.mg16('Q1 planter')],
      check: {
        question: 'The tractor pulls the planter twice as fast. What happens to the spacing between seeds?',
        options: ['It doubles', 'It halves', 'It stays the same'],
        answer: 2,
        explain: 'The seed plate is chain-driven from the **ground-driven** press wheel, so it turns a fixed amount per metre travelled: faster travel just turns it faster, and the spacing is unchanged.',
      },
    },
  ],
}

export default scene
