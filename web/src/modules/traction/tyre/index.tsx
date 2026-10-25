import type { SceneDef } from '@/modules/types'
import { clamp, roundTo } from '@/content/context'
import { DEFAULTS, L27, TT, TTS, useTyre } from './model'
import { TyrePanel } from './Panel'
import { Tyre3D } from './Tyre3D'

const cam = { position: [2.1, 1.55, 2.7] as [number, number, number], target: [0, 0.8, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'tyre',
  title: 'Tyre construction',
  summary:
    'A tractor drive tyre cut open and peeled back layer by layer: tread, shoulder, sidewall, belts, body plies, liner, beads and rim. Switch between bias, belted-bias and radial plies, decode size codes into real proportions, change the tread class and watch inflation reshape the section and footprint.',
  Viewport: Tyre3D,
  Panel: TyrePanel,
  camera: cam,
  extent: 2.2,
  floorY: -0.05,
  hatchScale: 0.006,
  timeScale: 1 / 10,
  cutPresets: [
    { id: 'quarter', label: 'Quarter cutaway', planes: [{ normal: [1, 0, 0], pos: 0 }, { normal: [0, 0, 1], pos: 0 }], intersection: true },
    { id: 'section', label: 'Cross-section through the axle', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'mid', label: 'Centre plane of the tread', planes: [{ normal: [0, 0, 1], pos: 0 }] },
  ],
  defaultPreset: 'quarter',
  cites: [TT('p1–7, Figs 2–9'), TT('p15–19 — tire failures'), TTS('p13–15 — wheels and tyres'), L27('p32, p39')],
  reset: () => useTyre.getState().reset(),
  fromContext: (c) => ({
    ...(c.wheelLoadKN !== undefined ? { load: roundTo(clamp(c.wheelLoadKN, 4, 40), 0.5) } : {}),
    ...(c.tyre ? { build: c.tyre } : {}),
  }),
  applyParams: (p) => useTyre.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Inside a tractor tyre',
      body: 'This is an **18.4-38** rear drive tyre on its rim, cut open and peeled back so every layer shows. Click any layer for its job.\n\nFrom the outside in: **tread** bars, **tread shoulder** and **sidewall** rubber, the **body plies**, the **inner liner**, and the steel **beads** that hold it on the **rim**.',
      camera: cam,
      cut: 'quarter',
      select: null,
      explode: 0,
      params: { ...DEFAULTS },
      cites: [TT('p2, Fig 2')],
    },
    {
      title: 'Beads and rim',
      body: 'The **beads** are bundles of steel wire. Every ply is tied round them; they anchor the tyre to the rim and stop it changing shape or fit. If a bead slips on the rim (low pressure, poor seating, too much soap) the valve can be torn off.',
      camera: { position: [0.9, 0.7, 1.1], target: [0.1, 0.55, 0.15] },
      select: 'beads',
      cut: 'quarter',
      cites: [TT('p2 — bead'), TT('p18')],
    },
    {
      title: 'Body plies and ply rating',
      body: 'Each **ply** is rubber-cushioned cord (cotton, rayon, nylon or polyester). In a **bias** tyre the cords run bead to bead at an angle, alternating in each ply — see the crossing cords where the layers are peeled.\n\n**Ply rating is strength, not the count**: this 4-ply-rated tyre can be built with 2 plies of larger cords.',
      camera: { position: [-1.7, 1.6, 1.9], target: [-0.6, 1.1, 0.1] },
      select: 'ply-1',
      params: { build: 'bias', plies: 2 },
      cites: [TT('p2–3, Fig 3')],
    },
    {
      title: 'Belted bias and belted radial',
      body: '**Belted bias** adds low-angle rigid **belts** under the tread. **Belted radial** runs the body cords straight across at about 90°, with belts under the tread: the soft sidewall lets the tread lie flat. Radials give 5–7 % better tractive efficiency.',
      camera: { position: [-1.7, 1.6, 1.9], target: [-0.6, 1.1, 0.1] },
      select: 'belt-1',
      params: { build: 'radial', plies: 4 },
      cites: [TT('p3, Fig 4'), L27('p39')],
      check: {
        question: 'Why does a radial tyre usually pull better in the field than a bias tyre of the same size?',
        options: ['Its flexible sidewall lets the tread lie flat', 'Its extra plies make the carcass stiffer', 'Its tread bars are deeper than a bias tyre’s'],
        answer: 0,
        explain: 'With body cords at about 90° the **sidewall** flexes freely while the belts keep the tread flat, giving a longer, even footprint and 5–7 % better tractive efficiency.',
      },
    },
    {
      title: 'Tread classes and the directional arrow',
      body: 'Drive tyres are coded **R-1** (regular bars), **R-2** (deep cane & rice), **R-3** (shallow, non-directional) and **R-4** (industrial); front tyres **F-1…F-3** (F-2 single rib); implements **I-** and industrial **E-**.\n\nThe arrow shows forward rotation: the **V points downward seen from the front**. Try “mount reversed” in Controls.',
      camera: { position: [2.4, 1.9, 1.4], target: [0, 1.1, 0] },
      select: 'arrow',
      params: { tread: 'R1' },
      cites: [TT('p4–5, Figs 6, 8')],
    },
    {
      title: 'Reading a size code',
      body: '**24.5-32**: 24.5 in section width on the recommended rim, on a **32 in** rim. A “-” means bias, “R” radial; **12.4/11-28** gives the new and old widths. Type any code in Controls — the tyre is rebuilt to those proportions.',
      camera: { position: [2.6, 1.7, 3.0], target: [0, 0.85, 0] },
      select: null,
      params: { code: '24.5-32', build: 'bias' },
      cites: [TT('p5, Fig 7')],
      check: {
        question: 'What does the size code 20.8R42 tell you?',
        options: ['A 20.8 in rim, 42 in wide, radial', '20.8 in wide, on a 42 in rim, radial', '20.8 in wide, 42 in tall, bias'],
        answer: 1,
        explain: 'The first number is the **section width** in inches and the last is the **rim diameter**; the “R” marks a radial, where a “-” would mean bias.',
        reveal: { params: { code: '20.8R42', build: 'radial' } },
      },
    },
    {
      title: 'Under-inflation',
      body: 'Cut through the axle to see the section. At low pressure the tyre **flexes too much** at every turn, heats up and the **sides of the tread wear** (orange) while the centre stays unworn. Rear field pressure is **0.8 bar**, road 1.0 bar.',
      camera: { position: [2.6, 0.7, 0.5], target: [0, 0.35, 0] },
      cut: 'section',
      select: 'contact',
      params: { code: '18.4-38', pressure: 0.4, duty: 'rear-field' },
      cites: [TT('p6, Fig 9'), TTS('p14')],
    },
    {
      title: 'Over-inflation',
      body: 'Too much pressure keeps the crown round: **only the centre** of the tread touches, so it wears there, traction and flotation drop, and the rigid tyre is easily broken by impacts. Contact area follows **A = W/p** — ground pressure ≈ tyre pressure.',
      camera: { position: [2.6, 0.7, 0.5], target: [0, 0.35, 0] },
      cut: 'section',
      select: 'contact',
      params: { pressure: 1.6 },
      cites: [TT('p6, Fig 9'), L27('p39')],
      check: {
        question: 'Going from 0.8 to 1.6 bar at the same wheel load, what happens to the contact area?',
        options: ['It roughly doubles', 'It stays about the same', 'It roughly halves'],
        answer: 2,
        explain: 'Contact area follows **A = W/p**: the ground pressure tracks the tyre pressure, so doubling the pressure at the same load roughly halves the footprint, and flotation and traction drop.',
      },
    },
    {
      title: 'Correct pressure',
      body: 'At the guide pressure the whole tread contacts the ground without excessive flexing. Front tyres run higher: **1.7 bar** field, **2.1** road, **2.7** loader work. Check cold, weekly, with a gauge — not your foot!',
      camera: cam,
      cut: 'quarter',
      select: null,
      params: { pressure: 0.8 },
      cites: [TTS('p14')],
    },
  ],
}

export default scene
