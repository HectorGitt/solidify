import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { cylinder } from '@/geometry'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { SPAN, buildType } from './build'
import { TYPE_BY_ID, useTypes } from './model'

export const pose = createTractorPose({ hitchHeight: 0.7 })

const CITES = [SRC.vers502('tractor types'), SRC.am502('tractor types'), SRC.mac502('Ch 1–2')]

function TypeModel() {
  const type = useTypes((s) => s.type)
  const parts = useMemo(() => buildType(type), [type])
  const info = TYPE_BY_ID[type]
  const labels = useMemo(
    () =>
      parts
        .filter((p) => !['tyres', 'rims', 'glass', 'rollers'].includes(p.key))
        .slice(0, 4)
        .map((p) => {
          p.geo.computeBoundingBox()
          const b = p.geo.boundingBox!
          return { id: `${type}-${p.key}`, at: [(b.min.x + b.max.x) / 2, b.max.y + 0.12, b.max.z * 0.5] as [number, number, number] }
        }),
    [parts, type],
  )
  // the real tractor, where the shared one has the type
  if (type === 'standard') return <Tractor pose={pose} internals={false} labels />
  if (type === 'crawler') return <Tractor pose={pose} running="tracks" cab paint="paintYellow" internals={false} labels />
  if (type === 'articulated') return <Tractor pose={pose} frame="articulated" cab paint="paintRed" internals={false} labels />
  if (type === 'mfwd') return <Tractor pose={pose} drive="4wd" cab paint="paintGreen" internals={false} labels />
  return (
    <Part id={type} name={info.name} role="housing" material="paintGrey" info={{ summary: `${info.name} tractor.`, role: info.features.join(' '), details: 'Proportions are typical values for the type, not measured dimensions.' }} cites={CITES}>
      {parts.map((p) => (
        <Part key={p.key} id={`${type}-${p.key}`} name={p.name} role={p.role} material={p.material} info={{ summary: p.summary, role: p.fn }}>
          <PartMesh geometry={p.geo} />
        </Part>
      ))}
      {labels.map((l) => (
        <PartLabel key={l.id} partId={l.id} at={l.at} />
      ))}
    </Part>
  )
}

export function Scene3D() {
  const type = useTypes((s) => s.type)
  const spinRef = useRef<THREE.Group>(null)
  const [x0, x1] = SPAN[type]
  const cx = (x0 + x1) / 2
  const platform = useMemo(() => {
    const g = cylinder(3.4, 0.08, 64)
    g.translate(0, -0.04, 0)
    return g
  }, [])
  useSimFrame((dt) => {
    const st = useTypes.getState()
    if (spinRef.current && st.spin) spinRef.current.rotation.y += dt * 0.25
    pose.rearAngle += dt * 0.5
    pose.frontAngle += dt * 0.8
    // the articulated tractor folds gently so its hinge can be seen working
    pose.steer = st.type === 'articulated' ? 0.3 * Math.sin(performance.now() / 2000) : 0
  })
  return (
    <group>
      <Part id="platform" name="Turntable" role="static" material="concrete" info={{ summary: 'Display turntable.', role: 'Turns the selected tractor so every side can be seen.' }} cut={false}>
        <PartMesh geometry={platform} />
      </Part>
      <group ref={spinRef}>
        <group position={[-cx, 0, 0]}>
          <TypeModel />
        </group>
      </group>
    </group>
  )
}
