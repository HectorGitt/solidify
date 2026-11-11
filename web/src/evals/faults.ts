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
  'looks right': 'looks wrong in its picture',
}

/**
 * Bump when a check is added or changed: stored models are then re-checked (the admin Library tab re-scores
 * each published model once per version; the review queue always scores drafts afresh).
 */
export const CHECKS_VERSION = 3

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
  ].join('\n')
}
