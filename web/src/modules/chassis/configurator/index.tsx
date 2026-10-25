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
      check: {
        question: 'Rear ballast and front-wheel assist stop the 75 kW tractor spinning at 35 kN, with the same engine. Why does that work?',
        options: ['It puts more weight on driven wheels, so they grip', 'It raises the torque the engine sends to the wheels', 'It lowers the rolling resistance of the tyres'],
        answer: 0,
        explain: 'Spinning is a **traction** limit: the pull a tyre can pass to the soil depends on the weight it carries. Ballast and driving the front axle put more weight on driven wheels; engine power was never the problem.',
      },
    },
    {
      title: 'Too much of a good thing',
      body: 'With 2 t of rear weights slip is low, but the **front axle goes light** — hard to steer — and the ground pressure passes 110 kPa: the subsoil compacts and next year’s crop suffers.',
      camera: SIDE,
      select: 'ballast-rear',
      params: { rear: 2000 },
      check: {
        question: 'With 2 t of weights added to the same rear tyres, what happens to the pressure on the ground under them?',
        options: ['It falls, because slip drops', 'It rises, so the subsoil compacts', 'It stays about the same'],
        answer: 1,
        explain: 'More load on the same tyres raises the contact pressure and pushes the stress deeper. Here it passes **110 kPa**, enough to compact the subsoil.',
      },
    },
    {
      title: 'Gears versus a CVT',
      body: 'The 8-speed box cannot hit 7 km/h: one gear is too slow, the next too fast. A **CVT** reaches any speed, but it loses more in its hydrostatic branch — the tractor gets there using more fuel.',
      camera: SIDE,
      select: null,
      params: { trans: 'cvt' },
      check: {
        question: 'The job needs 7 km/h, between two gears of the 8-speed box. What does a CVT trade for hitting it exactly?',
        options: ['It reaches 7 km/h but burns more fuel', 'It reaches 7 km/h and burns less fuel', 'It cannot pull as hard as the gearbox'],
        answer: 0,
        explain: 'A **CVT** reaches any speed, but part of the power passes through its hydrostatic branch, which loses more than gears do, so the same job costs more fuel.',
      },
    },
  ],
}

export default scene
