import type { SceneDef } from '@/modules/types'
import { ft } from '@/physics/structures'
import { C, DEFAULTS, useFarmstead, type FarmsteadParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const overview = { position: [120, 115, 45] as [number, number, number], target: [0, 0, -75] as [number, number, number] }

const scene: SceneDef = {
  id: 'farmstead',
  title: 'Farmstead planning & zones',
  summary:
    'A concentrated farmstead laid out by zone planning: rings 10–30 m wide tangent to the public road, from the dwelling (upwind, nearest the road) through machinery, grain and feed, to livestock at the far downwind end, joined by the access drive. Turn the prevailing wind and resize the rings to see when odour reaches the house, check drive widths, the turning area and the 15 m fuel-store separation, and score a site.',
  Viewport: Scene3D,
  Panel,
  camera: overview,
  extent: 220,
  floorY: 0,
  hatchScale: 1.2,
  timeScale: 1,
  cutPresets: [
    { id: 'none', label: 'No section', planes: [{ normal: [0, 1, 0], pos: 60 }] },
    { id: 'roofs', label: 'Roofs off (plan at 2.5 m)', planes: [{ normal: [0, 1, 0], pos: 2.5 }] },
    { id: 'axis', label: 'Section along the layout axis', planes: [{ normal: [1, 0, 0], pos: 0 }] },
  ],
  defaultPreset: 'none',
  cites: [C.ln('p3–10 farmstead planning, zone planning'), C.ln('p21–22 drives and parking'), C.ln('p27 hazardous stores')],
  reset: () => useFarmstead.getState().reset(),
  applyParams: (p) => useFarmstead.getState().set(p as Partial<FarmsteadParams>),
  tour: [
    {
      title: 'The farmstead',
      body: 'The farmstead is the hub of the farm: dwelling, stores, workshop, livestock buildings, drives and services. Planned well it saves time and labour, keeps odour, dust, noise and traffic away from the home, and takes **no more than about 5 %** of the production area.',
      camera: overview,
      cut: 'none',
      select: null,
      params: { ...DEFAULTS, checks: {} },
      cites: [C.ln('p3–4')],
    },
    {
      title: 'Zone planning',
      body: 'Zones are rings **10–30 m wide**, all tangent to the main road at one point. **Zone 1** (family living) is nearest the road; **zone 2** holds machinery and the workshop; **zone 3** grain, feed and small animals; **zone 4** livestock, at the far end with room to expand. **Zone 5** is the access drive and courtyard.',
      camera: { position: [0, 190, 10], target: [0, 0, -75] },
      select: 'zones',
      cites: [C.ln('p8–9')],
      check: {
        question: 'Why is the livestock zone placed at the far end of the layout, away from the road?',
        options: ['So the animals are nearest to market', 'Room to expand, with odour kept from the home', 'Because it needs the narrowest ring'],
        answer: 1,
        explain: 'Livestock are the noisiest, smelliest centre and often grow, so **zone 4** goes farthest from the house and road, with open ground beyond it for expansion.',
      },
    },
    {
      title: 'Prevailing wind',
      body: 'Put the livestock **downwind** of the dwelling and the neighbours. With the wind blowing up the layout axis the odour plume drifts away from the house; swing the wind round from the north and the plume turns red as it reaches zone 1.',
      camera: { position: [-60, 90, 60], target: [0, 0, -80] },
      select: 'zone-4',
      params: { windFrom: 0, plume: true },
      cites: [C.ln('p10 air movement')],
      check: {
        question: 'On a farm whose prevailing wind blows from the south, where should the livestock buildings go relative to the house?',
        options: ['To the north, downwind', 'To the south, upwind', 'To the east or west, across the wind'],
        answer: 0,
        explain: 'A south wind carries odour and dust **northwards**, so livestock to the north of the house are **downwind** and the plume drifts away from zone 1.',
        reveal: { params: { windFrom: 180, plume: true } },
      },
    },
    {
      title: 'Drives, parking and turning',
      body: 'Two-way drives are **16–20 ft (5–6 m)**, one-way **12 ft**. Large-vehicle stalls are **12 × 60 ft**, and farm equipment needs a **40–50 ft (12–15 m)** turning radius — the tractor circles the courtyard pad.',
      camera: { position: [35, 30, -5], target: [0, 0, -45] },
      select: 'courtyard',
      params: { windFrom: 200, driveW: ft(18), turnR: ft(45) },
      cites: [C.ln('p21–22')],
      check: {
        question: 'A tractor with its implement must turn round on the courtyard pad. About how wide must the pad be?',
        options: ['About 6 m, one drive width', 'About 12 m', 'About 24–30 m'],
        answer: 2,
        explain: 'A **turning radius** of 12–15 m (40–50 ft) sweeps a circle twice that across, so the pad needs roughly **24–30 m** of clear width.',
      },
    },
    {
      title: 'Services and hazards',
      body: 'Water, power and sanitation serve every centre; doubling the stock more than doubles the demand. Fuel above **50 L diesel or 10 L petrol** goes in a separate store at least **15 m** from any other building — the red ring.',
      camera: { position: [70, 40, -20], target: [35, 0, -60] },
      select: 'fuel',
      cut: 'roofs',
      cites: [C.ln('p10'), C.ln('p27')],
    },
  ],
}

export default scene
