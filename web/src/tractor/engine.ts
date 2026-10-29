import { FIRING_4, HEAD_Y, engineLayout, injectorTop } from '@/machines/engine.geometry'

/**
 * The tractor's engine: the shared four-cylinder (src/machines/Engine), firing order 1-3-4-2, turned
 * so its crank lies along the tractor (cylinder 1 at the front). These place the systems that meet it.
 */

/**
 * Crank centre along the tractor. The block (x 1.12–1.68) fills the bonnet: the water pump and fan
 * sit just behind the radiator, as on a real tractor. The flywheel and clutch ride on the crank's
 * tail, so they are placed from here too, and the clutch housing reaches forward to meet them.
 */
export const ENGINE_X = 1.4
/** flywheel centre (on the crank tail) */
export const FLYWHEEL_X = ENGINE_X - 0.315
/** front face of the clutch housing, where the engine bolts on */
export const BELL_FRONT_X = ENGINE_X - 0.28
/** clutch driven plate, just behind the flywheel face */
export const CLUTCH_X = ENGINE_X - 0.37
export const FIRING = FIRING_4
export const ENGINE_LAYOUT = engineLayout(FIRING)
/** cylinder centres along the crank (engine frame), no. 1 at the front */
export const CYL_Z = ENGINE_LAYOUT.cylZ
export { HEAD_Y, injectorTop }
