import { useMemo } from 'react'
import * as THREE from 'three'
import { box, mat4, merge, xform } from '@/geometry'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { gableRoof, walls, type Opening, type Side } from '@/parts/lib/structures'
import { C, ENCLOSED, evaluate, planById, useHouse, type Plan, type Room } from './model'

const T = 0.1 // half of a 200 mm wall: each room draws its own leaf
const SILL = 0.9
const HEAD = 2.1

const KIND_INFO: Record<string, { summary: string; role: string }> = {
  bedroom: { summary: 'Bedroom.', role: 'At least 9 m² and at least 3 m² per person, with cross-ventilation and insect mesh.' },
  multi: { summary: 'All-purpose room.', role: 'Sleeping, cooking, storage and animals share one room. Slept in, so the bedroom rule applies (≥ 9 m², ≥ 3 m² per person).' },
  living: { summary: 'Living / meeting room.', role: '12–15 m², or 25–30 m² if elaborately furnished.' },
  kitchen: { summary: 'Kitchen.', role: 'Large, with a separate rear entrance and a small rear veranda. Cook outside in warm humid areas; the cooking area is raised and protected from sun, rain, dust and animals.' },
  store: { summary: 'Store.', role: 'Pots and containers raised off the floor; kerosene stored outside; bulk grain in a separate store.' },
  office: { summary: 'Farm office.', role: 'About 9 m² on a large farm; on a small farm a dining table and a cupboard will do.' },
  wash: { summary: 'Washing.', role: 'Outdoor washing slab at least 3 m² with a shelter; floors slope to a drain and soak-away. A flush toilet needs a septic tank and drainage field.' },
  animals: { summary: 'Animal shelter.', role: 'Animals housed apart from the dwelling — the first improvement to a traditional house.' },
  corridor: { summary: 'Corridor.', role: 'Gives access to every room, but is dark and used only for circulation.' },
  veranda: { summary: 'Veranda.', role: 'Large veranda with mosquito netting; roof overhangs protect the entrances.' },
  yard: { summary: 'Yard / compound.', role: 'Outdoor living and working space between the rooms.' },
}

/** Openings in a room's walls: doors on its edges and windows on its exterior sides. */
function openingsFor(plan: Plan, r: Room): Opening[] {
  const out: Opening[] = []
  const eps = 0.05
  const sidesWithDoor = new Set<Side>()
  for (const d of plan.doors) {
    const w = d.w ?? 0.9
    if (d.axis === 'x' && d.x > r.x && d.x < r.x + r.w) {
      const side: Side | null = Math.abs(d.z - r.z) < eps ? '-z' : Math.abs(d.z - (r.z + r.d)) < eps ? '+z' : null
      if (side) {
        out.push({ side, at: d.x - (r.x + r.w / 2), width: w, height: HEAD })
        sidesWithDoor.add(side)
      }
    }
    if (d.axis === 'z' && d.z > r.z && d.z < r.z + r.d) {
      const side: Side | null = Math.abs(d.x - r.x) < eps ? '-x' : Math.abs(d.x - (r.x + r.w)) < eps ? '+x' : null
      if (side) {
        out.push({ side, at: d.z - (r.z + r.d / 2), width: w, height: HEAD })
        sidesWithDoor.add(side)
      }
    }
  }
  if (r.kind === 'store' || r.kind === 'corridor') return out
  // windows on sides that face outside (not another enclosed room)
  const cx = r.x + r.w / 2
  const cz = r.z + r.d / 2
  const probe: Record<Side, [number, number, number]> = {
    '-z': [cx, r.z - 0.3, r.w],
    '+z': [cx, r.z + r.d + 0.3, r.w],
    '-x': [r.x - 0.3, cz, r.d],
    '+x': [r.x + r.w + 0.3, cz, r.d],
  }
  for (const side of Object.keys(probe) as Side[]) {
    const [px, pz, len] = probe[side]
    const neighbour = plan.rooms.find((o) => o !== r && ENCLOSED(o.kind) && px > o.x && px < o.x + o.w && pz > o.z && pz < o.z + o.d)
    if (neighbour || len < 1.6) continue
    const ww = Math.min(1.2, len * 0.35)
    const at = sidesWithDoor.has(side) ? (len / 4) * (out.find((o) => o.side === side)!.at > 0 ? -1 : 1) : 0
    out.push({ side, at, width: ww, height: HEAD, sill: SILL })
  }
  return out
}

function beds(r: Room, n: number) {
  if (n <= 0 || (r.kind !== 'bedroom' && r.kind !== 'multi')) return null
  const gs: THREE.BufferGeometry[] = []
  for (let i = 0; i < n; i++) {
    const x = r.x + T + 0.15 + 0.45 + (i % 4) * 1.05
    const z = r.z + T + 0.1 + 0.95 + Math.floor(i / 4) * 2.05
    gs.push(xform(box(0.9, 0.45, 1.9), mat4.t(x, 0.225, z)))
  }
  return merge(...gs)
}

export function Scene3D() {
  const st = useHouse()
  const ev = useMemo(() => evaluate(st), [st])
  const plan = ev.plan
  const { minX, maxX, minZ, maxZ } = ev.bbox
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const yaw = ((90 - st.orient) * Math.PI) / 180
  const thatch = st.roof === 'thatch'
  const occByRoom = useMemo(() => {
    const m = new Map<Room, number>()
    ev.checks.forEach((c) => m.set(c.room, c.people))
    return m
  }, [ev])

  const g = useMemo(() => {
    const rooms = plan.rooms.map((r) => ({
      floor: box(r.w, 0.1, r.d),
      walls: ENCLOSED(r.kind) ? walls({ w: r.w, d: r.d, h: st.wallH, t: T, openings: openingsFor(plan, r) }) : null,
      beds: beds(r, occByRoom.get(r) ?? 0),
    }))
    const roofs = plan.roofs.map((f) => {
      const alongX = f.w > f.d
      const span = alongX ? f.d : f.w
      const len = alongX ? f.w : f.d
      return { geo: gableRoof({ span, length: len, pitchDeg: st.pitch, overhang: thatch ? 0.6 : 0.45, t: thatch ? 0.25 : 0.06 }).geometry, x: f.x + f.w / 2, z: f.z + f.d / 2, rot: alongX ? Math.PI / 2 : 0 }
    })
    const plinth = box(maxX - minX + 0.6, Math.max(0.02, st.plinth), maxZ - minZ + 0.6)
    // yard boundary wall with a gate (courtyard type)
    let yardWall: THREE.BufferGeometry | null = null
    if (plan.enclosedYard) {
      const y = plan.rooms.find((r) => r.kind === 'yard')!
      const gate = plan.doors[plan.doors.length - 1]
      const gw = gate.w ?? 1.5
      const a = gate.x - gw / 2 - y.x
      const b = y.x + y.w - (gate.x + gw / 2)
      yardWall = merge(xform(box(a, 1.8, 0.2), mat4.t(y.x + a / 2, 0.9, y.z + y.d - 0.1)), xform(box(b, 1.8, 0.2), mat4.t(gate.x + gw / 2 + b / 2, 0.9, y.z + y.d - 0.1)))
    }
    return { rooms, roofs, plinth, yardWall, ground: box(80, 0.2, 80) }
  }, [plan, st.wallH, st.pitch, st.plinth, thatch, occByRoom, minX, maxX, minZ, maxZ])

  const top = st.plinth
  const labelled = plan.rooms.map((r, i) => ({ r, i })).filter(({ r }) => r.kind !== 'corridor')

  return (
    <group>
      <Part id="site" name="Site" role="static" material="crop" info={{ summary: 'Well-drained house site.', role: 'Never on a flood plain; suits a well, latrine or septic tank with a drainage field; with a view of the access road and the farmstead.' }} cites={[C.ln('p12')]} cut={false}>
        <PartMesh geometry={g.ground} position={[0, -0.1, 0]} receiveShadow />
      </Part>
      <group rotation={[0, yaw, 0]}>
        <group position={[-cx, 0, -cz]}>
          <Part id="plinth" name="Raised floor (plinth)" role="housing" material="concrete" info={{ summary: 'Raised floor.', role: 'Floor raised 10–15 cm above the outside ground, on a waterproof foundation, with cut-off drains around.' }} cites={[C.ln('p19')]}>
            <PartMesh geometry={g.plinth} position={[(minX + maxX) / 2, Math.max(0.02, st.plinth) / 2, (minZ + maxZ) / 2]} receiveShadow />
          </Part>
          <Part id="rooms" name={planById(st.plan).name} role="housing" material="concrete" info={{ summary: planById(st.plan).name, role: `${planById(st.plan).pros} ${planById(st.plan).cons}` }} cites={[C.ln(planById(st.plan).cite)]}>
            {plan.rooms.map((r, i) => {
              const c = ev.checks.find((k) => k.room === r)
              const geo = g.rooms[i]
              return (
                <Part
                  key={`${st.plan}-${i}`}
                  id={`room-${i}`}
                  name={r.name}
                  role="housing"
                  material={r.kind === 'yard' ? 'soil' : 'concrete'}
                  info={{ ...KIND_INFO[r.kind], details: `${(r.w * r.d).toFixed(1)} m² (${r.w.toFixed(2)} × ${r.d.toFixed(2)} m)${c ? ` — needs ${c.check!.need}${c.people ? ` for ${c.people} ${c.people === 1 ? 'person' : 'people'}` : ''}: ${c.check!.ok ? 'meets the rule' : 'too small'}` : ''}` }}
                  cites={[C.ln('p17–19 room standards')]}
                  position={[r.x + r.w / 2, top, r.z + r.d / 2]}
                >
                  <PartMesh geometry={geo.floor} position={[0, r.kind === 'yard' ? -top + 0.06 : 0.05, 0]} material={r.kind === 'yard' ? 'soil' : r.kind === 'wash' ? 'ceramic' : 'concrete'} receiveShadow />
                  {geo.walls ? <PartMesh geometry={geo.walls} position={[0, 0.1, 0]} material={r.kind === 'animals' ? 'wood' : 'concrete'} castShadow receiveShadow /> : null}
                  {geo.beds ? <PartMesh geometry={geo.beds} position={[-(r.x + r.w / 2), 0.1, -(r.z + r.d / 2)]} material={c && !c.check!.ok ? 'paintRed' : 'leather'} /> : null}
                </Part>
              )
            })}
            {g.yardWall ? (
              <Part id="yard-wall" name="Yard wall and gate" role="housing" material="concrete" info={{ summary: 'Yard wall and gate.', role: 'Closes the courtyard so the rooms open onto a secure, private yard.' }} cites={[C.ln('p16')]}>
                <PartMesh geometry={g.yardWall} castShadow />
              </Part>
            ) : null}
          </Part>
          <Part id="roof" name={thatch ? 'Thatch roof' : 'Corrugated roof'} role="housing" material={thatch ? 'straw' : 'galvanised'} info={{ summary: thatch ? 'Thatch roof.' : 'Corrugated steel roof.', role: thatch ? 'Thatch needs a slope of about 45° and eaves at least 2 m above the ground.' : 'Insulated ceilings reduce temperature extremes under corrugated roofs; good overhangs protect walls and entrances.' }} cites={[C.ln('p19–20')]} explode={[0, 5, 0]}>
            {g.roofs.map((f, i) => (
              <PartMesh key={i} geometry={f.geo} position={[f.x, top + 0.1 + st.wallH, f.z]} rotation={[0, f.rot, 0]} castShadow />
            ))}
          </Part>
          {labelled.map(({ r, i }) => (
            <PartLabel key={`${st.plan}-${i}`} partId={`room-${i}`} at={[r.x + r.w / 2, top + 1.2, r.z + r.d / 2]} text={`${r.name.split(' (')[0]} · ${(r.w * r.d).toFixed(1)} m²`} />
          ))}
        </group>
      </group>
      <PartLabel partId="site" at={[0, 0.5, -Math.max(maxX - minX, maxZ - minZ) / 2 - 5]} text="North ↑" />
    </group>
  )
}

