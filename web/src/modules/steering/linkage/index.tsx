import type { SceneDef } from '@/modules/types'
import { BOX, C, DEFAULTS, useSteer } from './model'
import { SteeringPanel } from './Panel'
import { Steering3D } from './Scene3D'

type V = [number, number, number]
const view = { position: [3.9, 1.9, 3.0] as V, target: [1.3, 0.6, 0] as V }

const scene: SceneDef = {
  id: 'linkage',
  title: 'Manual steering linkage',
  summary:
    'The manual steering linkage on the shared tractor: steering wheel, column, steering box, drop arm, drag link, steering arm, track-rod arms and track rod, solved as a real linkage. Toe-in is checked with an A/B gauge, and changing the track width shows why the track rod must be reset.',
  Viewport: Steering3D,
  Panel: SteeringPanel,
  camera: view,
  extent: 4.5,
  floorY: 0,
  hatchScale: 0.03,
  timeScale: 1 / 2,
  cutPresets: [
    { id: 'plan', label: 'Plan below the bonnet', planes: [{ normal: [0, 1, 0], pos: 1.05 }] },
    { id: 'side', label: 'Side cut through the box', planes: [{ normal: [0, 0, 1], pos: BOX.armZ + 0.12 }] },
    { id: 'axle', label: 'Plan at hub height', planes: [{ normal: [0, 1, 0], pos: 0.5 }] },
  ],
  cites: [...C.manual, ...C.toe, ...C.box, ...C.care, ...C.axle],
  reset: () => useSteer.getState().reset(),
  applyParams: (p) => useSteer.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Manual steering',
      body:
        'The driver’s effort reaches the front wheels through a chain of parts: **steering wheel → steering box → drop arm → drag link → steering arm → stub axle**. A **track rod** joins the two stub axles so both wheels turn together.\n\nThe wheel is sweeping from lock to lock; click any part to see what it does.',
      camera: view,
      cut: false,
      select: 'manual-steering',
      playing: true,
      params: { ...DEFAULTS },
      cites: C.manual,
    },
    {
      title: 'Steering box and drop arm',
      body:
        'The column turns a worm (or a recirculating-ball nut) in the **steering box**. It swings the rocker shaft and **drop arm** through only about ±30° for 1¼ turns of the wheel, which multiplies the driver’s effort. The Steering boxes scene shows the inside.',
      camera: { position: [1.6, 1.4, 1.6], target: [0.62, 0.85, 0.35] },
      select: 'drop-arm',
      cut: 'plan',
      cites: [...C.manual, ...C.box],
    },
    {
      title: 'Drag link and steering arm',
      body:
        'The **drag link**, with a ball joint at each end, runs forward from the drop arm to the **steering arm** on one stub axle and turns it about the kingpin.',
      camera: { position: [2.6, 1.3, 1.9], target: [1.5, 0.6, 0.45] },
      select: 'drag-link',
      cut: 'plan',
      cites: C.manual,
    },
    {
      title: 'Track rod and track-rod arms',
      body:
        'The **track rod** joins the two **track-rod arms**, so the other wheel follows. The arms are angled inward, so on a turn the inner wheel turns more than the outer — compare them with the Ackermann ideal in Controls.',
      camera: { position: [2.9, 2.0, 0.0], target: [1.85, 0.35, 0] },
      select: 'track-rod',
      cut: 'axle',
      params: { sweep: true },
      cites: C.manual,
      check: {
        question: 'On a left turn, why must the inner (left) wheel turn more than the outer one?',
        options: ['It runs on a smaller circle round the same centre', 'It carries more weight while turning', 'The drag link pushes it directly'],
        answer: 0,
        explain: 'For both tyres to roll without scrubbing, their axles must point at **one turning centre**. The inner wheel is closer to it, so it needs the larger angle.',
      },
    },
    {
      title: 'Toe-in',
      body:
        'With the wheels straight, the distance between the rims at hub height in front (**A**, yellow) should be **3–6 mm less** than behind (**B**, orange). It is set by turning the track rod in its threaded ends. Here the toe is exaggerated ×10 so you can see it.',
      camera: { position: [3.4, 1.5, 0.0], target: [1.88, 0.38, 0] },
      select: 'toe-gauge',
      cut: false,
      params: { sweep: false, wheel: 0, exaggerate: true },
      cites: C.toe,
      check: {
        question: 'The gauge reads A = 1504 mm in front and B = 1500 mm behind. What do the wheels have?',
        options: ['Toe-in, within the 3–6 mm', 'Toe-out of 4 mm', 'No toe at all'],
        answer: 1,
        explain: 'Toe-in means the rims are closer at the front (A less than B). Here A is larger, so the wheels splay outwards: **toe-out**, corrected by adjusting the track rod.',
      },
    },
    {
      title: 'Changing the track width',
      body:
        'The telescopic front axle is extended 80 mm, but the track rod is left at its old length: the wheels are pulled into heavy **toe-out**. That is why the track rod must be **reset whenever the track width is changed**.',
      camera: { position: [3.4, 1.8, 0.4], target: [1.88, 0.38, 0] },
      select: 'track-rod',
      params: { sweep: false, wheel: 0, trackMM: 80, rodReset: false, exaggerate: false },
      cites: [...C.manual, ...C.axle],
      check: {
        question: 'The axle has been extended 80 mm. What must be done to the track rod to restore the toe-in?',
        options: ['Shorten it by about 80 mm', 'Leave it: the toe recovers', 'Lengthen it by about 80 mm'],
        answer: 2,
        explain: 'Each side of the axle moved out 40 mm, taking its track-rod arm with it, so the rod must be **lengthened by about 80 mm** and the toe-in then reset.',
        reveal: { params: { rodReset: true } },
      },
    },
    {
      title: 'Try it',
      body:
        'Open **Controls**: steer by hand, change the track-rod length and the track, and use the button to set the toe-in. Remember the service intervals: grease the linkage every **10 h**, check the box oil (SAE 90) every **200 h**.',
      camera: view,
      select: null,
      params: { ...DEFAULTS },
      cites: C.care,
    },
  ],
}

export default scene
