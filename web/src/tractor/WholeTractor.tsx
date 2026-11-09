import { Html } from '@/render/Html'
import { useEffect, useState, type MutableRefObject, type ReactNode } from 'react'
import type { PartInfo } from '@/parts/registry'
import type { MaterialKey } from '@/render/materials'
import { Part } from '@/render/Part'
import { insideReady, systemsOf, useInside } from '@/ui/inside'
import { engineReady, prepareEngine } from '@/machines/engine.geometry'
import { Engine } from '@/machines/Engine'
import { ENGINE_X, FIRING } from './engine'
import { DRIVE_Y } from './geometry'
import { prepareSystems, systemsReady } from './systems.geometry'
import { ClutchInternals, ClutchPlate, CrownWheel, GearTrain, GearboxInternals, type DriveAngles } from './DrivelineInternals'
import { FinalDrives } from './FinalDrives'
import { PtoDrive } from './PtoDrive'
import { Hydraulics } from './Hydraulics'
import { Steering } from './Steering'
import { Cooling } from './Cooling'
import { Fuel } from './Fuel'
import { Electrical } from './Electrical'
import { prepareFuelGeometry } from '@/modules/engine/diesel-fuel/geometry'
import { SYSTEMS, type SystemDef } from './systems'
import type { TractorGeometry } from './geometry'

/**
 * Every system of the tractor at once, working, inside its see-through body: each system a Part
 * of its own, colour-coded, that can be hidden from the legend or pulled apart into a labelled
 * exploded layout. Mounted by the Tractor while the whole tractor is open (insideMode 'whole').
 * Frame as the tractor: +X forward, Y up, +Z right.
 */
export const systemId = (k: (s: string) => string, key: string) => k(`sys-${key}`)

function System({ def, k, children }: { def: SystemDef; k: (s: string) => string; children: ReactNode }) {
  const exploded = useInside((s) => s.exploded)
  return (
    <Part id={systemId(k, def.key)} name={def.name} role="moving" tint={def.color} info={def.info} explode={def.explode}>
      {children}
      {exploded ? (
        <Html position={def.label} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="inside-label part-label" style={{ borderColor: def.color }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: def.color, marginRight: 6 }} />
            {def.name}
          </div>
        </Html>
      ) : null}
    </Part>
  )
}

const DRIVE_INFO: Record<string, PartInfo> = {
  clutch: { summary: 'Clutch driven plate.', role: 'Clamped between the flywheel and the pressure plate, it carries the engine torque into the gearbox; pressing the pedal frees it.' },
  gears: { summary: 'Gearbox gears and shafts.', role: 'The constant-mesh pair drives the layshaft; the selected pair drives the output shaft and the bevel pinion.' },
  crown: { summary: 'Crown wheel and bevel pinion with the differential.', role: 'Turns the drive through 90° to the half shafts, reduces the speed again, and lets the wheels turn at different speeds on corners.' },
}

export function WholeTractor({ a, k, G, paint, rootId }: { a: MutableRefObject<DriveAngles>; k: (s: string) => string; G: TractorGeometry; paint: MaterialKey; rootId: string }) {
  const def = (key: string) => SYSTEMS.find((s) => s.key === key)!
  // every system appears together, once the heavy parts are built (in the worker, first time only)
  const [ready, setReady] = useState(() => !!(engineReady(FIRING) && systemsReady()))
  useEffect(() => {
    if (ready) return
    let live = true
    useInside.setState({ loading: true })
    void Promise.all([prepareEngine(FIRING), prepareSystems(), prepareFuelGeometry()]).then(() => {
      if (!live) return
      setReady(true)
      window.setTimeout(insideReady, 60)
    })
    return () => {
      live = false
    }
  }, [ready])
  if (!ready) return null
  return (
    <Part id={systemsOf(rootId)} name="Systems" role="moving" explode={false} xray={null}>
      <System def={def('engine')} k={k}>
        <Engine k={k} firing={FIRING} paint={paint} crankAngle={() => a.current.crank} fuel={false} position={[ENGINE_X, DRIVE_Y, 0]} rotation={[0, Math.PI / 2, 0]} />
      </System>
      <System def={def('driveline')} k={k}>
        <ClutchPlate a={a} k={k} G={G} info={DRIVE_INFO.clutch} />
        <ClutchInternals a={a} k={k} />
        <GearTrain a={a} k={k} G={G} info={DRIVE_INFO.gears} />
        <GearboxInternals a={a} k={k} />
        <CrownWheel a={a} k={k} G={G} info={DRIVE_INFO.crown} open stub={0.11} />
      </System>
      <System def={def('final')} k={k}>
        <FinalDrives a={a} k={k} />
      </System>
      <System def={def('pto')} k={k}>
        <PtoDrive a={a} k={k} />
      </System>
      <System def={def('hydraulics')} k={k}>
        <Hydraulics a={a} k={k} />
      </System>
      <System def={def('steering')} k={k}>
        <Steering a={a} k={k} />
      </System>
      <System def={def('cooling')} k={k}>
        <Cooling a={a} k={k} />
      </System>
      <System def={def('fuel')} k={k}>
        <Fuel a={a} k={k} />
      </System>
      <System def={def('electrical')} k={k}>
        <Electrical a={a} k={k} />
      </System>
    </Part>
  )
}
