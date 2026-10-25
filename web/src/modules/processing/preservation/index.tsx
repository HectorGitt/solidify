import type { SceneDef } from '@/modules/types'
import { P536 } from './cites'
import { DEFAULTS, usePreservation } from './model'
import { EXAM_PRESETS, PRESETS, PreservationPanel } from './Panel'
import { Preservation3D } from './Scene3D'

type V3 = [number, number, number]
const overview = { position: [0.6, 6.2, 11] as V3, target: [0.4, 0.8, 0.8] as V3 }

const scene: SceneDef = {
  id: 'preservation',
  title: 'Preservation & storage',
  summary:
    'A preservation hall: steam or hot-water blancher, a horizontal retort with live D, z and F₀ lethality, a cold store and air-blast freezer with product load and Plank freezing time, a yam barn, a grain silo and hermetic triple bags, and a packaging bench.',
  Viewport: Preservation3D,
  Panel: PreservationPanel,
  camera: overview,
  extent: 12,
  floorY: 0,
  hatchScale: 0.06,
  timeScale: 1 / 2,
  cutPresets: [
    { id: 'half', label: 'Half section (all machines)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'retort', label: 'Retort cut open', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: -2.4 }, { normal: [-1, 0, 0], pos: 0 }], intersection: true },
    { id: 'coldstore', label: 'Cold store cut open', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: 0.2 }, { normal: [-1, 0, 0], pos: -2.9 }], intersection: true },
    { id: 'plan', label: 'Plan section at 1 m', planes: [{ normal: [0, 1, 0], pos: 1 }] },
  ],
  defaultPreset: 'half',
  cites: [P536.n536('§3B blanching, thermal destruction; §3C refrigeration and freezing; yam and grain storage'), P536.pack('functions and materials')],
  reset: () => usePreservation.getState().reset(),
  applyParams: (p) => {
    const id = p.preset as string | undefined
    const pr = id ? [...PRESETS, ...EXAM_PRESETS].find((x) => x.id === id) : undefined
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) usePreservation.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'Preserving food',
      body:
        'Spoilage is slowed by **hurdles**: heat (blanching, pasteurising, sterilising), cold (chilling to 16 → −2.2 °C, frozen storage at ≤ −18 °C), drying, preservatives and good **packaging** and **storage**. This hall puts each one side by side.',
      camera: overview,
      cut: 'half',
      select: null,
      explode: 0,
      playing: true,
      params: { apparatus: 'all' },
      cites: [P536.n536('§2 Intro, §3 Methods')],
    },
    {
      title: 'The blancher',
      body:
        'Vegetables ride a belt through **saturated steam** (or a hot-water bath) at **70–100 °C for about 2–3 min**. Blanching inactivates enzymes before freezing or drying. Steam leaches less and gives less effluent; water is cheaper and more energy-efficient.',
      camera: { position: [-3.6, 2.6, 4.2], target: [-3.6, 0.9, 0] },
      cut: 'half',
      select: 'blancher-assembly',
      params: { apparatus: 'all' },
      cites: [P536.n536('§3B Blanching')],
      check: {
        question: 'A batch of vegetables is frozen without blanching. What happens to it over months in frozen storage?',
        options: ['Microbes multiply quickly in the cold', 'Enzymes slowly spoil colour and flavour', 'Nothing, since freezing stops all change'],
        answer: 1,
        explain: 'Freezing slows but does not stop **enzymes**, so unblanched produce slowly loses colour, flavour and texture. Blanching at 70–100 °C inactivates them first.',
      },
    },
    {
      title: 'Retort: D, z and the cold point',
      body:
        'Spores die in a **logarithmic order**: t = D·log(N₀/N), D = 2.303/k. The **z-value** is the temperature rise that cuts D tenfold. The slowest-heating **cold point** in each can must reach and hold the process temperature; for *C. botulinum* a **12D** process at 121.1 °C (D = 0.21 min) gives F₀ ≈ 2.5 min.',
      camera: { position: [-1.2, 2.4, 3.6], target: [-1.2, 0.9, 0] },
      cut: 'retort',
      select: 'retort-basket',
      params: { preset: 'retort-12d' },
      cites: [P536.n536('Principles of thermal destruction, eqs 1.1–1.7; Sterilisation')],
      check: {
        question: 'The retort runs at 111.1 °C instead of 121.1 °C, with z = 10 °C. How long must the 12D cook now hold?',
        options: ['About 2.5 min, the same', 'About 5 min, double', 'About 25 min, ten times'],
        answer: 2,
        explain: 'Dropping one **z-value** (10 °C) makes D ten times longer, 0.21 → 2.1 min, so 12D takes 12 × 2.1 ≈ **25 min**.',
        reveal: { params: { preset: 'retort-12d', retortTempC: 111.1 } },
      },
    },
    {
      title: 'Cold store and freezing time',
      body:
        'Product load H = m[C_a ΔT_a + h_l + C_b ΔT_b]: 90 t/day of meat from 2 to −12 °C needs **263 kW** (≈ 75 TR, 1 TR = 3.516 kW). Plank’s equation gives a 7 cm sphere in −15 °C blast air **2.04 h** to freeze.',
      camera: { position: [1.5, 2.8, 4.4], target: [1.5, 1, 0] },
      cut: 'coldstore',
      select: 'coldstore-room',
      params: { preset: 'cooling-meat-90t' },
      cites: [P536.n536('Refrigeration load eq (1); Plank eq (2)')],
      check: {
        question: 'Of the 263 kW needed to take the meat from 2 °C to −12 °C, which part takes most of it?',
        options: ['Freezing the water: the latent heat', 'Chilling from 2 °C down to freezing', 'Cooling the frozen meat to −12 °C'],
        answer: 0,
        explain: 'Per kg: 3.2 × 3 = 9.6 kJ above freezing, **h_l = 225 kJ** latent, and 1.63 × 11 ≈ 18 kJ below. The **latent heat** is nearly 90 % of the load.',
      },
    },
    {
      title: 'Yam barn, silo and packaging',
      body:
        'The **yam barn**: poles about 3 m high, 50 cm apart, tubers tied on one rope per pole under a palm-frond shade. Grain keeps in **silos** and **hermetic triple bags** at safe moisture. Packaging contains, protects and informs: cans, jars, pouches and sewn sacks.',
      camera: { position: [3.2, 4, 7.5], target: [3, 1.2, 1] },
      cut: false,
      select: 'storage-assembly',
      params: { preset: 'yam-barn-traditional' },
      cites: [P536.n536('Yam Storage; Useful Notes – grain storage'), P536.pack('materials')],
    },
  ],
}

export default scene
