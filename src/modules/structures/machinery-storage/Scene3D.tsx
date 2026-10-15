import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, xform } from '@/geometry'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { HAZARD_SEPARATION, MACHINES, WORKSHOP } from '@/physics/structures'
import { TRACTOR } from '@/tractor/dims'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { column, gableRoof, kingPostTruss, ringSlab, walls } from '@/parts/lib/structures'
import { discGang, mouldboardBottom, roadWheel } from '@/parts/lib/implements'
import { tint } from '../_shared/build'
import { C, design, live, useStorage } from './model'

const { PI } = Math
/** front of the shared tractor ahead of its rear axle (approx.), m */
const NOSE = 2.6

const cyl = (r: number, h: number, m: THREE.Matrix4, seg = 20) => xform(cylinder(r, h, seg), m)
const bx = (w: number, h: number, d: number, x: number, y: number, z: number) => xform(box(w, h, d), mat4.t(x, y, z))

function trailerGeo() {
  const m = MACHINES.trailer
  const bed = bx(m.l - 1, 0.12, m.w, 0.5, 0.95, 0)
  const sides = merge(bx(m.l - 1, 0.5, 0.06, 0.5, 1.26, m.w / 2 - 0.03), bx(m.l - 1, 0.5, 0.06, 0.5, 1.26, -m.w / 2 + 0.03), bx(0.06, 0.5, m.w - 0.12, 0.5 + (m.l - 1) / 2 - 0.03, 1.26, 0), bx(0.06, 0.5, m.w - 0.12, 0.5 - (m.l - 1) / 2 + 0.03, 1.26, 0))
  const draw = merge(bx(1.1, 0.1, 0.1, -m.l / 2 + 0.55, 0.6, 0.3), bx(1.1, 0.1, 0.1, -m.l / 2 + 0.55, 0.6, -0.3))
  // the library's implement road wheels (tyre, rim, nuts and hub cap)
  const w = roadWheel(0.42, 0.3)
  const wheels = merge(...[-1, 1].map((s) => xform(w.tyre, mat4.t(0.6, 0.42, s * (m.w / 2 - 0.2)))))
  const rims = merge(...[-1, 1].map((s) => xform(w.rim, mat4.c(mat4.t(0.6, 0.42, s * (m.w / 2 - 0.2)), s < 0 ? mat4.ry(PI) : mat4.t(0, 0, 0)))))
  return { body: merge(bed, sides, draw), wheels, rims }
}

function ploughGeo() {
  const m = MACHINES.plough
  const beam = merge(bx(m.l, 0.12, 0.12, 0, 0.9, 0), bx(0.12, 0.12, m.w, -m.l / 2 + 0.3, 0.9, 0), bx(0.1, 0.7, 0.1, -m.l / 2 + 0.3, 1.25, 0))
  // three of the library's mouldboard bottoms, resting on the floor under the beam
  const b = mouldboardBottom(0.36, 0.2, 'general', 0.01, 0.01, 0.75)
  const one = merge(b.share, b.board, b.landside, b.heel, b.frog, b.shin, b.standard)
  one.computeBoundingBox()
  const lift = -one.boundingBox!.min.y
  const bodies = merge(...[0, 1, 2].map((i) => xform(one, mat4.t(-0.3 + i * 0.6, lift, -0.4 + i * 0.4))))
  return { frame: beam, bodies }
}

function harrowGeo() {
  const m = MACHINES.harrow
  const frame = merge(bx(m.l, 0.1, 0.1, 0, 0.75, m.w / 2 - 0.1), bx(m.l, 0.1, 0.1, 0, 0.75, -m.w / 2 + 0.1), bx(0.1, 0.1, m.w, 0.5, 0.75, 0), bx(0.1, 0.1, m.w, -0.5, 0.75, 0), bx(0.9, 0.1, 0.1, -m.l / 2 + 0.45, 0.65, 0))
  // two of the library's concave disc gangs
  const gang = discGang({ n: 9, spacing: 0.25, R: 0.27 })
  return { frame, discs: merge(...[0.5, -0.5].map((x) => xform(gang, mat4.t(x, 0.27, 0)))) }
}

export function Scene3D() {
  const st = useStorage()
  const D = useMemo(() => design(st), [st])
  const pose = useMemo(() => createTractorPose(), [])
  const tractor = useRef<THREE.Group>(null)
  const clock = useRef({ t: 0, z: 0 })
  const H = D.height
  const ws = D.workshop
  const wsCx = (ws.x0 + ws.x1) / 2
  const zBack = -D.depth / 2
  const zFront = D.depth / 2
  const driveZ = zFront + 1.5 + st.driveW / 2
  const padZ = driveZ + st.driveW / 2 + st.turnR + 1
  const benchX = ws.x0 + 0.15 + WORKSHOP.bench.lMin / 2 + 0.1
  const benchZ = zBack + 0.15 + WORKSHOP.bench.dMax / 2
  const parkX = D.length / 2 + 2 + (3 * D.stall.w) / 2 + Math.max(0, st.turnR - D.length / 2)

  const g = useMemo(() => {
    const t = 0.15
    const ws = D.workshop
    const workshopWalls = walls({
      w: ws.w,
      d: D.depth,
      h: H,
      t,
      openings: [
        { side: '+z', at: 0, width: D.door.w, height: D.door.h },
        { side: '-x', at: D.depth / 4, width: D.fireDoor.w, height: D.fireDoor.h },
        { side: '-z', at: benchX - (ws.x0 + ws.x1) / 2, width: 2.4, height: 2.3, sill: 1.15 },
      ],
    })
    const shedLen = D.length - ws.w
    const shedBack = bx(shedLen, H, 0.06, ws.x1 + shedLen / 2, H / 2, zBack + 0.03)
    const shedEnd = bx(0.06, H, D.depth - 0.06, D.length / 2 - 0.03, H / 2, 0.03)
    const lines = [ws.x1, ...D.bays.map((b) => b.x1)]
    const post = column({ h: H, size: 0.2, round: true })
    const posts = merge(...lines.flatMap((x) => [zFront - 0.12, zBack + 0.18].map((z) => xform(post, mat4.t(Math.min(x, D.length / 2 - 0.15), 0, z)))))
    const roof = gableRoof({ span: D.depth, length: D.length, pitchDeg: 15, overhang: 0.6, t: 0.06 }).geometry
    const tr = xform(kingPostTruss({ span: D.depth, pitchDeg: 15 }), mat4.ry(PI / 2))
    const trusses = merge(...[D.workshop.x0 + 0.2, ...lines].map((x) => xform(tr, mat4.t(Math.min(x, D.length / 2 - 0.2), 0, 0))))
    const floorWs = bx(ws.w, 0.15, D.depth, (ws.x0 + ws.x1) / 2, 0.075, 0)
    const floorShed = bx(shedLen, 0.2, D.depth + 0.6, ws.x1 + shedLen / 2, 0.1, 0.3)
    const bench = merge(bx(WORKSHOP.bench.lMin, 0.06, WORKSHOP.bench.dMax, 0, WORKSHOP.bench.h - 0.03, 0), ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => bx(0.06, WORKSHOP.bench.h - 0.06, 0.06, sx * 1.4, (WORKSHOP.bench.h - 0.06) / 2, sz * 0.32))))
    const vice = merge(bx(0.22, 0.12, 0.14, 0, 0.06, 0), bx(0.04, 0.04, 0.3, 0, 0.1, 0.12))
    const span = Math.min(st.liftSpan, D.depth - 0.3)
    const lifting =
      span <= WORKSHOP.timberBeamMaxSpan
        ? { beam: bx(0.15, 0.25, span, 0, 0, 0), timber: true }
        : { beam: merge(bx(0.12, 0.3, span, 0, 0, 0), bx(0.25, 0.02, span, 0, 0.15, 0), bx(0.25, 0.02, span, 0, -0.15, 0)), timber: false }
    const hoist = merge(bx(0.3, 0.2, 0.25, 0, -0.27, 0), cyl(0.012, 1.3, mat4.t(0, -1.02, 0), 6), xform(box(0.08, 0.15, 0.03), mat4.t(0, -1.75, 0)))
    const cabinet = bx(1.0, 1.9, 0.45, 0, 0.95, 0)
    const ext = merge(cyl(0.09, 0.55, mat4.t(0, 0.4, 0), 16), cyl(0.03, 0.1, mat4.t(0, 0.72, 0), 8))
    const buckets = merge(...[0, 1, 2].map((i) => cyl(0.14, 0.3, mat4.t(0.35 + i * 0.32, 0.15, 0), 16)))
    const sand = merge(...[0, 1, 2].map((i) => cyl(0.12, 0.02, mat4.t(0.35 + i * 0.32, 0.27, 0), 16)))
    const welder = bx(0.5, 0.8, 0.6, 0, 0.4, 0)
    // fuel store
    const fs = 3
    const fWalls = walls({
      w: fs,
      d: fs,
      h: 2.4,
      t: 0.15,
      openings: [
        { side: '+z', at: 0, width: 1.0, height: 2.0 },
        { side: '-z', at: -0.8, width: 0.6, height: 2.3, sill: 1.95 },
        { side: '-z', at: 0.8, width: 0.6, height: 0.4, sill: 0.15 },
        { side: '+x', at: 0, width: 0.6, height: 2.3, sill: 1.95 },
        { side: '-x', at: 0, width: 0.6, height: 0.4, sill: 0.15 },
      ],
    })
    const fFloor = bx(fs, 0.15, fs, 0, 0.075, 0)
    const bund = bx(1.0, 0.15, 0.15, 0, 0.225, fs / 2 - 0.075)
    const fRoof = gableRoof({ span: fs, length: fs, pitchDeg: 10, overhang: 0.3, t: 0.05 }).geometry
    const drums = merge(...[-0.8, -0.1, 0.6].map((x) => cyl(0.29, 0.88, mat4.t(x, 0.15 + 0.44, -0.75), 20)))
    const sign = bx(0.6, 0.4, 0.03, 0.9, 1.6, fs / 2 + 0.02)
    const ring = ringSlab({ rOuter: HAZARD_SEPARATION + 1.5 + 0.2, rInner: HAZARD_SEPARATION + 1.5 - 0.2, h: 0.04 })
    const pad = ringSlab({ rOuter: st.turnR + 0.2, rInner: st.turnR - 0.2, h: 0.03 })
    const stripes = merge(...[0, 1, 2, 3].map((i) => bx(0.12, 0.02, D.stall.l, (i - 1.5) * D.stall.w, 0, 0)))
    return { workshopWalls, shedBack, shedEnd, posts, roof, trusses, floorWs, floorShed, bench, vice, lifting, hoist, cabinet, ext, buckets, sand, welder, fWalls, fFloor, bund, fRoof, drums, sign, ring, pad, stripes, unit: box(1, 1, 1), trailer: trailerGeo(), plough: ploughGeo(), harrow: harrowGeo() }
  }, [D, H, st.liftSpan, st.turnR, zBack, zFront, benchX])

  const zIn = zBack + st.workSpace + NOSE
  const zOut = padZ
  const zPark = zBack + 0.4 + NOSE
  const bayX = (k: string) => D.bays.find((b) => b.key === k)!.cx

  useSimFrame((dt) => {
    const s = useStorage.getState()
    const c = clock.current
    let z: number
    let x: number
    if (s.drive) {
      // drive in (8 s), stand (3 s), back out (8 s), stand (3 s)
      c.t = (c.t + dt) % 22
      const t = c.t
      const ease = (u: number) => 0.5 - 0.5 * Math.cos(PI * Math.min(1, Math.max(0, u)))
      const u = t < 8 ? ease(t / 8) : t < 11 ? 1 : t < 19 ? 1 - ease((t - 11) / 8) : 0
      z = zOut + (zIn - zOut) * u
      x = wsCx
    } else {
      z = zPark
      x = bayX('tractor')
    }
    const ds = c.z - z
    c.z = z
    if (tractor.current) {
      tractor.current.position.set(x, 0.15, z)
      tractor.current.rotation.set(0, PI / 2, 0)
    }
    pose.rearAngle += ds / TRACTOR.rear.rolling
    pose.frontAngle += ds / TRACTOR.front.radius
    pose.engineAngle += dt * 2 * PI * 15
    live.inside = z - NOSE < zFront ? 1 : 0
  })

  const span = Math.min(st.liftSpan, D.depth - 0.3)
  const fuelZ = 0
  const fuelOkColor = D.fuelOk ? '#e0a03c' : '#e0503c'

  return (
    <group>
      <Part id="ground" name="Farmyard" role="static" material="crop" info={{ summary: 'Level, well-drained farmyard.', role: 'The workshop sits near the work centre and the house, on level, well-drained ground close to the power supply.' }} cites={[C.ln('p23')]} cut={false}>
        <PartMesh geometry={g.unit} position={[st.fuelGap / 2 + 6, -0.1, 10]} scale={[D.length + st.fuelGap + 70, 0.2, 80]} receiveShadow />
      </Part>
      <Part id="drives" name="Drive, turning area & parking" role="static" material="concrete" info={{ summary: 'Drive, turning area and parking.', role: 'Two-way drive 16–20 ft (≈ 5–6 m), one-way 12 ft; turning radius 40–50 ft (12–15 m) for farm equipment; large-vehicle stalls 12 × 60 ft. Graded, drained, lit and signed.' }} cites={[C.ln('p21–22')]} cut={false}>
        <Part id="drive" name="Drive" role="static" material="concrete" info={{ summary: 'Two-way drive.', role: 'Two-way 16–20 ft, one-way 12 ft wide; concrete or asphalt for heavy use, gravel for light traffic.' }} cites={[C.ln('p21')]}>
          <PartMesh geometry={g.unit} position={[st.fuelGap / 2 + 4, 0.02, driveZ]} scale={[D.length + st.fuelGap + 40, 0.04, st.driveW]} receiveShadow />
        </Part>
        <Part id="turning" name="Turning circle" role="static" material="paintYellow" info={{ summary: 'Turning circle.', role: 'Farm equipment needs a 40–50 ft (12–15 m) turning radius; keep the circle clear.' }} cites={[C.ln('p22')]}>
          <PartMesh geometry={g.pad} position={[0, 0.03, padZ]} />
        </Part>
        <Part id="parking" name="Large-vehicle stalls" role="static" material="concrete" info={{ summary: 'Large-vehicle parking.', role: 'Stalls 12 × 60 ft (≈ 3.7 × 18.3 m) each.' }} cites={[C.ln('p22')]}>
          <PartMesh geometry={g.unit} position={[parkX, 0.025, driveZ + st.driveW / 2 + D.stall.l / 2]} scale={[3 * D.stall.w, 0.05, D.stall.l]} receiveShadow />
          <PartMesh geometry={g.stripes} position={[parkX, 0.05, driveZ + st.driveW / 2 + D.stall.l / 2]} material="paintYellow" />
        </Part>
      </Part>

      <Part id="building" name="Workshop & machinery shed" role="housing" material="galvanised" info={{ summary: 'Combined building.', role: 'Workshop at one end, machinery storage in the rest. Fire-resistant: pole frame, earth floor, sheet-metal walls, timber trusses, metal roofing.' }} cites={[C.ln('p25–26')]}>
        <Part id="workshop" name="Workshop" role="housing" material="galvanised" info={{ summary: 'Farm workshop.', role: 'Room for the largest machine plus working space around it; a door wide and high enough for it and a second door for fire escape; light, power and water.' }} cites={[C.ln('p23–25 features i–viii')]}>
          <PartMesh geometry={g.floorWs} material="concrete" receiveShadow />
          <PartMesh geometry={g.workshopWalls} position={[wsCx, 0.15, 0]} castShadow receiveShadow />
          <Part id="bench" name="Workbench & vice" role="static" material="wood" info={{ summary: 'Workbench with a large vice.', role: '1 m high, no more than 800 mm deep, at least 3 m long, under windows for light.' }} cites={[C.ln('p25 viii')]} position={[benchX, 0.15, benchZ]}>
            <PartMesh geometry={g.bench} />
            <PartMesh geometry={g.vice} position={[1.2, WORKSHOP.bench.h, 0.25]} material="castIron" />
          </Part>
          <Part id="lifting" name={g.lifting.timber ? 'Timber lifting beam' : 'Lifting truss & hoist'} role="static" material={g.lifting.timber ? 'wood' : 'steel'} info={{ summary: g.lifting.timber ? 'Timber lifting beam.' : 'Steel lifting beam with chain hoist.', role: 'A timber beam serves a span up to 3 m; beyond that use a truss or a portable hoist.' }} cites={[C.ln('p24 iii')]} position={[wsCx, H - 0.3, (D.depth - span) / 2 - D.depth / 2 + span / 2]}>
            <PartMesh geometry={g.lifting.beam} />
            <PartMesh geometry={g.hoist} material="paintYellow" />
          </Part>
          <Part id="cabinet" name="Lockable tool cabinet" role="static" material="paintGrey" info={{ summary: 'Lockable tool cabinet.', role: 'Tools hang on the doors and back board, locked away.' }} cites={[C.ln('p25 vii')]} position={[ws.x1 - 0.7, 0.15, zBack + 0.4]}>
            <PartMesh geometry={g.cabinet} />
          </Part>
          <Part id="fire-kit" name="Extinguisher & sand buckets" role="static" material="paintRed" info={{ summary: 'Fire extinguisher and 2–3 buckets of dry sand.', role: 'For fuel fires, kept by the main door.' }} cites={[C.ln('p24 vi')]} position={[ws.x1 - 1.6, 0.15, zFront - 0.5]}>
            <PartMesh geometry={g.ext} />
            <PartMesh geometry={g.buckets} material="paintRed" />
            <PartMesh geometry={g.sand} material="soil" />
          </Part>
          <Part id="welder" name="Welder" role="static" material="paintBlue" info={{ summary: 'Arc welder.', role: 'Kept near the main door and away from woodworking; no sawdust or oily rags nearby.' }} cites={[C.ln('p25 safety')]} position={[ws.x0 + 0.6, 0.15, zFront - 0.8]}>
            <PartMesh geometry={g.welder} />
          </Part>
        </Part>
        <Part id="shed" name="Machinery shed" role="housing" material="galvanised" info={{ summary: 'Open-sided machinery shed.', role: 'Narrow, open-fronted, as high as the tallest machine, on a raised, well-drained earth or gravel floor. Bays sized from machine outlines plus manoeuvring space so no machine has to be moved to get another out.' }} cites={[C.ln('p25–26')]}>
          <PartMesh geometry={g.floorShed} material="soil" receiveShadow />
          <PartMesh geometry={g.shedBack} castShadow />
          <PartMesh geometry={g.shedEnd} castShadow />
          <Part id="posts" name="Poles (post grid)" role="static" material="wood" info={{ summary: 'Pole frame.', role: 'Posts marked on the layout sketch so machines can be arranged between them.' }} cites={[C.ln('p26')]}>
            <PartMesh geometry={g.posts} castShadow />
          </Part>
        </Part>
        <Part id="roof" name="Roof & timber trusses" role="housing" material="galvanised" info={{ summary: 'Metal roof on timber trusses.', role: 'Trusses give a clear span with no intermediate posts; metal, asbestos-cement or sisal-cement roofing.' }} cites={[C.ln('p24 i, p26')]} explode={[0, 4, 0]}>
          <PartMesh geometry={g.roof} position={[0, H + 0.15, 0]} rotation={[0, PI / 2, 0]} castShadow />
          <Part id="trusses" name="Timber trusses" role="static" material="wood" info={{ summary: 'Timber trusses.', role: 'Clear span over the machines.' }} cites={[C.ln('p26')]}>
            <PartMesh geometry={g.trusses} position={[0, H + 0.1, 0]} />
          </Part>
        </Part>
      </Part>

      <Part id="machines" name="Stored implements" role="static" info={{ summary: 'Stored implements.', role: 'Cleaned and greased before storage; ploughs and harrows may stand outside in a fenced compound, tractors and complex machines under cover.' }} cites={[C.ln('p25–26')]} cut={false}>
        <Part id="trailer" name="Trailer" role="static" material="paintGreen" info={{ summary: 'Farm trailer.', role: `Envelope ${MACHINES.trailer.l} × ${MACHINES.trailer.w} × ${MACHINES.trailer.h} m (typical).` }} beyondNotes position={[bayX('trailer'), 0.2, zBack + 0.3 + MACHINES.trailer.l / 2]} rotation={[0, PI / 2, 0]}>
          <PartMesh geometry={g.trailer.body} />
          <PartMesh geometry={g.trailer.wheels} material="rubber" />
          <PartMesh geometry={g.trailer.rims} material="paintGrey" />
        </Part>
        <Part id="plough" name="Mouldboard plough" role="static" material="paintRed" info={{ summary: '3-furrow mouldboard plough.', role: 'Can stay outdoors if cleaned and greased, especially the threaded adjusters.' }} beyondNotes position={[bayX('plough'), 0.2, zBack + 0.3 + MACHINES.plough.l / 2]} rotation={[0, PI / 2, 0]}>
          <PartMesh geometry={g.plough.frame} />
          <PartMesh geometry={g.plough.bodies} material="steel" />
        </Part>
        <Part id="harrow" name="Disc harrow" role="static" material="paintYellow" info={{ summary: 'Disc harrow.', role: 'Cleaned and greased; a fenced compound is enough.' }} beyondNotes position={[bayX('harrow'), 0.2, zBack + 0.3 + MACHINES.harrow.l / 2]} rotation={[0, PI / 2, 0]}>
          <PartMesh geometry={g.harrow.frame} />
          <PartMesh geometry={g.harrow.discs} material="steel" />
        </Part>
      </Part>

      <group ref={tractor}>
        <Tractor pose={pose} labels={false} linkage={false} internals={false} />
      </group>

      <Part id="fuel-store" name="Fuel store" role="housing" material="concrete" info={{ summary: 'Separate hazardous-materials store.', role: 'Above 3 L thinner, 10 L petrol, 20 L kerosene or 50 L diesel: a separate building at least 15 m from any other. Vents high and low, lockable, vermin-proof, warning sign, no floor drain — the floor, lower walls and door sill form a spill bund.' }} cites={[C.ln('p26–27')]} position={[D.fuelX, 0, fuelZ]}>
        <PartMesh geometry={g.fFloor} receiveShadow />
        <PartMesh geometry={g.fWalls} position={[0, 0.15, 0]} castShadow />
        <Part id="bund" name="Spill bund (door sill)" role="housing" material="concrete" info={{ summary: 'Door sill / bund.', role: 'With the concrete floor and lower walls it contains a spill; there is no floor drain.' }} cites={[C.ln('p27')]}>
          <PartMesh geometry={g.bund} />
        </Part>
        <Part id="drums" name="Fuel drums" role="static" material="paintBlue" info={{ summary: '200 L drums.', role: 'Flammables and poisons in separate rooms, each type on its own shelf.' }} cites={[C.ln('p27')]}>
          <PartMesh geometry={g.drums} />
        </Part>
        <Part id="fuel-roof" name="Fuel store roof" role="housing" material="galvanised" info={{ summary: 'Roof.' }} explode={[0, 2, 0]}>
          <PartMesh geometry={g.fRoof} position={[0, 2.55, 0]} rotation={[0, PI / 2, 0]} />
        </Part>
        <PartMesh geometry={g.sign} material="paintYellow" />
        <Part id="separation" name="15 m separation" role="static" info={{ summary: '15 m separation radius.', role: 'No other building inside this ring.' }} cites={[C.ln('p27')]} cut={false}>
          <PartMesh geometry={g.ring} position={[0, 0.06, 0]} customMaterial={tint(D.fuelOk ? 'ms-ring-ok' : 'ms-ring-bad', fuelOkColor, 1, 0.4)} />
        </Part>
      </Part>

      <PartLabel partId="workshop" at={[wsCx, H + 1.6, zFront]} />
      <PartLabel partId="shed" at={[ws.x1 + 3, H + 1.6, zFront]} />
      <PartLabel partId="bench" at={[benchX, 1.6, benchZ]} />
      <PartLabel partId="lifting" at={[wsCx, H - 0.2, 0]} />
      <PartLabel partId="fire-kit" at={[ws.x1 - 1.4, 1.2, zFront - 0.5]} />
      <PartLabel partId="posts" at={[D.bays[1].x1, H * 0.6, zFront]} />
      <PartLabel partId="fuel-store" at={[D.fuelX, 3.4, 0]} />
      <PartLabel partId="separation" at={[D.fuelX - HAZARD_SEPARATION - 1.5, 0.6, 0]} />
      <PartLabel partId="drive" at={[D.length / 2 + 4, 0.5, driveZ]} />
      <PartLabel partId="turning" at={[-st.turnR, 0.5, padZ]} />
      <PartLabel partId="parking" at={[parkX, 0.5, driveZ + st.driveW / 2 + D.stall.l / 2]} />
    </group>
  )
}
