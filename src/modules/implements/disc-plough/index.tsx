import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, useDisc, type DiscParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const field = { position: [-1, 4.5, 6.5] as [number, number, number], target: [-1.5, 0, -0.3] as [number, number, number] }

const scene: SceneDef = {
  id: 'disc-plough',
  title: 'Disc plough & disc harrow',
  summary:
    'A mounted three-disc plough with standards, scrapers and a sprung furrow wheel, and a mounted tandem disc harrow. Disc angle (42–45°) and tilt angle (15–25°) set the width each disc cuts; the gang angle sets how hard a harrow gang bites.',
  Viewport: Scene3D,
  Panel,
  camera: field,
  extent: 14,
  floorY: -0.5,
  hatchScale: 0.05,
  timeScale: 0.5,
  cutPresets: [
    { id: 'none', label: 'No section', planes: [{ normal: [0, 1, 0], pos: 50 }] },
    { id: 'across', label: 'Across the furrow (x = 0)', planes: [{ normal: [1, 0, 0], pos: 0 }] },
  ],
  defaultPreset: 'none',
  cites: [C.am('§12 disc plough'), C.guide1819('disc plough and disc harrow sketches'), C.bush('p5–6')],
  reset: () => useDisc.getState().reset(),
  applyParams: (p) => useDisc.getState().set(p as Partial<DiscParams>),
  tour: [
    { title: 'Disc ploughing', body: 'A mounted **disc plough** works behind the tractor. Each concave disc rolls through the soil, lifting the slice on its face and throwing it sideways.', camera: field, cut: 'none', select: null, playing: true, params: { ...DEFAULTS }, cites: [C.am('§12 disc plough')] },
    { title: 'Disc angle', body: 'The **disc angle** is between the disc face and the direction of travel: **42–45°**. The yellow line is the horizontal trace of the face; a larger angle cuts a wider slice.', camera: { position: [0.2, 2.2, 0.3], target: [0, 0, 0] }, select: 'disc', params: { mode: 'disc', discAngle: 45 }, cites: [C.am('§12 disc angle 42–45°')] },
    { title: 'Tilt angle', body: 'The **tilt angle** is between the disc face and the vertical: **15–25°** (blue line). The disc leans back with its concave face looking slightly down.', camera: { position: [1.8, 0.3, -0.6], target: [0, 0, 0] }, select: 'disc', params: { mode: 'disc', tilt: 25 }, cites: [C.am('§12 tilt angle 15–25°')] },
    { title: 'Scrapers and furrow wheel', body: '**Scrapers** keep sticky soil off the discs. The tilted, sprung **furrow wheel** runs in the furrow bottom and takes the side thrust of the discs.', camera: field, select: 'scrapers', params: { mode: 'field', tilt: 20, discAngle: 43 }, cites: [C.guide1819('disc plough sketch')] },
    { title: 'Hard, dry and sticky soils', body: 'Because it rolls rather than slides and penetrates by its **weight**, the disc plough suits hard, dry, sticky, stony or rooty soil where a mouldboard would not scour or would break.', camera: field, select: 'discs', cites: [C.am('§12')] },
    { title: 'Tandem disc harrow', body: 'For secondary tillage the **tandem disc harrow** has two gangs in front throwing soil out and two behind throwing it back. A bigger **gang angle** cuts deeper and harder.', camera: field, select: 'gangs', params: { implement: 'harrow', gangAngle: 20 }, cites: [C.guide1819('disc harrow sketch'), C.bush('p6 Fig 4')] },
  ],
}

export default scene
