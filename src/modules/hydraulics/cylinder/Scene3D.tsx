import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { pipe } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { CAP_PIN_X, annulusOil, buildCylinderGeometry, glandParts, rodParts } from './geometry'
import { BARREL_IN, DIM, MG1617, PORT_CAP_X, PORT_ROD_X, REF_RO, ROD_LEN, VALVE, X0, compute, live, useCyl } from './model'


const C = {
  cyl: [MG1617('Q(c)–(d): double-acting cylinder sketch and worked example')],
  ram: [SRC.top510('p11 (book p398): ram sizing'), SRC.hy510('p1–2: ram cylinder with piston')],
}

const INFO = {
  cylinder: {
    summary: 'Double-acting hydraulic cylinder (ram), cut in half.',
    role: 'Turns hydraulic pressure into a straight-line push or pull. Oil pumped into the left (cap-end) port extends it and forces oil out of the right port; oil pumped into the right port retracts it.',
    details: 'Drawn at 80 mm bore × 300 mm stroke; the bore and rod sliders rescale it. Welded-cap construction with a screwed gland at the rod end.',
  },
  barrel: {
    summary: 'Barrel (cylinder tube) with the two oil ports.',
    role: 'A honed steel tube that contains the oil pressure and guides the piston. Each port is welded on as a boss and drilled through to the bore.',
  },
  cap: {
    summary: 'Cap end with clevis eye.',
    role: 'Closes the full-bore end of the barrel. The eye takes a pin so the cylinder can swing on its mounting as the linkage moves.',
  },
  piston: {
    summary: 'Piston.',
    role: 'Divides the barrel into two chambers. Full-bore area A acts on the cap side; on the rod side only the annulus A − a is available, so the same pressure pushes harder than it pulls.',
  },
  seals: {
    summary: 'Piston seals.',
    role: 'Stop oil leaking past the piston from the high-pressure chamber to the low-pressure one. Leakage here would make the ram creep under load.',
  },
  wear: { summary: 'Wear (guide) ring.', role: 'A bronze/polymer band that keeps the steel piston off the bore so only the ring rubs.' },
  rod: {
    summary: 'Piston rod (hard-chromed).',
    role: 'Carries the force out of the cylinder. Its area a is lost on the rod side, which is why retracting is faster but weaker than extending.',
  },
  rodEye: { summary: 'Rod eye.', role: 'Pinned to the part being moved (e.g. the lift crank or a loader arm).' },
  gland: {
    summary: 'Gland (rod-end head).',
    role: 'Closes the rod end, guides the rod, and holds the rod seal and the wiper.',
  },
  rodSeal: { summary: 'Rod seal.', role: 'Seals the pressurised rod-side oil where the rod leaves the barrel.' },
  wiper: { summary: 'Wiper (scraper) seal.', role: 'Wipes dirt off the rod as it retracts so it is not dragged into the rod seal.' },
  capOil: { summary: 'Oil in the cap-end (full-bore) chamber.', role: 'Red when it is the pressure side (extending or holding the load), amber when it is being returned to the tank.' },
  rodOil: { summary: 'Oil in the rod-end (annulus) chamber.', role: 'Red when pressurised (retracting), amber when it is being pushed back to the tank.' },
  valve: {
    summary: 'Direction-control valve (spool type, closed centre).',
    role: 'Shift the spool one way and pump oil (P) goes to port A, the cap end, while the rod end (B) returns to the tank (T): the ram extends. Shift it the other way and P goes to B, A to T: it retracts. In the centre both lands cover A and B, trapping the oil so the ram holds its load.',
    details: 'Four-port, three-position spool drawn to show the principle; on a tractor lift the control valve is usually lever-operated.',
  },
  spool: { summary: 'Valve spool.', role: 'Its lands open and close the ports as it slides in the bore.' },
  ports: { summary: 'Hoses to the control valve.', role: 'One line carries pump pressure, the other returns oil to the reservoir; the control valve swaps them to reverse the cylinder.' },
}

const PRESSURE = new THREE.Color('#d8452e')
const RETURN = new THREE.Color('#c99a2e')
const HELD = new THREE.Color('#9b3a2a')

export function Cylinder3D() {
  const g = buildCylinderGeometry()
  const bore = useCyl((s) => s.bore)
  const rodD = useCyl((s) => s.rod)
  const flows = useCyl((s) => s.flows)
  const acting = useCyl((s) => s.acting)
  const spoolRef = useRef<THREE.Group>(null)
  const k = bore / DIM.refBore
  const R = bore / 2
  const RO = REF_RO * k
  const rodR = rodD / 2

  const gland = useMemo(() => glandParts(rodR, R, RO), [rodR, R, RO])
  const rod = useMemo(() => rodParts(rodR, ROD_LEN), [rodR])
  const annGeo = useMemo(() => annulusOil(rodR, R), [rodR, R])

  const capOilMat = useMemo(() => createDynamicCutMaterial({ color: '#d8452e', hatch: 'fluid', roughness: 0.2 }), [])
  const rodOilMat = useMemo(() => createDynamicCutMaterial({ color: '#c99a2e', hatch: 'fluid', roughness: 0.2 }), [])

  const portTop = RO + DIM.portBossH * k
  const hoses = useMemo(() => {
    const mk = (x: number, endX: number, rise: number) =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, portTop - 0.002, 0),
        new THREE.Vector3(x, portTop + 0.04, 0),
        new THREE.Vector3(x + (endX - x) * 0.25, portTop + rise, 0),
        new THREE.Vector3(endX, portTop + rise + 0.015, 0),
      ])
    const capC = mk(PORT_CAP_X, -0.12, 0.1)
    const rodC = mk(PORT_ROD_X, -0.12, 0.16)
    return { capC, rodC, capGeo: pipe(capC, 0.009, 0.0062, 40, 16), rodGeo: pipe(rodC, 0.009, 0.0062, 40, 16) }
  }, [portTop])

  // flow paths: hose → port → into the chamber (reversed copies for outflow)
  const paths = useMemo(() => {
    const into = (c: THREE.Curve<THREE.Vector3>, x: number, dirX: number) => {
      const pts = c.getPoints(20).reverse()
      pts.push(new THREE.Vector3(x, RO - 0.004, 0), new THREE.Vector3(x, 0.4 * R, 0), new THREE.Vector3(x + dirX * 0.03, 0, 0))
      return new THREE.CatmullRomCurve3(pts)
    }
    const capIn = into(hoses.capC, PORT_CAP_X, 1)
    const rodIn = into(hoses.rodC, PORT_ROD_X, -1)
    const rev = (c: THREE.CatmullRomCurve3) => new THREE.CatmullRomCurve3(c.points.slice().reverse())
    return { capIn, capOut: rev(capIn), rodIn, rodOut: rev(rodIn) }
  }, [hoses, R, RO])

  const pistonRef = useRef<THREE.Group>(null)
  const capOil = useRef<THREE.Mesh>(null)
  const rodOil = useRef<THREE.Mesh>(null)
  const st = useRef({ x: 0, dir: 1 as 1 | -1, dwell: 0 })

  useSimFrame((dt) => {
    const p = useCyl.getState()
    const r = compute(p)
    const s = st.current
    let want: 1 | -1 | 0 = 0
    if (p.motion === 'extend') want = 1
    else if (p.motion === 'retract') want = -1
    else if (p.motion === 'cycle') {
      if (s.dwell > 0) {
        s.dwell -= dt
        want = 0
      } else {
        want = s.dir
        if ((s.dir === 1 && s.x >= DIM.stroke - 1e-6) || (s.dir === -1 && s.x <= 1e-6)) {
          s.dir = s.dir === 1 ? -1 : 1
          s.dwell = 0.6
          want = 0
        }
      }
    }
    let v = 0
    let phase: typeof live.phase = 'holding'
    if (want === 1) {
      if (r.stallExtend) phase = 'stalled'
      else if (s.x < DIM.stroke) {
        v = r.c.speedExtend
        phase = 'extending'
      }
    } else if (want === -1) {
      if (p.acting === 'single') {
        // single-acting: the valve opens the cap end to tank and the load pushes the ram back in
        if (r.loadN > 0 && s.x > 0) {
          v = -r.c.speedExtend
          phase = 'retracting'
        }
      } else if (r.stallRetract) phase = 'stalled'
      else if (s.x > 0) {
        v = -r.c.speedRetract
        phase = 'retracting'
      }
    }
    s.x = Math.min(DIM.stroke, Math.max(0, s.x + v * dt))
    const atEnd = (want === 1 && s.x >= DIM.stroke) || (want === -1 && s.x <= 0)
    if (atEnd && phase !== 'stalled' && !(p.acting === 'single' && want === -1)) phase = 'stalled' // dead-headed: pump flow over the relief valve
    const single = p.acting === 'single'
    spoolRef.current?.position.set(0, -want * VALVE.shift, 0)
    if (rodOil.current) rodOil.current.visible = !single

    const xp = X0 + s.x
    pistonRef.current?.position.set(xp, 0, 0)
    if (capOil.current) {
      capOil.current.scale.set(Math.max(1e-4, xp), R - 0.0002, R - 0.0002)
    }
    if (rodOil.current) {
      rodOil.current.position.x = xp + DIM.pistonW
      rodOil.current.scale.x = Math.max(1e-4, BARREL_IN - xp - DIM.pistonW)
    }

    // colours: which side is pressurised
    const pRelief = p.p
    let pCap = 0
    let pRod = 0
    if (phase === 'extending') pCap = r.pExtend / 1e6
    else if (phase === 'retracting') pRod = single ? 0 : Math.max(r.pRetract / 1e6, 0.3)
    else if (phase === 'stalled') {
      if (want === 1) pCap = pRelief
      else pRod = pRelief
    } else pCap = Math.max(0, r.pExtend / 1e6) // held load is carried by trapped oil
    const capCol = pCap > 0.05 ? (phase === 'holding' ? HELD : PRESSURE) : RETURN
    const rodCol = pRod > 0.05 ? PRESSURE : RETURN
    capOilMat.material.color.copy(capCol)
    capOilMat.capColor.copy(capCol)
    rodOilMat.material.color.copy(rodCol)
    rodOilMat.capColor.copy(rodCol)
    const inter = useView.getState().cut.intersection
    capOilMat.material.clipIntersection = inter
    rodOilMat.material.clipIntersection = inter

    live.x = s.x
    live.phase = phase
    live.v = v
    live.pCap = pCap
    live.pRod = pRod
    live.qIn = phase === 'extending' || (phase === 'retracting' && !single) ? p.Q : 0
    live.qOut = phase === 'extending' ? (single ? 0 : r.c.returnFlowExtend) : phase === 'retracting' ? (single ? p.Q : r.c.returnFlowRetract) : 0
    live.valve = want
  })

  const speedK = () => Math.min(1, Math.abs(live.v) / 0.25) * 0.8 + 0.2

  return (
    <group>
      <Part id="cylinder" name="Double-acting cylinder" role="housing" material="paintYellow" info={INFO.cylinder} cites={C.cyl}>
        <Part id="barrel" name="Barrel & ports" material="paintYellow" role="housing" info={INFO.barrel} cites={C.cyl}>
          <PartMesh geometry={g.barrel} scale={[1, k, k]} />
        </Part>
        <Part id="cap-end" name="Cap end & clevis eye" material="paintYellow" role="housing" info={INFO.cap} cites={C.cyl} explode={[-0.12, 0, 0]}>
          <PartMesh geometry={g.cap} scale={[1, k, k]} />
          <Part id="cap-pin" name="Clevis pin" material="steel" role="static" info={{ summary: 'Mounting pin.', role: 'Lets the cylinder pivot on its anchor.' }}>
            <PartMesh geometry={g.pin} position={[CAP_PIN_X, 0, 0]} />
          </Part>
        </Part>
        <Part id="gland" name="Gland (rod-end head)" material="steelDark" role="housing" info={INFO.gland} cites={C.cyl} explode={[0.14, 0, 0]}>
          <PartMesh geometry={gland.body} />
          <Part id="rod-seal" name="Rod seal" material="rubber" role="static" info={INFO.rodSeal} cites={C.cyl}>
            <PartMesh geometry={gland.rodSeal} />
          </Part>
          <Part id="wiper" name="Wiper seal" material="rubber" role="static" info={INFO.wiper} beyondNotes>
            <PartMesh geometry={gland.wiper} />
          </Part>
        </Part>

        <Part id="cap-oil" name="Cap-end oil" role="fluid" info={INFO.capOil} cites={C.cyl}>
          <PartMesh ref={capOil} geometry={g.unitOil} customMaterial={capOilMat.material} castShadow={false} />
        </Part>
        <Part id="rod-oil" name="Rod-end (annulus) oil" role="fluid" info={INFO.rodOil} cites={C.cyl}>
          <PartMesh ref={rodOil} geometry={annGeo} customMaterial={rodOilMat.material} castShadow={false} />
        </Part>

        <group ref={pistonRef} position={[X0, 0, 0]}>
          <Part id="piston-assembly" name="Piston & rod" role="moving" material="steel" info={INFO.piston} cites={C.cyl} explode={[0.05, 0.16, 0]}>
            <group scale={[1, k, k]}>
              <Part id="piston" name="Piston" material="steel" info={INFO.piston} cites={C.cyl}>
                <PartMesh geometry={g.piston} />
              </Part>
              <Part id="piston-seals" name="Piston seals" material="rubber" info={INFO.seals} cites={C.cyl} explode={[0, 0.04, 0]}>
                <PartMesh geometry={g.seals} />
              </Part>
              <Part id="wear-ring" name="Wear ring" material="bronze" info={INFO.wear} beyondNotes explode={[0, 0.06, 0]}>
                <PartMesh geometry={g.wearRing} />
              </Part>
            </group>
            <group position={[DIM.pistonW, 0, 0]}>
              <Part id="rod" name="Piston rod" material="chrome" info={INFO.rod} cites={C.cyl} explode={[0.08, 0, 0]}>
                <PartMesh geometry={rod.rod} />
                <Part id="rod-eye" name="Rod eye" material="forged" info={INFO.rodEye} cites={C.cyl}>
                  <PartMesh geometry={rod.eye} />
                  <PartMesh geometry={g.pin} material="steel" position={[rod.eyePinX, 0, 0]} />
                </Part>
              </Part>
            </group>
          </Part>
        </group>

        <group position={[VALVE.x, portTop + 0.135, 0]}>
          <Part id="valve" name="Direction-control valve" material="castIron" role="housing" info={INFO.valve} cites={[SRC.hy510('p1–2, Fig 40 control valve'), ...C.cyl]} beyondNotes explode={[-0.08, 0, 0]}>
            <PartMesh geometry={g.valveBody} />
            <group ref={spoolRef}>
              <Part id="spool" name="Valve spool" material="chrome" role="moving" info={INFO.spool} beyondNotes>
                <PartMesh geometry={g.spool} />
              </Part>
            </group>
          </Part>
        </group>
        <Part id="hoses" name="Hoses to the valve" material="rubber" role="static" info={INFO.ports} cites={C.cyl} cut={false}>
          <PartMesh geometry={hoses.capGeo} />
          <PartMesh geometry={hoses.rodGeo} />
        </Part>

        {flows ? (
          <>
            <Flow curve={paths.capIn} count={40} radius={0.0032} color="#ff6a4a" speed={1.2} spread={0.004} intensity={() => (live.phase === 'extending' ? speedK() : 0)} />
            <Flow curve={paths.rodOut} count={40} radius={0.0032} color="#f2c14e" speed={1.2} spread={0.004} intensity={() => (live.phase === 'extending' && acting === 'double' ? speedK() : 0)} />
            <Flow curve={paths.rodIn} count={40} radius={0.0032} color="#ff6a4a" speed={1.2} spread={0.004} intensity={() => (live.phase === 'retracting' && acting === 'double' ? speedK() : 0)} />
            <Flow curve={paths.capOut} count={40} radius={0.0032} color="#f2c14e" speed={1.4} spread={0.004} intensity={() => (live.phase === 'retracting' ? speedK() : 0)} />
          </>
        ) : null}
      </Part>

      <PartLabel partId="barrel" at={[0.2, RO + 0.03, 0.05]} />
      <PartLabel partId="piston" at={[0.05, -R - 0.03, 0.05]} />
      <PartLabel partId="rod" at={[0.42, 0.04, 0.03]} />
      <PartLabel partId="gland" at={[BARREL_IN + 0.03, -RO - 0.02, 0.04]} />
      <PartLabel partId="cap-end" at={[-0.06, -0.04, 0.03]} />
      <PartLabel partId="piston-seals" at={[0.02, R + 0.01, 0.04]} />
      <PartLabel partId="hoses" at={[-0.1, portTop + 0.06, 0]} />
      <PartLabel partId="valve" at={[VALVE.x - 0.03, portTop + 0.23, 0.02]} />
      <PartLabel partId="cap-oil" at={[0.02, -0.01, 0.02]} />
      <PartLabel partId="rod-oil" at={[0.28, -R * 0.7, 0.02]} />
    </group>
  )
}
