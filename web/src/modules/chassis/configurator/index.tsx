import type { CameraPose, SceneDef } from '@/modules/types'
import { cleanContext } from '@/content/context'
import { pickParams } from '@/content/compare'
import { DEFAULTS, SOILS, test, useConfig, type ConfigParams } from './model'
import { ConfiguratorPanel } from './Panel'
import { Configurator3D, resetScene } from './Scene3D'

const SIDE: CameraPose = { position: [-5, 6, 15], target: [-1.5, 0.9, 0] }
const REAR: CameraPose = { position: [-7, 2.2, 3.5], target: [0, 0.4, 0] }

const scene: SceneDef = {
  id: 'configurator',
  title: 'Tractor configurator',
  summary:
    'Build a tractor — engine, transmission, 2WD or front-wheel assist, tyres and ballast — then give it a job: a pull, a speed and a soil. It is solved with the same weight-transfer, traction and engine models as the rest of the app, so a mismatched build spins, stalls, lugs or ruts the field just as a real one would.',
  Viewport: Configurator3D,
  Panel: ConfiguratorPanel,
  camera: SIDE,
  follow: 'tractor',
  extent: 14,
  floorY: -0.6,
  hatchScale: 0.05,
  timeScale: 1,
  cutPresets: [{ id: 'centre', label: 'Centre-line section', planes: [{ normal: [0, 0, -1], pos: 0 }] }],
  defaultPreset: undefined,
  reset: () => {
    useConfig.getState().reset()
    resetScene()
  },
  context: () => {
    const p = useConfig.getState()
    const r = test(p)
    return cleanContext({ rpm: r.rpm || undefined, slip: r.slip, pullKN: p.pull, speedKmh: r.speed, CI: SOILS[p.soil].CI / 1000, tyre: p.tyre })
  },
  compare: {
    title: '2WD vs front-wheel assist, bias vs radial',
    current: () => pickParams(DEFAULTS, useConfig.getState()),
    variants: [
      { label: '2WD bias', params: { drive: '2wd', tyre: 'bias' } },
      { label: 'MFWD bias', params: { drive: 'mfwd', tyre: 'bias' } },
      { label: 'MFWD radial', params: { drive: 'mfwd', tyre: 'radial' } },
    ],
    metrics: (p) => {
      const r = test(p as unknown as ConfigParams)
      const t = r.spin ? 'spins' : r.stalled ? 'stalls' : undefined
      return [
        { label: 'Slip', value: r.slip * 100, unit: '%', digits: 1, better: 'low', text: r.spin ? 'spins' : undefined },
        { label: 'Speed', value: r.speed, unit: 'km/h', digits: 1, better: 'high', text: t },
        { label: 'Tractive efficiency', value: r.TE * 100, unit: '%', digits: 0, better: 'high', text: t },
        { label: 'Fuel', value: r.fuel, unit: 'L/h', digits: 1, better: 'low', text: t },
        { label: 'Rut depth', value: r.rut * 100, unit: 'cm', digits: 1, better: 'low' },
      ]
    },
  },
  applyParams: (p) => useConfig.setState({ ...DEFAULTS, ...(p as Partial<ConfigParams>) }),
  tour: [
    {
      title: 'Matching a tractor to the job',
      body: 'A tractor is a compromise: enough **engine** for the power, enough **weight on driven wheels** for the grip, the right **gear** for the speed — without crushing the soil. Set the job, then change the build and watch every check.',
      camera: SIDE,
      cut: false,
      select: null,
      playing: true,
      params: {},
    },
    {
      title: 'Grip comes from weight',
      body: 'Pull 35 kN with the 75 kW tractor and the rear wheels **spin**: the engine has the power but the tyres cannot pass it to the soil. Add rear ballast or engage **front-wheel assist** to put more weight on driven wheels.',
      camera: REAR,
      select: 'ballast-rear',
      params: { pull: 35, target: 6, rear: 800, drive: 'mfwd' },
    },
    {
      title: 'Too much of a good thing',
      body: 'With 2 t of rear weights slip is low, but the **front axle goes light** — hard to steer — and the ground pressure passes 110 kPa: the subsoil compacts and next year’s crop suffers.',
      camera: SIDE,
      select: 'ballast-rear',
      params: { rear: 2000 },
    },
    {
      title: 'Gears versus a CVT',
      body: 'The 8-speed box cannot hit 7 km/h: one gear is too slow, the next too fast. A **CVT** reaches any speed, but it loses more in its hydrostatic branch — the tractor gets there using more fuel.',
      camera: SIDE,
      select: null,
      params: { trans: 'cvt' },
    },
  ],
}

export default scene
