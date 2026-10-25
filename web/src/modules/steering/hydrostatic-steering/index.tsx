import type { SceneDef } from '@/modules/types'
import { AX, DEFAULTS, ST, useSteer } from './model'
import { SteeringPanel } from './Panel'
import { LAY } from './parts'
import { Steering3D } from './Scene3D'

const home = { position: [1.9, 2.0, 3.1] as [number, number, number], target: [-0.45, 0.8, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'hydrostatic-steering',
  title: 'Power & hydrostatic steering',
  summary:
    'A tractor front axle steered hydrostatically — pump, gerotor metering unit on the column, double-acting steering cylinder and hoses with live oil flow — or with power assistance on a manual linkage. Inner and outer wheel angles against Ackermann, toe-in, and what happens with the engine off.',
  Viewport: Steering3D,
  Panel: SteeringPanel,
  camera: home,
  extent: 2.6,
  floorY: 0,
  hatchScale: 0.008,
  timeScale: 1,
  cutPresets: [
    { id: 'cyl', label: 'Through the cylinder & axle', planes: [{ normal: [0, 1, 0], pos: AX.y + 0.075 }] },
    { id: 'mu', label: 'Through the metering unit', planes: [{ normal: [-1, 0, 0], pos: -LAY.mu.x - 0.0 }, { normal: [0, 0, 1], pos: 0 }], intersection: true },
    { id: 'half', label: 'Centre-line section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 1, 0], pos: AX.y + 0.075 }], sectionMoving: true },
  ],
  defaultPreset: 'cyl',
  cites: [ST('p1–3, Figs 44–45'), ST('p5, Fig 47 toe-in')],
  reset: () => useSteer.getState().reset(),
  applyParams: (p) => useSteer.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Hydrostatic steering',
      body:
        'There are three types of tractor steering: **manual**, **power-assisted** and **hydrostatic**. Here is hydrostatic: an engine-driven **pump**, a **control valve on the steering column**, a **double-acting steering cylinder** and pipes — and **no mechanical linkage** between steering wheel and wheels.',
      camera: home,
      cut: 'cyl',
      select: null,
      explode: 0,
      playing: true,
      params: { variant: 'hydrostatic', engineOn: true, auto: true },
      cites: [ST('p1–3, Fig 45')],
    },
    {
      title: 'The metering unit',
      body:
        'Inside the column unit a small **gerotor** (a 6-tooth rotor orbiting in a 7-roller ring) meters a fixed volume of oil for every turn of the wheel, so the front wheels follow the steering wheel. When you stop turning, the open-centre valve sends the pump flow straight back to the tank.',
      camera: { position: [LAY.mu.x + 0.35, LAY.mu.y + 0.3, 0.4], target: [LAY.mu.x, LAY.mu.y - 0.02, 0] },
      select: 'gerotor-rotor',
      cut: 'mu',
      check: {
        question: 'You turn the steering wheel twice as fast. What do the front wheels do?',
        options: ['Steer twice as fast, in step with it', 'Steer at the same, fixed rate', 'Stop until the pump catches up'],
        answer: 0,
        explain: 'The gerotor meters a **fixed volume of oil per turn**, so turning the wheel faster sends oil to the cylinder faster and the front wheels follow, up to the pump\'s flow.',
      },
    },
    {
      title: 'Steering cylinder',
      body: 'Oil to the **rod end** pulls the left steering arm (left turn); oil to the **cap end** pushes it (right turn). The other end of the cylinder returns oil through the valve to the tank.',
      camera: { position: [0.6, 1.2, 0.9], target: [-0.1, AX.y, 0.1] },
      select: 'steer-cylinder',
      cut: 'cyl',
    },
    {
      title: 'Track rod and Ackermann',
      body:
        'The **track rod** joins the two steering arms so both wheels move together. Because the arms are angled inwards, the **inner wheel turns more** than the outer one — close to the Ackermann ideal. The track rod must be reset whenever the front track width is changed.',
      camera: { position: [0.1, 1.9, 0.6], target: [-0.1, AX.y, 0] },
      select: 'track-rod',
      cites: [ST('p1–2')],
      check: {
        question: 'Turning left, which front wheel turns through the larger angle?',
        options: ['The right (outer) wheel', 'The left (inner) wheel', 'Both turn the same'],
        answer: 1,
        explain: 'The inner wheel runs on a **smaller circle** round the same turning centre, so it must turn more. The inward-angled steering arms give this, close to Ackermann.',
      },
    },
    {
      title: 'Toe-in',
      body: 'The front wheels are set so the rims are **3–6 mm closer at the front** (A) than at the back (B), measured at hub height. It is adjusted by the track-rod length. Shown exaggerated ×20.',
      camera: { position: [0.2, 2.2, 0.3], target: [0, AX.y, 0] },
      select: 'front-wheels',
      params: { auto: false, wheel: 0, showToe: true },
      cites: [ST('p5, Fig 47')],
    },
    {
      title: 'Engine off',
      body: 'With the engine stopped there is no oil flow, so a **hydrostatic** system **cannot be steered** — turn the wheel and the front wheels stay put.',
      camera: home,
      select: 'pump',
      params: { auto: true, showToe: false, engineOn: false },
      cites: [ST('p3')],
    },
    {
      title: 'Power-assisted steering',
      body:
        'Power assistance keeps the **manual linkage** — steering box, drop arm, drag link — and adds a belt-driven pump, reservoir and double-acting ram, with the valve worked from the steering box. If the hydraulics fail it **can still be steered** by hand.',
      camera: { position: [0.6, 1.8, 2.2], target: [-0.6, 0.6, 0.2] },
      select: 'manual-linkage',
      params: { variant: 'assisted', engineOn: false, auto: true },
      cites: [ST('p2')],
      check: {
        question: 'The pump belt breaks on a power-assisted tractor. What does the driver notice?',
        options: ['The steering locks solid', 'The wheels run straight ahead', 'Steering goes heavy but still works'],
        answer: 2,
        explain: 'Power assistance only adds force to a **manual linkage**, so with no oil the driver steers through the box and drag link alone: heavy, but still in control.',
      },
    },
    {
      title: 'Try it',
      body: 'In **Controls** change the metering displacement and see the turns lock-to-lock, compare the inner and outer wheel angles with Ackermann, and follow the working.',
      camera: home,
      select: null,
      params: { variant: 'hydrostatic', engineOn: true, auto: true },
    },
  ],
}

export default scene
