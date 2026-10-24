import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, merge } from '@/geometry'
import { bar, coulterDisc, coulterShank, hash, headstock, jointer, mouldboardBottom } from '@/parts/lib/implements'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { PROFILES, createSoil, stampRun, type SoilGrid } from '@/render/soil'
import { SoilSurface } from '@/render/SoilSurface'
import { TRACTOR } from '@/tractor/dims'
import { createTractorPose } from '@/tractor/Tractor'
import { FieldGround, FieldRun, makeSoil, mirror } from '../_shared/field'
import { freshSoil, treadmill, type Treadmill } from '../_tillage/soil'
import { LiveTag, Segment } from '../_tillage/three'
import { BEAM_Y, C, HS, RAISED, bottomX, draftOf, landsideZ, live, shownSuction, useMb } from './model'

const INFO = {
  plough: {
    summary: 'Three-point-mounted mouldboard plough.',
    role: 'Primary tillage: each bottom cuts a furrow slice, lifts it and turns it over, burying weeds and trash and exposing the soil to the air.',
    details: 'Bottoms are staggered: the front bottom is on the furrow side, the rear one leaves the open furrow the right tyre runs in next pass.',
  },
  share: {
    summary: 'Share (point, wing, cutting edge).',
    role: 'Cuts the furrow slice horizontally and starts lifting it. The point is bent down and towards the land (vertical and horizontal suction) so the bottom is drawn into and held in the ground.',
    details: 'Types: bar point, shin, slip and slip-nose shares. Suction clearances 0.48–1.25 cm.',
  },
  board: { summary: 'Mouldboard.', role: 'Curved plate behind the share that lifts, turns and inverts the furrow slice. Stubble boards are short and steep; general-purpose boards are longer; slatted boards shed sticky soil.' },
  landside: { summary: 'Landside with detachable heel.', role: 'Flat plate pressing against the furrow wall; it resists the side thrust of the slice on the mouldboard and steadies the bottom. The heel wears and is replaceable.' },
  frog: { summary: 'Frog.', role: 'The casting the share, mouldboard and landside are bolted to.' },
  standard: { summary: 'Standard (leg).', role: 'Connects the frog to the beam.' },
  beam: { summary: 'Beam (frame) and headstock.', role: 'Carries the bottoms and attaches to the three-point linkage: lower links on the cross shaft, top link on the mast.' },
  coulter: { summary: 'Disc coulter.', role: 'Rolling disc that cuts the furrow wall vertically ahead of the shin, through trash and roots, so the slice comes away cleanly. Its centre is set just behind the share point.' },
  jointer: { summary: 'Jointer.', role: 'A miniature mouldboard that skims the top corner of the slice and throws trash into the furrow bottom so it is buried completely.' },
  slice: { summary: 'Furrow slice.', role: 'The w × d strip of soil cut by the share. It slides up the mouldboard, turns about its furrow-side edge and comes to rest leaning on the previous slice.' },
  field: { summary: 'Field soil.', role: 'The plough leaves turned slices and one open furrow; the right rear tyre runs in the open furrow on the next pass.' },
}

const cites = {
  parts: [C.am('§12 mouldboard plough parts'), C.guide1819('labelled mouldboard bottom sketch')],
  draft: [C.am('§12 hitching the plough: centre of draft, centre of power, line of draft')],
}

function usePloughGeo() {
  const st = useMb()
  return useMemo(() => {
    const vs = shownSuction(st.vSuction, st.exaggerate)
    const hs = shownSuction(st.hSuction, st.exaggerate)
    const b = mouldboardBottom(st.width, st.depth, st.board, vs, hs, HS + BEAM_Y)
    const n = st.bottoms
    const pts = Array.from({ length: n }, (_, i) => [bottomX(i) - 0.5, landsideZ(i, st.width) - 0.07] as const)
    const f = pts[0]
    const l = pts[n - 1]
    const ext = 0.35
    const dx = l[0] - f[0] || -1
    const dz = l[1] - f[1]
    const len = Math.hypot(dx, dz) || 1
    const beam = bar([f[0] - (dx / len) * ext + 0.3, BEAM_Y, f[1] - (dz / len) * ext], [l[0] + (dx / len) * 0.15, BEAM_Y, l[1] + (dz / len) * 0.15], 0.07, 0.1)
    // headstock: cross shaft between the lower pins, two mast plates up to the top-link pin, brace to the beam
    const { cross, mast } = headstock({ plateZ: 0.08 })
    const tie = merge(bar([0, 0.05, -0.3], [f[0] + 0.3, BEAM_Y, f[1]], 0.05, 0.05), bar([0, 0.05, 0.3], [f[0] + 0.3, BEAM_Y, f[1]], 0.05, 0.05), bar([-0.02, 0.6, 0], [f[0] + 0.1, BEAM_Y, (f[1] + l[1]) / 2], 0.05, 0.05))
    const coulter = coulterDisc(0.2)
    const shank = coulterShank([0.0, 0.24, 0.01], [0.05, HS + BEAM_Y - 0.03, 0.01])
    // jointer: small twisted plate skimming the top corner of the slice (drawn at the surface)
    return { b, beam, cross, mast, tie, coulter, shank, jointer: jointer(HS + BEAM_Y - st.depth) }
  }, [st.width, st.depth, st.board, st.vSuction, st.hSuction, st.exaggerate, st.bottoms])
}

/** The plough in the hitch frame (origin at the lower hitch balls; furrow floor HS below). */
function Plough({ coulters }: { coulters: React.MutableRefObject<(THREE.Group | null)[]> }) {
  const st = useMb()
  const G = usePloughGeo()
  return (
    <Part id="plough" name="Mouldboard plough" material="paintBlue" info={INFO.plough} cites={cites.parts}>
      <Part id="beam" name="Beam & headstock" info={INFO.beam} cites={cites.parts}>
        <PartMesh geometry={G.beam} />
        <PartMesh geometry={G.cross} material="forged" />
        <PartMesh geometry={G.mast} />
        <PartMesh geometry={G.tie} />
      </Part>
      {Array.from({ length: st.bottoms }, (_, i) => (
        <group key={i} position={[bottomX(i), -HS, landsideZ(i, st.width)]}>
          <Part id={`bottom-${i}`} name={`Bottom ${i + 1}${i === 0 ? ' (front)' : i === st.bottoms - 1 ? ' (rear)' : ''}`} material="steel" info={INFO.plough} cites={cites.parts}>
            <Part id={`share-${i}`} name="Share" material="forged" info={INFO.share} cites={cites.parts}>
              <PartMesh geometry={G.b.share} />
            </Part>
            <Part id={`board-${i}`} name="Mouldboard" material="paintBlue" info={INFO.board} cites={cites.parts}>
              <PartMesh geometry={G.b.board} />
              <PartMesh geometry={G.b.shin} material="forged" />
            </Part>
            <Part id={`landside-${i}`} name="Landside & heel" material="steelDark" info={INFO.landside} cites={cites.parts}>
              <PartMesh geometry={G.b.landside} />
              <PartMesh geometry={G.b.heel} material="forged" />
            </Part>
            <Part id={`frog-${i}`} name="Frog" material="castIron" info={INFO.frog} cites={cites.parts}>
              <PartMesh geometry={G.b.frog} />
            </Part>
            <Part id={`standard-${i}`} name="Standard" material="paintBlue" info={INFO.standard} cites={cites.parts}>
              <PartMesh geometry={G.b.standard} />
            </Part>
            <Part id={`coulter-${i}`} name="Disc coulter" role="moving" material="steel" info={INFO.coulter} cites={[C.am('§12 attachments: coulter')]}>
              <PartMesh geometry={G.shank} material="paintBlue" />
              <group position={[0, 0.24, 0.01]}>
                <group ref={(el) => void (coulters.current[i] = el)}>
                  <PartMesh geometry={G.coulter} />
                </group>
              </group>
            </Part>
            <Part id={`jointer-${i}`} name="Jointer" material="steel" info={INFO.jointer} cites={[C.am('§12 attachments: jointer')]}>
              <group position={[0.22, st.depth, 0]}>
                <PartMesh geometry={G.jointer} />
              </group>
            </Part>
            <Part id={`slice-${i}`} name="Furrow slice" role="fluid" material="soil" info={INFO.slice} cites={[C.am('§12 the furrow slice cut and inverted')]} cut={false}>
              <PartMesh geometry={G.b.slice} />
              <Flow curve={G.b.sliceCurve} count={26} radius={0.022} color="#5a3d26" emissive={0.05} intensity={() => live.lowered} speed={0.55} spread={0.05} />
            </Part>
          </Part>
        </group>
      ))}
    </Part>
  )
}

const FIELD = { length: 18, width: 4, cell: 0.04 }

function FieldView() {
  const grid = useMemo(() => makeSoil(FIELD), [])
  const pose = useMemo(() => createTractorPose({ hitchHeight: RAISED }), [])
  const coulters = useRef<(THREE.Group | null)[]>([])
  const prev = useRef<number[]>([])
  const cdA = useMemo(() => new THREE.Vector3(), [])
  useSimFrame((dt) => {
    for (const c of coulters.current) if (c && dt > 0) c.rotation.z -= ((useMb.getState().speed / 3.6) * dt) / 0.2
  })
  return (
    <group>
      <Part id="field" name="Field soil" role="static" material="soil" info={INFO.field} cites={[C.bush('p4–7 primary tillage')]} cut>
        <FieldGround grid={grid} />
      </Part>
      <FieldRun
        grid={grid}
        pose={pose}
        start={-3}
        end={7.5}
        speed={() => useMb.getState().speed / 3.6}
        hitchWork={() => HS - useMb.getState().depth}
        hitchRaised={RAISED}
        onReset={() => {
          prev.current = []
          live.area = 0
          live.passes++
        }}
        onStep={(c) => {
          const p = useMb.getState()
          live.X = c.X
          live.lowered = c.lowered
          live.hitchY = c.hitchY
          const d = Math.min(p.depth, Math.max(0, HS - c.hitchY))
          if (c.lowered < 0.15 || c.dx <= 0) {
            prev.current = []
            return
          }
          for (let i = 0; i < p.bottoms; i++) {
            const x = c.hitchX + bottomX(i) - 0.95
            const x0 = prev.current[i] ?? x
            if (x - x0 < grid.cell && prev.current[i] !== undefined) continue
            prev.current[i] = x
            const zc = landsideZ(i, p.width) - p.width / 2
            const base = mirror(PROFILES.mouldboard(d, p.width))
            const lump = 0.75 + 0.5 * hash(x * 7.3 + i)
            stampRun(grid, x0, x, zc, p.width * 1.9, (dz) => {
              const v = base(dz)
              return v > 0 ? v * lump : v
            })
          }
          live.area += c.dx * p.bottoms * p.width
        }}
        mounted={<Plough coulters={coulters} />}
      />
      {/* centre of power → centre of draft (line of draft), plan view */}
      <Segment
        color="#f5b942"
        radius={0.012}
        onTop
        get={(a, b) => {
          const p = useMb.getState()
          if (!p.showDraft) return false
          const r = draftOf(p)
          a.set(live.X + TRACTOR.drawbar.x, 0.45, 0)
          b.set(live.X - 1.05 + (bottomX(0) + bottomX(p.bottoms - 1)) / 2 - 0.25, 0.05, r.zCD)
          cdA.copy(b)
        }}
      />
      <LiveTag
        get={() => {
          const p = useMb.getState()
          if (!p.showDraft) return null
          const r = draftOf(p)
          return { text: `centre of draft · D = ${(r.D / 1000).toFixed(2)} kN, side offset ${(r.zCD * 100).toFixed(0)} cm`, at: [cdA.x, 0.5, cdA.z] }
        }}
      />
      <LiveTag get={() => (useMb.getState().showDraft ? { text: 'centre of power (mid-drawbar)', at: [live.X + TRACTOR.drawbar.x, 0.85, 0] } : null)} />
    </group>
  )
}

/** One bottom close up; the soil scrolls past it. */
function BottomView() {
  const st = useMb()
  const G = usePloughGeo()
  const grid: SoilGrid = useMemo(() => createSoil(4.4, 1.6, 0.02, -3.2, -1.0), [])
  const mill = useMemo<Treadmill>(() => ({ acc: 0, x: 0 }), [])
  useMemo(() => freshSoil(grid, mill), [grid, mill])
  const coulter = useRef<THREE.Group>(null)
  const unit = useMemo(() => box(1, 1, 1), [])
  useSimFrame((dt) => {
    if (dt <= 0) return
    const p = useMb.getState()
    const v = p.speed / 3.6
    live.lowered = 1
    treadmill(grid, mill, v * dt)
    stampRun(grid, -3.2, G.b.wingX - 0.6, -p.width / 2, p.width * 1.9, mirror(PROFILES.mouldboard(p.depth, p.width)))
    stampRun(grid, G.b.wingX - 0.6, 0.02, -p.width / 2, p.width / 2, () => -p.depth)
    if (coulter.current) coulter.current.rotation.z -= (v * dt) / 0.2
  })
  return (
    <group>
      <Part id="field" name="Field soil" role="static" material="soil" info={INFO.field} cites={[C.bush('p4–7 primary tillage')]} cut>
        <SoilSurface grid={grid} depth={0.45} />
      </Part>
      <group position={[0, -st.depth, 0]}>
        <Part id="share" name="Share" material="forged" info={INFO.share} cites={cites.parts}>
          <PartMesh geometry={G.b.share} />
        </Part>
        <Part id="board" name="Mouldboard" material="paintBlue" info={INFO.board} cites={cites.parts}>
          <PartMesh geometry={G.b.board} />
          <PartMesh geometry={G.b.shin} material="forged" />
        </Part>
        <Part id="landside" name="Landside & heel" material="steelDark" info={INFO.landside} cites={cites.parts}>
          <PartMesh geometry={G.b.landside} />
          <PartMesh geometry={G.b.heel} material="forged" />
        </Part>
        <Part id="frog" name="Frog" material="castIron" info={INFO.frog} cites={cites.parts}>
          <PartMesh geometry={G.b.frog} />
        </Part>
        <Part id="standard" name="Standard & beam" material="paintBlue" info={INFO.standard} cites={cites.parts}>
          <PartMesh geometry={G.b.standard} />
          <PartMesh geometry={unit} position={[-0.5, HS + BEAM_Y, -0.07]} scale={[1.2, 0.1, 0.07]} />
        </Part>
        <Part id="coulter" name="Disc coulter" role="moving" material="steel" info={INFO.coulter} cites={[C.am('§12 attachments: coulter')]}>
          <PartMesh geometry={G.shank} material="paintBlue" />
          <group position={[0, 0.24, 0.01]} ref={coulter}>
            <PartMesh geometry={G.coulter} />
          </group>
        </Part>
        <Part id="jointer" name="Jointer" material="steel" info={INFO.jointer} cites={[C.am('§12 attachments: jointer')]}>
          <group position={[0.22, st.depth, 0]}>
            <PartMesh geometry={G.jointer} />
          </group>
        </Part>
        <Part id="slice" name="Furrow slice" role="fluid" material="soil" info={INFO.slice} cites={[C.am('§12 the furrow slice cut and inverted')]} cut={false}>
          <PartMesh geometry={G.b.slice} />
          <Flow curve={G.b.sliceCurve} count={40} radius={0.02} color="#5a3d26" emissive={0.05} intensity={() => 1} speed={0.45} spread={0.04} />
        </Part>
      </group>
      <PartLabel partId="share" at={[0.1, -st.depth + 0.02, 0.25]} />
      <PartLabel partId="board" at={[-0.6, 0.35, -0.45]} />
      <PartLabel partId="landside" at={[-0.5, -st.depth + 0.05, 0.25]} />
      <PartLabel partId="frog" at={[-0.4, 0.05, 0.2]} />
      <PartLabel partId="coulter" at={[0.05, 0.45, 0.2]} />
      <PartLabel partId="jointer" at={[0.25, 0.15, 0.2]} />
      <PartLabel partId="slice" at={[-1.0, 0.35, -0.6]} />
    </group>
  )
}

export function Scene3D() {
  const mode = useMb((s) => s.mode)
  return mode === 'field' ? <FieldView /> : <BottomView />
}
