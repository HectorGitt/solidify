import { Html } from '@react-three/drei'
import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { cylinder, mat4, merge, pipe, xform } from '@/geometry'
import { PartMesh } from '@/render/Part'

export type Pt = [number, number, number]

/** a run of pipe through these points, with tight bends */
export function pipeCurve(points: Pt[]) {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.04)
}

export function pipeGeo(points: Pt[], r = 0.018) {
  return pipe(pipeCurve(points), r, r * 0.72, Math.max(48, points.length * 28), 14)
}

const COLD = new THREE.Color('#2f7fd6')
const MID = new THREE.Color('#e8c547')
const HOT = new THREE.Color('#d0351f')

/** a colour for a temperature between two limits: blue through yellow to red */
export function tempColor(T: number, lo: number, hi: number, out = new THREE.Color()) {
  const u = Math.max(0, Math.min(1, (T - lo) / Math.max(1e-6, hi - lo)))
  return u < 0.5 ? out.copy(COLD).lerp(MID, u * 2) : out.copy(MID).lerp(HOT, (u - 0.5) * 2)
}

/** a small reading fixed to the rig */
export function Tag({ at, children, tone = 'var(--color-ink, #222)' }: { at: Pt; children: ReactNode; tone?: string }) {
  return (
    <Html position={at} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className="whitespace-nowrap rounded border border-line-2 bg-panel px-1.5 py-0.5 font-mono text-[11px]" style={{ color: tone }}>
        {children}
      </div>
    </Html>
  )
}

/** a pressure gauge facing +z: the needle sweeps 270° over its range. Goes inside a Part. */
export function Dial({ at, share, r = 0.07 }: { at: Pt; share: number; r?: number }) {
  const geo = useMemo(() => {
    const flat = mat4.rx(Math.PI / 2)
    return { body: xform(cylinder(r, 0.03, 40), flat), face: xform(cylinder(r * 0.86, 0.004, 40), mat4.c(mat4.t(0, 0, 0.016), flat)), needle: merge(xform(cylinder(r * 0.05, r * 0.72, 8), mat4.t(0, r * 0.36, 0))) }
  }, [r])
  const a = (135 - 270 * Math.max(0, Math.min(1, share))) * (Math.PI / 180)
  return (
    <group position={at}>
      <PartMesh geometry={geo.body} material="steelDark" />
      <PartMesh geometry={geo.face} material="ceramic" />
      <group position={[0, 0, 0.022]} rotation={[0, 0, a]}>
        <PartMesh geometry={geo.needle} material="paintRed" />
      </group>
    </group>
  )
}
