import type { CameraPose, SceneDef } from '@/modules/types'
import { C, DEFAULTS, useCab, type CabParams } from './model'
import { CabPanel } from './Panel'
import { Cab3D } from './Scene3D'

const VIEW: CameraPose = { position: [-2.6, 2.7, 3.0], target: [0.1, 1.35, 0] }
const STATION: CameraPose = { position: [-1.3, 2.2, 1.5], target: [0.25, 1.3, 0] }

const scene: SceneDef = {
  id: 'cab',
  title: 'Cab, controls & maintenance',
  summary:
    'The Farmland tractor’s operator station: 21 numbered controls and instruments, an open platform, two-post ROPS or a cab on isolation mounts, the 96 vs 88 dB(A) noise at the ear against the OSHA limits, 5th/50th/95th-percentile operators, and the 10/50/250/600 h service points.',
  Viewport: Cab3D,
  Panel: CabPanel,
  camera: VIEW,
  extent: 4.5,
  floorY: 0,
  hatchScale: 0.03,
  timeScale: 1,
  cutPresets: [
    { id: 'centre', label: 'Centre-line section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'seat', label: 'Section through the seat (left half removed)', planes: [{ normal: [0, 0, 1], pos: 0.15 }] },
  ],
  defaultPreset: undefined,
  cites: [C.he('p2–23, Figs 10.1, 10.7–10.11, Tables 10.6–10.7'), C.ma('p1–2'), C.tests('p2 — sound level since 1971')],
  reset: () => useCab.getState().reset(),
  applyParams: (p) => useCab.getState().set(p as Partial<CabParams>),
  tour: [
    {
      title: 'The operator station',
      body: 'Human engineering fits the machine to the operator. A tractor station has about **21 controls and instruments**; each must be within reach of the limb that works it — the **clutch is worked by the left foot** — and the gauges grouped where they can be read at a glance.',
      camera: STATION,
      cut: false,
      select: 'controls',
      playing: true,
      params: { ...DEFAULTS, station: 'rops' },
      cites: [C.he('p2, Fig 10.1')],
    },
    {
      title: 'Roll-over protection',
      body: 'Overturns cause **52–54 %** of on-farm tractor deaths. A **ROPS** with a seat belt keeps the operator in a protected zone. It is designed with finite elements and proved by lab loading, crush, field-upset and temperature–material tests (ASAE S383, S310.2).',
      camera: VIEW,
      select: 'tractor-rops',
      params: { station: 'rops' },
      cites: [C.he('p20–21')],
    },
    {
      title: 'Noise: 96 against 88 dB(A)',
      body: 'Without a cab the operator hears about **96 dB(A)**; a cab on **isolation mounts** brings it to about **88 dB(A)**. OSHA allows **90 dB(A) for 8 h** down to **115 dB(A) for ¼ h** — 96 dB(A) is allowed for only about 3½ h a day.',
      camera: VIEW,
      select: 'cab',
      params: { station: 'cab', waves: true },
      cites: [C.he('p5–6, p22')],
    },
    {
      title: 'Fitting the 5th to the 95th percentile',
      body: 'Operator stature **162 / 173 / 185 cm**, sitting height **84 / 91 / 97 cm**. The smallest operator must reach the pedals; the tallest needs headroom — hence the **185 cm** cab height.',
      camera: { position: [-0.4, 1.9, 2.4], target: [0.0, 1.6, 0] },
      select: 'mannequin',
      cut: 'seat',
      params: { station: 'cab', percentile: 95 },
      cites: [C.he('Table 10.6, p23')],
    },
    {
      title: 'Service intervals',
      body: 'Daily (**10 h**): engine oil, radiator, steering-linkage grease, air cleaner. **50 h**: air-cleaner service, gearbox oil, wheel bearings, levelling box, tyres, battery, steering fluid. **250 h** and **600 h** services go deeper — oil and filters, brakes, clutch, injectors, transmission oil, cooling flush.',
      camera: { position: [3.2, 2.4, 3.2], target: [0.9, 0.9, 0] },
      select: null,
      cut: false,
      params: { station: 'rops', interval: 250, percentile: 50 },
      cites: [C.ma('p1–2'), C.st('p4')],
    },
  ],
}

export default scene
