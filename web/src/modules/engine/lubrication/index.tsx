import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { prepareLubeGeometry } from './geometry'
import { Lube3D } from './Lube3D'
import { CAM, DEFAULTS, FILTER, GALLERY, GAUGE, PUMP, RELIEF, ROCKER, useLube } from './model'
import { LubePanel } from './Panel'

const scene: SceneDef = {
  id: 'lubrication',
  title: 'Lubrication system',
  summary:
    'A four-cylinder diesel cut open to show its force-feed oil circuit — pump, relief valve, full-flow filter, main gallery and drillings to every bearing — and the circulating splash system for comparison. Pressures and flows follow engine speed, oil temperature and the relief-valve setting.',
  Viewport: Lube3D,
  Panel: LubePanel,
  camera: { position: [0.92, 0.57, 1.47], target: [-0.04, 0.08, -0.05] },
  extent: 0.9,
  floorY: -0.22,
  hatchScale: 0.006,
  timeScale: 1 / 20,
  cutPresets: [
    { id: 'half', label: 'Half section (front removed)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'gallery', label: 'Through the main gallery', planes: [{ normal: [0, 0, 1], pos: GALLERY.z }] },
    { id: 'transverse', label: 'Transverse, centre main bearing', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: 0 }], intersection: true },
    { id: 'all-moving', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [SRC.tb509('Ch 6, Figs 6.1–6.3'), SRC.supp509('lubrication: purposes, parts needing oil, SAE grades'), SRC.add509('petroil / oils')],
  reset: () => useLube.getState().reset(),
  prepare: () => Promise.all([prepareLubeGeometry(), import('@/machines/engine.geometry').then((m) => m.prepareEngine())]),
  applyParams: (p) => useLube.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Why an engine needs oil',
      body:
        'Oil keeps a film between every pair of rubbing surfaces. It **reduces friction**, **cools** the bearings and pistons, **seals** the rings and **cleans**, carrying dirt to the filter. This four-cylinder diesel is cut open to show how the oil gets everywhere.',
      camera: { position: [0.92, 0.57, 1.47], target: [-0.04, 0.08, -0.05] },
      cut: 'half',
      select: null,
      explode: 0,
      playing: true,
      timeScale: 1 / 20,
      params: { ...DEFAULTS },
      cites: [SRC.supp509('purposes of lubrication')],
    },
    {
      title: '1 · Strainer and gear pump',
      body:
        'Oil is drawn from the **sump** through a gauze **strainer** into a **gear pump** driven from the camshaft. The two gears carry oil round the outside of the casing from inlet to outlet, so the delivery rises with engine speed.',
      camera: { position: [-0.05, -0.02, 0.42], target: [PUMP.x + 0.02, PUMP.y, PUMP.z] },
      select: 'oil-pump',
      cut: 'half',
      cites: [SRC.tb509('Fig 6.2, p35')],
      check: {
        question: 'Engine speed doubles. Before the relief valve opens, what does the delivery of the gear pump do?',
        options: ['It roughly doubles', 'It stays about the same', 'It roughly halves'],
        answer: 0,
        explain: 'A gear pump is **positive displacement**: each turn carries a fixed volume round between the teeth and casing, so its delivery rises in step with speed.',
      },
    },
    {
      title: '2 · The pressure-relief valve',
      body:
        'A spring holds the **relief plunger** on its seat. When the pump pressure exceeds the setting — cold, thick oil or high speed — the plunger lifts and the surplus oil returns to the sump. Try the **Cold start** preset and watch it open.',
      camera: { position: [-0.1, 0.0, 0.35], target: [RELIEF.x, RELIEF.y, RELIEF.z] },
      select: 'relief-valve',
      params: { tempC: 10, rpm: 1800 },
      cites: [SRC.tb509('Fig 6.2 — relief valve')],
      check: {
        question: 'On a cold morning the oil is very thick. What does the relief valve do?',
        options: ['It stays shut so all the oil reaches the bearings', 'It closes off the filter to let the oil through', 'It lifts and spills the surplus back to the sump'],
        answer: 2,
        explain: 'Thick oil drives the pump pressure past the **spring setting** (5.5 bar here). The plunger lifts and returns the surplus to the sump, protecting the pump, filter and seals.',
      },
    },
    {
      title: '3 · Full-flow filter',
      body: 'All the delivered oil passes through the **filter element** before it reaches the bearings. A clogged element lowers the gallery pressure even though the pump works as hard as before.',
      camera: { position: [0.15, 0.1, 0.25], target: [FILTER.x, -0.05, FILTER.z] },
      select: 'oil-filter',
      cut: 'gallery',
      params: { tempC: 90, rpm: 1500 },
      cites: [SRC.tb509('Fig 6.2 — filter')],
      check: {
        question: 'The filter element slowly clogs. What does the gallery pressure gauge show?',
        options: ['Higher pressure, as the pump works harder', 'Lower pressure, as the element chokes the flow', 'No change, as the pump delivers the same'],
        answer: 1,
        explain: 'The pressure is lost across the **clogged element**, before the gallery. Less oil reaches the bearings, so the **gallery pressure falls** even though the pump works as hard.',
        reveal: { params: { filterClog: 5 } },
      },
    },
    {
      title: '4 · Main gallery and drillings',
      body:
        'The **main gallery** runs the length of the block. Drillings feed each **main bearing** and **camshaft bearing**; drillings in the crankshaft carry oil on from the mains to the **big ends**. Oil escaping from the big ends is flung onto the cylinder walls.',
      camera: { position: [0.43, 0.16, 0.68], target: [0, 0.02, -0.06] },
      select: 'oilways',
      cut: 'transverse',
      cites: [SRC.tb509('Fig 6.2 — main gallery, oilways')],
    },
    {
      title: '5 · Valve gear and the return',
      body: 'A riser feeds the hollow **rocker shaft**. Oil leaks out at each rocker and drains back to the sump down the push-rod holes. The **gauge** reads the gallery pressure.',
      camera: { position: [0.25, 0.62, 0.5], target: [0, ROCKER.y - 0.05, ROCKER.z] },
      select: 'rocker-shaft',
      cut: 'half',
      cites: [SRC.tb509('Fig 6.2'), SRC.supp509('parts needing oil')],
    },
    {
      title: 'The oil-pressure gauge',
      body: 'The gauge is the driver’s check on the system. **Low pressure** means low oil level, a worn pump or bearings, a blocked filter, or very hot, thin oil.',
      camera: { position: [-0.2, 0.25, 0.35], target: [GAUGE.x, GAUGE.y, GAUGE.z] },
      select: 'pressure-gauge',
      params: { tempC: 110, rpm: 600 },
      cites: [SRC.tb509('Fig 6.2 — pressure gauge')],
    },
    {
      title: 'Circulating splash system',
      body:
        'In the older **splash** system the camshaft-driven pump only keeps a set of **troughs** full. A **dipper** on each big-end cap dips in every revolution and splashes oil over the cylinder walls, pins and bearings.',
      camera: { position: [0.65, 0.11, 0.87], target: [0, -0.08, 0] },
      select: 'conrods',
      cut: 'half',
      params: { mode: 'splash', tempC: 90, rpm: 1200 },
      cites: [SRC.tb509('Fig 6.1')],
    },
    {
      title: 'Crankcase breather',
      body: 'Gas leaking past the rings (blow-by) would pressurise the crankcase and push oil past the seals. The **breather** vents it through a filter.',
      camera: { position: [0.75, 0.6, 0.55], target: [0.3, 0.35, CAM.z] },
      select: 'breather',
      params: { mode: 'force' },
      cites: [SRC.tb509('Fig 6.3')],
    },
  ],
}

export default scene
