import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, lathe, mat4, merge, xform } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { boxShell, burrMill, centrifugalFan, hammerMill, hopper, millRoll, shakerBase, shakerLid, testSieve } from '@/parts/lib/processing'
import { CITES } from './cites'
import { analyseSieves, live, useSizeReduction } from './model'

const { PI, cos, sin } = Math
const V3 = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z)
const curve = (pts: THREE.Vector3[]) => new THREE.CatmullRomCurve3(pts, false, 'centripetal')
const ON = () => 1

const C = {
  hammer: [CITES.red('Hammer Mills'), CITES.pq('p1 Q2c; p3 Q3b')],
  burr: [CITES.red('Burr mills or plate mills'), CITES.pq('p1 Q3c')],
  roller: [CITES.red('Roller mills'), CITES.pq('p6 Q2c, Q3b')],
  sieve: [CITES.red('Methods of measuring size characteristics; fineness modulus method')],
}

const INFO = {
  hammer: { summary: 'Hammer mill.', role: 'Impact mill: swinging hammers on a rotor at 1500–4000 rpm beat the feed until it is small enough to pass the screen. Fineness is set by the screen size, the speed and the feed rate.', details: 'Simple and versatile; not seriously damaged by foreign objects or by running empty; hammer wear does not cut efficiency much. But the grind is not uniform and the power is high.' },
  casing: { summary: 'Cylindrical casing.', role: 'Encloses the grinding chamber; the feed hopper enters at the top.' },
  rotor: { summary: 'Rotor: shaft and discs.', role: 'Carries the hammers round at high speed.' },
  hammers: { summary: 'Swinging hammers (beaters).', role: 'Pivoted at the disc edge; centrifugal force swings them out radially. Because they can swing back, a stone or bolt does not wreck the mill.' },
  screen: { summary: 'Stainless-steel screen.', role: 'Wraps the rotor; material stays in the chamber until it passes the holes, so the hole size sets the fineness (1.5 mm for cassava mash for garri).' },
  aspirator: { summary: 'Aspirator fan and outlet duct.', role: 'Draws the ground product through the screen and blows it to a cyclone; the air flow also cools the mill.' },
  feed: { summary: 'Feed hopper.', role: 'Feed rate is one of the fineness controls; overfeeding chokes the mill.' },
  burr: { summary: 'Burr (plate, attrition) mill.', role: 'Two hard roughened plates, one fixed and one turning at 350–700 rpm. Feed enters the eye at the centre and is crushed and sheared as it moves out between the plates.', details: 'Low cost, low power, fairly uniform product. Overfeeding cuts efficiency and overheats; foreign objects break the plates; running empty wears the burrs.' },
  plates: { summary: 'Grooved burr plates.', role: 'Plate type and plate gap set the fineness; the grooves get finer towards the rim.' },
  gap: { summary: 'Gap-adjusting handwheel, screw and spring.', role: 'The handwheel screws the stationary plate in or out to set the gap; the spring lets the plates part if a hard object enters.' },
  auger: { summary: 'Feed auger.', role: 'Carries grain from the hopper into the eye of the plates.' },
  roller: { summary: 'Roller mill (crusher).', role: 'Two or more steel rolls revolving towards each other squeeze the material through the nip (compression). Used for very fine products (wheat break and reduction rolls).', details: 'High capacity, uniform, durable, little attention — but high first cost and technical requirement.' },
  rolls: { summary: 'Fluted (serrated) rolls.', role: 'Counter-rotate; often at different speeds so the flutes shear as well as crush. The nip gap sets the product size.' },
  shaker: { summary: 'Sieve shaker.', role: 'About 250 g of dried sample is shaken with a fixed vertical gyratory motion for about 5 minutes through IS sieves 100, 70, 50, 40, 30, 20, 15 and a pan.' },
  trays: { summary: 'Sieve stack.', role: 'Largest aperture at the top, blind pan at the bottom; the mass retained on each sieve gives the fineness modulus and uniformity index.' },
  product: { summary: 'Ground product.', role: 'Leaves smaller than the screen holes / plate gap / nip.' },
}

function HammerMill() {
  const p = useSizeReduction()
  const R = 0.32
  const geo = useMemo(() => {
    const { casing, side: sides, disc, shaft, hammer, screen } = hammerMill({ R, screenHoleMm: p.screenHoleMm })
    const hop = hopper({ top: 0.4, bottom: 0.14, h: 0.35, wall: 0.015 })
    const neck = boxShell({ w: 0.14, d: 0.2, h: 0.2, t: 0.008 })
    const duct = boxShell({ w: 0.16, d: 0.2, h: 0.5, t: 0.008 })
    const fan = centrifugalFan({ r: 0.15, width: 0.16 })
    const base = box(0.9, 0.06, 0.6)
    return { casing, sides, disc, shaft, hammer, screen, hop, neck, duct, fan, base }
  }, [p.screenHoleMm])
  const rotor = useRef<THREE.Group>(null)
  const fanRotor = useRef<THREE.Group>(null)
  const ham = useRef<(THREE.Group | null)[]>([])
  const nH = Math.max(4, Math.min(8, Math.round(p.hammerCount / 2)))
  useSimFrame((dt, t) => {
    live.hammerAngle += ((p.hammerRpm * 2 * PI) / 60) * dt
    live.hammerTipSpeedMs = ((p.hammerRpm * 2 * PI) / 60) * 0.29
    rotor.current?.rotation.set(0, 0, -live.hammerAngle)
    fanRotor.current?.rotation.set(0, 0, p.aspiratorOn ? live.hammerAngle : 0)
    // hammers stand out radially when running; a small flutter as they strike
    ham.current.forEach((h, i) => h?.rotation.set(0, 0, 0.12 * sin(t * 40 + i)))
  })
  const Y = 0.75
  const feed = useMemo(() => curve([V3(0, Y + 0.85), V3(0, Y + 0.55), V3(0.05, Y + 0.3), V3(0.1, Y + 0.05)]), [])
  const prod = useMemo(() => curve([V3(0.05, Y - 0.2), V3(0, Y - R - 0.05), V3(0, Y - R - 0.25), V3(0.25, Y - R - 0.33), V3(0.75, Y - R - 0.3), V3(0.85, Y - 0.1), V3(0.85, Y + 0.25)]), [])
  return (
    <Part id="hammer-mill" name="Hammer mill" role="moving" material="paintGreen" info={INFO.hammer} cites={C.hammer}>
      <Part id="hm-casing" name="Casing" role="housing" material="paintGreen" info={INFO.casing} cites={C.hammer} explode={[0, 0, -0.4]}>
        <PartMesh geometry={geo.casing} position={[0, Y, 0]} />
        <PartMesh geometry={geo.sides} position={[0, Y, -0.166]} />
        <PartMesh geometry={geo.base} position={[0.3, 0.03, 0]} material="paintGrey" />
        <PartMesh geometry={useMemo(() => box(0.5, Y - R - 0.1, 0.4), [])} position={[0, (Y - R - 0.04) / 2, 0]} material="paintGrey" />
      </Part>
      <Part id="hm-hopper" name="Feed hopper" role="housing" material="galvanised" info={INFO.feed} explode={[0, 0.4, 0]}>
        <PartMesh geometry={geo.hop} position={[0, Y + 0.48, 0]} />
        <PartMesh geometry={geo.neck} position={[0, Y + 0.38, 0]} />
      </Part>
      <Part id="hm-screen" name={`Screen (${p.screenHoleMm} mm holes)`} role="static" material="steel" info={INFO.screen} cites={C.hammer} explode={[0, -0.2, 0.3]}>
        <PartMesh geometry={geo.screen} position={[0, Y, 0]} />
      </Part>
      <group position={[0, Y, 0]}>
        <group ref={rotor}>
          <Part id="hm-rotor" name="Rotor" role="moving" material="steel" info={INFO.rotor} cites={C.hammer}>
            <PartMesh geometry={geo.shaft} />
            {[-0.09, 0, 0.09].map((z) => (
              <PartMesh key={z} geometry={geo.disc} position={[0, 0, z]} />
            ))}
          </Part>
          <Part id="hm-hammers" name="Swinging hammers" role="moving" material="forged" info={INFO.hammers} cites={C.hammer} explode={[0, 0, 0.3]}>
            {Array.from({ length: nH }, (_, i) => {
              const a = (2 * PI * i) / nH
              return (
                <group key={i} position={[0.15 * cos(a), 0.15 * sin(a), 0]} rotation={[0, 0, a]}>
                  <group ref={(el) => (ham.current[i] = el)}>
                    {[-0.045, 0.045].map((z) => (
                      <PartMesh key={z} geometry={geo.hammer} position={[0, 0, z + (i % 2) * 0.02]} />
                    ))}
                  </group>
                </group>
              )
            })}
          </Part>
        </group>
      </group>
      <Part id="hm-aspirator" name="Aspirator fan and duct" role="housing" material="paintBlue" info={INFO.aspirator} cites={C.hammer} explode={[0.3, 0, 0]}>
        <group position={[0.7, Y - R - 0.25, 0]}>
          <PartMesh geometry={geo.fan.housing} />
          <group ref={fanRotor}>
            <PartMesh geometry={geo.fan.impeller} material="steel" />
          </group>
        </group>
        <PartMesh geometry={geo.duct} position={[0.85, Y + 0.05, 0]} />
      </Part>
      <Flow curve={feed} count={30} radius={0.018} color="#d6b25e" intensity={ON} speed={0.5} spread={0.08} emissive={0.15} />
      <Flow curve={prod} count={110} radius={0.006} color="#efe3c0" intensity={() => (p.aspiratorOn ? 1 : 0.4)} speed={0.6} spread={0.06} emissive={0.2} />
      <PartLabel partId="hm-hammers" at={[0.25, Y + 0.1, 0.25]} />
      <PartLabel partId="hm-screen" at={[-0.35, Y - 0.25, 0.2]} />
      <PartLabel partId="hm-hopper" at={[0, Y + 0.9, 0.1]} />
      <PartLabel partId="hm-aspirator" at={[0.95, Y + 0.3, 0.1]} />
    </Part>
  )
}

function BurrMill() {
  const p = useSizeReduction()
  const gap = Math.min(0.03, p.burrGapMm * 0.01)
  const geo = useMemo(() => {
    const hop = hopper({ top: 0.36, bottom: 0.1, h: 0.3, wall: 0.015 })
    const base = box(1.0, 0.06, 0.5)
    const pedestal = box(0.5, 0.45, 0.35)
    return { ...burrMill(), hop, base, pedestal }
  }, [])
  const rot = useRef<THREE.Group>(null)
  useSimFrame((dt) => {
    live.burrAngle += ((p.burrRpm * 2 * PI) / 60) * dt
    live.burrRimSpeedMs = ((p.burrRpm * 2 * PI) / 60) * 0.2
    rot.current?.rotation.set(live.burrAngle, 0, 0)
  })
  const Y = 0.75
  const feed = useMemo(() => curve([V3(-0.3, Y + 0.6), V3(-0.3, Y + 0.25), V3(-0.25, Y + 0.02), V3(-0.08, Y), V3(-0.03, Y)]), [])
  const outs = useMemo(
    () =>
      [0.4, 1.6, 2.8, 4.0, 5.2].map((a) =>
        curve([V3(0.0, Y + 0.03 * cos(a), 0.03 * sin(a)), V3(0.0, Y + 0.2 * cos(a), 0.2 * sin(a)), V3(0.02, Y + 0.23 * cos(a) - 0.05, 0.23 * sin(a)), V3(0.05, Y - 0.25, 0.1 * sin(a)), V3(0.05, 0.1, 0)]),
      ),
    [],
  )
  return (
    <Part id="burr-mill" name="Burr (plate) mill" role="moving" material="paintRed" info={INFO.burr} cites={C.burr}>
      <Part id="bm-housing" name="Plate housing" role="housing" material="paintRed" info={INFO.burr} cites={C.burr} explode={[0, 0.3, 0]}>
        <PartMesh geometry={geo.housing} position={[0, Y, 0]} />
        <PartMesh geometry={geo.base} position={[0, 0.03, 0]} material="paintGrey" />
        <PartMesh geometry={geo.pedestal} position={[-0.25, 0.28, 0]} material="paintGrey" />
      </Part>
      <Part id="bm-hopper" name="Feed hopper" role="housing" material="galvanised" info={INFO.feed} explode={[0, 0.4, 0]}>
        <PartMesh geometry={geo.hop} position={[-0.3, Y + 0.25, 0]} />
      </Part>
      <Part id="bm-plates" name="Burr plates" role="moving" material="steelDark" info={INFO.plates} cites={C.burr}>
        <Part id="bm-stationary" name="Stationary plate" role="static" material="steelDark" info={INFO.plates} explode={[0.25, 0, 0]}>
          <PartMesh geometry={geo.eye} position={[0.015 + gap / 2, Y, 0]} />
        </Part>
        <group position={[-0.015 - gap / 2, Y, 0]}>
          <group ref={rot}>
            <Part id="bm-rotating" name="Rotating plate and auger" role="moving" material="steelDark" info={INFO.auger} explode={[-0.25, 0, 0]}>
              <PartMesh geometry={geo.rotPlate} />
              <PartMesh geometry={geo.shaft} position={[-0.3, 0, 0]} material="steel" />
              <PartMesh geometry={geo.auger} material="steel" />
            </Part>
          </group>
        </group>
      </Part>
      <Part id="bm-gap" name="Gap adjuster: handwheel, screw, spring" role="moving" material="steel" cut={false} info={INFO.gap} cites={C.burr} explode={[0.3, 0, 0]}>
        <PartMesh geometry={geo.screw} position={[0.3 + gap, Y, 0]} />
        <PartMesh geometry={geo.spring} position={[0.18 + gap, Y, 0]} material="chrome" />
        <PartMesh geometry={geo.wheel} position={[0.46 + gap, Y, 0]} material="paintBlack" />
      </Part>
      <Flow curve={feed} count={30} radius={0.014} color="#d6b25e" intensity={ON} speed={0.5} spread={0.04} emissive={0.15} />
      {outs.map((c, i) => (
        <Flow key={i} curve={c} count={22} radius={0.005} color="#efe3c0" intensity={ON} speed={0.5} spread={0.03} emissive={0.2} />
      ))}
      <PartLabel partId="bm-stationary" at={[0.05, Y + 0.3, 0.15]} />
      <PartLabel partId="bm-gap" at={[0.45, Y + 0.18, 0.1]} />
      <PartLabel partId="bm-hopper" at={[-0.3, Y + 0.65, 0.1]} />
    </Part>
  )
}

function RollerMill() {
  const p = useSizeReduction()
  const r = 0.15
  const gap = Math.min(0.03, p.rollGapMm * 0.01)
  const geo = useMemo(() => {
    const rollZ = millRoll({ r, width: 0.5, fluted: p.fluted })
    const shaft = xform(cylinder(0.025, 0.8, 16), mat4.rx(PI / 2))
    const frame = merge(...[-0.3, 0.3].map((z) => box(0.9, 0.5, 0.03).translate(0, 0, z)))
    const hop = hopper({ top: 0.5, bottom: 0.12, h: 0.35, wall: 0.015 })
    const base = box(1.0, 0.06, 0.7)
    return { rollZ, shaft, frame, hop, base }
  }, [p.fluted])
  const a = useRef<THREE.Group>(null)
  const b = useRef<THREE.Group>(null)
  useSimFrame((dt) => {
    const w = (p.rollRpm * 2 * PI) / 60
    live.roller1Angle -= w * dt
    live.roller2Angle += (w / p.rollRatio) * dt
    live.rollerNipSpeedMs = w * r
    a.current?.rotation.set(0, 0, live.roller1Angle)
    b.current?.rotation.set(0, 0, live.roller2Angle)
  })
  const Y = 0.75
  const x = r + gap / 2
  const feed = useMemo(() => curve([V3(0, Y + 0.65), V3(0, Y + 0.35), V3(0, Y + 0.12), V3(0, Y + 0.02)]), [])
  const prod = useMemo(() => curve([V3(0, Y - 0.02), V3(0, Y - 0.25), V3(0, 0.15)]), [])
  return (
    <Part id="roller-mill" name="Roller mill" role="moving" material="paintBlue" info={INFO.roller} cites={C.roller}>
      <Part id="rm-frame" name="Side frames" role="housing" material="paintBlue" info={INFO.roller} explode={[0, 0, 0.3]}>
        <PartMesh geometry={geo.frame} position={[0, Y, 0]} />
        <PartMesh geometry={geo.base} position={[0, 0.03, 0]} material="paintGrey" />
        <PartMesh geometry={useMemo(() => box(0.9, Y - 0.3, 0.6), [])} position={[0, (Y - 0.3) / 2 + 0.03, 0]} material="paintGrey" />
      </Part>
      <Part id="rm-hopper" name="Feed hopper" role="housing" material="galvanised" info={INFO.feed} explode={[0, 0.3, 0]}>
        <PartMesh geometry={geo.hop} position={[0, Y + 0.2, 0]} />
      </Part>
      <Part id="rm-rolls" name={p.fluted ? 'Fluted rolls' : 'Smooth rolls'} role="moving" material="chrome" info={INFO.rolls} cites={C.roller}>
        <group position={[-x, Y, 0]}>
          <group ref={a}>
            <PartMesh geometry={geo.rollZ} />
            <PartMesh geometry={geo.shaft} material="steel" />
          </group>
        </group>
        <group position={[x, Y, 0]}>
          <group ref={b}>
            <PartMesh geometry={geo.rollZ} />
            <PartMesh geometry={geo.shaft} material="steel" />
          </group>
        </group>
      </Part>
      <Flow curve={feed} count={30} radius={0.016} color="#e9e1cf" intensity={ON} speed={0.5} spread={0.25} emissive={0.15} />
      <Flow curve={prod} count={90} radius={0.005} color="#f5f0e2" intensity={ON} speed={0.7} spread={0.3} emissive={0.2} />
      <PartLabel partId="rm-rolls" at={[0, Y + 0.25, 0.3]} />
      <PartLabel partId="rm-hopper" at={[0, Y + 0.6, 0.1]} />
    </Part>
  )
}

function SieveShaker() {
  const p = useSizeReduction()
  const s = useMemo(() => analyseSieves(p.sieveRetainedG), [p.sieveRetainedG])
  const R = 0.12
  const geo = useMemo(() => {
    const { rim, mesh, pan } = testSieve({ r: R, h: 0.05, wall: 0.006, mesh: 0.002 })
    const lid = shakerLid({ r: R })
    const heap = lathe(
      [
        [0, 0],
        [R * 0.85, 0],
        [0, 0.04],
      ],
      32,
    )
    const base = shakerBase({ rBase: 0.24, rTop: 0.2, h: 0.18 })
    const rod = cylinder(0.008, 0.6, 12)
    return { rim, mesh, pan, lid, heap, base, rod }
  }, [])
  const stack = useRef<THREE.Group>(null)
  useSimFrame((_dt, t) => {
    if (!p.shakerActive) return
    live.shakerPhase = t * 2 * PI * 4
    stack.current?.position.set(0.006 * cos(live.shakerPhase), 0.004 * Math.abs(sin(live.shakerPhase)), 0.006 * sin(live.shakerPhase))
  })
  const y0 = 0.22
  return (
    <Part id="sieve-shaker" name="Sieve shaker" role="moving" material="paintGrey" info={INFO.shaker} cites={C.sieve}>
      <Part id="ss-base" name="Shaker base" role="housing" material="paintGrey" info={INFO.shaker}>
        <PartMesh geometry={geo.base} />
        {[-1, 1].map((k) => (
          <PartMesh key={k} geometry={geo.rod} position={[k * (R + 0.03), 0.48, 0]} material="steel" />
        ))}
      </Part>
      <group ref={stack}>
        <Part id="ss-trays" name="IS sieve stack and pan" role="static" material="brass" info={INFO.trays} cites={C.sieve}>
          {s.pct.map((pc, i) => {
            const y = y0 + (7 - i) * 0.055
            return (
              <group key={i} position={[0, y, 0]}>
                <PartMesh geometry={geo.rim} />
                <PartMesh geometry={i === 7 ? geo.pan : geo.mesh} material={i === 7 ? 'brass' : 'steel'} />
                {pc > 0.2 ? <PartMesh geometry={geo.heap} position={[0, 0.004, 0]} scale={[Math.min(1, 0.35 + pc / 40), Math.min(1.1, pc / 30), Math.min(1, 0.35 + pc / 40)]} material="grain" /> : null}
              </group>
            )
          })}
          <PartMesh geometry={geo.lid} position={[0, y0 + 8 * 0.055, 0]} material="paintBlack" />
        </Part>
      </group>
      <PartLabel partId="ss-trays" at={[0.2, 0.5, 0.1]} />
    </Part>
  )
}

export function SizeReduction3D() {
  const machine = useSizeReduction((s) => s.machine)
  return (
    <group>
      {machine === 'hammer' ? <HammerMill /> : machine === 'burr' ? <BurrMill /> : machine === 'roller' ? <RollerMill /> : null}
      <group position={machine === 'shaker' ? [0, 0, 0] : [1.4, 0, 0]}>
        <SieveShaker />
      </group>
    </group>
  )
}
