import type { SceneDef } from '@/modules/types'
import { A503 } from '../_shared/cites'
import { DEFAULTS, useBelts } from './model'
import { BeltsPanel, PRESETS } from './Panel'
import { Belts3D, FLOOR } from './Scene3D'

const scene: SceneDef = {
  id: 'belts',
  title: 'Belt drives',
  summary:
    'Open, crossed, idler and multiple V-belt drives with live wrap angles, tight- and slack-side tensions, centrifugal tension, creep, and both design routes: by calculation and from a manufacturer’s catalogue.',
  Viewport: Belts3D,
  Panel: BeltsPanel,
  camera: { position: [0.35, 0.45, 2.35], target: [0, -0.15, 0] },
  extent: 2.4,
  floorY: FLOOR,
  hatchScale: 0.012,
  timeScale: 1 / 4,
  cutPresets: [
    { id: 'quarter', label: 'Driven pulley cut open', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: 0 }], intersection: true },
    { id: 'half', label: 'Half section (belt plane)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'plan', label: 'Plan section through the shafts', planes: [{ normal: [0, 1, 0], pos: 0 }] },
    { id: 'span', label: 'Across the spans', planes: [{ normal: [1, 0, 0], pos: 0 }] },
  ],
  defaultPreset: 'quarter',
  cites: [A503.m(4, 'selection of belts by calculation'), A503.m(2, 'selection from the Fenner catalogue'), A503.table('Tables 2–6'), A503.mg15('Q2c'), A503.mg19('Q2c, Q3a')],
  reset: () => useBelts.getState().reset(),
  applyParams: (p) => {
    const id = p.preset as string | undefined
    const pr = id ? PRESETS.find((x) => x.id === id) : undefined
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) useBelts.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'A belt drive',
      body:
        'A **driver pulley** on the motor pulls an endless belt; friction between belt and pulley turns the **driven pulley**. Belts are cheap, quiet, need no lubrication and can span long centres — but they **slip and stretch**.\n\nShown here: a crossed leather belt, 250 → 500 mm pulleys, 1.25 m apart, 7.5 kW at 1000 rpm.',
      camera: { position: [0.35, 0.45, 2.35], target: [0, -0.15, 0] },
      cut: false,
      select: null,
      explode: 0,
      playing: true,
      params: { preset: 'crossed' },
      cites: [A503.m(1, 'Fig 1'), A503.mg15('Q1')],
    },
    {
      title: 'Angle of wrap',
      body:
        'Crossing the belt makes the pulleys turn in **opposite** directions and wraps more of each pulley: α₁ = α₂ = 180° + 2 sin⁻¹((R + r)/C) = **214.9°** here.\n\nAn open belt wraps the small pulley less: α₁ = 180° − 2β with sin β = (R − r)/C.',
      camera: { position: [-0.55, 0.25, 1.2], target: [-0.6, 0, 0] },
      select: 'belt',
      params: { preset: 'crossed' },
      cites: [A503.m(4, 'slides 9–12')],
      check: {
        question: 'Keep the same 250 and 500 mm pulleys 1.25 m apart, but run the belt open instead of crossed. What happens to the wrap on the small pulley?',
        options: ['It falls below 180°', 'It stays at 214.9°', 'It rises above 214.9°'],
        answer: 0,
        explain: 'An open belt wraps the small pulley **α₁ = 180° − 2β**, with sin β = (250 − 125)/1250 mm = 0.1, so α₁ ≈ **168.5°**: less grip than the crossed belt’s 214.9°.',
        reveal: { select: 'belt', params: { preset: 'crossed', layout: 'open' } },
      },
    },
    {
      title: 'Tight side, slack side and creep',
      body:
        'The driver pulls the belt in on the **tight side** (T₁) and lets it out on the **slack side** (T₂). Power P = (T₁ − T₂)v.\n\nThe white marks are evenly spaced on the unstretched belt: they **spread apart** on the tight side and **close up** on the slack side. The belt creeps back over the **active arc** where its tension changes by e^(fα) — the creep is exaggerated here.',
      camera: { position: [0.1, 0.35, 1.5], target: [0, 0, 0] },
      select: 'markers',
      params: { preset: 'fan', creep: 0.06 },
      cites: [A503.m(4, 'slides 2–8')],
      check: {
        question: 'T₁ and T₂ stay the same, but the belt now runs twice as fast. What happens to the power it transmits?',
        options: ['It stays the same', 'It halves', 'It doubles'],
        answer: 2,
        explain: 'Power is the net pull times belt speed, **P = (T₁ − T₂)v**: the same tension difference at twice the speed carries twice the power.',
      },
    },
    {
      title: 'V-belts: the wedge',
      body:
        'A V-belt wedges into its groove, so the normal force — and the friction — is multiplied by 1/sin(θ/2). With a 36° groove the ratio becomes e^(fα/sin 18°) = **4.86** instead of e^(fα) = 1.63.\n\nThe plan section shows the trapezoidal belts sitting in the grooves.',
      camera: { position: [0.95, 0.75, 0.8], target: [0.45, 0, 0] },
      cut: 'plan',
      select: 'driven',
      params: { preset: 'vbelts' },
      cites: [A503.m(4, 'slides 5–8'), A503.mg19('Q3a')],
      check: {
        question: 'With the same friction and wrap, the groove angle is made narrower than 36°. What happens to the tension ratio the belt can hold?',
        options: ['It falls', 'It rises', 'It stays at 4.86'],
        answer: 1,
        explain: 'The wedge multiplies the normal force by **1/sin(θ/2)**; a smaller θ makes sin(θ/2) smaller, so the friction and the ratio e^(fα/sin(θ/2)) both rise.',
      },
    },
    {
      title: 'Several belts on one sheave',
      body:
        'Each V-belt carries P = (T₁ − T₂)v. With T₁ = 900 N, m = 0.523 kg/m and v = 15.05 m/s the centrifugal tension mv² = 118 N must be kept on **both** sides: T₂ = 279 N and 9.34 kW per belt → 26/9.34 = 2.78 → **3 belts**.',
      camera: { position: [0.6, 0.5, 1.1], target: [0, -0.05, 0] },
      cut: 'quarter',
      select: 'belt',
      params: { preset: 'vbelts' },
      cites: [A503.mg19('Q3a')],
    },
    {
      title: 'The idler pulley',
      body:
        'An **idler** on the slack side pushes the belt in and increases the wrap on both pulleys. In the compressor drive the wraps are 220° and 270°; the **smaller** e^(fα) — here the motor pulley’s 3.16 — governs, giving P = 43.6 kW.',
      camera: { position: [0.2, 0.2, 3.6], target: [0, -0.2, 0] },
      cut: false,
      select: 'idler',
      params: { preset: 'compressor' },
      cites: [A503.mg16('Q2b'), A503.m(4, 'slide 8')],
    },
    {
      title: 'Choosing V-belts from the catalogue',
      body:
        'The catalogue route: service factor → design power → section → pulley sizes → length L = 2C + 1.57(D + d) + (D − d)²/4C → length and arc factors → power per belt → number of belts.\n\nThe palm-fruit digester: 3 kW at 1500 rpm down to 300 rpm, then a 12 : 1 worm box to 25 rpm — **3 A-section belts**. See the Controls tab for every step.',
      camera: { position: [0.25, 0.3, 1.0], target: [0, -0.05, 0] },
      cut: 'quarter',
      select: null,
      params: { preset: 'digester' },
      cites: [A503.mg17('Q2a'), A503.mg21('Q2'), A503.table('Tables 3–6')],
    },
  ],
}

export default scene
