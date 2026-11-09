import { Html } from '@/render/Html'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { lastFired } from '@/physics/engineExtra'
import { strokeAt } from '@/physics/engine'
import { Engine, engineFrame, type EnginePartKey, type EnginePartOverride, type GasMaterial } from '@/machines/Engine'
import { PartLabel } from '@/render/Label'
import { Part } from '@/render/Part'
import { STROKE_COLOR, currentLayout, live, useMulti } from './model'

const { PI } = Math

const C = {
  crank: [SRC.tb509('§2.6.4, Fig 2.5 crankshafts for 2-, 3-, 4- and 6-cylinder engines')],
  firing: [SRC.l4_509('firing order, advantages'), SRC.tb509('§2.6.4, Table 2.3')],
  parts: [SRC.l4_509('Parts description'), SRC.tb509('Table 2.1, Fig 2.1')],
  cool: [SRC.supp509('cooling'), SRC.tb509('Ch 7')],
  lube: [SRC.supp509('lubrication'), SRC.tb509('Ch 6')],
}

const INFO = {
  engine: {
    summary: 'Inline four-stroke tractor diesel with 2, 3, 4, 6 or 8 cylinders on one crankshaft (100 × 124 mm per cylinder), every part working.',
    details: 'Choose the number of cylinders and the firing order in the Controls tab. The crankshaft is rebuilt so its throws match the firing order you pick, and the camshaft so each cylinder’s valves open in that order.',
  },
  crankshaft: {
    summary: 'Crankshaft: one throw per cylinder, main journals between the throws.',
    role: 'Its shape fixes where every piston is at any moment, and therefore the firing order the engine can use. In a four-cylinder engine pistons 1 & 4 travel together, and so do 2 & 3; a two-cylinder crank has its pins 180° apart.',
  },
  flywheel: {
    summary: 'Flywheel with starter ring gear.',
    role: 'Multi-cylinder engines need a smaller, lighter flywheel than a single: the power strokes come more often, so there is less to carry the crankshaft through.',
  },
  gas: {
    summary: 'Gas in each cylinder, coloured by stroke.',
    role: 'Blue = intake, green = compression, orange = power (bright at the moment of firing), grey = exhaust — the same colours as the firing chart.',
  },
}

/** the scene's own ids, cards and sources for the shared engine's parts */
const IDS: Partial<Record<EnginePartKey, string>> = { crank: 'crankshaft', 'cylinder-gas': 'gas' }
const PARTS: Partial<Record<EnginePartKey, EnginePartOverride>> = {
  block: { cites: C.parts },
  liners: { cites: [SRC.man509('liner (sleeve)')] },
  coolant: { cites: C.cool },
  'main-bearings': { cites: [SRC.l4_509('bearings')] },
  head: { cites: C.parts },
  injectors: { cites: [SRC.tb509('p25, Fig 4.9')] },
  sump: { cites: C.lube },
  oil: { cites: C.lube },
  crank: { info: INFO.crankshaft, cites: C.crank },
  flywheel: { info: INFO.flywheel, cites: [SRC.tb509('p11')] },
  conrods: { cites: C.parts },
  pistons: { cites: C.parts },
  'cylinder-gas': { name: 'Cylinder gas', info: INFO.gas, cites: C.firing },
}
const k = (key: EnginePartKey) => IDS[key] ?? key

const FIRE = new THREE.Color('#fff1c9')
const HOT = new THREE.Color('#d8c35a')

/** colour of a cylinder's gas at cycle angle ψ (deg, 0 = TDC before intake): its stroke's colour, bright as it fires */
function strokeLook(psi: number, out: THREE.Color) {
  const stroke = strokeAt(psi)
  out.set(STROKE_COLOR[stroke])
  let glow = 0
  if (stroke === 'compression') out.lerp(HOT, (psi - 180) / 180)
  if (stroke === 'power') {
    glow = Math.max(0, 1 - ((psi - 360) / 180) * 1.6)
    out.lerp(FIRE, glow * 0.7)
  }
  return { stroke, glow }
}

export function Multi3D() {
  const n = useMulti((s) => s.n)
  const layoutId = useMulti((s) => s.layout)
  const gasOn = useMulti((s) => s.gas)
  const layout = currentLayout(n, layoutId)
  const F = useMemo(() => engineFrame(layout.firing), [layout])

  const theta = useRef(0)
  const tags = useRef<(HTMLDivElement | null)[]>([])
  const tmp = useMemo(() => new THREE.Color(), [])

  useSimFrame((dt) => {
    const st = useMulti.getState()
    const lay = currentLayout(st.n, st.layout)
    theta.current = (theta.current + st.rpm * 6 * dt) % 1440
    const th = theta.current
    lay.firing.forEach((f, i) => {
      const tag = tags.current[i]
      if (!tag) return
      const { stroke, glow } = strokeLook((((th - f) % 720) + 720) % 720, tmp)
      tag.style.background = stroke === 'power' && glow > 0.05 ? `rgba(232,121,79,${0.35 + 0.65 * glow})` : 'rgba(12,17,15,0.75)'
      tag.style.borderColor = STROKE_COLOR[stroke]
    })
    const lf = lastFired(lay.firing, th % 720)
    live.theta = th % 720
    live.lastFired = lf.cylinder
    live.sinceFire = lf.since
  })

  const gasStyle = useMemo(
    () => (_: number, deg: number, m: GasMaterial) => {
      const { glow } = strokeLook(deg, m.material.color)
      m.capColor.copy(m.material.color)
      m.material.emissive.setRGB(1, 0.45, 0.12).multiplyScalar(glow * 0.9)
    },
    [],
  )

  const top = F.headY + 0.2

  return (
    <group>
      <Part id="engine" name={`${n}-cylinder inline engine`} role="housing" material="castIron" info={INFO.engine} cites={C.crank}>
        <Engine firing={layout.firing} crankAngle={() => (theta.current * PI) / 180} k={k} parts={PARTS} gas={gasOn} gasStyle={gasStyle} />
      </Part>

      {F.cylZ.map((z, i) => (
        <Html key={`${n}-${i}`} position={[0.03, top, z]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
          <div
            ref={(el) => void (tags.current[i] = el)}
            style={{ border: '1.5px solid #4f8fd0', borderRadius: 6, padding: '1px 6px', font: '600 12px Inter, sans-serif', color: '#e8efe9', background: 'rgba(12,17,15,0.75)' }}
          >
            {i + 1}
          </div>
        </Html>
      ))}

      <PartLabel partId="crankshaft" at={[0.12, -0.08, F.ll / 2 - 0.05]} />
      <PartLabel partId="flywheel" at={[0.16, 0.16, F.flywheelZ - 0.02]} />
      <PartLabel partId="pistons" at={[0.08, 0.27, F.front]} />
      <PartLabel partId="conrods" at={[0.08, 0.1, F.rear]} />
      <PartLabel partId="block" at={[0.15, 0.08, 0]} />
      <PartLabel partId="head" at={[0.12, F.headY + 0.05, F.rear]} />
      <PartLabel partId="injectors" at={[0.04, F.headY + 0.17, F.front]} />
      <PartLabel partId="sump" at={[0.16, -0.16, 0]} />
    </group>
  )
}
