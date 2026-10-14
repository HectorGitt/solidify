import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { box, merge, mat4, xform } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { PROFILES, stampRun } from '@/render/soil'
import { createTractorPose, type TractorPose } from '@/tractor/Tractor'
import { FieldGround, FieldRun, makeSoil } from '../_shared/field'
import { bar, chainMat, chiselShank, cultivatorTine, headstockGeometry, plateXY, ridgerBody, rod, rotavatorRotor, shovel, spike, sweepBlade, thickSurface } from '@/parts/lib/implements'
import { PtoDriveline } from '../_appkit/three'
import { C, H, RAISED, ROTOR_R, TOOLS, cultOf, live, useCult, type Tool } from './model'

/** x of the soil-working line in the hitch frame, per tool (where the soil is stamped) */
const WORK_X: Record<Tool, number> = { rigid: -0.95, spring: -0.95, spike: -1.5, chain: -1.6, rotavator: -0.95, ridger: -0.8, chisel: -0.7, subsoiler: -0.75 }
export const HOLD_X = 1.5

const INFO: Record<Tool, { summary: string; role: string; details?: string }> = {
  rigid: { summary: 'Rigid-tine cultivator.', role: 'Secondary tillage: stiff tines carrying shovels or sweeps break and stir the soil and pull out weeds. Tines are staggered in two rows so clods and trash pass between them; points are reversible.', details: 'Depth is set by the shovel position, top-link pitch, a land wheel or the hydraulics.' },
  spring: { summary: 'Spring-tine cultivator.', role: 'Each tine is a coil or S-shaped spring that vibrates and yields over stones (shock absorbing). Works shallower than a rigid tine.' },
  spike: { summary: 'Spike-tooth harrow.', role: 'Rows of spikes in a rigid frame, dragged over ploughed ground to break clods, level the surface and kill small weeds.', details: 'Construction shown is typical.' },
  chain: { summary: 'Chain harrow.', role: 'A flexible mat of linked rings that follows the ground: levels, spreads dung and breaks a light crust.', details: 'Construction shown is typical.' },
  rotavator: { summary: 'Rotary cultivator (rotavator).', role: 'PTO-driven rotor of L-blades that chops the soil into a fine tilth in one pass. Each blade takes a bite whose length depends on forward speed and rotor speed.', details: 'L-blades, hood and chain side-drive are typical.' },
  ridger: { summary: 'Ridger.', role: 'Double mouldboard bodies (or two opposed discs) on a toolbar throw soil both ways, leaving ridges for planting, earthing up or ridge-till.', details: 'A disc ridger carries two opposed discs on adjustable standards on a toolbar.' },
  chisel: { summary: 'Chisel plough.', role: 'Deep, narrow, heavy tines that shatter and loosen the soil without turning it — a conservation-tillage tool that leaves residue on the surface.' },
  subsoiler: { summary: 'Subsoiler.', role: 'One or two very heavy shanks working below plough depth to break a hard pan and improve drainage and rooting.' },
}

const cite = [C.am('§12–12.7 primary and secondary tillage'), C.bush('p5–7 tillage implements')]

function toolGeo(tool: Tool, spacing: number, blades: number) {
  const fl = -H
  const g: Record<string, THREE.BufferGeometry> = {}
  const head = headstockGeometry()
  if (tool === 'rigid' || tool === 'spring') {
    const n = 7
    const W = TOOLS[tool].width
    const shanks: THREE.BufferGeometry[] = []
    const pts: THREE.BufferGeometry[] = []
    for (let i = 0; i < n; i++) {
      const z = -W / 2 + W / (2 * n) + (i * W) / n
      const x = i % 2 ? -0.75 : -0.35
      const { shank, tip } = cultivatorTine({ x, z, floor: fl, kind: tool })
      shanks.push(shank)
      pts.push(xform(tool === 'rigid' ? shovel(0.06, 0.16) : sweepBlade(0.18, 0.06, 0.05), mat4.t(tip[0] + 0.02, tip[1], tip[2])))
    }
    g.frame = merge(head, bar([0.05, 0.1, -W / 2], [0.05, 0.1, W / 2], 0.07, 0.07), bar([-0.35, 0.1, -W / 2], [-0.35, 0.1, W / 2], 0.07, 0.07), bar([-0.75, 0.1, -W / 2], [-0.75, 0.1, W / 2], 0.07, 0.07), bar([0.05, 0.1, -0.5], [-0.75, 0.1, -0.5], 0.07, 0.07), bar([0.05, 0.1, 0.5], [-0.75, 0.1, 0.5], 0.07, 0.07), bar([0, 0.6, 0], [-0.4, 0.1, 0], 0.05, 0.05))
    g.tines = merge(...shanks)
    g.points = merge(...pts)
  } else if (tool === 'spike') {
    const W = TOOLS.spike.width
    const sp: THREE.BufferGeometry[] = []
    const s = spike(0.12)
    for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) sp.push(xform(s, mat4.t(-1.0 - r * 0.25, fl + 0.12, -W / 2 + 0.1 + i * 0.2 + (r % 2) * 0.1)))
    const bars = [0, 1, 2, 3].map((r) => bar([-1.0 - r * 0.25, fl + 0.14, -W / 2], [-1.0 - r * 0.25, fl + 0.14, W / 2], 0.04, 0.04))
    g.frame = merge(head, bar([0, 0, 0], [-0.9, fl + 0.14, 0], 0.06, 0.06), bar([0, 0.6, 0], [-0.9, fl + 0.14, 0.3], 0.04, 0.04), ...bars, bar([-0.95, fl + 0.14, -W / 2], [-1.8, fl + 0.14, -W / 2], 0.04, 0.04), bar([-0.95, fl + 0.14, W / 2], [-1.8, fl + 0.14, W / 2], 0.04, 0.04))
    g.tines = merge(...sp)
  } else if (tool === 'chain') {
    const W = TOOLS.chain.width
    const mat = chainMat(10, 24, 0.1, 0.008)
    g.tines = xform(mat, mat4.t(-1.0, fl + 0.012, 0))
    g.frame = merge(head, bar([0, 0, 0], [-0.6, 0.0, 0], 0.06, 0.06), bar([-0.6, 0, -W / 2], [-0.6, 0, W / 2], 0.07, 0.07), ...[-1, -0.33, 0.33, 1].map((k) => rod([-0.6, 0, (k * W) / 2], [-1.0, fl + 0.02, (k * W) / 2], 0.006, 6)))
  } else if (tool === 'rotavator') {
    const W = TOOLS.rotavator.width
    const ax = WORK_X.rotavator
    const ay = fl + ROTOR_R
    g.frame = merge(
      head,
      thickSurface((u, v) => new THREE.Vector3(ax + 0.33 * Math.cos(Math.PI * (0.05 + 0.85 * v)), ay + 0.33 * Math.sin(Math.PI * (0.05 + 0.85 * v)), -W / 2 + u * W), 1, 16, 0.006),
      plateXY([[ax - 0.35, ay - 0.05], [ax + 0.35, ay - 0.05], [ax + 0.35, ay + 0.35], [ax - 0.35, ay + 0.35]], 0.012, W / 2 + 0.01),
      plateXY([[ax - 0.35, ay - 0.05], [ax + 0.35, ay - 0.05], [ax + 0.35, ay + 0.35], [ax - 0.35, ay + 0.35]], 0.012, -W / 2 - 0.01),
      bar([0, 0, 0], [ax, ay + 0.36, 0], 0.08, 0.08),
      bar([0, 0.6, 0], [ax, ay + 0.36, 0.2], 0.05, 0.05),
    )
    const gb = box(0.25, 0.22, 0.22)
    gb.translate(ax + 0.05, ay + 0.47, 0)
    const side = box(0.12, ay + 0.5 - ay, 0.08)
    side.translate(ax, ay + 0.2, W / 2 + 0.06)
    g.drive = merge(gb, side, bar([ax + 0.05, ay + 0.47, 0], [ax + 0.05, ay + 0.47, W / 2 + 0.06], 0.06, 0.06))
    g.flap = thickSurface((u, v) => new THREE.Vector3(ax - 0.33 - v * 0.25, ay + 0.0 - v * 0.2, -W / 2 + u * W), 1, 4, 0.006)
    g.rotor = rotavatorRotor({ width: W, R: ROTOR_R, blades })
  } else if (tool === 'ridger') {
    const body = ridgerBody()
    g.tines = merge(...[-1, 0, 1].map((k) => xform(body, mat4.t(-0.6, fl, k * spacing))))
    const W = 3 * spacing
    g.frame = merge(head, bar([-0.55, 0.1, -W / 2], [-0.55, 0.1, W / 2], 0.08, 0.08), bar([0, 0.6, 0], [-0.55, 0.1, 0], 0.05, 0.05), bar([0, 0, 0.3], [-0.55, 0.1, 0.3], 0.05, 0.05), bar([0, 0, -0.3], [-0.55, 0.1, -0.3], 0.05, 0.05), ...[-1, 0, 1].map((k) => bar([-0.55, 0.1, k * spacing], [-0.75, fl + 0.2, k * spacing], 0.03, 0.07)))
  } else {
    const sub = tool === 'subsoiler'
    const zs = sub ? [-0.3, 0.3] : [-0.8, -0.4, 0, 0.4, 0.8]
    const sh: THREE.BufferGeometry[] = []
    for (const z of zs) sh.push(chiselShank(sub ? -0.45 : -0.4, z, fl, sub))
    g.tines = merge(...sh)
    g.frame = merge(head, bar([-0.4, 0.12, sub ? -0.55 : -1.0], [-0.4, 0.12, sub ? 0.55 : 1.0], 0.1, 0.1), bar([0, 0.6, 0], [-0.4, 0.12, 0], 0.06, 0.06), bar([0, 0, 0.4], [-0.4, 0.12, 0.4], 0.06, 0.06), bar([0, 0, -0.4], [-0.4, 0.12, -0.4], 0.06, 0.06))
  }
  return g
}

function Implement({ pose, rotor }: { pose: TractorPose; rotor: React.MutableRefObject<THREE.Group | null> }) {
  const st = useCult()
  const G = useMemo(() => toolGeo(st.tool, st.ridgeSpacing, st.blades), [st.tool, st.ridgeSpacing, st.blades])
  const info = INFO[st.tool]
  const ax = WORK_X.rotavator
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3([new THREE.Vector3(ax + 0.15, -H + 0.04, 0.2), new THREE.Vector3(ax - 0.05, -H + 0.3, 0.1), new THREE.Vector3(ax - 0.3, -H + 0.25, -0.1), new THREE.Vector3(ax - 0.5, -H + 0.04, -0.2)]),
    [ax],
  )
  return (
    <Part id="implement" name={TOOLS[st.tool].label} material={st.tool === 'rotavator' ? 'paintOrange' : 'paintBlue'} info={info} cites={cite}>
      <Part id="frame" name="Frame & headstock" info={{ summary: 'Toolbar frame and three-point headstock.', role: 'Carries the working tools at a set spacing and attaches to the lower links and top link.' }} cites={cite}>
        <PartMesh geometry={G.frame} />
      </Part>
      {G.tines ? (
        <Part id="tools" name={st.tool === 'ridger' ? 'Ridger bodies' : st.tool === 'chain' ? 'Chain mat' : st.tool === 'spike' ? 'Spikes' : 'Tines'} material={st.tool === 'spring' ? 'steel' : 'steelDark'} info={info} cites={cite}>
          <PartMesh geometry={G.tines} />
          {G.points ? <PartMesh geometry={G.points} material="forged" /> : null}
        </Part>
      ) : null}
      {st.tool === 'rotavator' ? (
        <>
          <Part id="drive" name="Gearbox & side chain drive" material="castIron" info={{ summary: 'Bevel gearbox and side chain case.', role: 'Turn the PTO drive through 90° and reduce it to rotor speed.' }} cites={[C.bush('p5 rotary cultivators')]} beyondNotes>
            <PartMesh geometry={G.drive} />
            <PartMesh geometry={G.flap} material="paintOrange" />
          </Part>
          <PtoDriveline id="pto-shaft" from={[0.75, 0.15, 0]} to={[ax + 0.18, -H + ROTOR_R + 0.47, 0]} angle={() => pose.ptoAngle} />
          <Part id="rotor" name="Rotor with L-blades" role="moving" material="forged" info={{ summary: 'Rotor with L-blades.', role: 'Flanges carry L-blades bent alternately left and right; they slice bites off the soil and throw them against the hood.' }} cites={[C.bush('p5 rotary cultivators')]} beyondNotes>
            <group position={[ax, -H + ROTOR_R, 0]} ref={rotor}>
              <PartMesh geometry={G.rotor} />
            </group>
          </Part>
          <Flow curve={curve} count={40} radius={0.018} color="#5a3d26" emissive={0.05} intensity={() => live.lowered} speed={1.6} spread={1.4} />
        </>
      ) : null}
    </Part>
  )
}

const FIELD = { length: 18, width: 4, cell: 0.04 }

export function Scene3D() {
  const st = useCult()
  const grid = useMemo(() => makeSoil(FIELD), [])
  const pose = useMemo(() => createTractorPose({ hitchHeight: RAISED }), [])
  const rotor = useRef<THREE.Group | null>(null)
  const prev = useRef<number | null>(null)
  const X = useRef(0)
  return (
    <group>
      <Part id="field" name="Field soil" role="static" material="soil" info={{ summary: 'Field soil.', role: 'Each tool leaves its own mark: stirred tilth, tine slots, ridges or a fine rotavated seedbed.' }} cites={[C.bush('p4–7 tillage types')]} cut>
        <FieldGround grid={grid} />
      </Part>
      <FieldRun
        key={st.tool}
        grid={grid}
        pose={pose}
        start={-3}
        end={7.5}
        speed={() => (useCult.getState().hold && X.current >= HOLD_X ? 0 : useCult.getState().speed / 3.6)}
        hitchWork={() => H - useCult.getState().depth}
        hitchRaised={RAISED}
        ptoRpm={() => (useCult.getState().tool === 'rotavator' ? 540 : 0)}
        onReset={() => {
          prev.current = null
          live.area = 0
        }}
        onStep={(c) => {
          const p = useCult.getState()
          X.current = c.X
          live.lowered = c.lowered
          if (rotor.current && p.tool === 'rotavator') rotor.current.rotation.z -= (p.rotorRpm * 2 * Math.PI * c.dt) / 60
          if (c.lowered < 0.15 || c.dx <= 0) {
            prev.current = null
            return
          }
          const d = Math.min(p.depth, Math.max(0, H - c.hitchY))
          const x = c.hitchX + WORK_X[p.tool] - 0.1
          const x0 = prev.current ?? x
          if (prev.current !== null && x - x0 < grid.cell) return
          prev.current = x
          const r = cultOf(p)
          const W = r.W
          live.area += (x - x0) * W
          switch (p.tool) {
            case 'rigid':
            case 'spring': {
              stampRun(grid, x0, x, 0, W / 2, PROFILES.tilth(d * 0.35, 0.15), { blend: 0.7 })
              for (let i = 0; i < 7; i++) stampRun(grid, x0, x, -W / 2 + W / 14 + (i * W) / 7, 0.1, PROFILES.slot(d * 0.6, 0.06), { blend: 0.8 })
              break
            }
            case 'spike':
              stampRun(grid, x0, x, 0, W / 2, PROFILES.tilth(d * 0.4, 0.1), { blend: 0.6 })
              break
            case 'chain':
              stampRun(grid, x0, x, 0, W / 2, PROFILES.tilth(d, 0.08), { blend: 0.4, disturb: 0.5 })
              break
            case 'rotavator':
              stampRun(grid, x0, x, 0, W / 2, PROFILES.tilth(d * 0.25, 0.05))
              break
            case 'ridger':
              for (let k = -2; k <= 1; k++) stampRun(grid, x0, x, (k + 0.5) * p.ridgeSpacing, p.ridgeSpacing / 2, PROFILES.ridge(d * 0.9, p.ridgeSpacing))
              break
            default:
              for (const z of p.tool === 'subsoiler' ? [-0.3, 0.3] : [-0.8, -0.4, 0, 0.4, 0.8]) stampRun(grid, x0, x, z, 0.15, PROFILES.slot(Math.min(d, 0.25) * 0.6, 0.08))
          }
        }}
        mounted={<Implement pose={pose} rotor={rotor} />}
      />
      <PartLabel partId="implement" at={[HOLD_X - 1.8, 1.0, 1.4]} />
    </group>
  )
}
