import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { box, extrude, lathe } from '@/geometry'
import { PartLabel } from '@/render/Label'
import { cutPlanes } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { buildTyre, type LayerGeo } from './build'
import { deformTyre } from './deform'
import { BUILDS, L27, TREADS, TT, TTS, derive, useTyre } from './model'

const { PI } = Math

const C = {
  cutaway: [TT('p2, Fig 2 — cutaway view of tire'), TT('p4, Fig 5')],
  plies: [TT('p2 — body plies, ply rating'), TT('p3, Figs 3–4')],
  tread: [TT('p4–5 — tread, codes for tire types'), TT('p5, Fig 8 — directional arrows')],
  inflation: [TT('p6, Fig 9 — tire inflation'), TTS('p14 — tyre pressures'), L27('p39 — ground pressure ≈ tyre pressure')],
}

function layerInfo(l: LayerGeo, build: keyof typeof BUILDS, tube: boolean) {
  const b = BUILDS[build]
  if (l.kind === 'tread')
    return {
      name: 'Tread, shoulder & sidewall rubber',
      info: {
        summary: 'Outer rubber: the tread and tread shoulder on the crown, the sidewalls on the flanks.',
        role: 'The tread contacts the ground — it must give traction, wear well and resist cuts. The shoulder carries the tread round onto the sidewall. Sidewalls are the rubber coverings of the body, made to flex and bend without cracking under ordinary deflection and sudden shock.',
        details: 'Tread depth is measured from the top of the bars down to the tread base. Weather checks (small cracks) on the sidewall come from high pressure, sunlight and ozone and are usually only cosmetic.',
      },
      cites: [...C.cutaway, TT('p4 — sidewalls, tread'), TT('p17 — rubber checks')],
    }
  if (l.kind === 'belt')
    return {
      name: `Belt ${l.index + 1}`,
      info: {
        summary: `Belt ${l.index + 1} of ${b.belts}: low-angle cords (here ±${b.beltAngle}°) under the tread.`,
        role: 'Fairly rigid belts surround the body under the tread. They stiffen the tread and reduce tread motion while it is in contact with the ground, improving tread life.',
        details: 'Belt cords may be steel or fabric.',
      },
      cites: [TT('p3 — belted bias, belted radial; Fig 4')],
    }
  if (l.kind === 'ply')
    return {
      name: `Body ply ${l.index + 1}`,
      info: {
        summary: `Body ply ${l.index + 1}: rubber-cushioned cord running bead to bead at ${b.plyAngle === 90 ? 'about 90° (radial)' : `±${b.plyAngle}° (bias), crossing the next ply`}.`,
        role: 'The plies make up the body: they hold in the inflation pressure that supports the load and cushion shocks. Every cord is surrounded by rubber and each ply is insulated from the next.',
        details: 'Cord material: cotton, rayon, nylon or polyester. Tyres have 2 to 20+ plies. Ply rating states strength, not the number of plies — a 4-ply-rated tyre may have only 2 plies of larger cords.',
      },
      cites: C.plies,
    }
  return {
    name: tube ? 'Inner tube' : 'Tubeless inner liner',
    info: tube
      ? { summary: 'Inner tube.', role: 'Retains air, inert gas or liquid ballast under pressure inside a tube-type tyre.' }
      : {
          summary: 'Tubeless inner liner.',
          role: 'An integral layer covering the inside of a tubeless tyre from bead to bead; it is the air retainer. It saves weight (no tube or flap) and is easier to maintain.',
        },
    cites: [TT('p4 — tubeless inner liner, tube')],
  }
}

const LAYER_MAT = { tread: 'rubber', belt: 'steelDark', ply: 'nylon', liner: 'rubber' } as const

export function Tyre3D() {
  const st = useTyre()
  const d = derive(st)
  const intersection = useView((s) => s.cut.intersection)
  const g = useMemo(() => buildTyre(d.size, st.build, st.tread, st.peel, { plies: st.build === 'bias' ? st.plies : undefined, reversed: st.reversed }), [d.size, st.build, st.tread, st.peel, st.plies, st.reversed])
  const R = g.R
  const delta = Math.min(d.patch.deflection, 0.4 * (R - g.rimR))
  const halfLen = Math.min(d.patch.length / 2, 0.95 * R)
  const axleY = R - delta

  const deformed = useMemo(() => {
    const o = { R, r0: g.rimR, hw: g.hw, delta, halfLen, state: d.state }
    return {
      layers: g.layers.map((l) => ({ geo: deformTyre(l.geo, o), cords: l.cords ? deformTyre(l.cords, o) : undefined })),
      lugs: g.lugs ? deformTyre(g.lugs, o) : null,
    }
  }, [g, R, delta, halfLen, d.state])

  const cordMats = useMemo(() => {
    const mk = (color: string) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 })
      m.clippingPlanes = cutPlanes
      return m
    }
    return { ply: mk('#9c7c45'), belt: mk('#d7dde2') }
  }, [])
  useEffect(() => {
    cordMats.ply.clipIntersection = intersection
    cordMats.belt.clipIntersection = intersection
  }, [cordMats, intersection])

  // flap (tube-type tyres): rubber band over the rim between the beads
  const flap = useMemo(() => {
    const y = g.beadY - 0.01
    return lathe(
      [
        [g.rimR + 0.004, -y],
        [g.rimR + 0.011, -y],
        [g.rimR + 0.011, y],
        [g.rimR + 0.004, y],
      ],
      96,
    )
  }, [g])

  // directional arrow moulded on the outer sidewall (Fig 8): points the way the tyre turns going forward
  const arrow = useMemo(() => {
    const s = new THREE.Shape()
    const L = 0.16
    const w = 0.025
    s.moveTo(-L / 2, -w / 2)
    s.lineTo(L / 2 - 0.05, -w / 2)
    s.lineTo(L / 2 - 0.05, -w * 1.5)
    s.lineTo(L / 2, 0)
    s.lineTo(L / 2 - 0.05, w * 1.5)
    s.lineTo(L / 2 - 0.05, w / 2)
    s.lineTo(-L / 2, w / 2)
    return extrude(s, 0.006)
  }, [])
  const arrowR = g.rimR + 0.62 * (R - g.rimR)
  const arrowPhi = (150 * PI) / 180

  // contact patch strips (world frame, on the ground under the axle)
  const patch = useMemo(() => {
    const l = 2 * halfLen
    const w = d.patch.width
    return { centre: box(l, 0.004, w * 0.42), shoulder: box(l * 0.9, 0.004, w * 0.29), w }
  }, [halfLen, d.patch.width])
  const wearMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e0663a', roughness: 0.8, emissive: '#5a1d08', emissiveIntensity: 0.5 }), [])
  const contactMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7c8a80', roughness: 0.9 }), [])
  const centreWear = d.state === 'over'
  const shoulderWear = d.state === 'under'
  const ground = useMemo(() => box(3.2 * R, 0.05, 2.4 * g.W + 0.8), [R, g.W])

  return (
    <group>
      <Part id="wheel-assembly" name={`Tractor tyre ${d.size.code}`} role="static" material="rubber" info={{ summary: `${d.size.code}: ${d.size.widthIn.toFixed(1)} in section width on a ${d.size.rimIn} in rim, ${BUILDS[st.build].label.toLowerCase()}, ${TREADS[st.tread].label} tread.`, role: 'A pneumatic tyre carries the load on air pressure, cushions shocks and develops traction at the soil surface.' }} cites={C.cutaway}>
        <group position={[0, axleY, 0]} rotation={[PI / 2, 0, 0]}>
          <Part id="tread" name="Tread bars (lugs)" material="rubber" role="static" info={{ summary: TREADS[st.tread].label + ' tread.', role: TREADS[st.tread].text, details: 'Tread depth is the height of the bars above the tread base. Off-the-road farm tyres are rated for no more than 20 mph; on hard roads raise the pressure to the maximum to reduce wiping of the bars.' }} cites={C.tread} explode={[0, 0.25, 0]}>
            {deformed.lugs ? <PartMesh geometry={deformed.lugs} /> : null}
          </Part>
          <Part id="carcass" name="Carcass (body)" role="static" material="rubber" info={{ summary: `${BUILDS[st.build].label}: ${BUILDS[st.build].text}` }} cites={C.plies}>
            {g.layers.map((l, k) => {
              const li = layerInfo(l, st.build, st.tube)
              const dg = deformed.layers[k]
              return (
                <Part key={l.id} id={l.id} name={li.name} material={LAYER_MAT[l.kind]} role="static" info={li.info} cites={li.cites} explode={[0, 0, 0.05 * (g.layers.length - k)]}>
                  <PartMesh geometry={dg.geo} />
                  {dg.cords ? (
                    <Part id={`${l.id}-cords`} name={`${li.name} — cords`} role="static" cut={false} material={LAYER_MAT[l.kind]} info={{ summary: `Cord direction in ${li.name.toLowerCase()} (${l.kind === 'belt' ? `±${BUILDS[st.build].beltAngle}°` : BUILDS[st.build].plyAngle === 90 ? '≈90°, bead to bead' : `±${BUILDS[st.build].plyAngle}°, alternating ply to ply`}).` }} cites={C.plies}>
                      <PartMesh geometry={dg.cords} customMaterial={l.kind === 'belt' ? cordMats.belt : cordMats.ply} castShadow={false} />
                    </Part>
                  ) : null}
                </Part>
              )
            })}
          </Part>
          {st.tube ? (
            <Part id="flap" name="Flap" material="rubber" role="static" info={{ summary: 'Rim flap (tube-type tyres).', role: 'Protects the tube from injury by the rim and the tyre beads.' }} cites={[TT('p4 — flaps')]}>
              <PartMesh geometry={flap} />
            </Part>
          ) : null}
          <Part id="beads" name="Bead wires" material="steelDark" role="static" info={{ summary: 'Beads: bundles of strong steel wire at the toe of each sidewall.', role: 'Anchor the tyre to the rim and are its foundation: every ply is tied round them, and they stop the tyre changing shape or fit on the rim. One or more bead stacks may be used.', details: 'If the bead slips on the rim (low pressure, poor seating, too much soap when mounting) a tube valve can be torn off.' }} cites={[TT('p2 — bead'), TT('p18 — valve damage')]} explode={[0, 0, 0.12]}>
            <PartMesh geometry={g.beads} />
          </Part>
          <Part id="valve" name="Valve stem" material="brass" role="static" cut={false} info={{ summary: 'Valve stem.', role: 'Inflation and pressure checks. With liquid ballast check pressure with the valve at the bottom using a liquid-type gauge, or add about ½ psi per foot of liquid above the gauge.', details: 'Check and inflate when cold: a hot tyre reads 4–6 psi higher — never bleed a hot tyre.' }} cites={[TT('p2, Fig 2'), TT('p7 — how to inflate tires')]} explode={[0.15, 0, 0]}>
            <PartMesh geometry={g.valve} />
          </Part>
          <Part id="rim" name="Rim & wheel disc" material="paintGrey" role="housing" info={{ summary: 'Steel rim and dished centre disc.', role: 'The rim is the part of the wheel that gives metal support to the tyre. The dished disc bolts to the rim lugs; repositioning or reversing it changes the track width.' }} cites={[TT('p4 — rim'), TTS('p13–17 — wheels and tyres')]} explode={[0, -0.3, 0]}>
            <PartMesh geometry={g.rim} />
          </Part>
          <Part id="arrow" name="Directional arrow" material="paintYellow" role="static" cut={false} info={{ summary: st.reversed ? 'Arrow points BACKWARDS — this tyre is mounted the wrong way round.' : 'Arrow shows forward rotation.', role: 'Directional drive tyres must turn the way the arrow points: the V of the tread points downward when viewed from the front. Reversing the tread damages the bars under heavy pull — only ground-driven implements (planters, spreaders) run the V reversed.', details: 'The arrow is moulded into the sidewall; coloured here for clarity.' }} cites={[TT('p5, Fig 8')]}>
            <group position={[arrowR * Math.sin(arrowPhi), g.hw * 0.97 + 0.008, arrowR * Math.cos(arrowPhi)]} rotation={[0, st.reversed ? arrowPhi : arrowPhi + PI, 0]}>
              <group rotation={[-PI / 2, 0, 0]}>
                <PartMesh geometry={arrow} />
              </group>
            </group>
          </Part>
        </group>
      </Part>

      <Part id="contact" name="Contact patch & wear zone" role="static" cut={false} material="rubber" info={{ summary: `Contact area A = W/p = ${(d.patch.area * 1e4).toFixed(0)} cm² (${d.state === 'correct' ? 'correct inflation' : d.state === 'over' ? 'over-inflated' : 'under-inflated'}).`, role: d.state === 'over' ? 'Over-inflation prevents full contact of the tread: the tyre is too rigid, the CENTRE of the tread wears fast, and impacts can break the cords (X-shaped fabric breaks).' : d.state === 'under' ? 'Under-inflation lets the tyre flex too much at every turn: it heats up and the SIDES of the tread wear while the centre is hardly worn. Furrow tyres buckle and crack.' : 'Correct pressure gives full tread contact, proper traction and flotation, and prevents too much or too little flexing.', details: 'Ground pressure is roughly equal to tyre pressure. Orange marks the wear zone.' }} cites={C.inflation}>
        <PartMesh geometry={patch.centre} customMaterial={centreWear ? wearMat : contactMat} position={[0, 0.003, 0]} castShadow={false} />
        <PartMesh geometry={patch.shoulder} customMaterial={shoulderWear ? wearMat : contactMat} position={[0, 0.003, d.state === 'over' ? 0 : patch.w * 0.355]} visible={d.state !== 'over'} castShadow={false} />
        <PartMesh geometry={patch.shoulder} customMaterial={shoulderWear ? wearMat : contactMat} position={[0, 0.003, -patch.w * 0.355]} visible={d.state !== 'over'} castShadow={false} />
      </Part>
      <Part id="ground" name="Ground" material="concrete" role="static" cut={false} info={{ summary: 'Firm ground under the tyre.' }}>
        <PartMesh geometry={ground} position={[0, -0.025, 0]} />
      </Part>

      <PartLabel partId="tread" at={[-0.3 * R, 2 * R - delta + 0.05, 0.1]} />
      <PartLabel partId="tread-rubber" text="Tread shoulder" at={[-0.72 * R, axleY + 0.72 * R, g.hw]} />
      <PartLabel partId="tread-rubber" text="Sidewall" at={[0.2, axleY + g.rimR + 0.5 * (R - g.rimR), g.hw + 0.05]} />
      {g.layers.some((l) => l.kind === 'ply') ? <PartLabel partId={g.layers.find((l) => l.kind === 'ply')!.id} text="Body plies" at={[-0.95 * R, axleY + 0.25 * R, g.hw * 0.6]} /> : null}
      {g.layers.some((l) => l.kind === 'belt') ? <PartLabel partId="belt-1" text="Belts" at={[-0.55 * R, axleY + 0.8 * R, 0]} /> : null}
      <PartLabel partId="liner" at={[-0.45 * R, axleY + 0.55 * R, -0.05]} />
      <PartLabel partId="beads" at={[0.05, axleY + g.rimR + 0.03, g.beadY]} />
      <PartLabel partId="rim" at={[0, axleY - g.rimR * 0.6, 0.15]} />
      <PartLabel partId="valve" at={[g.rimR - 0.03, axleY + 0.02, 0.04]} />
      <PartLabel partId="arrow" at={[arrowR * 0.5, axleY + arrowR * 0.87 + 0.05, g.hw + 0.05]} />
      <PartLabel partId="contact" at={[0.4 * R, 0.02, g.W]} />
    </group>
  )
}
