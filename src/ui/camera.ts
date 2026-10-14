import type CameraControlsImpl from 'camera-controls'
import * as THREE from 'three'
import type { CameraPose } from '@/modules/types'
import { partObjects } from '@/parts/registry'

let controls: CameraControlsImpl | null = null

export let trackedPartId: string | null = null
export let isRecording = false

/** keep the camera on a part as it moves (null stops) */
export function setTracked(id: string | null) {
  trackedPartId = id
}

export function setIsRecording(v: boolean) {
  isRecording = v
}

export function setCameraControls(c: CameraControlsImpl | null) {
  if (controls) controls.removeEventListener('controlstart', onUserControl)
  controls = c
  if (controls) controls.addEventListener('controlstart', onUserControl)
}

function onUserControl() {
  trackedPartId = null
}

export function getCameraControls() {
  return controls
}

/**
 * When a scene follows a moving part (e.g. a tractor driving down a field), camera poses are
 * written relative to that part's ground position; the follower keeps this origin up to date.
 */
export const followOrigin = { active: false, x: 0, z: 0 }

export function flyTo(pose: CameraPose, smooth = true) {
  if (!controls) return
  trackedPartId = null
  const ox = followOrigin.active ? followOrigin.x : 0
  const oz = followOrigin.active ? followOrigin.z : 0
  const [px, py, pz] = pose.position
  const [tx, ty, tz] = pose.target
  void controls.setLookAt(px + ox, py, pz + oz, tx + ox, ty, tz + oz, smooth)
}

/** Frame a part in view. */
export function focusPart(id: string) {
  const obj = partObjects.get(id)
  if (!obj || !controls) return
  trackedPartId = id
  const box = new THREE.Box3().setFromObject(obj)
  if (box.isEmpty()) return
  void controls.fitToBox(box, true, { paddingTop: 0.15, paddingBottom: 0.15, paddingLeft: 0.15, paddingRight: 0.15 })
}

export function currentPose(): CameraPose | null {
  if (!controls) return null
  const p = new THREE.Vector3()
  const t = new THREE.Vector3()
  controls.getPosition(p)
  controls.getTarget(t)
  const r = (n: number) => Math.round(n * 1000) / 1000
  return { position: [r(p.x), r(p.y), r(p.z)], target: [r(t.x), r(t.y), r(t.z)] }
}
