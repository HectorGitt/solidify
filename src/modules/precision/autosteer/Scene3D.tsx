import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, xform } from '@/geometry'
import { bar, gnssAntenna, gnssBaseStation, rod } from '@/parts/lib/implements'
import { Level } from '@/modules/implements/_shared/field'
import { FIX, clearCoverage, coverageStats, crossTrack, gaussMarkov, makeCoverage, makePlan, nearest, paint, purePursuit, rng, stepVehicle, type Coverage, type Plan, type Vehicle } from '@/physics/guidance'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { TRACTOR } from '@/tractor/dims'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { FIELD, HISTORY, live, resetLive, useAutosteer } from './model'

const { PI } = Math
/** metres at the start of each pass left out of the accuracy figures (settling after the turn) */
export const LINE_IN = 15
export const pose = createTractorPose({ hitchHeight: 0.35 })

const COLORS = {
  bare: [104, 78, 52],
  once: [70, 150, 62],
  over: [214, 76, 48],
}

/* ------------------------------ simulation state ------------------------------ */

interface Run {
  key: string
  plan: Plan
  v: Vehicle
  /** path index nearest the measured position, and nearest the true position */
  im: number
  it: number
  ex: number
  ez: number
  r: ReturnType<typeof rng>
  cov: Coverage
  passSq: number
  passN: number
  passMinSpeed: number
  lastPass: number
  histAcc: number
  doneT: number
  dirty: boolean
  statAcc: number
  target: THREE.Vector3
}

function coverageFor(W: number) {
  const half = (FIELD.passes * W) / 2 + 3
  return makeCoverage(-FIELD.L / 2 - 2, FIELD.L / 2 + 2, -half, half, 0.5, 0.05)
}

function newRun(W: number, key: string, seed: number, cov?: Coverage): Run {
  const plan = makePlan(FIELD.L, W, FIELD.passes)
  const p0 = plan.pts[0]
  const c = cov ?? coverageFor(W)
  clearCoverage(c)
  return {
    key,
    plan,
    // start a little off the line so the controller has something to do
    v: { x: p0.x, z: p0.z - 1.2, h: 0.08, steer: 0 },
    im: 0,
    it: 0,
    ex: 0,
    ez: 0,
    r: rng(seed),
    cov: c,
    passSq: 0,
    passN: 0,
    passMinSpeed: Infinity,
    lastPass: -1,
    histAcc: 0,
    doneT: 0,
    dirty: true,
    statAcc: 0,
    target: new THREE.Vector3(),
  }
}

let run: Run = newRun(6, '', 1)

/** Make sure the run matches the current settings (called in render and every frame). */
function ensureRun() {
  const key = keyOf()
  if (run.key === key) return
  const st = useAutosteer.getState()
  const sameSize = Math.abs(run.plan.passes[1].z - run.plan.passes[0].z - st.width) < 1e-9
  run = newRun(st.width, key, 11 + st.run * 7, sameSize ? run.cov : undefined)
  resetLive()
}

function keyOf() {
  const s = useAutosteer.getState()
  return `${s.width}|${s.fix}|${s.run}`
}

/** Advance the run by one sub-step of sim time dt. */
function step(dt: number) {
  const st = useAutosteer.getState()
  const spec = FIX[st.fix]
  const R = run
  const speed = st.speed / 3.6
  if (R.doneT > 0) {
    R.doneT += dt
    return
  }
  // positioning error (per axis) and the measured antenna position
  R.ex = gaussMarkov(R.ex, dt, spec.sigma, spec.tau, R.r.gauss())
  R.ez = gaussMarkov(R.ez, dt, spec.sigma, spec.tau, R.r.gauss())
  const mx = R.v.x + R.ex
  const mz = R.v.z + R.ez
  R.im = nearest(R.plan, mx, mz, R.im)
  R.it = nearest(R.plan, R.v.x, R.v.z, R.it)
  const c = purePursuit(R.plan, R.im, mx, mz, R.v.h, st.lookahead, FIELD.wheelbase, FIELD.maxSteer)
  R.target.set(c.target.x, 0.05, c.target.z)
  stepVehicle(R.v, c.steer, speed, dt, FIELD.wheelbase, st.lag, FIELD.steerRate)

  const p = R.plan.pts[R.it]
  const xte = crossTrack(R.plan, R.it, R.v.x, R.v.z)
  live.xte = xte
  live.steer = R.v.steer
  live.errX = R.ex
  live.errZ = R.ez
  live.t += dt
  if (p.pass !== R.lastPass) {
    if (R.lastPass >= 0) {
      live.passesDone = R.lastPass + 1
      // keep the finished pass for the record (and the challenges)
      if (R.passN > 0) {
        live.lastRms = live.rms
        live.lastPeak = live.peak
        live.lastMinSpeed = R.passMinSpeed
        live.lastPassNo = R.lastPass + 1
      }
    }
    R.lastPass = p.pass
    R.passSq = 0
    R.passN = 0
    R.passMinSpeed = Infinity
    live.peak = 0
    live.rms = 0
  }
  live.pass = p.pass
  if (p.pass >= 0) {
    // accuracy is judged after the line-in: the first LINE_IN metres settle the turn
    const ps = R.plan.passes[p.pass]
    const along = ps.dir > 0 ? R.v.x - R.plan.x0 : R.plan.x1 - R.v.x
    if (along >= LINE_IN) {
      R.passSq += xte * xte
      R.passN++
      R.passMinSpeed = Math.min(R.passMinSpeed, st.speed)
      live.rms = Math.sqrt(R.passSq / R.passN)
      live.peak = Math.max(live.peak, Math.abs(xte))
    }
    // the implement works where it really is
    const ix = R.v.x + FIELD.implX * Math.cos(R.v.h)
    const iz = R.v.z - FIELD.implX * Math.sin(R.v.h)
    const inField = ix > R.plan.x0 && ix < R.plan.x1
    if (inField && paint(R.cov, ix, iz, R.v.h, st.width, p.pass)) R.dirty = true
  }
  R.histAcc += dt
  if (R.histAcc >= 0.25) {
    R.histAcc = 0
    live.hist[live.head] = xte * 100
    live.histT[live.head] = live.t
    live.head = (live.head + 1) % HISTORY
    live.count = Math.min(HISTORY, live.count + 1)
  }
  if (R.it >= R.plan.pts.length - 2) {
    live.passesDone = FIELD.passes
    live.done = true
    R.doneT = dt
  }
}

function updateStats(W: number) {
  const done = Math.max(1, live.passesDone)
  const first = run.plan.passes[0].z
  const zLo = first - W / 2
  const zHi = run.plan.passes[Math.min(done, FIELD.passes) - 1].z + W / 2
  if (live.passesDone < 1) {
    live.overlap = 0
    live.gap = 0
    live.area = 0
    return
  }
  const s = coverageStats(run.cov, zLo, zHi, run.plan.x0 + 2, run.plan.x1 - 2)
  live.overlap = s.overlap
  live.gap = s.gap
  live.area = (FIELD.L * W * live.passesDone) / 1e4
}

/* ------------------------------ geometry ------------------------------ */

const antennaGeometry = gnssAntenna

function toolbar(W: number) {
  const parts: THREE.BufferGeometry[] = [
    bar([-0.85, 0.35, W / 2], [-0.85, 0.35, -W / 2], 0.1, 0.1),
    bar([0, 0, 0.35], [-0.85, 0.35, 0.3], 0.07, 0.07),
    bar([0, 0, -0.35], [-0.85, 0.35, -0.3], 0.07, 0.07),
    bar([0, 0.61, 0], [-0.85, 0.4, 0], 0.06, 0.06),
    rod([0, 0, 0.43], [0, 0, -0.43], 0.02, 12),
  ]
  const tines: THREE.BufferGeometry[] = []
  const n = Math.max(4, Math.round(W / 0.5))
  for (let i = 0; i < n; i++) {
    const z = -W / 2 + 0.25 + (i * (W - 0.5)) / (n - 1)
    tines.push(bar([-0.85, 0.32, z], [-1.05, -0.08, z], 0.03, 0.03))
  }
  return { frame: merge(...parts), tines: merge(...tines) }
}

const baseStation = gnssBaseStation

/* ------------------------------ scene ------------------------------ */

const INFO = {
  antenna: { summary: 'GNSS receiver and antenna (smart antenna).', role: 'Tracks GPS, GLONASS, Galileo and BeiDou satellites and computes the antenna’s position several times a second. With RTK corrections from a base station, to about 2 cm.' },
  steering: { summary: 'Electric steering-wheel motor.', role: 'Turns the steering wheel to the angle the guidance controller asks for. Factory-fit systems use a valve in the hydraulic steering instead.' },
  terminal: { summary: 'Guidance display (terminal).', role: 'Where the driver sets the A-B line, implement width and turn pattern. Shows cross-track error and the coverage map.' },
  implement: { summary: 'Mounted tine toolbar (stand-in for a drill, cultivator or sprayer boom).', role: 'Works a strip as wide as the implement. Its true position is what is painted on the ground: green once, red where passes overlap; bare soil between passes is a gap.' },
  base: { summary: 'RTK base station.', role: 'A receiver on a fixed, surveyed point. Because it knows where it really is, it can measure the satellite errors and broadcast corrections to the tractor by radio.' },
  ground: { summary: 'Coverage map.', role: 'Green = worked once. Red = worked twice (wasted seed, fertiliser or spray). Bare soil between passes = missed.' },
}

function Sky() {
  const sats = useMemo(() => Array.from({ length: 10 }, (_, i) => ({ az: (i * 2.4) % (2 * PI), el: 0.35 + ((i * 0.37) % 0.9) })), [])
  const group = useRef<THREE.Group>(null)
  const satGeo = useMemo(() => merge(box(0.9, 0.5, 0.5), xform(box(2.6, 0.04, 0.6), mat4.t(0, 0, 0))), [])
  const linesGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sats.length * 6), 3))
    return g
  }, [sats.length])
  const lines = useMemo(() => new THREE.LineSegments(linesGeo, new THREE.LineBasicMaterial({ color: '#7fd0ff', transparent: true, opacity: 0.35 })), [linesGeo])
  const antenna = useMemo(() => new THREE.Vector3(), [])
  const R = 90
  useSimFrame((_, t) => {
    const g = group.current
    if (!g) return
    const v = run.v
    antenna.set(v.x + FIELD.antenna[0] * Math.cos(v.h), FIELD.antenna[1] + 0.08, v.z - FIELD.antenna[0] * Math.sin(v.h))
    const a = lines.geometry.getAttribute('position') as THREE.BufferAttribute
    g.children.forEach((c, i) => {
      const s = sats[i]
      const az = s.az + t * 0.004
      c.position.set(R * Math.cos(s.el) * Math.cos(az), R * Math.sin(s.el), R * Math.cos(s.el) * Math.sin(az))
      c.lookAt(0, 0, 0)
      a.setXYZ(2 * i, antenna.x, antenna.y, antenna.z)
      a.setXYZ(2 * i + 1, c.position.x, c.position.y, c.position.z)
    })
    a.needsUpdate = true
  })
  return (
    <>
      <group ref={group}>
        {sats.map((_, i) => (
          <mesh key={i} geometry={satGeo}>
            <meshStandardMaterial color="#c9d3e0" metalness={0.6} roughness={0.35} emissive="#3a5a80" emissiveIntensity={0.4} />
          </mesh>
        ))}
      </group>
      <primitive object={lines} />
    </>
  )
}

function CoverageGround() {
  const W = useAutosteer((s) => s.width)
  const cov = run.cov
  const tex = useMemo(() => {
    const data = new Uint8Array(cov.nx * cov.nz * 4)
    const t = new THREE.DataTexture(data, cov.nx, cov.nz, THREE.RGBAFormat)
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.LinearFilter
    t.colorSpace = THREE.SRGBColorSpace
    t.needsUpdate = true
    return t
  }, [cov])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [tex])
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(cov.nx * cov.cx, cov.nz * cov.cz)
    g.rotateX(-PI / 2)
    g.translate(cov.x0 + (cov.nx * cov.cx) / 2, 0.03, cov.z0 + (cov.nz * cov.cz) / 2)
    return g
  }, [cov])
  const acc = useRef(1)
  useSimFrame((dt) => {
    acc.current += dt
    if (!run.dirty || acc.current < 0.2) return
    acc.current = 0
    run.dirty = false
    updateStats(useAutosteer.getState().width)
    const d = tex.image.data as Uint8Array
    const { nx, nz, count } = cov
    for (let k = 0; k < nz; k++) {
      // texture row 0 is the far (−Z after rotation → +Z world) edge: PlaneGeometry v runs to −Z
      const row = nz - 1 - k
      for (let i = 0; i < nx; i++) {
        const n = count[k * nx + i]
        const c = n === 0 ? COLORS.bare : n === 1 ? COLORS.once : COLORS.over
        const o = (row * nx + i) * 4
        d[o] = c[0]
        d[o + 1] = c[1]
        d[o + 2] = c[2]
        d[o + 3] = 255
      }
    }
    tex.needsUpdate = true
  })
  useEffect(() => () => {
    tex.dispose()
    mat.dispose()
    geo.dispose()
  }, [tex, mat, geo])
  const unit = useMemo(() => box(1, 1, 1), [])
  const half = (FIELD.passes * W) / 2
  return (
    <Part id="coverage" name="Coverage map" role="static" material="soil" cut={false} info={INFO.ground}>
      <PartMesh geometry={geo} customMaterial={mat} receiveShadow />
      <PartMesh geometry={unit} material="crop" position={[0, -0.08, 0]} scale={[FIELD.L + 60, 0.1, 2 * half + 60]} receiveShadow />
    </Part>
  )
}

function GuidanceLines() {
  const W = useAutosteer((s) => s.width)
  const show = useAutosteer((s) => s.lines)
  const mats = useMemo(() => ({ idle: new THREE.MeshBasicMaterial({ color: '#9fdcff', transparent: true, opacity: 0.35 }), active: new THREE.MeshBasicMaterial({ color: '#4fd1ff' }) }), [])
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const marker = useRef<THREE.Mesh>(null)
  const plan = useMemo(() => makePlan(FIELD.L, W, FIELD.passes), [W])
  useSimFrame(() => {
    refs.current.forEach((m, k) => {
      if (m) m.material = live.pass === k ? mats.active : mats.idle
    })
    marker.current?.position.copy(run.target)
  })
  if (!show) return null
  return (
    <group>
      {plan.passes.map((p, k) => (
        <mesh key={k} ref={(el) => void (refs.current[k] = el)} position={[0, 0.07, p.z]} material={mats.idle}>
          <boxGeometry args={[FIELD.L + 16, 0.01, 0.06]} />
        </mesh>
      ))}
      <mesh ref={marker}>
        <sphereGeometry args={[0.18, 16, 12]} />
        <meshBasicMaterial color="#ffd166" />
      </mesh>
    </group>
  )
}

function RadioLink() {
  const fix = useAutosteer((s) => s.fix)
  const W = useAutosteer((s) => s.width)
  const base: [number, number, number] = [-FIELD.L / 2 - 8, 0, -(FIELD.passes * W) / 2 - 6]
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    return new THREE.Line(g, new THREE.LineDashedMaterial({ color: '#7dffb0', dashSize: 1, gapSize: 0.6 }))
  }, [])
  useSimFrame(() => {
    const v = run.v
    const a = line.geometry.getAttribute('position') as THREE.BufferAttribute
    a.setXYZ(0, base[0] + 0.36, 2.15, base[2])
    a.setXYZ(1, v.x + FIELD.antenna[0] * Math.cos(v.h), FIELD.antenna[1] + 0.1, v.z - FIELD.antenna[0] * Math.sin(v.h))
    a.needsUpdate = true
    line.computeLineDistances()
  })
  const g = useMemo(baseStation, [])
  return (
    <group>
      <Part id="base" name="RTK base station" role="static" material="paintYellow" cut={false} info={INFO.base} position={base}>
        <PartMesh geometry={g.tripod} material="aluminium" />
        <PartMesh geometry={g.radio} />
        <PartMesh geometry={g.whip} material="paintBlack" />
        <PartMesh geometry={antennaGeometry().dome} material="plastic" position={[0, 2.0, 0]} />
      </Part>
      <PartLabel partId="base" at={[base[0], 2.6, base[2]]} />
      {fix === 'rtk' ? <primitive object={line} /> : null}
    </group>
  )
}

export function Autosteer3D() {
  const width = useAutosteer((s) => s.width)
  const fix = useAutosteer((s) => s.fix)
  const sats = useAutosteer((s) => s.sats)
  const tractor = useRef<THREE.Group>(null)
  const ant = useMemo(antennaGeometry, [])
  const tb = useMemo(() => toolbar(width), [width])
  const motor = useMemo(() => xform(cylinder(0.11, 0.07, 24), mat4.rz(0.5)), [])
  const terminal = useMemo(() => box(0.04, 0.2, 0.28), [])
  ensureRun()

  useSimFrame((dt) => {
    ensureRun()
    if (dt <= 0) return
    const st = useAutosteer.getState()
    const total = dt * st.ff
    const n = Math.max(1, Math.ceil(total / 0.02))
    for (let i = 0; i < n; i++) step(total / n)
    // restart a finished field after a pause
    if (run.doneT > 4) useAutosteer.getState().restart()
    const v = run.v
    tractor.current?.position.set(v.x, 0, v.z)
    tractor.current?.rotation.set(0, v.h, 0)
    // the shared tractor yaws its wheels +Y (to the left) for positive steer; ours is + = right
    pose.steer = -v.steer
    const speed = (st.speed / 3.6) * (run.doneT > 0 ? 0 : st.ff)
    pose.rearAngle += (speed * dt) / TRACTOR.rear.rolling
    pose.frontAngle += (speed * dt) / TRACTOR.front.radius
    pose.engineAngle += dt * 2 * PI * 30
    pose.effects = { load: 0.55, rpm: 1900, ratedRpm: 2250, speed: run.doneT > 0 ? 0 : st.speed / 3.6, slip: 0.06, dust: 0.6 }
  }, -1)

  return (
    <group>
      <group ref={tractor}>
        <Tractor
          pose={pose}
          internals={false}
          labels={false}
          paint="paintGreen"
          cab
          mounted={
            <Level pose={pose}>
              <Part id="implement" name="Implement (toolbar)" role="static" material="paintBlue" cut={false} info={INFO.implement}>
                <PartMesh geometry={tb.frame} />
                <PartMesh geometry={tb.tines} material="steel" />
              </Part>
            </Level>
          }
        >
          <Part id="antenna" name="GNSS antenna" role="static" material="plastic" cut={false} info={INFO.antenna} position={FIELD.antenna}>
            <PartMesh geometry={ant.dome} material="paintGrey" />
            <PartMesh geometry={ant.mast} material="steelDark" />
          </Part>
          <Part id="steer-motor" name="Steering motor" role="static" material="paintBlack" cut={false} info={INFO.steering} position={[TRACTOR.steeringWheel.x - 0.03, TRACTOR.steeringWheel.y - 0.06, 0]}>
            <PartMesh geometry={motor} />
          </Part>
          <Part id="terminal" name="Guidance display" role="static" material="paintBlack" cut={false} info={INFO.terminal} position={[TRACTOR.steeringWheel.x - 0.05, TRACTOR.steeringWheel.y + 0.12, 0.32]}>
            <PartMesh geometry={terminal} />
          </Part>
        </Tractor>
        <PartLabel partId="antenna" at={[FIELD.antenna[0], FIELD.antenna[1] + 0.3, 0]} />
        <PartLabel partId="steer-motor" at={[TRACTOR.steeringWheel.x, TRACTOR.steeringWheel.y + 0.25, -0.3]} />
        <PartLabel partId="implement" at={[-2.4, 1.0, width / 2 - 0.5]} />
      </group>
      <CoverageGround />
      <GuidanceLines />
      <RadioLink />
      {sats && fix !== 'manual' ? <Sky /> : null}
    </group>
  )
}

export function resetScene() {
  resetLive()
  run.key = ''
}
