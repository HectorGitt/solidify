/**
 * Belt / chain loop path and sweep: moved to the shared parts library (src/parts/lib/elements.ts);
 * re-exported here under the scenes' names.
 */
export {
  beltLoop,
  crossedLoop,
  flatSection,
  loopMeshPhase as meshPhase,
  openLoop,
  signedVolume,
  sweepLoop,
  vSection,
  type BeltLoop,
  type LoopSeg,
  type Pulley,
} from '@/parts/lib/elements'
