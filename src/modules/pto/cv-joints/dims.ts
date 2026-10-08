/** CV-joint dimensions (m). Typical small-tractor / 4WD front-hub sizes; the notes give none. */
export const CV = {
  rz: { Rb: 0.03, ballR: 0.0095, innerR: 0.0262, cageIn: 0.0267, cageOut: 0.0338, cupIn: 0.0345, cupOut: 0.048 },
  weiss: { Rb: 0.03, ballR: 0.009, centreR: 0.0115, prongR: 0.042, prongIn: 0.0235, prongHalf: 0.016 },
  tracta: { R: 0.026 },
  tri: { legR: 0.025, rollerR: 0.0105, potOut: 0.05 },
  /** double cardan: joint spacing in the (half-scale) cardan hardware frame */
  dc: { spacing: 0.22, scale: 0.5 },
}
