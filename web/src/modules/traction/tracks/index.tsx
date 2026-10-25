import type { SceneDef } from '@/modules/types'
import { DEFAULTS, DIM, TT, YI, YS, useTracks } from './model'
import { TracksPanel } from './Panel'
import { Tracks3D } from './Tracks3D'

const cam = { position: [1.9, 1.5, 3.1] as [number, number, number], target: [0, 0.4, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'tracks',
  title: 'Crawler undercarriage',
  summary:
    'One side of a crawler undercarriage running: endless track of links, bushings, pins and shoes over a hunting-tooth sprocket, front idler, track and carrier rollers, with the recoil spring and grease adjuster. Set the track tension and watch the sag, change shoes and chain type, and misalign the idler.',
  Viewport: Tracks3D,
  Panel: TracksPanel,
  camera: cam,
  extent: 3.2,
  floorY: -0.06,
  hatchScale: 0.012,
  timeScale: 1 / 4,
  cutPresets: [
    { id: 'half', label: 'Half section (inside the frame)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'roller', label: 'Across the track at a roller', planes: [{ normal: [1, 0, 0], pos: 0 }], sectionMoving: true },
    { id: 'idler', label: 'Across the front idler', planes: [{ normal: [1, 0, 0], pos: 1.25 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [TT('p47–54 (Tracks, Part 2), Figs 1–14')],
  reset: () => {
    useTracks.getState().reset()
  },
  applyParams: (p) => useTracks.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Tracks are roller chains with shoes',
      body: 'A crawler’s **undercarriage** has seven basic parts: the endless **track**, the **drive sprocket**, the **rollers**, the **front idler**, the **tension mechanism**, the **roller guards** and the **frame**. One set on each side, driven by the final drives, supports and moves the machine.\n\nIt can be 20 % of the purchase cost and 50 % of the service cost.',
      camera: cam,
      cut: 'half',
      select: null,
      explode: 0,
      playing: true,
      params: { ...DEFAULTS },
      cites: [TT('p47–48, Figs 2–3')],
    },
    {
      title: 'Links, bushings and pins',
      body: 'Each section is a **pair of links** with a **bushing** pressed in at one end and a **pin** at the other; the pin turns inside the next section’s bushing. One **master pin**, held by a snap ring, comes out to split the track. A **shoe** is bolted to every section.',
      camera: { position: [0.5, 0.35, 1.0], target: [0.2, 0.1, 0.05] },
      select: 'bushings',
      cites: [TT('p48–49, Fig 4')],
    },
    {
      title: 'Flush and interlocking chains',
      body: '**Flush** chains have bushings flush with the link ends. **Interlocking** chains run the bushings into counterbores in the links — less grit gets between pin and bushing and the contact area is larger, so they last longer.',
      camera: { position: [0.5, 0.35, 1.0], target: [0.2, 0.1, 0.05] },
      cut: 'roller',
      select: 'links',
      params: { chain: 'interlocking' },
      cites: [TT('p50, Fig 6')],
    },
    {
      title: 'The hunting-tooth sprocket',
      body: 'The sprocket has an **odd number of teeth** (25) at half the chain pitch: every other tooth carries a bushing round. After one revolution the chain has moved 12½ links, so each tooth drives only on **alternate revolutions** — watch the yellow-marked tooth and the Live readout.',
      camera: { position: [-1.0, 0.8, 1.6], target: [DIM.xs, YS, 0] },
      cut: 'half',
      select: 'sprocket',
      cites: [TT('p50 — drive sprocket')],
      check: {
        question: 'Suppose the sprocket had 24 teeth at half the chain pitch instead of 25. What would change?',
        options: ['The same 12 teeth would do all the driving', 'Every tooth would still drive on alternate turns', 'The chain would no longer fit the sprocket'],
        answer: 0,
        explain: 'With an even count the chain moves exactly 12 links per turn, so the bushings land on the same **12 teeth** every time and those wear twice as fast. The odd hunting-tooth count shares the work.',
      },
    },
    {
      title: 'Rollers carry the machine',
      body: 'The small, closely spaced **track rollers** carry the weight and spread it over the whole bottom of the track — great traction and flotation. The **carrier roller** holds up the top strand so it does not sag and whip. **Roller guards** keep rocks out and guide the track.',
      camera: { position: [0.6, 0.5, 1.7], target: [0, 0.3, 0] },
      select: 'track-rollers',
      cut: 'roller',
      cites: [TT('p50 — rollers, roller guards')],
    },
    {
      title: 'Tension: recoil spring and grease adjuster',
      body: 'The **front idler** slides on the frame against the **recoil spring**. Pumping grease into the **adjuster** pushes it forward; turning the relief valve out lets it back. Set about **1 in of sag** halfway between carrier roller and front idler.',
      camera: { position: [1.1, 0.9, 1.5], target: [0.6, 0.55, 0] },
      select: 'tension',
      cut: 'half',
      params: { adjust: 0 },
      cites: [TT('p50'), TT('p52, Fig 11')],
      check: {
        question: 'You pump grease into the adjuster. What happens to the sag of the top strand?',
        options: ['It increases', 'It decreases', 'It stays the same'],
        answer: 1,
        explain: 'Grease pushes the **front idler** forward, lengthening the path the track must wrap round, so the chain is drawn tighter and the sag falls.',
        reveal: { params: { adjust: 5 } },
      },
    },
    {
      title: 'Too tight, too loose',
      body: '**Too tight**: friction at pins and bushings wears everything, robs horsepower and can fuse pins. **Too loose** (shown): the track whips at speed, comes off in turns and lets the sprocket jump teeth.',
      camera: { position: [1.4, 1.1, 2.4], target: [0.4, 0.55, 0] },
      select: 'track',
      params: { adjust: -25, speed: 8 },
      cites: [TT('p53, Fig 12')],
      check: {
        question: 'Which sign points to a track that is too tight rather than too loose?',
        options: ['The track whips and comes off in turns', 'The sprocket jumps teeth under load', 'Fast pin and bushing wear, and lost power'],
        answer: 2,
        explain: 'A tight track presses the pins hard into the bushings all the way round, so **friction** wears them quickly and absorbs engine power. Whipping, coming off and jumped teeth are signs of slack.',
      },
    },
    {
      title: 'Idler alignment',
      body: 'Most misalignment occurs at the idler: **not aligned** with rollers and sprocket, **not centred**, or **not vertical**. Heavy wear on sprocket sides and idler flanges is the clue; compare the clearance at both idler flanges and correct with shims.',
      camera: { position: [2.4, 0.9, 0.6], target: [1.25, YI, 0] },
      select: 'idler',
      cut: 'idler',
      params: { adjust: 0, speed: 2.5, misalign: 'yaw' },
      cites: [TT('p54, Figs 13–14')],
    },
  ],
}

export default scene
