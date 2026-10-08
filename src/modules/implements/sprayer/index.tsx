import type { SceneDef } from '@/modules/types'
import { BOOM_WORLD_X, C, DEFAULTS, HX, HY, LAYOUT, NOZZLE_DEMO, live, useSprayer } from './model'
import { SprayerPanel } from './Panel'
import { Scene3D } from './Scene3D'

const view = { position: [-6.2, 3.6, 6.4] as [number, number, number], target: [-1.0, 0.5, 0] as [number, number, number] }
const nozzleView = { position: [NOZZLE_DEMO.x + 0.55, NOZZLE_DEMO.y + 0.25, NOZZLE_DEMO.z + 0.85] as [number, number, number], target: [NOZZLE_DEMO.x, NOZZLE_DEMO.y - 0.05, NOZZLE_DEMO.z] as [number, number, number] }
const plumbing = { position: [HX + 1.3, HY + 1.4, 2.0] as [number, number, number], target: [HX - 0.1, HY + 0.4, 0.15] as [number, number, number] }

const scene: SceneDef = {
  id: 'sprayer',
  title: 'Boom sprayer & nozzles',
  summary:
    'A tractor-mounted boom sprayer working along a crop: PTO-driven piston pump with air chamber, three filters, pressure-relief valve and gauge, section cut-off valves and a 6 m boom of flat-fan or hollow-cone nozzles, with an enlarged nozzle cutaway. Calibrate it with a test run: L = 1000/W, refill × 10.',
  Viewport: Scene3D,
  Panel: SprayerPanel,
  camera: view,
  follow: 'tractor',
  extent: 9,
  floorY: -0.4,
  hatchScale: 0.012,
  timeScale: 1 / 10,
  cutPresets: [
    { id: 'centre', label: 'Centre line (tank, pump, PTO)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'valves', label: 'Through relief valve & gauge', planes: [{ normal: [0, 0, 1], pos: LAYOUT.ctrl.z }] },
    { id: 'strainer', label: 'Through the line strainer', planes: [{ normal: [0, 0, -1], pos: -LAYOUT.strainer.z }] },
    { id: 'nozzle', label: 'Nozzle cutaway (×8)', planes: [{ normal: [0, 0, 1], pos: NOZZLE_DEMO.z }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'centre',
  cites: [C.sprayer('components, Fig 15.4'), C.nozzle('Figs 15.6–15.7'), C.pump('pump types'), C.boom('boom sprayer, Fig 15.9'), C.perf('performance factors'), C.calib('boom calibration'), C.guide1819('Q4(c)–(e)')],
  reset: () => {
    useSprayer.getState().reset()
    live.tank = LAYOUT.tank.capacity
    live.runDist = 0
    live.runUsed = 0
    live.runActive = false
  },
  applyParams: (p) => useSprayer.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'A tractor boom sprayer',
      body:
        'A sprayer needs a **carrier** for the chemical — here water. Its essential parts are a **tank**, a **pump** and **nozzles**; a **relief valve**, **gauge**, **boom**, **cut-off valves** and **filters** are added. The pump runs off the PTO and the boom carries the nozzles at set spacings.',
      camera: view,
      cut: false,
      select: 'sprayer',
      explode: 0,
      playing: true,
      timeScale: 1 / 10,
      params: { ...DEFAULTS, sections: [true, true, true] },
      cites: [C.sprayer('essential and additional components'), C.boom('Fig 15.9')],
    },
    {
      title: 'Pump and air chamber',
      body:
        'Most sprayer pumps are **positive displacement**: this twin-piston pump delivers about 34 L/min at 540 rpm whatever the nozzles take. The **air chamber** levels out the pulses from the reciprocating pistons.',
      camera: { position: [HX + 1.2, HY + 0.7, 1.1], target: [HX + 0.2, HY + 0.15, 0] },
      select: 'pump',
      cut: 'centre',
      cites: [C.pump('piston pumps with air chamber; relief valve')],
    },
    {
      title: 'Relief valve, gauge and section valves',
      body:
        'The **pressure-relief valve** sets and maintains the pressure: its spring holds the poppet shut until the line pressure reaches the setting, then the poppet lifts and the **surplus flow returns to the tank** (yellow), stirring it. The **gauge** sits on the delivery side; three **cut-off valves** feed the boom sections.',
      camera: plumbing,
      select: 'regulator',
      cut: 'valves',
      params: { sections: [true, true, true] },
      cites: [C.sprayer('relief valve, gauge, cut-off device')],
    },
    {
      title: 'Three filters',
      body:
        'Filters sit at the tank filling hole (basket), **before the pump** (this clear-bowl line strainer) and **in each nozzle**. Blocked filters are a major source of sprayer trouble.',
      camera: { position: [HX + 0.9, HY + 0.8, -1.4], target: [HX - 0.2, HY + 0.3, -0.25] },
      select: 'line-strainer',
      cut: 'strainer',
      cites: [C.sprayer('filters'), C.calib('§15.13 maintenance')],
    },
    {
      title: 'Inside a nozzle',
      body:
        'Cap, gasket, orifice disc and **whirl plate** with slanted holes. The whirl plate spins the liquid: **without a centre hole** the spray is a **hollow cone**; with one, a solid cone. The orifice diameter designates the nozzle size.',
      camera: nozzleView,
      select: 'demo-whirl',
      cut: 'nozzle',
      params: { kind: 'hollow-cone' },
      cites: [C.nozzle('parts, whirl plate, patterns')],
    },
    {
      title: 'The flat-fan nozzle',
      body: 'A **fan nozzle has no whirl plate**: the liquid leaves an elliptical orifice as a thin flat sheet — popular on weed sprayers. Neighbouring fans overlap so the boom lays an even band.',
      camera: nozzleView,
      select: 'demo-fan',
      cut: 'nozzle',
      explode: 0.6,
      params: { kind: 'flat-fan' },
      cites: [C.nozzle('fan type')],
    },
    {
      title: 'Pressure, nozzle size and speed',
      body:
        'Performance depends directly on **operating pressure, nozzle size and operating speed**. Flow ∝ √pressure, so pressure is a fine trim only; at a fixed pressure, driving at 8 km/h instead of 4 km/h **halves** the application rate. Sprayed rows turn darker as they pass under the open sections.',
      camera: { position: [-4.5, 2.4, -5.8], target: [BOOM_WORLD_X, 0.3, -0.5] },
      select: 'nozzle-bodies',
      explode: 0,
      cut: false,
      params: { speed: 8 },
      cites: [C.perf('8 km/h instead of 4 km/h cuts the rate by half'), C.nozzle('flow ∝ √p')],
    },
    {
      title: 'Calibrate it',
      body:
        'Open **Controls → Calibration run**. W = nozzles × spacing; for 0.1 ha drive **L = 1000/W**; the litres needed to refill to the mark × 10 = L/ha. For example, 10 nozzles at 200 mm → W = 2 m → **2500 m for 0.5 ha** (pick the 0.5 ha test area).',
      camera: view,
      select: null,
      params: { speed: 6 },
      cites: [C.calib('procedure'), C.guide1819('Q4(e)')],
    },
  ],
}

export default scene
