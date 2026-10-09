import { useMemo } from 'react'
import type { Citation } from '@/content/citations'
import { box } from '@/geometry'
import type { MaterialKey } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import type { PartInfo } from '@/parts/registry'
import { gableRoof, walls, type Opening } from './build'

/**
 * Simple single-storey building: floor slab, hollow walls with openings and a gable roof
 * (ridge along local Z). Local origin at ground level, centre of the footprint.
 */
export function Building({
  id,
  name,
  w,
  d,
  h,
  pitch = 18,
  openings,
  wallMat = 'concrete',
  roofMat = 'galvanised',
  info,
  cites,
  beyondNotes,
  position,
  rotationY = 0,
  roof = true,
}: {
  id: string
  name: string
  w: number
  d: number
  h: number
  pitch?: number
  openings?: Opening[]
  wallMat?: MaterialKey
  roofMat?: MaterialKey
  info?: PartInfo
  cites?: Citation[]
  beyondNotes?: boolean
  position: [number, number, number]
  rotationY?: number
  roof?: boolean
}) {
  const g = useMemo(() => {
    const t = Math.min(0.25, Math.max(0.15, w / 60))
    return { walls: walls(w, d, h, t, openings), floor: box(w, 0.15, d), roof: gableRoof(w, d, pitch, Math.min(0.6, w / 20), 0.1) }
  }, [w, d, h, pitch, openings])
  return (
    <Part id={id} name={name} role="housing" material={wallMat} info={info} cites={cites} beyondNotes={beyondNotes} position={position} rotation={[0, rotationY, 0]}>
      <PartMesh geometry={g.floor} position={[0, 0.075, 0]} material="concrete" />
      <PartMesh geometry={g.walls} castShadow receiveShadow />
      {roof ? (
        <Part id={`${id}-roof`} name={`${name}: roof`} role="housing" material={roofMat} info={{ summary: 'Roof', role: 'Sheds rain and shades the walls.' }} cites={cites} explode={[0, 4, 0]}>
          <PartMesh geometry={g.roof.geometry} position={[0, h, 0]} castShadow />
        </Part>
      ) : null}
    </Part>
  )
}
