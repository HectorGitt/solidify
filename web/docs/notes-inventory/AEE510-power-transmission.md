<!-- Inventory of course notes produced by a research agent on 2026-10-06; source files under C:/Users/USER/Documents/School/500L -->

## AEE510 power transmission: inventory of the notes for the 3D simulation plan

I read every page of all three PDFs. They are image-only, so I rendered them to JPG with pypdfium2; the images are in `C:\Users\USER\AppData\Local\Temp\claude\C--Users-USER-Documents-Codes-AgriTech\20a2a566-ddb6-4e0f-823e-02776a10a72c\scratchpad\aee510img\`. I also read the exam text and all 7 JPGs.

**How citations work below.** Every page number is the PDF page.
- **PT** = `AEE510 Power Transmission .pdf`, the lecturer's typed notes. PDF p1 is an intro page, and PDF p2–12 are printed pages 1–10.
- **TTS** = `AEE510 Tractor Transmission System.pdf`, which is Bell, *Farm Machinery*, Ch. 5. Book page = PDF page + 63.
- **TOP** = `AEE510 Transmission of Power.pdf`, which is Culpin, *Farm Machinery*, Appendix 2. PDF p1 is book p387, and PDF p2–11 are book pp389–398. **Book p388 is missing from the scan.** It probably covered the rest of belt drives, maybe chains, and the start of the gears section.

---

## 1. Components and subsystems

**A. Overall line of drive** [TTS p1–2, Fig 30; PT p1]
- Power path: engine flywheel → clutch → gearbox → crown wheel and pinion (right-angle drive that carries the differential) → half shafts → final reduction → rear wheels.
- The PTO and hydraulic pump are driven from the gearbox. Some tractors mount the pump on the engine instead, which makes hydraulics independent of the transmission [TTS p2].
- Speeds: the engine runs at more than 2000 rpm and the rear wheels at about 20 rpm in bottom gear. Speed is reduced at three places: the gearbox, the crown wheel and pinion, and the final reduction [TTS p1, p10].
- PT p1 (a patent, US4938085) describes one input shaft splitting into two branches:
  - a travelling-drive branch: main clutch → multi-stage speed changer with several speed-changer clutches;
  - a PTO branch: a separate PTO clutch → a switching apparatus feeding several PTO shafts.
- Fig 30 is a plan view: crankshaft, clutch, gearbox, differential, brakes at the wheel ends, front axle.

**B. Clutches**
- **Types listed** [PT p2]: disk, band, overrunning (freewheels one way), magnetic, cone, expanding shoe, jaw/friction. Also pneumatic, hydraulic and slip clutches.
- **Actuation** [PT p2]:
  - mechanical: linkages and springs, with a standard or over-centre linkage;
  - hydraulic: master and slave cylinders. The notes say this is the most common;
  - electrical: direct or indirect.
- **Positive vs friction** [TOP p5]: dog clutches are used on land-wheel-driven machines. The cone clutch is the simplest friction clutch; it is used for slow start-up of line shafting and for winch cables on tracklayers.
- **Single-stage dry clutch, Fig 31** [TTS p3]
  - Parts: flywheel with starter ring gear, clutch plate (friction lining on both faces) splined to the gearbox shaft, pressure plate, coil springs, release levers, thrust bearing, clutch cover, pedal linkage.
  - What to animate:
    - Pedal up: the springs clamp the disc between flywheel and pressure plate, and everything turns together.
    - Pedal down: the thrust bearing pushes the levers toward the flywheel, which compresses the springs and frees the disc. Cover, springs and pressure plate keep spinning; the disc and gearbox shaft stop [TTS p2].
  - Cutaway: an axial half-section, the same view as Fig 31.
  - Culpin's version is Fig A2.8 [TOP p5]: friction plate A keyed to driven shaft B, driving shaft C, spring D, asbestos linings, run dry [TOP p7].
- **Hydraulic clutch control** [TTS p4]: pedal → master cylinder → ram cylinder on the clutch linkage. When the pedal is released, the springs re-engage the clutch and the fluid returns.
- **Pedal free play** [TTS p3–4]: typically 18 mm (¾ in).
  - Too little causes thrust-bearing wear and clutch slip.
  - Too much makes gear engagement difficult.
- **Dual clutch for live PTO** [TTS p3; TOP p6 Fig A2.9 (Massey-Ferguson); TOP p8]
  - Parts: engine flywheel, false flywheel, primary pressure plate with transmission drive plate (to the centre transmission shaft), secondary pressure plate with PTO drive plate (to the hollow PTO shaft), Belleville spring, coil springs, release levers, release bearing, PTO adjusting set screws.
  - What to animate (pedal travel):
    - first half: the primary plate releases and the wheels stop while the PTO keeps running;
    - full travel: the set screws abut and the secondary plate releases, so the PTO stops.
  - Cutaway: concentric shafts, with the hollow PTO shaft around the transmission shaft.
- **Independent hydraulic PTO clutch** [TOP p7, Fig A2.10]
  - Parts: wet multi-plate pack (friction plates and inter-plates), piston, Belleville spring, spool control valve, fixed orifice, IPTO filter, oil from the "multi-power" pump, Ferguson pump, brake pad.
  - Pressure on the piston clamps the pack. In neutral the oil pressure is released and the PTO shaft is automatically braked.
- **Multi-plate wet clutch** [TOP p7]: 10 driving plates and 9 driven plates give 18 friction surfaces, pressed together by springs and running in oil.
- **Expansion and compression clutches** [TOP p8]:
  - expansion: a split ring expands inside a drum;
  - compression: a band contracts around a drum.

**C. PTO**
- **Three types** [PT p2–3]:
  - transmission-driven: stops when the clutch is disengaged;
  - continuous-running: two clutches on one control. The first half of travel works the transmission clutch and the second half the PTO clutch. The transmission cannot be re-engaged while the PTO runs;
  - independent: separate control, so the PTO can be engaged or disengaged while moving.
- **Standards** [TTS p10]:
  - 540 rpm: 6 splines, 35 mm (1⅜ in).
  - 1000 rpm: 21 splines, 44 mm (1¾ in).
  - A two-speed shaft uses a high/low gearbox lever to choose between them.
  - Rotation is clockwise viewed from the rear.
- **Ground-speed PTO** [TTS p10]: shaft speed is proportional to travel speed and reverses when the tractor reverses. Example use: a trailer with a powered axle.
- **Guarding** [TTS p10]: the shield must support 114 kg (250 lb), and the shaft must be guarded up to the implement's first bearing.
- **PTO drive shaft, Fig A2.7** [TOP p4]
  - Parts: (1) tractor PTO, (2) implement power input connection (PIC), (3) PTO yoke, (4) PIC yoke, (5) telescopic "lemon-profile" shaft, (6) guard cones.
  - Animate: two Hooke's joints, the telescoping shaft, and the angle changing during turns.
- **Universal joints** [TOP p4–5]
  - Double-joint conditions for uniform output speed: all shafts in one plane, equal joint angles, and intermediate yokes in line.
  - Hitch point should be midway between the joints; otherwise the angles become unequal in turns (BS 1495).
  - A CV joint allows only 40° articulation.
  - A U-joint is more than 99% efficient.
  - Double U-joints can replace a bevel gearbox for a right-angle drive.

**D. Gearboxes**
- **Jobs of the transmission** [PT p3]: select speed ratios, reverse the travel, and power the PTO.
- **Sliding gear / sliding mesh** [PT p3; TTS p6 Fig 33, p7]
  - Spur gears on parallel or in-line shafts.
  - Selector forks slide gears along splined shafts into mesh. Spur gears are noisy.
  - Fig 33 cutaway shows the top shaft, bottom shaft, bevel pinion, crown wheel and differential in one case.
- **Collar shift / constant mesh** [PT p3; TTS p7]
  - Helical (or spur) gears always in mesh, free-running on the shaft.
  - A sliding collar or coupling locks the chosen gear to its shaft.
  - Helical gears are quieter and stronger but cost more.
- **Synchromesh** [PT p3; TTS p4–5]: "special couplings" bring the two gears to the same speed before the teeth engage. Some tractors fit it only on the top gear of each range.
- **Layout and lubrication** [TTS p4, p7]
  - 6 or 8 forward and 2 reverse speeds, chosen with two levers (gear lever plus high/low or high/medium/low range lever).
  - A hydraulic or electric hi-lo reduction doubles the number of ratios and can be shifted on the move without the clutch.
  - Speed range is 1.6–32 km/h. One lever must be in neutral to start the engine.
  - Oil is SAE 40/50, checked weekly.
- **Change-on-the-move semi-automatic** [TTS p5]: range lever selects 2–3 forward ranges and 1 reverse (with the clutch). Within a range, 4 speeds shift hydraulically without the clutch.
- **Massey-Ferguson 2000, 16 forward / 12 reverse, Fig A2.6** [TOP p3–4] (100–125 hp tractors)
  - Parts: speed-shift unit (hydraulic epicyclic, high-low change on the move), forward/reverse free-running gears with a sliding coupler (shuttle reverse), mainshaft, layshaft (hollow, carrying the PTO drive shaft through it), 1st–4th constant-mesh helical gears with synchromesh units, sliding non-synchro range-change gear (high/low range), output shaft, parking brake, transfer gear, four-wheel-drive clutch, front-axle driveshaft, lubrication nozzle.
  - Reverse inset: forward gear, idler gear, reverse gear, constant-mesh gear.
  - Ratio count: 4 × 2 × 2 = 16 forward.
  - **This is the best single cutaway to model.**
- **Gear types** [TTS p5 Fig 32; TOP p2]: spur, helical, bevel, face (variable ratio, used on seed drills), worm and wheel (wide ratio, normally not reversible; the cream separator is the exception), rack and pinion. Gear materials: cast iron, machined steel, heat-treated alloy.

**E. Hydraulic-assist (powershift) transmission** [PT p4–6]
- Gears stay in constant mesh; hydraulic clutch packs route power without interrupting it.
- Clutch pack: alternating friction disks and plates. The disks are splined to the drum and the plates to the hub. Pressure oil drives the piston to clamp the pack; releasing the pressure lets the piston retract.
- **Countershaft forms:**
  - high-low: 2 clutches, 4 gears. The direct clutch locks input to output (1:1); the underdrive clutch gives low. Overdrive is mentioned;
  - reverse unit: power goes via the countershaft, so the output turns opposite to the input;
  - high-low-reverse: 3 clutches.
  - More speeds come from adding countershafts and clutches.
- **Simple planetary** [PT p5–6, figure p5: sun, planets 1–4, carrier, ring, with carrier, ring and sun shafts in side view]
  - Sun = input, carrier = output, one clutch and one brake.
  - High: the clutch locks sun to carrier, so everything turns as a unit (1:1).
  - Low: the brake holds the ring, the planets "walk" around it, and the carrier turns the same way as the sun but slower.
  - Neutral: both released.
  - Rule: lock any two members and the whole set turns as one.
- **Compound planetary** [PT p6]: the output of one set feeds the next set, giving underdrive, overdrive and several reverses. It is compact but needs more hp because of the hydraulic unit.
- **Culpin's epicyclic, Fig A2.4** [TOP p2] (A driver, B follower, C outer casing, D planets, E stop): a free casing gives 1:1; a held casing speeds the follower up. This is an overdrive version, so the simulation can contrast it with PT's underdrive.
- **Hydraulic shift oil circuit, open-centre** [PT p6]: transmission case (reservoir) → screen → pump → filter (protected by a relief valve) → pressure-regulator valve → splits into a lubrication route and a control route. Oil both lubricates/cools and engages the clutches.

**F. Hydrostatic drive** [PT p8–9; TTS p5]
- Pump-motor pair. Two principles: liquids take the shape of their container, and liquids are incompressible (shown as a two-piston analogy).
- Piston groups ride on swashplates:
  - variable-displacement pump: the swashplate is movable, which varies flow and can reverse it;
  - fixed-displacement motor: fixed-angle swashplate.
- Three controls: flow rate gives speed, flow direction gives travel direction, pressure gives power.
- **Four combinations:** FDP→FDM, VDP→FDM (the common one), FDP→VDM, VDP→VDM (best performance, but complex and expensive).
- **10 advantages** [PT p9]: infinite speeds, one lever, stepless, shifts on the go, high starting torque, no drivelines, compact, no clutch, reduced shock, low maintenance.
- **Lifespan is shortened by** too much speed, heat, pressure or contamination [PT p9].
- **Tractor version** [TTS p5]: range lever (high/low/reverse), hydrostatic lever in a quadrant, no clutch, and an inching pedal for tight spaces.
- What to animate: tilt the swashplate and watch the pistons stroke, the oil flow and the motor speed change.

**G. Torque converter (hydrodynamic)** [PT p8–11]
- Uses high-speed, low-pressure fluid. Parts: pump (impeller), turbine, stator.
- Two flows: vortex flow (circulating between pump and turbine) and rotary flow (pump and turbine turning together like a coupling).
- The stator is a "fluid fulcrum". It turns the returning oil to match the pump's rotation, which adds velocity and multiplies torque.
- As turbine speed rises, vortex flow turns into rotary flow until the unit "locks up" and behaves as a plain fluid coupling.
- PT p10 has a block diagram: Engine → Pump → Turbine → Drive wheels, with a Stator loop back.
- Element-count table [PT p10]:

| TC design | Pumps | Stators | Turbines |
|---|---|---|---|
| A | 2 | 2 | 1 |
| B | 1 | 1 | 2 |
| C | 1 | 2 | 1 |
| D | 1 | 1 | 1 |

- **Full torque-converter transmission** [PT p11]: converter section, range gear section (simple planetary; reverse is required because the converter turns only one way), final-drive section (transfer drive gear, transfer driven gear, output shaft), and hydraulic control (oil flow lubricates, oil pressure engages, oil velocity drives the turbine).
- The notes say the converter multiplies torque and the hydrostatic drive does not [PT p9].

**H. Crown wheel and pinion** [TTS p7]: needed because the wheels run at 90° to the crankshaft. The small pinion drives the large crown wheel, giving a big reduction. Teeth are straight or helical (most tractors use helical).

**I. Differential and diff lock** [PT p11–12; TTS p7–8 Fig 34, chapter cover p1; TOP p2 Fig A2.5a/b]
- Parts: crown wheel bolted to the differential case, 2 or 4 bevel pinions on a cross-pin in the case, 2 side (half-shaft) bevel gears.
- Going straight: everything rotates as one unit and the pinions do not spin.
- Cornering: the pinions spin on their own axis and walk around the slower side gear.
  - If one wheel is held, the other turns at twice the case speed.
  - "As one wheel turns faster, the other turns slower by the same amount."
- **Diff lock**: works by pedal [TTS p8]; can be actuated mechanically, electrically, hydraulically or automatically [PT p12].
  - It locks the half shafts together, so one wheel cannot spin, and the tractor cannot turn a corner.
  - The MF hydraulic version uses a multi-plate clutch with a piston, controlled by a pedal valve [TOP p10].

**J. Final drives** [PT p12; TTS p8–10 Figs 35a/b/c; TOP p10 Fig A2.15]
- **Four types** [PT p12]: straight axle, pinion, planetary, chain. All except the straight axle reduce speed. They also carry the machine's weight and take shock loads.
- **Fig 35a**: the brake sits on the fast differential shaft; a small spur gear drives a large spur gear to the wheel.
- **Fig 35b**: an epicyclic unit in each axle housing, with the brake inboard.
- **Fig 35c** (exploded): disc brake, bearings, reduction gears, wheel hub.
- Torque rises at three points: gearbox, crown wheel and pinion, and final reduction [TTS p10].
- **MF 2000 rear axle, Fig A2.15** [TOP p10]: left-hand carrier plate, crown wheel, pinion shaft, differential gears, diff-lock plates and piston, one large oil-immersed brake disc with brake piston, axle stub shaft, epicyclic reduction unit, axle shaft, all at the inboard end of the trumpet housing. **This is the best rear-axle cutaway to model.**

**K. Brakes**
- **Expanding shoe, Fig 36** [TTS p11–12]
  - Parts: back plate, two lined shoes, return springs, cam, adjuster, drum.
  - Animate: the pedal turns the cam, the shoes spread and grip the drum, and the springs pull them back.
- **Dry disc brake, Fig 37** [TTS p12–13; TOP p9 Fig A2.14]
  - Parts: housing, splined shaft, two lined rotating discs, an expander made of two actuating discs with steel balls in tapered grooves, extension springs, actuating link, operating rod yoke, cover.
  - Animate: the pedal rotates the actuating discs relative to each other, the balls ride up the ramps and force the plates apart, and the discs are clamped against the housing.
  - It is self-energising; the degree depends on the friction coefficient and the ball-seat angle [TOP p9].
- **Other brake variants:**
  - hydraulic brakes: one master cylinder per pedal, with a balancing valve when the pedals are locked together [TTS p13];
  - wet sintered multi-plate brakes on the half shafts [TOP p9];
  - hand or transmission brake [TTS p13].
- **Placement rule** [TTS p11]: a brake is more effective on a fast-moving, low-torque shaft, which is why it sits between the differential and the final reduction.

**L. Belts, pulleys and other mechanisms**
- **Belts** [TOP p1, Figs A2.1/A2.2]
  - Open belt: same direction. Crossed belt: opposite direction and a larger arc of contact.
  - Five friction factors: belt width, tension, pulley diameter, belt material and condition, arc of contact.
  - Also covered: creep, slip as an overload safeguard, crowned pulley, and a quarter-turn drive for shafts at right angles.
- **Tractor belt pulley** [TTS p11]: convex face, side- or rear-mounted.
- **Pawl and ratchet, Fig A2.11** (pawl, ratchet, pawl casting, spring): used for drills, distributors and manure-spreader conveyors [TOP p8].
- **Cam and tappet, Fig A2.12**, and **eccentric, Fig A2.13** (shaft, eccentric, strap) [TOP p8].
- **Bearings** [TOP p5]: radial vs thrust; materials are chilled cast iron, brass/gun-metal, anti-friction alloys, ball/roller; sealed-for-life.

**M. Wheels and tyres** [TTS p13–17]
- Wheel: dished disc bolted to rim lugs; track width is changed by repositioning or reversing the disc. Power-adjusted wheels work like a nut (rim) on a bolt (disc). Front axle is telescopic (Fig 39b: axle adjusting bolts, track-rod bolt, steering arm).
- Also covered: strakes, dual wheels, cage wheels, ballast.
- Tyre marking: 12.4/11-36.

---

## 2. Equations and numbers that could drive the simulation

| # | Relation / value | Source |
|---|---|---|
| 1 | Belt speed ratio: N_follower/N_driver = R_driver/R_follower | TOP p1 |
| 2 | Belt power P(kW) = (T − t)·V/1000. T = tight-side and t = slack-side tension (N), V = belt speed (m/s), T ≈ 2.5 t | TOP p1 |
| 3 | Gear pair: D·N = d·n. Speeds are inversely proportional to tooth counts | TOP p3–4 |
| 4 | Gear train ratio = Π(driver teeth) / Π(follower teeth). The book says epicyclic ratios are "not discussed here" | TOP p4 |
| 5 | Power = load × forward speed (high pull at low speed or low pull at high speed) | TTS p1 |
| 6 | Engine > 2000 rpm, wheels ≈ 20 rpm in bottom gear, so overall reduction is about 100:1 | TTS p1 |
| 7 | Ground speed range 1.6–32 km/h; 6–8 forward / 2 reverse speeds; MF 16F/12R (4 × 2 × 2) | TTS p4; TOP p3 |
| 8 | Differential: one side held → the other turns at 2× case speed; changes are equal and opposite. This implies N_case = (N_L + N_R)/2 | TTS p8; PT p11 |
| 9 | Planetary: lock two members → 1:1; ring held → carrier slower than sun, same direction; Culpin case held → output speeded up | PT p6; TOP p2 |
| 10 | Multi-plate clutch: n driving + (n − 1) driven plates → 2(n − 1) friction surfaces (10 + 9 → 18) | TOP p7 |
| 11 | PTO speeds 540 / 1000 rpm, splines 6 / 21, diameters 35 / 44 mm | TTS p10 |
| 12 | U-joint: 10° gives small fluctuation; 40° gives up to 15° position fluctuation; CV joint max 40°; efficiency > 99% | TOP p4–5 |
| 13 | Belt speed standard 945 m/min (3100 ft/min) | TTS p11 |
| 14 | Clutch pedal free play 18 mm | TTS p4 |
| 15 | Hydraulic ram example: stroke 200 mm, bore 50 mm, 20 kN, 2 s → V = 200·π·25² mm³ = 0.393 L; Q = 0.197 L/s; p = F/A = 102 bar; normal working 160 bar, relief 275 bar | TOP p11 |
| 16 | Hydrostatic: flow → speed, flow direction → travel direction, pressure → power (qualitative only) | PT p8 |
| 17 | Tyre pressures — front: field 1.7 bar, road 2.1, loader 2.7; rear: field 0.8, road 1.0 | TTS p14 |
| 18 | Ballast: 75% water in a 13.6/12-36 tyre ≈ 190 kg; 1 kg CaCl₂ per 5 L water; wheel weights 40 kg each (2–3 per wheel); front weights 30–40 kg; tray ≈ 200 kg for a 45 kW tractor | TTS p15 |
| 19 | Track width: row-crop 1.32–1.93 m; large tractors 1.42–2.13 m, in 10 cm steps; Fig 39a shows 8 rear settings, 203/193/183/173/173/162.5/152.5/142 cm | TTS p16–17 |

**Equations examined but not given in these three PDFs** (all from the 2022/23 papers):
- Shaft power P = 2πNT/60. Q3c: 2000 rpm and 65 N·m give **13.6 kW**.
- Drawbar pull = μ·W. Q3c: 0.85 × 25 kN = **21.25 kN**. To reach 30 kN the wheel needs 30/0.85 = 35.29 kN, so **add 10.29 kN**.
- Weight transfer. Q2c: W = 28.5 kN, R_f = 9 kN, wheelbase L = 2083 mm.
  - CG distance from rear axle x = R_f·L/W = **657.8 mm**.
  - Rear reaction R_r = **19.5 kN**.
  - Weight transfer ΔW = P·h/L = 12 × 580/2083 = **3.34 kN**, giving dynamic front 5.66 kN and rear 22.84 kN.
- These probably come from the "Tires and Tracks" notes. They suit a drawbar/ballast simulation mode.

**Gaps.** None of the following appears in the notes. If the simulation uses them, label them as standard textbook additions:
- clutch torque capacity (uniform-wear or uniform-pressure formulas);
- planetary (Willis) ratio equations, e.g. ring held: N_c/N_s = Z_s/(Z_s + Z_r);
- Hooke's-joint speed equation;
- hydrostatic Q = D·N and T = Δp·D/2π;
- torque-converter efficiency and torque-ratio curves;
- chain drive equations;
- efficiency values, except U-joint > 99% and "compound planetary needs more hp".

---

## 3. Figures worth reproducing in 3D

1. **Fig 30, plan layout** [TTS p2]: the master scene. Engine, clutch, gearbox, differential, brakes, wheels, with an animated power-flow highlight.
2. **Fig 31, single-stage clutch half-section** [TTS p3] and **Fig A2.8** [TOP p5]: pedal-driven engage/disengage cutaway.
3. **Fig A2.9, MF dual clutch** [TOP p6]: two-stage pedal demo with concentric hollow PTO shaft.
4. **Fig A2.10, hydraulic independent PTO clutch** [TOP p7]: piston, plate pack, spool valve and pump with oil-flow animation.
5. **Fig 33, sliding-mesh gearbox cutaway** [TTS p6]: top and bottom shafts sliding into mesh, feeding the pinion and crown wheel.
6. **Fig A2.6, MF 16-speed gearbox section** [TOP p3]: the flagship interactive gearbox (synchro units, shuttle coupler, range gear, hollow layshaft with PTO, 4WD transfer clutch, reverse idler inset).
7. **Fig 32, gear types** [TTS p5]: spur, helical and bevel showcase.
8. **PT p5 planetary drawing** (front view plus side view of carrier, ring and sun shafts) and **Fig A2.4 two-speed epicyclic** [TOP p2]: lock/brake toggles.
9. **Fig 34 differential** [TTS p8], the **chapter-cover diff-and-crown-wheel drawing** [TTS p1], and **Fig A2.5a/b straight vs cornering** [TOP p2]: per-wheel speed sliders and a diff-lock toggle.
10. **Figs 35a/35b/35c, final-drive arrangements** [TTS p9]: spur reduction vs epicyclic, with brake position.
11. **Fig A2.15, MF rear-axle section** [TOP p10]: diff lock, wet brake and epicyclic hub in the trumpet housing.
12. **Fig 36 expanding-shoe brake** [TTS p12], **Fig 37 disc brake (exploded)** [TTS p12] and **Fig A2.14 dry disc brake with ball ramps** [TOP p9].
13. **Fig A2.7, PTO shaft with two U-joints and telescoping guard** [TOP p4]: joint-angle slider showing speed fluctuation.
14. **Fig A2.1 open/crossed belt** and **Fig A2.2 crowned pulley and quarter-turn drive** [TOP p1].
15. **Hydrostatic** (no figure in the notes; PT p8 describes it in text): swashplate pump driving a motor.
16. **Torque-converter flow diagram** [PT p10]: pump, turbine and stator with vortex vs rotary flow.
17. **Fig A2.11 pawl and ratchet**, **Fig A2.12 cam and tappet**, **Fig A2.13 eccentric** [TOP p8].
18. **Fig 38 front weights** [TTS p16], **Fig 39a rear-wheel track settings** and **Fig 39b front-axle track adjustment** [TTS p17].

---

## 4. What the exams cover (set your priorities from this)

**2022/23 final** (`WhatsApp Image 2025-07-24 at 11.15.32_*.jpg`; both files are the same paper)
- Q1: purpose of the power-transmission system and its principal means; components of a complete power train; **diagram of the power train for 1-wheel, 2-wheel and 4-wheel drive**.
- Q2: traction; increasing traction on sandy and clay soil; the weight-transfer calculation above.
- Q3: **three clutch actuation methods**; **basic parts of a planetary set**; the wheel power and drawbar calculation above.
- Q4: **the four hydrostatic pump/motor combinations**, with the best for performance and the cheapest; **torque converter advantage over hydrostatic**; **factors that shorten hydrostatic life**; **describe how a planetary transmission works**.
- Q5: machinery cost (fixed vs variable; MF M-375 4WD 75 hp tractor plus seed drill). This is outside the transmission topic.

**2022/23 mid-semester** (`IMG-20250527-WA0010.jpg`)
- Same themes, plus **"explain the operation of the hydraulic-assisted transmission"** and the planetary parts.
- The same weight-transfer problem.
- A handwritten "18744.45" appears in the margin.

**2019/20 final** (the .txt and `WhatsApp Image 2025-07-24 at 13.53.23_aa48b2c5.jpg`; same paper)
- Q5(ii): components of a complete drive train. Q5(iii): **three major functions of the drive train**. Q5(i): five tractor types.
- Q3: three ways engine power becomes useful work (drawbar, PTO, hydraulics) and which is least efficient (drawbar, because of traction losses).
- Q1–2 are on human factors and vibration; Q4 on traction terms. Both are out of scope.

**Other prompts in the materials**
- Handwritten question in the PT notes [PT p9]: advise a businessman whether to choose a mechanical or a hydraulic-fluid drive, and justify the answer.
- Bell's end-of-chapter questions [TTS p18]: purpose of the clutch, crown wheel and pinion, and differential; what a diff lock is; how a disc brake works; why use cage wheels; why brakes on a fast shaft are more effective.

**Suggested priority for the simulation:**
1. Full power-train flow with 2WD/4WD/1WD toggle.
2. Planetary set with lock/brake states.
3. Hydrostatic swashplate with the four combinations.
4. Torque converter.
5. Clutch actuation modes.
6. Hydraulic-assist clutch packs.
7. Differential and diff lock.
8. Drawbar weight-transfer and traction calculator.

**Images that are not AEE510 transmission material**
- `WhatsApp Image 2025-07-21 at 20.00.55_*` and `20.00.58_*` are an AEE504 practical notebook (size-reduction equipment table, inference and conclusion).
- `WhatsApp Image 2025-05-08 at 13.09.05_*.jpg` is a handwritten reading list: pages 10–15, 27–29, 32–36, 39–42, 44–53, 56–63, 80–81, 106–108, 113. It does not name the book.