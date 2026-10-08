import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { prepareIgnitionGeometry } from './geometry'
import { CAMERAS, DEFAULTS, FLOOR, PLUG_X, STARTER_C, useIgn } from './model'
import { IgnitionPanel } from './Panel'
import { Ignition3D } from './Scene3D'

const scene: SceneDef = {
  id: 'ignition',
  title: 'Ignition, starting & charging',
  summary:
    'Five assemblies: the battery (coil) ignition circuit of a four-cylinder engine firing 1-3-4-2, a magneto with impulse coupling, hot and cold spark plugs, the starter motor and solenoid, and the battery, dynamo and alternator.',
  Viewport: Ignition3D,
  Panel: IgnitionPanel,
  camera: CAMERAS.coil,
  extent: 0.6,
  floorY: FLOOR,
  hatchScale: 0.004,
  timeScale: 1 / 50,
  cutPresets: [
    { id: 'z0', label: 'Half section (z = 0)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'plugs', label: 'Along the plugs (coil system)', planes: [{ normal: [-1, 0, 0], pos: -PLUG_X }] },
    { id: 'x0', label: 'Along the magneto axis', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'starter', label: 'Along the starter axis', planes: [{ normal: [1, 0, 0], pos: STARTER_C[0] }] },
    { id: 'all-moving', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'z0',
  cites: [SRC.l4_509('ignition system'), SRC.supp509('magneto ignition'), SRC.tb509('ch.5, Figs 5.1–5.9')],
  reset: () => useIgn.getState().reset(),
  prepare: prepareIgnitionGeometry,
  applyParams: (p) => useIgn.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Battery (coil) ignition',
      body:
        'A spark needs **10–15 kV** to jump the plug gap. The coil makes it by **mutual induction**: the primary circuit (6/12 V battery, ammeter, switch, **200–300-turn** primary, contact breaker, condenser) is interrupted, and the collapsing field induces a high voltage in the **≈21 000-turn** secondary.',
      camera: CAMERAS.coil,
      cut: 'z0',
      select: 'coil',
      explode: 0,
      playing: true,
      timeScale: 1 / 50,
      params: { sub: 'coil', rpm: 600, advance: 25 },
      cites: [SRC.l4_509('primary and secondary circuits'), SRC.tb509('§5.2.1')],
    },
    {
      title: 'Points, cam and condenser',
      body:
        'The **four-cornered cam** (four cylinders — a six has a hexagonal cam) opens the **points** once per cylinder. The **condenser** absorbs the surge as they open, reducing arcing. The cam turns at half engine speed.',
      camera: { position: [0.3, 0.06, 0.2], target: [0.135, -0.035, 0] },
      select: 'breaker',
      cites: [SRC.l4_509('contact breaker cam has 4 corners'), SRC.tb509('Table 5.1')],
    },
    {
      title: 'Distributor: sparks in firing order, 25° BTDC',
      body:
        'The **rotor arm** passes each cap segment in turn, sending the HT pulse to plugs **1, 3, 4, 2**. The spark is timed about **25° before TDC** so the mixture has time to burn.',
      camera: { position: [0.5, 0.35, 0.35], target: [0.08, 0.02, 0] },
      select: 'rotor',
      cites: [SRC.tb509('§5.2.1, §5.5')],
    },
    {
      title: 'Magneto and impulse coupling',
      body:
        'A magneto needs no battery: a rotating **permanent magnet** reverses the flux in the armature every half turn. Turned slowly it gives no spark, so the **impulse coupling** holds the rotor with a **pawl** against the **stop pin** while a spring winds up, then releases it to flick the magneto past the firing point.',
      camera: CAMERAS.magneto,
      cut: 'x0',
      select: 'impulse-hub',
      params: { sub: 'magneto', crankRpm: 100 },
      timeScale: 1 / 20,
      cites: [SRC.tb509('§5.2.2, Fig 5.3'), SRC.supp509('magneto components')],
    },
    {
      title: 'Hot and cold plugs',
      body:
        'Two plugs cut in half. The **hot plug** (left) has a longer porcelain nose, so heat escapes slowly — for **light loads**; the **cold plug** has a short nose — for **heavy loads**. The gap is set with a feeler gauge to about **0.6 mm**.',
      camera: CAMERAS.plug,
      cut: 'z0',
      select: 'plug-hot',
      params: { sub: 'plug', load: 0.3 },
      timeScale: 1 / 50,
      cites: [SRC.tb509('§5.4, Fig 5.4')],
    },
    {
      title: 'Starter motor',
      body:
        'Turn the key (Controls): the **solenoid** pulls its plunger, the lever throws the **pinion** into the flywheel **ring gear**, and the motor cranks the engine 12 : 1 slower than itself. Once the engine starts the pinion is retracted.',
      camera: CAMERAS.starter,
      cut: 'starter',
      select: 'pinion',
      params: { sub: 'starter', key: true },
      timeScale: 1 / 20,
      cites: [SRC.tb509('§5.6.4, Fig 5.8')],
    },
    {
      title: 'Battery, dynamo and alternator',
      body:
        'The cutaway battery has six 2 V cells of **PbO₂ (+)** and **spongy Pb (−)** plates in sulphuric acid of SG **1.27**. The **dynamo** uses a commutator and brushes; the **alternator** a rotating claw-pole field, stator and diodes — and it charges from a lower engine speed.',
      camera: CAMERAS.charging,
      cut: 'z0',
      select: 'battery-x',
      params: { sub: 'charging', key: false, rpm: 900, loadA: 12 },
      cites: [SRC.tb509('§5.6.1–5.6.3, Figs 5.5–5.7')],
    },
  ],
}

export default scene
