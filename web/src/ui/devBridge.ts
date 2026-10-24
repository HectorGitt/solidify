import * as THREE from 'three'
import { getCameraControls } from './camera'

/**
 * Dev-only inspection bridge. Tools that run in an isolated script world can't see page
 * globals, but they share the DOM: dispatch `agri-debug` with JS source, read the JSON result
 * from <body data-agri-debug>. The code receives (scene, camera, gl, THREE, controls).
 */
export function installDevBridge(state: { scene: THREE.Scene; camera: THREE.Camera; gl: THREE.WebGLRenderer }) {
  if (!import.meta.env.DEV) return
  const w = window as unknown as { __agriDebugInstalled?: boolean; __agriState?: typeof state }
  w.__agriState = state
  if (w.__agriDebugInstalled) return
  w.__agriDebugInstalled = true
  document.addEventListener('agri-debug', (e) => {
    const code = (e as CustomEvent<string>).detail
    try {
      const s = w.__agriState!
      const fn = new Function('scene', 'camera', 'gl', 'THREE', 'controls', code)
      document.body.dataset.agriDebug = JSON.stringify(fn(s.scene, s.camera, s.gl, THREE, getCameraControls()))
    } catch (err) {
      document.body.dataset.agriDebug = JSON.stringify({ error: String(err) })
    }
  })
}
