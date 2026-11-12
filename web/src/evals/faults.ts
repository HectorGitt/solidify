import type { EvalCheck } from './score'

/**
 * The checks that mean a model's engineering is broken: it doesn't build, shapes are dropped, parts are out of
 * place, not held or not joined the way they move, sums don't work, or it looks wrong in its picture. A draft
 * failing one is sent back to be repaired before it reaches review, and cannot be published without an
 * override. Overlapping labels, build time and the like show on the card but do not block.
 */
export const SERIOUS: Record<string, string> = {
  builds: 'do not build',
  'every shape drawable': 'shapes dropped',
  layout: 'parts out of place',
  'every part held': 'parts not held',
  'moving parts connected': 'moving parts not connected',
  'fixed parts ride along': 'a key or sleeve not riding with its part',
  'mechanism moves right': 'move wrongly',
  'calculations work': 'calculations broken',
  'loads act right': 'a force or moment drawn wrongly',
  'moves freely': 'parts hit each other or come apart as it moves',
  'standard parts': 'a standard part built by hand from simple shapes',
  'looks right': 'looks wrong in its picture',
}

/**
 * Bump when a check is added or changed: stored models are then re-checked (the admin Library tab re-scores
 * each published model once per version; the review queue always scores drafts afresh).
 */
export const CHECKS_VERSION = 7

/** the motion check's name: worked out when a model is built, kept with the draft (too slow to redo on every page load) */
export const MOVES = 'moves freely'

/** the picture check's name: made by a vision model looking at the drawn model, kept with the draft's checks */
export const LOOKS = 'looks right'

export const seriousFaults = (checks: EvalCheck[]) => checks.filter((x) => !x.ok && x.name in SERIOUS)

/**
 * What to ask the model for when a build fails serious checks: the faults in the checks' own words (they name
 * the parts), and how to put each kind right. Sent with the current model, so it is changed, not started again.
 */
export function repairRequest(checks: EvalCheck[]): string {
  const faults = seriousFaults(checks)
  const lines = faults.map((x) => `- ${x.name}: ${x.detail ?? 'failed'}`)
  return [
    'Checking this model found these faults. Fix every one, changing as little else as you can, and keep the same title, parameters, calculations and charts:',
    ...lines,
    'How to fix them:',
    '- A part that is not held, floating or fixed to nothing: give it the relation that joins it to what carries it (coaxial with the bore, boss or shaft it sits on; against the face it stands on with no large shift), or add what is missing to hold it (a pedestal with a bore from the base up to each shaft, a base under loose pedestals). Do not leave a gap and do not move it by a shift.',
    '- A gear, worm or wheel outside its housing: size and place the housing round the parts (centered on them), with bores where the shafts pass through.',
    '- Gears cutting into or not reaching each other: mount one on the other with "mesh" and give them the same module.',
    '- A key, setscrew, pin or dowel: put it in the "children" of the part it is fixed in, with no mount and no motion. A sleeve, hub or coupling on a turning shaft: mount them coaxial and give the motion to one of them only.',
    '- A part that moves wrongly: only the driving part has a motion; everything else moves from its mount (mesh, coaxial, slider, link, lever, follower, hooke).',
    '- A buried part: move it out of the solid it is inside, or cut the pocket, slot or bore it sits in.',
    '- Parts that hit each other or come apart as it moves: a part that turns freely on a pin (a slider in a slot) is a round roller, not a block fixed to the crank; balls and their cage go round together (mount both on the same part); give moving parts clearance (slots and bores a little wider than what runs in them); keep joined parts joined by their mounts, not by coordinates.',
    '- A force or moment drawn wrongly: attach each arrow to a face of the part it acts on (not its centre), with "direction" the way it acts: an axial or thrust force along the shaft or gear axis, a radial force across it, a tangential force across both the axis and the radius at that face, a reaction against the load. A bending moment needs "direction": the axis it bends about, across the member (a beam along X bends about Z); a torque turns about the shaft’s own axis.',
  ].join('\n')
}
