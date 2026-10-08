import { SRC, cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, useTypes } from './model'
import { TypesPanel } from './Panel'
import { Scene3D } from './Scene3D'

const view = { position: [5.2, 3.0, 6.0] as [number, number, number], target: [0, 1.0, 0] as [number, number, number] }
const HFS = (where: string) => cite('AEE510', 'Human Factors in Agricultural Tractor Safety.pdf', where)

const scene: SceneDef = {
  id: 'tractor-types',
  title: 'Tractor types',
  summary:
    'A turntable gallery of twelve tractor types — standard, row-crop, high-clearance, utility with loader, orchard, lawn and garden, power tiller, crawler, skid-steer, tree skidder, 4WD with small front wheels and the articulated 4WD — with each type’s key features and how the tractor evolved.',
  Viewport: Scene3D,
  Panel: TypesPanel,
  camera: view,
  extent: 7,
  floorY: -0.08,
  hatchScale: 0.05,
  timeScale: 1,
  cutPresets: [{ id: 'side', label: 'Side section (centre line)', planes: [{ normal: [0, 0, 1], pos: 0 }] }],
  cites: [SRC.vers502('the 12 tractor types; history'), SRC.tests502('p2 testing history'), HFS('p52 ROPS rule')],
  reset: () => useTypes.getState().reset(),
  applyParams: (p) => useTypes.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'The standard tractor',
      body:
        'The **standard** two-wheel-drive tractor: fixed tread, large rear driving wheels and the CG about one-third of the wheelbase ahead of the rear axle. It pulls through the drawbar, drives through the PTO and lifts implements on the three-point linkage.',
      camera: view,
      select: null,
      cut: false,
      playing: true,
      params: { type: 'standard', spin: true },
      cites: [SRC.vers502('standard tractor')],
    },
    {
      title: 'Row-crop and high-clearance',
      body:
        'A **row-crop** tractor has a narrow (tricycle) front and an adjustable rear track (1.32–1.93 m) to run between the rows. The **high-clearance** (cane) tractor lifts the whole machine on drop housings over tall crops — at the cost of a high CG.',
      params: { type: 'rowcrop' },
      cites: [SRC.vers502('row-crop, high-clearance'), SRC.tts510('p16 track widths')],
    },
    {
      title: 'Utility, orchard and lawn & garden',
      body:
        'The **utility** tractor is a compact all-rounder, here with a front-end loader. **Orchard** tractors are low with smooth swept fenders and often no ROPS; **lawn and garden** tractors are under 15 kW.',
      params: { type: 'utility' },
      cites: [SRC.vers502('utility, orchard, lawn and garden')],
    },
    {
      title: 'The power tiller',
      body:
        'The **two-wheel walking tractor** (power tiller) has a single-cylinder engine of 5–12 kW and usually a rotary tiller. The operator steers and balances it at the handles, and the handle force follows from the moments about the axle.',
      camera: { position: [2.6, 1.8, 3.2], target: [0, 0.6, 0] },
      params: { type: 'tiller' },
      cites: [SRC.vers502('power tiller'), SRC.mac502('Fig 6.13, eqs 6.22–6.24')],
    },
    {
      title: 'Crawlers and skid-steers',
      body:
        '**Crawlers** spread their weight on tracks for traction on soft ground — steel from the 1930s, rubber belts (Challenger) from the 1990s. The **skid-steer** has fixed wheels and turns by driving its two sides at different speeds.',
      camera: view,
      params: { type: 'crawler' },
      cites: [SRC.vers502('crawler, skid-steer')],
    },
    {
      title: 'Four-wheel drive',
      body:
        'Front-wheel assist (**4WD with smaller front wheels**) and the big **articulated 4WD** with equal wheels (100–300+ kW). The articulated tractor steers by folding its two frames about a hinge; the **tree skidder** uses the same layout in the forest.',
      camera: { position: [6.6, 3.6, 7.4], target: [0, 1.2, 0] },
      params: { type: 'articulated' },
      cites: [SRC.vers502('4WD types'), SRC.l27('Fig 47')],
    },
    {
      title: 'How we got here',
      body:
        'From the 36 t **California giant** of 1900, through the **Winnipeg trials** (1908–12) and the **Nebraska Test Law** (1919), to rubber tyres, power-shift gearboxes and the **ROPS** rule of 1976. The Controls tab lists all twelve types and the timeline.',
      camera: view,
      params: { type: 'mfwd' },
      cites: [SRC.vers502('history'), SRC.tests502('p2'), HFS('p52')],
    },
  ],
}

export default scene
