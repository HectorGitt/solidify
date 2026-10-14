import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, lathe, mat4, merge, tube, xform } from '@/geometry'
import { hopper as hopperG, legStand, manualScrewPress, raspDrum, rotaryDrum, tray } from '@/parts/lib/processing'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { CITE } from './cites'
import { calcGarriMassBalance, live, useGarri } from './model'

const { PI } = Math
/** station pitch along the line (m) */
export const X = { peel: -6.4, wash: -4.8, grate: -3.2, press: -1.6, sieve: 0, fry: 1.7, cool: 3.4, sift: 4.9, bag: 6.4 }

type V3 = [number, number, number]

/** A group that turns about one axis at a rate (rad/s) read every frame. */
function Spin({ axis, rate, children, ...rest }: { axis: 'x' | 'y' | 'z'; rate: () => number; children: ReactNode; position?: V3; rotation?: V3 }) {
  const g = useRef<THREE.Group>(null)
  useSimFrame((dt) => {
    if (g.current) g.current.rotation[axis] += rate() * dt
  })
  return (
    <group {...rest}>
      <group ref={g}>{children}</group>
    </group>
  )
}

/** Material particles along a polyline through the machines. */
function Stream({ pts, color, rate, count = 40, radius = 0.018, speed = 0.25 }: { pts: V3[]; color: string; rate: () => number; count?: number; radius?: number; speed?: number }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal'), [pts])
  return <Flow curve={curve} count={count} radius={radius} color={color} intensity={rate} speed={speed} spread={0.06} />
}

const COL = { mash: '#efe6cf', garri: '#e6cf8a', peel: '#6e4325', water: '#3d8fd1', liquor: '#cfd9b0', steam: '#e8eef2', chaff: '#b49a6a' }

const INFO = {
  line: { summary: 'Cassava-to-garri line: peeling, washing, grating, fermenting and dewatering, sieving, frying (garifying), cooling, sifting and bagging.', role: 'Turns fresh cassava roots (≈ 65–70 % water) into a dry, fermented, partly gelatinised granular food at ≤ 12 % moisture.' },
  peeler: { summary: 'Abrasive drum peeler.', role: 'Roots tumble against a rough rotating drum that scrapes the peel off; peels leave as waste or feed.', details: 'Machine form is generic — the flow chart only names the step "peeling and washing".' },
  washer: { summary: 'Rotary drum washer in a water trough.', role: 'The most common wet cleaner: roots rub each other and the drum under water sprays, removing soil and peel scraps.', details: 'Performance depends on drum speed, surface roughness and retention time.' },
  grater: { summary: 'Rasp-drum grater.', role: 'A fast drum studded with rasps tears the roots into a fine wet mash, releasing the enzymes that start cyanide breakdown.' },
  press: { summary: 'Fermentation bags in a screw press.', role: 'The mash ferments in sacks for 2–3 days (lactic acid builds to 0.6–1.0 %), then the screw squeezes out the liquor to a firm cake.', details: 'Fermentation and dewatering are one combined step in the flow chart.' },
  sieve: { summary: 'Disintegrator and granulating sieve.', role: 'Breaks the cake and rubs it through a screen into fine wet grits; fibrous residue stays on top and is dried and milled to flour.' },
  fryer: { summary: 'Mechanised garri fryer (garifier).', role: 'Grits are stirred on a hot pan: water flashes off and the starch partly gelatinises, giving the crisp granules of garri.', details: 'Heat treatment means toasting or grilling, which partially gelatinises the starch and dehydrates the granules.' },
  cooler: { summary: 'Cooling table.', role: 'Hot garri is spread out to cool before sifting, so it does not cake or sweat in the bag.' },
  sifter: { summary: 'Grading sifter.', role: 'Separates uniform garri of the chosen grade from coarse lumps, which are milled and returned.' },
  bagger: { summary: 'Bagging and weighing.', role: 'Garri is packed in clean, sturdy, strongly sewn or sealed sacks.' },
  bins: { summary: 'By-product bins.', role: 'Peels, fibrous residue and coarse lumps collected for feed, flour or reprocessing.' },
}

export function CassavaGarri3D() {
  const p = useGarri()
  const mb = useMemo(() => calcGarriMassBalance(p), [p])

  const g = useMemo(() => {
    const peeler = rotaryDrum({ r: 0.32, t: 0.02, L: 1.0, ribs: 8 })
    const washer = rotaryDrum({ r: 0.26, t: 0.02, L: 1.0, ribs: 8 })
    const press = manualScrewPress()
    const out = {
      floor: box(15.2, 0.06, 2.6),
      drum: peeler.shell,
      drumRibs: peeler.ribs!,
      shaft: xform(cylinder(0.025, 1.3), mat4.rz(PI / 2)),
      legs1: legStand({ x: 0.5, z: 0.3, h: 0.55 }),
      // wash trough big enough to hold the drum and its water
      trough: xform(tray({ w: 1.11, d: 0.81, h: 0.42, wall: 0.03 }), mat4.t(0, 0.3, 0)),
      water: xform(box(1.05, 0.25, 0.75), mat4.t(0, 0.455, 0)),
      hopper: hopperG({ top: 0.45, bottom: 0.11, h: 0.32, wall: 0.02 }),
      graterBox: box(0.6, 0.45, 0.55),
      pressFrame: press.frame,
      screw: press.screw,
      platen: press.platen,
      sacks: merge(...[0, 1, 2, 3].map((i) => xform(box(0.62, 0.12, 0.44), mat4.t(0, 0.18 + i * 0.13, 0)))),
      tray: box(0.7, 0.04, 0.45),
      sieveBox: tray({ w: 0.64, d: 0.64, h: 0.12, wall: 0.03, floor: 0.02 }),
      pan: lathe([[0, 0], [0.62, 0], [0.7, 0.14], [0.67, 0.14], [0.6, 0.025], [0, 0.025]], 48),
      firebox: tube(0.66, 0.58, 0.55, 40),
      paddle: merge(xform(cylinder(0.03, 0.5), mat4.t(0, 0.25, 0)), ...[0, 1, 2].map((i) => xform(box(1.1, 0.06, 0.03), mat4.c(mat4.ry((i * PI) / 3), mat4.t(0, 0.04, 0))))),
      hood: lathe([[0.7, 0], [0.12, 0.5], [0.12, 0.9], [0.09, 0.9], [0.09, 0.52], [0.67, 0]], 32),
      table: box(1.2, 0.05, 0.8),
      garriBed: box(1.0, 0.03, 0.6),
      grain: box(0.5, 0.02, 0.32),
      sack: lathe([[0, 0], [0.2, 0.02], [0.23, 0.3], [0.2, 0.55], [0.1, 0.62], [0, 0.62]], 24),
      scale: box(0.6, 0.12, 0.6),
      bin: lathe([[0, 0], [0.22, 0], [0.25, 0.35], [0.22, 0.35], [0.2, 0.03], [0, 0.03]], 24),
      chute: box(0.5, 0.03, 0.2),
    }
    return { ...out, washDrum: washer.shell, washRibs: washer.ribs!, garriDisc: cylinder(0.58, 0.03, 40), raspZ: raspDrum() }
  }, [])

  // relative stream rates for particle intensity
  const r0 = mb.rootsIn.mass
  const k = (m: number) => () => (live.running ? Math.max(0.15, Math.min(1, (1.4 * m) / r0)) : 0)

  useSimFrame((dt, t) => {
    live.peelerAngle += dt * 3
    live.paddleAngle += dt * 2
    live.sifterVibX = Math.sin(t * 25) * 0.01
    live.steamIntensity = Math.min(1, mb.steamEvaporated / Math.max(1, mb.siftedGrits.mass))
  })

  const sieveRef = useRef<THREE.Group>(null)
  const sifterRef = useRef<THREE.Group>(null)
  const platenRef = useRef<THREE.Group>(null)
  useSimFrame((_, t) => {
    if (sieveRef.current) sieveRef.current.position.x = Math.sin(t * 22) * 0.012
    if (sifterRef.current) sifterRef.current.position.z = Math.sin(t * 25) * 0.012
    if (platenRef.current) platenRef.current.position.y = 0.78 - 0.04 * (0.5 + 0.5 * Math.sin(t * 0.6))
  })

  const yMain = 1.05
  const main: V3[][] = [
    [[X.peel - 0.9, 1.3, 0], [X.peel - 0.5, yMain, 0], [X.peel + 0.5, 0.75, 0], [X.wash - 0.5, 0.9, 0], [X.wash + 0.4, 0.62, 0]],
    [[X.wash + 0.5, 0.9, 0], [X.grate - 0.1, 1.25, 0], [X.grate, 1.05, 0], [X.grate, 0.55, 0], [X.grate + 0.4, 0.35, 0.2]],
    [[X.grate + 0.4, 0.35, 0.2], [X.press - 0.2, 0.6, 0.35], [X.press, 0.62, 0]],
    [[X.press + 0.3, 0.35, 0], [X.sieve - 0.4, 0.95, 0], [X.sieve, 0.85, 0], [X.sieve + 0.3, 0.55, 0]],
    [[X.sieve + 0.3, 0.55, 0], [X.fry - 0.6, 0.95, 0], [X.fry - 0.2, 0.68, 0.1], [X.fry + 0.3, 0.68, -0.1], [X.fry + 0.6, 0.8, 0]],
    [[X.fry + 0.6, 0.8, 0], [X.cool - 0.4, 0.75, 0], [X.cool + 0.4, 0.7, 0]],
    [[X.cool + 0.4, 0.7, 0], [X.sift - 0.3, 1.0, 0], [X.sift + 0.2, 0.8, 0], [X.bag - 0.1, 0.95, 0], [X.bag, 0.5, 0]],
  ]

  return (
    <group>
      <Part id="garri-line" name="Cassava-to-garri line" role="housing" material="concrete" info={INFO.line} cites={[CITE.garriFlow('steps 1–11'), CITE.gstd('§2.1')]}>
        <Part id="floor" name="Processing floor" role="housing" material="concrete" info={{ summary: 'Concrete floor slab.', role: 'Straight-line layout: roots enter at one end, bagged garri leaves at the other.' }} cites={[CITE.hand('Note 4, straight-line layout')]}>
          <PartMesh geometry={g.floor} position={[0, -0.03, 0]} />
        </Part>

        {/* 1 Peeler */}
        <Part id="peeler" name="Drum peeler" role="housing" material="galvanised" info={INFO.peeler} cites={[CITE.garriFlow('peeling and washing')]} beyondNotes position={[X.peel, 0, 0]} explode={[0, 0, -0.6]}>
          <PartMesh geometry={g.legs1} material="paintGrey" />
          <Spin axis="x" rate={() => 3} position={[0, 0.9, 0]}>
            <PartMesh geometry={g.drum} />
            <PartMesh geometry={g.drumRibs} material="steelDark" />
            <PartMesh geometry={g.shaft} material="steel" />
          </Spin>
        </Part>

        {/* 2 Washer */}
        <Part id="washer" name="Rotary drum washer" role="housing" material="paintBlue" info={INFO.washer} cites={[CITE.sep('wet cleaning: rotary drum washer')]} position={[X.wash, 0, 0]} explode={[0, 0, -0.6]}>
          <PartMesh geometry={g.trough} />
          <Part id="wash-water" name="Wash water" role="fluid" material="water" info={{ summary: 'Wash water.', role: 'Carries soil and peel scraps away as effluent.' }}>
            <PartMesh geometry={g.water} />
          </Part>
          <Spin axis="x" rate={() => 2} position={[0, 0.62, 0]}>
            <Part id="wash-drum" name="Washer drum" role="moving" material="galvanised" info={{ summary: 'Perforated washer drum.', role: 'Retention time is set by the drum pitch and speed.' }}>
              <PartMesh geometry={g.washDrum} />
              <PartMesh geometry={g.washRibs} material="steelDark" />
            </Part>
          </Spin>
        </Part>

        {/* 3 Grater */}
        <Part id="grater" name="Rasp-drum grater" role="housing" material="paintGreen" info={INFO.grater} cites={[CITE.garriFlow('grating'), CITE.red('forces in size reduction: shear')]} beyondNotes position={[X.grate, 0, 0]} explode={[0, 0.4, -0.4]}>
          <PartMesh geometry={g.graterBox} position={[0, 0.55, 0]} />
          <PartMesh geometry={g.hopper} position={[0, 0.78, 0]} material="galvanised" />
          <PartMesh geometry={g.legs1} material="paintGrey" scale={[0.6, 0.6, 0.9]} />
          <Spin axis="z" rate={() => (live.graterRpm * 2 * PI) / 60 / 20} position={[0, 0.55, 0]}>
            <Part id="rasp-drum" name="Rasp drum" role="moving" material="steel" info={{ summary: 'Rasp drum, about 1500 rpm.', role: 'Studs tear the root into a fine mash.' }} beyondNotes>
              <PartMesh geometry={g.raspZ} />
            </Part>
          </Spin>
        </Part>

        {/* 4 Fermentation + press */}
        <Part id="press" name="Fermentation bags and screw press" role="housing" material="paintRed" info={INFO.press} cites={[CITE.garriFlow('fermentation and dewatering'), CITE.gstd('§2.1 fermentation, pressing')]} beyondNotes position={[X.press, 0, 0]} explode={[0, 0, -0.6]}>
          <PartMesh geometry={g.pressFrame} />
          <Part id="mash-sacks" name="Fermenting mash in sacks" role="static" material="straw" info={{ summary: 'Sacks of grated mash.', role: 'Lactic fermentation lowers pH and lets the cyanogens break down; the press squeezes out the liquor.' }}>
            <PartMesh geometry={g.sacks} />
          </Part>
          <group ref={platenRef} position={[0, 0.78, 0]}>
            <Part id="press-screw" name="Press screw and platen" role="moving" material="steel" info={{ summary: 'Screw and platen.', role: 'Each turn of the screw presses the platen down on the sacks.' }}>
              <PartMesh geometry={g.platen} />
              <PartMesh geometry={g.screw} position={[0, 0.03, 0]} />
            </Part>
          </group>
        </Part>

        {/* 5 Granulating sieve */}
        <Part id="sieve" name="Granulating sieve" role="housing" material="galvanised" info={INFO.sieve} cites={[CITE.garriFlow('disintegration and sieving'), CITE.sep('screens')]} position={[X.sieve, 0.55, 0]} explode={[0, 0.4, 0]}>
          <PartMesh geometry={g.legs1} material="paintGrey" position={[0, -0.55, 0]} scale={[0.7, 1, 0.8]} />
          <group ref={sieveRef}>
            <PartMesh geometry={g.sieveBox} />
            <Part id="sieve-cake" name="Cake on the screen" role="static" material="ceramic" info={{ summary: 'Broken press cake.', role: 'Rubbed through the mesh into grits; fibre stays on top.' }}>
              <PartMesh geometry={g.grain} position={[0, 0.04, 0]} />
            </Part>
          </group>
        </Part>

        {/* 6 Fryer */}
        <Part id="fryer" name="Garri fryer (garifier)" role="housing" material="steelDark" info={INFO.fryer} cites={[CITE.garriFlow('roasting'), CITE.gstd('§2.1 heat treatment')]} beyondNotes position={[X.fry, 0, 0]} explode={[0, 0.5, 0]}>
          <Part id="firebox" name="Firebox" role="housing" material="concrete" info={{ summary: 'Firebox under the pan.', role: 'Supplies the heat to evaporate the water and gelatinise the starch.' }}>
            <PartMesh geometry={g.firebox} position={[0, 0.27, 0]} />
          </Part>
          <PartMesh geometry={g.pan} position={[0, 0.55, 0]} />
          <Part id="fry-garri" name="Garri on the pan" role="static" material="grain" info={{ summary: 'Grits being garified.', role: 'Water flashes off as steam.' }}>
            <PartMesh geometry={g.garriDisc} position={[0, 0.595, 0]} />
          </Part>
          <Spin axis="y" rate={() => 2} position={[0, 0.6, 0]}>
            <Part id="paddles" name="Stirring paddles" role="moving" material="steel" info={{ summary: 'Rotating paddles.', role: 'Keep the grits moving so they toast evenly and do not burn.' }} beyondNotes>
              <PartMesh geometry={g.paddle} />
            </Part>
          </Spin>
          <PartMesh geometry={g.hood} position={[0, 1.15, 0]} material="galvanised" />
        </Part>

        {/* 7 Cooling */}
        <Part id="cooler" name="Cooling table" role="housing" material="steel" info={INFO.cooler} cites={[CITE.garriFlow('cooling')]} position={[X.cool, 0, 0]} explode={[0, 0, -0.6]}>
          <PartMesh geometry={g.table} position={[0, 0.62, 0]} />
          <PartMesh geometry={g.legs1} material="paintGrey" scale={[1, 1.1, 1]} />
          <PartMesh geometry={g.garriBed} position={[0, 0.66, 0]} material="grain" />
        </Part>

        {/* 8 Sifter */}
        <Part id="sifter" name="Grading sifter" role="housing" material="galvanised" info={INFO.sifter} cites={[CITE.garriFlow('sieving, grading'), CITE.gstd('granularity')]} position={[X.sift, 0.6, 0]} explode={[0, 0.4, 0]}>
          <PartMesh geometry={g.legs1} material="paintGrey" position={[0, -0.6, 0]} scale={[0.7, 1.05, 0.8]} />
          <group ref={sifterRef}>
            <PartMesh geometry={g.sieveBox} />
            <PartMesh geometry={g.sieveBox} position={[0, 0.14, 0]} scale={[0.9, 1, 0.9]} />
            <PartMesh geometry={g.grain} position={[0, 0.04, 0]} material="grain" />
          </group>
        </Part>

        {/* 9 Bagging */}
        <Part id="bagger" name="Bagging scale" role="housing" material="paintGrey" info={INFO.bagger} cites={[CITE.gstd('§6 packaging'), CITE.pack('materials: textiles/jute')]} position={[X.bag, 0, 0]} explode={[0, 0, -0.6]}>
          <PartMesh geometry={g.scale} position={[0, 0.06, 0]} />
          <Part id="sack" name={`Garri sack, ${p.bagSize} kg`} role="static" material="straw" info={{ summary: 'Sewn woven sack.', role: 'Clean, sturdy, strongly sewn or sealed.' }}>
            <PartMesh geometry={g.sack} position={[0, 0.12, 0]} />
          </Part>
        </Part>

        {/* by-product bins */}
        <Part id="bins" name="By-product bins" role="housing" material="plastic" info={INFO.bins} cites={[CITE.garriFlow('peels, residue')]}>
          <PartMesh geometry={g.bin} position={[X.peel, 0, 1.0]} />
          <PartMesh geometry={g.bin} position={[X.sieve, 0, 0.9]} />
          <PartMesh geometry={g.bin} position={[X.sift, 0, 0.9]} />
          <PartMesh geometry={g.bin} position={[X.press, 0, 0.9]} material="paintBlue" />
        </Part>
      </Part>

      {/* main material stream: thins out as peel, liquor, fibre and steam leave */}
      <Stream pts={main[0]} color={COL.mash} rate={k(mb.rootsIn.mass)} count={36} radius={0.035} />
      <Stream pts={main[1]} color={COL.mash} rate={k(mb.washedRoots.mass)} count={36} radius={0.03} />
      <Stream pts={main[2]} color={COL.mash} rate={k(mb.wetMash.mass)} count={24} />
      <Stream pts={main[3]} color={COL.mash} rate={k(mb.pressCake.mass)} count={30} />
      <Stream pts={main[4]} color={COL.garri} rate={k(mb.siftedGrits.mass)} count={40} />
      <Stream pts={main[5]} color={COL.garri} rate={k(mb.friedGarri.mass)} count={24} />
      <Stream pts={main[6]} color={COL.garri} rate={k(mb.gradedGarri.mass)} count={40} />
      {/* side streams */}
      <Stream pts={[[X.peel + 0.2, 0.75, 0.2], [X.peel, 0.5, 0.7], [X.peel, 0.3, 1.0]]} color={COL.peel} rate={k(mb.peelsOut.mass * 2)} count={16} />
      <Stream pts={[[X.wash, 1.3, -0.6], [X.wash, 0.9, -0.2], [X.wash, 0.5, 0.2], [X.wash + 0.3, 0.05, 0.9]]} color={COL.water} rate={k(mb.washWaterUsed * 0.3)} count={24} radius={0.012} />
      <Stream pts={[[X.press, 0.2, 0.25], [X.press, 0.1, 0.6], [X.press, 0.3, 0.9]]} color={COL.liquor} rate={k(mb.liquorExpelled.mass * 2)} count={18} radius={0.014} />
      <Stream pts={[[X.sieve + 0.2, 0.62, 0.2], [X.sieve, 0.5, 0.6], [X.sieve, 0.3, 0.9]]} color={COL.chaff} rate={k(mb.chaffFiberOut.mass * 8)} count={10} />
      <Stream pts={[[X.fry, 0.65, 0], [X.fry + 0.05, 1.2, 0], [X.fry, 2.1, 0.05]]} color={COL.steam} rate={k(mb.steamEvaporated * 2)} count={36} radius={0.03} speed={0.4} />
      <Stream pts={[[X.sift + 0.2, 0.75, 0.2], [X.sift, 0.5, 0.6], [X.sift, 0.3, 0.9]]} color={COL.chaff} rate={k(mb.oversizeRecycle.mass * 20)} count={8} />

      <PartLabel partId="peeler" at={[X.peel, 1.4, 0]} />
      <PartLabel partId="washer" at={[X.wash, 1.2, 0]} />
      <PartLabel partId="grater" at={[X.grate, 1.25, 0]} />
      <PartLabel partId="press" at={[X.press, 1.7, 0]} />
      <PartLabel partId="sieve" at={[X.sieve, 1.0, 0]} />
      <PartLabel partId="fryer" at={[X.fry, 2.2, 0]} />
      <PartLabel partId="cooler" at={[X.cool, 0.95, 0]} />
      <PartLabel partId="sifter" at={[X.sift, 1.1, 0]} />
      <PartLabel partId="bagger" at={[X.bag, 1.0, 0]} />
    </group>
  )
}
