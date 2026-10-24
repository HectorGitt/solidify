import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, pipe, tube, xform } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { getCustomMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { electricMotor, legStand } from '@/parts/lib/processing'
import { column, grainSilo } from '@/parts/lib/structures'
import { elevatedTank } from '@/parts/lib/water'

const motorAlongX = (r: number, length: number, x: number, y: number, z = 0) => xform(electricMotor({ r, length, feet: true }), mat4.c(mat4.t(x, y, z), mat4.ry(-Math.PI / 2)))
const motorUpright = (r: number, length: number, x: number, y: number, z = 0) => xform(electricMotor({ r, length }), mat4.c(mat4.t(x, y, z), mat4.rx(Math.PI / 2)))
const silo = (x: number) => {
  const s = grainSilo({ r: 1.4, h: 3.2, legH: 1.0, hopperH: 0.9, legSize: 0.18 })
  return xform(merge(s.barrel, s.roof, s.vent, s.hopper!, s.legs!), mat4.t(x, 0, 0))
}
import {
  ASME_SYMBOLS,
  BUILDING,
  C,
  
  
  assessLayout,
  live,
  usePlantLayout,
  type AsmeSymbol,
  
} from './model'

/** Creates a watertight ASME symbol 3D glyph. */
function makeAsmeGeometry(symbol: AsmeSymbol): THREE.BufferGeometry {
  switch (symbol) {
    case 'operation':
      // Circular ring (torus-like)
      return tube(0.65, 0.42, 0.18, 32)
    case 'transport':
      // Forward arrow
      return merge(
        xform(box(0.7, 0.16, 0.28), mat4.t(-0.25, 0, 0)),
        xform(cylinder(0.45, 0.18, 3), mat4.c(mat4.rz(-Math.PI / 2), mat4.t(0, 0.35, 0))),
      )
    case 'inspection':
      // Square frame / box
      return merge(
        xform(box(1.1, 0.16, 0.16), mat4.t(0, 0.47, 0)),
        xform(box(1.1, 0.16, 0.16), mat4.t(0, -0.47, 0)),
        xform(box(0.16, 0.16, 1.1), mat4.t(-0.47, 0, 0)),
        xform(box(0.16, 0.16, 1.1), mat4.t(0.47, 0, 0)),
      )
    case 'storage':
      // Inverted triangle
      return xform(cylinder(0.6, 0.18, 3), mat4.rz(Math.PI / 2))
    case 'delay':
      // D-shape glyph
      return merge(
        xform(box(0.2, 0.18, 1.0), mat4.t(-0.35, 0, 0)),
        xform(tube(0.5, 0.3, 0.18, 24), mat4.t(0.05, 0, 0)),
      )
  }
}

/** Builds specialized 3D geometries for Garri Line machinery. */
function buildGarriMachineryGeometries() {
  // 1. Intake: Unloading hopper & pallet crate
  const intake = merge(
    xform(box(3.2, 0.3, 2.6), mat4.t(0, 0.15, 0)),
    xform(box(2.8, 1.2, 2.2), mat4.t(0, 0.9, 0)),
    xform(box(1.6, 0.8, 1.4), mat4.t(1.2, 0.6, 1.1)),
  )

  // 2. Washer: Rotary perforated drum on support legs + water spray rail
  const washer = merge(
    xform(cylinder(0.75, 3.4, 28), mat4.c(mat4.rz(Math.PI / 2), mat4.t(0, 1.4, 0))),
    xform(cylinder(0.85, 0.2, 28), mat4.c(mat4.rz(Math.PI / 2), mat4.t(-1.3, 1.4, 0))),
    xform(cylinder(0.85, 0.2, 28), mat4.c(mat4.rz(Math.PI / 2), mat4.t(1.3, 1.4, 0))),
    legStand({ x: 1.3, z: 0.6, h: 1.4, leg: 0.15 }),
    xform(cylinder(0.06, 3.6, 16), mat4.c(mat4.rz(Math.PI / 2), mat4.t(0, 2.3, 0))),
  )

  // 3. Grater: Motorized cassava grater / hammer rasper
  const grater = merge(
    xform(box(1.8, 1.0, 1.8), mat4.t(0, 0.5, 0)),
    xform(cylinder(0.65, 1.2, 24), mat4.c(mat4.rz(Math.PI / 2), mat4.t(0, 1.4, 0))),
    xform(box(1.0, 0.9, 1.0), mat4.t(0, 2.1, 0)),
    motorAlongX(0.35, 0.7, 1.05, 1.4), // drive motor
  )

  // 4. Press: Hydraulic / screw rack dewatering press
  const press = merge(
    xform(box(3.2, 0.25, 2.4), mat4.t(0, 0.12, 0)),
    legStand({ x: 1.3, z: 0.9, h: 2.6, leg: 0.25 }),
    xform(box(3.0, 0.35, 2.0), mat4.t(0, 2.5, 0)),
    xform(box(2.4, 1.1, 1.6), mat4.t(0, 0.9, 0)), // press bags
    xform(cylinder(0.18, 0.8, 18), mat4.t(0, 1.9, 0)), // hydraulic jack
  )

  // 5. Sifter: Wet mash granulator & rotary screen
  const sifter = merge(
    xform(cylinder(0.6, 2.2, 24), mat4.c(mat4.rz(Math.PI / 2 + 0.1), mat4.t(0, 1.2, 0))),
    legStand({ x: 0.9, z: 0.5, h: 1.2, leg: 0.15 }),
    xform(box(0.7, 0.6, 0.7), mat4.t(-0.7, 1.9, 0)),
  )

  // 6. Fryer: Continuous garri roaster with burner bed & flue chimney
  const fryer = merge(
    xform(box(4.4, 0.9, 2.2), mat4.t(0, 0.45, 0)), // burner hearth
    xform(box(4.2, 0.5, 1.8), mat4.t(0, 1.15, 0)), // roasting trough
    xform(cylinder(0.22, 2.4, 20), mat4.t(1.8, 2.4, 0)), // exhaust flue / chimney
    xform(cylinder(0.22, 2.4, 20), mat4.t(-1.8, 2.4, 0)),
  )

  // 7. Cooler: Vibratory grader & cooling bed
  const cooler = merge(
    xform(box(3.2, 0.25, 1.8), mat4.t(0, 1.0, 0)),
    legStand({ x: 1.3, z: 0.7, h: 0.9, leg: 0.16 }),
    xform(box(0.6, 0.8, 0.8), mat4.t(1.7, 0.5, 0)), // exit chutes
  )

  // 8. Bagging: Weighing hopper & sewing pedestal
  const bagging = merge(
    xform(box(1.8, 1.4, 1.8), mat4.t(0, 1.9, 0)), // weigh hopper
    xform(cylinder(0.25, 0.8, 16), mat4.t(0, 1.0, 0)), // discharge spout
    xform(box(2.8, 0.4, 1.2), mat4.t(0, 0.2, 0)), // roller platform
    xform(box(0.12, 1.8, 0.12), mat4.t(-0.9, 0.9, 0.5)), // sewing column
    xform(box(0.4, 0.3, 0.4), mat4.t(-0.9, 1.5, 0.2)), // sewing head
  )

  return { intake, washer, grater, press, sifter, fryer, cooler, bagging }
}

/** Builds specialized 3D geometries for Feed Mill machinery. */
function buildFeedMillMachineryGeometries() {
  // 1. Intake: Floor pit grating & rotary scalper screen
  const intake = merge(
    xform(box(3.0, 0.2, 2.6), mat4.t(0, 0.1, 0)),
    xform(cylinder(0.65, 2.2, 24), mat4.c(mat4.rz(Math.PI / 2), mat4.t(0, 1.1, 0))),
    xform(cylinder(0.4, 1.8, 20), mat4.t(1.1, 1.8, 0)), // cyclone dust hood
  )

  // 2. Silos: Battery of twin storage silos with conical bottoms
  const silos = merge(silo(-1.5), silo(1.5))

  // 3. Grinder: Hammer mill with pneumatic discharge cyclone
  const grinder = merge(
    xform(box(1.8, 1.2, 1.8), mat4.t(0, 0.6, 0)),
    xform(cylinder(0.7, 1.4, 24), mat4.c(mat4.rz(Math.PI / 2), mat4.t(0, 1.6, 0))),
    xform(cylinder(0.45, 1.8, 20), mat4.t(1.0, 2.6, 0)), // cyclone collector
    xform(cylinder(0.08, 1.8, 12), mat4.t(0.5, 2.0, 0)), // pneumatic duct
  )

  // 4. Mixer: Horizontal U-trough ribbon batch mixer
  const mixer = merge(
    xform(box(3.2, 1.4, 1.8), mat4.t(0, 1.3, 0)),
    xform(cylinder(0.8, 3.0, 24), mat4.c(mat4.rz(Math.PI / 2), mat4.t(0, 0.8, 0))),
    legStand({ x: 1.4, z: 0.7, h: 1.2, leg: 0.2 }),
    motorAlongX(0.4, 0.8, 2.05, 1.2), // drive motor
  )

  // 5. Pellet Mill: Steam conditioner atop ring-die pellet press
  const pellet = merge(
    xform(box(2.6, 1.6, 2.2), mat4.t(0, 0.8, 0)), // press housing
    xform(cylinder(0.4, 2.4, 24), mat4.c(mat4.rz(Math.PI / 2), mat4.t(0, 2.3, 0))), // steam conditioner
    xform(cylinder(0.12, 1.0, 16), mat4.t(0, 1.8, 0)), // feed chute
    motorUpright(0.5, 0.9, 1.65, 0.8), // main motor
  )

  // 6. Cooler: Counter-flow pellet cooling tower
  const cooler = merge(
    xform(box(2.2, 3.2, 2.2), mat4.t(0, 2.0, 0)),
    legStand({ x: 0.9, z: 0.9, h: 1.0, leg: 0.2 }),
    xform(cylinder(0.35, 1.2, 20), mat4.t(0, 3.9, 0)), // exhaust fan hood
  )

  // 7. Crumbler: Roller crumbler and grading screen
  const crumbler = merge(
    xform(box(2.4, 1.0, 1.8), mat4.t(0, 2.0, 0)), // roll housing
    xform(cylinder(0.25, 1.6, 20), mat4.c(mat4.rz(Math.PI / 2), mat4.t(0, 2.0, -0.3))),
    xform(cylinder(0.25, 1.6, 20), mat4.c(mat4.rz(Math.PI / 2), mat4.t(0, 2.0, 0.3))),
    xform(box(2.6, 0.9, 2.0), mat4.t(0, 0.9, 0)), // sifter base
  )

  // 8. Bagging: Feed bagging scale & conveyor
  const bagging = merge(
    xform(box(1.8, 1.5, 1.8), mat4.t(0, 2.0, 0)),
    xform(cylinder(0.25, 0.9, 16), mat4.t(0, 1.0, 0)),
    xform(box(3.0, 0.35, 1.2), mat4.t(0, 0.2, 0)),
    xform(box(1.4, 1.2, 1.2), mat4.t(1.2, 0.8, 0)), // stacked pallets
  )

  return { intake, silos, grinder, mixer, pellet, cooler, crumbler, bagging }
}

/** Builds the factory building architecture. */
function buildFactoryBuilding() {
  const B = BUILDING
  const w = B.width
  const d = B.depth
  const h = B.height

  // Concrete floor slab with loading dock recesses
  const floor = box(w + 8, 0.4, d + 12)

  // Portal frame columns and trusses
  const framePillars: THREE.BufferGeometry[] = []
  const colSpacing = 6
  for (let x = -w / 2; x <= w / 2; x += colSpacing) {
    framePillars.push(xform(column({ h, size: 0.35 }), mat4.t(x, 0, -d / 2)))
    framePillars.push(xform(column({ h, size: 0.35 }), mat4.t(x, 0, d / 2)))
    // Roof truss rafter
    framePillars.push(xform(box(0.25, 0.3, d), mat4.t(x, h - 0.15, 0)))
  }
  const frame = merge(...framePillars)

  // Exterior wall cladding (lower concrete dado + perimeter skirts)
  const dadoWall = merge(
    xform(box(w, 1.6, 0.3), mat4.t(0, 0.8, -d / 2)),
    xform(box(0.3, 1.6, d), mat4.t(-w / 2, 0.8, 0)),
    xform(box(0.3, 1.6, d), mat4.t(w / 2, 0.8, 0)),
    // Front wall leaving gaps for loading docks
    xform(box(12, 1.6, 0.3), mat4.t(0, 0.8, d / 2)),
  )

  // Admin office block
  const admin = merge(
    xform(box(B.admin.w, 3.8, B.admin.d), mat4.t(B.admin.x, 1.9, B.admin.z)),
    xform(box(B.admin.w + 0.4, 0.3, B.admin.d + 0.4), mat4.t(B.admin.x, 3.9, B.admin.z)),
  )

  // Standby generator & utility bay
  const utility = merge(
    xform(box(B.utility.w, 3.2, B.utility.d), mat4.t(B.utility.x, 1.6, B.utility.z)),
    ...(({ tank, stand }) => [tank, stand])(elevatedTank({ r: 1.2, h: 2.8, standH: 3.0, spread: 0.75 })).map((g) => xform(g, mat4.t(B.utility.x + 1.2, 0, B.utility.z))), // elevated water tank
  )

  // Effluent / waste treatment sump
  const effluent = merge(
    xform(box(B.effluent.w, 0.8, B.effluent.d), mat4.t(B.effluent.x, 0.4, B.effluent.z)),
    xform(box(B.effluent.w - 0.4, 0.1, B.effluent.d - 0.4), mat4.t(B.effluent.x, 0.76, B.effluent.z)), // drainage grating
  )

  // Loading dock doors & bumper pads
  const docks = merge(
    xform(box(3.8, 4.2, 0.25), mat4.t(B.docks.in[0], 2.1, B.docks.in[1])),
    xform(box(3.8, 4.2, 0.25), mat4.t(B.docks.out[0], 2.1, B.docks.out[1])),
    xform(box(4.4, 0.8, 1.8), mat4.t(B.docks.in[0], -0.1, B.docks.in[1] + 1.2)),
    xform(box(4.4, 0.8, 1.8), mat4.t(B.docks.out[0], -0.1, B.docks.out[1] + 1.2)),
  )

  return { floor, frame, dadoWall, admin, utility, effluent, docks }
}

/** Forklift model. */
function buildForklift() {
  return merge(
    xform(box(1.8, 1.2, 1.2), mat4.t(0, 0.7, 0)), // chassis
    xform(box(0.8, 1.1, 1.0), mat4.t(0.2, 1.6, 0)), // cab cage
    xform(cylinder(0.32, 0.25, 16), mat4.c(mat4.rx(Math.PI / 2), mat4.t(0.7, 0.32, 0.6))), // wheels
    xform(cylinder(0.32, 0.25, 16), mat4.c(mat4.rx(Math.PI / 2), mat4.t(0.7, 0.32, -0.6))),
    xform(cylinder(0.28, 0.22, 16), mat4.c(mat4.rx(Math.PI / 2), mat4.t(-0.7, 0.28, 0.6))),
    xform(cylinder(0.28, 0.22, 16), mat4.c(mat4.rx(Math.PI / 2), mat4.t(-0.7, 0.28, -0.6))),
    xform(box(0.12, 2.2, 0.8), mat4.t(-1.0, 1.2, 0)), // mast
    xform(box(1.2, 0.08, 0.15), mat4.t(-1.5, 0.2, 0.25)), // forks
    xform(box(1.2, 0.08, 0.15), mat4.t(-1.5, 0.2, -0.25)),
  )
}

export function Scene3D() {
  const params = usePlantLayout()
  const a = useMemo(() => assessLayout(params), [params])
  const forkliftRef = useRef<THREE.Group>(null)

  // Cache complex geometry
  const asmeGeos = useMemo(
    () => ({
      operation: makeAsmeGeometry('operation'),
      transport: makeAsmeGeometry('transport'),
      inspection: makeAsmeGeometry('inspection'),
      storage: makeAsmeGeometry('storage'),
      delay: makeAsmeGeometry('delay'),
    }),
    [],
  )

  const garriGeos = useMemo(() => buildGarriMachineryGeometries(), [])
  const feedGeos = useMemo(() => buildFeedMillMachineryGeometries(), [])
  const bldg = useMemo(() => buildFactoryBuilding(), [])
  const forkliftGeo = useMemo(() => buildForklift(), [])

  // Create connecting conveyor / material flow polyline curves
  const flowCurves = useMemo(() => {
    const pts = a.positions
    const curves: { curve: THREE.Curve<THREE.Vector3>; color: string; from: [number, number]; to: [number, number] }[] = []

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = new THREE.Vector3(pts[i][0], 1.2, pts[i][1])
      const p2 = new THREE.Vector3(pts[i + 1][0], 1.2, pts[i + 1][1])
      const lineCurve = new THREE.LineCurve3(p1, p2)

      const color =
        params.line === 'garri'
          ? i < 2
            ? '#855938' // fresh tubers / peels
            : i < 5
              ? '#f3f4f6' // white dewatered mash
              : '#facc15' // roasted yellow garri
          : i < 2
            ? '#ca8a04' // raw maize grain
            : i < 4
              ? '#fde047' // meal blend
              : '#65a30d' // durable green feed pellets

      curves.push({ curve: lineCurve, color, from: pts[i], to: pts[i + 1] })
    }
    return curves
  }, [a.positions, params.line])

  // Material-flow connecting duct geometry
  const ductGeometries = useMemo(() => {
    return flowCurves.map((c) => {
      return pipe(c.curve, 0.09, 0.07, 16, 8)
    })
  }, [flowCurves])

  // Crossing points markers
  const crossingPoints = useMemo(() => {
    if (a.crossings === 0) return []
    // Intersection calculation for odd-angle
    const segs = a.positions.slice(0, -1).map((p, i) => ({ p1: p, p2: a.positions[i + 1] }))
    const hits: [number, number][] = []

    const lineIntersect = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number,
      x4: number,
      y4: number,
    ): [number, number] | null => {
      const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
      if (Math.abs(denom) < 1e-6) return null
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
      const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom
      if (t > 0.05 && t < 0.95 && u > 0.05 && u < 0.95) {
        return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]
      }
      return null
    }

    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        if (Math.abs(i - j) < 2) continue
        const pt = lineIntersect(segs[i].p1[0], segs[i].p1[1], segs[i].p2[0], segs[i].p2[1], segs[j].p1[0], segs[j].p1[1], segs[j].p2[0], segs[j].p2[1])
        if (pt) hits.push(pt)
      }
    }
    return hits
  }, [a.positions, a.crossings])

  const warningConeGeo = useMemo(() => {
    return merge(
      xform(cylinder(0.5, 0.8, 16), mat4.t(0, 0.4, 0)),
      xform(cylinder(0.7, 0.08, 16), mat4.t(0, 0.04, 0)),
    )
  }, [])

  // Animate handling truck along main access corridor
  useSimFrame((dt) => {
    live.flowPhase = (live.flowPhase + dt * 0.4) % 1
    if (forkliftRef.current) {
      // Moves back and forth along the front corridor (z = 10, x from -9 to +9)
      const t = Math.sin(live.flowPhase * Math.PI * 2)
      const x = t * 9.0
      const heading = Math.cos(live.flowPhase * Math.PI * 2) >= 0 ? 0 : Math.PI
      forkliftRef.current.position.set(x, 0.05, 10.2)
      forkliftRef.current.rotation.set(0, heading, 0)
      live.forkliftPos = [x, 0.05, 10.2]
    }
  })

  // Machine geometry lookup
  const getMachineryMesh = (index: number) => {
    if (params.line === 'garri') {
      const keys = ['intake', 'washer', 'grater', 'press', 'sifter', 'fryer', 'cooler', 'bagging'] as const
      return garriGeos[keys[index]]
    } else {
      const keys = ['intake', 'silos', 'grinder', 'mixer', 'pellet', 'cooler', 'crumbler', 'bagging'] as const
      return feedGeos[keys[index]]
    }
  }

  return (
    <group>
      {/* 1. Building Architecture & Floor */}
      <Part id="floor" name="Factory Floor & Work Zones" role="static" material="concrete" info={{ summary: 'Reinforced industrial floor.', role: 'Smooth epoxy coating with painted transit corridors and equipment pad demarcation.' }} cites={[C.hand('Note 4 Factory Layout')]}>
        <PartMesh geometry={bldg.floor} position={[0, -0.2, 0]} receiveShadow />
      </Part>

      <Part id="frame" name="Steel Portal Frame Structure" role="housing" material="steelDark" info={{ summary: 'Structural steel columns & rafters.', role: 'Provides 36 m × 26 m clear span without obstructive interior columns.' }} cites={[C.hand('Note 4 Factory Layout')]}>
        <PartMesh geometry={bldg.frame} position={[0, 0, 0]} castShadow />
      </Part>

      <Part id="dado-wall" name="Perimeter Dado Wall" role="housing" material="concrete" info={{ summary: 'Lower protective dado wall.', role: 'Impact-resistant perimeter walls with large ventilating louvres.' }} cites={[C.hand('Note 4 Factory Layout')]}>
        <PartMesh geometry={bldg.dadoWall} position={[0, 0, 0]} castShadow />
      </Part>

      <Part id="docks" name="Loading Docks (Intake & Dispatch)" role="housing" material="steel" info={{ summary: 'Lorry loading docks.', role: 'Separate dock doors for incoming raw material reception and finished goods container loading.' }} cites={[C.hand('Note 4 Factory Layout')]}>
        <PartMesh geometry={bldg.docks} position={[0, 0, 0]} castShadow />
      </Part>

      <Part id="admin" name="Administration & Quality Lab" role="housing" material="paintBlue" info={{ summary: 'Admin office & QC lab.', role: 'Positioned at the front approach (Rule 5) to control personnel access and test incoming/outgoing samples.' }} cites={[C.hand('Note 4 Good layout rule 5')]}>
        <PartMesh geometry={bldg.admin} position={[0, 0, 0]} castShadow />
      </Part>

      <Part id="utility" name="Generator Bay & Water Tank" role="housing" material="paintGrey" info={{ summary: 'External utility compound.', role: 'Sound-damped generator, borehole pump, and elevated water tank (Rule 6).' }} cites={[C.hand('Note 4 Good layout rule 6')]}>
        <PartMesh geometry={bldg.utility} position={[0, 0, 0]} castShadow />
      </Part>

      <Part id="effluent" name="Waste & Effluent Treatment Sump" role="housing" material="concrete" info={{ summary: 'Effluent treatment sump.', role: 'Collects washing starch liquor and cyanogenic peel waste safely away from clean food zones.' }} cites={[C.hand('Note 4 Planning step 7')]}>
        <PartMesh geometry={bldg.effluent} position={[0, 0, 0]} castShadow />
      </Part>

      {/* 2. Equipment Stations */}
      {a.stations.map((s, i) => {
        const [x, z] = a.positions[i]
        const geo = getMachineryMesh(i)

        return (
          <group key={s.id} position={[x, 0, z]}>
            {/* Equipment machine body */}
            <Part
              id={`station-${s.id}`}
              name={s.name}
              role="moving"
              material={s.material}
              info={{ summary: s.summary, role: s.role, details: s.details }}
              cites={[C.hand('Note 4 equipment flow')]}
            >
              <PartMesh geometry={geo} castShadow receiveShadow />

              {/* Station floor boundary safety demarcation */}
              {params.showAisles ? (
                <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[s.dim[0] + 0.8, s.dim[2] + 0.8]} />
                  <meshBasicMaterial color={s.color} transparent opacity={0.16} depthWrite={false} />
                </mesh>
              ) : null}

              {/* Floating ASME Symbol 3D Glyph */}
              {params.showAsme ? (
                <group position={[0, s.dim[1] + 1.2, 0]}>
                  <PartMesh
                    geometry={asmeGeos[s.asme]}
                    customMaterial={getCustomMaterial(`asme-${s.asme}`, () => {
                      const mat = new THREE.MeshStandardMaterial({
                        color: ASME_SYMBOLS[s.asme].color,
                        emissive: ASME_SYMBOLS[s.asme].color,
                        emissiveIntensity: 0.45,
                        roughness: 0.2,
                        metalness: 0.8,
                      })
                      return mat
                    })}
                  />
                </group>
              ) : null}

              {/* Hazard indicators (Noise / Heat / Water) */}
              {params.showHazards ? (
                <group position={[0, s.dim[1] + 0.3, 0]}>
                  {s.hazards.heat || s.hazards.steam ? (
                    <mesh position={[0.7, 0, 0]}>
                      <sphereGeometry args={[0.22, 12, 12]} />
                      <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
                    </mesh>
                  ) : null}
                  {s.hazards.noise || s.hazards.dust ? (
                    <mesh position={[-0.7, 0, 0]}>
                      <sphereGeometry args={[0.22, 12, 12]} />
                      <meshBasicMaterial color="#f59e0b" transparent opacity={0.8} />
                    </mesh>
                  ) : null}
                  {s.hazards.water ? (
                    <mesh position={[0, 0, 0.7]}>
                      <sphereGeometry args={[0.22, 12, 12]} />
                      <meshBasicMaterial color="#0ea5e9" transparent opacity={0.8} />
                    </mesh>
                  ) : null}
                </group>
              ) : null}
            </Part>
          </group>
        )
      })}

      {/* 3. Connecting Material Flow Ducts & Conveyors */}
      <Part
        id="conveyors"
        name="Material Conveying Lines"
        role="static"
        material="galvanised"
        info={{ summary: 'Inter-machine conveying system.', role: 'Belt, screw, bucket, and pneumatic conveyors transferring products along the flow route.' }}
        cites={[C.hand('Note 3 Materials handling')]}
      >
        {ductGeometries.map((g, i) => (
          <PartMesh key={i} geometry={g} castShadow />
        ))}
      </Part>

      {/* 4. Animated Crop / Feed Material Flow Particles */}
      {params.showFlow
        ? flowCurves.map((fc, i) => (
            <Flow
              key={`flow-${params.pattern}-${params.line}-${i}`}
              curve={fc.curve}
              count={35}
              radius={0.06}
              color={fc.color}
              intensity={() => 1}
              speed={0.65}
              spread={0.04}
            />
          ))
        : null}

      {/* 5. Crossing Route Warning Cones (Visible when layout has collisions/crossings) */}
      {crossingPoints.map((pt, i) => (
        <group key={`cross-${i}`} position={[pt[0], 0, pt[1]]}>
          <PartMesh
            geometry={warningConeGeo}
            customMaterial={getCustomMaterial('hazard-cone', () => {
              return new THREE.MeshStandardMaterial({
                color: '#dc2626',
                emissive: '#ef4444',
                emissiveIntensity: 0.6,
                roughness: 0.3,
              })
            })}
          />
        </group>
      ))}

      {/* 6. Animated Forklift Transport Truck */}
      {params.showHandling ? (
        <group ref={forkliftRef}>
          <Part
            id="forklift"
            name="Forklift Material Handling Unit"
            role="moving"
            material="paintYellow"
            info={{ summary: 'Unit-load handling vehicle.', role: 'Transports raw bins and palletized finished sacks along main 3.0 m aisles.' }}
            cites={[C.hand('Note 4 clear aisles rule')]}
          >
            <PartMesh geometry={forkliftGeo} castShadow />
          </Part>
        </group>
      ) : null}

      {/* 7. Key Labels */}
      {a.stations.map((s, i) => {
        const [x, z] = a.positions[i]
        return (
          <PartLabel
            key={`lbl-${s.id}`}
            partId={`station-${s.id}`}
            at={[x, s.dim[1] + (params.showAsme ? 2.2 : 0.8), z]}
            text={`${i + 1} · ${s.short}`}
          />
        )
      })}
      <PartLabel partId="admin" at={[BUILDING.admin.x, 4.4, BUILDING.admin.z]} text="Admin Office & QA" />
      <PartLabel partId="docks" at={[BUILDING.docks.in[0], 4.6, BUILDING.docks.in[1]]} text="Intake Dock" />
      <PartLabel partId="docks" at={[BUILDING.docks.out[0], 4.6, BUILDING.docks.out[1]]} text="Dispatch Dock" />
      <PartLabel partId="utility" at={[BUILDING.utility.x, 5.2, BUILDING.utility.z]} text="Generator & Water" />
      <PartLabel partId="effluent" at={[BUILDING.effluent.x, 1.6, BUILDING.effluent.z]} text="Effluent Sump" />
    </group>
  )
}
