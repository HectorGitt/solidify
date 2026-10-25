import type { SceneDef } from '@/modules/types'
import { CITE } from './cites'
import { DEFAULTS, useGarri } from './model'
import { EXAM, GarriPanel, PRESETS } from './Panel'
import { CassavaGarri3D, X } from './Scene3D'

type V3 = [number, number, number]
const overview = { position: [1.5, 6.5, 11.5] as V3, target: [0, 0.6, 0] as V3 }
const near = (x: number, dy = 0): { position: V3; target: V3 } => ({ position: [x + 0.6, 2 + dy, 3.2], target: [x, 0.7 + dy / 3, 0] })
const win = (x: number, w = 0.85) => [
  { normal: [0, 0, 1] as V3, pos: 0 },
  { normal: [1, 0, 0] as V3, pos: x - w },
  { normal: [-1, 0, 0] as V3, pos: -(x + w) },
]

const scene: SceneDef = {
  id: 'cassava-garri',
  title: 'Cassava to garri line',
  summary:
    'A straight-line garri plant: drum peeler, washer, rasp grater, fermentation sacks in a screw press, granulating sieve, a stirred fryer, cooling table, grading sifter and bagging, with a live mass and moisture balance checked against the garri standard.',
  Viewport: CassavaGarri3D,
  Panel: GarriPanel,
  camera: overview,
  extent: 16,
  floorY: -0.06,
  hatchScale: 0.08,
  timeScale: 1 / 2,
  cutPresets: [
    { id: 'half', label: 'Half section (whole line)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'press', label: 'Grater and press cut open', planes: win((X.grate + X.press) / 2, 1.6), intersection: true },
    { id: 'fryer', label: 'Fryer cut open', planes: win(X.fry), intersection: true },
    { id: 'plan', label: 'Plan section at 0.6 m', planes: [{ normal: [0, 1, 0], pos: 0.6 }] },
  ],
  defaultPreset: 'fryer',
  cites: [CITE.garriFlow('steps 1–11'), CITE.gstd('§2.1, §3.3, §6, Annex granularity'), CITE.sep('wet cleaning, screens')],
  reset: () => useGarri.getState().reset(),
  applyParams: (p) => {
    const id = p.preset as string | undefined
    const pr = id ? [...PRESETS, ...EXAM].find((x) => x.id === id) : undefined
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) useGarri.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'From root to garri',
      body:
        'Fresh cassava is mostly water. The line **peels and washes**, **grates**, **ferments and presses**, **sieves**, **fries**, **cools**, **sifts** and **bags** — and most of what leaves is water: from 1 t of roots only about a quarter becomes garri.',
      camera: overview,
      cut: false,
      select: null,
      explode: 0,
      playing: true,
      params: { preset: 'standard' },
      cites: [CITE.garriFlow('steps 1–11')],
    },
    {
      title: 'Peeling, washing and grating',
      body:
        'Roots tumble in an abrasive **drum peeler**, then a **rotary drum washer** cleans them under water — wet cleaning suits root crops. A fast **rasp drum** tears them into a wet mash.',
      camera: near(X.wash, 0.3),
      cut: 'half',
      select: 'grater',
      cites: [CITE.sep('rotary drum washer'), CITE.garriFlow('grating')],
    },
    {
      title: 'Fermenting and pressing',
      body:
        'The mash ferments in sacks for 2–3 days: acidity rises to **0.6–1.0 % lactic acid** and the cyanogens break down. The screw press then squeezes out the liquor, leaving a firm cake near 47 % moisture.',
      camera: near(X.press, 0.4),
      cut: 'press',
      select: 'press',
      params: { preset: 'standard' },
      cites: [CITE.garriFlow('fermentation and dewatering'), CITE.gstd('§3.3 acidity')],
      check: {
        question: 'To save time, the mash is fermented for only 1 day instead of 3. What is the likely result?',
        options: ['Acidity stays under 0.6 % and more cyanide remains', 'Acidity overshoots 1.0 % and the garri turns sour', 'No change, since pressing sets the quality'],
        answer: 0,
        explain: 'Acidity builds up and the **cyanogens** break down over the days of fermentation. One day leaves the acidity below the **0.6 %** minimum and more cyanide in the product.',
        reveal: { params: { preset: 'short-ferment' } },
      },
    },
    {
      title: 'Garifying',
      body:
        'Sieved grits are stirred on a hot pan: water flashes off as steam and the starch **partly gelatinises** and dries into crisp granules. Frying must bring the moisture to **12 % or less** — under-fried garri cakes and goes mouldy.',
      camera: near(X.fry, 0.6),
      cut: 'fryer',
      select: 'fryer',
      params: { preset: 'underfried' },
      cites: [CITE.gstd('§2.1, §3.3')],
      check: {
        question: '100 kg of pressed cake at 47 % moisture is fried to 10.5 % moisture. About how much garri comes out?',
        options: ['About 47 kg', 'About 59 kg', 'About 89 kg'],
        answer: 1,
        explain: 'Frying removes only water, so the **dry solids** are conserved: 53 kg of solids make up 89.5 % of the product, giving 53/0.895 ≈ **59 kg**.',
      },
    },
    {
      title: 'Sifting, grading and bagging',
      body:
        'After cooling, a sifter grades the garri: **extra-fine** (all through 0.5 mm), **fine** (1 mm), **medium** (1.25 mm) or **coarse** (2 mm); coarse lumps are milled and returned. It is packed in clean, strongly sewn sacks.',
      camera: near(X.sift + 0.6, 0.3),
      cut: false,
      select: 'sifter',
      params: { preset: 'standard', grade: 'fine' },
      cites: [CITE.gstd('Annex granularity, §6 packaging')],
      check: {
        question: 'A sample passes the 2 mm sieve completely, but only about a quarter of it passes 1.25 mm. Which grade is it?',
        options: ['Fine', 'Medium', 'Coarse'],
        answer: 2,
        explain: 'Medium garri passes 1.25 mm completely. All through 2 mm with no more than 40 % through 1.25 mm is **coarse**.',
        reveal: { params: { preset: 'coarse' } },
      },
    },
  ],
}

export default scene
