import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { Lab3D } from './Lab3D'
import { DEFAULTS, useLab } from './model'
import { LabPanel } from './Panel'

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
    },
    {
      title: 'Too much pull',
      body:
        'Ask for more net traction than the soil can give and the wheels **spin**: slip runs to 100 % and nothing useful is done. Adding ballast raises the traction limit — at the cost of more rolling resistance.',
      params: { soil: 'soft', pull: 14 },
      cites: [SRC.mech502('p7, p10'), SRC.l27('p40–44')],
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
