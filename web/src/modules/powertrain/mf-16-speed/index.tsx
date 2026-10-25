import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { BEVEL, BOT, SS, ST } from './dims'
import { prepareMFGeometry } from './geometry'
import { DEFAULTS, resetSeq, useMF, type MFParams } from './model'
import { MF16Panel } from './Panel'
import { MF16Scene3D } from './Scene3D'

type V3 = [number, number, number]
const home = { position: [1.3, 0.5, 1.15] as V3, target: [0, -0.1, 0.45] as V3 }
const at = (z: number, y = -0.07, d = 0.55) => ({ position: [d, 0.18, z + d * 0.8] as V3, target: [0, y, z] as V3 })

const scene: SceneDef = {
  id: 'mf-16-speed',
  title: '16F/12R tractor gearbox',
  summary:
    'A Massey-Ferguson-style sixteen-speed tractor gearbox brought to life: a hydraulic speed-shift epicyclic for high-low on the move, a shuttle coupler for forward/reverse, four synchromesh constant-mesh helical gears, a sliding range gear, a hollow layshaft with the PTO shaft running through it, the 4WD transfer clutch and the parking brake. The levers drive every shaft; the live table and chart show all 16 forward and 12 reverse speeds.',
  Viewport: MF16Scene3D,
  Panel: MF16Panel,
  camera: home,
  extent: 1.4,
  floorY: -0.4,
  hatchScale: 0.006,
  timeScale: 1 / 30,
  cutPresets: [
    { id: 'side', label: 'Through both shaft lines', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [1, 0, 0], pos: 0 }, { normal: [0, 1, 0], pos: -0.07 }], intersection: true },
    { id: 'all', label: 'Section everything', planes: [{ normal: [1, 0, 0], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'side',
  cites: [SRC.top510('p3–4, Fig A2.6'), SRC.tts510('p4–5 — gearbox speeds and levers')],
  reset: () => {
    useMF.getState().reset()
    resetSeq()
  },
  prepare: prepareMFGeometry,
  applyParams: (p) => useMF.getState().set(p as Partial<MFParams>),
  tour: [
    {
      title: 'Sixteen speeds from 4 × 2 × 2',
      body:
        'The Massey-Ferguson 2000 gearbox: a basic **4-speed all-synchromesh** box with constant-mesh helical gears, a sliding **range** gear (high/low) and a hydraulic **speed-shift** in front — 4 × 2 × 2 = **16 forward**, with shuttle reverse in **12**. Parts carrying power are drawn orange.',
      camera: home,
      cut: 'side',
      select: null,
      explode: 0,
      playing: true,
      params: { ...DEFAULTS },
      cites: [SRC.top510('p3, Fig A2.6')],
      check: {
        question: 'If a fifth synchromesh gear were added to the basic box, how many forward speeds would the tractor have?',
        options: ['18', '20', '24'],
        answer: 1,
        explain: 'The stages **multiply**: 5 gears × 2 ranges × 2 speed-shift steps = 20 forward speeds.',
      },
    },
    {
      title: 'Speed-shift: an epicyclic changed on the move',
      body:
        'The input drives the **sun**; the **carrier** is the output. Hold the **ring** with the hydraulic brake and the carrier turns slower (low); lock sun and carrier with the hydraulic clutch and it all turns as one (high). It changes without the clutch — each of the 8 gearbox gears gets a high and a low.',
      camera: at(SS.z, 0, 0.45),
      select: 'speed-shift',
      params: { speedShift: 'L' },
      cites: [SRC.top510('p3'), SRC.pt510('p6 — ring held, lock two members')],
      check: {
        question: 'Why can the speed-shift change under load while the range gear cannot?',
        options: ['Its gears stay in mesh; only a brake and clutch swap', 'It has synchromesh cones on each of its gears', 'It turns more slowly than the range gear does'],
        answer: 0,
        explain: 'In the epicyclic every gear is **always in mesh**: changing means releasing the ring brake and applying the lock-up clutch, which hydraulics can do under load. The range gear must slide teeth into mesh.',
      },
    },
    {
      title: 'Shuttle: forward and reverse',
      body:
        'Two **free-running gears** sit between the speed-shift and the gearbox; the **sliding coupler** connects either one to the shaft. The forward gear drives the constant-mesh gear directly; the reverse gear drives it through an **idler**, so the mainshaft turns the other way.',
      camera: at(ST.coupler, -0.07, 0.5),
      select: 'shuttle',
      params: { shuttle: 'R', speedShift: 'H' },
      cites: [SRC.top510('p3 — reverse drive arrangement')],
    },
    {
      title: 'Four synchromesh gears',
      body:
        'Gears 1–4 are helical, always in mesh, free on the **mainshaft**. Two **synchromesh units** lock the chosen one to the shaft after the cones have matched the speeds. Power then crosses to the fixed gears on the **layshaft**.',
      camera: at(0.42, -0.08, 0.6),
      select: 'synchros',
      params: { shuttle: 'F', gear: 3 },
      cites: [SRC.top510('p3'), SRC.tts510('p5')],
    },
    {
      title: 'A hollow layshaft for the PTO',
      body:
        'The layshaft is **hollow**: the **PTO drive shaft** runs straight through it from the PTO clutch to the rear, so the PTO turns at engine speed whatever gear is chosen.',
      camera: at(0.55, 0.02, 0.5),
      select: 'pto-shaft',
      cut: 'all',
      cites: [SRC.top510('p3')],
      check: {
        question: 'With the engine speed steady, you change from 2nd gear to 4th while the PTO is working. What does the PTO speed do?',
        options: ['Rises with the higher gear', 'Drops while the synchro engages', 'Stays the same'],
        answer: 2,
        explain: 'The PTO shaft runs **through the hollow layshaft** straight from the PTO clutch, so it never passes through the gears: its speed depends only on engine speed.',
        reveal: { params: { gear: 4 } },
      },
    },
    {
      title: 'Range change and the output shaft',
      body:
        'The **range-change gear** slides on the output shaft (which is spigoted into the end of the mainshaft) to mesh the high or the low layshaft gear. It is not synchronised — the tractor stops first. The bevel **pinion** then drives the crown wheel.',
      camera: at(0.7, BOT, 0.6),
      cut: 'side',
      select: 'range-gear',
      params: { range: 'H' },
      cites: [SRC.top510('p3')],
    },
    {
      title: '4WD clutch and parking brake',
      body: 'A **transfer gear** on the output shaft drives the **four-wheel-drive clutch** and the **front axle drive shaft** under the box. The **parking brake** holds the output shaft.',
      camera: { position: [0.55, -0.1, ST.transfer + 0.45], target: [0, -0.25, ST.transfer] },
      select: 'transfer',
      params: { fourWD: true },
      cites: [SRC.top510('Fig A2.6')],
    },
    {
      title: 'All the speeds',
      body:
        'Open **Controls**: the table lists all 16 forward speeds, slowest first — 1.7 to 32.7 km/h at 2000 rpm, close to the typical 1.6–32 km/h of a tractor box — and the 12 reverse speeds. Tooth numbers are typical values.',
      camera: { position: [0.7, 0.3, BEVEL.apexZ + 0.6], target: [0, -0.1, 0.6] },
      select: null,
      cites: [SRC.tts510('p4')],
    },
  ],
}

export default scene
