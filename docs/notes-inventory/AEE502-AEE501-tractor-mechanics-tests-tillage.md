<!-- Inventory of course notes produced by a research agent on 2026-10-06; source files under C:/Users/USER/Documents/School/500L -->

## Inventory of the scanned AEE501/AEE502 notes

I read every page of all 5 PDFs. The Read tool's PDF renderer wasn't installed, so I rendered the pages to PNG with pypdfium2. The images are in `C:\Users\USER\AppData\Local\Temp\claude\C--Users-USER-Documents-Codes-AgriTech\20a2a566-ddb6-4e0f-823e-02776a10a72c\scratchpad\img\` (named `mech_pNN`, `tests_pNN`, `doc47_pNN`, `bush_pNN`, `mgmt_pNN`), so you can look at any figure directly. I also read the AEE501 text extracts: the questions, part_5_exam and Estimating_farm_machinery_costs (the 2015 revision).

Short names used below:
- **MECH** = Tractor Mechanics AEE502.pdf. It is Ch. 2 of R.H. Macmillan, *The Mechanics of Tractor–Implement Performance*.
- **TESTS** = Tractor Tests and Performance (502).pdf. It is a textbook Ch. 15, book pp. 350–362. It stops mid-chapter: page 13 shows a cut-off "15.15" page that was not scanned.
- **UJ** = DOC-20210628-WA0047..pdf. It is D.J. Dunn's "Universal Couplings" tutorial (freestudy.co.uk).
- **BUSH** = AEE501 Bush.Land clearing Tillage.pdf.
- **MGMT** = AEE501 Machinery Management MODULE 1.pdf. It is Iowa State PM 710 (2001 paper / 2005 electronic edition).

**Not covered anywhere in these files:** tractor stability or overturning, weight transfer, the 3-point hitch, hydraulics internals, PTO gearbox internals, engine internals beyond the P-V diagram, OECD codes, and the belt-pulley test procedure (belt power appears only historically). The only weight-related points are:
- MECH p10: the tractive coefficient depends on weight on the driving wheels, and on a slope it should include the weight component down the slope.
- MECH p7: more weight on the drive wheels lowers slip loss but raises rolling-resistance loss.

---

### 1. Machines, implements and attachments

**A. Generic 2WD tractor model (MECH p2, p6, Figs 2.1 and 2.3)**
- **Parts:** an engine block, a driveshaft to the rear axle (drawn with a rotation ellipse), a small front wheel and a large rear drive wheel.
- **Motions to animate:**
  - engine rotating at Ne;
  - rear wheel at Nw = Ne/q;
  - body translating at V0 (ideal) or V (with slip);
  - force arrows: P (drawbar pull, rearward at the hitch), H (soil reaction, forward at the rear contact patch) and R (rolling resistance at the contact patch).
- **Abstraction the notes insist on (MECH p1):** the engine is just torque × speed, whatever its type (diesel/petrol, 2- or 4-stroke). The transmission is just a ratio q, whether it uses gears, chains, belts or is hydrostatic.
- **Cutaway candidate:** a geartrain showing q. The notes say about 98% efficiency per gear pair: 3 pairs in the change gearbox plus 2 in the differential/final drive gives 0.98⁵ ≈ 90% (MECH p8).
- **Problem 2.1 (MECH p5) is an interactive scene idea:** jack up the drive wheels and count engine and wheel revolutions by hand or with a tachometer. Check by counting gear teeth and pulley/sprocket diameters, or by driving on a hard surface and measuring travel speed and rolling radius.

**B. Universal joint / Hooke's joint (UJ p1–3)**
- **Parts:** two forked yokes ("coupling") on the input and output shafts, and a cross-shaped "spider" pinned into both yokes so it pivots about two perpendicular axes. The joint is also called a Hardy Spicer.
- **Uses named:** propeller shafts joining gearboxes to wheels, and hand tools. It maps naturally onto a tractor PTO driveline.
- **Motion:** with constant input ω1, the output ω2 speeds up and slows down twice per revolution.
- **Double joint (Fig 3):** two Hooke's joints with an intermediate shaft give a constant-velocity joint.
- **Animation:** exploded view (Fig 2), rotation at a variable angle φ, and a live ω2/ω1 plot.

**C. Dynamometers (TESTS)** — all strong cutaway candidates.
- **Prony brake (p4–5, Fig 15.2).**
  - Parts: (a) wooden blocks clamped around (b) the engine pulley, tightened by (c) a handwheel; (d) a lever arm of length l presses on (e) a scale that reads F.
  - Motion: the pulley spins inside the stationary blocks and the arm load registers.
  - Drawback: the danger of the engine "running away".
- **Hydraulic dynamometer (p6, Fig 15.3, a true sectional drawing).**
  - Labelled parts: intake, intake needle valves to each rotor, exhaust control, pressure gauge, ball cradle bearings, rotors, shaft, thermometer, exhaust ports.
  - The outer casing is free to rotate and is restrained by a torque arm. Water friction turns the work into heat.
  - Accuracy about 0.5%. Absorbing capacity ∝ N³·D⁵.
- **Air (fan) brake (p7).** Plates on arms; power depends on plate size, radius and rpm³. Error up to 20%.
- **Eddy-current dynamometer (p7).** A solid steel rotor with tapered teeth acting as poles. The stator carries DC field-excitation coils and is mounted in bearings so it can rotate. Coolant is circulated. Torque is set by the field excitation.
- **DC cradle-mounted dynamometer (p7–8, Fig 15.4, photo).** A shunt-wound generator with separate excitation. The field frame is free to rotate and reacts against scales. Accuracy 0.25%. It can run as a motor, which is how friction power is measured.
- **Shop-type / agricultural dynamometer (p8–9, Fig 15.5).** A portable wheeled unit coupled to the tractor PTO. A pressure gauge reads the force on the torque arm and a direct-reading speed indicator shows PTO rpm.
- **Drawbar dynamometers:**
  - spring dial type, Dillon (p10, Fig 15.6);
  - hydraulic: the Nebraska tractor test car (p10–11, Fig 15.7). A hydraulic cylinder transmits the force to a pressure transducer, then to a recorder and computer, and a throttling valve damps the fluctuations. The car also measures velocity, wheel slip, engine rpm, fuel use, sound level and air/hydraulic/coolant/fuel temperatures;
  - strain-gauge load cell (p11–12, Fig 15.8): a clevis/eye link transducer plus a digital readout box.
- **Torsion dynamometer (p11, p13, Fig 15.9).** A strain-gauge torque meter with slip rings for measuring PTO torque.
- **Chassis dynamometer (p12–13, Fig 15.10, Uppsala, Sweden).**
  - Layout: a pit with concrete-covered drums under the drive wheels, gearboxes 1:18 and 1:1–7.7, a variable-speed transmission, a hydraulic dynamometer, an electric motor, a pendulum frame and a scale.
  - Advantages: weather-independent and usable year-round.
  - Disadvantage: the tractor is restrained, so there is no front-wheel rolling resistance.

**D. Land-clearing machines (BUSH p2–4)**
- **Named:** tree pusher, rolling chopper, bulldozer, clearing rake, anchor chain, shearing blade.
- **Bulldozer (Fig 1, p3, photo):** a crawler tractor with tracks, a front straight blade on push arms, and a ROPS cab.
- **Tree pusher (Fig 2, p4, photo):** a crawler with a rake-toothed blade (tines along the bottom edge) and a high angled pusher bar/frame above it for pushing trees over.
- **Caption mismatch:** the text says the tree pusher is Fig 1 and the bulldozer Fig 2, but the captions say the opposite.
- **Motions to animate:**
  - blade raise/lower and pushing;
  - anchor chain dragged between two tractors (chaining knockdown);
  - shearing blade cutting at ground level;
  - windrowing debris.

**E. Tillage implements (BUSH p5–7)**
- **Primary tillage:**
  - mouldboard plough (Fig 3, p5). The photo actually looks like a rear-mounted disc-type plough, despite the caption;
  - disc plough;
  - disc harrow (Fig 4, p6): a frame with a 3-point headstock, two gangs of concave discs, and rear tines and leveller;
  - chisel plough, heavy-duty cultivators, rigid or spring tine cultivators, subsoilers, rotary ploughs, rotary cultivators/tillers, reciprocating spading.
- **Secondary tillage:** harrows of different types, ridger.
- **Conservation-tillage tools:** coulters, row cleaners, disc openers, in-row chisels, roto-tillers, sweeps, field cultivators, blades.
- **Motions:** disc and gang rotation, soil inversion by the mouldboard, tine shank penetration, rotary tiller blade rotation from the PTO.
- **Attachment:** the notes only say "tractor drawn". The photos show 3-point mounting; there are no hitch details.

**F. Machines that appear only in the cost tables (MGMT p2, p5; no mechanisms described)**
- **Tractors:** 2WD and 4WD tractors in 30–79, 80–149 and 150+ hp classes.
- **Harvesting:** combine (pull or self-propelled), forage harvester (pull or SP), corn picker, potato harvester, sugar beet harvester, cotton picker (SP), windrower (SP), bean puller-windrower.
- **Tillage:** moldboard plow, heavy-duty disk, tandem disk, chisel plow, field cultivator, harrow, roller-packer/mulcher, rotary hoe, row-crop cultivator, rotary tiller.
- **Hay and forage:** mower-conditioner (sickle or rotary), mower (sickle or rotary), rake, rectangular baler, large square baler, large round baler, stalk chopper, forage blower, forage wagon.
- **Planting and application:** row-crop planter, grain drill, fertilizer spreader, boom sprayer, air-carrier sprayer.
- **Transport:** wagon, vehicle.

The AEE501 exams also mention a 5-ft trailed slasher (mower), a combine with a 6 m header, a maize planter and a field truck.

---

### 2. Tractor mechanics and testing topics

- **Ideal analysis, no losses (MECH p1–3):**
  - speed analysis: travel speed is set by engine speed and the gear ratio;
  - torque/force analysis: drawbar pull is set by engine torque and the ratio;
  - power: drawbar power equals engine power when there is no slip and no rolling resistance.
- **Performance graphs and envelopes (MECH p4–5, Fig 2.2):**
  - stepped speed-vs-pull curves for discrete gears;
  - a stepless/CVT gives a constant-max-power hyperbola envelope (33.6 kW);
  - conclusions: speed is set by engine speed, pull determines engine torque, and both depend on the ratio.
- **Analysis with losses (MECH p6–7):** wheelslip, rolling resistance, and power loss = slip loss + rolling-resistance loss.
- **Efficiencies (MECH p8–9):** tractive (a "force" term P/(P+R) times a "speed" term (1−i)), transmission, engine and overall.
  - How tractive efficiency is measured: drawbar pull with a tension load cell, speed by timing over a distance, wheel torque with a torque cell, and wheel rpm by counting revolutions.
- **Tractive coefficient ψ (MECH p10).** It is analogous to a friction coefficient. For 4WD tractors, state which weight is used.
- **Table 2.1 (MECH p10):** engine → transmission → wheels, showing input/output force, velocity, power and efficiency at each stage. A good basis for a "power-flow" panel.
- **Performance criteria (TESTS p1–2):**
  - number of ploughs pulled;
  - maximum drawbar pull (depends on soil, gear and ballast);
  - maximum drawbar power (the most useful criterion);
  - maximum PTO power;
  - fuel consumption;
  - torque curve / "lugging ability";
  - drawbar pull vs speed in one gear at open throttle.
- **History (TESTS p2):** before 1959, rated drawbar power = 0.75 × corrected maximum and rated belt power = 0.85 × corrected maximum. From 1959 the ASAE/SAE Tractor Test Code and Nebraska tests dropped rated and corrected hp. Nebraska added sound level in dB(A) at the operator's ear in 1971, and SI units from Test No. 1218 (1976). SAE J816 is also mentioned.
- **Power definitions (TESTS p2–4):** power, kW, brake, PTO, drawbar, friction, indicated, maximum brake, observed and corrected power; kWh = 3.6×10⁶ J. Tractor engines are rated at rated speed and run there continuously, unlike car engines rated at peak.
- **Dynamometer classes (TESTS p4):** brake, drawbar or torsion; absorption or transmission.

---

### 3. Equations for simulation

**Tractor speed, force and power (MECH)**

| Eq. | Equation | Page |
|---|---|---|
| 2.1 | Nw = Ne/q; V0 = πD·Nw = πD·Ne/q | p1 |
| 2.2 | Tw = q·Te; H·D/2 = Tw, so H = 2qTe/D; ideal P = H = 2qTe/D | p3 |
| 2.3 | Qe = 2π·Te·Ne | p3 |
| 2.4 | Qd = P·V0 (equals Qe when ideal) | p3 |
| 2.5 | wheelslip i = (V0 − V)/V0 | p7 |
| 2.6 | V = V0(1 − i) = (πD·Ne/q)(1 − i) | p7 |
| 2.7 | H = P + R | p7 |
| 2.8 | Power loss = 2π·Tw·Nw − PV = H·V0·i + R·V = H·Vs + R·V, where Vs is slip velocity | p7 |

**Efficiencies (MECH)**

| Eq. | Equation | Page |
|---|---|---|
| 2.9 | ηt = PV/(H·V0) = ((H − R)/H)(1 − i) | p8 |
| 2.10 | ηt = (P/(P + R))(1 − i) | p8 |
| 2.11 | ηt = PV/(2π·Tw·Nw) | p8 |
| 2.12 | ηr = 2π·Tw·Nw / (2π·Te·Ne); geared drives lose no speed, so Tw < q·Te | p8 |
| 2.13 | ηe = 2π·Te·Ne / (1000·FC·C), with FC in kg/min and C in kJ/kg; diesel maximum ≈ 35% | p9 |
| 2.14 | ηo = ηengine × ηtransmission × ηtractive; typical 0.3 × 0.90 × 0.75 ≈ 20% | p9 |
| 2.15 | ψ = drawbar pull / weight on driving wheels | p10 |

**"Farmland" tractor data (MECH p4, Fig 2.2; from Australian Test Report No 78, Leyland 253)**
- **Gear ratios:** gear 3 = 139.5, gear 5 = 85.6, gear 7 = 47.3.
- **Engine curve (rpm / N·m):** 2390/0, 2370/40, 2350/80, 2325/120, 2250/142, 1730/161, 1300/173, 1000/171.
- **Sample ideal outputs:**
  - gear 3: 0 kN at 4.07 km/h up to 38.31 kN at 2.21 km/h;
  - gear 7: 11.99 km/h at 0 kN.
- **Maximum engine power:** 33.6 kW.
- **Envelope (kN → km/h):** 6→20.10, 7→17.23, 8→15.08, 10→12.06, 12→10.05, 14→8.61, 16→7.54, 18→6.70, 20→6.03, 25→4.82, 30→4.02, 35→3.45, 40→3.02.
- **Wheel diameter (my calculation):** the table implies D ≈ 1.26 m. This gives 4.07 km/h and 8.86 kN in gear 3, which matches the table.

**Engine and dynamometer equations (TESTS)**

| Equation | Variables | Page |
|---|---|---|
| ip = P·L·A·N·n / (60×10¹²) kW | P = mean effective pressure (Pa); L = stroke (mm); A = piston area (mm²); N = rpm, divided by 2 for 4-stroke; n = number of cylinders | p3, eq 1 |
| Gross indicated power = net brake power + friction power | | p3, eq 2 |
| IMEP = ∮p·dv / displacement; Net IMEP = Gross IMEP − FMEP | | p3, Fig 15.1 |
| Power = 2π·l·F·n / 60,000 kW | l in m; F in N; n in rpm | p5, eq 3 (also DC dyno, eq 5, p8) |
| Power = 2π·n·T / 60,000 kW, with T = F·l | | p5, eq 4 |
| Hydraulic dyno capacity ∝ N³D⁵; fan brake ∝ rpm³ | | p6–7 |
| Standard conditions: 1.013×10⁵ Pa, 15.5 °C, zero vapour pressure | | p2, p4 |

**Universal joint (UJ p2–3)**
- ω2/ω1 = cos φ / (1 − sin²φ·cos²θ), where φ is the angle between the shafts and θ is the input rotation angle.
- Worked example at φ = 45°: maximum √2 (2/√2) when cos θ = 1; minimum 1/√2 when cos θ = 0.
- The exercise asks students to plot the velocity ratio against θ for φ = 45°.

**Total implement power (AEE501 exam text)**
- P_T = P_db/(E_m·E_t) + P_pto + P_hyd + P_el.
- Terms: drawbar power divided by the powertrain mechanical efficiency and the tractive efficiency, plus PTO, hydraulic and electric power.

**Field capacity (MGMT p7–8)**
- C (ac/h) = W(ft) × S(mph) × FE / 8.25. The SI equivalent is ha/h = W(m)·S(km/h)·FE/10.
- Field efficiency covers time lost to turning at the ends, overlapping, adjustments, and filling or emptying tanks and hoppers.
- Example: 28 ft × 6.0 mph × 79% / 8.25 = 16 ac/h. The 2015 extract gives 25 ft × 4.5 mph × 81% → 11 ac/h.

**Exam problems (AEE501 questions and part_5_exam)**
- Theoretical vs actual field capacity: a 5-ft slasher at "8 m/h" with FE = 85%. The speed unit is ambiguous.
- Area vs commodity-throughput vs total-throughput capacity: 10,000 t of crop that is 75% grain, 15% stalk and 10% leaves; the combine works 85% of 600 h; yield 15 t/ha; 5.85 m of a 6 m header used effectively.

**Costs (MGMT p1–9, the 2001 version)**
- Salvage = list price × remaining-value % (Tables 1a/1b, by age, class and annual hours).
- Depreciation = purchase price − salvage.
- Capital recovery = Depreciation × CRF + Salvage × i_real, where CRF comes from Table 2 (e.g. 15 yr at 5% = .096; 8 yr at 5% = .155). Real rate = nominal − inflation (8% − 3% = 5%).
- TIH = 0.01 × purchase price. The 2015 extract uses 0.01 × (purchase + salvage)/2 instead.
- Repair cost per hour = (repair % at end-of-life hours − % at current hours) × list price / hours (Table 3).
- Fuel = 0.044 (diesel) or 0.060 (gasoline) × max PTO hp, in gal/h. Lubrication = 0.15 × fuel cost. Labour = wage × 1.1–1.2.
- Cost per acre = cost per hour / field capacity.

**Worked example: tractor** (180 PTO-hp diesel; list $110,000, bought for $93,500; 15 yr; 400 h/yr)
- Salvage 23% = $25,300; depreciation $68,200.
- Capital recovery $7,812; TIH $935; ownership $8,747/yr = $21.87/h.
- Repairs: 25% at 6,000 h = $27,500, or $4.58/h.
- Fuel 7.92 gal/h → $7.92/h; lubrication $1.19/h; labour $11/h.
- Operating $24.69/h. The text also says "$18.09" in one place, which is a source inconsistency.
- Total $46.56/h.

**Worked example: used 28-ft tandem disk** (bought for $11,000; list $30,000; 600 h on it; kept 8 more years)
- Salvage 24% = $7,200; capital recovery $949; TIH $110; $10.59/h.
- Repairs (32% − 8%) × $30,000 = $7,200, or $9.00/h.
- $19.59/h for the disk; $66.15/h combined with the tractor; $4.13/acre.

**Repair curve, % of list price (MGMT p5)**
- 2WD tractor at 1k–10k h: 1, 3, 6, 11, 18, 25, 34, 45, 57, 70.
- 4WD tractor at 1k–10k h: 0, 1, 3, 5, 8, 11, 15, 19, 24, 30.
- Moldboard plow at 200–2,000 h: 2 … 101.

The 2015 text extract repeats the same method with different prices (list $200,000, 7% interest, fuel $3.40/gal, total $96.54/h, a 25-ft chisel-plow example, $11.39/acre).

---

### 4. Figures worth reproducing in 3D

- **MECH:**
  - Figs 2.1 and 2.3 (p2, p6): side-view free-body diagrams of the tractor (Ne, Nw, Te, Tw, V0/V, P, H, R), ideal vs with losses;
  - Fig 2.2 (p4): data table plus speed-vs-pull plot, with gear 3/5/7 step curves and the hyperbolic envelope;
  - Table 2.1 (p10): power-flow summary.
- **TESTS:**
  - Fig 15.1 (p3): P-V diagram with the IMEP loop and FMEP pumping loop, between HDC and CDC;
  - Fig 15.2 (p5): Prony brake;
  - Fig 15.3 (p6): hydraulic dynamometer section, the best cutaway reference;
  - Fig 15.4: DC dynamometer;
  - Fig 15.5: PTO shop dynamometer beside the tractor;
  - Fig 15.6: Dillon spring dial;
  - Fig 15.7: Nebraska test car hitched behind the tractor;
  - Fig 15.8: strain-gauge link and readout;
  - Fig 15.9: slip-ring torque meter;
  - Fig 15.10: chassis-dynamometer pit layout.
- **UJ:**
  - Fig 1: shafts at an angle;
  - Fig 2: exploded yoke-spider-yoke;
  - Fig 3: exploded double Hooke's joint (CV).
- **BUSH:** Fig 1 bulldozer, Fig 2 tree pusher, Fig 3 rear-mounted plough, Fig 4 disc harrow.
- **MGMT:** Fig 1 repair-cost curve (p6), Tables 1a, 1b, 2 and 3, and the worksheet (p9–10). These suit 2D overlay panels rather than 3D.

---

### 5. Land clearing and tillage (BUSH)

- **Definition:** agricultural land clearing is the systematic removal of vegetation, trees, debris and other impediments by manual, mechanical or chemical means. It works to about 30 cm depth and must preserve the topsoil. Non-agricultural clearing may replace topsoil with laterite and compact it (p1).
- **Clearing patterns (p1–2):**
  - remove trees and stumps completely and pile them for burning;
  - knock down and crush vegetation to ground level, then burn;
  - shear at ground level with sharp blades, then windrow and burn;
  - leave stumps and roots to decompose, or shatter them later by root ploughing or harrowing.
- **Four methods (p2):**
  - hand: axes, machetes and hoes; slash-and-burn; suits small plots;
  - chemical: arboricide brushed onto the freshly cut stump surface;
  - explosive: bore a hole in the stump, add dynamite or gelignite, detonate remotely, then clear during windrowing;
  - mechanical: the machines listed in §1D.
- **Mechanical procedure (p2):** survey (area, vegetation type and density, topography) → knock down, either by chaining between two tractors or single knockdown → windrow → burn and remove debris → till. This sequence would make a good staged animation.
- **Factors in choosing a method (p3):** size of the area; state and type of vegetation (height, age, density; regrowth is cheaper than virgin forest); purpose of land use; cost.
- **Tillage types (p4–7):**
  - conventional: ploughing → harrowing → ridging;
  - primary tillage: done after harvest, when the soil is wet enough for ploughing and traction; aims are depth, cutting and burying weeds, exposing roots, aeration and water retention;
  - secondary tillage: everything after primary tillage;
  - conservation/minimum tillage: does not turn the soil over;
  - no-till: soil undisturbed except nutrient injection; seeds placed in a slot cut by coulters or openers; herbicide weed control;
  - ridge-till: planting on ridges; residue left between ridges; ridges rebuilt during cultivation;
  - mulch-till: chisels, field cultivators, discs, sweeps, blades; more than 25% of row width disturbed; includes zone-till and strip-till;
  - reduced-till: less erosion, lower cost, saves energy.
- **Formulas:** BUSH has no performance, field-capacity or efficiency formulas. Use the MGMT field-capacity and cost equations and the AEE501 exam capacity definitions instead.

**Other text extracts:** The CASSAVA_GRATERS extract covers post-harvest peeler/grater evaluation (throughput, specific energy, peel retention) and isn't relevant to tractors. The BELT_DRIVES extract is V-belt design tables (service factor, design power, centre distance). It matters only if you model belt or pulley drives; the AEE501 exam also asks about pulley alignment on a maize sheller.