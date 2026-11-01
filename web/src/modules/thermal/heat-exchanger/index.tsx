import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, Exchanger3D, ExchangerPanel, FLOOR, useHx } from './Rig'

const HX = (where: string) => cite('AEE306', 'heat exchangers.pdf', where)
const TUT = (where: string) => cite('AEE306', 'heat exchanger tutorials.docx', where)
const view = { position: [1.1, 1.3, 5.2] as [number, number, number], target: [0, -0.08, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'heat-exchanger',
  title: 'Double-pipe heat exchanger',
  summary: 'Run a hot and a cold stream through a tube in a tube, reverse one with the valves, and read the temperatures along the pipe.',
  Viewport: Exchanger3D,
  Panel: ExchangerPanel,
  camera: view,
  extent: 2.6,
  floorY: FLOOR,
  hatchScale: 0.012,
  timeScale: 1,
  defaultPreset: 'half',
  cutPresets: [{ id: 'half', label: 'Lengthwise', planes: [{ normal: [0, 0, 1], pos: 0 }] }],
  cites: [HX('parallel and counter flow; the log-mean temperature difference'), TUT('tutorial answers')],
  reset: () => useHx.getState().reset(),
  applyParams: (p) => useHx.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'A tube inside a tube',
      body: 'The hot stream runs down the inner tube and the cold stream through the space around it. Heat crosses the wall between them. Nothing mixes: only energy passes.',
      camera: view,
      cut: 'half',
      select: 'inner',
      explode: 0,
      params: { ...DEFAULTS },
      cites: [HX('double-pipe exchanger')],
    },
    {
      title: 'Parallel flow',
      body: 'Both streams enter at the same end. The difference starts large and shrinks fast, and the two lines close on each other. The cold stream can never leave hotter than the hot one.',
      select: 'cold',
      params: { ...DEFAULTS, flow: 'parallel' },
      cites: [HX('parallel flow')],
    },
    {
      title: 'Counter flow',
      body: 'Open the other valve and the cold stream runs the other way. Now it leaves beside the hot inlet, and the difference stays more even along the pipe, so the same duty needs **less area**.',
      select: 'cold',
      params: { ...DEFAULTS, flow: 'counter' },
      cites: [TUT('areas for parallel and counter flow')],
      check: {
        question: 'For the same end temperatures, which arrangement needs less area?',
        options: ['Parallel flow', 'Counter flow', 'They need the same'],
        answer: 1,
        explain: 'Counter flow has the larger log-mean temperature difference, and A = Q/(U ΔTm).',
      },
    },
  ],
}

export default scene
