import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { HJ2 } from '../shared/cites'
import { prepareCVGeometry } from './geometry'
import { CV_CITES, DEFAULTS, TOP5, useCVJ } from './model'
import { CVPanel } from './Panel'
import { CVJoints3D } from './Scene3D'

const home = { position: [0.2, 0.26, 0.36] as [number, number, number], target: [0.01, 0, -0.005] as [number, number, number] }

const scene: SceneDef = {
  id: 'cv-joints',
  title: 'Constant-velocity joints',
  summary:
    'Rzeppa/Birfield ball-and-cage, Weiss four-ball, Tracta, tripode and the double cardan with centring ball, each cut open and running at an angle. The output keeps exactly the input speed; the chart compares it with a single Hooke’s joint.',
  Viewport: CVJoints3D,
  Panel: CVPanel,
  camera: home,
  extent: 0.45,
  floorY: -0.09,
  hatchScale: 0.0018,
  timeScale: 1 / 30,
  cutPresets: [
    { id: 'plan', label: 'Plan section (all members)', planes: [{ normal: [0, 1, 0], pos: 0 }], sectionMoving: true },
    { id: 'housings', label: 'Plan section, outer members only', planes: [{ normal: [0, 1, 0], pos: 0 }] },
    { id: 'quarter', label: 'Quarter cut', planes: [{ normal: [0, 1, 0], pos: 0 }, { normal: [0, 0, 1], pos: 0 }], intersection: true, sectionMoving: true },
  ],
  defaultPreset: 'plan',
  cites: [HJ2('§26.2.3–26.2.7, Figs 26.12–26.24'), TOP5, SRC.hj502('CV joints')],
  reset: () => useCVJ.getState().reset(),
  prepare: prepareCVGeometry,
  applyParams: (p) => useCVJ.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Constant velocity',
      body:
        'A **constant-velocity (CV) joint** passes a uniform input speed to the output at the same speed throughout each revolution — no speeding up and slowing down. CV joints are built either on the **twin Hooke’s** principle or the **angle-bisecting** principle.',
      camera: home,
      cut: 'plan',
      select: null,
      explode: 0,
      playing: true,
      params: { type: 'rzeppa', delta: 30, rpm: 600 },
      cites: [HJ2('§26.2.2–26.2.3')],
    },
    {
      title: 'Rzeppa and Birfield: balls in the bisecting plane',
      body:
        'Six balls sit in tracks in the **outer cup** and the **inner member**. The **cage** holds them in the plane that bisects the shaft angle, so each ball is the same distance from both shafts and the two must turn together. The Birfield version offsets the track centres so the tracks themselves steer the balls.',
      camera: { position: [0.1, 0.17, 0.2], target: [0, 0, 0] },
      select: 'rz-cage',
      cites: CV_CITES.rzeppa,
    },
    {
      title: 'Weiss: four balls in crossing tracks',
      body: 'Two **pronged yokes** interleave. Four balls sit where the curved tracks of the two yokes cross — always on the median plane at half the working angle. A fifth ball centralises the yokes.',
      camera: { position: [0.12, 0.18, 0.2], target: [0, 0, 0] },
      select: 'weiss-balls',
      params: { type: 'weiss', delta: 30 },
      cites: CV_CITES.weiss,
    },
    {
      title: 'Tracta: a double Hooke’s joint folded up',
      body:
        'Two **yoke jaws** and two **semispherical swivels** joined by a tongue and groove at right angles to the jaws. The input swivel speeds up and slows down, the output one undoes it — constant velocity up to **50°**.',
      camera: { position: [0.14, 0.2, 0.22], target: [0, 0, 0] },
      select: 'tracta-spigot',
      params: { type: 'tracta', delta: 40 },
      cites: CV_CITES.tracta,
    },
    {
      title: 'Tripode: rollers in a pot',
      body:
        'A three-legged **spider** carries spherical rollers that run in the parallel grooves of a **pot**. At an angle the rollers slide to and fro along the grooves once a revolution; the spider centre orbits slightly, and the drive stays constant-velocity. Compact and good at high speed.',
      camera: { position: [0.14, 0.18, 0.22], target: [0.01, 0, 0] },
      select: 'tri-rollers',
      params: { type: 'tripode', delta: 25 },
      cites: CV_CITES.tripode,
    },
    {
      title: 'Double cardan with centring ball',
      body:
        'Two Hooke’s joints back to back with a **central double yoke**. A spring-loaded **ball-and-socket** keeps both halves at equal angles, so the speed change of one half cancels the other. Used for heavy 4WD front axles with a large steering lock.',
      camera: { position: [0.18, 0.28, 0.34], target: [0, 0, 0] },
      select: 'dc-centring',
      params: { type: 'double', delta: 30 },
      cites: CV_CITES.double,
    },
    {
      title: 'Why PTO shafts still use Hooke’s joints',
      body:
        'A roller-bearing universal joint can be **over 99 % efficient**, but a single CV joint gives only about **40°** of articulation — not enough for normal field work. Open **Controls** to compare each joint with a single Hooke’s joint at the same angle.',
      camera: home,
      select: null,
      params: { type: 'rzeppa', delta: 40 },
      cites: [TOP5],
    },
  ],
}

export default scene
