import { Html, Line } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { box, cylinder, extrude, mat4, merge, roundedBox, xform } from '@/geometry'
import { bendingStress, reactions } from '@/physics/beam'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { useAutoRun, useRunDriver, instrument } from '@/lab/run'
import { LENGTH_DRAWN, PROCEDURE, analyse, beamRun, conditionsOf, useBeam } from './model'

export const FLOOR = -0.56
const X0 = -LENGTH_DRAWN / 2
const axial = mat4.rx(Math.PI / 2)
const BENCH_TOP = FLOOR + 0.04

const STEEL = new THREE.Color('#9aa3ab')
const TENSION = new THREE.Color('#d0452c')
const COMPRESSION = new THREE.Color('#2f6fd0')

function Tag({ at, children, color = '#3f4a52' }: { at: [number, number, number]; children: ReactNode; color?: string }) {
  return (
    <Html position={at} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }} center>
      <div className="part-label" style={{ color, borderColor: color, whiteSpace: 'nowrap' }}>
        {children}
      </div>
    </Html>
  )
}

/** The bent beam: each rectangle of the section swept along the deflected line, coloured by bending stress. */
function bentBeam(a: ReturnType<typeof analyse>, full: ReturnType<typeof analyse>, stress: boolean) {
  const { c, section, props } = a
  const n = c.x.length - 1
  const sx = LENGTH_DRAWN / a.beam.L
  const k = sectionScale(props.depth)
  const dy = deflectionScale(full)
  const peakS = Math.max(...full.c.M.map((m) => Math.abs(bendingStress(m, props.depth, props))), ...full.c.M.map((m) => Math.abs(bendingStress(m, 0, props))), 1)
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const colour = new THREE.Color()
  const paint = (i: number, z: number) => {
    if (!stress) return STEEL
    const s = bendingStress(c.M[i], z, props) / peakS
    return colour.copy(STEEL).lerp(s > 0 ? TENSION : COMPRESSION, Math.min(1, Math.abs(s) * 1.1))
  }
  const push = (x: number, y: number, z: number, cc: THREE.Color) => {
    pos.push(x, y, z)
    col.push(cc.r, cc.g, cc.b)
  }
  let bottom = 0
  for (const r of section) {
    const zLo = bottom
    const zHi = bottom + r.h
    bottom = zHi
    const yLo = (zLo - props.ybar) * k
    const yHi = (zHi - props.ybar) * k
    const hw = (r.b / 2) * k
    // four long faces, each with its own vertices for a hard edge
    const faces: [number, number, number, number, number, number][] = [
      [yHi, -hw, zHi, yHi, hw, zHi],
      [yLo, hw, zLo, yLo, -hw, zLo],
      [yLo, hw, zLo, yHi, hw, zHi],
      [yHi, -hw, zHi, yLo, -hw, zLo],
    ]
    for (const [y0, w0, z0, y1, w1, z1] of faces) {
      const base = pos.length / 3
      for (let i = 0; i <= n; i++) {
        const x = X0 + c.x[i] * sx
        const d = c.y[i] * dy
        push(x, y0 + d, w0, paint(i, z0))
        push(x, y1 + d, w1, paint(i, z1))
      }
      for (let i = 0; i < n; i++) {
        const q = base + i * 2
        idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3)
      }
    }
    // the two ends
    for (const [i, flip] of [[0, true], [n, false]] as [number, boolean][]) {
      const base = pos.length / 3
      const x = X0 + c.x[i] * sx
      const d = c.y[i] * dy
      push(x, yLo + d, -hw, paint(i, zLo))
      push(x, yLo + d, hw, paint(i, zLo))
      push(x, yHi + d, hw, paint(i, zHi))
      push(x, yHi + d, -hw, paint(i, zHi))
      if (flip) idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
      else idx.push(base, base + 2, base + 1, base, base + 3, base + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** the section is drawn deep enough to read, whatever its real size */
export const sectionScale = (depth: number) => 0.1 / depth
/** the deflection is drawn at a visible size */
export const deflectionScale = (a: ReturnType<typeof analyse>) => (Math.abs(a.peak.ymax) > 1e-12 ? 0.075 / Math.abs(a.peak.ymax) : 0)

const knife = () => {
  const s = new THREE.Shape()
  s.moveTo(-0.045, 0)
  s.lineTo(0.045, 0)
  s.lineTo(0, 0.06)
  s.closePath()
  return extrude(s, 0.14)
}

/** a hanger and its stack of slotted weights */
function Weights({ id, name, x, y, value, peak, index }: { id: string; name: string; x: number; y: number; value: number; peak: number; index: number }) {
  const n = Math.max(0, Math.min(8, Math.round((value / peak) * 7)))
  const drop = 0.18
  const geo = useMemo(() => {
    const rod = xform(cylinder(0.004, drop, 12), mat4.t(0, -drop / 2, 0))
    const stirrup = xform(box(0.012, 0.012, 0.15), mat4.t(0, 0.006, 0))
    const disc = (i: number) => xform(cylinder(0.042 - (i % 2) * 0.002, 0.016, 28), mat4.t(0, -drop - i * 0.017, 0))
    return { hanger: merge(rod, stirrup), stack: n ? merge(...Array.from({ length: n }, (_, i) => disc(i))) : null }
  }, [n])
  return (
    <group position={[x, y, 0]}>
      <Part id={id} name={name} role="static" material="steelDark" info={{ summary: `Load ${index}, hung from the beam.`, role: 'A point load acts at one section: the shear force steps there, and the moment diagram changes slope.' }} cut={false}>
        <PartMesh geometry={geo.hanger} material="chrome" />
        {geo.stack ? <PartMesh geometry={geo.stack} /> : null}
      </Part>
      <Tag at={[0, 0.05, 0.1]} color="#8a3d12">
        {value.toFixed(value < 10 ? 1 : 0)} kN
      </Tag>
    </group>
  )
}

/** identical blocks along the span stand for the uniform load */
function Blocks({ a, count, height, topOf }: { a: ReturnType<typeof analyse>; count: number; height: number; topOf: (x: number) => number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.BoxGeometry(LENGTH_DRAWN / count - 0.006, 1, 0.09), [count])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const d = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) / count) * a.beam.L
      d.position.set(X0 + (x * LENGTH_DRAWN) / a.beam.L, topOf(x) + height / 2, 0)
      d.scale.set(1, height, 1)
      d.updateMatrix()
      m.setMatrixAt(i, d.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [a, count, height, topOf])
  return (
    <instancedMesh ref={ref} args={[geo, undefined, count]} frustumCulled={false} castShadow>
      <meshStandardMaterial color="#b98a4e" roughness={0.85} />
    </instancedMesh>
  )
}

/** a line diagram behind the beam */
function Diagram({ xs, ys, full, y0, height, color, label }: { xs: number[]; ys: number[]; full: number[]; y0: number; height: number; color: string; label: string }) {
  // scaled by the full load, so the diagram grows as the test goes on
  const peak = Math.max(...full.map(Math.abs), 1e-9)
  const scale = height / peak
  const z = -0.2
  const pts = useMemo(() => xs.map((x, i) => [x, y0 + ys[i] * scale, z] as [number, number, number]), [xs, ys, y0, scale])
  const fill = useMemo(() => {
    const pos: number[] = []
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, ya] = pts[i]
      const [b, yb] = pts[i + 1]
      pos.push(a, y0, z, b, y0, z, b, yb, z, a, y0, z, b, yb, z, a, ya, z)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [pts, y0])
  return (
    <group>
      <mesh geometry={fill}>
        <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <Line points={pts} color={color} lineWidth={2} />
      <Line points={[[xs[0], y0, z], [xs[xs.length - 1], y0, z]]} color="#7a8590" lineWidth={1} />
      <Tag at={[xs[0] - 0.09, y0, z]} color={color}>
        {label}
      </Tag>
    </group>
  )
}

export function Beam3D() {
  const p = useBeam()
  const a = useMemo(() => analyse(p), [p])
  const full = useMemo(() => analyse(p, 1), [p.support, p.L, p.P1, p.x1, p.P2, p.x2, p.w, p.section, p.bf, p.tf, p.hw, p.tw, p.E])
  const needle = useRef<THREE.Group>(null)
  useAutoRun(beamRun, conditionsOf(p))
  useRunDriver(
    beamRun,
    PROCEDURE,
    (f) => {
      // a change of 1 % is the most the eye can use; this spares rebuilding the beam every frame
      if (Math.abs(f - useBeam.getState().f) >= 0.01 || f === 1) useBeam.getState().set({ f })
    },
    (step, f) => {
      const st = useBeam.getState()
      const here = analyse(st, f)
      const far = Math.max(here.props.yTop, here.props.yBottom)
      const stress = (Math.abs(here.peak.Mmax) * far) / here.props.I / 1e6
      const load = (st.P1 + st.P2 + st.w * st.L) * f
      // the dial reads to within 1 %, the strain gauge to within 1.5 %
      beamRun.getState().log([step, load, instrument(Math.abs(here.peak.ymax) * 1e3, 0.01, step), instrument(stress, 0.015, step + 40)])
      if (stress >= st.yieldS) beamRun.getState().fail(`The far fibre reached its ${st.yieldS} MPa yield stress at ${Math.round(f * 100)} % of the load. The beam would now take a permanent set, so the test stops.`)
    },
  )
  useEffect(() => {
    // unloaded before a test starts
    return beamRun.subscribe((r, prev) => {
      if (r.status === 'idle' && prev.status !== 'idle') useBeam.getState().set({ f: 0 })
      if (r.status === 'running' && prev.status !== 'running' && r.step === 0 && r.rows.length === 0) useBeam.getState().set({ f: 0 })
    })
  }, [])
  const stressMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.25, roughness: 0.5 }), [])
  const beamGeo = useMemo(() => bentBeam(a, full, p.stress), [a, full, p.stress])
  const sx = LENGTH_DRAWN / p.L
  const k = sectionScale(a.props.depth)
  const dy = deflectionScale(full)
  const yAt = useMemo(
    () => (x: number) => {
      const f = Math.max(0, Math.min(a.c.x.length - 1, (x / p.L) * (a.c.x.length - 1)))
      const i = Math.min(a.c.x.length - 2, Math.floor(f))
      return (a.c.y[i] + (a.c.y[i + 1] - a.c.y[i]) * (f - i)) * dy
    },
    [a, dy, p.L],
  )
  const under = -a.props.yBottom * k
  const over = a.props.yTop * k
  const peakLoad = Math.max(p.P1, p.P2, 1e-6)
  const r = reactions(a.beam)
  const cantilever = p.support === 'cantilever'

  const fixed = useMemo(
    () => ({
      // an open frame on the floor, so the weights hang clear
      top: merge(...[-1, 1].map((sx) => xform(roundedBox(0.09, 0.04, 0.56, 0.006), mat4.t((sx * LENGTH_DRAWN) / 2, FLOOR + 0.02, 0)))),
      legs: xform(box(LENGTH_DRAWN + 0.09, 0.04, 0.05), mat4.t(0, FLOOR + 0.02, -0.25)),
      knife: knife(),
      roller: xform(cylinder(0.012, 0.13, 20), axial),
      wall: xform(box(0.1, 0.72, 0.26), mat4.t(X0 - 0.05, BENCH_TOP + 0.36, 0)),
    }),
    [],
  )
  const postTop = under - 0.06
  const posts = useMemo(() => ({ post: xform(box(0.06, Math.max(0.01, postTop - 0.024 - BENCH_TOP), 0.11), mat4.t(0, (postTop - 0.024 + BENCH_TOP) / 2, 0)) }), [postTop])

  const dx = useMemo(() => a.c.x.map((x) => X0 + x * sx), [a, sx])
  const probeX = X0 + p.probe * LENGTH_DRAWN
  const dial = X0 + full.peak.xY * sx
  const dialGeo = useMemo(
    () => ({
      stand: merge(xform(box(0.05, 0.3, 0.05), mat4.t(0, 0.15, 0)), xform(box(0.2, 0.02, 0.2), mat4.t(0, 0.01, 0))),
      body: xform(cylinder(0.075, 0.03, 48), axial),
      face: xform(cylinder(0.066, 0.002, 48), mat4.c(mat4.t(0, 0, 0.016), axial)),
      ticks: merge(...Array.from({ length: 20 }, (_, i) => xform(box(0.002, 0.012, 0.001), mat4.c(mat4.rz((i * Math.PI) / 10), mat4.t(0, 0.056, 0.0175))))),
      needle: xform(box(0.004, 0.052, 0.002), mat4.t(0, 0.024, 0.019)),
      plunger: xform(cylinder(0.005, 0.2, 12), mat4.t(0, 0.1, 0)),
    }),
    [],
  )
  // one turn of the needle for each full-load deflection's worth, as a gauge with a fixed range
  const fullDrop = Math.max(Math.abs(full.peak.ymax), 1e-12)
  const turn = (Math.abs(a.peak.ymax) / fullDrop) * Math.PI * 1.6
  const yDial = yAt(a.peak.xY)
  const blockH = p.w > 0 ? Math.max(0.001, Math.min(0.09, 0.012 + p.w * 0.004) * p.f) : 0
  const topOf = useMemo(() => (x: number) => yAt(x) + over, [yAt, over])

  return (
    <group>
      <Part id="frame" name="Test frame" role="static" material="paintGrey" info={{ summary: 'The floor frame the rig stands on.', role: 'Carries the supports square and level, so the only thing that bends is the beam.' }} cut={false} explode={[0, -0.08, 0]}>
        <PartMesh geometry={fixed.top} />
        <PartMesh geometry={fixed.legs} material="steelDark" />
      </Part>
      {cantilever ? (
        <Part id="wall" name="Built-in end" role="static" material="concrete" info={{ summary: 'A fixed end.', role: 'Resists a vertical force and a moment: the beam can neither move nor turn there.' }} cut={false}>
          <PartMesh geometry={fixed.wall} />
        </Part>
      ) : (
        <Part id="supports" name="Supports" role="static" material="steel" info={{ summary: 'A pin at A and a roller at B.', role: 'The pin stops movement both ways; the roller only stops it vertically, so the beam can lengthen freely. Neither resists a moment.' }} cut={false}>
          <group position={[X0, postTop, 0]}>
            <PartMesh geometry={fixed.knife} />
            <PartMesh geometry={posts.post} material="paintGrey" position={[0, -postTop, 0]} />
          </group>
          <group position={[X0 + LENGTH_DRAWN, postTop, 0]}>
            <PartMesh geometry={fixed.knife} />
            <PartMesh geometry={fixed.roller} material="chrome" position={[0, -0.012, 0]} />
            <PartMesh geometry={posts.post} material="paintGrey" position={[0, -postTop, 0]} />
          </group>
        </Part>
      )}
      <Part id="beam" name="Beam" role="moving" material="steel" info={{ summary: 'The test beam, coloured by bending stress.', role: 'Under load, one face stretches (red) and the other shortens (blue). The neutral axis between them carries no bending stress.' }} cut={false}>
        <PartMesh geometry={beamGeo} customMaterial={stressMat} />
      </Part>
      {p.P1 > 0 ? <Weights id="load-1" name="Load 1" index={1} x={X0 + Math.min(p.x1, p.L) * sx} y={yAt(p.x1) + under} value={p.P1 * p.f} peak={peakLoad} /> : null}
      {p.P2 > 0 ? <Weights id="load-2" name="Load 2" index={2} x={X0 + Math.min(p.x2, p.L) * sx} y={yAt(p.x2) + under} value={p.P2 * p.f} peak={peakLoad} /> : null}
      {p.w > 0 ? <Blocks a={a} count={20} height={blockH} topOf={topOf} /> : null}
      {p.w > 0 ? (
        <Tag at={[0, yAt(p.L / 2) + over + blockH + 0.03, 0.08]} color="#8a5a1e">
          {(p.w * p.f).toFixed(1)} kN/m
        </Tag>
      ) : null}
      {/* the dial gauge reads the sag at mid-span */}
      <group position={[dial, BENCH_TOP, 0.14]}>
        <Part id="dial" name="Dial gauge" role="static" material="paintGrey" info={{ summary: 'Reads the deflection.', role: 'Its plunger rests under the beam. As each load step goes on, the needle turns, and it is read once the beam has settled.' }} cut={false}>
          <PartMesh geometry={dialGeo.stand} />
          <group position={[0, 0.38, 0]}>
            <PartMesh geometry={dialGeo.body} material="chrome" />
            <PartMesh geometry={dialGeo.face} material="ceramic" />
            <PartMesh geometry={dialGeo.ticks} material="paintBlack" />
            <group ref={needle} rotation={[0, 0, -turn]}>
              <PartMesh geometry={dialGeo.needle} material="paintRed" />
            </group>
          </group>
        </Part>
      </group>
      {/* the section where the stresses are read */}
      <mesh position={[probeX, 0.02, 0]}>
        <boxGeometry args={[0.002, 0.26, 0.24]} />
        <meshBasicMaterial color="#4d7c0f" transparent opacity={0.25} depthWrite={false} />
      </mesh>
      {Math.abs(a.peak.ymax) > 1e-12 ? (
        <Tag at={[dial, yDial + under - 0.03, 0.1]} color="#2f6fd0">
          δ {(Math.abs(a.peak.ymax) * 1e3).toFixed(Math.abs(a.peak.ymax) < 0.01 ? 2 : 1)} mm
        </Tag>
      ) : null}
      {cantilever ? null : (
        <>
          <Tag at={[X0 - 0.06, postTop - 0.03, 0.12]}>R_A {(r.Ra / 1e3).toFixed(2)} kN</Tag>
          <Tag at={[X0 + LENGTH_DRAWN + 0.06, postTop - 0.03, 0.12]}>R_B {(r.Rb / 1e3).toFixed(2)} kN</Tag>
        </>
      )}
      {p.diagrams ? (
        <>
          <Diagram xs={dx} ys={a.c.V} full={full.c.V} y0={0.42} height={0.07} color="#2f6fd0" label="Shear" />
          {/* drawn on the tension side: sagging hangs below the line */}
          <Diagram xs={dx} ys={a.c.M.map((m) => -m)} full={full.c.M} y0={0.29} height={0.08} color="#b4531a" label="Moment" />
        </>
      ) : null}
      <PartLabel partId="beam" at={[X0 + 0.2, over + 0.04, 0.1]} />
    </group>
  )
}
