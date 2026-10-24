import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { DriveGraph, gearMesh } from '@/core/drive'
import { useSimFrame } from '@/core/sim'
import { gearPumpRipple, gearRadii, vaneChamberVolume, vaneTipRadius } from '@/physics/pumps'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { buildPumpGeometry } from './geometry'
import { GEAR, MG1617, VANE, live, usePumps, vaneGeom } from './model'

const { PI } = Math

const C = {
  gear: [SRC.hy510('p2 (book p83): a gear pump is commonly used; 45 kW tractor ≈ 27 L/min')],
  vane: [MG1617('Q(b) vane pump: slotted rotor, sliding vanes, rotor ring, inlet, outlet')],
  relief: [SRC.hy510('p2–3: relief valve blows at 150 kg/cm²')],
}

const INFO = {
  gearPump: {
    summary: 'External gear pump — the commonest tractor hydraulic pump.',
    role: 'Two meshing gears in a close-fitting housing. Oil is trapped in the tooth spaces and carried round the outside of both gears from the inlet to the outlet; the meshing teeth stop it returning through the middle.',
    details: 'Module 3 mm, 12 teeth, 20 mm wide: about 13.9 cm³/rev, 27.8 L/min at 2000 rpm. Internal construction is standard.',
  },
  gearBody: { summary: 'Pump body.', role: 'Its figure-of-eight bore fits closely round the gear tips so the oil can only travel in the tooth spaces.' },
  gearCovers: { summary: 'End covers.', role: 'Seal the sides of the gears; the drive shaft passes through the front cover.' },
  driveGear: { summary: 'Driving gear on the drive shaft.', role: 'Usually driven from the PTO shaft inside the transmission housing, or from the engine.' },
  idlerGear: { summary: 'Driven (idler) gear.', role: 'Turned by the driving gear in the opposite direction; carries oil round its own side of the housing.' },
  vanePump: {
    summary: 'Vane pump.',
    role: 'The rotor has slots in which vanes move radially (thrown out by centrifugal force); the tips of the vanes ride against the ring, pumping oil from the inlet to the outlet port.',
    details: 'The rotor sits off-centre in the ring: chambers grow on the inlet side and shrink on the outlet side. Moving the ring changes the eccentricity and the delivery.',
  },
  ring: { summary: 'Cam (rotor) ring.', role: 'Its bore is eccentric to the rotor, so the vanes slide out and back once each revolution.' },
  rotor: { summary: 'Slotted rotor on the drive shaft.', role: 'Carries the vanes in radial slots.' },
  vanes: { summary: 'Sliding vanes.', role: 'Seal against the ring and divide the space into chambers that carry oil from inlet to outlet.' },
  vaneHousing: { summary: 'Housing and port plate.', role: 'The kidney-shaped ports in the side plate feed the growing chambers (inlet) and collect from the shrinking ones (outlet).' },
  pipes: { summary: 'Suction and delivery pipes.', role: 'From the reservoir (transmission housing) to the pump, and on to the control valve.' },
}

function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, z = 0, n = 24) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    pts.push(new THREE.Vector3(cx + r * Math.cos(a), cy + r * Math.sin(a), z))
  }
  return pts
}

export function Pumps3D() {
  const g = buildPumpGeometry()
  const rpm = usePumps((s) => s.rpm)
  const flows = usePumps((s) => s.flows)
  const G = gearRadii(GEAR)
  const rm = (G.ra + G.rf) / 2

  const graph = useMemo(() => {
    const d = new DriveGraph()
    d.body('top')
    d.body('bot')
    d.add(gearMesh('mesh', 'top', GEAR.teeth, 'bot', GEAR.teeth))
    return d
  }, [])

  const paths = useMemo(() => {
    const mk = (s: 1 | -1) => {
      const arc = arcPoints(0, s * G.r, rm, s > 0 ? (195 * PI) / 180 : (165 * PI) / 180, s > 0 ? (-15 * PI) / 180 : (375 * PI) / 180)
      return new THREE.CatmullRomCurve3([new THREE.Vector3(-0.1, 0, 0), new THREE.Vector3(-0.04, 0, 0), new THREE.Vector3(-0.026, s * 0.004, 0), ...arc, new THREE.Vector3(0.026, s * 0.004, 0), new THREE.Vector3(0.04, 0, 0), new THREE.Vector3(0.1, 0, 0)])
    }
    const zr = -VANE.width / 2 - 0.006
    const vArc = arcPoints(0, 0, 0.0372, PI, 0, 0, 28)
    const vane = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.12, 0, zr),
      new THREE.Vector3(-0.065, 0, zr),
      new THREE.Vector3(-0.04, 0, zr + 0.002),
      new THREE.Vector3(-0.037, 0, -0.004),
      ...vArc.slice(1, -1),
      new THREE.Vector3(0.037, 0, -0.004),
      new THREE.Vector3(0.04, 0, zr + 0.002),
      new THREE.Vector3(0.065, 0, zr),
      new THREE.Vector3(0.12, 0, zr),
    ])
    return { top: mk(1), bot: mk(-1), vane }
  }, [G.r, rm])

  const top = useRef<THREE.Group>(null)
  const bot = useRef<THREE.Group>(null)
  const rotor = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Group>(null)
  const vanes = useRef<(THREE.Group | null)[]>([])

  useSimFrame((dt) => {
    const st = usePumps.getState()
    const w = (st.rpm * 2 * PI) / 60
    graph.drive('top', -w)
    graph.step(dt)
    const th = -graph.get('top').theta
    top.current?.rotation.set(0, 0, -PI / 2 - th)
    bot.current?.rotation.set(0, 0, PI / 2 - PI / GEAR.teeth + graph.get('bot').theta)

    // vane pump: rotor turns clockwise (−θ); ring offset +Y by e
    rotor.current?.rotation.set(0, 0, -th)
    ring.current?.position.set(0, st.ecc, 0)
    for (let k = 0; k < VANE.vanes; k++) {
      const m = vanes.current[k]
      if (!m) continue
      const local = (2 * PI * k) / VANE.vanes
      const rho = vaneTipRadius(VANE.ringR, st.ecc, local - th - PI / 2)
      m.position.set(Math.cos(local) * (rho - VANE.vaneLen / 2), Math.sin(local) * (rho - VANE.vaneLen / 2), 0)
      m.rotation.set(0, 0, local)
    }
    const deg = ((((th * 180) / PI) % 360) + 360) % 360
    live.theta = deg
    live.ripple = gearPumpRipple(GEAR, th)
    const phi0 = ((((-th - PI / 2 + PI / VANE.vanes) * 180) / PI) % 360 + 360) % 360
    live.vanePhi = phi0
    live.chamber = vaneChamberVolume(vaneGeom(st.ecc), (phi0 * PI) / 180) * 1e6
  })

  const vaneSpeed = () => Math.min(1, usePumps.getState().rpm / 1000)
  const gearSpeed = (rpm * 2 * PI * rm) / 60 / paths.top.getLength()

  return (
    <group>
      {/* ---------------- gear pump ---------------- */}
      <group position={[GEAR.x, 0, 0]}>
        <Part id="gear-pump" name="Gear pump" role="housing" material="castIron" info={INFO.gearPump} cites={C.gear} beyondNotes>
          <Part id="gear-body" name="Pump body" material="aluminium" role="housing" info={INFO.gearBody} cites={C.gear}>
            <PartMesh geometry={g.gearBody} />
          </Part>
          <Part id="gear-covers" name="End covers" material="aluminium" role="housing" info={INFO.gearCovers} cites={C.gear} explode={[0, 0, 0.06]}>
            <PartMesh geometry={g.gearFront} />
            <PartMesh geometry={g.gearRear} position={[0, 0, 0]} />
          </Part>
          <Part id="gear-pipes" name="Suction & delivery pipes" material="steel" role="static" info={INFO.pipes} cites={C.gear}>
            <PartMesh geometry={g.gearInPipe} />
            <PartMesh geometry={g.gearOutPipe} />
          </Part>
          <group position={[0, G.r, 0]}>
            <group ref={top}>
              <Part id="drive-gear" name="Driving gear & shaft" material="steel" role="moving" info={INFO.driveGear} cites={C.gear} explode={[0, 0.05, 0.1]}>
                <PartMesh geometry={g.gear} />
                <PartMesh geometry={g.gearDrive} material="steelDark" />
              </Part>
            </group>
          </group>
          <group position={[0, -G.r, 0]}>
            <group ref={bot}>
              <Part id="idler-gear" name="Driven gear" material="steel" role="moving" info={INFO.idlerGear} cites={C.gear} explode={[0, -0.05, 0.1]}>
                <PartMesh geometry={g.gear} />
                <PartMesh geometry={g.gearIdler} material="steelDark" />
              </Part>
            </group>
          </group>
          {flows ? (
            <>
              <Flow curve={paths.top} count={60} radius={0.0022} color="#ff7a5c" speed={gearSpeed} spread={0.003} intensity={() => 1} />
              <Flow curve={paths.bot} count={60} radius={0.0022} color="#ff7a5c" speed={gearSpeed} spread={0.003} intensity={() => 1} />
            </>
          ) : null}
        </Part>
      </group>

      {/* ---------------- vane pump ---------------- */}
      <group position={[VANE.x, 0, 0]}>
        <Part id="vane-pump" name="Vane pump" role="housing" material="castIron" info={INFO.vanePump} cites={C.vane}>
          <Part id="vane-housing" name="Housing & port plate" material="castIron" role="housing" info={INFO.vaneHousing} cites={C.vane} beyondNotes>
            <PartMesh geometry={g.vaneBody} />
            <PartMesh geometry={g.vaneRear} />
            <Part id="vane-front" name="Front cover" material="castIron" role="housing" info={INFO.vaneHousing} explode={[0, 0, 0.07]}>
              <PartMesh geometry={g.vaneFront} />
            </Part>
          </Part>
          <Part id="vane-pipes" name="Suction & delivery pipes" material="steel" role="static" info={INFO.pipes} cites={C.vane}>
            <PartMesh geometry={g.vaneInPipe} />
            <PartMesh geometry={g.vaneOutPipe} />
          </Part>
          <group ref={ring}>
            <Part id="ring" name="Cam (rotor) ring" material="steelDark" role="static" info={INFO.ring} cites={C.vane} explode={[0, 0.06, 0.05]}>
              <PartMesh geometry={g.ring} />
            </Part>
          </group>
          <group ref={rotor}>
            <Part id="rotor" name="Slotted rotor & shaft" material="steel" role="moving" info={INFO.rotor} cites={C.vane} explode={[0, 0, 0.12]}>
              <PartMesh geometry={g.rotor} />
              <PartMesh geometry={g.vaneShaft} material="steelDark" />
              <Part id="vanes" name="Sliding vanes" material="bronze" info={INFO.vanes} cites={C.vane} explode={[0, 0, 0.05]}>
                {Array.from({ length: VANE.vanes }, (_, k) => (
                  <group
                    key={k}
                    ref={(m) => {
                      vanes.current[k] = m
                    }}
                  >
                    <PartMesh geometry={g.vane} />
                  </group>
                ))}
              </Part>
            </Part>
          </group>
          {flows ? <Flow curve={paths.vane} count={70} radius={0.0022} color="#ff7a5c" speed={0.9} spread={0.003} intensity={() => vaneSpeed() * Math.min(1, usePumps.getState().ecc / 0.002)} /> : null}
        </Part>
      </group>

      <PartLabel partId="drive-gear" at={[GEAR.x - 0.01, G.r + 0.03, 0.03]} />
      <PartLabel partId="idler-gear" at={[GEAR.x - 0.01, -G.r - 0.03, 0.03]} />
      <PartLabel partId="gear-body" at={[GEAR.x + 0.04, 0.055, 0.01]} />
      <PartLabel partId="gear-pipes" at={[GEAR.x - 0.09, 0.02, 0]} text="Inlet (suction)" />
      <PartLabel partId="ring" at={[VANE.x + 0.03, 0.06, 0.02]} />
      <PartLabel partId="rotor" at={[VANE.x - 0.01, 0.0, 0.03]} />
      <PartLabel partId="vanes" at={[VANE.x + 0.02, 0.035, 0.03]} />
      <PartLabel partId="vane-pipes" at={[VANE.x + 0.1, 0.02, -0.02]} text="Outlet (delivery)" />
      <PartLabel partId="vane-housing" at={[VANE.x - 0.06, -0.07, 0.02]} />
    </group>
  )
}
