<!-- Inventory of course notes produced by a research agent on 2026-10-06; source files under C:/Users/USER/Documents/School/500L -->

## AEE503 / AEE518 inventory for the Three.js tractor simulation plan

**Read this first.** The `.pptx` text extracts dropped every equation. I recovered them from the OMML in the original slides. The recovered text, with equations, is in the scratchpad:
- `scratchpad\aee503_math.txt` (Modules 4, 5, 7, 8)
- `scratchpad\aee503_math2.txt` (Modules 2, 9, 10, 11)
- The extractor script is `scratchpad\omml_extract.py`.

The `.doc` marking guides for AEE518 also lost their equation objects, so some answers in them are incomplete. Where a value is marked **(calc)**, I recomputed it in Python and it is not printed in the notes.

**Neither course has any tractor-specific content.** The only tractor-related item is "PTO DRIVE" (and "Shafts and universal joints") in the Module 1 power-transmission chart. Every example is a farm or food-processing machine: palm fruit digester, palm nut/fibre separator, cassava grater, maize sheller and planter, groundnut planter and oil expeller, locust bean dehuller, palm kernel expeller, fan, compressor, pump, winch, hopper shaker.

**Source key**
- M1–M12 = `AEE503__AEE_503_MODULE_n_*`; MAN = `AEE503__AEE_503_MANUAL`
- AEE503 exams and guides: E15 = 2015_2016_EXAMINATION_QUESTION; MG15 = 15_16_MARKIN_GUIDE; E16 / MG16 = EXAM_2016_2017 / 2016_17_MARKING_GUIDE; Q17 = Q_2017_2018_final_new; MG17 = `AEE_501_201920_questions` (it is mislabelled; the content is the 2017/18 AGE 503 marking scheme); E18 = 2018_2019_EQ_final; MG19 = Q_1920_2021_Marking_Guide; T19 = 1920_2021_TEST_Marking_Guide; E21 / MG21 = EXAM_2021_22 (+ MARKING_GUIDE); T21 = Test_2021_22_Marking_Guide. The 2018_2019_MARKING_SCHEME extract is empty (scanned images only).
- AEE518: LN = LECTURE_NOTES_NEW_REVISED_2019_1; Q16 / MG16b = Q_2016_2017 / MARKING_GUIDE_2016_2017; MS17 = E_2017_2018_Marking_scheme; MG18 = 2018_2019_Marking_Guide; T19b = Test_2019_2020_Marking_Scheme.

---

## 1. Machine elements: parts, motions and cutaways

**Power transmission overview (M1, Fig. 1 "Mechanical Transmission of Power").** This tree diagram is asked for in nearly every exam (Q17, E21, T21, MG19, T19).
- Top-level branches: direct drive, PTO drive, flexible shafting.
- Flexible drives: leather, rope.
- Belt drives: V, flat, variable-speed, toothed.
- Chain drives: block, cast detachable roller, roller, inverted-tooth (silent).
- Gear drives: spur, bevel, worm and wheel, helical.
- Hydraulic drives: hydrostatic, hydrodynamic.
- Accessories: couplings, shafts and universal joints, bearings, seals, clutches, overload protection device.

Merits and demerits of each drive are in MG15 and MG19:
- Belt: cheap, no lubrication, quiet, long distance; but it slips, stretches and is bulky.
- Chain: no slip, compact, easy to install; but it needs lubrication, is noisy and costs more.
- Gear: suits high ratios and short distances, precise; but costly, needs lubrication, hard to install.

**Flat and V belts (M2, M4, MAN).**
- Parts: driver and driven pulley or sheave, tight side T1, slack side T2, open and crossed layouts, idler pulley.
- V-belt: groove angle 2θ (36° in MG19), section codes Z/A/B (e.g. A-23, B-24, from MAN).
- Animate: belt travel, wrap arcs α1 and α2, slip, centrifugal lift-off. A V-groove cross-section should show the wedge.
- Ropes and flat belts: flat belts are limited to about 8 m between shafts (M6).

**Chains and sprockets (M3, MAN).**
- Roller chain parts: inner plate (roller link plate), outer plate (pin link plate), pin, bush, roller. A link cutaway should show the pin, bush and roller nested.
- Types students must draw: roller, pintle, slat (MG15); simplex vs duplex.
- Agricultural use: planter train from press wheel to lay shaft to seed-metering device, all by chain (MG16).
- **Gap:** the notes are catalogue-only. There is no chain velocity or polygonal-effect formula anywhere.

**Gears (M5).**
- Spur nomenclature, examined almost every year: pitch circle, addendum circle, dedendum circle, top land, bottom land, face, flank, face width, tooth thickness, circular pitch, module, line of action, pressure angle, pitch point.
- Helical: helix angle α measured from the axis, giving axial thrust.
- Straight bevel: pitch-cone angle β, mean radius r_m, with pinion and gear thrust (Fig. 17-5b shows the force vectors on the pinion and gear).
- Worm and wheel appears only in the chart and in the digester gearbox problem (12:1). No worm formulas.
- Idler train: three gears A–B–C (Q17, E21).

**Ropes and hoists (M6).**
- Fibre ropes: hemp and manila (lubricated), cotton (no lubrication).
- Pulley groove angle 45°; pulley diameter about 40d, not less than 36d.
- Wire ropes: cold-drawn, used up to 150 m. Material in order of increasing strength: wrought iron, cast steel, extra-strong cast steel, plough steel, alloy steel.
- Hoist: a drum with wrapped rope or chain.
- Winch (capstan) exam problem: an ungrooved cast-iron drum with 4 turns of rope.

**Bearings (M7).**
- Rolling types: deep-groove ball, self-aligning ball, angular-contact, straight roller, tapered roller, needle, spherical roller.
- Rolling-bearing parts: inner race, outer race, rolling elements, cage.
- Journal bearing: journal turning inside a stationary bearing with a lubricant film. Examples given are the crankshaft and connecting rod.
- A cutaway should show load transfer by rolling vs sliding, plus the tapered-roller contact angle (it takes radial and thrust load).
- Comparison facts (M7, MG15, T19): rolling bearings start easily, are noisy at high speed, give a warning before failure, and can be preloaded; a journal bearing fails suddenly; rolling bearings suit tight axial space, journal bearings suit tight radial space.
- Where each type is used (MG16): deep groove for small/medium load, tapered for heavy load, self-aligning for misalignment, angular contact for thrust.

**Clutches (M8).**
- Multiple-disc clutch (Fig. 14-1): steel plates A splined on shaft C, bronze plates B splined into housing D, axial force F/2 on each side, radii Ro and Ri. With 5 steel + 4 bronze plates, n = 8 friction pairs. Animate the pack squeezing together and the two shafts locking.
- Cone clutch: wedging of the cone into the cup, cone angle α, face width b.
- **Gap:** no centrifugal clutch and no coupling theory in the notes, although the course outline lists couplings.

**Brakes (M9).**
- Single block/shoe brake, rigidly mounted or pivoted shoe (Fig. 15-10): drum R = 360, pivot offsets a = 360 and c = 40, lever b = 900 mm.
- Long pivoted shoe; double-shoe brake.
- Internal expanding shoe (Fig. 15-6): drum, lining, two shoes on pivots a distance a from the centre, actuating force F at distance c, angles θ1, θ2, θm, rotation arrow.
- Simple band brake (Fig. 15-7), two-way band (Fig. 15-8), differential band (Fig. 15-9, with arms a, b, c).
- Animate the drum spin, shoe or band engagement, and the heat. Show the self-locking toggle.
- **Gap:** no disc brake in the notes.

**Springs (M10, MG21).**
- Types: helical compression and tension (close-coiled, helix angle under 10°; or open-coiled), conical, volute/involute, torsion, leaf (laminated), Belleville.
- Leaf spring: graduated leaves plus extra full-length leaves, clamp and bolt, nip gap h from pre-stressing.
- Material: 0.6–0.7% C, 0.6–1.0% Mn steel.
- Definitions examined: spring index, stiffness, solid length, free length, pitch.
- Section of the wire should show the torsional shear stress (Wahl).

**Welding (M11).**
- Methods: arc, resistance (spot, seam), gas, bronze welding.
- Joints: butt; fillet in T-joint, lap and edge forms; parallel vs transverse fillet. The throat fails at 45° under parallel load and at 67.5° under transverse load.
- Distortion control: tack, skip, backstep, alternate-side welding; jigs and clamps; pre-alignment; preheating.
- A cross-section should show the triangular fillet with leg w and throat 0.707w.

---

## 2. Equations that can drive the simulation

**Belts (M4, recovered from OMML).**
- Power: P = (T1 − T2)v.
- Stress form: (s1 − m′v²)/(s2 − m′v²) = e^(fα).
- Tension form: (T1 − mv²)/(T2 − mv²) = e^(fα / sin(θ/2)), with m = b·t·ρ per metre. θ is the groove angle; θ = 180° for a flat belt.
- mv² is the centrifugal term. The pulley with the smaller e^(…) governs.
- Required area A = (T1 − T2)/(s1 − s2); width b = A/t.
- Allowable stress: leather 2–3.45 MPa, rubber 1–1.7 MPa. Density: leather 970, rubber 1250 kg/m³.
- Open belt: sin β = (R − r)/C; α1 = 180° − 2β, α2 = 180° + 2β. The slide has a sign typo for α2.
- Crossed belt: α1 = α2 = 180° + 2 sin⁻¹((R + r)/C). Proving this is a frequent 5-mark question.

**Belt worked examples.**
- Crossed belt: 7.5 kW, 1000 rpm, d = 250, D = 500, C = 1.25 m, f = 0.3, s1 = 1.7 MPa → α = 214.9°, e^(fα) = 3.08, v = 13.1 m/s, m′v² = 1.665×10⁵ Pa, s2 = 6.61×10⁵ Pa, ΔT = 572.5 N, b = 92 mm (MG15, T19, MG19).
- Compressor drive: 10×250 belt, 300/1500 pulleys, 900 rpm, wraps 220°/270°, f = 0.3/0.25 → e^(fα) = 3.16 (small pulley governs), T1 = 5 kN, m = 2.425 kg/m, v = 14.14 m/s, T2 = 1914 N, **P = 43.6 kW** (MG16).
- M4 example: 6×200 belt, wraps 4/3.5 rad, T1 = 2.7 kN, 900 rpm → **(calc)** P ≈ 17.4 kW.
- Fan, double-ply belt, 880 rpm (Q17, E21): **(calc)** α1 = 136.3°, P ≈ 39 kW.
- Multiple V-belts (MG19): 26 kW, 250/800 sheaves, 36° groove, 140° wrap, T1 = 900 N, m = 0.523 kg/m, 1150 rpm, f = 0.2 → e^… = 4.86, v = 15.05 m/s.
  - The guide gets T2 = 62.95 N, 12.6 kW per belt, and 2.06 belts.
  - **(calc)** With mv² included consistently: T2 = 279 N, 9.34 kW per belt, 2.78, so 3 belts. The guide looks wrong here.

**Belt selection by catalogue (Fenner) (M2, MG15, MG17, T19).**
- Steps: design power = service factor × rated power → belt section → speed ratio → pulley diameters (C = 2√((D + d)d)) → basic power per belt + speed-ratio increment → length L = 2C + 1.57(D + d) + (D − d)²/4C → length factor → arc factor from (D − d)/C → corrected power = (basic + increment)·F_L·F_arc → number of belts = design power ÷ corrected power.
- Fan example: 7.5 kW, 1500 rpm → SF 1.2, 9 kW, d = 250, D = 750, L = 3632.5 mm, arc factor 0.93.
  - A section: (2.70 + 0.18)×1.17×0.93 = 3.13 kW, so 3 belts.
  - B section: 6.57 kW, so 2 belts.
- Digester example: 3 kW, 1500 → 300 rpm into a 12:1 worm gearbox → 25 rpm. SF 1.1, d = 85, D = 425, C = 416.4, L = 1702.9, 1.10 kW per belt, so 3 belts.

**Chain selection (M3, MG17, T19).** Service factor → design power → pitch → sprocket teeth → rated power; duplex = 1.7 × simplex.
- 2 kW, 200 → 60 rpm, moderate shock: SF 1.3, ¾″ (19.05 mm) pitch, 17/57 teeth, 2.5 kW simplex, duplex 4.25 kW. MG16 gives a conflicting answer: 23/76 teeth with a 3.46 kW single strand.
- 6.5 kW, 1500 → 575 rpm, heavy shock: SF 1.5, 9.75 kW, ½″ pitch, 16/38 teeth.
- 11 kW, 970 → 330 rpm: 14.3 kW design, ¾″ pitch, 19/57 teeth, 11.7 kW simplex, duplex 19.89 kW.

**Gears (M5).**
- Pitch and module: P_c = πD/N; m = D/N; P_c/m = π.
- Spur: F_t = M_t/r; F_r = F_t tan φ (radial force points toward the centre).
- Helical, φ measured in the transverse plane: F_r = F_t tan φ, F_a = F_t tan α. With φ_n (normal plane): F_r = F_t tan φ_n / cos α.
- Bevel: F_t at the mean radius; F_p = F_t tan φ sin β; F_g = F_t tan φ cos β.

**Gear worked examples.**
- Spur: 200 N·m on a 100 mm pinion, 20° → F_t = 4000 N, F_r = 1456 N.
- Helical: 200 N·m, 250 mm diameter, φ = 27°, α = 30° → F_t = 1600 N, F_r = 815 N, F_a = 924 N (the guide says 928). With φ = 20°: F_r = 582 N.
- Bevel (MG15): velocity ratio 4/3, pinion 150 mm, face 50 mm, 14.5°, 6 kW at 240 rpm → sin β = 0.6, r_m = 60 mm, M_t = 239 N·m, F_t = 3983 N, F_p = 618 N, F_g = 824 N.
- Idler train: module 6, teeth 35/65/45 → diameters 210/390/270 mm; 3 kW at 600 rpm → T_A = 47.8 N·m, T_C = 61.4 N·m, N_C = 466.7 rpm; idler shaft load 837 N. **(calc)** F_t = 455 N, F_r = 166 N; the guide says 434 N.

**Bearings (M7).**
- Stribeck static capacity: C0 = KZD²/5 for balls; C0 = KZDL/5 for rollers.
- AFBMA static: C0 = f0·i·Z·D²·cos α.
- Static equivalent load: P0 = X0·Fr + Y0·Fa, but never less than Fr.
- Dynamic rating: C = fc·(i cos α)^0.7·Z^(2/3)·D^1.8.
- Life: L = (C/P)³ million revolutions. Rating (L10) life = 90% of bearings survive; median life = 50%.
- Equivalent load: P = X·V·Fr + Y·Fa, with V = 1.0 when the inner ring rotates and 1.2 when it is stationary.
- Examples:
  - 9 balls × 12 mm with K = 60.8×10⁶ → C0 = 15,760 N.
  - AFBMA with f0 = 12.26×10⁶ → 15,890 N; SKF 6208 = 16,600 N; RHP = 15,613 N.
  - Double row, 11 balls × 10 mm (Z = 22) → 26,800 N.
  - Fr = 13.2 kN, Fa = 4.4 kN, X0 = 0.6, Y0 = 0.5 → 10.1 kN, so use 13.2 kN.

**Clutches (M8, MG16).**
- Number of friction pairs: n = n_steel + n_bronze − 1. Torque: T = F·f·R_f·n.
- Friction radius: uniform pressure R_f = (2/3)(Ro³ − Ri³)/(Ro² − Ri²); uniform wear R_f = (Ro + Ri)/2.
- Axial force F = p·π(Ro² − Ri²). Power = T·N·2π/60.
- Uniform-wear pressure p = F/[2π(Ro − Ri)r], so p_max is at Ri and p_min at Ro.
- Cone clutch: T = (Ff/sin α)(2/3)(Ro³ − Ri³)/(Ro² − Ri²) for uniform pressure; T = F·f·R_m/sin α for uniform wear. The slide wrongly gives R_m = ½(Ro − Ri); it should be the sum.
- Deriving T = F·f·R_f for uniform wear is examined (MG16).
- Examples:
  - 9 discs, 16 N·m, Di = 50 mm, f = 0.1, p = 350 kPa → Do ≈ 70 mm, F = 667 N.
  - Plate with F = 4000 N, Ri = 50, Ro = 100 mm → **(calc)** p_max = 254.6 kPa, p_min = 127.3 kPa, p_avg = 169.8 kPa.

**Brakes (M9).**
- Short shoe: F·b = N·a − f·N·c; self-locking when a/c ≤ f; T = f·N·R.
- Long pivoted shoe: T = f·N·4R sin(θ/2)/(θ + sin θ). Double shoe: T = f(N_L + N_R)R.
- Internal expanding shoe:
  - T = f·w·r²(cos θ1 − cos θ2)/sin θm·(p_m + p_m′), with p = p_m sin θ/sin θm.
  - M_f = (f·p_m·w·r/sin θm)∫ sin θ(r − a cos θ)dθ; M_n = (p_m·w·r·a/sin θm)∫ sin²θ dθ.
  - Deriving M_f and M_n is examined (E15).
- Band: F1/F2 = e^(fα); T = (F1 − F2)r. Differential band: F = (F2·b − F1·a)/c; self-locking when b ≤ a·e^(fα).
- Heat: H_g = p_av·A·f·V = E_p + E_k; heat dissipated H_d = C·Δt·A_r, with C ≈ 29.5 (Δt = 40 °C) to 44 W/m²K (Δt = 200 °C).
- Examples:
  - Single shoe (Fig. 15-10; asked in MG15, Q17, E21, T21): 225 N·m at 500 rpm, f = 0.3 → N = 2083 N, friction 625 N, F = 805 N clockwise / 861 N counter-clockwise, self-locks when c ≥ 1.2 m, H_g = 11.8 kW.
  - Band: 280° wrap, 450 mm drum, 170 N·m, f = 0.2 → F1 = 1210 N, F2 = 455 N.

**Rope winch (Q17, E18, E21).** 4 turns gives α = 8π; f = 0.1 → e^(fα) = 12.35. Effective diameter 275 mm, v = 0.36 m/s. With a 330 N pull: T1 ≈ 4.08 kN, P ≈ 1.35 kW. A 450 N variant appears in E18.

**Springs (M10).**
- Leaf, no pre-stress: s_e = 18FL/[bt²(3n_e + 2n_g)]; s_g = (2/3)s_e.
- Deflection: y = 12FL³/[bt³E(3n_e + 2n_g)].
- Pre-stressed: s = 6FL/(nbt²); nip gap h = 2FL³/(nbt³E).
- Helical: τ = K·8FD/(πd³), with Wahl factor K = (4C − 1)/(4C − 4) + 0.615/C and C = D/d; deflection y = 8FD³n/(d⁴G).
- Examples:
  - Leaf: 1 m cantilever, 8 graduated + 1 full leaf, b = 45 mm, 2000 N, 75 mm deflection → t = 12.3 mm; 195 MPa pre-stressed vs 277 MPa without (MG17).
  - Helical: 500 N, 25 mm, C = 8, τ = 350 MPa, G = 84 GPa → k = 20 N/mm, K_s = 1.0625, d ≈ 6 mm, D = 48 mm, n ≈ 6.15 coils (MG21). The guide uses K_s; the Wahl factor would be 1.184.

**Welds (M11).**
- Butt: F = s_t·t·L·e.
- Fillet: parallel F = 0.707·s·w·L; transverse F = 0.828·s·w·L (throat 0.765w at 67.5°). AWS allowable s = 94 MN/m².
- Weld treated as a line: f = M/Z_w and f = T·c/J_w, then size w = f/(0.707s).
- Examples:
  - Bracket: 35 kN at 570 mm, J_w = 5.328×10⁻³ m³ → f = 0.609 MN/m → w = 9.2, so 10 mm.
  - Round bar, 50 mm, 10 kN at 200 mm (asked in 4 exams): Z_w = πd²/4 → f = 1.022 MN/m → w = 15.4 mm.
  - Parallel fillet, 15 mm leg → 997 kN/m.

**Vibration intro (M12, MG19).** Idealised mass M, spring k, dashpot b. Free-body forces: b·v, k·x, F(t). Vibration is usually harmful but is used deliberately in sieve shakers and grain cleaners.

---

## 3. AEE518 dynamic systems (LN)

**Process and modelling.**
- Five stages: physical model → free-body diagram → equation of motion → solve → design decision.
- Five modelling assumptions: lumped parameters, small effects neglected, linearity, constant parameters, no uncertainty.
- Two methods: classical (ΣF = mẍ, ΣM = Iθ̈) and energy, d(T + U)/dt = 0.
- Definitions: order, degree of freedom (DOF), ω_n, ω_d, ζ.

**Models with their equations of motion.**
- Well water-drawer (windlass with rope and bucket): (J + Mr²)θ̈ − rW = 0.
- Electromechanical (motor or speaker): iR + L·di/dt + Kθ̇ = V; Jθ̈ + bθ̇ − Ki = load torque.
- Simple pendulum: θ̈ + (g/L)sin θ = 0. Pendulum with a massive rod: (m + M/3)θ̈ + (m + M/2)(g/L)θ = 0.
- Playground swing: rod mass M = 2ρπr²L; bob m = seat mass + W/g.
- Bar on counter-rotating grooved wheels: mẍ + (μW/a)x = 0, so ω_n = √(μg/a). The extract drops μ.
- Weightless bar pivoted at A (spring at c, damper at a, mass M at L): ML²θ̈ + a²bθ̇ + kc²θ = 0, giving ω_n = √(kc²/ML²) and ζ = a²b/[2√(kc²·ML²)] (MG18).
- Cam-follower valve train (T19b): pushrod m_p, rocker m_r and J_r, valve m_v. Find the equivalent mass at A or C by equating kinetic energies. This is the closest item to a tractor engine.

**First-order systems.**
- a1·q̇ + a0·q = q_i; time constant τ = a1/a0; natural response Q_n·e^(−t/τ); settled after about 5τ.
- Forced response Q_f = b0/(a1·s_f + a0); transfer function G = 1/(a1·s + a0).
- Sinusoidal input: amplitude b0/√(a0² + (a1ω)²), phase φ = tan⁻¹(a1ω/a0).
- Examples:
  - 3θ̇ + 2θ = 10 cos 5t, θ(0) = 30° → θ = 0.3486e^(−2t/3) + 0.6608 cos(5t − 1.438).
  - Thermometer: T = 100(1 − e^(−t/14.49)), τ = 14.48 s (MS17, T19b).

**Second-order systems.**
- a2·q̈ + a1·q̇ + a0·q = q_i, with ω_n = √(a0/a2), ζ = a1/(2√(a0·a2)), roots s = −ζω_n ± jω_n√(1 − ζ²), ω_d = ω_n√(1 − ζ²).
- Four cases: undamped (ζ = 0), underdamped (ζ < 1), critically damped ((C1 + C2·t)e^(−ω_n·t)), overdamped (two decaying exponentials).
- Forced: G = 1/(a2·s² + a1·s + a0). Example: θ̈ + 10θ̇ + 16θ = 32u(t) → ζ = 1.25, roots −2 and −8, θ = 2 + (2/3)e^(−8t) − (8/3)e^(−2t). Asked in Q16, MG18 and MS17.

**Equivalent systems.**
- Springs: parallel k1 + k2; series 1/k = 1/k1 + 1/k2.
- Spring mass: M_e = M + M_s/3. Cantilever: k = 3EI/L³, M_e = m + 0.23·m_s.
- Lever, reciprocating (crank, connecting rod, flywheel) and geared systems are reduced to equivalent disk-and-shaft torsional systems. This is qualitative only: **no multi-DOF or eigenvalue analysis anywhere.**
- Unbalanced machine on a cantilever: F = 300 sin 8t, 2×4×200 cm steel beam, 900 N machine.
  - The notes give M_e = 94.63 kg, k_e = 8.28×10⁵ N/m, ω_n = 93.5 rad/s, but they use E = 2.07×10¹³ (a units slip).
  - **(calc)** With E = 207 GPa: k_e = 8.28×10³ N/m and ω_n = 9.35 rad/s, which is close to the 8 rad/s forcing. That makes a good resonance demo.
- Massive-spring network exams: M_e = 306.67 kg, k_e = 40 N/m, F = 200 cos 25t, G = −5.21×10⁻⁶ (T19b, MS17); a variant uses 173.32 kg / 20 N/m (MG18); Q16 has a 7-spring network.

**Log decrement.** δ = ln(q_j/q_(j+1)) = 2πζ/√(1 − ζ²) = (1/n)ln(q0/q_n). Example: m = 4 kg, k = 5 kN/m, amplitude falls to 0.25 in 5 cycles → δ = 0.277, ζ = 0.044, b = 2ζ√(mk) = 12.5 N·s/m.

**Vibration isolation.**
- Steady amplitude X = F0/√((k − mω²)² + (bω)²), phase tan⁻¹(bω/(k − mω²)).
- Transmissibility TR = F_T/F0 = X/Y = √(1 + (2ζr)²)/√((1 − r²)² + (2ζr)²), with r = ω/ω_n. This holds for a rigid support (force) and for base motion (displacement).
- Isolation efficiency = (1 − TR)×100%. Resonance is at r = 1.
- Compressor example: 450 kg, 1750 rpm (183.3 rad/s), 10 kg reciprocating mass on a 100 mm crank, ζ = 0.15, TR = 0.2 → r = 2.72, ω_n = 67.4 rad/s, k = 2042 kN/m, F_T = 6.72 kN.
- Hopper with shaker (Q16, MG16b, MG18): 400 kg, k = 39.5 MN/m, b = 100 N·s/m, 75 N at 50 Hz. **(calc)** ω_n = 314.2 rad/s against ω = 314.16 rad/s, so r ≈ 1.000, ζ = 4×10⁻⁴, X ≈ 1.97 mm. It sits exactly at resonance.

**Stability.**
- Poles and zeros on the s-plane: (s² + 9s + 20)/(s³ + 6s² + 11s + 6) has zeros −4, −5 and poles −1, −2, −3; 10(s + 2.5)/(s² + 2s + 5) has poles −1 ± 2j.
- Routh–Hurwitz: all coefficients the same sign and the determinants R_i > 0.
  - D³ + 4D² + 8D + 12 is stable.
  - 2D³ + 4D² + 4D + 12 is unstable (R2 = −8).
  - 7D⁴ + 3D³ + 8D² + 5D + 9 is unstable (R3 = −126).
  - D⁴ + 6D³ + 11D² + 6D + K: **(calc)** stable for 0 < K < 10.

**Nonlinear systems.** Equivalent linearisation (sin θ ≈ θ is valid up to about 25°; sin θ ≈ 0.80θ over 0–90°) and perturbation.

**What a simulator could show:** slider-driven m/k/b models with root-locus and s-plane pole plots, time traces for the four damping cases, a TR-vs-r family of curves, a log-decrement readout, step and sine first-order responses, and a hopper or compressor on mounts.

---

## 4. Diagrams worth building in 3D
1. The power-transmission tree (M1) as an explorable hub, with PTO and universal joints linked to the tractor.
2. Open vs crossed belt with live wrap angles; a V-groove cross-section; an idler.
3. Spur mesh with every nomenclature circle labelled; helical F_t/F_r/F_a vectors; bevel pinion and gear with F_t/F_p/F_g (Fig. 17-5b); A–B–C idler train.
4. Roller-chain link exploded into plates, pin, bush and roller; sprockets; simplex vs duplex.
5. Bearing cutaways: deep-groove, self-aligning, tapered, needle, spherical roller; journal with oil film.
6. Multiple-disc clutch (Fig. 14-1) with the pack compressing; cone clutch with a pressure-vs-radius heat map.
7. Brakes: single shoe (Fig. 15-10) with a self-lock toggle; internal expanding shoe (Fig. 15-6) with sin θ pressure shading; simple, two-way and differential band brakes (Figs. 15-7 to 15-9).
8. Leaf spring (graduated + full leaves, nip gap) and a helical spring cut to show shear.
9. Fillet-weld throat section and the eccentric bracket / welded bar.
10. Capstan winch with 4 turns; well windlass.
11. AEE518 rigs: mass-spring-dashpot, pivoted bar, swing, cantilever-mounted machine, hopper shaker, compressor on isolators, cam-follower valve train.
12. Maize planter chain train (press wheel → lay shaft → seed meter).

## 5. Topics examined most often
**AEE503**, roughly in order of frequency:
1. The power-transmission diagram and belt/chain/gear merits.
2. V-belt selection from the catalogue and chain selection (2 kW palm separator, 3 kW digester).
3. Flat-belt width or power, including the crossed-belt wrap proof.
4. Spur nomenclature, helical forces, bevel thrust.
5. The single-shoe brake (225 N·m) and clutch vs brake.
6. Stribeck/AFBMA static capacity and rolling vs journal bearings.
7. Fillet-weld 45°/67.5° proof and the 50 mm bar weld.
8. Rope winch; fibre vs wire rope.
9. Spring types and leaf/helical spring design.

**AEE518:**
1. Stages of dynamic analysis and the modelling assumptions.
2. Second-order step response (θ̈ + 10θ̇ + 16θ = 32u).
3. Equivalent massive-spring systems.
4. Resonance, log decrement, transmissibility, isolation efficiency.
5. The hopper shaker.
6. Routh stability.
7. The thermometer first-order problem.
8. Pivoted-bar spring-damper.
9. Swing / pendulum energy method and linearisation.

**Not in the notes:** disc brakes, centrifugal clutches, coupling theory, chain polygon effect, worm-gear force formulas, journal-bearing hydrodynamics, multi-DOF modal analysis, anything tractor-specific. If the plan needs these, they have to come from another source.