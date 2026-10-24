import { CV_JOINT } from '@/parts/lib/driveline'

/** CV-joint dimensions (m): the parts-library joint sizes plus this scene's double-cardan rig. */
export const CV = {
  ...CV_JOINT,
  /** double cardan: joint spacing in the (half-scale) cardan hardware frame */
  dc: { spacing: 0.22, scale: 0.5 },
}
