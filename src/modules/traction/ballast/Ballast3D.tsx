import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { box, tube } from '@/geometry'
import { useSimFrame } from '@/core/sim'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { buildTyre } from '../tyre/build'
import { cavityFill } from './liquid'
import { BAL, MIXES, TT, TTS, derive, live, resetTest, useBallast } from './model'

const { PI } = Math
const SINK = 0.025
const PRINTS = 48
const MARKS = 12
const LAYER_MAT = { tread: 'rubber', belt: 'steelDark', ply: 'nylon', liner: 'rubber' } as const

export function Ballast3D() {
  const st = useBallast()
  const d = derive(st)
  const g = useMemo(() => buildTyre(d.size, 'bias', 'R1', false), [d.size])
  const R = g.R
  const axleY = R - SINK
  const liquid = useMemo(() => (st.fill > 0.005 ? cavityFill(g.cavity, g.rimR, d.level, true) : null), [g, d.level, st.fill])
  const air = useMemo(() => (st.fill < 0.995 ? cavityFill(g.cavity, g.rimR, d.level, false) : null), [g, d.level, st.fill])

  const parts = useMemo(
    () => ({
      weight: tube(0.26, 0.09, 0.03, 48),
      chalk: box(0.05, 0.012, 0.16),
      arm: box(1, 0.006, 1),
      mark: box(0.06, 0.008, 0.5),
      soil: box(7, 0.2, 3),
      suitcase: box(0.4, 0.25, 0.055),
      support: box(0.1, 0.08, 1.1),
    }),
    [],
  )

  // lug geometry on the ground (matches buildTyre's R-1 bars: 45°, centred at ±0.48 hw)
  const lugN = Math.round((2 * PI * (R - g.lugH)) / 0.2)
  const armLen = (g.hw * 0.95) / Math.cos(PI / 4)

  const wheel = useRef<THREE.Group>(null)
  const liquidRef = useRef<THREE.Group>(null)
  const prints = useRef<THREE.InstancedMesh>(null)
  const marks = useRef<THREE.InstancedMesh>(null)
  const ticks = useRef<THREE.InstancedMesh>(null)
  const sim = useRef({ theta: 0, ground: 0, lastLug: 0, lastRev: 0, printU: [] as number[], printS: [] as number[], marksU: [] as number[], waiting: true, startTheta: 0, startGround: 0, slip: d.slip })
  sim.current.slip = d.slip

  const printMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), [])
  const markMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2d13a', roughness: 0.7, emissive: '#5a4a00', emissiveIntensity: 0.4 }), [])
  const tickMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9d2cc', roughness: 0.8, transparent: true, opacity: 0.8 }), [])
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), m: new THREE.Matrix4(), s: new THREE.Matrix4(), c: new THREE.Color() }), [])

  // a new tyre starts a new test
  useEffect(() => resetTest(), [d.size])

  useSimFrame((dt, time) => {
    const s = sim.current
    const p = useBallast.getState()
    const vt = p.mph * 0.44704
    const slip = s.slip
    s.theta += (vt / R) * dt
    s.ground += vt * (1 - slip) * dt
    live.circ = 2 * PI * R
    live.slip = slip
    if (live.reset) {
      live.reset = false
      s.waiting = true
      s.marksU = []
    }
    // chalk-mark slip test (TT p9): start when the chalk mark next comes down, count 10 loaded revolutions
    const rev = Math.floor(s.theta / (2 * PI))
    if (rev !== s.lastRev) {
      s.lastRev = rev
      if (s.waiting) {
        s.waiting = false
        s.startTheta = rev * 2 * PI
        s.startGround = s.ground
        s.marksU = [s.ground]
      } else if (live.revs < 10 - 1e-9) {
        s.marksU.push(s.ground)
        if (s.marksU.length > MARKS) s.marksU.shift()
      }
    }
    if (!s.waiting && live.revs < 10) {
      live.revs = Math.min(10, (s.theta - s.startTheta) / (2 * PI))
      live.dist = s.ground - s.startGround
      if (live.revs >= 10) live.dist = s.marksU[s.marksU.length - 1] - s.startGround
    }

    wheel.current?.rotation.set(0, 0, -s.theta)
    // the liquid stays at the bottom and sloshes a little as the lugs bump over the soil
    liquidRef.current?.rotation.set(0, 0, vt > 0.05 ? 0.025 * Math.sin(2 * PI * 1.3 * time) * Math.min(1, vt) : 0)

    // tread prints: one chevron per lug contact, smeared by slip
    const lug = Math.floor((s.theta * lugN) / (2 * PI))
    if (lug !== s.lastLug) {
      for (let k = s.lastLug + 1; k <= lug && k - lug < PRINTS; k++) {
        s.printU.push(s.ground)
        s.printS.push(slip)
      }
      while (s.printU.length > PRINTS) {
        s.printU.shift()
        s.printS.shift()
      }
      s.lastLug = lug
    }
    const { o, m, c } = tmp
    if (prints.current) {
      for (let i = 0; i < PRINTS; i++) {
        const has = i < s.printU.length
        const sl = has ? s.printS[i] : 0
        const x = has ? s.printU[i] - s.ground : 1e3
        const smear = 1 + 7 * sl
        for (const side of [-1, 1]) {
          o.position.set(x + (side > 0 ? 0.5 : 0) * ((2 * PI * R) / lugN) * (1 - sl), 0.004, side * g.hw * 0.48)
          o.rotation.set(0, -side * (PI / 4), 0)
          o.scale.set(armLen, 1, 0.045)
          o.updateMatrix()
          m.makeScale(smear, 1, 1)
          m.multiply(o.matrix)
          m.setPosition(o.position.x, o.position.y, o.position.z)
          const idx = 2 * i + (side > 0 ? 1 : 0)
          prints.current.setMatrixAt(idx, has && x < 0.1 ? m : tmp.s.makeScale(0, 0, 0))
          // too heavy (no slip): sharp dark prints; correct: pattern visible; too light: wiped out
          c.set(sl < 0.1 ? '#20160f' : sl <= 0.15 ? '#33251a' : '#4e3a29')
          prints.current.setColorAt(idx, c)
        }
      }
      prints.current.instanceMatrix.needsUpdate = true
      if (prints.current.instanceColor) prints.current.instanceColor.needsUpdate = true
    }
    if (marks.current && ticks.current) {
      for (let i = 0; i < MARKS; i++) {
        const has = i < s.marksU.length
        o.position.set(has ? s.marksU[i] - s.ground : 1e3, 0.006, 0)
        o.rotation.set(0, 0, 0)
        o.scale.set(1, 1, 1)
        o.updateMatrix()
        marks.current.setMatrixAt(i, o.matrix)
        // where the mark would come down with no slip
        const tk = s.startGround + i * 2 * PI * R - s.ground
        o.position.set(!s.waiting && i <= Math.min(10, Math.ceil(live.revs)) ? tk : 1e3, 0.005, -g.W * 0.75)
        o.updateMatrix()
        ticks.current.setMatrixAt(i, o.matrix)
      }
      marks.current.instanceMatrix.needsUpdate = true
      ticks.current.instanceMatrix.needsUpdate = true
    }
  })

  const nFront = Math.min(14, Math.ceil(d.frontAddKg / 40))
  const mixText = MIXES[st.mix].text

  return (
    <group>
      <Part id="wheel" name={`Rear drive wheel ${d.size.code}`} role="static" material="rubber" info={{ summary: `${d.size.code} R-1 drive tyre on its rim, ${Math.round(st.fill * 100)} % liquid ballast and ${st.weights} cast-iron weight${st.weights === 1 ? '' : 's'}.`, role: 'Tyres develop pull in relation to the weight on them; ballast adds weight for traction, but weight also compacts soil and raises rolling resistance — there is an optimum.' }} cites={[TT('p8 — why ballast?')]}>
        <group position={[0, axleY, 0]}>
          <group ref={wheel}>
            <group rotation={[PI / 2, 0, 0]}>
              <Part id="tyre" name="Tyre (R-1)" material="rubber" role="static" info={{ summary: 'Bias-ply R-1 drive tyre, cut to show the ballast inside.', role: 'The V of the tread points down seen from the front (forward rotation).' }} cites={[TT('p2–5')]}>
                {g.layers.map((l) => (
                  <PartMesh key={l.id} geometry={l.geo} material={LAYER_MAT[l.kind]} />
                ))}
                {g.lugs ? <PartMesh geometry={g.lugs} /> : null}
                <PartMesh geometry={g.beads} material="steelDark" />
              </Part>
              <Part id="rim" name="Rim & wheel disc" material="paintGrey" role="housing" info={{ summary: 'Rim and dished wheel centre.' }} cites={[TTS('p13–17')]}>
                <PartMesh geometry={g.rim} />
              </Part>
              <Part id="valve" name="Valve" material="brass" role="static" cut={false} info={{ summary: 'Valve stem.', role: 'Fill to 75 % — water up to the valve with the valve at the top. Check pressure with a liquid-type gauge with the valve at the bottom, or add about ½ psi per foot of liquid above the gauge.' }} cites={[TT('p7'), TT('p12, Fig 20')]}>
                <PartMesh geometry={g.valve} />
              </Part>
              <Part id="weights" name="Cast-iron wheel weights" material="castIron" role="static" info={{ summary: `${st.weights} × ≈40 kg cast-iron discs per wheel (${d.castKg} kg on the axle).`, role: 'Removable ballast bolted to the wheel centre: quick to add or take off and makes puncture repair easier. Usually 2–3 per wheel.', details: 'Average wheel weights are 40–140 lb. Usual practice: liquid first, then cast iron as required.' }} cites={[TTS('p15 — weights'), TT('p11–12, Fig 19')]} explode={[0, 0.3, 0]}>
                {Array.from({ length: st.weights }, (_, i) => (
                  <PartMesh key={i} geometry={parts.weight} position={[0, 0.1 + 0.031 * i, 0]} />
                ))}
              </Part>
              <Part id="chalk" name="Chalk mark" material="paintYellow" role="static" cut={false} info={{ summary: 'Chalk reference mark on the side of the tyre.', role: 'Slip test: mark the ground where the chalk mark comes down, count 10 loaded revolutions and mark again; then pull the tractor back over the same distance without load and count the revolutions.' }} cites={[TT('p9–10')]}>
                <PartMesh geometry={parts.chalk} position={[0, g.hw * 0.93, g.rimR + 0.62 * (R - g.rimR)]} />
              </Part>
            </group>
          </group>
          <group ref={liquidRef}>
            {liquid ? (
              <Part id="liquid" name="Liquid ballast" material="water" role="fluid" info={{ summary: `${Math.round(st.fill * 100)} % fill: ${d.liquid.waterL.toFixed(0)} L water + ${d.liquid.saltKg.toFixed(0)} kg CaCl₂ = ${d.liquid.massKg.toFixed(0)} kg per tyre.`, role: 'Water with calcium chloride: cheap weight that also reduces bounce. It stays at the bottom as the wheel turns.', details: mixText }} cites={[TT('p12–13, Fig 20'), TTS('p15')]}>
                <PartMesh geometry={liquid} castShadow={false} />
              </Part>
            ) : null}
            {air ? (
              <Part id="air" name="Air cushion" material="glass" role="fluid" info={{ summary: 'Compressed air above the liquid.', role: 'Air compresses like a cushion; water cannot be compressed. Without this air chamber a 100 % filled tyre cannot absorb shocks and has little bruise resistance — so fill only 75 % (valve level).', details: 'The small air space means the pressure must be checked more often.' }} cites={[TT('p12, Fig 20'), TTS('p15')]}>
                <PartMesh geometry={air} castShadow={false} />
              </Part>
            ) : null}
          </group>
        </group>
      </Part>

      <Part id="prints" name="Tread marks in the soil" role="static" cut={false} material="soil" info={{ summary: d.verdict === 'remove ballast' ? 'Too much weight: sharp, distinct marks with no sign of slip.' : d.verdict === 'add ballast' ? 'Too little weight: the tread marks are wiped out and progress slows.' : 'Proper weight: soil between the cleats is shifted but the pattern is still visible.', role: 'Judge traction from the marks after pulling under load. 10–15 % slip is ideal.', details: `Current slip ${(d.slip * 100).toFixed(1)} %.` }} cites={[TT('p7–8, Fig 11'), BAL('p3')]}>
        <instancedMesh ref={prints} args={[parts.arm, printMat, 2 * PRINTS]} frustumCulled={false} receiveShadow />
        <instancedMesh ref={marks} args={[parts.mark, markMat, MARKS]} frustumCulled={false} />
        <instancedMesh ref={ticks} args={[parts.mark, tickMat, MARKS]} frustumCulled={false} />
      </Part>
      <Part id="soil" name="Field soil" material="soil" role="static" cut={false} info={{ summary: `${st.soil === 'firm' ? 'Firm' : 'Tilled (loose)'} soil.`, role: 'More weight is needed on loose or tilled soil than on a firm surface for the same speed and power.' }} cites={[TT('p8, Fig 12')]}>
        <PartMesh geometry={parts.soil} position={[0, -0.1, 0]} />
      </Part>

      <Part id="front-weights" name={`Front weights (${nFront} × 40 kg)`} material="castIron" role="static" cut={false} info={{ summary: `2WD front ballast: ${st.implement === 'towed' ? '⅓' : '½'} of the rear weight = ${d.frontNeedKg.toFixed(0)} kg; add ≈ ${d.frontAddKg.toFixed(0)} kg to the ${st.baseFront} kg front axle.`, role: 'On two-wheel-drive tractors front ballast adds stability and safety, not traction: ½ the rear weight for integral or semi-integral implements, ⅓ for towed equipment.', details: 'Shown as suitcase weights on a front weight support; front wheel weights are 30–40 kg each and a 45 kW tractor may carry about 200 kg in a weight tray.' }} cites={[TT('p10 — front ballast'), TT('p12, Fig 21'), TTS('p15')]}>
        <group position={[R + 1.15, 0.55, 0]}>
          <PartMesh geometry={parts.support} material="paintGreen" />
          {Array.from({ length: nFront }, (_, i) => (
            <PartMesh key={i} geometry={parts.suitcase} position={[0, -0.14, (i - (nFront - 1) / 2) * 0.066]} />
          ))}
        </group>
      </Part>

      <PartLabel partId="liquid" at={[0.25, axleY - R * 0.62, 0.05]} />
      <PartLabel partId="air" at={[-0.2, axleY + R * 0.78, 0.05]} />
      <PartLabel partId="weights" at={[0.05, axleY + 0.2, 0.2]} />
      <PartLabel partId="valve" at={[g.rimR, axleY + 0.05, 0.05]} />
      <PartLabel partId="prints" at={[-1.4, 0.02, 0.3]} />
      <PartLabel partId="front-weights" at={[R + 1.15, 0.75, 0.3]} />
      <PartLabel partId="tyre" at={[-R * 0.75, axleY + R * 0.7, g.hw]} />
    </group>
  )
}
