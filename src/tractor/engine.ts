import { FIRING_4, HEAD_Y, engineLayout, injectorTop } from '@/machines/engine.geometry'

/**
 * The tractor's engine: the shared four-cylinder (src/machines/Engine), firing order 1-3-4-2, turned
 * so its crank lies along the tractor (cylinder 1 at the front). These place the systems that meet it.
 */

/** crank centre along the tractor, chosen so the flywheel meets the clutch housing */
export const ENGINE_X = 1.1
export const FIRING = FIRING_4
export const ENGINE_LAYOUT = engineLayout(FIRING)
/** cylinder centres along the crank (engine frame), no. 1 at the front */
export const CYL_Z = ENGINE_LAYOUT.cylZ
export { HEAD_Y, injectorTop }
