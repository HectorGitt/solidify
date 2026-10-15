import { useEffect, useState, type MutableRefObject } from 'react'
import { prepareFuelGeometry } from '@/modules/engine/diesel-fuel/geometry'
import type { DriveAngles } from './DrivelineInternals'
import { Cooling } from './Cooling'
import { Electrical } from './Electrical'
import { FinalDrives } from './FinalDrives'
import { Fuel } from './Fuel'
import { Hydraulics } from './Hydraulics'
import { PtoDrive } from './PtoDrive'
import { Steering } from './Steering'
import { prepareSystems, systemsReady } from './systems.geometry'

let fuelReady = false

/**
 * Whether the tractor's system geometry (built in the worker) is in; starts the build on first use.
 * Until it is, the tractor shows its outline radiator and steering column.
 */
export function useSystemsReady(wanted: boolean) {
  const [ready, setReady] = useState(() => !!systemsReady() && fuelReady)
  useEffect(() => {
    if (!wanted || ready) return
    let live = true
    void Promise.all([prepareSystems(), prepareFuelGeometry()]).then(() => {
      fuelReady = true
      if (live) setReady(true)
    })
    return () => {
      live = false
    }
  }, [wanted, ready])
  return ready
}

export type TractorSystem = 'final' | 'pto' | 'hydraulics' | 'steering' | 'cooling' | 'fuel' | 'electrical'

/**
 * Every system of the tractor in its working place, as the whole-tractor view shows them but
 * without the colour-coding: final drives and brakes, PTO gears, hydraulics, steering, cooling,
 * fuel and electrics. Mostly inside the body, seen through x-ray or a section. `omit`: systems the
 * scene draws its own way.
 */
export function TractorSystems({ a, k, omit = [] }: { a: MutableRefObject<DriveAngles>; k: (s: string) => string; omit?: TractorSystem[] }) {
  const has = (s: TractorSystem) => !omit.includes(s)
  return (
    <>
      {has('final') && <FinalDrives a={a} k={k} />}
      {has('pto') && <PtoDrive a={a} k={k} />}
      {has('hydraulics') && <Hydraulics a={a} k={k} />}
      {has('steering') && <Steering a={a} k={k} />}
      {has('cooling') && <Cooling a={a} k={k} />}
      {has('fuel') && <Fuel a={a} k={k} />}
      {has('electrical') && <Electrical a={a} k={k} />}
    </>
  )
}
