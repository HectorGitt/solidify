import type { SceneDef } from '@/modules/types'
import { BREAK_X, C, DEFAULTS, useWind, type WindParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const overview = { position: [20, 14, 30] as [number, number, number], target: [0, 1, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'wind-erosion',
  title: 'Wind erosion & windbreaks',
  summary:
    'Wind sweeps across a dry, bare field: fine dust rises in suspension, sand grains hop in saltation and coarse grains creep along the surface, lowering the soil where the wind exceeds the threshold. A three-row windbreak, residue, moisture, roughness and strip cropping show how each control works.',
  Viewport: Scene3D,
  Panel,
  camera: overview,
  extent: 50,
  floorY: -1.2,
  hatchScale: 0.3,
  timeScale: 1,
  cutPresets: [
    { id: 'none', label: 'No section', planes: [{ normal: [0, 1, 0], pos: 50 }] },
    { id: 'along', label: 'Along the wind', planes: [{ normal: [0, 0, 1], pos: 0 }] },
  ],
  defaultPreset: 'none',
  cites: [C.we('slides 4–25'), C.csb('p6–10 strip cropping, tillage')],
  reset: () => useWind.getState().reset(),
  applyParams: (p) => useWind.getState().set(p as Partial<WindParams>),
  tour: [
    {
      title: 'When wind erodes',
      body: 'Erosion starts when the wind’s force exceeds the soil’s **threshold**: about **5 m/s at 0.3 m** for mineral soils. Loose, fine, dry soil on a smooth bare surface is most at risk.',
      camera: overview,
      cut: 'none',
      select: 'field',
      playing: true,
      params: { ...DEFAULTS, u: 10, windbreak: false },
      cites: [C.we('s4–6')],
      check: {
        question: 'A wind of 4 m/s, measured at 0.3 m, blows over dry, loose, bare mineral soil. What happens?',
        options: ['Heavy saltation begins at once', 'Only the fine dust blows away', 'Nothing moves: it is below threshold'],
        answer: 2,
        explain: 'Movement starts only when the wind exceeds the soil’s **threshold**, about 5 m/s at 0.3 m for mineral soils. At 4 m/s no grains are lifted.',
      },
    },
    {
      title: 'Saltation',
      body: 'Grains of **0.05–0.5 mm** are lifted and dropped in short hops. Saltation is the key process: its impacts kick the other grains loose. Over 93 % of the movement is within 1 m of the ground.',
      camera: { position: [6, 1.5, 8], target: [8, 0.3, 0] },
      select: 'saltation',
      cites: [C.we('s7–9, Fig. 1')],
    },
    {
      title: 'Suspension and creep',
      body: 'Dust **finer than 0.05 mm** is carried high in **suspension**; **0.5–1 mm** grains **creep** along the surface (about a third of the movement). Grains over 1 mm are left as a lag.',
      camera: { position: [30, 6, 18], target: [14, 2, 0] },
      select: 'suspension',
      cites: [C.we('s8–10')],
      check: {
        question: 'Wind blows over a soil holding 0.02 mm silt, 0.2 mm sand and 0.8 mm coarse sand. Which is carried farthest from the field?',
        options: ['The 0.02 mm silt', 'The 0.2 mm sand', 'The 0.8 mm coarse sand'],
        answer: 0,
        explain: 'Particles finer than 0.05 mm go into **suspension** and can travel far; the 0.2 mm sand hops by **saltation** and the 0.8 mm grains only **creep**.',
      },
    },
    {
      title: 'Windbreaks',
      body: 'A **shelterbelt** slows the near-ground wind in its lee below the threshold, so the soil there stays put; further downwind the wind recovers. The orange arrows show the slower lee profile.',
      camera: { position: [BREAK_X + 10, 8, 24], target: [BREAK_X + 8, 1.5, 0] },
      select: 'windbreak',
      params: { windbreak: true, H: 6 },
      cites: [C.we('s18–21')],
      check: {
        question: 'Where is the soil best protected by this shelterbelt?',
        options: ['Just upwind of the belt', 'In its lee, a few heights downwind', 'Far downwind, beyond 30 heights'],
        answer: 1,
        explain: 'The belt slows the near-ground wind below the **threshold** in its **lee**; farther downwind the wind recovers its speed and erosion starts again.',
      },
    },
    {
      title: 'Other controls',
      body: 'Keep the soil **moist or cloddy**, leave **standing stubble** and coarse residue, **roughen** the surface, and **strip-crop normal to the wind**. Each raises the threshold, slows the surface wind or traps moving grains.',
      camera: overview,
      select: 'strips',
      params: { strips: true, cover: 'standing' },
      cites: [C.we('s22–25')],
    },
  ],
}

export default scene
