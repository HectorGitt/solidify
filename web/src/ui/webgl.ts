/**
 * Whether this browser can draw 3D at all. Some can't: graphics acceleration switched off, a locked-down
 * school or office PC, an old driver. Pages then show pictures in place of the live 3D, never an error.
 */
let ok: boolean | null = null
export function hasWebGL() {
  if (ok !== null) return ok
  try {
    const c = document.createElement('canvas')
    ok = !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    ok = false
  }
  return ok
}
