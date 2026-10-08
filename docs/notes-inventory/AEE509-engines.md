<!-- Inventory of course notes produced by a research agent on 2026-10-06; source files under C:/Users/USER/Documents/School/500L -->

## AEE509 (Farm Power I, Prof. B. Ogunsina, OAU Ile-Ife): engine inventory for the 3D simulation

**How I read the sources.** I read every AEE509 text extract. The two scanned PDFs have no text layer and the Read tool's PDF renderer (poppler) wasn't available, so I rendered their pages to PNG with pypdfium2 and read them visually. The PNGs are in `scratchpad\aee509img\`. I did the same for the exam paper and the textbook, because their OCR is garbled.

**Source abbreviations.**
- **L1–L4, L6**: the `AEE509__509_Lecture_N` files. There is no Lecture 5; Module 5 (Engine Systems) sits inside L4.
- **AddN**: 509_Additional_notes.
- **Supp**: ENGINE_SYSTEMS_Supplementary_notes.
- **Man**: AEE_509_manual (lab manual).
- **Exam**: AEE_509_exam_past_questions PDF, 8 pages. It holds 4 papers: p1–2 = 2021/22, p3–4 = 2022/23, p5–6 = 2017/18, p7–8 = 2015/16.
- **TB**: the textbook extract PDF. It has 20 photographed two-page spreads covering book chapters 1–8 (textbook p.1–41).
- **Thermo**: `AEE 509 (Thermodynamic).pdf`, 6 handwritten pages.
- **Misc**: `AEE 509 Miscellaneous Exercises and Tutorial Questions.pdf`, 12 pages. p1 is the cover; p2–12 carry handwritten page numbers 1–11.

**Videos** (topic titles only): "2 Stroke Engine vs 4 Stroke Engine", "4- stroke cycle ICE explained", "Cooling system explained", "Ignition circuit explained", "The total ICE teacher".

---

## 1. Engine types and cycles to animate

**Syllabus (L1):**
- Sources of power.
- Reciprocating engine elements and geometry.
- Combustion, firing and valve timing.
- Two-stroke, spark-ignition (SIE) and compression-ignition (CIE) engines.
- Performance and thermodynamics.
- Engine systems: lubrication, cooling, air/fuel, ignition, electrical/lighting.

**Classification (L3):**
- By cycle: Otto, Diesel, dual.
- By ignition: SIE (Otto) vs CIE (Diesel); equivalently by fuel, gasoline vs diesel.
- By number of strokes: 2 or 4.
- By number of cylinders: single or multi.
- By fuel delivery: carburetion (SI) vs injection (CI).
- By cylinder layout: horizontal, vertical, Vee.

**Four-stroke cycle** (L3; TB Fig 2.3, p.9). One cycle takes 720° of crank, i.e. 2 revolutions.
- **Intake:** the cam lobe opens the inlet valve and the piston moves TDC→BDC. A CI engine draws air only; an SI engine draws air-fuel mixture.
- **Compression:** both valves are shut. Pressure, temperature and density rise. Ignition starts just before TDC: a spark plug pulse (SI) or a fuel spray from the injector (CI).
- **Power:** the gas expands and pushes the piston down. The exhaust valve opens before BDC.
- **Exhaust:** the piston rises and pushes the gas out; the stroke ends when the exhaust valve closes.
- Valve overlap gives better scavenging, and some residual gas stays in the clearance volume.
- The flywheel carries the engine through the three idle strokes (TB).

**Diesel / CI specifics:**
- Compression ratio (CR) 14:1–22:1 (L3; Misc p2). Thermo p5 gives 15–22.
- Compression pressure 30–45 kg/cm² and about 500 °C (L3).
- Injection pressure: 120–200 kg/cm² (L3); 120–300 kg/cm² from the injection pump (Supp); about 140 kg/cm² (TB p.25).
- Better "lugging": diesels hold high torque at low speed (L3).
- Petrol CR is about 8:1 (Misc p2).

**Two-stroke / petroil engine.** One cycle per crank revolution (360°). It has ports, not valves (L3; AddN; TB Fig 2.4).
- **Downstroke:** the piston uncovers the exhaust and transfer ports. Fresh charge, already in the crankcase, passes up the transfer port, and a deflector on the piston crown steers it into the cylinder.
- **Upstroke:** the piston closes the transfer and exhaust ports and uncovers the inlet port into the sealed crankcase, drawing new mixture in. The charge above the piston is compressed and ignited at TDC.
- Mist (petroil) lubrication: oil is mixed with petrol at 2–3% (AddN), or 16:1 for larger and 24:1 for smaller engines (TB §6.3.3).

**Four-stroke vs two-stroke comparison table (L3).** The 2-stroke has:
- one power stroke per revolution (vs one per two);
- ports instead of valves;
- a crankcase that is sealed and airtight;
- compression on both sides of the piston;
- a smaller flywheel;
- only partial combustion;
- lower weight per hp;
- lower volumetric efficiency;
- usually air cooling with petroil lubrication;
- faster wear;
- lower thermal efficiency.

**Air-standard cycles** (Thermo p1–6; L6; Misc p9–12). Show each on synced P-V and T-s plots.
- **Otto:** 0-1 intake, 1-2 isentropic compression, 2-3 constant-volume heat in, 3-4 isentropic expansion, 4-1 constant-volume heat out, 1-0 exhaust.
- **Diesel:** heat added 2-3 at constant pressure.
- **Dual / limited-pressure:** 2-3 heat added at constant volume, 3-4 at constant pressure, 4-5 expansion, 5-1 heat rejected.

**Fuel quality and knock (AddN):**
- Octane number: % iso-octane (C8H18, rated 100) blended with n-heptane (C7H16, rated 0).
- Cetane number: % cetane (C16H34) blended with α-methylnaphthalene. Commercial diesel is 30–60.
- Knock is pre-ignition ahead of the flame front, giving pressure waves. Its causes are high compression, early timing and poor combustion. This is a good effect to animate.

**Thermal efficiency figures:**
- Diesel 32–38%, petrol 25–32% (L2).
- External-combustion (steam) engines 15–20% (L3).

---

## 2. Components and systems

**Core parts** (L4 "Parts description"; TB Table 2.1 and Fig 2.1, a cross-section of a 4-cylinder engine; Man Module 2):
- **Cylinder block / cylinder:** guides the piston and is the foundation casting. It carries a water jacket in liquid-cooled engines or fins in air-cooled ones. Man lists cylinder liner (sleeve) thickness and water-jacket ports.
- **Cylinder head:** removable. Holds the inlet and exhaust ports, valves, spark plug or injector, and studs.
- **Piston:** a loose sliding fit.
- **Rings:** split rings in grooves. A 2-stroke has 2 rings; a 4-stroke adds an oil ring.
- **Gudgeon (piston) pin.**
- **Connecting rod:** the small end takes the gudgeon pin; the big end has a half-bearing, bearing cap and cap bolts/nuts.
- **Crankshaft:** on main bearings. Its throw arrangement depends on the number of cylinders.
- **Bearings:** sliding bushes at the con-rod ends; rolling/ball bearings on the crankshaft.
- **Crankcase / oil sump.**
- **Flywheel:** has a ring of teeth (Man asks for the tooth count). In air-cooled engines it doubles as a fan.
- **Camshaft:** runs at half crankshaft speed. L4 says it is driven by the timing belt; Man describes a timing gear drive (driving and driven gears, speed ratio).
- **Manifolds:** inlet (with plenum) and exhaust (with runners).
- **Pushrod and rocker arm.**
- Man "Major Engine Assemblies": cylinder cover, valve gear, cylinder-head assembly, cylinder block, sump/oil pan.

**Valve train** (TB Fig 2.2, p.8): cam lobe → cam follower → push rod → rocker arm → valve spring → valve → valve seat. Valves open inward and springs close them (L4). The camshaft turns at half crank speed.

**Valve timing** (L4): the notes show "theoretical" and "actual" valve-timing diagrams.
- Inlet opens before TDC and closes after BDC; charge momentum keeps air flowing in early in compression.
- Exhaust opens well before BDC and closes after TDC, giving overlap.
- **No degree values are given anywhere in the notes**, so the sim will need typical textbook angles.

**Firing order and multi-cylinder layout** (L4; TB §2.6.4, Fig 2.5, Table 2.3 chart):
- 4-cyl: 1-3-4-2 or 1-2-4-3.
- 6-cyl: 1-5-3-6-2-4 or 1-4-2-6-3-5.
- Exam examples: 1-6-3-5-2-4; A-D-C-B-F-E; 8-cyl 1-7-5-3-8-6-2-4.
- Firing interval = 720°/n: 180° for 4 cylinders, 120° for 6.
- Crank layouts: 2-cyl throws 180° apart; in a 4-cyl, pistons 1 & 4 and 2 & 3 move together.
- Benefits of a proper firing order: less vibration, better balance, even power.

**Fuel system, SI** (Supp; TB §4.4, Figs 4.1 and 4.5–4.7):
- Tank with vented cap → sediment bowl (glass, with strainer) → diaphragm lift pump (worked by a camshaft eccentric and rocker arm, with a priming lever) → carburettor → inlet manifold.
- Gravity feed is used if the tank is mounted high.
- Carburettor parts: float chamber, jet/nozzle, venturi, choke butterfly, throttle butterfly. Mixture is about 1:15 fuel:air by weight. More fuel makes it rich, less makes it lean.

**Fuel system, diesel** (Supp; TB §4.5, Fig 4.2):
- Tank → lift/feed pump → primary filter (coarse dirt and water) → secondary filter (fine) → injection pump → high-pressure pipes and delivery valves → injector. Leak-off fuel returns to the tank.
- An overflow valve on the filter limits feed pressure.
- Air is bled out by the priming pump through bleed screws.

**Injection pump:** delivers fuel in firing order. Fuel quantity is metered by a **helical groove on the plunger** (TB p.25). TB Fig 4.8 cross-section; Man asks for the number of springs and spray tips.

**Injector** (Supp; TB Fig 4.9 cross-section):
- Parts: nozzle body, needle (nozzle) valve on a conical seat, spring, pressure-adjusting screw, lift-adjusting screw, fuel inlet, leak-off, spray tip. Tractors use multi-hole nozzles.
- The needle lifts when fuel pressure exceeds the spring setting; this is easy to animate.

**Air intake** (TB §4.3, Figs 4.3–4.4):
- **Dry air cleaner:** filter element, baffle, dust cup.
- **Oil-bath air cleaner:** a pre-cleaner traps straw and leaves; air turns over the oil surface, then passes through an oil-wetted wire-mesh element. Animate the path.
- Dust concentration falls with intake height: 0.565 g/m³ at the dashboard, 0.283 at 45 cm above it, 0.141 at 74 cm.
- **Turbo / supercharging: not covered in any AEE509 source.**

**Governor** (Supp; TB §4.6, Fig 4.10):
- Types: centrifugal (mechanical), pneumatic, hydraulic.
- Mechanical: flyweights pivoted on a gear-driven spindle swing out against a spring acting on a thrust collar. A linkage then closes the throttle butterfly (SI) or reduces injection-pump delivery (CI). Fig 4.10 also shows the throttle control rod, pivots, a stop and the manual speed control.
- Speed variation between no load and full load is about 100 rpm for a good governor.
- "Hunting" is the speed oscillating fast–slow–fast.

**Lubrication** (Supp; TB ch.6; AddN):
- Purposes: reduce friction, cool, seal, clean.
- Parts needing oil: cylinder walls and piston, piston pin, crank and con-rod bearings, camshaft bearings, valve gear, fan, water pump, ignition mechanism.
- **Circulating splash system** (TB Fig 6.1): a camshaft-driven pump fills splash-pan troughs; an oil scoop on the con-rod dips in and splashes oil around.
- **Force-feed system** (TB Fig 6.2, p.35): gear pump driven by the camshaft → strainer → pressure-relief valve (excess back to the sump) → filter → main oil gallery → drilled oilways to the bearings → oil spilled off the crank is splashed onto the cylinder walls. Has an oil pressure gauge.
- **Oil-mist (petroil)** system for 2-strokes.
- **Crankcase breather pipe** with filter (TB Fig 6.3) vents blow-by.
- Oils: SAE grades (10–50 for engines; 80–140 for gear/transmission oils), multigrade (e.g. 20W/50), detergent "HD" oils, grease applied with a gun.

**Cooling** (L4; Supp; TB ch.7):
- Combustion reaches up to 1600 °C. Target operating temperature: 60–93 °C (L4), 140–200 °F (Supp), about 90 °C (TB).
- **Air cooling:** finned cylinder inside a cowling; fan blades on the flywheel blow air over the fins (TB Fig 7.1).
- **Open hopper:** a water hopper on a horizontal engine, with a drain plug (TB Fig 7.2).
- **Thermosiphon:** hot water rises from the jacket to the top of the radiator, and cool water returns from the bottom. Needs no pump; a belt-driven fan helps.
- **Forced circulation / combined system** (TB Fig 7.3): centrifugal water pump → jacket → thermostat → radiator top tank → finned tubes → bottom tank → pump. A bypass hose recirculates water while the thermostat is shut.
- **Radiator** (TB Fig 7.4): header tank, thin finned tubes, bottom tank. The pressure cap raises the boiling point and has a vacuum valve.
- Faults: scale, a stuck thermostat, a loose fan belt. Cooling-system care is listed in L4.

**Ignition** (L4; Supp; TB ch.5):
- **Battery (coil) ignition:**
  - Primary circuit: 6/12 V battery, ammeter, ignition switch, primary winding (200–300 turns of 20 SWG wire), contact breaker, capacitor.
  - Secondary circuit: about 21,000 turns of 40 SWG wire → distributor rotor → spark plugs.
  - The breaker cam has 4 lobes for 4 cylinders, or is hexagonal for 6.
- **Magneto ignition** (Supp; TB Fig 5.3): frame, permanent magnet, armature with primary and secondary windings, breaker points, condenser, distributor. Its impulse coupling (pawls, stop pin, spring wind-up) helps starting.
- Mutual induction: opening the breaker collapses the primary current and induces high voltage in the secondary, which jumps the plug gap.
- Spark plug: porcelain insulator, gap about 0.6 mm. Hot plugs have a longer porcelain nose; cold plugs a shorter one.
- Spark timing is about 25° BTDC when running (TB §5.5).

**Starting and electrical** (TB ch.5, Figs 5.5–5.9):
- **Battery:** 12 V for a tractor, 24 V for large diesels; 2 V per cell. Plates are PbO₂ (+) and Pb (–) in H₂SO₄, specific gravity 1.27. Reaction: Pb + PbO₂ + 2H₂SO₄ → 2PbSO₄ + 2H₂O. Capacity in Ah.
- **Dynamo:** armature, field windings, commutator, carbon brushes.
- **Alternator:** rotating-field rotor, stator, diode pack (AC to DC).
- **Starter motor:** a solenoid engages the pinion with the flywheel ring gear, then retracts it.
- Cut-out, voltage regulator, fuses, lighting circuit.

---

## 3. Equations for the simulation

Use k = 1.4, R = 0.287 kJ/kg·K, Cp = 1.005 and Cv = 0.718 (or 0.717) kJ/kg·K. These are the exam constants.

**Geometry** (TB p.9; Man p.6; Misc p2):
- PD (swept volume) = (π/4)·D²·L.
- TCV = PD + CV.
- CR = TCV / CV = (Vs + Vc) / Vc.
- Worked example (TB): 100 × 124 mm engine, PD = 973,400 mm³; with CV = PD/6, TCV = 1,135,633 mm³ and CR = 7.0.
- Mean piston speed Sp = 2LN/60, typically 8–15 m/s (Misc p2, p6).

**Power, MEP and mechanical efficiency** (Misc p2–5), with n = 2 for a 4-stroke and 1 for a 2-stroke:
- IP = Pm·L·A·N·k / 60,000 (SI units; k = cylinder count, a separate letter from n).
- bmep = BP·60·n / (L·A·N·cyl).
- BP = 2πNT/60.
- imep = 2πTn/Vs.
- FP = IP − BP.
- ηm = BP/IP = bmep/imep.
- Losses (Misc p3): friction 7–10% of IP, flywheel windage 1–3%, pumping 2–6%, auxiliaries 1–9%. Total 11–28%, giving ηm of 72–79%.
- Typical bmep (Misc p5): SI 850–1050 kPa at maximum torque (about 3000 rpm), 10–15% lower at maximum power; CI 700–900 kPa.

**Thermal, volumetric and other efficiencies** (Misc p3–6):
- ηbth = BP / (ṁf·HV) = 3600 / (bsfc·CV).
- ηith = IP / (ṁf·HV).
- ηv = 120·ṁa / (ρa·Vs·N), with ρa = p/(RT).
- Scavenge efficiency (2-stroke) = ma / ((Vd + Vc)·ρa).
- Relative efficiency = ηi / ASE.
- sfc = fuel mass (kg/h) / power.
- P = ηth·HV·ṁa·(F/A).
- Air-fuel ratio: SI 12–18, CI 18–70 (Misc p4); stoichiometric about 15:1.

**Air-standard efficiencies (ASE):**
- **Otto** (Thermo p3): η = 1 − 1/r^(k−1); T₂ = T₁·r^(k−1); work for 1-2 is W = (P₁V₁ − P₂V₂)/(k−1).
- **Diesel** (Thermo p4): η = 1 − (1/r^(k−1))·(δ^k − 1)/(k(δ − 1)), with cutoff ratio δ = V₃/V₂ = T₃/T₂.
- **Dual** (Thermo p6; Misc p9): η = 1 − (1/r^(k−1))·(αδ^k − 1)/((α − 1) + αk(δ − 1)), with α = P₃/P₂. Cardinal temperatures: T₂ = T₁r^(k−1), T₃ = T₂α, T₄ = T₃δ, T₅ = T₁αδ^k.
- **Mean effective pressure** = work / swept volume (Misc p9, eqs 2.4, 2.5, 2.7).
- Maximum Otto work occurs when T₂ = T₄ = √(T₁T₃) (Misc p12).

**Two errors in the notes.** The sim should compute these values, not copy the notes' statements.
- Thermo p5 says (δ^k − 1)/(k(δ − 1)) < 1. It is actually greater than 1, which is why Diesel efficiency is below Otto's at the same CR.
- Misc p10 says the dual cycle is less efficient than Diesel for the same r and δ. Mathematically it is more efficient.

**Governor regulation** (Supp): R = (N₁ − N₂) / ((N₁ + N₂)/2) × 100. Example: 1600 rpm no-load and 1500 rpm full-load gives 6.45%.

**Heat balance:**
- Supp: 40% exhaust, 30% cooling, 30% useful work.
- TB §3.3: exhaust 31%, cooling 40%, friction 5.5%, so 23.5% reaches the PTO; transmission and traction lose a further 4.5%, leaving 19% at the drawbar.
- Misc p4 has an energy-balance flow figure (Fig 1.13).

**Calorific values (Supp):** LDO 10,300; HSD 10,550; power kerosene 10,850; petrol 11,100 kcal/kg.

**Worked numbers for validating the sim (Misc):**
- **Ex 9, Otto:** 105 kPa, 295 K → 8902 kPa, 2500 K gives r = 10, η = 60.2%, mep = 1135.7 kPa.
- **Ex 12, Diesel:** r = 20, 100 kPa, 300 K, 2000 kJ/kg gives T₂ = 994 K, P₂ = 6629 kPa, δ = 3, η = 60.6%, mep = 1480 kPa.
- **Ex 13:** 6-cylinder CI, r = 16, cutoff at 10% of stroke, gives δ = 2.5, Tmax = 2274 K, η = 59%.
- **Ex 15, dual:** r = 16, 2800 kJ/kg, Qv/Qp = 1.5 gives Pmax = 16,364 kPa, η = 64.9%, mep = 2184 kPa.
- **Ex 17, dual:** 60 bar, 2500 K, r = 15 gives η = 61.7%.
- **Ex 4:** 8-cylinder, 100 × 120 mm, 3000 rpm, ηv 0.85, ηbth 0.3 gives BP = 167.3 kW and bmep = 887.5 kPa. This is the same data as the tractor exam questions.
- **Ex 7:** 8-cylinder, Vc = 90 cc, 160 N·m at 4500 rpm gives CR = 11.47, BP = 75.4 kW, bmep = 2.667 bar, ηbth = 30.85%.
- **Ex 6:** 4-cylinder SI, 160 N·m sizes out at D = L = 87.65 mm and 72.7 kW.

**Typical design data, Misc p8 Table 1.** Format: CR | bore (mm) | rpm | bmep (atm).
- SI passenger car: 8–10 | 70–100 | 4500–6500 | 7–10.
- CI truck: 14–20 | 100–150 | 2100–4000 | 12–18.
- CI locomotive: 12–18 | 150–400 | 425–1800 | 7–23.

---

## 4. Diagrams worth reproducing in 3D

- TB Fig 2.1: cross-section of a 4-cylinder engine. Use as the main cutaway.
- TB Fig 2.2: valve-system chain from cam to valve.
- TB Fig 2.3: four-stroke sequence.
- TB Fig 2.4: two-stroke ports with deflector piston.
- TB Fig 2.5: crankshafts for 2-, 3-, 4- and 6-cylinder engines.
- TB Table 2.3: firing chart grid of cylinder vs crank angle.
- L4: theoretical and actual valve-timing diagrams. Animate as a circular timing wheel.
- TB Figs 4.1 and 4.2: petrol and diesel fuel-system schematics.
- TB Figs 4.3 and 4.4: dry and oil-bath air cleaners, showing airflow.
- TB Figs 4.5 and 4.6: sediment bowl; diaphragm lift pump.
- TB Fig 4.7: carburettor (float, venturi, choke, throttle).
- TB Fig 4.8: injection pump.
- TB Fig 4.9: injector cross-section.
- TB Fig 4.10: flyweight governor linkage.
- L4 / TB Fig 5.2: battery-ignition circuit (coil, breaker, condenser, distributor).
- TB Fig 5.3: magneto impulse coupling.
- TB Figs 5.4–5.8: hot vs cold spark plugs, battery, dynamo, alternator, starter.
- TB Figs 6.1 and 6.2: splash system and force-feed oil circuit, with flow arrows.
- TB Fig 6.3: crankcase breather.
- TB Figs 7.1–7.4: air-cooled fins and fan; open hopper; combined cooling loop with thermostat and bypass; radiator construction.
- Thermo p1, p4, p6 and Misc p9–11: P-V and T-s diagrams, live-linked to piston position.
- Misc p4 Fig 1.13: energy-balance flow. Misc p5 Fig 1.14: indicated diagram with the imep rectangle.
- Man Module 2: piston–connecting rod–crankshaft–flywheel assembly; major engine assemblies stack.

---

## 5. Most-examined topics (4 papers: 2015/16, 2017/18, 2021/22, 2022/23)

1. **Diesel cycle: P-V/T-s plots, proof of the ASE formula, and cutoff ratio, heat supplied, efficiency and mep.** In every paper, often twice. Examples:
   - r = 16 at 288 K/100 kPa reaching 1753 K;
   - r = 16 at 15 °C/0.1 MPa reaching 1480 °C;
   - r = 20 with 2000 kJ/kg;
   - stroke 25 cm, bore 15 cm, Vc = 400 cm³, cutoff at 5% of stroke;
   - Massey Ferguson 375 / John Deere 8-cylinder diesel tractor questions.
2. **Dual cycle with identical data in all 4 papers:** r = 16, 1 bar, 50 °C (323 K), Pmax 70 bar, Qv = Qp. Asks for temperatures at the cardinal points, η and mep.
3. **Otto cycle in all 4 papers.** Data sets:
   - 105 kPa/295 K → 8902 kPa/2500 K, used for an orchard tractor (300 rpm, 100 × 120 mm, 160 N·m, then IP/BP/FP) and a farm truck;
   - 0.1 MPa, 35 °C, r = 8, 2100 kJ/kg;
   - bore 90, stroke 100, Vc = 48,936 mm³.
4. **Performance calculations:**
   - PD, TCV, CR for a 60 kW Mahindra tractor (100 × 124 mm, CV = PD/6);
   - 6-cylinder SI, 60 kW, 100 × 125 mm, CV = Vs/8;
   - 100 kVA 8-cylinder genset (A = 0.25 m², L = 0.3 m, TCV = 0.1 m³, η 25% / ηm 75%, 3000 kW at 2000 rpm) for Vc, bmep and imep;
   - mass of air, fuel consumption, ηbth, bmep.
5. **Firing order / firing chart** for 6- and 8-cylinder engines (three papers).
6. **Two-stroke petroil combustion and mist lubrication** (three papers); 4-stroke vs 2-stroke differences (two papers).
7. **Thermosiphon cooling** (all four papers), plus forced circulation, why cooling matters, and air-cooled advantages.
8. **Lubricating oils:** functions, properties and additives in every paper; the splash system once.
9. **Valve timing on a circular diagram** (three papers).
10. **Less frequent:** magneto spark generation; roles of injection pump, injector, carburettor and governor; roles of camshaft, flywheel, crankshaft and rocker arm; octane/cetane and knock; major engine systems; Diesel vs Otto efficiency.

---

## Gaps in the notes

- No turbo or supercharger anywhere.
- No valve-timing degrees.
- No sfc or performance curves.
- Lecture 6 text is a fragment; the full derivations are in the Thermo PDF.
- No transmission content in the engine notes; TB ch.8 (clutch) begins at the end of the extract.