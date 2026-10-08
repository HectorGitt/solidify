import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { Fuel3D } from './Fuel3D'
import { prepareFuelGeometry } from './geometry'
import { DEFAULTS, ELEMENT_X, INJ_Y, LAYOUT, RACK_MAX, useFuel } from './model'
import { FuelPanel } from './Panel'

const pumpCam = { position: [0.2, 0.2, 0.33] as [number, number, number], target: [0.03, 0.11, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'diesel-fuel',
  title: 'Diesel fuel system & injector',
  summary:
    'Tank to injector for a four-cylinder tractor diesel: sediment bowl, eccentric-driven lift pump with primer, primary and secondary filters with the overflow valve, a helix-metered in-line injection pump and a multi-hole injector — with the rack, bleeding and opening pressure under your control.',
  Viewport: Fuel3D,
  Panel: FuelPanel,
  camera: { position: [0.1, 0.75, 1.85], target: [-0.05, 0.3, 0] },
  extent: 1.8,
  floorY: -0.04,
  hatchScale: 0.003,
  timeScale: 1 / 50,
  cutPresets: [
    { id: 'half', label: 'Half section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'pump-side', label: 'Section pump & filters only', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: -0.2 }], intersection: true },
    { id: 'all-moving', label: 'Section everything (helix depth)', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [SRC.tb509('§4.5, Figs 4.2, 4.8, 4.9'), SRC.supp509('diesel fuel system, injection pump, injector, bleeding')],
  reset: () => useFuel.getState().reset(),
  prepare: prepareFuelGeometry,
  applyParams: (p) => useFuel.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'The diesel fuel system',
      body:
        'Fuel flows from the **tank** through a **sediment bowl** to the **lift pump**, then through the **primary** and **secondary filters** to the **injection pump**, which sends a metered charge at high pressure to each **injector**. Leak-off and overflow fuel return to the tank.\n\nColours: **yellow** = low pressure, **red** = high pressure, **green** = return.',
      camera: { position: [0.1, 0.75, 1.85], target: [-0.05, 0.3, 0] },
      cut: 'half',
      select: null,
      explode: 0,
      playing: true,
      timeScale: 1 / 50,
      params: { ...DEFAULTS },
      cites: [SRC.tb509('Fig 4.2'), SRC.supp509('fuel system')],
    },
    {
      title: 'Tank and sediment bowl',
      body: 'The **vented cap** lets air in as fuel is used. In the **sediment bowl** the fuel slows down, so water and dirt settle in the glass where you can see them and drain them off.',
      camera: { position: [-0.3, 0.55, 0.75], target: [-0.5, 0.4, 0] },
      select: 'sediment-bowl',
      cites: [SRC.tb509('Fig 4.5')],
    },
    {
      title: 'Lift pump and filters',
      body:
        'An **eccentric** on the pump camshaft works the **lift pump**, which pushes fuel at low pressure through the **primary filter** (coarse dirt and water) and the **secondary filter** (fine). The **overflow valve** on the secondary filter limits the feed pressure and returns surplus fuel to the tank.',
      camera: { position: [0.42, 0.38, 0.6], target: [0.3, 0.18, 0] },
      select: 'secondary-filter',
      cites: [SRC.supp509('filters, overflow valve')],
    },
    {
      title: 'Pumping element: plunger and barrel',
      body:
        'The cam lifts the **plunger**. While its top edge is below the ports, fuel fills the barrel. Once the ports are covered the fuel is trapped and forced out past the **delivery valve** — delivery ends the moment the **helical groove** uncovers the spill port.',
      camera: pumpCam,
      select: 'plungers',
      cut: 'half',
      timeScale: 1 / 100,
      cites: [SRC.tb509('§4.5.3, Fig 4.8')],
    },
    {
      title: 'The rack meters the fuel',
      body:
        'The **control rack** turns every plunger through its **sleeve and pinion**. Turning the plunger brings a taller part of the helix land under the spill port, so the **effective stroke** — and the fuel per stroke — grows. Watch the red part of the lift chart in the Controls panel.',
      camera: { position: [0.05, 0.16, 0.3], target: [-0.01, 0.1, 0] },
      select: 'control-rack',
      cut: 'all-moving',
      params: { rack: RACK_MAX * 0.85 },
      cites: [SRC.tb509('p25 helical groove')],
    },
    {
      title: 'Delivery valve and high-pressure pipe',
      body: 'Each charge travels at **120–300 kg/cm²** along a thick-walled pipe. The **delivery valve** snaps shut at spill so the injector stops sharply without dribbling. The four elements fire 90° of pump cam apart, in firing order 1-3-4-2.',
      camera: { position: [ELEMENT_X[0] + 0.25, 0.32, 0.45], target: [ELEMENT_X[0] + 0.1, 0.22, 0] },
      select: 'delivery-valves',
      cut: 'half',
      params: { rack: DEFAULTS.rack },
      cites: [SRC.supp509('120–300 kg/cm²')],
    },
    {
      title: 'The injector',
      body:
        'Fuel pressure acts on the shoulder of the **needle valve**; when it beats the **spring**, the needle lifts and fuel sprays through the **multi-hole nozzle** as a fine mist. The **pressure-adjusting screw** sets the opening pressure; a little fuel leaks past the needle to lubricate it and returns through the **leak-off**.',
      camera: { position: [LAYOUT.injector.x + 0.12, INJ_Y + 0.09, 0.2], target: [LAYOUT.injector.x, INJ_Y + 0.06, 0] },
      select: 'injector',
      timeScale: 1 / 100,
      cites: [SRC.tb509('Fig 4.9'), SRC.supp509('injector')],
    },
    {
      title: 'Air locks and bleeding',
      body:
        'Air in the lines stops a diesel: the plungers just squeeze the air and the needle never lifts. Press **Run the tank dry**, then **Prime & bleed** in the Controls panel — the primer is worked by hand and air escapes at the **bleed screws**, filters first, then the pump.',
      camera: { position: [0.2, 0.55, 0.95], target: [0.2, 0.2, 0] },
      select: 'bleed-screws',
      timeScale: 1 / 50,
      params: { air: true, bleeding: false },
      cites: [SRC.supp509('bleeding the system')],
    },
  ],
}

export default scene
