import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, lathe, merge, mat4, xform } from '@/geometry'
import { sprocket } from '@/geometry/parts'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { PROFILES, stampRun } from '@/render/soil'
import { createTractorPose } from '@/tractor/Tractor'
import { FieldGround, FieldRun, makeSoil } from '../_shared/field'
import { bar, plateXY, rod } from '../_shared/geom'
import { landWheel, pathRod, shovel, steelWheel } from '../_tillage/parts'
import { Particles } from '../_tillage/three'
import { C, H, RAISED, live, plantOf, usePlant, type Kind } from './model'

const cites = {
  drill: [C.am('§13 seed drill parts; §13.4 size'), C.guide('2018-2019', 'drill vs planter')],
  planter: [C.am('§13 planter: seed plate, Fig 13.8')],
  jab: [C.am('§13 jab planter')],
}

const SEED = '#e8c25a'
const FERT = '#e6efe9'
/** x of the boots (seed placement) and the coverers in the hitch frame */
const BOOT_X = -0.85
const COVER_X = -1.2

interface Drop {
  pts: THREE.Vector3[]
  n: number
}

function useDrillGeo(kind: Kind, rows: number, spacing: number, D: number) {
  return useMemo(() => {
    const W = rows * spacing
    const Wb = W + 0.25
    const fert = kind === 'fert'
    const bx = -0.6
    const zs = Array.from({ length: rows }, (_, i) => -W / 2 + spacing / 2 + i * spacing)
    const boxG = plateXY([[bx - 0.22, 0.25], [bx + 0.22, 0.25], [bx + 0.32, 0.75], [bx - 0.32, 0.75]], Wb)
    const partition = fert ? plateXY([[bx - 0.005, 0.3], [bx + 0.005, 0.3], [bx + 0.005, 0.74], [bx - 0.005, 0.74]], Wb - 0.02) : null
    const lid = plateXY([[bx - 0.34, 0.75], [bx + 0.34, 0.75], [bx + 0.34, 0.78], [bx - 0.34, 0.78]], Wb + 0.02)
    const frame = merge(
      bar([0, 0, -0.45], [0, 0, 0.45], 0.05, 0.05),
      plateXY([[-0.06, -0.03], [0.05, -0.03], [0.02, 0.66], [-0.04, 0.66]], 0.016, 0.1),
      plateXY([[-0.06, -0.03], [0.05, -0.03], [0.02, 0.66], [-0.04, 0.66]], 0.016, -0.1),
      bar([0, 0.6, 0], [bx, 0.25, 0], 0.05, 0.05),
      bar([-0.2, 0.05, -Wb / 2], [-0.2, 0.05, Wb / 2], 0.07, 0.07),
      bar([0, 0, 0.3], [-0.2, 0.05, 0.3], 0.05, 0.05),
      bar([0, 0, -0.3], [-0.2, 0.05, -0.3], 0.05, 0.05),
      bar([-0.2, 0.05, -Wb / 2], [bx, 0.25, -Wb / 2], 0.05, 0.05),
      bar([-0.2, 0.05, Wb / 2], [bx, 0.25, Wb / 2], 0.05, 0.05),
    )
    const roller = xform(cylinder(0.03, 0.05, 16), mat4.rx(Math.PI / 2))
    const flutes: THREE.BufferGeometry[] = []
    for (let k = 0; k < 8; k++) {
      const f = box(0.012, 0.012, 0.05)
      f.translate(0.03 * Math.cos((k * Math.PI) / 4), 0.03 * Math.sin((k * Math.PI) / 4), 0)
      flutes.push(f)
    }
    const fluted = merge(roller, ...flutes)
    const rollers = merge(...zs.map((z) => xform(fluted, mat4.t(0, 0, z))), rod([0, 0, -Wb / 2], [0, 0, Wb / 2], 0.01, 8))
    const paddle = box(0.08, 0.01, 0.02)
    const agitator = merge(rod([0, 0, -Wb / 2 + 0.02], [0, 0, Wb / 2 - 0.02], 0.008, 8), ...zs.map((z, i) => xform(paddle, mat4.c(mat4.t(0, 0, z), mat4.rz(i)))))
    const tubes: THREE.BufferGeometry[] = []
    const openers: THREE.BufferGeometry[] = []
    const curves: THREE.CatmullRomCurve3[] = []
    const fcurves: THREE.CatmullRomCurve3[] = []
    for (const z of zs) {
      const p = [new THREE.Vector3(bx, 0.2, z), new THREE.Vector3(bx - 0.08, -0.1, z), new THREE.Vector3(BOOT_X + 0.02, -H + 0.12, z), new THREE.Vector3(BOOT_X, -H + 0.03, z)]
      curves.push(new THREE.CatmullRomCurve3(p))
      if (fert) fcurves.push(new THREE.CatmullRomCurve3(p.map((v, i) => v.clone().add(new THREE.Vector3(i ? 0.03 : 0.1, 0, 0.025)))))
      tubes.push(pathRod(p.map((v) => [v.x, v.y, v.z] as [number, number, number]), 0.014, 16, 8))
      openers.push(bar([-0.2, 0.05, z], [BOOT_X + 0.08, -H + 0.08, z], 0.02, 0.04), xform(shovel(0.04, 0.12), mat4.t(BOOT_X + 0.06, -H, z)))
    }
    const coverer = merge(...zs.map((z) => merge(rod([BOOT_X, -H + 0.25, z], [COVER_X, -H + 0.03, z], 0.006, 6), xform(box(0.08, 0.02, 0.06), mat4.t(COVER_X, -H + 0.03, z)))))
    const R = D / 2
    const wz = Wb / 2 + 0.12
    const wheel = steelWheel(R, 0.08, 8, 12)
    const sp1 = sprocket(18, 0.0127, 0.0079, 0.008)
    const sp2 = sprocket(12, 0.0127, 0.0079, 0.008)
    return { W, Wb, zs, boxG, lid, partition, frame, rollers, agitator, tubes: merge(...tubes), openers: merge(...openers), coverer, curves, fcurves, wheel, sp1, sp2, R, wz, bx }
  }, [kind, rows, spacing, D])
}

function DrillUnit({ spin }: { spin: React.MutableRefObject<{ roller: THREE.Group | null; wheel: THREE.Group | null; agit: THREE.Group | null }> }) {
  const st = usePlant()
  const G = useDrillGeo(st.kind, st.rows, st.spacing, st.D)
  const fert = st.kind === 'fert'
  const wy = -H + st.depth + G.R
  return (
    <Part id="drill" name={fert ? 'Seed-cum-fertilizer drill' : 'Seed drill'} material="paintGreen" info={{ summary: fert ? 'Seed-cum-fertilizer drill.' : 'Grain (seed) drill.', role: fert ? 'Drills seed and fertilizer together from a split box; the fertilizer is placed 2–3 cm away from the seed so it does not burn it.' : 'Meters seed continuously from a box and places it in narrow rows through furrow openers, then covers it. Size is openers × spacing, e.g. 5 × 150 mm.' }} cites={cites.drill}>
      <Part id="frame" name="Frame & headstock" info={{ summary: 'Frame.', role: 'Carries the box, openers and drive.' }}>
        <PartMesh geometry={G.frame} />
      </Part>
      <Part id="seed-box" name={fert ? 'Seed / fertilizer box (split)' : 'Seed box'} role="housing" material="paintGreen" info={{ summary: fert ? 'Split box: seed and fertilizer compartments.' : 'Seed box (hopper).', role: 'Holds the seed over the metering rollers; the lid keeps rain out.' }} cites={cites.drill}>
        <PartMesh geometry={G.boxG} />
        <PartMesh geometry={G.lid} material="paintYellow" />
        {G.partition ? <PartMesh geometry={G.partition} material="paintGrey" /> : null}
      </Part>
      <Part id="agitator" name="Agitator" role="moving" material="steel" info={{ summary: 'Agitator.', role: 'Turns in the box to keep the seed flowing down to the metering rollers without bridging.' }} cites={cites.drill}>
        <group position={[G.bx, 0.4, 0]} ref={(el) => void (spin.current.agit = el)}>
          <PartMesh geometry={G.agitator} />
        </group>
      </Part>
      <Part id="metering" name="Fluted-roller metering" role="moving" material="brass" info={{ summary: 'Fluted rollers on the metering shaft.', role: 'Each roller carries seed out of the box in its flutes. The rate is set by sliding the rollers to expose more or less flute length (rate chart on the shaft) and by the drive ratio.' }} cites={cites.drill}>
        <group position={[G.bx, 0.23, 0]} ref={(el) => void (spin.current.roller = el)}>
          <PartMesh geometry={G.rollers} />
        </group>
      </Part>
      <Part id="tubes" name="Seed tubes" role="static" material="plastic" info={{ summary: 'Seed tubes and boots.', role: 'Lead the metered seed down to the boots behind the openers.' }} cites={cites.drill} cut={false}>
        <PartMesh geometry={G.tubes} />
        {G.curves.map((c, i) => (
          <Flow key={i} curve={c} count={8} radius={0.008} color={SEED} intensity={() => live.lowered} speed={1.2} spread={0.004} />
        ))}
        {G.fcurves.map((c, i) => (
          <Flow key={`f${i}`} curve={c} count={8} radius={0.006} color={FERT} intensity={() => live.lowered} speed={1.2} spread={0.004} />
        ))}
      </Part>
      <Part id="openers" name="Furrow openers" material="forged" info={{ summary: 'Furrow openers (hoe type).', role: 'Open a narrow slot at the set depth (depth-regulating lever) for the seed.' }} cites={cites.drill}>
        <PartMesh geometry={G.openers} />
      </Part>
      <Part id="coverers" name="Covering device" material="steelDark" info={{ summary: 'Coverers (drag chains / tines).', role: 'Close the slot over the seed.' }} cites={cites.drill}>
        <PartMesh geometry={G.coverer} />
      </Part>
      <Part id="ground-wheel" name="Ground wheel & chain drive" role="moving" material="steel" info={{ summary: 'Ground (drive) wheel with chain and sprockets.', role: 'Drives the metering and agitator shafts from the ground, so the seed rate per hectare stays the same whatever the speed. Calibration counts its revolutions: N = L/(πD).' }} cites={[C.am('§13 ground-wheel drive; calibration')]}>
        <group position={[-0.95, wy, G.wz]} ref={(el) => void (spin.current.wheel = el)}>
          <PartMesh geometry={G.wheel} />
          <PartMesh geometry={G.sp1} position={[0, 0, -0.06]} />
        </group>
        <PartMesh geometry={G.sp2} position={[G.bx, 0.23, G.wz - 0.06]} />
        <PartMesh geometry={bar([-0.95, wy + 0.045, G.wz - 0.06], [G.bx, 0.26, G.wz - 0.06], 0.008, 0.008)} material="steelDark" />
        <PartMesh geometry={bar([-0.95, wy - 0.045, G.wz - 0.06], [G.bx, 0.2, G.wz - 0.06], 0.008, 0.008)} material="steelDark" />
        <PartMesh geometry={bar([-0.6, 0.05, G.Wb / 2], [-0.95, wy, G.wz], 0.04, 0.04)} material="paintGreen" />
      </Part>
    </Part>
  )
}

function usePlanterGeo(rows: number, sp: number, cells: number, D: number) {
  return useMemo(() => {
    const W = rows * sp
    const zs = Array.from({ length: rows }, (_, i) => -W / 2 + sp / 2 + i * sp)
    const hopper = lathe([[0.06, 0], [0.16, 0.2], [0.16, 0.42], [0.145, 0.42], [0.145, 0.21], [0.05, 0.015]], 32)
    const ring = lathe([[0.03, 0], [0.1, 0], [0.1, 0.012], [0.03, 0.012]], 40)
    const notch = box(0.02, 0.014, 0.014)
    const plate = merge(ring, ...Array.from({ length: cells }, (_, k) => xform(notch, mat4.c(mat4.ry((k * 2 * Math.PI) / cells), mat4.t(0.1, 0.006, 0)))))
    const opener = plateXY([[0.1, 0.1], [-0.15, 0.1], [-0.2, -0.0], [0.0, 0.0]], 0.02)
    const press = landWheel(0.15, 0.08, 'smooth')
    const frame = merge(
      bar([0, 0, -0.45], [0, 0, 0.45], 0.05, 0.05),
      plateXY([[-0.06, -0.03], [0.05, -0.03], [0.02, 0.66], [-0.04, 0.66]], 0.016, 0.1),
      plateXY([[-0.06, -0.03], [0.05, -0.03], [0.02, 0.66], [-0.04, 0.66]], 0.016, -0.1),
      bar([-0.15, 0.05, -W / 2], [-0.15, 0.05, W / 2], 0.1, 0.1),
      bar([0, 0.6, 0], [-0.15, 0.05, 0], 0.05, 0.05),
      ...zs.map((z) => merge(bar([-0.15, 0.05, z + 0.08], [-0.75, -0.1, z + 0.08], 0.03, 0.05), bar([-0.15, 0.05, z - 0.08], [-0.75, -0.1, z - 0.08], 0.03, 0.05))),
    )
    const tube = (z: number) => new THREE.CatmullRomCurve3([new THREE.Vector3(-0.5, 0.0, z + 0.1), new THREE.Vector3(-0.52, -0.25, z), new THREE.Vector3(-0.56, -H + 0.03, z)])
    const curves = zs.map(tube)
    const tubes = merge(...curves.map((c) => pathRod(c.points.map((p) => [p.x, p.y, p.z] as [number, number, number]), 0.014, 12, 8)))
    const drive = steelWheel(D / 2, 0.1, 8, 10)
    return { W, zs, hopper, plate, opener, press, frame, curves, tubes, drive }
  }, [rows, sp, cells, D])
}

function PlanterUnit({ spin }: { spin: React.MutableRefObject<{ plates: (THREE.Group | null)[]; press: (THREE.Group | null)[]; wheel: THREE.Group | null }> }) {
  const st = usePlant()
  const G = usePlanterGeo(st.pRows, st.pSpacing, st.cells, st.pD)
  return (
    <Part id="planter" name="Row-crop planter" material="paintRed" info={{ summary: 'Row-crop (precision) planter.', role: 'Places single seeds at a set spacing along wide rows: a cell plate turning in each hopper picks one seed per cell and drops it down the seed tube.' }} cites={cites.planter}>
      <Part id="frame" name="Toolbar & headstock" info={{ summary: 'Toolbar.', role: 'Carries the planter units at the row spacing.' }}>
        <PartMesh geometry={G.frame} />
      </Part>
      {G.zs.map((z, i) => (
        <group key={i}>
          <Part id={`hopper-${i}`} name="Hopper" role="housing" material="paintRed" info={{ summary: 'Seed hopper.', role: 'Holds the seed above the cell plate.' }} cites={cites.planter}>
            <PartMesh geometry={G.hopper} position={[-0.45, -0.02, z + 0.1]} />
          </Part>
          <Part id={`plate-${i}`} name="Seed (cell) plate" role="moving" material="nylon" info={{ summary: 'Rotating cell (pocket) seed plate.', role: 'Turns in the hopper bottom, driven from the wheel through sprockets and a bevel pair. Each cell holds one seed and drops it over the seed tube: spacing = πD/(ratio × cells).' }} cites={cites.planter}>
            <group position={[-0.45, 0.0, z + 0.1]} ref={(el) => void (spin.current.plates[i] = el)}>
              <PartMesh geometry={G.plate} />
            </group>
          </Part>
          <Part id={`opener-${i}`} name="Runner opener" material="forged" info={{ summary: 'Runner-type furrow opener with boot.', role: 'Opens the seed furrow at the set depth.' }} cites={cites.planter}>
            <PartMesh geometry={G.opener} position={[-0.5, -H, z]} />
          </Part>
          <Part id={`press-${i}`} name="Press wheel" role="moving" material="rubber" info={{ summary: 'Press (covering) wheel.', role: 'Closes and firms the soil over the seed for good seed–soil contact.' }} cites={cites.planter}>
            <group position={[-0.95, -H + st.depth + 0.15, z]} ref={(el) => void (spin.current.press[i] = el)}>
              <PartMesh geometry={G.press.tyre} />
              <PartMesh geometry={G.press.rim} material="paintGrey" />
            </group>
          </Part>
        </group>
      ))}
      <Part id="tubes" name="Seed tubes" material="plastic" info={{ summary: 'Seed tubes.', role: 'Drop each seed from the plate to the bottom of the furrow.' }} cut={false}>
        <PartMesh geometry={G.tubes} />
        {G.curves.map((c, i) => (
          <Flow key={i} curve={c} count={4} radius={0.009} color={SEED} intensity={() => live.lowered} speed={1.5} spread={0.002} />
        ))}
      </Part>
      <Part id="drive-wheel" name="Drive wheel" role="moving" material="steel" info={{ summary: 'Drive wheel.', role: 'Turns the seed plates through the chain, sprockets and bevel gears, so spacing does not depend on speed.' }} cites={cites.planter}>
        <group position={[-0.7, -H + st.depth + st.pD / 2, G.W / 2 + 0.1]} ref={(el) => void (spin.current.wheel = el)}>
          <PartMesh geometry={G.drive} />
        </group>
      </Part>
    </Part>
  )
}

/** Jab planter: hand tool, close up, cycling into the ground. */
function JabPlanter() {
  const grp = useRef<THREE.Group>(null)
  const jawL = useRef<THREE.Group>(null)
  const jawR = useRef<THREE.Group>(null)
  const seed = useRef<THREE.Mesh>(null)
  const t = useRef(0)
  const G = useMemo(
    () => ({
      handles: merge(rod([0, 0.15, 0.03], [0, 1.0, 0.06], 0.012), rod([0, 0.15, -0.03], [0, 1.0, -0.06], 0.012), rod([0, 1.0, 0.1], [0, 1.0, -0.1], 0.012)),
      can: lathe([[0, 0], [0.05, 0], [0.06, 0.12], [0, 0.12]], 20),
      jaw: plateXY([[0, 0], [0.025, 0], [0.005, -0.15], [0, -0.15]], 0.05),
      seed: new THREE.SphereGeometry(0.008, 10, 8),
    }),
    [],
  )
  useSimFrame((dt) => {
    t.current = (t.current + dt / 2.5) % 1
    const s = t.current
    const down = s < 0.3 ? s / 0.3 : s < 0.6 ? 1 : 1 - (s - 0.6) / 0.4
    if (grp.current) grp.current.position.y = 0.12 - 0.17 * Math.min(1, down)
    const open = s > 0.32 && s < 0.6 ? 0.3 : 0
    jawL.current?.rotation.set(0, 0, open)
    jawR.current?.rotation.set(0, 0, -open)
    if (seed.current) seed.current.position.y = s < 0.32 ? 0.05 : s < 0.6 ? 0.05 - ((s - 0.32) / 0.28) * 0.2 : -0.15
  })
  return (
    <Part id="jab" name="Jab planter" material="paintYellow" info={{ summary: 'Jab (hand) planter.', role: 'Pushed into the ground by hand: the jaws are held closed by gravity and opened by ground pressure as the tool is jabbed in, dropping the seed; single or rotary types.' }} cites={cites.jab}>
      <group ref={grp}>
        <PartMesh geometry={G.handles} material="wood" />
        <PartMesh geometry={G.can} position={[0.06, 0.3, 0]} />
        <Part id="jaws" name="Jaws" role="moving" material="steel" info={{ summary: 'Jaws.', role: 'Closed by gravity; ground pressure opens them to release the seed.' }} cites={cites.jab}>
          <group ref={jawL} position={[0.0, 0.15, 0]}>
            <PartMesh geometry={G.jaw} />
          </group>
          <group ref={jawR} position={[0.0, 0.15, 0]} scale={[-1, 1, 1]}>
            <PartMesh geometry={G.jaw} />
          </group>
        </Part>
        <mesh ref={seed} geometry={G.seed} position={[0, 0.05, 0]}>
          <meshStandardMaterial color={SEED} />
        </mesh>
      </group>
    </Part>
  )
}

const FIELD = { length: 18, width: 4, cell: 0.04 }

export function Scene3D() {
  const st = usePlant()
  const grid = useMemo(() => makeSoil(FIELD), [])
  const pose = useMemo(() => createTractorPose({ hitchHeight: RAISED }), [])
  const dspin = useRef({ roller: null as THREE.Group | null, wheel: null as THREE.Group | null, agit: null as THREE.Group | null })
  const pspin = useRef({ plates: [] as (THREE.Group | null)[], press: [] as (THREE.Group | null)[], wheel: null as THREE.Group | null })
  const prev = useRef<number | null>(null)
  const drops = useMemo<Drop>(() => ({ pts: Array.from({ length: 900 }, () => new THREE.Vector3()), n: 0 }), [])
  const next = useRef(0)
  const bed = useMemo(() => box(1.2, 0.3, 0.8), [])
  if (st.kind === 'jab')
    return (
      <group>
        <Part id="field" name="Field soil" role="static" material="soil" info={{ summary: 'Seedbed.', role: 'Prepared soil the seed is placed into.' }} cites={[C.bush('p4–7')]}>
          <PartMesh geometry={bed} position={[0, -0.15, 0]} />
        </Part>
        <JabPlanter />
        <PartLabel partId="jaws" at={[0.15, 0.1, 0.1]} />
      </group>
    )
  const planter = st.kind === 'planter'
  return (
    <group>
      <Part id="field" name="Field soil" role="static" material="soil" info={{ summary: 'Seedbed.', role: 'Openers cut slots, seed drops in, coverers close them.' }} cites={[C.bush('p4–7')]} cut>
        <FieldGround grid={grid} />
      </Part>
      <FieldRun
        key={st.kind}
        grid={grid}
        pose={pose}
        start={-3}
        end={7.5}
        speed={() => usePlant.getState().speed / 3.6}
        hitchWork={() => H - usePlant.getState().depth}
        hitchRaised={RAISED}
        onReset={() => {
          prev.current = null
          drops.n = 0
          live.revs = 0
          live.dist = 0
        }}
        onStep={(c) => {
          const p = usePlant.getState()
          const r = plantOf(p)
          live.lowered = c.lowered > 0.9 ? 1 : 0
          const on = c.lowered > 0.9 ? 1 : 0
          if (planter) {
            const a = (c.dx * on) / (p.pD / 2)
            if (pspin.current.wheel) pspin.current.wheel.rotation.z -= c.dx / (p.pD / 2)
            for (const g of pspin.current.plates) if (g) g.rotation.y -= a * p.ratio
            for (const g of pspin.current.press) if (g) g.rotation.z -= c.dx / 0.15
          } else {
            const a = c.dx / (p.D / 2)
            if (dspin.current.wheel) dspin.current.wheel.rotation.z -= a
            if (dspin.current.roller) dspin.current.roller.rotation.z -= a * on * 1.5
            if (dspin.current.agit) dspin.current.agit.rotation.z -= a * on * 1.5
          }
          if (!on || c.dx <= 0) {
            prev.current = null
            return
          }
          live.dist += c.dx
          live.revs += c.dx / (Math.PI * (planter ? p.pD : p.D))
          const zs = planter ? Array.from({ length: p.pRows }, (_, i) => -r.W / 2 + p.pSpacing / 2 + i * p.pSpacing) : Array.from({ length: p.rows }, (_, i) => -r.W / 2 + p.spacing / 2 + i * p.spacing)
          const xb = c.hitchX + (planter ? -0.56 : BOOT_X)
          const xc = c.hitchX + (planter ? -0.95 : COVER_X)
          if (prev.current === null) next.current = xb
          const x0 = prev.current ?? xb
          if (prev.current !== null && xb - x0 < grid.cell) return
          prev.current = xb
          for (const z of zs) {
            stampRun(grid, x0, xb, z, 0.05, PROFILES.slot(p.depth, 0.04), { blend: 1 })
            stampRun(grid, x0 - (xb - xc), xc, z, 0.06, () => -0.004, { blend: 0.9, disturb: 0.8 })
          }
          // seeds left in the open slots between boot and coverer
          const gap = planter ? r.seedGap : 0.05
          while (next.current < xb) {
            for (const z of zs) {
              const v = drops.pts[drops.n % drops.pts.length]
              v.set(next.current, -p.depth + 0.008, z + (planter ? 0 : (Math.random() - 0.5) * 0.01))
              drops.n++
            }
            next.current += gap
          }
          if (next.current > xb + 1) next.current = xb
        }}
        mounted={planter ? <PlanterUnit spin={pspin} /> : <DrillUnit spin={dspin} />}
      />
      <Particles
        max={900}
        radius={0.007}
        color={SEED}
        update={(_, set) => {
          const n = Math.min(drops.n, drops.pts.length)
          for (let i = 0; i < n; i++) {
            const p = drops.pts[i]
            set(i, p.x, p.y, p.z)
          }
          return n
        }}
      />
    </group>
  )
}
