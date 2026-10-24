import { SRC, type Citation } from './citations'

/**
 * Places where the notes or marking guides disagree with a careful computation.
 * Shown on the Sources page and as "note discrepancy" badges next to the affected working.
 * These should be confirmed with the lecturer.
 */
export interface Erratum {
  id: string
  topic: string
  where: Citation
  says: string
  correct: string
}

export const ERRATA: Erratum[] = [
  {
    id: 'otto-cv',
    topic: 'Otto cycle mep (Misc. Ex 9)',
    where: SRC.misc509('p9, Example 9'),
    says: 'Heat added uses Cv = 0.778 kJ/kg·K, giving Q = 1368.5 kJ/kg and mep = 1135.7 kPa.',
    correct: 'With Cv = 0.718 kJ/kg·K (the constant used everywhere else): Q ≈ 1263 kJ/kg and mep ≈ 1048 kPa. The efficiency (60.2 %) is unaffected.',
  },
  {
    id: 'diesel-factor',
    topic: 'Why Diesel η < Otto η',
    where: SRC.thermo509('p5'),
    says: 'The factor (δᵏ − 1)/(k(δ − 1)) is stated to be less than 1.',
    correct: 'It is greater than 1 for every δ > 1 — which is exactly why the Diesel efficiency is lower than the Otto efficiency at the same compression ratio.',
  },
  {
    id: 'dual-vs-diesel',
    topic: 'Dual vs Diesel efficiency',
    where: SRC.misc509('p10'),
    says: 'The dual cycle is less efficient than the Diesel cycle for the same r and δ.',
    correct: 'For the same r and cut-off ratio δ, adding constant-volume heat (α > 1) makes the dual cycle MORE efficient than the Diesel cycle.',
  },
  {
    id: 'plough-hp',
    topic: 'Plough draft power example',
    where: SRC.am502('§12, draft example'),
    says: '180 N draft at 1 m/s is worked as 2.4 hp (treating newtons as kgf).',
    correct: '180 N × 1 m/s = 180 W ≈ 0.245 metric hp.',
  },
  {
    id: 'two-bottom',
    topic: 'Two-bottom plough (2018/19 marking guide)',
    where: { course: 'AEE502', file: 'AEE 502 -2018-2019-Marking Guide.docx' },
    says: 'The answer uses the furrow area of one bottom.',
    correct: 'Two 150 mm × 70 mm bottoms: 210 cm² × 2 N/cm² = 420 N; at 2.8 km/h ≈ 327 W.',
  },
  {
    id: 'v-belts',
    topic: 'Multiple V-belt drive (AEE503 2019/20 guide)',
    where: { course: 'AEE503', file: 'AEE 503 Q-1920-2021-Marking Guide.docx' },
    says: 'T₂ = 62.95 N, 12.6 kW per belt → 2.06 belts.',
    correct: 'Including the centrifugal term mv² consistently: T₂ ≈ 279 N, ≈ 9.34 kW per belt → 2.78, i.e. 3 belts.',
  },
  {
    id: 'cone-clutch',
    topic: 'Cone clutch mean radius',
    where: SRC.m503(8, 'cone clutch slide'),
    says: 'R_m = ½(R_o − R_i).',
    correct: 'R_m = ½(R_o + R_i).',
  },
  {
    id: 'open-belt',
    topic: 'Open belt wrap angle',
    where: SRC.m503(4),
    says: 'Sign typo in α₂.',
    correct: 'α₁ = 180° − 2β (small pulley), α₂ = 180° + 2β (large pulley), with sin β = (R − r)/C.',
  },
  {
    id: 'cantilever-E',
    topic: 'Machine on a cantilever (AEE518)',
    where: SRC.ln518('equivalent systems example'),
    says: 'E = 2.07×10¹³ is used, giving ωₙ = 93.5 rad/s.',
    correct: 'With E = 207 GPa, kₑ = 8.28×10³ N/m and ωₙ ≈ 9.35 rad/s — close to the 8 rad/s forcing (near resonance).',
  },
  {
    id: 'wahl',
    topic: 'Helical spring stress factor (AEE503 2021/22 guide)',
    where: { course: 'AEE503', file: 'AEE 503 EXAM -2021-22-MARKING GUIDE.docx' },
    says: 'Uses the direct-shear factor K_s = 1.0625.',
    correct: 'The Wahl factor for C = 8 is K = 1.184; the wire diameter changes accordingly.',
  },
  {
    id: 'isu-operating',
    topic: 'Machinery operating cost (ISU PM 710)',
    where: SRC.mgmt501('worked example'),
    says: 'Operating cost appears as both $24.69/h and $18.09/h.',
    correct: 'Summing repairs, fuel, lubrication and labour gives $24.69/h; total $46.56/h.',
  },
  {
    id: 'hydrostatic-torque',
    topic: 'Hydrostatic drive and torque multiplication',
    where: SRC.pt510('p9'),
    says: 'The torque converter multiplies torque; the hydrostatic drive does not.',
    correct: 'A hydrostatic drive also multiplies torque, by the ratio of motor to pump displacement (T_motor/T_pump = D_motor/D_pump, less losses). What distinguishes the torque converter is that it multiplies torque automatically as the load slows the turbine.',
  },
  {
    id: 'hooke-inertia',
    topic: "Hooke's joint inertia example (AEE502 guide, Ex 26.3)",
    where: { course: 'AEE502', file: "Hooke's joint analysis-2.docx" },
    says: 'sin²20° is rounded to 0.1175, giving α = −1365 rad/s², inertia torque 1278.4 N·m and driver torque 1276.2 N·m.',
    correct: 'With sin²20° = 0.11698: α ≈ −1360 rad/s², inertia torque ≈ 1273.6 N·m on the driven shaft and ≈ 1271.1 N·m at the driver.',
  },
  {
    id: 'pump-units',
    topic: 'Pump question units (AEE502 2016/17 guide)',
    where: { course: 'AEE502', file: 'AEE 502-2016-2017- Marking Guide-draft-new.docx' },
    says: 'The displacement is stated as "150 L/min", and overall efficiency is written e_p = e_v × e_p.',
    correct: 'Displacement is 150 cm³/rev (the working uses it that way), and overall efficiency is e_p = e_v × e_T (= 0.8 × 0.9 = 0.72).',
  },
  {
    id: 'digester-arc',
    topic: 'Digester V-belt drive arc factor (AEE503 2017/18 guide)',
    where: { course: 'AEE503', file: 'AEE 503 Q-2017-2018-final-new.docx (marking scheme)' },
    says: 'An arc-of-contact factor of 0.80 is read from the table.',
    correct: 'Fenner Table 5 gives 0.87 for (D − d)/C ≈ 0.82. The answer (3 belts) is unchanged.',
  },
  {
    id: 'fan-b-section',
    topic: 'Fan drive with B-section belts (AEE503 Module 2)',
    where: SRC.m503(2, 'fan selection example'),
    says: 'Corrected power per belt is printed as 6.6 kW but 6.06 kW is used, and 9.60 is divided instead of the 9 kW design power.',
    correct: 'Use the corrected power consistently with the 9 kW design power; 2 B-section belts.',
  },
  {
    id: 'chain-teeth',
    topic: 'Chain selection teeth (AEE503 2017/18 guide)',
    where: { course: 'AEE503', file: 'AEE 501 201920 questions.docx (2017/18 AGE 503 marking scheme)' },
    says: 'The 57-tooth sprocket is placed on the driving shaft.',
    correct: 'For a 200 → 60 rpm reduction the small (17 T) sprocket drives and the 57 T sprocket is driven; the other way round would speed the shaft up.',
  },
  {
    id: 'chain-conflict',
    topic: 'Chain selection answers disagree (AEE503 MG16 vs MG17)',
    where: { course: 'AEE503', file: 'AEE 503-2016-17-MARKING GUIDE.docx' },
    says: 'One guide selects 23/76 teeth with a 3.46 kW single strand; the other 17/57 teeth with a duplex chain.',
    correct: 'Both can satisfy the duty; they come from different catalogue rows. The app shows the catalogue route step by step so either can be checked.',
  },
  {
    id: 'idler-load',
    topic: 'Idler gear tooth load (AEE503 idler-train question)',
    where: { course: 'AEE503', file: 'AEE 503 EXAM -2021-22-MARKING GUIDE.docx' },
    says: 'Tangential tooth load 434 N.',
    correct: 'T_A = 47.8 N·m on a 105 mm pitch radius gives F_t ≈ 455 N (F_r ≈ 166 N).',
  },
  {
    id: 'helical-axial',
    topic: 'Helical gear axial force (AEE503 Module 5)',
    where: SRC.m503(5, 'helical example'),
    says: 'F_a = 928 N.',
    correct: 'F_a = F_t·tan 30° = 1600 × 0.5774 ≈ 924 N.',
  },
  {
    id: 'first-order-constant',
    topic: 'First-order response 3θ̇ + 2θ = 10 cos 5t (AEE518)',
    where: SRC.ln518('first-order Example 1'),
    says: 'Natural-response constant 0.3486.',
    correct: 'θ(0) = 30° = 0.5236 rad minus the forced part at t = 0 (0.0875) gives 0.4361.',
  },
  {
    id: 'routh-r3',
    topic: 'Routh–Hurwitz example 7D⁴ + 3D³ + 8D² + 5D + 9 (AEE518)',
    where: SRC.ln518('Routh stability'),
    says: 'R₃ = −126.',
    correct: 'R₃ = −136. The conclusion (unstable) is unchanged.',
  },
  {
    id: 'thermometer-tau',
    topic: 'Thermometer time constant (AEE518)',
    where: SRC.ln518('first-order systems'),
    says: 'τ = 14.48 s.',
    correct: 'τ ≈ 14.43 s from the given data (the response T = 100(1 − e^(−t/τ)) is otherwise the same).',
  },
  {
    id: 'isu-disk-age',
    topic: 'Used tandem disk salvage value (ISU PM 710)',
    where: SRC.mgmt501('worked example — disk'),
    says: 'Remaining value read from Table 1b at 13 years (24 %).',
    correct: 'The disk is 14 years old at sale (6 years old when bought + 8 years kept), giving 23 %. The worked answer uses 24 %.',
  },
  {
    id: 'clearing-days',
    topic: 'Manual land clearing time (AEE502 2018/19 guide)',
    where: { course: 'AEE502', file: 'AEE 502 -2018-2019-Marking Guide.docx' },
    says: 'Manual clearing takes 25 days.',
    correct: 'At 4 people per acre per day, clearing 100 acres takes 100 working days for a 4-person team (25 days needs a 16-person team).',
  },
  {
    id: 'clearing-acres',
    topic: 'Hectares to acres (AEE502 2018/19 guide)',
    where: { course: 'AEE502', file: 'AEE 502 -2018-2019-Marking Guide.docx' },
    says: '40 ha is taken as 100 acres.',
    correct: '40 ha = 98.8 acres; the guide rounds to 100.',
  },
  {
    id: 'noise-96',
    topic: 'Permissible noise exposure at 96 dB(A)',
    where: { course: 'AEE510', file: 'Human Engineering in tractor design .pdf', where: 'p6 OSHA limits' },
    says: '96 dB(A) is allowed for 3 h.',
    correct: 'On the 5 dB exchange rule between the OSHA points (90 dB 8 h … 115 dB ¼ h), 96 dB(A) allows about 3.5 h.',
  },
  {
    id: 'glass-weight',
    topic: 'Greenhouse glazing weight (AEE505)',
    where: { course: 'AEE505', file: 'AEE 505 Lecture note 2 new.pdf' },
    says: '4 mm glass weighs 2.8 kg/m².',
    correct: 'Glass is about 2500 kg/m³, so 4 mm glass weighs about 10 kg/m².',
  },
  {
    id: 'bond-exponent',
    topic: "Bond's law exponent (AEE504 size reduction)",
    where: { course: 'AEE504', file: 'AGE 504 note 2, reduction.doc' },
    says: 'In the general law dE/dL = −C/Lⁿ, Bond’s law is given as n = 1.',
    correct: 'Rittinger is n = 2, Kick n = 1 and Bond n = 1.5, giving E = 10·Wi(1/√x₂ − 1/√x₁).',
  },
  {
    id: 'screen-balance',
    topic: 'Screen mass balance (AEE504 separation)',
    where: { course: 'AEE504', file: 'seperation 504.docx', where: 'eq 3' },
    says: 'B/F has X_A − X_B in the numerator.',
    correct: 'From the material balances, B/F = (X_F − X_D)/(X_B − X_D), i.e. the numerator uses the feed composition X_F, not X_B.',
  },
]
