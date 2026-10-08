import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { Carb3D } from './Carb3D'
import { prepareCarbGeometry } from './geometry'
import { DEFAULTS, useCarb } from './model'
import { CarbPanel } from './Panel'

const overview = { position: [0.05, 0.42, 1.25] as [number, number, number], target: [-0.02, 0.2, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'carburettor',
  title: 'Carburettor (SI fuel system)',
  summary:
    'The petrol fuel system of a spark-ignition tractor engine: vented tank, sediment bowl, a diaphragm lift pump worked by the camshaft eccentric, and a downdraught carburettor with float and needle valve, venturi and main jet, idle circuit, choke and throttle.',
  Viewport: Carb3D,
  Panel: CarbPanel,
  camera: overview,
  extent: 1.25,
  floorY: -0.11,
  hatchScale: 0.0025,
  timeScale: 1 / 20,
  cutPresets: [
    { id: 'half', label: 'Half section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'carb-only', label: 'Section pump & carburettor', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: -0.12 }], intersection: true },
    { id: 'all-moving', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [SRC.tb509('§4.4, Figs 4.1, 4.5–4.7'), SRC.supp509('SI fuel system, carburettor')],
  reset: () => useCarb.getState().reset(),
  prepare: prepareCarbGeometry,
  applyParams: (p) => useCarb.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Petrol fuel system',
      body:
        'Fuel runs from the **tank** (vented cap) through the **sediment bowl** to the **diaphragm lift pump**, which feeds the **carburettor**. The carburettor mixes it with air — about **1 part fuel to 15 parts air by weight** — and the mixture goes down the inlet manifold to the engine.',
      camera: overview,
      cut: 'half',
      select: null,
      explode: 0,
      playing: true,
      timeScale: 1 / 20,
      params: { ...DEFAULTS },
      cites: [SRC.tb509('Fig 4.1, §4.4.3')],
    },
    {
      title: 'Diaphragm lift pump',
      body:
        'The **eccentric** on the camshaft rocks the **rocker arm**, which pulls the **diaphragm** down — fuel is sucked in past the inlet valve. The **spring** then pushes the diaphragm up and fuel leaves through the outlet valve. When the float chamber is full the diaphragm stays down and the rocker just idles.',
      camera: { position: [0.07, 0.12, 0.3], target: [-0.03, 0.06, 0] },
      select: 'lift-pump',
      cites: [SRC.tb509('Fig 4.6')],
    },
    {
      title: 'Float and needle valve',
      body:
        'The **float** rides on the fuel. As the level rises it pushes the **needle** onto its seat and shuts off the supply, holding the fuel just below the top of the jet. Press **Empty the float chamber** in the Controls panel and watch it refill.',
      camera: { position: [0.3, 0.2, 0.25], target: [0.235, 0.145, 0] },
      select: 'float',
      timeScale: 1 / 10,
      cites: [SRC.tb509('Fig 4.7')],
    },
    {
      title: 'Venturi and main jet',
      body:
        'Air speeds up through the narrow **venturi**, so its pressure drops. The float chamber is vented to the atmosphere, so fuel is pushed up the **main jet** and sprays from the **nozzle** into the air stream. (The Bernoulli numbers in the Controls panel use typical dimensions.)',
      camera: { position: [0.42, 0.22, 0.38], target: [0.27, 0.14, 0] },
      select: 'carb-body',
      timeScale: 1 / 20,
      cites: [SRC.tb509('§4.4.3 venturi')],
    },
    {
      title: 'Throttle and idle circuit',
      body: 'The **throttle butterfly** below the venturi controls how much mixture reaches the engine — and so its power. Almost closed, the venturi is too slow to lift fuel and the **idle jet** below the butterfly takes over.',
      camera: { position: [0.42, 0.1, 0.3], target: [0.29, 0.085, 0] },
      select: 'throttle',
      params: { rpm: 700, throttle: 0.04, choke: 0 },
      cites: [SRC.tb509('Fig 4.7 throttle')],
    },
    {
      title: 'Choke for cold starting',
      body: 'Closing the **choke** starves the engine of air and adds strong suction at the jet: a very **rich** mixture for a cold start. Left on when warm it wastes fuel and fouls the plugs.',
      camera: { position: [0.42, 0.26, 0.3], target: [0.29, 0.2, 0] },
      select: 'choke',
      params: { rpm: 200, throttle: 0.1, choke: 1 },
      cites: [SRC.tb509('Fig 4.7 choke')],
    },
    {
      title: 'Rich and lean',
      body: 'More fuel than 1 : 15 is **rich**, less is **lean**. Open the Controls panel and move the throttle, choke and float level to see the A/F ratio change on the chart.',
      camera: overview,
      select: null,
      params: { ...DEFAULTS },
      cites: [SRC.tb509('§4.4.3'), SRC.misc509('p3 A/F 12–18')],
    },
  ],
}

export default scene
