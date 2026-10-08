/**
 * Kinematic drive graph.
 *
 * Bodies are rotating (or sliding) members with an angle θ and speed ω. Constraints are
 * linear relations between speeds (gear meshes, belts, differentials, planetary sets,
 * engaged clutches, brakes) plus non-linear angle maps (Hooke's joint). Each step:
 *   1. assemble A·ω = b from all active linear constraints and driver speeds,
 *   2. solve by Gaussian elimination with partial pivoting,
 *   3. any body left undetermined (e.g. downstream of a released clutch) coasts:
 *      it keeps its previous speed, decaying with its `drag`,
 *   4. integrate θ += ω·dt, then apply angle maps.
 */

export interface Body {
  id: string
  theta: number
  omega: number
  /** fractional speed loss per second when coasting (undetermined), e.g. 0.8 */
  drag: number
}

export interface LinearRow {
  /** coefficients by body id */
  c: Record<string, number>
  /** right-hand side */
  rhs: number
}

export interface Constraint {
  id: string
  /** return the rows this constraint currently imposes (may depend on state, e.g. clutch engaged) */
  rows(g: DriveGraph): LinearRow[]
}

export interface AngleMap {
  id: string
  /** bodies whose angle and speed this map sets (they are not integrated) */
  outputs: string[]
  /** recompute dependent body angle(s) and speed(s) after integration */
  apply(g: DriveGraph): void
}

export class DriveGraph {
  bodies = new Map<string, Body>()
  constraints: Constraint[] = []
  angleMaps: AngleMap[] = []
  /** driver speeds (rad/s) — each is an equation ω = value */
  drivers = new Map<string, number>()
  /** bodies left undetermined on the last solve */
  coasting = new Set<string>()

  body(id: string, drag = 0.6): Body {
    let b = this.bodies.get(id)
    if (!b) {
      b = { id, theta: 0, omega: 0, drag }
      this.bodies.set(id, b)
    }
    return b
  }

  get(id: string): Body {
    const b = this.bodies.get(id)
    if (!b) throw new Error(`DriveGraph: unknown body "${id}"`)
    return b
  }

  add(c: Constraint) {
    this.constraints.push(c)
    return c
  }

  addMap(m: AngleMap) {
    this.angleMaps.push(m)
    return m
  }

  drive(id: string, omega: number) {
    this.body(id)
    this.drivers.set(id, omega)
  }

  release(id: string) {
    this.drivers.delete(id)
  }

  solveSpeeds(dt: number) {
    const ids = [...this.bodies.keys()]
    const n = ids.length
    const index = new Map(ids.map((id, i) => [id, i]))
    const rows: number[][] = []
    const push = (c: Record<string, number>, rhs: number) => {
      const row = new Array(n + 1).fill(0)
      for (const [id, v] of Object.entries(c)) {
        const j = index.get(id)
        if (j === undefined) throw new Error(`DriveGraph: constraint refers to unknown body "${id}"`)
        row[j] += v
      }
      row[n] = rhs
      rows.push(row)
    }
    for (const [id, w] of this.drivers) push({ [id]: 1 }, w)
    // angle-mapped outputs act as known speeds for anything downstream (one-step lag is invisible)
    for (const m of this.angleMaps) for (const id of m.outputs) push({ [id]: 1 }, this.get(id).omega)
    for (const c of this.constraints) for (const r of c.rows(this)) push(r.c, r.rhs)

    // Gaussian elimination to reduced row echelon form
    const m = rows.length
    const pivotCol: number[] = []
    let r = 0
    for (let col = 0; col < n && r < m; col++) {
      let best = r
      for (let i = r + 1; i < m; i++) if (Math.abs(rows[i][col]) > Math.abs(rows[best][col])) best = i
      if (Math.abs(rows[best][col]) < 1e-10) continue
      ;[rows[r], rows[best]] = [rows[best], rows[r]]
      const p = rows[r][col]
      for (let j = col; j <= n; j++) rows[r][j] /= p
      for (let i = 0; i < m; i++) {
        if (i === r) continue
        const f = rows[i][col]
        if (f === 0) continue
        for (let j = col; j <= n; j++) rows[i][j] -= f * rows[r][j]
      }
      pivotCol.push(col)
      r++
    }

    // Free columns: coast with drag (keep previous speed, decaying)
    const isPivot = new Array(n).fill(false)
    for (const c of pivotCol) isPivot[c] = true
    const omega = new Array(n).fill(0)
    this.coasting.clear()
    for (let j = 0; j < n; j++) {
      if (!isPivot[j]) {
        const b = this.bodies.get(ids[j])!
        omega[j] = b.omega * Math.exp(-b.drag * dt)
        this.coasting.add(ids[j])
      }
    }
    // Back-substitute pivot rows with free values
    for (let i = 0; i < pivotCol.length; i++) {
      const col = pivotCol[i]
      let v = rows[i][n]
      for (let j = 0; j < n; j++) if (!isPivot[j] && rows[i][j] !== 0) v -= rows[i][j] * omega[j]
      omega[col] = v
    }
    ids.forEach((id, j) => {
      this.bodies.get(id)!.omega = omega[j]
    })
  }

  step(dt: number) {
    this.solveSpeeds(dt)
    const mapped = new Set(this.angleMaps.flatMap((m) => m.outputs))
    for (const b of this.bodies.values()) if (!mapped.has(b.id)) b.theta += b.omega * dt
    for (const m of this.angleMaps) m.apply(this)
  }
}

/* ------------------------------ Constraint helpers ------------------------------ */

/**
 * External gear mesh: ω_b = −(z_a / z_b)·ω_a. `internal: true` for a ring gear (same sense).
 * Belts and chains are `crossed: false` meshes with same-sense rotation: use `sameSense`.
 */
export function gearMesh(id: string, a: string, za: number, b: string, zb: number, opts: { sameSense?: boolean; active?: () => boolean } = {}): Constraint {
  const sign = opts.sameSense ? -1 : 1
  return {
    id,
    rows: () => (opts.active && !opts.active() ? [] : [{ c: { [a]: za, [b]: sign * zb }, rhs: 0 }]),
  }
}

/**
 * Belt or chain drive: ω_b·D_b = ±(1 − slip)·ω_a·D_a.
 * Open belt / chain: same sense. Crossed belt: opposite sense (Culpin Fig A2.1).
 */
export function beltDrive(id: string, a: string, Da: number, b: string, Db: number, crossed = false, slip = 0): Constraint {
  const k = (1 - slip) * Da
  return { id, rows: () => [{ c: { [a]: crossed ? k : -k, [b]: Db }, rhs: 0 }] }
}

/** Rigid coupling (or engaged clutch / dog): ω_a = ω_b while `engaged()` is true. */
export function coupling(id: string, a: string, b: string, engaged: () => boolean = () => true): Constraint {
  return { id, rows: () => (engaged() ? [{ c: { [a]: 1, [b]: -1 }, rhs: 0 }] : []) }
}

/** Brake / lock to ground: ω = 0 while `applied()`. */
export function brake(id: string, a: string, applied: () => boolean): Constraint {
  return { id, rows: () => (applied() ? [{ c: { [a]: 1 }, rhs: 0 }] : []) }
}

/**
 * Bevel differential: ω_case = (ω_left + ω_right)/2. One more equation is needed to fix the
 * split (e.g. a speed difference from steering, or a diff lock).
 */
export function differential(id: string, caseId: string, left: string, right: string): Constraint {
  return { id, rows: () => [{ c: { [caseId]: 2, [left]: -1, [right]: -1 }, rhs: 0 }] }
}

/**
 * Simple planetary (Willis): (ω_s − ω_c)·z_s = −(ω_r − ω_c)·z_r
 *  ⇔ z_s·ω_s + z_r·ω_r − (z_s + z_r)·ω_c = 0
 * Planet spin (relative to carrier): ω_p = ω_c − (z_s/z_p)(ω_s − ω_c)... returned by planetSpin().
 */
export function planetary(id: string, sun: string, zs: number, ring: string, zr: number, carrier: string): Constraint {
  return { id, rows: () => [{ c: { [sun]: zs, [ring]: zr, [carrier]: -(zs + zr) }, rhs: 0 }] }
}

/** Absolute planet angular speed for drawing planets spinning on their pins. */
export function planetSpin(omegaSun: number, omegaCarrier: number, zs: number, zp: number) {
  return omegaCarrier - (zs / zp) * (omegaSun - omegaCarrier)
}

/**
 * Hooke's (Cardan) joint as an angle map: tan θ_out = tan θ_in / cos β.
 * Output speed ratio ω_out/ω_in = cos β / (1 − sin²β·cos²θ_in) (AEE502; Dunn, Universal Couplings).
 */
export function hookeJoint(id: string, input: string, output: string, beta: () => number, phase = 0): AngleMap {
  return {
    id,
    outputs: [output],
    apply(g) {
      const a = g.get(input)
      const b = g.get(output)
      const th = a.theta - phase
      b.theta = hookeAngle(th, beta()) + phase
      b.omega = hookeSpeedRatio(th, beta()) * a.omega
    },
  }
}

/** Continuous Hooke's joint output angle (unwrapped, same number of turns as input). */
export function hookeAngle(thetaIn: number, beta: number) {
  const turns = Math.round(thetaIn / (2 * Math.PI))
  const base = thetaIn - turns * 2 * Math.PI // [-π, π]
  const out = Math.atan2(Math.sin(base), Math.cos(base) * Math.cos(beta))
  return out + turns * 2 * Math.PI
}

/** ω_out/ω_in for a Hooke's joint. */
export function hookeSpeedRatio(thetaIn: number, beta: number) {
  const s = Math.sin(beta)
  const c = Math.cos(thetaIn)
  return Math.cos(beta) / (1 - s * s * c * c)
}

/** Angular acceleration of the output for constant input speed ω (rad/s²). */
export function hookeAcceleration(thetaIn: number, beta: number, omega: number) {
  const s2 = Math.sin(beta) ** 2
  const c2 = Math.cos(thetaIn) ** 2
  return (-(omega * omega) * Math.cos(beta) * s2 * Math.sin(2 * thetaIn)) / (1 - c2 * s2) ** 2
}
