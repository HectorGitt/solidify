import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { Cam3D, CamPanel, DEFAULTS, FLOOR, useCam } from './Rig'

const PQ = (where: string) => cite('CVE202', 'CVE202 PQ.pdf', where)
const view = { position: [0.58, 0.26, 2.3] as [number, number, number], target: [0, 0.02, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'cam',
  title: 'Cam profile & follower',
  summary: 'Set the motion you want and the cam draws itself: rise, dwell and fall with uniform, simple harmonic, parabolic or cycloidal laws, a knife-edge or roller follower, and the pressure angle.',
  Viewport: Cam3D,
  Panel: CamPanel,
  camera: view,
  extent: 1,
  floorY: FLOOR - 0.14,
  hatchScale: 0.007,
  timeScale: 1,
  cutPresets: [{ id: 'mid', label: 'Through the cam', planes: [{ normal: [0, 0, 1], pos: 0.04 }], sectionMoving: true }],
  cites: [PQ('Question 4(b): plate cam')],
  reset: () => useCam.getState().reset(),
  applyParams: (p) => useCam.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'A motion wrapped round a circle',
      body: 'This cam **lifts its follower 32 mm** with uniform velocity over 120°, holds it for 60°, then lets it fall with simple harmonic motion. The shape is that graph, wrapped round a **38 mm base circle**.',
      camera: view,
      cut: false,
      select: 'cam',
      explode: 0,
      playing: true,
      params: { ...DEFAULTS },
      cites: [PQ('Question 4(b)')],
    },
    {
      title: 'Drawing it',
      body: 'Draw the **displacement diagram** first. Then **invert the motion**: hold the cam still and swing the follower round the opposite way. At each 30°, step the lift out along the radius, and join the points. The panel’s table gives every radius.',
      select: 'follower',
      cites: [PQ('Question 4(b)')],
      check: {
        question: 'On this cam, what is the radius of the profile at 60°?',
        options: ['38 mm', '54 mm', '70 mm'],
        answer: 1,
        explain: 'Uniform velocity means half the rise at half the angle: 16 mm of lift at 60°. Added to the base circle: **38 + 16 = 54 mm**.',
      },
    },
    {
      title: 'Why the law matters',
      body: 'At each end of a **uniform velocity** rise the speed jumps, which would need an enormous force. **Simple harmonic** motion is smoother, and **cycloidal** motion starts and ends with no acceleration at all, so it suits high speeds.',
      params: { rise: 'cycloidal', fall: 'cycloidal', riseEnd: 150, dwellEnd: 210 },
      select: 'cam',
      cites: [PQ('Question 4(b)')],
    },
    {
      title: 'Roller followers and pressure angle',
      body: 'A roller carries far more load than a point. The cam’s surface then lies a roller’s radius inside the **pitch curve**. The steeper the rise, the larger the **pressure angle**, and the harder the follower presses sideways on its guide. Keep it under about 30°.',
      params: { follower: 'roller', rise: 'shm', fall: 'shm', riseEnd: 120, dwellEnd: 180 },
      select: 'guide',
      cites: [PQ('Question 4(b)')],
    },
  ],
}

export default scene
