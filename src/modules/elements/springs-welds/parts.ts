import * as THREE from 'three'
import { extrudeTwisted, finalize, lathe, mat4, type V2 } from '@/geometry'

/** Geometry for the springs & welds scene (closed solids; see parts.test.ts). */

/** A leaf bent so its centre line drops by f(x) (x measured from the root). */
export function bentLeaf(x0: number, length: number, t: number, b: number, yTop: number, f: (x: number) => number) {
  const g = new THREE.BoxGeometry(length, t, b, 32, 1, 1)
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const xl = pos.getX(i) + length / 2
    pos.setX(i, x0 + xl)
    pos.setY(i, pos.getY(i) + yTop - t / 2 - f(xl))
  }
  return finalize(g, Math.PI / 6)
}

/** Fillet prism: right-triangle section (legs w) along an axis. */
export function prism(tri: [number, number][], length: number) {
  return extrudeTwisted(tri.map(([a, b]) => new THREE.Vector2(a, b)), [], length)
}

/** The three fillet welds of the C-shaped weld group (top, bottom, web), closed prisms. */
export function bracketWelds(hb: number, hd: number, w: number) {
  // top and bottom welds run along X (section in the YZ plane), the web weld along Y (section in XZ)
  const top = prism([[hd, 0], [hd + w, 0], [hd, w]].map(([y, z]) => [z, y]) as [number, number][], hb)
  top.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)).premultiply(mat4.t(hb / 2, 0, 0)))
  const bot = prism([[-hd, 0], [-hd, w], [-hd - w, 0]].map(([y, z]) => [z, y]) as [number, number][], hb)
  bot.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)).premultiply(mat4.t(hb / 2, 0, 0)))
  const web = prism([[0, 0], [0, w], [-w, 0]], 2 * hd)
  web.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0)))
  return [top, bot, web]
}

/** Circumferential fillet bead round a bar of radius R lying along +X from a plate face at x0. */
export function barBead(R: number, w: number, x0: number) {
  const bead = lathe([[R, 0], [R + w, 0], [R, w]] as V2[], 72)
  bead.applyMatrix4(mat4.c(mat4.t(x0, 0, 0), mat4.rz(-Math.PI / 2)))
  return bead
}
