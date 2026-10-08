<!-- Inventory of course notes produced by a research agent on 2026-10-06; source files under C:/Users/USER/Documents/School/500L -->

AEE510 (Farm Power II): inventory of the notes for the 3D tractor simulation

I read every page of all 5 scanned PDFs. There was no poppler, so I rendered the pages with pypdfium2 to `C:\Users\USER\AppData\Local\Temp\claude\C--Users-USER-Documents-Codes-AgriTech\20a2a566-ddb6-4e0f-823e-02776a10a72c\scratchpad\aee510img\`. I also read all 4 text extracts.

**File codes and page mapping** (citations below give the PDF page; the printed page is in brackets where it differs):
- **[TT]** AEE510 Tires and Tracks.pdf. PDF pp1–24 are the "Tires/Part 1" booklet, pp1–24. PDF pp25–32 are the "Tracks/Part 2" booklet, pp47–54.
- **[HY]** Tractor Hydraulic System .pdf. PDF p1–8 = textbook pp82–89.
- **[ST]** Tractor Steering .pdf. PDF p1–6 = pp90–95.
- **[MA]** Tractor Maintenance .pdf. PDF p1–2 = pp96–97.
- **[HE]** Human Engineering in tractor design .pdf (book ch.10). PDF p1–24 = pp192–215.
- **[L27]** Zoz & Grisso, Lecture27.txt. Cited by the paper's printed page.
- **[BAL]** Ballasting article .txt. Web pages 1–5 of 5.
- **[HFD]** Kumar 2019 (IJSRET pp1586–1589).
- **[HFS]** Adams/Boyd/Buchele (pp49–54).

---

## 1. Tyres and tracks

**Service classes:** over-the-road tyres are for speeds above 30 mph; off-the-road tyres are for speeds below 30 mph, are tougher and take more shock [TT p1]. Farm tyres are rated for no more than 20 mph [TT p7, p18].

**Cutaway parts (Fig. 2) [TT p2]:** tread, tread shoulder, tread depth, sidewall, body plies, valve stem, air container, bead and rim.
- Bead: bundles of steel wire that anchor all the plies.
- Body plies: rubber-cushioned cord of cotton, rayon, nylon or polyester. There are 2–20+ plies.
- Ply rating gives strength, not the actual number of plies.

**Further layers [TT p4]:** tubeless inner liner, tube, flaps and rim. Fig. 5 shows a shredded-wire undertread over a nylon body.

**Construction types (Fig. 3, Fig. 4) [TT p3]:**
- Fig. 3 compares 2-ply and 4-ply sections; the 2-ply tyre has larger cords.
- **Bias ply:** cords run bead to bead at an angle, alternating direction in each ply.
- **Belted bias:** a bias body plus low-angle rigid belts under the tread.
- **Belted radial:** cords run bead to bead at about 90°, plus belts.
- **Wire-reinforced ("SWB", shredded wire braid).**
- Radials give 5–7% better efficiency than bias tyres [L27 p39].

**Tread codes [TT p4–5]:**
- Front: F-1 rice, F-2 single rib, F-2D dual rib, F-2T triple rib, F-3 industrial.
- Rear: R-1 regular, R-2 cane/rice deep, R-3 shallow non-directional, R-4 industrial.
- Implement: I-1, I-3, I-4, I-6.
- Industrial: E-1 to E-7.
- A suffix "O" or "C" on R-2 means open or closed tread.

**Size codes (Fig. 7) [TT p5]:**
- "24.5-32" means 24.5 in section width on the recommended rim and a 32 in rim diameter.
- Dual sizing, e.g. "12.4/11-28", gives the new and old sizes.

**Directional arrows (Fig. 8) [TT p5]:** the V-tread must point downward when viewed from the front. It is reversed only for ground-driven implements.

**Inflation (Fig. 9) [TT p6–7]:** Fig. 9 shows cross-sections for over-, under- and proper inflation.
- Overinflation wears the tread centre and risks breaking the cords.
- Underinflation wears the tread sides and builds heat.
- Check pressure cold. Hot tyres read 4–6 psi higher; never bleed them.
- With liquid ballast, check pressure with the valve at the bottom, or add ½ lb per foot of liquid height.
- On hard roads, raise pressure to the maximum to reduce tread-bar wiping (Fig. 34 [TT p18]).

**Failure modes worth texturing or animating [TT p15–19]:**
- X-shaped fabric break from an impact at high pressure.
- Burst from freezing water.
- Furrow-tyre buckle; the fix is 4 psi more in the furrow tyre.
- Spinning wear on the leading edge of the bars.
- Stubble wear, weather checks, cuts, and valve tear-off caused by the bead slipping on the rim.

**Duals [TT p13–15]:** benefits are flotation, stability and less slip. Matching tolerance: no more than ¼ in in diameter or ¾ in in circumference (½ in / 1½ in for tyres larger than 8.25).

**Tracks: seven basic parts [TT p26 (48)]:** endless track, drive sprocket, rollers, front idler, tension mechanism, roller guards, frame.
- **Chain (Fig. 4) [TT p27]:** each section is a pair of links with a press-fit bushing and pin. A master pin is held by a snap ring. Shoes are bolted on with grousers.
- **Shoe types (Fig. 5) [TT p27]:** standard grouser, open-centre, snow, multi-grouser, rubber.
- **Chain types (Fig. 6) [TT p28]:** flush-type and interlocking-type.
- **Sprocket [TT p28]:** "hunting tooth" design with an odd tooth count, so each tooth meets a bushing only on alternate revolutions.
- **Rollers [TT p28]:** the carrier roller holds up the upper strand; the track rollers carry the machine weight.
- **Tension mechanism [TT p28]:** a recoil spring plus an adjustable rod or a hydraulic grease adjuster.
- **Tension setting [TT p30–31]:** about 1 in of sag midway between carrier roller and front idler (Fig. 11). Fig. 12 shows too tight, too loose and correct. Too tight causes friction and heat at pins and bushings; too loose causes whip and thrown tracks.
- **Idler misalignment, three modes (Fig. 13–14) [TT p32].**
- The undercarriage is 20% of a crawler's purchase cost and 50% of its service cost [TT p25].

**Soil–tyre interaction to visualise:**
- Wheel force diagrams [L27 p6–7, Figs 1–3]: a solid wheel, a soft wheel with the reaction offset forward by eh, and a deformable wheel on soft soil with offsets ev and eh. The three radii are static loaded radius (slr), rolling radius (rr) and torque radius (rt).
- Track belt force diagram with bogie loads W1–W5 [L27 p8, Fig. 4].
- Tread-mark patterns [TT p7, Fig. 11; BAL p3]:
  - Too much weight: sharp marks, no slip, compaction.
  - Too little weight: marks wiped out.
  - Proper weight: soil between the cleats shifted but the pattern visible.
- Ground pressure is roughly equal to tyre pressure [L27 p39].
- Cone penetrometer and cone index [L27 p30–31, Fig. 39].

---

## 2. Hydraulics and 3-point linkage [HY]

**Basic circuit (Fig. 40) [p1–2]:** pump in the reservoir (the transmission housing) → control valve (lift / lower lever) → ram cylinder with piston → connecting rod → ram cross shaft → lift rods → lower lift arms.
- On "lower", the implement drops under its own weight and pushes oil back to the reservoir.
- A relief valve returns oil to the reservoir on overload.
- This simple system needs a depth wheel.

**Pump and relief values [p2–3]:**
- The gear pump is most common; some tractors use a multi-piston pump.
- The pump is usually built round the PTO shaft inside the transmission, or mounted on the engine.
- A 45 kW (60 hp) tractor delivers 27 L/min (6 gal/min).
- Filtration is a magnetic plug or a replaceable element.
- Relief blow-off is 150 kg/cm² (2000 psi), and you hear a knocking sound when it blows.

**Draft control (Fig. 41) [p3–4]:**
- Used for soil-engaging implements; it keeps draft constant.
- Top-link compression rises with depth. The top link compresses a heavy sensing spring (sometimes inside the top cover), which moves the control valve and lifts the implement. The spring pushes back when draft drops, and the implement lowers.
- A response/damping control runs from fast to slow.
- A double-acting top link senses both compression and tension. It is in tension in shallow ploughing or when the front wheels drop into a furrow. Tension sensing cuts out when the implement is fully raised.
- **Alternatives [p4–5]:**
  - Torque sensing through a special coupling in the drive shaft to the differential, linked to the valve. Suits semi-mounted ploughs: the valve can also work the plough's rear lift ram.
  - Lower-link sensing, from tension in the lower arms.

**Other controls [p5–6]:**
- Position control: sets height for above-ground implements such as sprayers; top-link force has no effect.
- External services: tapping points for tipping trailers and loaders, an isolator valve, and two ports for double-acting rams and motors.
- Pressure control: transfers trailed-implement weight to the rear wheels through a support chain to the lift arms.
- Flow control valve: sets the speed of lift and drop.
- Mechanical lock: holds the arms raised for transport.

**Linkage (Fig. 42) [p6–7]:**
- Lift rods; the right-hand lift rod has a levelling box.
- Stabiliser bars, internal check chains and external check chains.
- Pin Categories I, II and III. Category I/II dual linkage is made by swapping the hitch balls.
- Attach order: left lower arm, right lower arm (the adjustable one), then top link.
- Fig. 43: automatic coupler, an inverted-V frame with a release lever [p7–8].

**Care [p8]:**
- Grease the linkage and levelling box weekly.
- Do not oil the lower-arm balls.
- Lower the implement before parking.
- Never tow from the top-link point: the tractor can overturn backwards.

**Animation and cutaway opportunities:**
- Oil flow pump → valve → ram, with a relief bypass, shown in lift, hold, lower and overload states.
- Ram pushing the cross shaft, lift rods raising the arms.
- Draft feedback loop: top-link spring compressing and the valve spool shifting.
- Gear-pump internals (only named in the notes).

---

## 3. Steering [ST]

**Types [p1]:** manual, power-assisted and hydrostatic.

**Manual (Fig. 44) [p1–2]:**
- Chain of parts: steering wheel → steering box → drop arm → drag link → steering arm → stub axle. A track rod joins the two steering arms so both move equally.
- The track rod must be reset after changing track width.
- A variant uses two drop arms and two drag links and no track rod.

**Power-assisted [p2]:**
- Manual linkage plus a fan-belt-driven pump, reservoir and double-acting ram.
- The valve is worked by a linkage from the steering box.
- It can still be steered manually if the hydraulics fail.

**Hydrostatic (Fig. 45) [p2–3]:**
- No mechanical linkage. An engine-driven pump, a control valve on the steering column, a double-acting steering cylinder and pipes.
- It cannot steer with the engine off.

**Steering boxes (Fig. 46) [p3–4]:**
- Recirculating ball: column thread A, nut B, steel balls in the grooves, peg F to rocker arm D, shaft E with about ±30° swing driving the drop arm.
- Worm and peg: shaft A with thread B, peg C on rocker arm D, shaft E. Both are good cutaways.

**Toe-in (Fig. 47) [p5]:** front rim distance A is 3–6 mm (⅛–¼ in) less than rear distance B, measured at hub height. It is set by track-rod length (threaded ends, clamp bolts). Some 4WD tractors use no toe-in.

**Front-wheel drive [p5–6]:**
- Transfer box → shaft → front differential, with special hub couplings.
- Engaged by a lever, or automatically when the rear wheels slip.
- Equal-wheel 4WD: over 75 kW, differentials in both axles, universal joints in the front hubs.

**Maintenance [p4]:** grease the linkage every 10 h; check the box oil (SAE 90) every 200 h; grease the wheel bearings every 50 h.

**Gap:** Ackermann geometry and turning-radius equations do not appear anywhere in the notes.

---

## 4. Ballasting, stability, ROPS and seat vibration

**Ballast, practical rules [TT p7–13]:**
- Ideal slip is 10–15%; drawbar HP peaks there (Fig. 14).
- Chalk-mark test over 10 revolutions [TT p9]:

| Loaded revolutions | Slip | Action |
|---|---|---|
| 10 / 9½ | 0% / 5% | remove ballast |
| 9 / 8½ | 10% / 15% | correct |
| 8 / 7½ / 7 | 20% / 25% / 30% | add ballast |

- More weight is needed on loose soil, for towed (versus integral) implements, at low speed and at high HP. At ¾ load, use ¾ of the rear weight [TT p8].
- Front ballast on 2WD is for stability, not traction: front = ½ rear for integral implements, ⅓ rear for towed [TT p10].
- Weight guides: lb rear weight per PTO hp versus 2–7 mph (Figs 16–18) [TT p10–11]. Worked example: 120 PTO hp × 84–100 lb/hp = 10,100–12,000 lb [TT p11].
- Cast-iron wheel weights are 40–140 lb.
- Liquid ballast is water plus CaCl₂ at 3.5 lb/gal (protected to −12 °F), filled to 75% or valve level (Fig. 20) [TT p12–13].
- Dry ballast fills 87–95%, at 10/15/20 lb/gal [TT p12].
- Liquid ballast chart [TT p13]: e.g. 18.4-38 8-ply carries 11,940 lb, takes 188 gal = 2,226 lb; 24.5-32 carries 17,800 lb, takes 292 gal = 3,458 lb.

**Ballast article [BAL p2–3]:**
- Recommended split is 40/60 front/rear.

| Tractor | Light load F/R | Heavy load F/R |
|---|---|---|
| 2WD | 25/75 | 35/65 |
| 4WD | 35/65 | 40/60 |

- The table is garbled in the extract; this is my best reading.
- Water fill is 75:25 water to air, using valve positions at 12 o'clock and 10 o'clock; inflate to 14–16 psi.

**Stability and rollover:**
- Overturns cause 52–54% of on-farm tractor fatalities; 6.9 deaths per 100,000 tractors in 1973–74 [HE p20]. Adams et al. give 53% [HFS p49].
- Centre-of-gravity height rises with HP while track width stays fixed. Narrowing row spacing from 40 to 30 in cuts wheel spacing from 80 to 60 in, which reduces sidehill stability and safe turning radius [HFS p51].
- A tipping model (Koch et al. 1970) is cited only, with no equations.
- **ROPS [HE p20–21]:** standards ASAE S383 and S310.2; designed with FEM. Tests: static or dynamic lab loading, then a crush test, field upset test and temperature-material test.
- From 1 Sept 1976, ROPS was required on tractors over 20 hp used by hired operators [HFS p52].
- **Gap:** no stability or overturn equations are in the notes.
- PTO hazard: a 1.5 in shaft at 540 rpm entwines clothing at more than 4.25 ft/s [HFS p49].

**Seat and vibration [HE p17–20]:**
- The tractor is a 6-DOF spring-mass-damper system. The referenced Chapter 12 is not in the notes, so the 6-DOF model is named only.
- Vertical motion dominates.
- Two-DOF seat schematic (Fig. 10.9): man m₁ on cushion K₁/C₁; seat m₂ on suspension K₂/C₂ with stops; chassis input z_input.
- Frequency facts [HE p10–11]: wheel-tractor natural frequencies are 3–10 Hz; 4–8 Hz is the critical human band; the viscera resonate at 4–5 Hz; whole-body vibration is up to 20 Hz; 30 Hz and above is hand/foot vibration.
- ISO 2631 boundaries (Fig. 10.6) [HE p12].
- Cab isolation mount (Fig. 10.11) [HE p22].

**Cab and controls [HE p2, p14–16, p23]:**
- Fig. 10.1 shows 21 numbered controls and instruments.
- Anthropometrics (Table 10.6), 5th/50th/95th percentile: height 162/173/185 cm; sitting erect 84/91/97 cm; mass 58/75/98 kg. Cab height should be 185 cm.
- Instrument panel angled down at most 45°, at 71 cm.
- The clutch is worked by the left foot.
- SAE J209 gauge grouping (Fig. 10.8); ASAE S304 symbols (Fig. 10.7).
- Cab heating, ventilation and air conditioning (Table 10.7): 8.2 kW heating, 7.0 kW cooling, pressurisation 50–100 Pa.
- [HFD] is a short review that repeats this material (seat pressure distribution, cab centred on the chassis).

---

## 5. Equations that can drive the simulation

**Traction mechanics [L27]:**
- Wheel reaction offset: eh = slr·MR/Wd (1, p6). On soft soil: eh = (slr − ev)·MR/Wd (2, p7).
- Net traction: NT = GT − MR (p6).
- Travel reduction (slip): TRR = 1 − Va/Vt (3, p9).
- Theoretical speed: Vt = rpm·rr·2π/60 (4, p10).
- Net traction ratio: NTR = NT/Wd (5, p10).
- Tractive efficiency: TE = NT·Va / axle power = (NTR/GTR)(Va/Vt) (6, p11).
- Gross traction ratio: GTR = T/(rt·Wd) (7, p11), or GTR = NTR(1 − TRR)/TE (8, p11).
- Torque radius: rt = T/(GTR·Wd) (9, p11).
- Motion resistance ratio: MRR = GTR − NTR (10, p11).
- TE = pull ratio × velocity ratio (11, p14).
- Typical values: rr ≈ 1.06·slr (p6). MRR is 0.05–0.15 (p14). TE peaks at NTR ≈ 0.4 for tyres and 0.5 for belts (p14, p24). Tyres on concrete give TE = 92.5% (about 2% MR and 5% slip) (p37).
- Regression form: NTR = DA[1 − exp(−C0·TRR·100)]; MRR = TA + AB·TRR (12–13, p17). Worked example: NTR = 0.664(1 − e^(−0.098·TRR%)), MRR = 0.090 + 0.001·TRR% (Fig. 17, p18). Speed effect: MRR = 0.0079·Vt + 0.0806 (Fig. 25, p24).

**Brixius equations [L27 p31–32]:**
- Mobility number: Bn = (CI·b·d/W)·(1 + 5δ/h)/(1 + 3b/d) (14).
- GTR = 0.88(1 − e^(−0.1·Bn))(1 − e^(−7.5·s)) + 0.04 (15).
- MRR = 1.0/Bn + 0.04 + 0.5·s/√Bn (16).
- Variables: CI = cone index; b = section width; d = unloaded diameter; r = rolling radius; δ = deflection; h = section height; W = wheel load; s = slip.
- Coefficients (Table 2):

| Use | Slip exp. | Lead coef. | Bn exp. | Constant | MRR numerator |
|---|---|---|---|---|---|
| Bias (original) | 7.5 | 0.88 | 0.1 | 0.04 | 1 |
| Radial (proposed) | 8.5–10.5 | 0.88 | 0.1 | 0.03–0.035 | 0.9 |
| Radial (spreadsheet) | 7.0 | 0.88 | 0.08 | 0.03 | 1.20 |

- The solution is iterative.
- Example inputs: CI = 860 kPa; 20.8R42 duals at 83 kPa and 8,300 kg axle load; 710/70R38 correct at 41 kPa versus 193 kPa overinflated.
- Fig. 45 (typical cone-index values) is an image and is not in the extract.

**Weight transfer and tractor performance [L27]:**
- RWD = RWS + P·Dh/Wb; FWD = FWS − P·Dh/Wb (p22). Front motion resistance is found by iteration (p22–23).
- Belts: best at a dynamic balance ratio of about 50%. From 60% static front weight, a 5° draft angle gives 50% at VTR 0.4 (p8–9).
- Power delivery efficiency: PDE = drawbar power / engine (or PTO) power (17–18, p34). PDE = transmission efficiency × TE / PTO drive efficiency (19, p34).
- Axle power = 0.96 × PTO power; PTO power = 0.85 × flywheel power (28–29, p42).
- Axle power delivery efficiency (Fig. 47, p39), concrete / good / medium / poor soil:

| Tractor | Efficiency |
|---|---|
| 2WD | 0.91 / 0.75 / 0.70 / 0.57 |
| MFWD | 0.91 / 0.79 / 0.75 / 0.66 |
| 4WD | 0.92 / 0.80 / 0.78 / 0.73 |
| Belt | 0.92 / 0.85 / 0.83 / 0.81 |

- **Ballast equations:** W·Vt/P = 1/GTR, i.e. WSP⁻¹ = k/GTR, with k = 375 (lb/hp, mph) or 383 (kg/kW, km/h) (24–27, p40–41). Optimum GTR is 0.54 (range 0.54–0.60).
- Ballast numbers (Table 5, p42), kg/kW with speed in km/h: 709 (axle power), 680 (PTO), 580 (flywheel). Weight-to-power ratio = ballast number / speed.
- Reduce required weight by 0.4·tan(draft angle), i.e. 4–8% for 5–10° (p43). Example: 77 kg/axle kW at 9.8 km/h (p43–44).

**Tyre booklet [TT p10]:** % slip = (R₂ − R₁)/R₂, where R₁ = revolutions with no load and R₂ = revolutions with load over the same distance.

**Vibration, seat and noise [HE]:**
- Displacement, velocity, acceleration: X = A·sin ωt, Ẋ = ωA·cos ωt, Ẍ = −ω²A·sin ωt (6–8, p11). Ẍ_RMS = ω²A/√2 (9, p12).
- Vibration level: VAL = 20·log(V/1 m/s²) (10, p12).
- Seat input: Z_input = z_t + Rθ; Z̈ = z̈_t + Rθ̈, where R = distance from seat to CG and θ = pitch (11–12, p17).
- Transmissibility: T = √{[1 + (2ζr)²] / [(1 − r²)² + (2ζr)²]}, with r = ω_t/ω_s (14, p18).
- Damping ratio ζ = c/c_c, with c_c = 2Mω_s and ω_s = √(k/M) (15–17, p18–19).
- T < 1 only when r > 1.414. Target T = 0.5–0.65. Curves are given for ζ = 0, 0.15, 0.25, 0.5 and 1 (Fig. 10.10, p19).
- Seat acceleration: a_z = T·Z̈_input (18, p20).
- Sound: f = 1/T; A_RMS = A_peak/√2; SPL = 20·log(P/P₀) with P₀ = 2×10⁻⁵ N/m² (2–5, p6–8). +6 dB doubles sound pressure; two 80 dB sources make 83 dB (p8–9).
- OSHA exposure limits [HE p6]: 90 dBA for 8 h down to 115 dBA for ≤¼ h.
- Measured tractor noise: 96 dB(A) without a cab, 88 dB(A) with a cab, 80 dBA target [HE p5, p22].
- Heat balance: S = M − E ± R ± C − W (1, p3), with metabolism 60–150 kcal/h·m² over a 2 m² body.
- Fanger comfort equation F(H/A_Du, I_cl, t_a, t_mrt, P_a, v) = 0 (19, p23).

**Not given in the notes (standard physics you would have to add):** F = pA and v = Q/A for rams, ram sizing (27 L/min at 150 kg/cm² can be fed into these), Ackermann geometry, and rollover thresholds.

---

## 6. Figures worth reproducing in 3D

1. Tyre cutaway with labelled layers, plus bias / belted-bias / radial ply sections and 2-ply vs 4-ply sections. An exploded view or ply-angle slider [TT p2–3, Figs 2–4].
2. Inflation cross-sections morphing with pressure, with the contact patch and wear zone [TT p6, Fig. 9].
3. Tread-mark soil decals for too heavy / too light / correct, and slip-driven lug-print smearing [TT p7, Fig. 11].
4. Liquid ballast at 75% versus 100% fill (sloshing fluid, compressible air cushion), cast-iron wheel and front weights [TT p11–12, Figs 19–21].
5. Crawler undercarriage: sprocket, idler, carrier and track rollers, recoil spring, links, pins, bushings and shoes; tension-sag states; idler misalignment [TT p26–32, Figs 3–8, 11–13].
6. Wheel force free-body overlays (W, Wd, T, GT, NT, MR, eh/ev, slr/rr/rt) and belt bogie loads [L27 Figs 1–4]. Tyre cross-section with b, d, h, δ [L27 Fig. 40].
7. Live traction curves: TE, NTR, MRR and TRR against NTR [L27 Figs 10–14], driven by the Brixius equations.
8. Simple hydraulic lift circuit with animated oil [HY p2, Fig. 40]. Draft-control loop with the top-link spring [HY p3, Fig. 41].
9. Three-point linkage: top link, lift rods, levelling box, check chains, stabilisers, lower arms, Category I/II/III pins; automatic coupler with release lever [HY p7, Figs 42–43].
10. Manual steering linkage [ST p2, Fig. 44] and hydrostatic circuit [ST p3, Fig. 45].
11. Recirculating-ball and worm-and-peg box cutaways [ST p4, Fig. 46]. Toe-in measurement, A vs B [ST p5, Fig. 47].
12. Cab interior with the 21 controls [HE p2, Fig. 10.1], a J209 gauge cluster [HE p16, Fig. 10.8] and ISO symbols [HE p15].
13. Two-DOF seat spring-damper rig [HE p18, Fig. 10.9] with a live transmissibility plot [HE p19, Fig. 10.10] and the ISO 2631 exposure envelope [HE p12, Fig. 10.6]. Cab isolation mount cutaway [HE p22, Fig. 10.11].
14. Maintenance-interval overlay (10 / 50 / 250 / 600 h checkpoints) on the 3D tractor [MA p1–2]:
    - 10 h: engine oil, radiator, steering-linkage grease, air cleaner.
    - 50 h: air cleaner service, gearbox oil, wheel bearings, levelling box, tyre pressure, battery, steering fluid.
    - 250 h: engine oil and filter, breather, steering box, clutch free play, brakes, fuel water trap, fan belt, radiator core.
    - 600 h: fuel filter and bleed, injectors, transmission oil, cooling flush.
    - Chapter image: an oil-bath air cleaner being serviced.

**Gaps to keep in mind when planning:** there is no Ackermann geometry, no rollover or stability maths, no hydraulic pump internals and no 6-DOF equations (the referenced Chapter 12 is not included). A plan that adds these goes beyond the notes and should say so.
