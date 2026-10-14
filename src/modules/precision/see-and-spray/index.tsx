import type { CameraPose, SceneDef } from '@/modules/types'
import { DEFAULTS, specOf, STRIP, useSeeSpray, type SeeSprayParams } from './model'
import { pickParams } from '@/content/compare'
import { expected } from '@/physics/spotspray'
import { SeeSprayPanel } from './Panel'
import { SeeSpray3D, resetScene } from './Scene3D'

const CHASE: CameraPose = { position: [-9, 5.5, 8], target: [-2, 0.3, 0] }
const LOW: CameraPose = { position: [-4.5, 1.6, 3.5], target: [-1.8, 0.2, 1.5] }

const scene: SceneDef = {
  id: 'see-and-spray',
  title: 'See-and-spray weed targeting',
  summary:
    'Cameras on a 12 m boom look ahead of the nozzles, pick out weeds between the crop rows and fire just the nozzle above each one. Change the speed, the latency, the detection rate and the weed load, and compare the chemical used and the weeds killed with blanket spraying.',
  Viewport: SeeSpray3D,
  Panel: SeeSprayPanel,
  camera: CHASE,
  follow: 'tractor',
  extent: 16,
  floorY: -0.6,
  hatchScale: 0.05,
  timeScale: 1,
  cutPresets: [{ id: 'centre', label: 'Centre-line section', planes: [{ normal: [0, 0, -1], pos: 0 }] }],
  defaultPreset: undefined,
  reset: () => {
    useSeeSpray.getState().reset()
    resetScene()
  },
  compare: {
    title: 'blanket vs spot spraying',
    current: () => pickParams(DEFAULTS, useSeeSpray.getState(), ['run']),
    variants: [
      { label: 'Blanket', params: { mode: 'blanket' } },
      { label: 'Spot', params: { mode: 'spot', compensate: true } },
      { label: 'Spot, no lag fix', params: { mode: 'spot', compensate: false } },
    ],
    metrics: (raw) => {
      const p = raw as unknown as SeeSprayParams
      const e = p.mode === 'blanket' ? { control: 1, saving: 0 } : expected(specOf(p), p.density, p.speed)
      return [
        { label: 'Weeds killed', value: e.control * 100, unit: '%', digits: 0, better: 'high' },
        { label: 'Chemical used', value: (1 - e.saving) * 100, unit: '% of blanket', digits: 0, better: 'low' },
        { label: 'Area sprayed', value: ((1 - e.saving) * STRIP.W * 1000) / 10000, unit: 'ha per km', digits: 2, better: 'low' },
      ]
    },
  },
  applyParams: (p) => useSeeSpray.setState({ ...DEFAULTS, ...(p as Partial<SeeSprayParams>), run: useSeeSpray.getState().run + 1 }),
  tour: [
    {
      title: 'Spraying only the weeds',
      body: 'A blanket sprayer wets every square metre to hit weeds that cover a few per cent of it. **See-and-spray** booms carry a camera every metre and a nozzle every 50 cm, each with its own fast valve.',
      camera: CHASE,
      cut: false,
      select: 'boom',
      playing: true,
      params: {},
    },
    {
      title: 'Seeing the weed',
      body: 'Each camera looks a little ahead of the nozzles (blue line). Its processor separates weed from crop and soil by colour and shape. Yellow squares are weeds it found; red squares are mistakes.',
      camera: LOW,
      select: 'cams',
      params: {},
    },
    {
      title: 'Hitting it on time',
      body: 'Processing and the valve take about a tenth of a second — at 12 km/h the boom moves 40 cm in that time. The controller fires **early** to cancel it. Switch that off and the spray lands behind every weed.',
      camera: LOW,
      select: 'nozzles',
      params: { compensate: false },
    },
    {
      title: 'Where it pays',
      body: 'In a fairly clean field more than 90 % of the chemical is saved. As weeds get thicker the patches join up and the saving shrinks — at very high weed loads, blanket spraying is the right tool.',
      camera: CHASE,
      select: 'weeds',
      params: { density: 3 },
    },
  ],
}

export default scene
