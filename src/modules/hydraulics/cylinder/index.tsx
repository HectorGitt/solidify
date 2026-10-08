import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { prepareCylinderGeometry } from './geometry'
import { DEFAULTS, MG1617, PORT_ROD_X, useCyl } from './model'
import { CylinderPanel } from './Panel'
import { Cylinder3D } from './Scene3D'

const scene: SceneDef = {
  id: 'cylinder',
  title: 'Double-acting cylinder',
  summary:
    'A double-acting hydraulic ram cut in half: barrel, piston and seals, chromed rod, gland and ports. Oil flow reverses as the valve switches, with live extend/retract forces, speeds, return flow and ram sizing.',
  Viewport: Cylinder3D,
  Panel: CylinderPanel,
  camera: { position: [0.62, 0.36, 0.95], target: [0.36, 0.03, 0] },
  extent: 0.95,
  floorY: -0.085,
  hatchScale: 0.0035,
  timeScale: 1 / 4,
  cutPresets: [
    { id: 'half', label: 'Half section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'plan', label: 'Plan section (through the ports)', planes: [{ normal: [0, 1, 0], pos: 0 }] },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [0, 1, 0], pos: 0 }], intersection: true },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [MG1617('Q(c)–(d) double-acting cylinder'), SRC.top510('p11 ram sizing'), SRC.hy510('p1–2 ram cylinder')],
  reset: () => useCyl.getState().reset(),
  prepare: prepareCylinderGeometry,
  applyParams: (p) => useCyl.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'A double-acting cylinder, cut open',
      body:
        'A hydraulic **cylinder (ram)** turns oil pressure into a straight push or pull. "Double-acting" means oil can be pumped into **either end**, so it is powered both out and in.\n\nThe barrel, end caps and oil are sectioned; the piston and rod are left whole.',
      camera: { position: [0.62, 0.36, 0.95], target: [0.36, 0.03, 0] },
      cut: 'half',
      select: null,
      explode: 0,
      playing: true,
      params: { motion: 'cycle', bore: 0.0762, rod: 0.025, p: 17.2, Q: 68.13, load: 20 },
      cites: [MG1617('Q(c)')],
    },
    {
      title: 'Extending: oil into the cap end',
      body:
        'Oil pumped into the **left port** pushes on the whole piston area A, so F = pA. The oil on the rod side is forced out of the **right port** back to the tank.',
      camera: { position: [0.12, 0.2, 0.42], target: [0.1, 0.02, 0] },
      select: 'cap-oil',
      params: { motion: 'extend' },
      cites: [MG1617('Q(c), Q(d)')],
    },
    {
      title: 'Retracting: the annulus',
      body:
        'Pumped into the **right port**, the oil only acts on the ring (**annulus**) around the rod, A − a. The force is smaller, but the same flow fills the smaller volume faster, so the rod comes in **faster**. More oil also comes out of the cap end than goes in: 76.3 L/min out for 68.13 L/min in, with a 7.62 cm bore and 2.5 cm rod.',
      camera: { position: [0.5, 0.18, 0.45], target: [0.32, 0.01, 0] },
      select: 'rod-oil',
      params: { motion: 'retract' },
      cites: [MG1617('Q(d)')],
    },
    {
      title: 'Piston and seals',
      body:
        'The **piston** divides the barrel into two chambers. Its **seals** stop oil leaking across from the pressure side; a worn seal lets the ram creep down under load. The bronze **wear ring** stops the steel piston touching the bore.',
      camera: { position: [0.2, 0.12, 0.25], target: [0.12, 0, 0] },
      select: 'piston-seals',
      cut: 'all',
      params: { motion: 'hold' },
      cites: [MG1617('Q(c) parts')],
    },
    {
      title: 'Gland, rod seal and wiper',
      body:
        'At the rod end the **gland** guides the hard-chromed rod. Its **rod seal** holds the pressure; the **wiper** scrapes off dirt as the rod comes back in.',
      camera: { position: [PORT_ROD_X + 0.12, 0.12, 0.22], target: [PORT_ROD_X + 0.03, 0, 0] },
      select: 'gland',
      cut: 'half',
      params: { motion: 'cycle' },
    },
    {
      title: 'Overload and the relief valve',
      body:
        'A typical ram: 50 mm bore, 200 mm stroke, 20 kN in 2 s needs **0.393 L**, **0.197 L/s** and **102 bar**; normal working pressure is 160 bar and the relief valve is set at **275 bar**. Load it with 60 kN and the required 306 bar is above the setting: the ram **stalls** and the pump flow goes over the relief valve.',
      camera: { position: [0.62, 0.36, 0.95], target: [0.36, 0.03, 0] },
      select: 'cylinder',
      params: { bore: 0.05, rod: 0.025, p: 27.5, Q: 11.78, load: 60, motion: 'extend', stroke: 0.2, time: 2 },
      cites: [SRC.top510('p11')],
    },
    {
      title: 'Control valve; single- vs double-acting',
      body:
        'The **spool valve** decides which end gets pump oil: P→A (cap end) extends, P→B (rod end) retracts, and in the centre both lands cover A and B so the trapped oil holds the load. A **single-acting** ram is fed at one end only — the tractor lift ram lowers when the valve lets the implement push the oil back to the reservoir.',
      camera: { position: [-0.05, 0.42, 0.62], target: [-0.08, 0.15, 0] },
      select: 'valve',
      cut: 'half',
      params: { motion: 'cycle', acting: 'single', load: 20, bore: 0.0762, rod: 0.025, p: 17.2, Q: 68.13 },
      cites: [SRC.hy510('p1–2, Fig 40'), MG1617('Q(c)')],
    },
    {
      title: 'Exploded view',
      body: 'Open the **Controls** tab to change bore, rod, pressure and load, and follow the step-by-step working.',
      camera: { position: [0.7, 0.5, 1.05], target: [0.36, 0.05, 0] },
      select: null,
      explode: 1,
      params: { bore: 0.0762, rod: 0.025, p: 17.2, Q: 68.13, load: 20, motion: 'cycle', acting: 'double' },
    },
  ],
}

export default scene
