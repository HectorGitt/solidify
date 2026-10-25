import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { Cool3D } from './Cool3D'
import { prepareCoolingGeometry } from './geometry'
import { CAP, DEFAULTS, ENG, FIRING, PUMP, RAD, THERMO, useCool, type CoolParams } from './model'
import { CoolPanel } from './Panel'

const scene: SceneDef = {
  id: 'cooling',
  title: 'Cooling system',
  summary:
    'A liquid-cooled tractor diesel with its radiator, pump, fan, thermostat, bypass and pressure cap — run it from cold and watch the thermostat open — plus thermosiphon circulation and an air-cooled engine with a flywheel fan. Includes the classic faults.',
  Viewport: Cool3D,
  Panel: CoolPanel,
  camera: { position: [1.26, 0.68, 1.11], target: [0, 0.22, 0.02] },
  extent: 0.8,
  floorY: -0.215,
  hatchScale: 0.0055,
  timeScale: 1 / 20,
  cutPresets: [
    { id: 'half', label: 'Half section (centre line)', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'transverse', label: 'Transverse, middle cylinder', planes: [{ normal: [0, 0, 1], pos: -0.12 }] },
    { id: 'plan', label: 'Plan section through the jacket', planes: [{ normal: [0, 1, 0], pos: 0.22 }] },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [1, 0, 0], pos: 0 }, { normal: [0, 1, 0], pos: 0.22 }], intersection: true },
    { id: 'all-moving', label: 'Section everything', planes: [{ normal: [1, 0, 0], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [SRC.tb509('Ch 7, Figs 7.1–7.4'), SRC.l4_509('cooling system; 60–93 °C'), SRC.supp509('cooling; heat balance 40/30/30'), SRC.exam509('thermosiphon — all four papers')],
  reset: () => useCool.getState().reset(),
  prepare: () => Promise.all([prepareCoolingGeometry(), import('@/machines/engine.geometry').then((m) => m.prepareEngine(FIRING))]),
  applyParams: (p) => {
    const { coldStart, ...rest } = p
    const s = useCool.getState()
    s.set(rest as Partial<CoolParams>)
    if (coldStart) s.coldStart()
  },
  tour: [
    {
      title: 'Why an engine needs cooling',
      body:
        'Combustion gas reaches about **1600 °C**. Roughly **30 %** of the fuel energy must be carried away by the cooling system, keeping the coolant at a working temperature of **60–93 °C**. This tractor diesel is cut down its centre line.',
      camera: { position: [1.26, 0.68, 1.11], target: [0, 0.22, 0.02] },
      cut: 'half',
      select: null,
      explode: 0,
      playing: true,
      timeScale: 1 / 20,
      params: { ...DEFAULTS, coldStart: true },
      cites: [SRC.l4_509('cooling'), SRC.supp509('heat balance')],
    },
    {
      title: '1 · Water jacket',
      body: 'The **water jacket** surrounds every cylinder liner, and passages in the head connect to it through holes in the gasket face. Coolant takes heat from the cylinder walls; its colour here shows its temperature.',
      camera: { position: [0.77, 0.53, -0.3], target: [0, 0.25, -0.12] },
      select: 'coolant',
      cut: 'transverse',
      cites: [SRC.tb509('Ch 7'), SRC.l4_509('cylinder block, water jacket')],
    },
    {
      title: '2 · Thermostat and bypass',
      body:
        'From cold the **thermostat** is shut. Coolant leaving the head goes back to the pump through the **bypass**, so the engine warms up quickly and evenly. Watch the wax element push the valve open as the coolant passes ≈ 80 °C.',
      camera: { position: [0.32, 0.6, 0.35], target: [THERMO.x, ENG.headTop + 0.02, THERMO.z] },
      select: 'thermostat',
      cut: 'half',
      cites: [SRC.tb509('Fig 7.3 — thermostat and bypass')],
      check: {
        question: 'The engine has just started from cold. Where does the coolant leaving the head go until it reaches about 80 °C?',
        options: ['Through the radiator, at reduced flow', 'Back to the pump through the bypass', 'Out through the overflow pipe'],
        answer: 1,
        explain: 'The shut **thermostat** blocks the way to the radiator, so the pump circulates coolant round the engine through the **bypass**. No heat is thrown away, and the engine warms up quickly and evenly.',
      },
    },
    {
      title: '3 · Pump, fan and belt',
      body: 'The **fan belt** drives the **water pump** and **fan** from the crankshaft pulley. The pump forces coolant into the block; the fan pulls air through the radiator even when the tractor stands still.',
      camera: { position: [0.55, 0.2, 0.45], target: [0, PUMP.y - 0.05, 0.14] },
      select: 'fan-drive',
      cites: [SRC.tb509('Fig 7.3')],
    },
    {
      title: '4 · Radiator and pressure cap',
      body:
        'Hot coolant enters the **header tank**, falls through the finned **tubes** and collects in the **bottom tank**. The **pressure cap** keeps the system under pressure, raising the boiling point to ≈ 119 °C at 0.9 bar.',
      camera: { position: [0.6, 0.65, 0.85], target: [0, (RAD.y0 + RAD.y1) / 2, 0.3] },
      select: 'radiator',
      cites: [SRC.tb509('Fig 7.4 radiator, pressure cap')],
      check: {
        question: 'If the pressure-cap seal failed and the system ran at atmospheric pressure, what would happen?',
        options: ['The coolant would boil at a higher temperature', 'Nothing; the cap only stops coolant splashing out', 'The coolant would boil at about 100 °C, not ≈ 119 °C'],
        answer: 2,
        explain: 'Boiling point rises with pressure: the cap holds 0.9 bar and lifts it to ≈ 119 °C. Without that pressure the coolant **boils at about 100 °C**, much closer to its working temperature.',
      },
    },
    {
      title: 'Thermosiphon circulation',
      body:
        'Take the pump away. Water heated in the jacket becomes lighter and **rises** to the top of the radiator; cooled water is heavier and **sinks** to the bottom and back into the block. The flow is slower, so the temperature difference across the radiator is larger.',
      camera: { position: [1.26, 0.6, 0.8], target: [0, 0.25, 0.1] },
      select: 'hoses',
      params: { mode: 'thermosiphon', load: 0.5, rpm: 1600, coldStart: true },
      cites: [SRC.tb509('Ch 7 thermosiphon'), SRC.exam509('thermosiphon principle')],
    },
    {
      title: 'Faults: a stuck thermostat',
      body: 'With the thermostat **stuck shut**, almost nothing reaches the radiator. The coolant climbs until it boils at the cap pressure and steam escapes through the overflow. Scale and a slack fan belt cause overheating too.',
      camera: { position: [0.55, 0.7, 0.75], target: [CAP.x, CAP.y - 0.05, CAP.z] },
      select: 'pressure-cap',
      params: { mode: 'forced', load: 0.8, rpm: 2000, thermostat: 'stuck-shut', thermalSpeed: 40, coldStart: true },
      cites: [SRC.tb509('Ch 7 faults'), SRC.l4_509('care of the cooling system')],
      check: {
        question: 'With the thermostat stuck shut on a working engine, what would you find?',
        options: ['A hot engine but a cool radiator', 'A cool engine but a hot radiator', 'A slow warm-up but normal running'],
        answer: 0,
        explain: 'Almost no coolant reaches the **radiator**, so it stays cool while heat builds up in the jacket. A slow warm-up is the sign of a thermostat stuck open.',
      },
    },
    {
      title: 'Air cooling',
      body:
        'Small engines are often **air-cooled**: fins on the cylinder and head give a large surface, a **cowling** ducts the air, and fan blades cast on the **flywheel** blow it over the fins. No water, pump, radiator or hoses.',
      camera: { position: [0.85, 0.56, 0.84], target: [-0.03, 0.18, 0] },
      select: 'fins',
      cut: 'half',
      params: { ...DEFAULTS, mode: 'air', load: 0.4, rpm: 2200, coldStart: true },
      cites: [SRC.tb509('Fig 7.1')],
    },
  ],
}

export default scene
