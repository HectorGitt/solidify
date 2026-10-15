import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, PRESETS, usePerf, type PerfParams } from './model'
import { PerformancePanel } from './Panel'
import { FLOOR_Y, Performance3D } from './Scene3D'

const preset = (id: string): Record<string, unknown> => ({ ...DEFAULTS, ...PRESETS.find((p) => p.id === id)!.params, preset: id })

const scene: SceneDef = {
  id: 'performance',
  title: 'Engine performance calculator',
  summary:
    'A tractor diesel on a test bed, coupled to a cradled brake dynamometer. Enter bore, stroke, clearance, speed, torque, fuel and air data and get PD, CR, IP/BP/FP, bmep and imep, the efficiencies, sfc and the heat balance — with the full working.',
  Viewport: Performance3D,
  Panel: PerformancePanel,
  camera: { position: [2.55, 1.35, 1.15], target: [0.05, 0.28, -0.2] },
  extent: 1.8,
  floorY: FLOOR_Y,
  hatchScale: 0.009,
  timeScale: 1 / 20,
  cutPresets: [
    { id: 'long', label: 'Longitudinal (engine and dynamometer)', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'plan', label: 'Plan section at the crank axis', planes: [{ normal: [0, 1, 0], pos: 0 }] },
    { id: 'all-moving', label: 'Section everything', planes: [{ normal: [1, 0, 0], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'long',
  cites: [
    SRC.misc509('p2–7, Examples 1–7'),
    SRC.tb509('p9 PD, TCV, CR; §3.3 heat balance'),
    SRC.supp509('heat balance 40/30/30; calorific values'),
    SRC.exam509('2017/18, 2021/22, 2022/23'),
    SRC.tests502('p4–6 dynamometers'),
  ],
  reset: () => usePerf.getState().reset(),
  prepare: () => import('@/machines/engine.geometry').then((m) => m.prepareEngine()),
  applyParams: (p) => usePerf.getState().set(p as Partial<PerfParams> & { preset?: string | null }),
  tour: [
    {
      title: 'An engine on the test bed',
      body:
        'To measure an engine’s performance it is run on a **dynamometer**, which absorbs its output. Brake power comes from the measured speed and torque, **BP = 2πNT/60**; fuel and air flows give the efficiencies. Every number in the Controls panel is worked from these measurements.',
      camera: { position: [2.55, 1.35, 1.15], target: [0.05, 0.28, -0.2] },
      cut: 'long',
      select: null,
      explode: 0,
      playing: true,
      params: { ...DEFAULTS, preset: null },
      cites: [SRC.misc509('p2 BP = 2πNT/60'), SRC.tests502('p2–4 power definitions')],
    },
    {
      title: 'The cradled dynamometer',
      body:
        'The rotor churns water inside the casing and turns the engine’s work into heat. The casing is carried on **trunnion bearings**, so the reaction torque tries to turn it; a **torque arm** of length R pressing on a **scale** holds it still. Torque **T = F × R**.',
      camera: { position: [1.23, 0.57, -0.26], target: [0.15, 0.1, -0.76] },
      select: 'dyno',
      cites: [SRC.tests502('p6, Fig 15.3 hydraulic dynamometer')],
    },
    {
      title: 'Swept volume and compression ratio',
      body:
        'A typical tractor engine: bore 100 mm, stroke 124 mm, clearance volume = PD/6. **PD = π/4·D²·L ≈ 973 400 mm³**, TCV = PD + CV, and **CR = TCV/CV = 7.0**. Open the Controls panel to see the working.',
      camera: { position: [1.01, 0.66, 0.88], target: [0, 0.23, 0] },
      select: 'engine',
      params: preset('mahindra'),
      cites: [SRC.tb509('p9')],
    },
    {
      title: 'Brake power, bmep and thermal efficiency',
      body:
        'An 8-cylinder engine gives **160 N·m at 4500 rpm** on 20 kg/h of fuel. **BP = 75.4 kW**, **bmep = BP·60·n/(L·A·N·k) = 2.667 bar** and **ηbth = BP/(ṁf·HV) = 30.85 %**.',
      camera: { position: [2.55, 1.35, 1.15], target: [0.05, 0.28, -0.2] },
      select: 'torque-arm',
      params: preset('ex7'),
      cites: [SRC.misc509('Example 7')],
    },
    {
      title: 'Power from the air the engine breathes',
      body:
        'This example works the other way: the engine can only burn the fuel its air can support. Air inducted = **ρ·ηv·Vd·N/(60n)**, fuel = air ÷ A/F, and **BP = ηbth·ṁf·HV = 167.3 kW**, **bmep = 887.5 kPa**.',
      select: 'engine',
      params: preset('ex4'),
      cites: [SRC.misc509('Example 4')],
    },
    {
      title: 'Indicated power and friction',
      body:
        'Gas pressure on the pistons gives the **indicated power**; friction, pumping and auxiliaries take some of it before it reaches the flywheel: **FP = IP − BP**, **ηm = BP/IP = bmep/imep**. For a large genset engine: bmep 300 kPa, ηm 75 % → **imep 400 kPa**.',
      select: 'crank',
      params: preset('genset'),
      cites: [SRC.misc509('p2–3 IP, FP, ηm'), SRC.exam509('2022/23 Q2')],
    },
    {
      title: 'Where the fuel energy goes',
      body:
        'Only about a quarter to a third of the fuel energy reaches the flywheel. The ribbons are drawn to scale: roughly **40 % exhaust, 30 % cooling, 30 % work**, or in another typical split exhaust 31 %, cooling 40 %, friction 5.5 %.',
      camera: { position: [1.72, 1.38, 1.22], target: [0.1, 0.3, 0] },
      select: 'heat-balance',
      params: { ...DEFAULTS, preset: null },
      cites: [SRC.supp509('heat balance'), SRC.tb509('§3.3')],
    },
  ],
}

export default scene
