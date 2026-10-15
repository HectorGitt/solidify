import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, xform } from '@/geometry'
import { discSlab, grainSilo, ringSlab } from '@/parts/lib/structures'
import { elevatedTank } from '@/parts/lib/water'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Arrow, setArrow } from '@/modules/vibration/_shared/ui'
import { DRIVES, HAZARD_SEPARATION, ZONES } from '@/physics/structures'
import { TRACTOR } from '@/tractor/dims'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { Building } from '../_shared/Building'
import { P, tint } from '../_shared/build'
import { C, assess, live, useFarmstead, type Rect } from './model'

const ZONE_COLORS = ['#7fc97f', '#80b1d3', '#fdc086', '#e7a0a0']

const INFO = {
  zones: [
    { summary: 'Zone 1 — family living.', role: 'The dwelling, kept upwind and nearest the road, protected from odour, dust, flies and erosion.' },
    { summary: 'Zone 2 — machinery and workshop.', role: 'Implement and machinery storage and the farm workshop: clean, dry and quiet activities.' },
    { summary: 'Zone 3 — grain, feed and small animals.', role: 'Grain and feed storage, and small animal units.' },
    { summary: 'Zone 4 — livestock.', role: 'Livestock buildings and large-scale animal production, at the far downwind end, with room to expand beyond.' },
  ],
  road: { summary: 'Main (public) road.', role: 'All zone circles are tangent to it at one point. Locational accessibility weighs the road against how often trips are made to town or market.' },
  drive: {
    summary: 'Zone 5 — farm access drive (central spine).',
    role: 'Links the public road to every zone. Two-way drives are 16–20 ft (≈ 5–6 m) wide, one-way 12 ft (≈ 3.7 m). Clear sight lines, no sharp turns, graded and drained, with access for emergency vehicles.',
  },
  court: { summary: 'Courtyard and turning area.', role: 'Farm equipment needs a turning radius of 40–50 ft (12–15 m), so the cleared pad is about 24–30 m across. Gravel for light traffic, concrete for heavy use.' },
  parking: { summary: 'Large-vehicle parking.', role: 'Stalls 12 × 60 ft (≈ 3.7 × 18.3 m), kept apart from the car and heavy-machinery traffic.' },
  house: { summary: 'Farm dwelling.', role: 'On a well-drained site with a view of the access road and the farmstead; long axis east–west for shading.' },
  shed: { summary: 'Machinery shed.', role: 'Narrow open-sided shed for tractors and complex machines, as high as the tallest machine.' },
  shop: { summary: 'Farm workshop.', role: 'Near the work centre and the house, on level, well-drained ground close to the power supply.' },
  fuel: {
    summary: 'Fuel store (hazardous).',
    role: 'More than 50 L diesel, 20 L kerosene, 10 L petrol or 3 L thinner goes in a separate building at least 15 m from any other building. The red ring is the 15 m radius.',
  },
  silo: { summary: 'Grain silo.', role: 'Grain storage in zone 3.' },
  feed: { summary: 'Feed store / small-animal unit.', role: 'Feed storage and small animal units in zone 3.' },
  barn: { summary: 'Livestock building.', role: 'Downwind of the dwelling and neighbours so odour, dust and flies blow away from the house.' },
  tank: { summary: 'Water supply: borehole and elevated tank.', role: 'Reassess the volume when livestock numbers grow: doubling the animals more than doubles the demand on water and power.' },
  septic: { summary: 'Septic tank and drainage field.', role: 'A flush toilet needs a septic tank with a drainage field on well-drained ground.' },
  power: { summary: 'Power line.', role: 'Utilities: electricity and telephone reach every work centre along the drive.' },
  plume: { summary: 'Odour and dust plume.', role: 'Carried downwind from the livestock buildings. It turns red when it reaches the dwelling.' },
}

const tmpBase = new THREE.Vector3()
const tmpDir = new THREE.Vector3()

function RectBuilding(props: { r: Rect; name: string; h: number; info: { summary: string; role: string }; wallMat?: 'concrete' | 'wood' | 'galvanised'; roofMat?: 'galvanised' | 'paintRed' | 'paintGreen' }) {
  const { r } = props
  return (
    <Building
      id={r.id}
      name={props.name}
      w={r.w}
      d={r.d}
      h={props.h}
      wallMat={props.wallMat}
      roofMat={props.roofMat}
      info={props.info}
      cites={[C.ln('p8–9 zone planning')]}
      position={P(r.e, r.n, 0.24)}
      openings={[{ side: r.e < 0 ? '+x' : '-x', at: 0, width: Math.min(4, r.d * 0.4), height: Math.min(props.h - 0.3, 3.5) }]}
    />
  )
}

export function Scene3D() {
  const st = useFarmstead()
  const a = useMemo(() => assess(st), [st])
  const L = a.L
  const pose = useMemo(() => createTractorPose(), [])
  const tractor = useRef<THREE.Group>(null)
  const arrow = useRef<THREE.Group>(null)
  const phi = useRef(0)

  const g = useMemo(() => {
    const zones = L.r.map((r) => discSlab({ r, h: 0.02, segments: 128 }))
    const pad = discSlab({ r: L.court.r, h: 0.05, segments: 64 })
    const ring15 = ringSlab({ rOuter: HAZARD_SEPARATION + 0.25, rInner: HAZARD_SEPARATION - 0.25, h: 0.04 })
    const s = grainSilo({ r: L.silo.r, h: 9, roofRise: 2.2 })
    const silo = merge(s.barrel, s.roof, s.vent)
    const et = elevatedTank({ r: 1.4, h: 2.2, standH: 5, spread: 0.9 })
    const tank = merge(et.tank, et.stand)
    const pole = cylinder(0.12, 8, 10)
    const stripes = merge(...[0, 1, 2, 3].map((i) => xform(box(0.12, 0.02, DRIVES.stall.l), mat4.t((i - 1.5) * DRIVES.stall.w, 0, 0))))
    const field = merge(...[-2, -1, 0, 1, 2].map((i) => xform(box(0.5, 0.03, 8), mat4.t(i * 1.2, 0, 0))))
    return { zones, pad, ring15, silo, tank, pole, stripes, field, unit: box(1, 1, 1) }
  }, [L])

  useSimFrame((dt) => {
    const s = useFarmstead.getState()
    const R = Math.max(TRACTOR.wheelbase * 2, L.court.r - 3)
    const v = 2.5
    phi.current += (dt * v) / R
    const p = phi.current
    const c = P(0, L.court.n)
    if (tractor.current) {
      tractor.current.position.set(c[0] + R * Math.cos(p), 0.15, c[2] + R * Math.sin(p))
      tractor.current.rotation.set(0, -p - Math.PI / 2, 0)
    }
    pose.rearAngle += (dt * v) / TRACTOR.rear.rolling
    pose.frontAngle += (dt * v) / TRACTOR.front.radius
    // heading −φ − π/2 falls as φ grows: a right turn, so the wheels yaw −Y
    pose.steer = -Math.atan(TRACTOR.wheelbase / R)
    pose.engineAngle += dt * 2 * Math.PI * 25
    // wind arrow (bearing the wind blows towards)
    const b = ((s.windFrom + 180) * Math.PI) / 180
    tmpDir.set(Math.sin(b), 0, -Math.cos(b))
    tmpBase.set(-L.r[3] - 25, 14, -L.r[3]).addScaledVector(tmpDir, -12)
    setArrow(arrow.current, tmpBase, tmpDir, 24)
    live.heading = b
  })

  const towards = ((st.windFrom + 180) * Math.PI) / 180
  const plumeYaw = Math.PI / 2 - towards
  const plumeLen = Math.max(120, L.far * 1.2)
  const plumeCurves = useMemo(
    () => [-14, 0, 14].map((deg) => {
      const t = (deg * Math.PI) / 180
      return new THREE.LineCurve3(new THREE.Vector3(0, 2.5, 0), new THREE.Vector3(plumeLen * Math.cos(t), 9, plumeLen * Math.sin(t)))
    }),
    [plumeLen],
  )
  const plumeColor = a.plumeHits ? '#e0503c' : '#b9935a'

  const poles = useMemo(() => {
    const out: number[] = []
    for (let n = 12; n < L.far; n += 30) out.push(n)
    return out
  }, [L.far])

  // ground layers are spaced 6 cm apart: closer than that, the depth buffer of this 220 m scene
  // cannot separate them and the surfaces flicker (z-fighting) as the camera moves
  const zoneY = (k: number) => 0.06 * (4 - k)
  const roadLen = 2 * L.r[3] + 120

  return (
    <group>
      <Part id="ground" name="Farm land" role="static" material="crop" info={{ summary: 'Farm land around the farmstead.', role: 'The farmstead should take no more than about 5 % of the production area.' }} cites={[C.ln('p3')]} cut={false}>
        <PartMesh geometry={g.unit} position={[0, -0.25, -L.r[3]]} scale={[roadLen + 60, 0.5, 2 * L.r[3] + 120]} receiveShadow />
      </Part>
      <Part id="main-road" name="Main road" role="static" material="paintGrey" info={INFO.road} cites={[C.ln('p8 zone figure'), C.ln('p9 accessibility')]} cut={false}>
        <PartMesh geometry={g.unit} position={P(0, -4.5, 0.12)} scale={[roadLen, 0.1, 8]} receiveShadow />
      </Part>
      <Part id="zones" name="Zones (10–30 m rings)" role="static" info={{ summary: 'Zone planning.', role: 'Concentric zones 10–30 m wide, all tangent to the road at one point. The dwelling sits upwind near the road; livestock at the far downwind end.' }} cites={[C.ln('p8–9')]} cut={false}>
        {L.r.map((r, i) => (
          <Part key={i} id={`zone-${i + 1}`} name={`Zone ${i + 1}: ${ZONES[i].name}`} role="static" info={INFO.zones[i]} cites={[C.ln('p8–9')]}>
            <PartMesh geometry={g.zones[i]} position={P(0, r, zoneY(i + 1))} customMaterial={tint(`zone${i}`, ZONE_COLORS[i], 0.92)} receiveShadow />
          </Part>
        ))}
      </Part>
      <Part id="drive" name="Zone 5: access drive" role="static" material="concrete" info={INFO.drive} cites={[C.ln('p8 zone 5'), C.ln('p21–22 drives')]} cut={false}>
        <PartMesh geometry={g.unit} position={P(0, L.far / 2, 0.33)} scale={[st.driveW, 0.06, L.far + 2]} receiveShadow />
        <Part id="courtyard" name="Courtyard & turning area" role="static" material="concrete" info={INFO.court} cites={[C.ln('p22 turning radius 40–50 ft')]}>
          <PartMesh geometry={g.pad} position={P(0, L.court.n, 0.42)} receiveShadow />
        </Part>
        <Part id="parking" name="Large-vehicle parking" role="static" material="concrete" info={INFO.parking} cites={[C.ln('p22 stalls 12 × 60 ft')]}>
          <PartMesh geometry={g.unit} position={P(L.parking.e, L.parking.n, 0.3)} scale={[3 * DRIVES.stall.w, 0.05, DRIVES.stall.l]} receiveShadow />
          <PartMesh geometry={g.stripes} position={P(L.parking.e, L.parking.n, 0.345)} material="paintYellow" />
        </Part>
      </Part>

      <Building id="dwelling" name="Dwelling" w={L.house.d} d={L.house.w} h={3} pitch={22} roofMat="paintRed" info={INFO.house} cites={[C.ln('p12–13')]} position={P(L.house.e, L.house.n, 0.24)} rotationY={Math.PI / 2} openings={[{ side: '+x', at: 0, width: 1, height: 2.1 }]} />
      <RectBuilding r={L.shed} name="Machinery shed" h={4.5} info={INFO.shed} />
      <RectBuilding r={L.shop} name="Workshop" h={4} info={INFO.shop} />
      <RectBuilding r={L.feed} name="Feed store / small animals" h={3.5} info={INFO.feed} roofMat="paintGreen" />
      {L.barns.map((b, i) => (
        <RectBuilding key={b.id} r={b} name={`Livestock building ${i + 1}`} h={3.5} info={INFO.barn} wallMat="wood" />
      ))}
      <Part id="silo" name="Grain silo" role="housing" material="galvanised" info={INFO.silo} cites={[C.ln('p8 zone 3')]}>
        <PartMesh geometry={g.silo} position={P(L.silo.e, L.silo.n, 0.1)} castShadow />
      </Part>
      <Part id="fuel" name="Fuel store" role="housing" material="paintRed" info={INFO.fuel} cites={[C.ln('p27 hazardous stores')]}>
        <PartMesh geometry={g.unit} position={P(L.fuel.e, L.fuel.n, 1.3)} scale={[4, 2.5, 4]} castShadow />
        <Part id="fuel-ring" name="15 m separation radius" role="static" info={{ summary: '15 m separation radius.', role: 'No other building may stand inside this ring.' }} cites={[C.ln('p27')]} cut={false}>
          <PartMesh geometry={g.ring15} position={P(L.fuel.e, L.fuel.n, 0.39)} customMaterial={tint(a.fuelOk ? 'ring-ok' : 'ring-bad', a.fuelOk ? '#e0a03c' : '#e0503c', 1, 0.4)} />
        </Part>
      </Part>
      <Part id="services" name="Services" role="static" info={{ summary: 'Services.', role: 'Water, power and sanitation reach the work centres.' }} cites={[C.ln('p9–10 layout factors')]}>
        <Part id="water-tank" name="Borehole & water tank" role="housing" material="galvanised" info={INFO.tank} cites={[C.ln('p10 water supply')]}>
          <PartMesh geometry={g.tank} position={P(L.tank.e, L.tank.n, 0)} castShadow />
        </Part>
        <Part id="septic" name="Septic tank & drainage field" role="static" material="concrete" info={INFO.septic} cites={[C.ln('p12, p18')]}>
          <PartMesh geometry={g.unit} position={P(L.septic.e, L.septic.n, 0.3)} scale={[2.5, 0.6, 1.5]} />
          <PartMesh geometry={g.field} position={P(L.septic.e - 5, L.septic.n, 0.36)} material="soil" />
        </Part>
        <Part id="power" name="Power line" role="static" material="wood" info={INFO.power} cites={[C.ln('p10 utilities')]} cut={false}>
          {poles.map((n) => (
            <PartMesh key={n} geometry={g.pole} position={P(st.driveW / 2 + 2, n, 4)} castShadow />
          ))}
        </Part>
      </Part>

      <group ref={tractor}>
        <Tractor pose={pose} labels={false} linkage={false} />
      </group>

      <Arrow ref={arrow} color="#4aa3ff" radius={0.9} />
      {st.plume ? (
        <group position={P(L.barns[0].e / 2 + L.barns[1].e / 2, L.barns[0].n, 0)} rotation={[0, plumeYaw, 0]}>
          {plumeCurves.map((c, i) => (
            <Flow key={`${i}-${plumeColor}`} curve={c} count={50} radius={1.4} spread={14} color={plumeColor} intensity={() => 1} speed={0.08} emissive={0.3} />
          ))}
        </group>
      ) : null}

      {L.r.map((_, i) => (
        <PartLabel key={i} partId={`zone-${i + 1}`} at={P(-st.driveW / 2 - 4, 2 * L.rr[i] + st.widths[i] * (i === 1 ? 1.6 : 1), 3)} text={`Zone ${i + 1} · ${ZONES[i].short}`} />
      ))}
      <PartLabel partId="drive" at={P(0, L.far - 6, 2)} />
      <PartLabel partId="courtyard" at={P(L.court.r * 0.6, L.court.n, 2)} />
      <PartLabel partId="fuel" at={P(L.fuel.e, L.fuel.n, 4)} />
      <PartLabel partId="main-road" at={P(-L.r[3] * 0.6, -4.5, 2)} />
      <PartLabel partId="dwelling" at={P(L.house.e, L.house.n, 7)} />
      <PartLabel partId="parking" at={P(L.parking.e, L.parking.n, 2)} />
      <PartLabel partId="ground" at={P(0, L.far + 18, 2)} text="North ↑ (layout axis)" />
    </group>
  )
}
