import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { Lab3D } from './Lab3D'
import { clamp, cleanContext, roundTo, soilFromCI } from '@/content/context'
import { DEFAULTS, SOILS, solve, useLab } from './model'
import { LabPanel } from './Panel'
import { pickParams } from '@/content/compare'
import type { LabParams } from './model'

type V = [number, number, number]
const view = { position: [1.2, 3.0, 9.0] as V, target: [-0.6, 0.7, 0] as V }
const wheelView = { position: [0.5, 0.9, 2.8] as V, target: [0.05, 0.55, 0] as V }

const scene: SceneDef = {
  id: 'traction-lab',
  title: 'Traction lab',
  summary:
    'The Farmland tractor on a drawbar test against a dynamometer car. Set the pull, gear, soil and ballast: the wheels turn faster than the tractor travels (slip), the lug prints close up, and the panel gives the speed–pull chart for each gear, tractive and overall efficiency, the Brixius predictions of slip and motion resistance from the soil, and the ballast numbers of Zoz & Grisso.',
  Viewport: Lab3D,
  Panel: LabPanel,
  camera: view,
  follow: 'tractor',
  extent: 9,
  floorY: -0.4,
  hatchScale: 0.05,
  timeScale: 1 / 2,
  cutPresets: [
    { id: 'centre', label: 'Centre-line section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'plan', label: 'Plan at hub height', planes: [{ normal: [0, 1, 0], pos: 0.7 }] },
  ],
  cites: [SRC.mech502('eqs 2.1–2.15, Fig 2.2'), SRC.l27('eqs 1–27, Tables 2 and 5'), SRC.tests502('drawbar tests'), SRC.mac502('eq 6.5, App. II')],
  reset: () => useLab.getState().reset(),
  context: () => {
    const p = useLab.getState()
    const s = solve(p)
    return cleanContext({ rpm: s.op.rpm, slip: s.i, pullKN: p.pull, wheelLoadKN: s.Vr / 2 / 1000, speedKmh: s.op.V * 3.6, CI: SOILS[p.soil].CI / 1000, tyre: p.tyre })
  },
  fromContext: (c) => ({
    ...(c.pullKN !== undefined ? { pull: roundTo(clamp(c.pullKN, 0.5, 40), 0.25) } : {}),
    ...(c.CI !== undefined ? { soil: soilFromCI(c.CI) } : {}),
    ...(c.tyre ? { tyre: c.tyre } : {}),
  }),
  compare: {
    title: 'bias vs radial tyres, with and without ballast',
    current: () => pickParams(DEFAULTS, useLab.getState()),
    variants: [
      { label: 'Bias', params: { tyre: 'bias', ballast: 0 } },
      { label: 'Radial', params: { tyre: 'radial', ballast: 0 } },
      { label: 'Radial + 600 kg', params: { tyre: 'radial', ballast: 600 } },
    ],
    metrics: (p) => {
      const s = solve(p as unknown as LabParams)
      const dead = s.spin || s.stalled
      const t = s.spin ? 'spins' : s.stalled ? 'stalls' : undefined
      return [
        { label: 'Wheel slip', value: s.i * 100, unit: '%', digits: 1, better: 'low', text: s.spin ? 'spins' : undefined },
        { label: 'Speed', value: dead ? 0 : s.op.V * 3.6, unit: 'km/h', digits: 2, better: 'high', text: t },
        { label: 'Motion resistance', value: s.R / 1000, unit: 'kN', digits: 2, better: 'low' },
        { label: 'Tractive efficiency', value: dead ? 0 : s.op.etaT * 100, unit: '%', digits: 0, better: 'high', text: t },
        { label: 'Drawbar power', value: dead ? 0 : s.op.Qd / 1000, unit: 'kW', digits: 1, better: 'high', text: t },
      ]
    },
  },
  applyParams: (p) => useLab.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'A drawbar test',
      body:
        'The Farmland tractor pulls a braked **dynamometer car**. A load cell measures the drawbar pull **P**; speed is timed over a distance and wheel revolutions are counted. The orange arrow is P, green is the wheel force **H**, violet the rolling resistance **R**.',
      camera: view,
      cut: false,
      select: 'load-car',
      playing: true,
      params: { ...DEFAULTS },
      cites: [SRC.tests502('dynamometer car'), SRC.mech502('p8')],
    },
    {
      title: 'The ideal tractor',
      body:
        'With no slip and no rolling resistance the speed is set only by engine speed and gear, V₀ = πD·Ne/q, and the pull by engine torque, P = 2q·Te/D. All the engine power reaches the drawbar.',
      params: { ideal: true, pull: 12 },
      cites: [SRC.mech502('p1–3, eqs 2.1–2.4')],
    },
    {
      title: 'Wheelslip',
      body:
        'On real soil the tyre deforms the ground: the wheel turns further than it travels. **i = (V₀ − V)/V₀**. Watch the lug prints close up behind the wheels and the tag over the tractor; the wheel needs H = P + R.',
      camera: { position: [-1.5, 1.6, 4.2], target: [-1.0, 0.4, 0.7] },
      select: 'ruts',
      params: { ideal: false, pull: 14 },
      cites: [SRC.mech502('p6–7, eqs 2.5–2.8'), SRC.l27('eq 3')],
      check: {
        question: 'With no slip the wheels would carry the tractor 10 m, but it actually travels 8.8 m. What is the wheel slip?',
        options: ['8.8 %', '12 %', '88 %'],
        answer: 1,
        explain: 'i = (V₀ − V)/V₀ = (10 − 8.8)/10 = **0.12**, or 12 %: the wheel turns further than the tractor travels.',
      },
    },
    {
      title: 'One wheel as a free body',
      body:
        'On soft soil the soil reaction acts ahead of the axle by **eh = slr·MR/Wd**. The torque gives the gross traction **GT**; motion resistance **MR** is lost, leaving the net traction **NT = GT − MR**.',
      camera: wheelView,
      select: 'fbd-wheel',
      params: { view: 'wheel' },
      cites: [SRC.l27('p6–7, eqs 1–2, Figs 1–3')],
    },
    {
      title: 'Predicting slip: the Brixius equations',
      body:
        'The **mobility number** Bn combines the cone index of the soil with the tyre’s width, diameter, deflection and load. From it the Brixius equations give GTR and MRR at any slip — solved iteratively for the slip that delivers the pull. Soft soil: lower Bn, more slip, more motion resistance.',
      camera: view,
      select: null,
      params: { view: 'tractor', soil: 'soft', pull: 12 },
      cites: [SRC.l27('p31–32, eqs 14–16, Table 2')],
      check: {
        question: 'Switching from tilled to soft soil at the same 12 kN pull lowers the mobility number Bn. What happens?',
        options: ['Slip rises and motion resistance falls', 'Slip and motion resistance both rise', 'Slip and motion resistance both fall'],
        answer: 1,
        explain: 'A lower **Bn** means a weaker soil for this tyre: the Brixius equations give less gross traction and more motion resistance at any slip, so more slip is needed to deliver the same pull.',
      },
    },
    {
      title: 'Too much pull',
      body:
        'Ask for more net traction than the soil can give and the wheels **spin**: slip runs to 100 % and nothing useful is done. Adding ballast raises the traction limit — at the cost of more rolling resistance.',
      params: { soil: 'soft', pull: 14 },
      cites: [SRC.mech502('p7, p10'), SRC.l27('p40–44')],
      check: {
        question: 'The wheels spin at a 14 kN pull on soft soil. Which change would let the tractor carry this pull?',
        options: ['Shift to a lower gear', 'Raise the engine speed', 'Add weight to the rear wheels'],
        answer: 2,
        explain: 'Spinning means the tyres have reached their **traction limit**, which rises with the weight on them. A lower gear or more engine speed only gives torque the wheels already cannot use.',
      },
    },
    {
      title: 'Ballast cures it',
      body: 'With 600 kg on the rear wheels the same pull is carried at a working slip. The rear wheel weights appear on the hubs.',
      camera: { position: [2.4, 1.6, 4.6], target: [0.2, 0.6, 0.5] },
      select: 'rear-ballast',
      params: { soil: 'soft', pull: 14, ballast: 600 },
      cites: [SRC.l27('p40–44 ballast numbers')],
    },
    {
      title: 'The speed–pull chart',
      body:
        'Open **Controls**: the speed–pull chart shows each gear’s ideal and actual speed against pull, under the constant-power hyperbola. The Working steps through slip, H, losses and ηt = (P/(P + R))(1 − i) with numbers.',
      camera: view,
      select: null,
      params: { ...DEFAULTS },
      cites: [SRC.mech502('p4–5, Fig 2.2'), SRC.mech502('p8–9, eqs 2.9–2.14')],
    },
  ],
}

export default scene
