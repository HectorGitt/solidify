import { SRC } from '@/content/citations'
import { capacityAcres, capacityHa, crf, machineCosts, realRate, tractorSalvagePct } from '@/physics/costs'
import { CLEARING_1819, clearingCost } from '@/physics/harvest'
import { mowerCapacity } from '@/physics/hay'
import { n } from '@/ui/Working'
import type { Question } from '../types'

const ISU = SRC.mgmt501('ISU PM 710 worked example')
const isuTractor = () =>
  machineCosts({
    list: 110000,
    purchase: 93500,
    years: 15,
    hoursPerYear: 400,
    salvagePct: tractorSalvagePct('150+', 15, 400),
    i: realRate(0.08, 0.03),
    repair: 'tractor2wd',
    ptoHp: 180,
    fuelPrice: 1,
    wage: 10,
    labourFactor: 1.1,
  })

export const AEE501: Question[] = [
  {
    id: '501-isu-tractor',
    course: 'AEE501',
    topic: 'Machinery costs',
    moduleId: 'testing',
    sceneId: 'costs',
    title: 'Ownership and operating cost of a 180-hp tractor',
    statement:
      'A 180 PTO-hp diesel tractor lists at $110,000 and is bought for $93,500. It is kept 15 years at 400 h/yr; interest 8 % with 3 % inflation; fuel $1/gal, labour $10/h (×1.1). Salvage, CRF and repairs from the ISU tables. Find the ownership cost per hour, the operating cost per hour and the total cost per hour.',
    answers: [
      { key: 'own', label: '\\text{ownership}', unit: '$/h', expected: 21.87 },
      { key: 'op', label: '\\text{operating}', unit: '$/h', expected: 24.69 },
      { key: 'total', label: '\\text{total}', unit: '$/h', expected: 46.56 },
    ],
    solve: () => {
      const c = isuTractor()
      return { own: c.ownershipHour, op: c.operatingHour, total: c.totalHour }
    },
    working: (r) => {
      const c = isuTractor()
      return [
        { label: 'Salvage and capital recovery', tex: 'S = 23\\%\\times L,\\quad CR = (P - S)\\,CRF + S\\,i', sub: `(93\\,500 - ${n(c.salvage, 5)})\\times${c.crf} + ${n(c.salvage, 5)}\\times0.05`, result: `= \\$${n(c.capitalRecovery, 4)}/\\text{yr}`, cite: ISU },
        { label: 'Ownership per hour', tex: '\\dfrac{CR + TIH}{h}', sub: `\\dfrac{${n(c.capitalRecovery, 4)} + ${n(c.tih, 3)}}{400}`, result: `= \\$${n(r.own)}/\\text{h}` },
        { label: 'Operating per hour', tex: '\\text{repairs} + \\text{fuel} + \\text{lube} + \\text{labour}', sub: `${n(c.repairHour)} + ${n(c.fuelHour)} + ${n(c.lubeHour)} + ${n(c.labourHour)}`, result: `= \\$${n(r.op)}/\\text{h}`, errata: 'The text also prints $18.09/h for the operating cost; its own items add to $24.69/h.' },
        { label: 'Total', tex: '\\text{ownership} + \\text{operating}', result: `= \\$${n(r.total)}/\\text{h}` },
      ]
    },
    cite: ISU,
    errata: 'isu-operating',
  },
  {
    id: '501-isu-disk',
    course: 'AEE501',
    topic: 'Machinery costs',
    moduleId: 'testing',
    sceneId: 'costs',
    title: 'Cost per acre of a used tandem disk',
    statement:
      'A 28-ft tandem disk (list $30,000) with 600 h on it is bought for $11,000 and kept 8 years at 100 h/yr, i = 5 %, salvage 24 %. It works at 6.0 mph with 79 % field efficiency behind the $46.56/h tractor. Find the disk cost per hour, the field capacity (ac/h, = W·S·FE/8.25) and the cost per acre of the outfit (round the capacity to whole acres).',
    answers: [
      { key: 'disk', label: '\\text{disk}', unit: '$/h', expected: 19.59 },
      { key: 'C', label: 'C', unit: 'ac/h', expected: 16.09 },
      { key: 'acre', label: '\\text{cost}', unit: '$/acre', expected: 4.13 },
    ],
    solve: () => {
      const d = machineCosts({ list: 30000, purchase: 11000, years: 8, hoursPerYear: 100, i: 0.05, repair: 'tandemDisk', hoursAtPurchase: 600, salvagePct: 24 })
      const C = capacityAcres(28, 6, 0.79)
      return { disk: d.totalHour, C, acre: (isuTractor().totalHour + d.totalHour) / Math.round(C) }
    },
    working: (r) => [
      { label: 'Disk cost', tex: '\\text{ownership} + \\text{repairs}', sub: '10.59 + 9.00', result: `= \\$${n(r.disk)}/\\text{h}`, cite: ISU },
      { label: 'Field capacity', tex: 'C = \\dfrac{W S\\,FE}{8.25}', sub: '\\dfrac{28\\times6.0\\times0.79}{8.25}', result: `= ${n(r.C)}\\ \\text{ac/h}`, cite: SRC.mgmt501('field capacity') },
      { label: 'Cost per acre', tex: '\\dfrac{\\$46.56 + \\$19.59}{16}', result: `= \\$${n(r.acre, 3)}/\\text{acre}` },
    ],
    cite: ISU,
  },
  {
    id: '501-slasher',
    course: 'AEE501',
    topic: 'Field capacity',
    moduleId: 'testing',
    sceneId: 'costs',
    title: 'Slasher field capacity',
    statement: 'A 5-ft slasher works at 8 mph with a field efficiency of 85 %. Find its theoretical and effective field capacities in ha/h (1 ft = 0.3048 m, 1 mile = 1.609 km).',
    answers: [
      { key: 'Ct', label: 'C_t', unit: 'ha/h', expected: 1.96 },
      { key: 'Ce', label: 'C_e', unit: 'ha/h', expected: 1.67 },
    ],
    solve: () => {
      const W = 5 * 0.3048
      const S = 8 * 1.609344
      return { Ct: capacityHa(W, S, 1), Ce: capacityHa(W, S, 0.85) }
    },
    working: (r) => [
      { label: 'Theoretical capacity', tex: 'C_t = \\dfrac{W S}{10}', sub: '\\dfrac{1.524\\times12.87}{10}', result: `= ${n(r.Ct, 3)}\\ \\text{ha/h}`, cite: SRC.mgmt501('field capacity') },
      { label: 'Effective capacity', tex: 'C_e = FE\\cdot C_t', sub: `0.85\\times${n(r.Ct, 3)}`, result: `= ${n(r.Ce, 3)}\\ \\text{ha/h}`, errata: 'The question’s “8 m/h” is ambiguous; read as 8 km/h it gives 1.22 and 1.04 ha/h.' },
    ],
    cite: SRC.mgmt501('exam 2019/20, 2023/24 capacity question'),
    params: { W: 5 * 0.3048, S: 8 * 1.609344, feModel: false, FE: 0.85, units: 'si', overlap: 0.05, passes: 10, L: 60 },
  },
  {
    id: '501-sandel',
    course: 'AEE501',
    topic: 'Machinery costs',
    moduleId: 'testing',
    sceneId: 'costs',
    title: 'Depreciation of a 200-hp tractor',
    statement: 'A 200-hp tractor costs ₦17 million after a 5 % discount on the list price. It works 600 h/yr. From the salvage table (150+ hp class), find the remaining value percentage after 10 years and the depreciation.',
    answers: [
      { key: 'pct', label: 'S/L', unit: '%', expected: 31, abs: 0.5 },
      { key: 'dep', label: 'D', unit: '₦ million', expected: 11.45 },
    ],
    solve: () => {
      const list = 17e6 / 0.95
      const pct = tractorSalvagePct('150+', 10, 600)
      return { pct, dep: (17e6 - (pct / 100) * list) / 1e6 }
    },
    working: (r) => [
      { label: 'List price', tex: 'L = \\dfrac{17\\times10^6}{0.95}', result: '= ₦17.89\\ \\text{M}' },
      { label: 'Salvage', tex: 'S = (S/L)\\,L', sub: `${n(r.pct)}\\%\\times17.89`, result: `= ₦${n((r.pct / 100) * (17 / 0.95))}\\ \\text{M}`, cite: SRC.mgmt501('salvage table') },
      { label: 'Depreciation', tex: 'D = P - S', result: `= ₦${n(r.dep)}\\ \\text{M}` },
    ],
    cite: SRC.mgmt501('SANDEL example'),
  },
  {
    id: '501-crf',
    course: 'AEE501',
    topic: 'Machinery costs',
    moduleId: 'testing',
    sceneId: 'costs',
    title: 'Capital recovery factor',
    statement: 'Find the capital recovery factor for 7 years at 6 % interest.',
    answers: [{ key: 'crf', label: 'CRF', unit: '', expected: 0.179, abs: 0.001 }],
    solve: () => ({ crf: crf(0.06, 7) }),
    working: (r) => [{ label: 'CRF', tex: 'CRF = \\dfrac{i(1+i)^n}{(1+i)^n - 1}', sub: '\\dfrac{0.06(1.06)^7}{1.06^7 - 1}', result: `= ${n(r.crf, 3)}`, cite: SRC.mgmt501('Table 2') }],
    cite: SRC.mgmt501('Table 2'),
  },
  {
    id: '501-clearing-1819',
    course: 'AEE501',
    topic: 'Land clearing',
    moduleId: 'implements',
    sceneId: 'land-clearing',
    title: 'Costing the clearing of 100 acres',
    statement:
      'About 100 acres must be cleared. A dozer clears 15 acres/day at ₦150,000/day; a bale loader 5 acres/day at ₦50,000/day; manual clearing costs ₦10,000 (slash) + ₦5,000 (stump) per acre, with 4 people clearing 1 acre a day. Find the dozer cost and days, the bale-loader days, and the manual cost and days.',
    answers: [
      { key: 'dc', label: '\\text{dozer cost}', unit: '₦', expected: 1_000_000 },
      { key: 'dd', label: '\\text{dozer days}', unit: 'days', expected: 6.67 },
      { key: 'bd', label: '\\text{loader days}', unit: 'days', expected: 20 },
      { key: 'mc', label: '\\text{manual cost}', unit: '₦', expected: 1_500_000 },
      { key: 'md', label: '\\text{manual days}', unit: 'days', expected: 100 },
    ],
    solve: () => {
      const d = clearingCost(100, CLEARING_1819.dozer)
      const b = clearingCost(100, CLEARING_1819.baleLoader)
      const m = clearingCost(100, CLEARING_1819.manual)
      return { dc: d.cost, dd: d.days, bd: b.days, mc: m.cost, md: m.days }
    },
    working: (r) => [
      { label: 'Dozer', tex: '\\text{days} = \\dfrac{A}{\\text{rate}},\\ \\text{cost} = \\text{days}\\times\\text{daily hire}', sub: '\\dfrac{100}{15}\\times150\\,000', result: `= ${n(r.dd)}\\ \\text{days},\\ ₦${n(r.dc, 7)}`, cite: SRC.bush501('clearing costs') },
      { label: 'Bale loader', tex: '\\dfrac{100}{5}', result: `= ${n(r.bd)}\\ \\text{days}` },
      { label: 'Manual', tex: '100\\times(10\\,000 + 5\\,000),\\quad \\dfrac{100}{1\\ \\text{acre/day}}', result: `= ₦${n(r.mc, 7)},\\ ${n(r.md)}\\ \\text{days}`, errata: 'The guide gives 25 days, which needs 4 acres/day, not 1.' },
    ],
    cite: SRC.bush501('2018/19 Q2c'),
    errata: 'clearing-days',
  },
  {
    id: '501-mower-capacity',
    course: 'AEE501',
    topic: 'Field capacity',
    moduleId: 'implements',
    sceneId: 'mower-baler',
    title: 'Mower field capacity',
    statement: 'A 2 m cutter-bar mower works at 8 km/h with a field efficiency of 0.8. Find its effective field capacity.',
    answers: [{ key: 'C', label: 'C_e', unit: 'ha/h', expected: 1.28 }],
    solve: () => ({ C: mowerCapacity(2, 8, 0.8) }),
    working: (r) => [{ label: 'Capacity', tex: 'C = \\dfrac{W S\\,FE}{10}', sub: '\\dfrac{2\\times8\\times0.8}{10}', result: `= ${n(r.C)}\\ \\text{ha/h}`, cite: SRC.mgmt501('C = WS·FE/10') }],
    cite: SRC.mgmt501('field capacity'),
  },
]
