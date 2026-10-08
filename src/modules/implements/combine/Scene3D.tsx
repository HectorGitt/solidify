import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box } from '@/geometry'
import { InstancedPartMesh } from '@/modules/traction/tracks/InstancedPartMesh'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { C, D, RATED_FEED, TANK_T, WALKER_PHASE, live, machineState, useCombine } from './model'
import {
  axlesGeometry,
  beaterGeometry,
  bodyGeometry,
  cabFrameGeometry,
  cabGlassGeometry,
  concaveGeometry,
  crossAugerGeometry,
  cutterBarGeometry,
  cylinderGeometry,
  earGeometry,
  elevatorsGeometry,
  engineGeometry,
  fanHousingGeometry,
  fanRotorGeometry,
  feederHousingGeometry,
  feederPath,
  feederSprocketsGeometry,
  headerAugerGeometry,
  headerGeometry,
  knifeGeometry,
  pansGeometry,
  reelArmsGeometry,
  reelBatGeometry,
  reelSpiderGeometry,
  sieveGeometry,
  slatGeometry,
  stalkGeometry,
  strawChopperGeometry,
  tankAugerGeometry,
  tankGeometry,
  troughGeometry,
  unloadGeometry,
  walkerBase,
  walkerCrankGeometry,
  walkerGeometry,
  walkerWidth,
  wheel,
} from './parts'

const { PI } = Math
const ZC = -0.08
const BEYOND = 'Dimensions are typical of a medium combine with a 6 m header.'
/** grain-tank time-lapse while filling (one sim second shows a minute of harvesting) */
export const FILL_LAPSE = 60
const UNLOAD_RATE = 0.7

const v3 = (x: number, y: number, z = ZC) => new THREE.Vector3(x, y, z)
const curve = (pts: THREE.Vector3[], t = 0.4) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', t)

/* crop field: instanced stalks scrolled past the stationary machine */
const ROW = 0.25
const ROWS = Math.round(D.header.width / ROW) + 1
const STEP = 0.3
const XMIN = D.header.cutterX - 9
const SPAN = 18
const ALONG = Math.round(SPAN / STEP)
const NSTALK = ROWS * ALONG
const STALK_H = 0.9
const STUBBLE_H = 0.16

const INFO = {
  combine: {
    summary: 'Self-propelled combined harvester-thresher ("combine") cut away along its centre line.',
    role: 'Cuts, threshes, separates and cleans the crop in one pass, then stores the clean grain in a tank. It combines four units: cutting and conveying, threshing, cleaning and separating, and grain delivery.',
    details: 'The output of each unit must match the input of the next — a unit that is overloaded chokes and stops the whole flow. ' + BEYOND,
  },
  header: {
    summary: 'Header (cutting platform), 6 m.',
    role: 'Cuts the standing crop and conveys it to the feeder. The size of a combine is given by the width of its cutter bar — this one has a 6 m header.',
  },
  reel: {
    summary: 'Pick-up reel with tines.',
    role: 'Holds the standing crop against the knife as it is cut and lays the cut crop back onto the platform. Its tip speed is set a little faster than the forward speed (reel index ≈ 1.25).',
    details: 'The reel index and the tine eccentric that keeps the tines vertical are standard practice.',
  },
  cutterBar: {
    summary: 'Cutter bar: fixed guards (fingers) and ledger plates.',
    role: 'Cuts the crop like a mower cutter bar — the knife sections shear the stems against the ledger plates in the guards.',
  },
  knife: {
    summary: 'Reciprocating knife (sickle) sections, 76 mm pitch.',
    role: 'Driven to and fro across the guards. Too high a cutter-bar speed, or crop that is too dry, causes heavy shattering losses at the header.',
  },
  headerAuger: {
    summary: 'Header (table) auger with opposite-hand flights and retractable fingers.',
    role: 'The spiral conveyor: its flights push the cut crop in from both ends to the centre, where the fingers feed it into the feeder throat. A belt conveyor can be used instead.',
  },
  feeder: {
    summary: 'Feeder house (crop elevator).',
    role: 'Carries the crop up from the header to the threshing cylinder, ear-head first, with a chain-and-slat conveyor that drags it along the floor.',
  },
  feederChain: { summary: 'Chain-and-slat elevator.', role: 'Slats on roller chains run up the floor of the feeder house and deliver an even mat of crop to the cylinder.' },
  cylinder: {
    summary: 'Threshing cylinder (rasp-bar type), Ø0.6 m.',
    role: 'Beats and rubs the crop against the concave to detach the grain. A rubbing cylinder with ribbed bars is a rasp-bar cylinder; one with pegs is a spike-tooth cylinder.',
    details: 'Cylinder speed must be right: too high cracks grain, too low leaves unthreshed heads.',
  },
  concave: {
    summary: 'Concave (slotted grate) under the cylinder.',
    role: 'The stationary plate the cylinder threshes against. Its slots let the threshed grain and chaff fall through; the long straw passes on to the walkers. The cylinder–concave clearance is adjustable.',
    details: 'Too small a clearance raises the power needed and cracks grain; too large leaves heads unthreshed.',
  },
  beater: { summary: 'Beater (straw deflector).', role: 'Strips the straw off the cylinder and throws it rearward onto the straw walkers.' },
  walkers: {
    summary: 'Straw walkers (4), on two crankshafts.',
    role: 'Shaped so the straw passes over them and is discharged behind the machine, while the loose grain and unthreshed heads shake out through them and fall to the grain (return) pan.',
    details: 'Each walker moves in a circle on its cranks; neighbours are out of phase so the straw is tossed and carried rearward. Overloading the walkers carries grain out with the straw.',
  },
  cranks: { summary: 'Walker crankshafts.', role: 'Two cranked shafts give every point of a walker the same circular motion; the throws are set at different angles for each walker.' },
  shoe: {
    summary: 'Cleaning shoe: grain pan, return pan, chaffer (upper) and lower sieve.',
    role: 'The sieves reciprocate, which sorts grain from chaff and stops them choking. Air from the fan blows through the sieves, so the light chaff is blown out and the heavier grain falls through.',
  },
  chaffer: { summary: 'Chaffer (upper, adjustable-louvre sieve).', role: 'Passes grain and small pieces; carries the chaff and light straw to the rear in the air blast. Material too big to pass, but not chaff, drops off its end into the tailings auger.' },
  sieve: { summary: 'Lower (cleaning) sieve.', role: 'Finer sieve: clean grain falls through it to the clean-grain auger; what will not pass goes to the tailings.' },
  pans: { summary: 'Grain pan and return pan.', role: 'The common pans that collect grain falling through the concave and through the walkers, and shake it forward onto the front of the chaffer.' },
  fan: {
    summary: 'Cleaning fan.',
    role: 'Blows air through the sieves to carry out chaff and light straw. Excessive air blast blows out grain with the chaff; too little lets the sieves choke and leaves the grain unclean.',
  },
  cleanAuger: { summary: 'Clean-grain auger.', role: 'Collects the clean grain from under the lower sieve and carries it across to the clean-grain elevator.' },
  tailAuger: {
    summary: 'Tailings auger and return elevator.',
    role: 'Collects unthreshed heads (tailings) from the end of the sieves and returns them to the cylinder for a second threshing.',
    details: 'Clean grain goes to the tank; only the tailings go back to the cylinder.',
  },
  elevators: { summary: 'Clean-grain and tailings elevators.', role: 'Paddle-chain elevators on the right-hand side: one lifts clean grain to the tank, the other returns tailings to the cylinder.' },
  tank: { summary: 'Grain tank, about 7 m³ (≈ 5 t).', role: 'Stores the clean grain. A bagging platform can be fitted instead.' },
  grain: { summary: 'Clean grain in the tank.', role: 'Level shown on a ×60 time-lapse so you can watch it fill.' },
  tankAuger: { summary: 'Tank (cross) auger.', role: 'Moves grain along the tank floor to the unloading auger.' },
  unload: { summary: 'Unloading auger.', role: 'Swings out from its rest and discharges the tank into a trailer alongside, usually on the move.' },
  body: { summary: 'Separator body (side sheets and roof).', role: 'Encloses the threshing, separating and cleaning units and carries the tank, engine and cab.' },
  cab: { summary: 'Operator’s cab and platform.', role: 'Placed high at the front so the operator can watch the header and the crop.' },
  engine: { summary: 'Engine.', role: 'Diesel engine above the separator; drives the units by belts and the wheels through a hydrostatic or gear drive.' },
  chopper: { summary: 'Straw chopper / spreader.', role: 'Spreads (or windrows) the straw leaving the walkers.' },
  wheels: { summary: 'Front drive wheels and rear steering wheels.', role: 'Large front wheels carry the heavy front (header, cylinder, tank); the combine steers with its rear wheels.' },
  crop: { summary: 'Standing crop and stubble.', role: 'The crop moves past at the forward speed; behind the cutter bar only stubble is left.' },
}

const CITE = {
  unit: [C.am('§19.2, Fig 19.1')],
  path: [C.am('§19.2, Fig 19.3')],
  thresh: [C.am('§18.4 threshing components'), C.am('§19.2')],
  perf: [C.am('§18.5 thresher performance'), C.am('§19.3, Table 19.1')],
  size: [C.am('§19.4 combine size'), C.exam1920('combine with a 6 m header')],
}

export function Combine3D() {
  const clearance = useCombine((s) => s.clearance)
  const flows = useCombine((s) => s.flows)

  const g = useMemo(() => {
    const fw = wheel(D.front.r, D.front.w, 22, 'R1')
    const rw = wheel(D.rear.r, D.rear.w, 0, 'F2')
    return {
      header: headerGeometry(),
      cutter: cutterBarGeometry(),
      knife: knifeGeometry(),
      auger: headerAugerGeometry(),
      spider: reelSpiderGeometry(),
      bat: reelBatGeometry(),
      reelArms: reelArmsGeometry(),
      feeder: feederHousingGeometry(),
      sprockets: feederSprocketsGeometry(),
      slat: slatGeometry(),
      cylinder: cylinderGeometry(),
      beater: beaterGeometry(),
      walker: walkerGeometry(),
      crank: walkerCrankGeometry(),
      pans: pansGeometry(),
      chaffer: sieveGeometry(D.shoe.x0, D.shoe.x1, D.shoe.chafferY, 0.045, 0.45),
      sieve: sieveGeometry(D.shoe.x0 - 0.15, D.shoe.x1 + 0.25, D.shoe.sieveY, 0.03, 0.3),
      fan: fanRotorGeometry(),
      fanHousing: fanHousingGeometry(),
      cross: crossAugerGeometry(),
      cleanTrough: troughGeometry(D.cleanAuger.x, D.cleanAuger.y),
      tailTrough: troughGeometry(D.tailAuger.x, D.tailAuger.y),
      elevators: elevatorsGeometry(),
      tank: tankGeometry(),
      tankAuger: tankAugerGeometry(),
      unload: unloadGeometry(),
      body: bodyGeometry(),
      cab: cabFrameGeometry(),
      glass: cabGlassGeometry(),
      engine: engineGeometry(),
      chopper: strawChopperGeometry(),
      axles: axlesGeometry(),
      fw,
      rw,
      grainBox: box(1, 1, 1),
      ground: box(1, 1, 1),
      stalk: stalkGeometry(),
      ear: earGeometry(),
    }
  }, [])
  const concave = useMemo(() => concaveGeometry(clearance), [clearance])

  const feeder = useMemo(() => {
    const p = feederPath()
    const n = Math.max(6, Math.floor(p.length / 0.32))
    const centre = new THREE.Vector3((D.feeder.lo[0] + D.feeder.hi[0]) / 2, (D.feeder.lo[1] + D.feeder.hi[1]) / 2, 0)
    return { path: p.path, length: p.length, n, centre }
  }, [])

  /* ---------------- flow paths ---------------- */
  const paths = useMemo(() => {
    const H = D.header
    const Cy = D.cyl
    const sides = [2.5, 1.5, -1.5, -2.5].map((z0) => {
      const s = Math.sign(z0)
      return curve([v3(H.cutterX - 0.02, 0.26, z0), v3(4.25, 0.3, z0), v3(D.auger.x, 0.18, z0 * 0.85), v3(3.84, 0.24, z0 * 0.4), v3(3.72, 0.34, s * 0.32), v3(3.55, 0.44, s * 0.08)])
    })
    const centre = [0.35, -0.35].map((z0) => curve([v3(H.cutterX - 0.02, 0.26, z0), v3(4.1, 0.2, z0), v3(3.7, 0.36, z0 * 0.4), v3(3.55, 0.44, z0 * 0.2)]))
    const [lx, ly] = D.feeder.lo
    const [hx, hy] = D.feeder.hi
    const dir = new THREE.Vector2(hx - lx, hy - ly).normalize()
    const nrm = new THREE.Vector2(-dir.y, dir.x)
    const fd = (x: number, y: number) => v3(x - nrm.x * 0.13, y - nrm.y * 0.13)
    const feed = curve([v3(3.55, 0.44), fd(lx - 0.05, ly), fd((lx + hx) / 2, (ly + hy) / 2), fd(hx, hy), v3(Cy.x + 0.32, Cy.y - 0.12)])
    const arc: THREE.Vector3[] = []
    for (let i = 0; i <= 8; i++) {
      const a = (-15 - (i * 135) / 8) * (PI / 180)
      arc.push(v3(Cy.x + (Cy.r + 0.012) * Math.cos(a), Cy.y + (Cy.r + 0.012) * Math.sin(a)))
    }
    const walkerTop: THREE.Vector3[] = []
    for (let x = 1.0; x >= D.walkers.x1 - 0.05; x -= 0.6) walkerTop.push(v3(x, walkerBase(x) + 0.36))
    const strawPts = [...arc, v3(D.beater.x - 0.1, D.beater.y + D.beater.r + 0.08), ...walkerTop, v3(-3.35, 1.1), v3(-3.55, 0.45), v3(-3.75, 0.06)]
    const straw = curve(strawPts, 0.3)
    const grain = curve([v3(Cy.x, Cy.y - Cy.r - 0.07), v3(1.85, 1.01), v3(1.6, 0.99), v3(1.15, 0.95), v3(0.95, 0.9), v3(0.5, 0.88), v3(0.1, 0.85), v3(0.05, 0.71), v3(-0.1, 0.7), v3(0.12, 0.56), v3(D.cleanAuger.x, D.cleanAuger.y + 0.02)])
    const ez = -D.body.hw - 0.12
    const clean = curve([v3(D.cleanAuger.x, D.cleanAuger.y + 0.02), v3(D.cleanAuger.x, D.cleanAuger.y + 0.02, ez + 0.3), v3(D.cleanAuger.x, D.cleanAuger.y + 0.05, ez), v3(D.cleanAuger.x, 1.6, ez), v3(D.cleanAuger.x, D.tank.y1 - 0.1, ez), v3(D.cleanAuger.x + 0.4, D.tank.y1 + 0.02, ez + 0.4), v3(0.7, 2.75, -0.3), v3(0.75, 2.45, -0.1)], 0.2)
    const walkerGrain = curve([v3(-0.9, walkerBase(-0.9) + 0.2), v3(-0.9, 1.22), v3(-0.5, 1.15), v3(0.4, 1.07), v3(0.9, 1.03), v3(0.85, 0.92), v3(0.4, 0.89)])
    const air = curve([v3(D.fan.x - 0.2, D.fan.y - 0.05), v3(1.2, 0.72), v3(0.5, 0.97), v3(-0.4, 1.02), v3(-1.3, 1.05), v3(-2.2, 0.85), v3(-2.8, 0.35), v3(-3.0, 0.08)])
    const tail = curve([v3(D.shoe.x1 + 0.05, D.shoe.chafferY), v3(D.tailAuger.x, D.tailAuger.y + 0.04), v3(D.tailAuger.x, D.tailAuger.y + 0.04, ez + 0.3), v3(D.tailAuger.x, D.tailAuger.y + 0.06, ez), v3(Cy.x - 0.15, Cy.y + 0.42, ez), v3(Cy.x + 0.05, Cy.y + 0.38, -0.4), v3(Cy.x + 0.32, Cy.y - 0.05)], 0.2)
    const U = D.unload
    const unload = curve([v3(0.2, D.tank.y0 + 0.12, -0.3), v3(U.x, D.tank.y0 + 0.15, U.z + 0.1), v3(U.x, U.y, U.z), v3(U.x, U.y, U.z - U.L * 0.5), v3(U.x, U.y, U.z - U.L + 0.05), v3(U.x, U.y - 0.35, U.z - U.L + 0.05), v3(U.x, 1.0, U.z - U.L + 0.05)], 0.1)
    return { sides, centre, feed, straw, grain, clean, walkerGrain, air, tail, unload }
  }, [])

  /* ---------------- refs ---------------- */
  const reel = useRef<THREE.Group>(null)
  const bats = useRef<(THREE.Group | null)[]>([])
  const knife = useRef<THREE.Group>(null)
  const auger = useRef<THREE.Group>(null)
  const slats = useRef<THREE.InstancedMesh>(null)
  const cyl = useRef<THREE.Group>(null)
  const beater = useRef<THREE.Group>(null)
  const walkers = useRef<(THREE.Group | null)[]>([])
  const cranks = useRef<(THREE.Group | null)[]>([])
  const pans = useRef<THREE.Group>(null)
  const chaffer = useRef<THREE.Group>(null)
  const sieve = useRef<THREE.Group>(null)
  const fan = useRef<THREE.Group>(null)
  const cleanAuger = useRef<THREE.Group>(null)
  const tailAuger = useRef<THREE.Group>(null)
  const tankAuger = useRef<THREE.Group>(null)
  const grain = useRef<THREE.Mesh>(null)
  const unload = useRef<THREE.Group>(null)
  const chopper = useRef<THREE.Group>(null)
  const wheelsF = useRef<(THREE.Group | null)[]>([])
  const wheelsR = useRef<(THREE.Group | null)[]>([])
  const stalks = useRef<THREE.InstancedMesh>(null)
  const ears = useRef<THREE.InstancedMesh>(null)

  const angles = useRef({ reel: 0, cyl: 0, walk: 0, fan: 0, auger: 0, knife: 0, shoe: 0, feeder: 0, cross: 0 })
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), p: new THREE.Vector3(), q: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), m: new THREE.Matrix4(), z: new THREE.Vector3(0, 0, 1) }), [])
  const seeds = useMemo(() => Array.from({ length: NSTALK }, (_, i) => ({ x: (i % ALONG) * STEP + ((i * 7919) % 97) / 97 * 0.08, z: -D.header.width / 2 + Math.floor(i / ALONG) * ROW + (((i * 104729) % 89) / 89 - 0.5) * 0.06, h: 0.85 + ((i * 31) % 17) / 17 * 0.3 })), [])

  const intensity = useRef({ crop: 1, straw: 1, grain: 1, chaff: 1, tail: 0.3, lossStraw: 0, lossChaff: 0, unload: 0 })

  useSimFrame((dt) => {
    const st = useCombine.getState()
    const ms = machineState(st)
    const v = st.speed / 3.6
    const a = angles.current
    live.travel += v * dt
    // reel tip speed 1.25 × forward speed; bottom of the reel moving rearward
    a.reel -= ((live.reelIndex * Math.max(v, 0.3)) / D.reel.r) * dt
    a.cyl -= ((st.rpm * 2 * PI) / 60) * dt
    a.walk += ((200 * 2 * PI) / 60) * dt
    a.fan -= ((900 * 2 * PI) / 60) * dt
    a.auger -= ((160 * 2 * PI) / 60) * dt
    a.cross -= ((420 * 2 * PI) / 60) * dt
    a.knife += 2 * PI * 8 * dt
    a.shoe += 2 * PI * 5 * dt
    a.feeder += 2.2 * dt

    reel.current?.rotation.set(0, 0, a.reel)
    for (let k = 0; k < bats.current.length; k++) {
      const b = bats.current[k]
      if (!b) continue
      const ang = a.reel + (k / D.reel.bats) * 2 * PI
      b.position.set(D.reel.x + D.reel.r * Math.cos(ang), D.reel.y + D.reel.r * Math.sin(ang), 0)
    }
    knife.current?.position.set(0, 0, 0.038 * Math.sin(a.knife))
    auger.current?.rotation.set(0, 0, a.auger)
    cyl.current?.rotation.set(0, 0, a.cyl)
    beater.current?.rotation.set(0, 0, a.cyl * 0.9)
    for (let k = 0; k < D.walkers.n; k++) {
      const w = walkers.current[k]
      const ph = a.walk + WALKER_PHASE[k]
      w?.position.set(D.walkers.crankR * Math.cos(ph), D.walkers.crankR * Math.sin(ph), -D.cyl.halfWidth + walkerWidth * (k + 0.5))
    }
    for (const c of cranks.current) c?.rotation.set(0, 0, a.walk)
    const sx = D.shoe.stroke * Math.sin(a.shoe)
    pans.current?.position.set(sx, 0, 0)
    chaffer.current?.position.set(sx, 0, 0)
    sieve.current?.position.set(-sx, 0, 0)
    fan.current?.rotation.set(0, 0, a.fan)
    cleanAuger.current?.rotation.set(0, 0, a.cross)
    tailAuger.current?.rotation.set(0, 0, a.cross)
    chopper.current?.rotation.set(0, 0, a.fan * 2.5)
    for (const w of wheelsF.current) w?.rotation.set(0, 0, -live.travel / D.front.r)
    for (const w of wheelsR.current) w?.rotation.set(0, 0, -live.travel / D.rear.r)

    // feeder slats along the chain loop (bottom strand runs up towards the cylinder)
    if (slats.current) {
      const { p, q, t, n, m, z } = tmp
      for (let k = 0; k < feeder.n; k++) {
        let u = (k / feeder.n - a.feeder / feeder.length) % 1
        if (u < 0) u += 1
        feeder.path.getPointAt(u, p)
        feeder.path.getPointAt((u + 0.002) % 1, q)
        t.subVectors(q, p).normalize()
        n.set(-t.y, t.x, 0)
        if (n.dot(q.copy(p).sub(feeder.centre)) < 0) n.negate()
        m.makeBasis(t, n, z).setPosition(p.x, p.y, 0)
        slats.current.setMatrixAt(k, m)
      }
      slats.current.instanceMatrix.needsUpdate = true
    }

    // crop: standing ahead of the knife, stubble behind
    if (stalks.current && ears.current) {
      const o = tmp.o
      for (let i = 0; i < NSTALK; i++) {
        const s = seeds[i]
        let x = (s.x - live.travel) % SPAN
        if (x < 0) x += SPAN
        x += XMIN
        const standing = x > D.header.cutterX + 0.03
        const h = standing ? STALK_H * s.h : STUBBLE_H
        // stalks just ahead of the knife are leaned back by the reel
        const tilt = standing && x < D.header.cutterX + 0.5 ? 0.35 * (1 - (x - D.header.cutterX) / 0.5) : 0
        o.position.set(x, 0, s.z)
        o.rotation.set(0, 0, tilt)
        o.scale.set(1, h, 1)
        o.updateMatrix()
        stalks.current.setMatrixAt(i, o.matrix)
        if (standing) tmp.m.makeRotationZ(tilt).setPosition(x - Math.sin(tilt) * h, Math.cos(tilt) * h, s.z)
        else tmp.m.makeScale(0, 0, 0)
        ears.current.setMatrixAt(i, tmp.m)
      }
      stalks.current.instanceMatrix.needsUpdate = true
      ears.current.instanceMatrix.needsUpdate = true
    }

    // grain tank (time-lapse) and unloading
    live.tank = Math.min(TANK_T, live.tank + (ms.feed.grainRate * (1 - ms.loss.totalLoss / 100) * dt * FILL_LAPSE) / 3600)
    live.harvested += ms.feed.area * dt / 3600
    if (st.autoUnload && live.tank >= TANK_T * 0.98) live.unloading = true
    if (live.unloading) {
      live.swing = Math.min(1, live.swing + dt / 2)
      if (live.swing >= 1) live.tank = Math.max(0, live.tank - UNLOAD_RATE * dt)
      if (live.tank <= 0.05) live.unloading = false
    } else live.swing = Math.max(0, live.swing - dt / 2)
    unload.current?.rotation.set(0, (-PI / 2) * live.swing, 0)
    tankAuger.current?.rotation.set(live.unloading ? a.cross : 0, 0, 0)
    if (grain.current) {
      const T = D.tank
      const hmax = T.y1 - T.y0 - 0.12
      const hh = Math.max(0.005, (live.tank / TANK_T) * hmax)
      grain.current.scale.set(T.x1 - T.x0 - 0.06, hh, 2 * T.hw - 0.06)
      grain.current.position.set((T.x0 + T.x1) / 2, T.y0 + 0.02 + hh / 2, 0)
    }

    const load = ms.feed.totalRate / RATED_FEED
    const it = intensity.current
    it.crop = Math.min(1, Math.max(0.05, load))
    it.straw = it.crop
    it.grain = Math.min(1, ms.feed.grainRate / 12)
    it.chaff = Math.min(1, 0.25 + 0.6 * st.fan)
    it.tail = Math.min(1, 0.15 + ms.loss.unthreshed / 4)
    it.lossStraw = Math.min(1, (ms.loss.unthreshed + ms.loss.walker) / 5)
    it.lossChaff = Math.min(1, ms.loss.shoe / 4)
    it.unload = live.unloading && live.swing >= 1 ? 1 : 0
  })

  const T = D.tank
  const U = D.unload
  const [lx, ly] = D.feeder.lo
  const [hx, hy] = D.feeder.hi
  const it = intensity.current

  return (
    <group>
      <Part id="combine" name="Combine harvester" role="housing" material="paintGreen" info={INFO.combine} cites={[...CITE.unit, ...CITE.size]} beyondNotes>
        {/* ---------------- cutting and conveying unit ---------------- */}
        <Part id="header" name="Header (6 m)" role="housing" material="paintGreen" info={INFO.header} cites={CITE.size} explode={[1.2, 0, 0]}>
          <PartMesh geometry={g.header} />
          <Part id="cutter-bar" name="Cutter bar (guards)" role="static" material="steelDark" info={INFO.cutterBar} cites={[C.am('§19.2 — "like that of a mower"'), C.am('§16 mower cutter bar')]}>
            <PartMesh geometry={g.cutter} />
            <Part id="knife" name="Knife (sickle)" role="moving" material="steel" info={INFO.knife} cites={[C.am('§19.3')]}>
              <group ref={knife}>
                <PartMesh geometry={g.knife} />
              </group>
            </Part>
          </Part>
          <Part id="header-auger" name="Header auger" role="moving" material="paintYellow" info={INFO.headerAuger} cites={[C.am('§19.2, Fig 19.2')]}>
            <group ref={auger} position={[D.auger.x, D.auger.y, 0]}>
              <PartMesh geometry={g.auger} />
            </group>
          </Part>
          <Part id="reel" name="Pick-up reel" role="moving" material="paintYellow" info={INFO.reel} cites={[C.am('§19.2')]} beyondNotes explode={[0.3, 0.5, 0]}>
            <group ref={reel} position={[D.reel.x, D.reel.y, 0]}>
              <PartMesh geometry={g.spider} />
            </group>
            {Array.from({ length: D.reel.bats }, (_, k) => (
              <group key={k} ref={(el) => {
                bats.current[k] = el
              }}>
                <PartMesh geometry={g.bat} material="steel" />
              </group>
            ))}
            <Part id="reel-arms" name="Reel support arms" role="static" material="paintGreen">
              <PartMesh geometry={g.reelArms} />
            </Part>
          </Part>
        </Part>

        <Part id="feeder" name="Feeder house" role="housing" material="paintGreen" info={INFO.feeder} cites={CITE.path} explode={[0.6, -0.2, 0]}>
          <PartMesh geometry={g.feeder} />
          <Part id="feeder-chain" name="Chain-and-slat elevator" role="moving" material="steelDark" info={INFO.feederChain} cites={CITE.path}>
            <InstancedPartMesh ref={slats} geometry={g.slat} count={feeder.n} />
            <PartMesh geometry={g.sprockets} material="steel" />
          </Part>
        </Part>

        {/* ---------------- threshing unit ---------------- */}
        <Part id="threshing" name="Threshing unit" role="static" material="steel" info={{ summary: 'Threshing unit: cylinder, concave and beater.', role: 'Receives the crop ear-head first and threshes it by beating and rubbing between the rotating cylinder and the stationary slotted concave.' }} cites={CITE.thresh}>
          <Part id="cylinder" name="Threshing cylinder (rasp bar)" role="moving" material="forged" info={INFO.cylinder} cites={[...CITE.thresh, ...CITE.perf]} explode={[0, 0.7, 0]}>
            <group ref={cyl} position={[D.cyl.x, D.cyl.y, 0]}>
              <PartMesh geometry={g.cylinder} />
            </group>
          </Part>
          <Part id="concave" name={`Concave (${clearance} mm clearance)`} role="static" material="steelDark" info={INFO.concave} cites={[...CITE.thresh, ...CITE.perf]} explode={[0, -0.25, 0]}>
            <PartMesh geometry={concave} position={[D.cyl.x, D.cyl.y, 0]} />
          </Part>
          <Part id="beater" name="Beater" role="moving" material="steel" info={INFO.beater} beyondNotes>
            <group ref={beater} position={[D.beater.x, D.beater.y, 0]}>
              <PartMesh geometry={g.beater} />
            </group>
          </Part>
        </Part>

        {/* ---------------- separating and cleaning unit ---------------- */}
        <Part id="separating" name="Separating and cleaning unit" role="static" material="steel" info={{ summary: 'Straw walkers, sieves and fan.', role: 'Separates the grain from the straw and the chaff.' }} cites={CITE.unit}>
          <Part id="walkers" name="Straw walkers" role="moving" material="galvanised" info={INFO.walkers} cites={CITE.unit} explode={[0, 0.9, 0]}>
            {Array.from({ length: D.walkers.n }, (_, k) => (
              <group key={k} ref={(el) => {
                walkers.current[k] = el
              }}>
                <PartMesh geometry={g.walker} />
              </group>
            ))}
            <Part id="walker-cranks" name="Walker crankshafts" role="moving" material="forged" info={INFO.cranks} beyondNotes>
              {D.walkers.crankX.map((x, i) => (
                <group key={x} position={[x, walkerBase(x) - 0.01, 0]} ref={(el) => {
                  cranks.current[i] = el
                }}>
                  <PartMesh geometry={g.crank} />
                </group>
              ))}
            </Part>
          </Part>
          <Part id="shoe" name="Cleaning shoe" role="moving" material="galvanised" info={INFO.shoe} cites={[C.am('§18.4 — sieves reciprocate'), C.am('§19.2')]} explode={[0, -0.35, 0]}>
            <Part id="pans" name="Grain pan & return pan" info={INFO.pans} cites={CITE.unit}>
              <group ref={pans}>
                <PartMesh geometry={g.pans} />
              </group>
            </Part>
            <Part id="chaffer" name="Chaffer (upper sieve)" info={INFO.chaffer} cites={CITE.unit}>
              <group ref={chaffer}>
                <PartMesh geometry={g.chaffer} />
              </group>
            </Part>
            <Part id="sieve" name="Lower sieve" info={INFO.sieve} cites={CITE.unit}>
              <group ref={sieve}>
                <PartMesh geometry={g.sieve} />
              </group>
            </Part>
          </Part>
          <Part id="fan" name="Cleaning fan" role="moving" material="paintGrey" info={INFO.fan} cites={[...CITE.unit, ...CITE.perf]} explode={[0.2, -0.4, 0]}>
            <group ref={fan} position={[D.fan.x, D.fan.y, 0]}>
              <PartMesh geometry={g.fan} />
            </group>
            <Part id="fan-housing" name="Fan housing" role="housing" material="paintGreen">
              <PartMesh geometry={g.fanHousing} />
            </Part>
          </Part>
        </Part>

        {/* ---------------- grain delivery unit ---------------- */}
        <Part id="grain-handling" name="Grain delivery unit" role="static" material="paintGreen" info={{ summary: 'Augers, elevators, tank and unloading auger.', role: 'Collects the clean grain and delivers it to the tank (or bagging platform), returning tailings to the cylinder.' }} cites={CITE.path}>
          <Part id="clean-auger" name="Clean-grain auger" role="moving" material="paintYellow" info={INFO.cleanAuger} cites={CITE.path}>
            <group ref={cleanAuger} position={[D.cleanAuger.x, D.cleanAuger.y, 0]}>
              <PartMesh geometry={g.cross} />
            </group>
            <PartMesh geometry={g.cleanTrough} material="paintGreen" />
          </Part>
          <Part id="tail-auger" name="Tailings auger" role="moving" material="paintYellow" info={INFO.tailAuger} cites={CITE.path}>
            <group ref={tailAuger} position={[D.tailAuger.x, D.tailAuger.y, 0]}>
              <PartMesh geometry={g.cross} />
            </group>
            <PartMesh geometry={g.tailTrough} material="paintGreen" />
          </Part>
          <Part id="elevators" name="Clean-grain & tailings elevators" role="housing" material="paintGreen" info={INFO.elevators} cites={CITE.path} explode={[0, 0, -0.5]}>
            <PartMesh geometry={g.elevators} />
          </Part>
          <Part id="tank" name="Grain tank" role="housing" material="paintGreen" info={INFO.tank} cites={CITE.path} explode={[0, 1.1, 0]}>
            <PartMesh geometry={g.tank} />
            <Part id="tank-grain" name="Grain in tank" role="fluid" material="grain" info={INFO.grain}>
              <PartMesh ref={grain} geometry={g.grainBox} />
            </Part>
            <Part id="tank-auger" name="Tank auger" role="moving" material="paintYellow" info={INFO.tankAuger} beyondNotes>
              <group ref={tankAuger} position={[0, 0, 0]}>
                <PartMesh geometry={g.tankAuger} />
              </group>
            </Part>
          </Part>
          <Part id="unloader" name="Unloading auger" role="moving" material="paintGreen" info={INFO.unload} beyondNotes explode={[0, 0.6, -0.4]}>
            <group ref={unload} position={[U.x, U.y, U.z]}>
              <PartMesh geometry={g.unload} />
            </group>
          </Part>
        </Part>

        {/* ---------------- body ---------------- */}
        <Part id="body" name="Separator body" role="housing" material="paintGreen" info={INFO.body} cites={CITE.unit}>
          <PartMesh geometry={g.body} />
          <Part id="chopper" name="Straw chopper" role="moving" material="steelDark" info={INFO.chopper} beyondNotes>
            <group ref={chopper} position={[D.body.x0 - 0.15, 1.15, 0]}>
              <PartMesh geometry={g.chopper} />
            </group>
          </Part>
        </Part>
        <Part id="cab" name="Cab" role="housing" material="paintGrey" info={INFO.cab} explode={[0.2, 0.8, 0]}>
          <PartMesh geometry={g.cab} />
          <Part id="cab-glass" name="Cab glazing" role="static" material="glass" cut={false}>
            <PartMesh geometry={g.glass} castShadow={false} />
          </Part>
        </Part>
        <Part id="engine" name="Engine" role="housing" material="paintGreen" info={INFO.engine} beyondNotes explode={[-0.4, 0.8, 0]}>
          <PartMesh geometry={g.engine} />
        </Part>
        <Part id="running-gear" name="Wheels and axles" role="moving" material="rubber" info={INFO.wheels} beyondNotes>
          <PartMesh geometry={g.axles} material="paintGrey" />
          {[1, -1].map((s, i) => (
            <group key={`f${s}`} position={[D.front.x, D.front.r, s * D.front.z]} ref={(el) => {
              wheelsF.current[i] = el
            }}>
              <PartMesh geometry={g.fw.tyre} />
              <PartMesh geometry={g.fw.rim} material="paintYellow" />
            </group>
          ))}
          {[1, -1].map((s, i) => (
            <group key={`r${s}`} position={[D.rear.x, D.rear.r, s * D.rear.z]} ref={(el) => {
              wheelsR.current[i] = el
            }}>
              <PartMesh geometry={g.rw.tyre} />
              <PartMesh geometry={g.rw.rim} material="paintYellow" />
            </group>
          ))}
        </Part>
      </Part>

      {/* ---------------- field ---------------- */}
      <Part id="field" name="Field" role="static" material="soil" cut={false} info={INFO.crop}>
        <PartMesh geometry={g.ground} position={[0.5, -0.05, 0]} scale={[24, 0.1, 14]} receiveShadow />
        <Part id="crop" name="Standing crop & stubble" material="crop" role="static" cut={false} info={INFO.crop}>
          <InstancedPartMesh ref={stalks} geometry={g.stalk} count={NSTALK} material="straw" />
          <InstancedPartMesh ref={ears} geometry={g.ear} count={NSTALK} material="grain" />
        </Part>
      </Part>

      {flows ? (
        <group>
          {paths.sides.map((c, i) => (
            <Flow key={`s${i}`} curve={c} count={26} radius={0.022} color="#c9b46a" speed={0.45} spread={0.08} intensity={() => it.crop} />
          ))}
          {paths.centre.map((c, i) => (
            <Flow key={`c${i}`} curve={c} count={14} radius={0.022} color="#c9b46a" speed={0.6} spread={0.08} intensity={() => it.crop} />
          ))}
          <Flow curve={paths.feed} count={40} radius={0.022} color="#c9b46a" speed={0.55} spread={0.09} intensity={() => it.crop} />
          <Flow curve={paths.straw} count={110} radius={0.024} color="#e3cf86" speed={0.22} spread={0.12} emissive={0.25} intensity={() => it.straw} />
          <Flow curve={paths.grain} count={80} radius={0.012} color="#f2b33a" speed={0.32} spread={0.06} intensity={() => it.grain} />
          <Flow curve={paths.walkerGrain} count={30} radius={0.012} color="#f2b33a" speed={0.45} spread={0.06} intensity={() => it.grain * 0.6} />
          <Flow curve={paths.clean} count={70} radius={0.013} color="#f2b33a" speed={0.3} spread={0.04} intensity={() => it.grain} />
          <Flow curve={paths.air} count={60} radius={0.01} color="#f1ead2" speed={0.5} spread={0.14} emissive={0.15} intensity={() => it.chaff} />
          <Flow curve={paths.tail} count={30} radius={0.016} color="#b9a24a" speed={0.25} spread={0.04} intensity={() => it.tail} />
          <Flow curve={paths.straw} count={30} radius={0.016} color="#ff6a2b" speed={0.22} spread={0.1} emissive={0.9} intensity={() => it.lossStraw} />
          <Flow curve={paths.air} count={24} radius={0.014} color="#ff6a2b" speed={0.5} spread={0.12} emissive={0.9} intensity={() => it.lossChaff} />
          <Flow curve={paths.unload} count={60} radius={0.018} color="#f2b33a" speed={0.6} spread={0.05} intensity={() => it.unload} />
        </group>
      ) : null}

      <PartLabel partId="reel" at={[D.reel.x, D.reel.y + D.reel.r + 0.2, 0.6]} />
      <PartLabel partId="cutter-bar" at={[D.header.cutterX + 0.1, 0.25, 1.2]} />
      <PartLabel partId="header-auger" at={[D.auger.x, D.auger.y + 0.35, 1.6]} />
      <PartLabel partId="feeder" at={[(lx + hx) / 2 + 0.2, (ly + hy) / 2 + 0.35, 0.6]} />
      <PartLabel partId="cylinder" at={[D.cyl.x, D.cyl.y + D.cyl.r + 0.12, 0.4]} />
      <PartLabel partId="concave" at={[D.cyl.x + 0.1, D.cyl.y - D.cyl.r - 0.15, 0.4]} />
      <PartLabel partId="walkers" at={[-1.2, walkerBase(-1.2) + 0.45, 0.4]} />
      <PartLabel partId="chaffer" at={[0.0, D.shoe.chafferY + 0.08, 0.5]} />
      <PartLabel partId="fan" at={[D.fan.x, D.fan.y - 0.35, 0.5]} />
      <PartLabel partId="tank" at={[(T.x0 + T.x1) / 2, T.y1 + 0.15, 0.6]} />
      <PartLabel partId="tail-auger" at={[D.tailAuger.x, D.tailAuger.y - 0.15, 0.5]} />
      <PartLabel partId="unloader" at={[U.x - 1.5, U.y + 0.25, U.z]} />
    </group>
  )
}
