import type { SceneDef } from '@/modules/types'
import { C, COMPRESSOR, DIM, FRAME_Y, HOPPER, useIso, type IsoParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const home = { position: [2.3, 1.55, 2.7] as [number, number, number], target: [0, 0.62, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'isolation',
  title: 'Transmissibility & isolation',
  summary:
    'A machine with a rotating unbalance on four spring–damper isolators. Sweep the frequency ratio through resonance and watch the force reaching the foundation; read transmissibility, magnification and isolation efficiency, and size mounts for a wanted TR. Includes a reciprocating-compressor and a hopper-shaker example.',
  Viewport: Scene3D,
  Panel,
  camera: home,
  extent: 2,
  floorY: 0,
  hatchScale: 0.013,
  timeScale: 1 / 100,
  cutPresets: [
    { id: 'half', label: 'Half section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'mount', label: 'Through the front mounts', planes: [{ normal: [0, 0, 1], pos: DIM.mountZ }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'mount',
  cites: [C.ln('vibration isolation, transmissibility'), C.q16('hopper with shaker'), C.mg18(), C.he('eq 14, Fig 10.10')],
  reset: () => useIso.getState().reset(),
  applyParams: (p) => useIso.getState().set(p as Partial<IsoParams>),
  tour: [
    {
      title: 'Why isolate a machine?',
      body:
        'A reciprocating compressor shakes: its 10 kg reciprocating mass on a 100 mm crank at 1750 rpm produces an exciting force **F₀ = m e ω² = 33.6 kN**. Bolted straight to the floor, all of it would reach the building. On isolators, only the **transmitted force F_T = TR·F₀** does.',
      camera: home,
      cut: 'mount',
      select: null,
      playing: true,
      timeScale: 1 / 100,
      params: { ...COMPRESSOR },
      cites: [C.ln('compressor example')],
    },
    {
      title: 'The rotating unbalance',
      body: 'The red weight on the crank disc stands for the unbalance. Its vertical force component (orange arrow) pushes the machine up and down on the mounts.',
      camera: { position: [1.1, 1.1, 1.5], target: [0.26, FRAME_Y + 0.2, 0.25] },
      select: 'eccentric',
      cites: [C.ln('unbalance m e ω²')],
    },
    {
      title: 'Isolators: springs and dampers',
      body:
        'Each mount has a spring and a damper. Together they set **ω_n = √(k/M)** and **ζ**. The blue arrows are the forces they pass into the foundation: at r = 2.72 with ζ = 0.15 they are only 20 % of the exciting force — **80 % isolation**.',
      camera: { position: [1.4, 0.75, 1.5], target: [DIM.mountX, 0.4, DIM.mountZ] },
      select: 'mounts',
      cites: [C.ln('isolation efficiency (1 − TR) × 100 %')],
      check: {
        question: 'The running speed stays the same but you fit softer springs. What happens to the force reaching the floor?',
        options: ['It rises', 'It falls', 'It stays the same'],
        answer: 1,
        explain: 'Softer springs lower **ω_n = √(k/M)**, so r = ω/ω_n moves further above √2 and the transmissibility, and with it the floor force, falls.',
      },
    },
    {
      title: 'Through resonance',
      body:
        'At **r = 1** the running speed equals the natural frequency. The machine’s motion is limited only by damping and the mounts now pass **3.5 times** the exciting force to the floor. Every isolated machine runs through this speed when it starts and stops.',
      camera: home,
      select: 'machine',
      params: { ...COMPRESSOR, r: 1 },
      cites: [C.ln('resonance at r = 1')],
      check: {
        question: 'The machine must pass through r = 1 every time it starts. How can you cut the force on the floor while it does?',
        options: ['Fit stiffer springs', 'Remove the dampers', 'Add more damping to the mounts'],
        answer: 2,
        explain: 'At **r = 1** only damping limits the motion, so a higher ζ lowers the resonance peak, at the cost of slightly more force transmitted at running speed.',
      },
    },
    {
      title: 'Below √2, mounts make it worse',
      body:
        'All the transmissibility curves cross **TR = 1 at r = √2**. Below that, springs amplify the force; above it they isolate. Damping lowers the resonance peak but slightly raises TR in the isolation region — the trade-off shown in the chart.',
      camera: home,
      params: { ...COMPRESSOR, r: 1.2 },
      cites: [C.he('Fig 10.10: TR < 1 only for r > 1.414')],
      check: {
        question: 'This machine runs at r = 1.2 on its mounts. Compared with bolting it straight to the floor, the mounts…',
        options: ['Pass more force to the floor', 'Pass less force to the floor', 'Make no difference'],
        answer: 0,
        explain: 'Below **r = √2** the transmissibility is above 1, so the mounts amplify the force. The cure is softer mounts that put r above √2.',
      },
    },
    {
      title: 'The hopper shaker',
      body:
        'A hopper (400 kg, k = 39.5 MN/m, b = 100 N·s/m) is shaken with 75 N at 50 Hz. Its natural frequency is **314.2 rad/s** — the same as 50 Hz (314.16 rad/s). It runs at resonance with ζ = 0.0004, so 75 N produces about **2 mm** of motion.',
      camera: { position: [2.2, 1.9, 2.4], target: [0, 0.9, 0] },
      select: 'hopper',
      cut: 'half',
      params: { ...HOPPER },
      cites: [C.q16('hopper with shaker'), C.mg18()],
    },
  ],
}

export default scene
