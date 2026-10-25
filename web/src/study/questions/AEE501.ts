import { SRC } from '@/content/citations'
import { capacityAcres, capacityHa, crf, FT, MILE_KM, machineCosts, realRate, tractorSalvagePct } from '@/physics/costs'
import { clearingCost } from '@/physics/harvest'
import { mowerCapacity } from '@/physics/hay'
import { n } from '@/ui/Working'
import type { Question } from '../types'
import { num, parametric, tnum, type Vals } from '../variants'

const ISU = SRC.mgmt501('ISU PM 710 worked example')

/** The ISU worksheet for the tractor question, from its inputs (percentages stored as %). */
const isuTractor = (v: Vals) =>
  machineCosts({
    list: v.list,
    purchase: v.P,
    years: v.years,
    hoursPerYear: v.hpy,
    salvagePct: tractorSalvagePct('150+', v.years, v.hpy),
    i: realRate(v.nom / 100, v.inf / 100),
    repair: 'tractor2wd',
    ptoHp: v.hp,
    fuelPrice: v.fuel,
    wage: v.wage,
    labourFactor: v.lf,
  })

const isuDisk = (v: Vals) =>
  machineCosts({ list: v.list, purchase: v.P, years: v.years, hoursPerYear: v.hpy, i: v.i / 100, repair: 'tandemDisk', hoursAtPurchase: v.h0, salvagePct: v.sal })

export const AEE501: Question[] = [
  parametric({
    id: '501-isu-tractor',
    course: 'AEE501',
    topic: 'Machinery costs',
    moduleId: 'testing',
    sceneId: 'costs',
    title: 'Ownership and operating cost of a large tractor',
    inputs: [
      { key: 'hp', value: 180, min: 150, max: 250, step: 10 },
      { key: 'list', value: 110000, min: 80000, max: 180000, step: 5000 },
      { key: 'P', value: 93500, min: 60000, max: 180000, step: 500 },
      { key: 'years', value: 15, min: 6, max: 15, step: 1 },
      { key: 'hpy', value: 400, min: 200, max: 600, step: 50 },
      { key: 'nom', value: 8, min: 6, max: 12, step: 0.5 },
      { key: 'inf', value: 3, min: 1, max: 5, step: 0.5 },
      { key: 'fuel', value: 1, min: 0.8, max: 3, step: 0.1 },
      { key: 'wage', value: 10, min: 8, max: 20, step: 0.5 },
      { key: 'lf', value: 1.1, min: 1.1, max: 1.2, step: 0.05 },
    ],
    statement: (v) =>
      `A ${num(v.hp)} PTO-hp diesel tractor lists at $${num(v.list)} and is bought for $${num(v.P)}. It is kept ${num(v.years)} years at ${num(v.hpy)} h/yr; interest ${num(v.nom)} % with ${num(v.inf)} % inflation; fuel $${num(v.fuel)}/gal, labour $${num(v.wage)}/h (×${num(v.lf)}). Salvage, CRF and repairs from the ISU tables. Find the ownership cost per hour, the operating cost per hour and the total cost per hour.`,
    answers: [
      { key: 'own', label: '\\text{ownership}', unit: '$/h', expected: 21.87 },
      { key: 'op', label: '\\text{operating}', unit: '$/h', expected: 24.69 },
      { key: 'total', label: '\\text{total}', unit: '$/h', expected: 46.56 },
    ],
    solve: (v) => {
      const c = isuTractor(v)
      return { own: c.ownershipHour, op: c.operatingHour, total: c.totalHour }
    },
    // a dealer discount of at most 25 % off list, and a real interest rate of at least 2 %
    valid: (v) => v.P <= v.list && v.P >= 0.75 * v.list && v.nom - v.inf >= 2,
    working: (v, r, original) => {
      const c = isuTractor(v)
      const i = realRate(v.nom / 100, v.inf / 100)
      return [
        { label: 'Salvage and capital recovery', tex: `S = ${n(tractorSalvagePct('150+', v.years, v.hpy))}\\%\\times L,\\quad CR = (P - S)\\,CRF + S\\,i`, sub: `(${tnum(v.P)} - ${n(c.salvage, 5)})\\times${c.crf} + ${n(c.salvage, 5)}\\times${tnum(i)}`, result: `= \\$${n(c.capitalRecovery, 4)}/\\text{yr}`, cite: ISU },
        { label: 'Ownership per hour', tex: '\\dfrac{CR + TIH}{h}', sub: `\\dfrac{${n(c.capitalRecovery, 4)} + ${n(c.tih, 3)}}{${tnum(v.hpy)}}`, result: `= \\$${n(r.own)}/\\text{h}` },
        { label: 'Operating per hour', tex: '\\text{repairs} + \\text{fuel} + \\text{lube} + \\text{labour}', sub: `${n(c.repairHour)} + ${n(c.fuelHour)} + ${n(c.lubeHour)} + ${n(c.labourHour)}`, result: `= \\$${n(r.op)}/\\text{h}`, ...(original ? { errata: 'The text also prints $18.09/h for the operating cost; its own items add to $24.69/h.' } : {}) },
        { label: 'Total', tex: '\\text{ownership} + \\text{operating}', result: `= \\$${n(r.total)}/\\text{h}` },
      ]
    },
    // the total follows from the student's ownership and operating costs
    follow: (_v, g) => ('own' in g && 'op' in g ? { total: g.own + g.op } : {}),
    cite: ISU,
    errata: 'isu-operating',
  }),
  parametric({
    id: '501-isu-disk',
    course: 'AEE501',
    topic: 'Machinery costs',
    moduleId: 'testing',
    sceneId: 'costs',
    title: 'Cost per acre of a used tandem disk',
    inputs: [
      { key: 'W', value: 28, min: 14, max: 36, step: 1 },
      { key: 'list', value: 30000, min: 15000, max: 60000, step: 1000 },
      { key: 'h0', value: 600, min: 200, max: 800, step: 50 },
      { key: 'P', value: 11000, min: 5000, max: 40000, step: 500 },
      { key: 'years', value: 8, min: 4, max: 10, step: 1 },
      { key: 'hpy', value: 100, min: 60, max: 150, step: 10 },
      { key: 'i', value: 5, min: 3, max: 8, step: 0.5 },
      { key: 'sal', value: 24, min: 15, max: 35, step: 1 },
      { key: 'S', value: 6, min: 4, max: 8, step: 0.5 },
      { key: 'FE', value: 79, min: 70, max: 90, step: 1 },
      { key: 'T', value: 46.56, min: 25, max: 80, step: 0.5 },
    ],
    statement: (v) =>
      `A ${num(v.W)}-ft tandem disk (list $${num(v.list)}) with ${num(v.h0)} h on it is bought for $${num(v.P)} and kept ${num(v.years)} years at ${num(v.hpy)} h/yr, i = ${num(v.i)} %, salvage ${num(v.sal)} %. It works at ${num(v.S)} mph with ${num(v.FE)} % field efficiency behind the $${num(v.T)}/h tractor. Find the disk cost per hour, the field capacity (ac/h, = W·S·FE/8.25) and the cost per acre of the outfit (round the capacity to whole acres).`,
    answers: [
      { key: 'disk', label: '\\text{disk}', unit: '$/h', expected: 19.59 },
      { key: 'C', label: 'C', unit: 'ac/h', expected: 16.09 },
      { key: 'acre', label: '\\text{cost}', unit: '$/acre', expected: 4.13 },
    ],
    solve: (v) => {
      const d = isuDisk(v)
      const C = capacityAcres(v.W, v.S, v.FE / 100)
      return { disk: d.totalHour, C, acre: (v.T + d.totalHour) / Math.round(C) }
    },
    // a used disk sells for 20–70 % of list and above its final salvage value; its total hours
    // stay inside the repair table (2000 h)
    valid: (v) => v.P >= 0.2 * v.list && v.P <= 0.7 * v.list && v.P > (v.sal / 100) * v.list && v.h0 + v.years * v.hpy <= 2000,
    working: (v, r) => {
      const d = isuDisk(v)
      return [
        { label: 'Disk cost', tex: '\\text{ownership} + \\text{repairs}', sub: `${n(d.ownershipHour)} + ${n(d.repairHour)}`, result: `= \\$${n(r.disk)}/\\text{h}`, cite: ISU },
        { label: 'Field capacity', tex: 'C = \\dfrac{W S\\,FE}{8.25}', sub: `\\dfrac{${tnum(v.W)}\\times${tnum(v.S)}\\times${tnum(v.FE / 100)}}{8.25}`, result: `= ${n(r.C)}\\ \\text{ac/h}`, cite: SRC.mgmt501('field capacity') },
        { label: 'Cost per acre', tex: `\\dfrac{\\$${tnum(v.T)} + \\$${n(r.disk)}}{${Math.round(r.C)}}`, result: `= \\$${n(r.acre, 3)}/\\text{acre}` },
      ]
    },
    // cost per acre follows from the student's disk cost and field capacity
    follow: (v, g) => ('disk' in g && 'C' in g ? { acre: (v.T + g.disk) / Math.round(g.C) } : {}),
    cite: ISU,
  }),
  parametric({
    id: '501-slasher',
    course: 'AEE501',
    topic: 'Field capacity',
    moduleId: 'testing',
    sceneId: 'costs',
    title: 'Slasher field capacity',
    inputs: [
      { key: 'W', value: 5, min: 4, max: 10, step: 1 },
      { key: 'S', value: 8, min: 3, max: 10, step: 0.5 },
      { key: 'FE', value: 85, min: 70, max: 90, step: 1 },
    ],
    statement: (v) =>
      `A ${num(v.W)}-ft slasher works at ${num(v.S)} mph with a field efficiency of ${num(v.FE)} %. Find its theoretical and effective field capacities in ha/h (1 ft = 0.3048 m, 1 mile = 1.609 km).`,
    answers: [
      { key: 'Ct', label: 'C_t', unit: 'ha/h', expected: 1.96 },
      { key: 'Ce', label: 'C_e', unit: 'ha/h', expected: 1.67 },
    ],
    solve: (v) => {
      const W = v.W * FT
      const S = v.S * MILE_KM
      return { Ct: capacityHa(W, S, 1), Ce: capacityHa(W, S, v.FE / 100) }
    },
    working: (v, r, original) => [
      { label: 'Theoretical capacity', tex: 'C_t = \\dfrac{W S}{10}', sub: `\\dfrac{${n(v.W * FT, 4)}\\times${n(v.S * MILE_KM, 4)}}{10}`, result: `= ${n(r.Ct, 3)}\\ \\text{ha/h}`, cite: SRC.mgmt501('field capacity') },
      { label: 'Effective capacity', tex: 'C_e = FE\\cdot C_t', sub: `${tnum(v.FE / 100)}\\times${n(r.Ct, 3)}`, result: `= ${n(r.Ce, 3)}\\ \\text{ha/h}`, ...(original ? { errata: 'The question’s “8 m/h” is ambiguous; read as 8 km/h it gives 1.22 and 1.04 ha/h.' } : {}) },
    ],
    // effective capacity follows from the student's theoretical capacity
    follow: (v, g) => ('Ct' in g ? { Ce: (v.FE / 100) * g.Ct } : {}),
    cite: SRC.mgmt501('exam 2019/20, 2023/24 capacity question'),
    params: (v) => ({ W: v.W * FT, S: v.S * MILE_KM, feModel: false, FE: v.FE / 100, units: 'si', overlap: 0.05, passes: 10, L: 60 }),
  }),
  parametric({
    id: '501-sandel',
    course: 'AEE501',
    topic: 'Machinery costs',
    moduleId: 'testing',
    sceneId: 'costs',
    title: 'Depreciation of a large tractor',
    inputs: [
      { key: 'hp', value: 200, min: 150, max: 300, step: 10 },
      { key: 'P', value: 17, min: 8, max: 40, step: 0.5 },
      { key: 'disc', value: 5, min: 2, max: 15, step: 1 },
      { key: 'hpy', value: 600, min: 200, max: 600, step: 50 },
      { key: 'years', value: 10, min: 3, max: 15, step: 1 },
    ],
    statement: (v) =>
      `A ${num(v.hp)}-hp tractor costs ₦${num(v.P)} million after a ${num(v.disc)} % discount on the list price. It works ${num(v.hpy)} h/yr. From the salvage table (150+ hp class), find the remaining value percentage after ${num(v.years)} years and the depreciation.`,
    answers: [
      { key: 'pct', label: 'S/L', unit: '%', expected: 31, abs: 0.5 },
      { key: 'dep', label: 'D', unit: '₦ million', expected: 11.45 },
    ],
    solve: (v) => {
      const list = (v.P * 1e6) / (1 - v.disc / 100)
      const pct = tractorSalvagePct('150+', v.years, v.hpy)
      return { pct, dep: (v.P * 1e6 - (pct / 100) * list) / 1e6 }
    },
    // salvage is a fraction of list, so the tractor always depreciates; guard anyway
    valid: (_v, r) => r.dep > 0,
    working: (v, r) => {
      const L = v.P / (1 - v.disc / 100)
      return [
        { label: 'List price', tex: `L = \\dfrac{${tnum(v.P)}\\times10^6}{${tnum(1 - v.disc / 100)}}`, result: `= ₦${n(L)}\\ \\text{M}` },
        { label: 'Salvage', tex: 'S = (S/L)\\,L', sub: `${n(r.pct)}\\%\\times${n(L)}`, result: `= ₦${n((r.pct / 100) * L)}\\ \\text{M}`, cite: SRC.mgmt501('salvage table') },
        { label: 'Depreciation', tex: 'D = P - S', result: `= ₦${n(r.dep)}\\ \\text{M}` },
      ]
    },
    // depreciation follows from the student's salvage percentage
    follow: (v, g) => ('pct' in g ? { dep: (v.P * 1e6 - (g.pct / 100) * ((v.P * 1e6) / (1 - v.disc / 100))) / 1e6 } : {}),
    cite: SRC.mgmt501('SANDEL example'),
  }),
  parametric({
    id: '501-crf',
    course: 'AEE501',
    topic: 'Machinery costs',
    moduleId: 'testing',
    sceneId: 'costs',
    title: 'Capital recovery factor',
    inputs: [
      { key: 'i', value: 6, min: 3, max: 15, step: 0.5 },
      { key: 'years', value: 7, min: 3, max: 20, step: 1 },
    ],
    statement: (v) => `Find the capital recovery factor for ${num(v.years)} years at ${num(v.i)} % interest.`,
    answers: [{ key: 'crf', label: 'CRF', unit: '', expected: 0.179, abs: 0.001 }],
    solve: (v) => ({ crf: crf(v.i / 100, v.years) }),
    working: (v, r) => {
      const i = tnum(v.i / 100)
      const g = tnum(1 + v.i / 100)
      return [{ label: 'CRF', tex: 'CRF = \\dfrac{i(1+i)^n}{(1+i)^n - 1}', sub: `\\dfrac{${i}(${g})^{${tnum(v.years)}}}{${g}^{${tnum(v.years)}} - 1}`, result: `= ${n(r.crf, 3)}`, cite: SRC.mgmt501('Table 2') }]
    },
    cite: SRC.mgmt501('Table 2'),
  }),
  parametric({
    id: '501-clearing-1819',
    course: 'AEE501',
    topic: 'Land clearing',
    moduleId: 'implements',
    sceneId: 'land-clearing',
    title: 'Costing land-clearing options',
    inputs: [
      { key: 'A', value: 100, min: 40, max: 300, step: 10 },
      { key: 'dr', value: 15, min: 8, max: 25, step: 1 },
      { key: 'dh', value: 150000, min: 80000, max: 300000, step: 10000 },
      { key: 'br', value: 5, min: 3, max: 10, step: 1 },
      { key: 'bh', value: 50000, min: 30000, max: 100000, step: 5000 },
      { key: 'slash', value: 10000, min: 5000, max: 20000, step: 1000 },
      { key: 'stump', value: 5000, min: 2000, max: 10000, step: 500 },
      { key: 'crew', value: 4, min: 3, max: 8, step: 1 },
      { key: 'mr', value: 1, min: 0.5, max: 2, step: 0.5 },
    ],
    statement: (v) =>
      `About ${num(v.A)} acres must be cleared. A dozer clears ${num(v.dr)} acres/day at ₦${num(v.dh)}/day; a bale loader ${num(v.br)} acres/day at ₦${num(v.bh)}/day; manual clearing costs ₦${num(v.slash)} (slash) + ₦${num(v.stump)} (stump) per acre, with ${num(v.crew)} people clearing ${num(v.mr)} acre${v.mr === 1 ? '' : 's'} a day. Find the dozer cost and days, the bale-loader days, and the manual cost and days.`,
    answers: [
      { key: 'dc', label: '\\text{dozer cost}', unit: '₦', expected: 1_000_000 },
      { key: 'dd', label: '\\text{dozer days}', unit: 'days', expected: 6.67 },
      { key: 'bd', label: '\\text{loader days}', unit: 'days', expected: 20 },
      { key: 'mc', label: '\\text{manual cost}', unit: '₦', expected: 1_500_000 },
      { key: 'md', label: '\\text{manual days}', unit: 'days', expected: 100 },
    ],
    solve: (v) => {
      const d = clearingCost(v.A, { acresPerDay: v.dr, perDay: v.dh })
      const b = clearingCost(v.A, { acresPerDay: v.br, perDay: v.bh })
      const m = clearingCost(v.A, { perAcre: v.slash + v.stump, acresPerDay: v.mr })
      return { dc: d.cost, dd: d.days, bd: b.days, mc: m.cost, md: m.days }
    },
    // the bale loader is the slower machine
    valid: (v) => v.br < v.dr,
    working: (v, r, original) => [
      { label: 'Dozer', tex: '\\text{days} = \\dfrac{A}{\\text{rate}},\\ \\text{cost} = \\text{days}\\times\\text{daily hire}', sub: `\\dfrac{${tnum(v.A)}}{${tnum(v.dr)}}\\times${tnum(v.dh)}`, result: `= ${n(r.dd)}\\ \\text{days},\\ ₦${n(r.dc, 7)}`, cite: SRC.bush501('clearing costs') },
      { label: 'Bale loader', tex: `\\dfrac{${tnum(v.A)}}{${tnum(v.br)}}`, result: `= ${n(r.bd)}\\ \\text{days}` },
      { label: 'Manual', tex: `${tnum(v.A)}\\times(${tnum(v.slash)} + ${tnum(v.stump)}),\\quad \\dfrac{${tnum(v.A)}}{${tnum(v.mr)}\\ \\text{acre/day}}`, result: `= ₦${n(r.mc, 7)},\\ ${n(r.md)}\\ \\text{days}`, ...(original ? { errata: 'The guide gives 25 days, which needs 4 acres/day, not 1.' } : {}) },
    ],
    // the dozer cost follows from the student's dozer days
    follow: (v, g) => ('dd' in g ? { dc: g.dd * v.dh } : {}),
    cite: SRC.bush501('2018/19 Q2c'),
    errata: 'clearing-days',
  }),
  parametric({
    id: '501-mower-capacity',
    course: 'AEE501',
    topic: 'Field capacity',
    moduleId: 'implements',
    sceneId: 'mower-baler',
    title: 'Mower field capacity',
    inputs: [
      { key: 'W', value: 2, min: 1.5, max: 3, step: 0.1 },
      { key: 'S', value: 8, min: 5, max: 12, step: 0.5 },
      { key: 'FE', value: 0.8, min: 0.65, max: 0.9, step: 0.05 },
    ],
    statement: (v) => `A ${num(v.W)} m cutter-bar mower works at ${num(v.S)} km/h with a field efficiency of ${num(v.FE)}. Find its effective field capacity.`,
    answers: [{ key: 'C', label: 'C_e', unit: 'ha/h', expected: 1.28 }],
    solve: (v) => ({ C: mowerCapacity(v.W, v.S, v.FE) }),
    working: (v, r) => [{ label: 'Capacity', tex: 'C = \\dfrac{W S\\,FE}{10}', sub: `\\dfrac{${tnum(v.W)}\\times${tnum(v.S)}\\times${tnum(v.FE)}}{10}`, result: `= ${n(r.C)}\\ \\text{ha/h}`, cite: SRC.mgmt501('C = WS·FE/10') }],
    cite: SRC.mgmt501('field capacity'),
  }),
]
