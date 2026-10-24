/**
 * Shared tractor dimensions. Frame: metres, Y up, +X forward, +Z to the tractor's right (right-handed frame);
 * origin on the ground directly below the rear-axle centre.
 *
 * Chassis values are the "Farmland" tractor of Macmillan App. II (65851_Macmillan.pdf), the
 * tractor the AEE502 hitching and chassis equations are worked with. Linkage values are
 * typical Category II three-point linkage proportions (beyond the notes, which give only the
 * pin categories).
 */
export const TRACTOR = {
  /** wheelbase x */
  wheelbase: 1.88,
  /** CG ahead of rear axle xr, and height above the rear axle yg */
  cgX: 0.54,
  cgY: 0.13,
  mass: 2850,
  /** rear tyre 14.9-28: rolling radius 0.635 m */
  rear: { radius: 0.66, rolling: 0.635, width: 0.378, rimRadius: 0.356, track: 1.42 },
  /** front steering tyre (typical 7.50-16) */
  front: { radius: 0.39, width: 0.19, rimRadius: 0.203, track: 1.42 },
  /** drawbar pin: x′ behind the rear contact point, y′ above ground */
  drawbar: { x: -0.6, y: 0.45 },
  /** PTO stub end (540 rpm, 6-spline 35 mm) */
  pto: { x: -0.3, y: 0.5, diameter: 0.035 },
  /** seat reference point */
  seat: { x: -0.12, y: 1.32 },
  steeringWheel: { x: 0.22, y: 1.6 },
} as const

/** Category II three-point linkage proportions (side view; see linkage.ts). */
export const LINKAGE = {
  /** lower-link chassis pivots (A), z = ±spread */
  lowerPivot: { x: -0.2, y: 0.42, z: 0.3 },
  /** lower link length (pivot to hitch ball, side-view projection) */
  lowerLength: 0.86,
  /** lower hitch point spread (Cat II 825 mm) */
  hitchSpread: 0.4125,
  /** top-link chassis pivot (B) */
  topPivot: { x: -0.5, y: 0.9 },
  /** default top-link length (adjustable turnbuckle) */
  topLength: 0.58,
  /** implement mast height (Cat II ≈ 610 mm) */
  mastHeight: 0.61,
  /** rockshaft (lift-arm) pivot and arm length */
  rockshaft: { x: -0.3, y: 1.0, z: 0.38 },
  liftArm: 0.34,
  /** lift rod length and its attachment along the lower link from A */
  liftRod: 0.62,
  liftRodAt: 0.48,
} as const
