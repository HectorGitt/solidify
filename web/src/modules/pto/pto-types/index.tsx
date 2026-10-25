import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, HOUSING, usePto } from './model'
import { PtoPanel } from './Panel'
import { PtoTypes3D } from './Scene3D'

const home = { position: [0.55, 1.05, 1.75] as [number, number, number], target: [0.05, 0.3, -0.1] as [number, number, number] }

const scene: SceneDef = {
  id: 'pto-types',
  title: 'PTO types & standards',
  summary:
    'A tractor driveline cut open from engine to PTO stub. Switch between transmission, live, independent and ground-speed PTO drives, press the clutch half or fully, and see which shafts stop. The stub shows the 540 rpm (6-spline) and 1000 rpm (21-spline) standards.',
  Viewport: PtoTypes3D,
  Panel: PtoPanel,
  camera: home,
  extent: 1.8,
  floorY: 0,
  hatchScale: 0.008,
  timeScale: 1 / 50,
  cutPresets: [
    { id: 'half', label: 'Half section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'gears', label: 'Half section, gears too', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
    { id: 'plan', label: 'Plan through the input shaft', planes: [{ normal: [0, 1, 0], pos: 0.35 }] },
    { id: 'clutch', label: 'Clutch section', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: HOUSING.x1 }], intersection: true, sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [SRC.pt510('p2–3 PTO types'), SRC.tts510('p1–3, p10'), SRC.top510('p3, p6–7 Figs A2.6, A2.9, A2.10'), SRC.pto502('PTO speeds and guards')],
  reset: () => usePto.getState().reset(),
  applyParams: (p) => usePto.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'From engine to PTO stub',
      body:
        'The **power take-off (PTO)** delivers engine power to a machine through a splined shaft at the rear of the tractor. This schematic driveline is cut open: engine and flywheel, clutch, gearbox, crown wheel to the rear wheel — and the PTO train down to the stub.\n\nYellow particles show power to the wheels, orange to the PTO.',
      camera: home,
      cut: 'half',
      select: null,
      explode: 0,
      playing: true,
      timeScale: 1 / 50,
      params: { ...DEFAULTS, type: 'transmission' },
      cites: [SRC.tts510('p1–2 Fig 30, p10')],
    },
    {
      title: '1 · Transmission PTO',
      body:
        'The simplest drive: the PTO takes power from the gearbox **layshaft**, behind the one clutch. Press the clutch to change gear and the **PTO stops too** — awkward with a baler or mower that must keep running while the tractor stops.',
      camera: { position: [0.1, 0.65, 0.95], target: [-0.05, 0.25, 0] },
      select: 'layshaft',
      params: { type: 'transmission', pedal: 'down' },
      cites: [SRC.pt510('p2 transmission-driven PTO')],
    },
    {
      title: '2 · Live (continuous-running) PTO',
      body:
        'A **dual clutch** on one pedal. The first half of the travel releases the transmission plate — the wheels stop — while the PTO plate, on a **hollow shaft** round the input shaft, keeps the PTO running. Full travel releases it as well.',
      camera: { position: [0.75, 0.6, 0.6], target: [0.42, 0.35, 0] },
      select: 'pto-disc',
      cut: 'clutch',
      params: { type: 'live', pedal: 'half' },
      cites: [SRC.pt510('p2–3 continuous-running'), SRC.top510('p6 Fig A2.9'), SRC.tts510('p3')],
      check: {
        question: 'On a live PTO, what happens when the pedal is pushed all the way down?',
        options: ['The wheels stop but the PTO keeps turning', 'The wheels and the PTO both stop', 'The PTO stops but the wheels keep turning'],
        answer: 1,
        explain: 'The **dual clutch** releases the transmission plate in the first half of the travel and the PTO plate at **full travel**, so both drives stop.',
        reveal: { params: { pedal: 'down' } },
      },
    },
    {
      title: '3 · Independent PTO',
      body:
        'The PTO has its **own clutch and control**. Here the PTO drive shaft turns whenever the engine runs and a hydraulic **wet multi-plate clutch** at the rear engages it — at any time, even on the move. The clutch pedal has no effect; released, the PTO is braked.',
      camera: { position: [0.1, 0.6, 0.75], target: [-0.15, 0.25, 0] },
      select: 'ipto',
      cut: 'half',
      params: { type: 'independent', pedal: 'down', lever: true },
      cites: [SRC.pt510('p3 independent'), SRC.top510('p7 Fig A2.10')],
    },
    {
      title: '4 · Ground-speed PTO',
      body:
        'Driven from the gearbox **output**, after the speed gears: the PTO turns a fixed number of times per metre travelled, whatever the gear. It stops when the tractor stops and **reverses** in reverse — for example to drive a trailer with a powered axle.',
      camera: { position: [-0.1, 0.6, 0.8], target: [-0.2, 0.28, 0] },
      select: 'pto-counter',
      params: { type: 'ground', pedal: 'up', gear: 'R' },
      cites: [SRC.tts510('p10 ground-speed PTO')],
      check: {
        question: 'With a ground-speed PTO, the driver shifts to a higher gear at the same engine speed. What happens to PTO turns per metre travelled?',
        options: ['They rise with the higher gear', 'They fall with the higher gear', 'They stay the same'],
        answer: 2,
        explain: 'The PTO is driven from the gearbox **output**, after the speed gears, so it turns in step with the wheels: a fixed number of turns per metre in any gear.',
      },
    },
    {
      title: '540 and 1000 rpm',
      body:
        'Standard speeds are **540 rpm** (6 splines, Ø35 mm, 1⅜ in) and **1000 rpm** (21 splines) — a two-speed tractor shifts a gear for each. For the same power the 1000 rpm shaft carries **54 %** of the torque, so larger machines use it. The stub turns **clockwise viewed from the rear**.',
      camera: { position: [-0.95, 0.35, 0.45], target: [-0.66, 0.12, 0] },
      select: 'stub',
      cut: 'half',
      params: { type: 'independent', gear: 'F', std: '1000', lever: true },
      cites: [SRC.tts510('p10'), SRC.pto502('540 rpm, 6 splines')],
      check: {
        question: 'A machine takes 30 kW from a 1000 rpm shaft. About what torque does the shaft carry?',
        options: ['≈ 530 N·m', '≈ 983 N·m', '≈ 286 N·m'],
        answer: 2,
        explain: '**T = P/ω** = 30 000 / (2π × 1000/60) ≈ 286 N·m. At 540 rpm the same 30 kW would need ≈ 530 N·m.',
      },
    },
    {
      title: 'Guard it',
      body:
        'A spinning PTO is one of the most dangerous parts of a tractor: a 540 rpm shaft wraps up 7 ft (2.1 m) of hood string in one second. The **master shield** covers the stub and must take 114 kg; the implement shaft is guarded to the first bearing of the machine.\n\nOpen **Controls** to see which PTO keeps running at each pedal position.',
      camera: { position: [-0.9, 0.55, 0.8], target: [-0.6, 0.15, 0] },
      select: 'shield',
      params: { ...DEFAULTS },
      cites: [SRC.tts510('p10 guarding'), SRC.pto502('safety')],
    },
  ],
}

export default scene
