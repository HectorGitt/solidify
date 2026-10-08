# AgriTech 3D — Tractor & Farm Machinery Simulator
### Build plan (v1, 2026-10-06)

An interactive 3D simulator built from the 500L Agricultural & Environmental Engineering
notes (OAU Ile-Ife). It covers the tractor and every subsystem inside it. It covers every
attachment and implement it drives. Every part can be cut open in cross-section, exploded,
animated and driven by the equations in the notes.

Source inventories are in [`docs/notes-inventory/`](notes-inventory/). There is one file per
course, and each lists the parts, motions, equations, figures and exam frequency, with
file and page citations. Every module below is built against those files.

---

## 1. What the notes cover → what we build

| Course | Notes content (summary) | Becomes module(s) |
|---|---|---|
| **AEE509** Farm Power I | **Engines**: 4-stroke and 2-stroke cycles, SI vs CI. **Core parts**: piston, rod, crank, valve train, firing order, valve timing. **Systems**: fuel (injection pump, injector, carburettor), air cleaner, governor, lubrication, cooling, ignition, starting/charging. **Thermo**: Otto/Diesel/Dual cycles, IP/BP/FP, bmep, efficiencies, heat balance | M1 Engine |
| **AEE510** Farm Power II | **Transmission**: line of drive, clutches (single, dual/live-PTO, wet IPTO), gearboxes (sliding/constant/synchro, MF 16F/12R), powershift, planetary, hydrostatic, torque converter, crown wheel and pinion, differential and diff lock, final drives, brakes. **Running gear**: tyres and tracks, ballast. **Traction**: Zoz & Grisso / Brixius. **Controls**: hydraulics and draft control, steering. **Operator**: human factors, seat vibration, noise. **Maintenance** | M2 Power train, M3 PTO, M4 Hydraulics, M5 Steering, M6 Traction, M11 Operator |
| **AEE502** Farm Machinery II | **Tractor**: tractor types, hitching mechanics (Macmillan Ch 6: weight transfer, slopes, three hitch types, virtual hitch point), PTO, Hooke's joint and CV joints, hydraulics, power measurement. **Implements**: land clearing, tillage, planting, fertilizer, spraying, forage, harvesting, root crops, pumps/mills | M3, M4, M7 Chassis & hitching, M8 Implements, M10 Testing |
| **AEE502** (scanned) | **Tractor mechanics** (Macmillan Ch 2): ratios, slip, tractive efficiency, "Farmland" tractor data. **Tractor tests**: dynamometers, Nebraska/OECD | M6, M10 |
| **AEE501** Machinery Mgmt | **Land clearing**: methods and sequence. **Tillage**: types. **Management**: field capacity, machinery costs (ISU PM 710) | M8, M10 |
| **AEE503** Machine Design | **Power transmission**: power-transmission tree, belts, chains, gears (forces/nomenclature). **Other elements**: bearings, clutches, brakes, springs, ropes/hoists, welds | M9 Elements lab (cross-linked into M1–M8) |
| **AEE518** Mech. Systems Analysis | **Response**: 1st/2nd-order response, damping cases. **Equivalent systems.** **Vibration**: transmissibility, isolation, log decrement. **Stability**: Routh | M11 Vibration & operator |

Out of scope: AEE504, AEE536 and AEE505 (processing/food/structures), AEE507 (soil & water)
and the TPD courses. Stationary PTO-driven machines from AEE502 (pumps, hammer mill, burr
mill) appear in M8 as PTO applications.

---

## 2. Platform decision

**Recommended: a browser app built with Three.js (React Three Fiber) and TypeScript.**

| Option | Verdict |
|---|---|
| **Web app (Three.js / R3F)** ✅ | Runs on any laptop or phone with no install, and is shareable as a link. Real-time cross-sections via clipping planes. Geometry is generated from code, so dimensions come straight from the notes' equations. Download size is tiny because models are procedural, not heavy files. Can work offline as a PWA. |
| Blender (renders/videos) | Best still images, but not interactive: a slider can't change the compression ratio and show the P-V loop update. Keep it as an **optional** tool for a hero exterior tractor shell (exported as glTF) and promo videos. |
| Unity / Godot | Capable, but users must install it or run a WebGL build, the tooling is heavier, and code-driven parametric geometry gains nothing over Three.js. |

**Stack**
- **App framework:** Vite, React 19, TypeScript (strict).
- **3D:** `three`, `@react-three/fiber`, `@react-three/drei` (camera controls, gizmos, HTML labels), `@react-three/postprocessing` (selection outline, SSAO).
- **Geometry:** `three-bvh-csg` for boolean cuts on housings (ports, windows, oilways).
- **State:** `zustand` for app/sim state.
- **UI:** Tailwind CSS and Radix UI primitives.
- **Charts:** `uPlot` for fast-updating live charts (P-V, ω₂/ω₁, TE vs slip, transmissibility).
- **Equations:** `KaTeX` rendering.
- **Testing:** `vitest` for every physics function; Playwright for smoke checks of each scene.
- **Physics engine:** none by default. Mechanisms are **kinematically exact** from the
  notes' equations. ODEs (vibration, governor, hydraulics, clutch slip) use a small RK4
  integrator. Rapier is used only if a dynamic rollover demo is added.

---

## 3. Core architecture (shared by every module)

Build these once, in Phase 0. Every module then becomes content plus small mechanism code.

### 3.1 Part registry & assemblies
Each part is a record:
- `id`, `name`, `material`, `geometry()` builder, `parent`, `explodeVector`;
- `description` and `function` text;
- `citations: [{course, file, page}]`;
- optional `drive` binding (which shaft/axis it rides on).

Assemblies nest (engine → cylinder head → valve train → valve). The UI parts tree,
click-to-inspect, isolate, hide and explode all come from this registry.

### 3.2 Cutaway / cross-section system (the key feature)
- **Cut planes:** one or more clipping planes, each with a drag gizmo (X/Y/Z or free). Presets: half-section, quarter-cut, and the "textbook" sections that reproduce figures in the notes (e.g. Fig 31 clutch half-section, Fig A2.6 gearbox, Fig A2.15 rear axle).
- **Section caps:** cut faces get **stencil-buffer caps** with **hatching per material**: steel 45° hatching, cast iron, bronze, rubber, friction lining, and fluids (oil, coolant, fuel) shown as tinted fills. This makes cuts look like engineering drawings, not hollow shells.
- **Mesh rule:** every geometry generator must output **watertight meshes**, so caps work. This is enforced by a test.
- **Per-assembly control:** parts can be "uncuttable" (e.g. shafts stay whole while housings are cut), like a real cutaway model.

### 3.3 View modes
- **Display modes:** Solid · X-ray (housings ghosted) · Exploded (slider) · Isolate · Wireframe.
- **Labels:** leader-line labels toggle on and off; numbered callouts match the notes' figure numbering.
- **Camera:** bookmarks per scene and smooth transitions.

### 3.4 Kinematic drive graph + sim clock
- **Graph:** a single solver drives every rotating and sliding part. Shafts are nodes (angle θ, speed ω, torque T). Constraints are edges:
  - gear mesh / belt / chain: ω₂ = ±(z₁/z₂)·ω₁, with belt slip optional;
  - Hooke's joint: θ₂ = atan(tan θ₁ / cos β) (AEE502), exact non-uniform output;
  - differential: ω_case = (ω_L + ω_R)/2 (AEE510);
  - planetary (Willis): (ω_s − ω_c)/(ω_r − ω_c) = −z_r/z_s, with lock and brake states;
  - clutch / brake: engagement 0–1. A slipping state uses a torque-capacity model (AEE503 uniform-wear formula);
  - slider-crank: piston x(θ); cam to follower lift profile; crank-pitman (mower knife); four-bar (3-point linkage).
- **Clock:** play/pause, a **time-scale** from 1/200× (to see a 2000 rpm engine) up to 1×, and single-step.
- **Readouts:** every shaft can show rpm and torque, and an optional **power-flow glow**. Power-flow glow animates along the active path, e.g. engine → clutch → gearbox → crown wheel → diff → final drive → wheels / PTO.

### 3.5 Flow visualisation
- **Paths:** animated particles and scrolling-texture tubes along spline paths for fuel, air, exhaust, oil, coolant, hydraulic oil and crop.
- **Colour maps:** colour by temperature or pressure.
- **Branching:** branching paths with valve states: relief valve open, thermostat bypass, spool positions, and grain/chaff/straw separation in the combine.

### 3.6 Physics library (`src/physics/`)
- Pure TypeScript functions, one file per topic. Each function has typed SI inputs and outputs and carries a `source` citation.
- **Unit tested against the worked examples and marking guides in the notes.** These answers are the acceptance criteria (see §8).

### 3.7 Learning layer
- **Info card:** shows each part's name, function and **citation**, for example "AEE510 · Tractor Transmission System.pdf · p3".
- **Equation panel ("show working"):** shows the formula, then the same formula with live values substituted, then the result with units. It updates as sliders move.
- **Live charts:** synced to the 3D state. Example: a dot moves round the P-V loop as the piston moves.
- **Guided tours:** scripted steps (camera, highlights, cut plane, narration text, citation), authored as JSON.
- **Exam presets:** load the data from a past question, step through the solution, and compare with the marking guide.
- **Accuracy badges:**
  - **"Beyond notes"**: content added from standard textbooks because the notes don't cover it.
  - **"Note discrepancy"**: places where the notes or marking guide disagree with correct computation (list in §9).

---

## 4. Module catalogue

Each module is a set of scenes. The ★ marks the most-examined content, which is built first within the module.

### M1 · Engine (AEE509)
- **1a ★ Single-cylinder 4-stroke diesel, full cutaway**
  - Parts:
    - core: block with water jacket, liner, head, piston with rings and gudgeon pin, con-rod (small/big end, cap), crankshaft, flywheel with ring gear, camshaft at ½ speed with timing gears;
    - valve train: follower → pushrod → rocker → valve, spring and seat;
    - injector.
  - Animation: the 4 strokes over 720°, with gas coloured by temperature, valve events, and the injection spray.
  - Live cycle plots: **P-V and T-s** for **Otto / Diesel / Dual**. Sliders for r, cutoff ratio δ, pressure ratio α, T₁ and P₁, with η and mep shown.
  - **Valve-timing wheel**, theoretical vs actual, with overlap. The notes give no degree values, so typical ones are used and flagged "beyond notes".
- **1b ★ 2-stroke petrol**: ports (inlet, transfer, exhaust), deflector piston, crankcase compression, petroil mist lubrication. Side-by-side comparison with the 4-stroke (L3 comparison table).
- **1c ★ Multi-cylinder**:
  - 2-, 3-, 4-, 6- and 8-cylinder crankshafts (TB Fig 2.5);
  - firing-order selector (1-3-4-2, 1-5-3-6-2-4, …) with an auto-generated **firing chart** grid (TB Table 2.3);
  - firing interval 720°/n.
- **1d Fuel systems**
  - Diesel line: tank → lift pump → primary/secondary filters → **injection pump, with the helix plunger metering cutaway** → HP pipe → **injector, with needle lift vs spring cutaway** → leak-off.
  - SI line: sediment bowl, diaphragm lift pump, **carburettor** (float, venturi, choke, throttle).
- **1e Air & governing**: dry and **oil-bath air cleaner** airflow; **flyweight governor** (flyweights, spring, collar, linkage to the throttle or pump rack). The governor runs on an ODE and shows hunting, plus a regulation % readout.
- **1f ★ Lubrication**: force-feed (gear pump, strainer, relief valve, filter, gallery, drilled oilways) vs splash, crankcase breather. Oil-flow animation.
- **1g ★ Cooling**: **thermosiphon** vs **forced circulation** (water pump, thermostat with bypass, radiator with pressure cap, fan), and air-cooled fins. Coolant temperature colour map.
- **1h Ignition & electrical**:
  - coil ignition circuit (battery, coil primary/secondary, breaker, condenser, distributor, plugs), animated as current plus spark;
  - **magneto** with impulse coupling;
  - starter pinion engaging the ring gear; dynamo vs alternator; battery cutaway.
- **Calculators**:
  - PD, TCV and CR (Mahindra 100 × 124 mm preset);
  - IP, BP, FP and ηm; bmep and imep; ηbth, ηv and sfc;
  - **heat-balance Sankey**.

### M2 · Power train (AEE510, with AEE503 cross-links)
- **2a ★ Line of drive overview** (Fig 30)
  - Full-tractor X-ray with the power-flow glow.
  - **1WD/2WD/4WD toggle** (exam Q1).
  - Speed reduction at three stages, showing about 100:1 (Farmland tractor ratio preset).
- **2b ★ Clutches**
  - Single dry plate, Fig 31: pedal travel, free play 18 mm, springs, release levers, thrust bearing.
  - **Dual clutch for live PTO**, Fig A2.9: two-stage pedal and a concentric hollow PTO shaft.
  - Wet multi-plate **IPTO clutch**, Fig A2.10: piston, Belleville spring, spool valve.
  - Actuation modes (mechanical, hydraulic, electrical).
  - Torque-capacity calculator (uniform pressure vs uniform wear), from AEE503 M8.
- **2c Gearboxes**
  - sliding mesh (Fig 33);
  - constant mesh with dog collars;
  - **synchromesh** (cone synchroniser, with speeds matching before engagement);
  - **★ MF 16F/12R gearbox** (Fig A2.6) as the flagship cutaway: speed-shift epicyclic, shuttle coupler, 4 synchro gears, range gear, hollow layshaft carrying the PTO shaft, 4WD transfer clutch. The **gear lever** shows the live power path through the gears.
- **2d ★ Planetary**
  - Sun, planets, carrier and ring, each with **lock and brake toggles**. Shows the "lock two members → 1:1" rule.
  - Underdrive (PT p5) vs Culpin overdrive (Fig A2.4).
  - Compound set.
  - Willis-equation readout, flagged "beyond notes".
- **2e ★ Hydraulic-assist powershift**: clutch packs (discs splined to the drum, plates to the hub) and countershaft high-low / reverse. Includes the oil circuit (screen → pump → filter/relief → regulator → lube and control).
- **2f ★ Hydrostatic drive**: **variable swashplate pump → fixed motor**. Tilting the swashplate changes piston stroke, flow, and motor speed and direction. Shows the **4 pump/motor combinations** (exam Q4) and the life-reducing factors.
- **2g ★ Torque converter**: impeller, turbine and stator. **Vortex vs rotary flow** visual as turbine speed rises, up to coupling point. Shows the torque-converter vs hydrostatic comparison (exam Q4).
- **2h ★ Crown wheel & pinion + differential**: straight vs cornering (Fig A2.5). One wheel held gives 2× case speed. **Diff lock**, mechanical vs hydraulic multi-plate.
- **2i Final drives**: spur reduction (Fig 35a), **epicyclic hub** (Fig 35b), and the **MF rear-axle section** (Fig A2.15: diff lock, wet brake, epicyclic).
- **2j Brakes**:
  - **expanding shoe** (Fig 36): cam, shoes, return springs;
  - **dry disc with ball-ramp self-energising** (Fig 37 / A2.14);
  - wet multi-plate;
  - "why brakes sit on the fast shaft" demo.
- **2k Belts, pulleys & mechanisms** (Culpin App 2): open vs crossed belts, crowned pulley, quarter-turn drive, pawl & ratchet, cam & tappet, eccentric.

### M3 · PTO & driveline (AEE502, AEE510)
- **PTO types**: transmission, continuous/live, independent and **ground-speed**, each animated with the clutch and travel states.
- **Shaft standards**: 540 rpm / 6-spline / 35 mm vs 1000 rpm / 21-spline / 44 mm. Rotation is clockwise viewed from the rear.
- **★ Hooke's joint**:
  - yokes, spider and needle cups, with exploded view;
  - live **ω₂/ω₁ vs θ** and **α₂ vs θ** plots;
  - inertia-torque readout;
  - exam presets: 20° at 1000 rpm table; 45° √2 / 1/√2 example; 147 N, k = 0.25 m inertia example.
- **★ Double Hooke's**: in-phase vs out-of-phase yokes, and equal vs unequal angles in a turn (BS 1495 hitch-midpoint rule).
- **Telescopic PTO shaft**: lemon profile, guard cones, two joints. Shown on a tractor-to-implement hookup as it turns and lifts.
- **CV joints** (cutaways): Rzeppa/Birfield, Weiss, Tracta, tripode, double cardan.
- **Safety demo**: shaft entanglement speed (7 ft of string in 1 s at 540 rpm), and guarding.

### M4 · Hydraulics & 3-point hitch (AEE502, AEE510)
- **★ Lift circuit** (Fig 40): reservoir, pump, control valve, ram, cross shaft, lift rods, lift arms and relief valve. States: **lift / hold / lower / overload (relief knocking)**.
- **★ Pump internals**: **gear pump** and **vane pump** (rotor, sliding vanes, cam ring); pump vs motor efficiency table.
- **★ Double-acting cylinder** cutaway: extend/retract forces and speeds.
- **★ Calculators** (with exam presets):
  - Q_T = D·N, η_v, T_T = Δp·D/2π, P_h, P_s and heat loss (1800 rpm / 18 MPa preset → 64.8 kW / 90 kW);
  - cylinder F = pA, v = Q/A (76.2 mm bore / 25 mm rod / 17.2 MPa preset);
  - ram example from TOP p11.
- **★ Draft control loop** (Fig 41): soil draft → top-link compression → sensing spring → spool → lift or lower. The ploughing depth self-regulates over varying soil.
- **Other control modes**: **position control** comparison; lower-link and torque sensing alternatives; pressure control (weight transfer).
- **★ 3-point linkage geometry as a live four-bar**:
  - **virtual hitch point** construction;
  - penetration → equilibrium → restrained-working stages (Macmillan Fig 6.5);
  - top-link length changes pitch;
  - levelling box, check chains, stabilisers, Cat I/II/III pins, automatic coupler.
- **External services**: remote ports driving a tipping trailer and a loader.

### M5 · Steering (AEE510)
- **Manual linkage** (Fig 44): wheel → box → drop arm → drag link → steering arm → stub axle, plus track rod.
- **Steering boxes** (Fig 46): **recirculating-ball** and **worm-and-peg** cutaways.
- **Power-assisted** vs **hydrostatic** (Fig 45): pump, column valve, double-acting cylinder. Hydrostatic steering fails with the engine off.
- **Toe-in** measurement (Fig 47). Track-width change needs a track-rod reset.
- **Turning geometry**: Ackermann geometry and turning radius, flagged "beyond notes".

### M6 · Wheels, tyres, tracks & traction (AEE510, AEE502)
- **★ Tyre cutaway** (Figs 2–5): tread, shoulder, sidewall, plies, bead wires, inner liner, rim.
  - **Bias / belted-bias / radial** ply-angle visual.
  - Size-code decoder (12.4/11-28, 24.5-32).
  - Tread classes (R-1…R-4, F-1…F-3).
  - Directional fitting.
- **Inflation**: over/under/correct cross-sections morphing with pressure, with the contact patch and wear zones.
- **Ballast**: **liquid ballast** at 75% fill (fluid plus air cushion, valve at top); cast-iron wheel and front weights; the chalk-mark **slip test** (10 revs); tread-mark soil decals (too heavy / too light / correct).
- **Crawler undercarriage**: sprocket (hunting tooth), idler, track and carrier rollers, recoil spring and adjuster, links/pins/bushings, shoe types. Tension sag states and idler misalignment.
- **★ Traction lab**:
  - **Macmillan Ch 2**: Nw = Ne/q, V₀, H = 2qTe/D, slip i, power loss, ηt, ηr, ηe, ηo.
  - **Farmland tractor data** (engine curve, gears 3/5/7), giving the **speed–pull chart with gear steps and the constant-power envelope** (Fig 2.2).
  - **Brixius / Zoz & Grisso**: mobility number Bn, GTR, MRR, NTR, TE vs slip; bias vs radial; cone index from soil type; ideal slip 10–15%.
  - Wheel free-body overlays (W, GT, NT, MR, eh, rolling radius, torque radius).
- **Power delivery efficiency**: table for 2WD / MFWD / 4WD / tracks against soil condition. Ballast number calculator (kg/kW against speed).

### M7 · Chassis mechanics, hitching & stability (AEE502 Macmillan Ch 6, AEE510)
- **CG determination**: raise the front axle (Fig 6.6, Eq 6.1–6.3).
- **★ Weight transfer**:
  - Sliders: slope α, pull P, pull angle θ and drawbar height y'.
  - Readouts: live **front and rear dynamic wheel-load bars** (Eq 6.4–6.7) and a **front-lift warning at Vf = 0**.
  - Exam preset: W = 28.5 kN, Rf = 9 kN, L = 2083 mm, P = 12 kN, h = 580 mm → ΔW = 3.34 kN.
- **★ Hitch comparison**: **trailed vs semi-mounted vs fully-mounted** with the same soil force. Shows which axle gains or loses weight, using the tan θ conditions (Eq 6.17–6.21).
- **Slope limits**: maximum slope up and down (Eq 6.9–6.10); impending **rear overturn** with drawbar-height ratio h (Eq 6.35); a high hitch tips the tractor backwards (Problem 6.16).
- **Special hitches**: walking tractor handle force (Eq 6.22–6.24); PTO-driven trailer; weight-transfer hitch (Eq 6.30–6.31).
- **Tractor types gallery**: the 12 types (standard, row-crop, high-clearance, orchard, utility, crawler, power tiller, 4WD articulated, skid-steer, …), with evolution notes.
- **Rollover & ROPS**: stability visual and ROPS frame; sidehill stability vs track width. Lateral rollover maths is flagged "beyond notes".

### M8 · Implements & attachments (AEE502, AEE501)
Each implement includes: 3D model, hitch type (3-point / semi / trailed / front), PTO or hydraulic drive animation, cutaway of the working parts, field animation, and the related calculation.
- **★ Tillage**
  - **Mouldboard plough**: share, mouldboard, landside, frog, coulter, jointer. **The furrow slice is cut and inverted** (a procedural ribbon mesh). Readouts: centre of draft and line of draft; **draft = unit draft × furrow area**.
  - **Disc plough**: tilt angle 15–25° and disc angle 42–45° sliders.
  - **Other tools**: reversible plough; chisel plough; subsoiler.
  - **Disc harrow**: gang angle. **Harrows**: spike and chain.
  - **Cultivators**: rigid and spring tine.
  - **Rotary tiller**: PTO driven, blade kinematics.
  - **Ridger.**
  - **Ploughing patterns** (lands, round-and-round, one-way), shown as a top-down field animation.
- **★ Planting**:
  - **seed drill**: fluted-roller metering cutaway, ground-wheel chain drive, calibration calculator;
  - **planter**: rotating cell plate dropping seeds;
  - jab planter; seed-cum-fertilizer drill.
- **Fertilizer**: spinning-disc broadcaster (PTO, gate, spread pattern) and **manure spreader** (ratchet-driven apron, beaters).
- **Crop protection**:
  - **boom sprayer**: tank, PTO pump with relief valve and gauge, boom, filters;
  - **nozzle cutaways**: fan, hollow cone and solid cone (whirl plate);
  - flow ∝ √p; boom calibration; knapsack; ULV spinning disc.
- **Forage**:
  - **★ cutter-bar mower**: PTO → crank → pitman → reciprocating knife over ledger plates; registration and lead;
  - rotary mower; rake and tedder;
  - **baler**: pickup → auger → packer → plunger with knife → knotter.
- **★ Harvesting**: **combine harvester cutaway with crop-flow particles**. Flow: reel → cutter bar → auger → feeder → cylinder and concave → straw walkers → grain pan → sieves → fan → grain and tailings augers → tank. Also:
  - defect table: speed/clearance → cracked grain or unthreshed heads;
  - thresher; maize sheller; maize head (snapping rolls).
- **★ Root crops**: groundnut digger-shaker(-inverter); cassava digger-elevator; potato spinner.
- **★ Land clearing**:
  - machines: bulldozer, rake blade, tree pusher, **anchor chaining between two crawlers**, root plough, shear blade with stinger;
  - the full staged sequence (survey → knock down → windrow → burn → till);
  - land forming with scraper and land plane.
- **PTO-driven stationary machines**: water pumps (centrifugal impeller/volute, reciprocating), hammer mill, burr mill.
- **Field capacity & cost link**: C = W·S·FE/10 (ha/h), feeding into M10.

### M9 · Machine elements lab (AEE503)
Every element in this lab is also linked from where it appears on the tractor.
- **Power-transmission tree** (M1 chart) as an explorable hub.
- **Belts**:
  - open and crossed, with live wrap angles;
  - T₁/T₂ = e^(fα), with the V-groove form;
  - centrifugal tension;
  - Fenner selection workflow.
- **Chains**: roller chain exploded (plates, pin, bush, roller); simplex vs duplex; planter chain train.
- **Gears**:
  - spur nomenclature, with every circle labelled;
  - force vectors: helical Ft/Fr/Fa, bevel Ft/Fp/Fg;
  - idler train.
- **Bearings**: cutaways of 7 rolling types plus a journal bearing with oil film; static capacity C₀ (Stribeck/AFBMA); L₁₀ life.
- **Clutches**: multi-disc (Fig 14-1) and cone, with a pressure-vs-radius heat map.
- **Brakes**: single shoe with a self-lock toggle; internal expanding shoe (p ∝ sin θ shading); simple, two-way and differential band brakes; heat generated.
- **Springs**: helical (Wahl factor, stiffness) and leaf (graduated plus full leaves, nip).
- **Welds**: fillet throat (45° / 67.5°) and the eccentric bracket.
- **Ropes**: capstan winch with 4 turns.

### M10 · Tractor testing, power measurement & management (AEE502, AEE501)
- **Dynamometers**:
  - **Prony brake**;
  - **hydraulic dynamometer**, sectional (Fig 15.3);
  - eddy-current;
  - DC cradle;
  - PTO shop dynamometer.
- **Drawbar testing**: **drawbar test car**, strain-gauge link, torque meter with slip rings, **chassis dynamometer**.
- **Live P = 2πNT/60000**; atmospheric correction factor.
- **Test standards**: Nebraska / OECD test sequence walkthrough.
- **Machinery cost calculator** (2D panel):
  - salvage value, capital recovery, TIH;
  - repair curve, fuel = 0.044 × PTO hp, labour;
  - cost per ha, using the ISU worked examples.

### M11 · Vibration, seat & operator (AEE518, AEE510)
- **Mass–spring–damper rig**: the 4 damping cases, step and sine response, s-plane poles; log decrement; equivalent springs and masses.
- **★ Transmissibility & isolation**: TR vs r for each ζ; isolation efficiency. Presets: the **hopper shaker at resonance** and the compressor on isolators.
- **★ Tractor seat model**: 2-DOF (operator / cushion / suspension) on a tractor driven over terrain. Shows **seat acceleration vs ISO 2631 limits** and the 4–8 Hz human-sensitivity band.
- **Cab ergonomics**: 21 controls (Fig 10.1), anthropometric percentile mannequins, noise dB(A) cab vs no cab, ROPS.
- **Maintenance overlay**: 10 / 50 / 250 / 600-hour service points highlighted on the 3D tractor.

### M12 · Field (capstone)
Drive the assembled tractor in a field with any implement attached:
- **Field**: deformable soil heightfield (furrows, ridges, wheel ruts) and tread marks.
- **Live dashboard**: rpm, gear, ground speed, slip, draft, drawbar power, wheel loads, fuel, field capacity.
- **X-ray during work**: an **X-ray toggle** shows the drivetrain, hydraulics and PTO working while ploughing.
- **Soil**: soil-type selector (cone index).

---

## 5. Modelling approach

- **Procedural, parametric geometry in TypeScript** (`src/geometry/`), so dimensions come from data and equations:
  - involute gear generator: spur, helical, bevel, internal ring, rack;
  - splines and shafts;
  - lathe profiles: pistons, valves, shafts, bearings, nozzles;
  - extruded and CSG housings with ports and oilways;
  - tube geometry for pipes and hoses;
  - instanced chains, belts and track links following paths;
  - leaf and coil springs;
  - tyre carcass with tread lugs.
- **Real dimensions where the notes give them**:
  - Farmland tractor: wheelbase 1.88 m, rear r = 0.635 m, 14.9×28 tyres, CG data;
  - PTO: 35 mm / 6-spline;
  - engine: 100 × 124 mm.
  - Everything else uses typical values, documented in `src/content/specs.ts`.
- **Material library**: PBR cast iron, machined steel, painted steel (generic tractor paint, **no brand liveries or logos**), rubber, bronze, friction lining, glass, and fluids. Hatch patterns for section caps.
- **Exterior tractor shell**: procedural first. An optional Blender-modelled glTF is added later if a nicer silhouette is wanted.
- **Performance budget**: 60 fps on a mid-range laptop; acceptable on a recent phone. Measures:
  - route-level code splitting (each module loads on demand);
  - instancing; LOD for the field scene;
  - target **< 3 MB initial download**;
  - PWA offline cache.

## 6. Project structure

```
AgriTech/
  docs/            PLAN.md, notes-inventory/, errata.md, specs.md
  src/
    core/          sim clock, drive-graph solver, units, RK4
    physics/       engine.ts thermo.ts hooke.ts hydraulics.ts traction.ts hitch.ts
                   belts.ts gears.ts clutch.ts brakes.ts bearings.ts springs.ts
                   vibration.ts testing.ts costs.ts implements.ts  (+ *.test.ts)
    geometry/      gears, lathe, splines, csg helpers, chain/belt/track paths, tyre
    render/        section planes + stencil caps + hatching, x-ray, explode,
                   labels, flow particles, power-flow glow
    parts/         registry, materials
    modules/       engine/ powertrain/ pto/ hydraulics/ steering/ traction/
                   chassis/ implements/ elements/ testing/ vibration/ field/
    ui/            app shell, parts tree, inspector, equation panel, charts, tour player
    content/       tours/*.json, exam presets, citations, specs
```

---

## 7. Roadmap

Each phase ends with something runnable and demonstrable.

| Phase | Deliverable | Done when |
|---|---|---|
| **0 · Foundations + vertical slice** | Scaffold; part registry; **section caps with hatching**; explode/X-ray/isolate; drive-graph solver; sim clock with slow-mo; equation panel; live chart; info cards with citations. **Slice: single-cylinder 4-stroke diesel cutaway with live P-V/T-s** | **Interaction:** a cut plane drags through the engine showing hatched caps; clicking a part shows its card and citation; the 4 strokes animate in slow-mo with a dot moving round the P-V loop. **Accuracy:** physics tests pass on Misc Ex 9/12/15 and the dual-cycle exam data |
| **1 · Engine (M1)** | 2-stroke, multi-cylinder and firing chart, fuel, air, governor, lubrication, cooling, ignition, calculators | All AEE509 exam topics have a scene or calculator |
| **2 · Power train (M2)** | Line-of-drive overview, clutches, gearboxes incl. MF 16F/12R, planetary, powershift, hydrostatic, torque converter, diff, final drives, brakes | Gear lever drives the live power path; exam Q1/Q3/Q4 topics covered |
| **3 · PTO, hydraulics, steering (M3–M5)** | Hooke's/CV joints, PTO types, lift circuit, pumps, draft control, 3-point four-bar with virtual hitch, steering boxes | Hooke's and hydraulics exam presets reproduce marking-guide numbers |
| **4 · Whole tractor (M6, M7)** | Subsystems assembled into one tractor; tyres, tracks, ballast; traction lab; weight transfer; hitch comparison; stability | Weight-transfer exam preset gives 3.34 kN; Farmland speed–pull chart matches Fig 2.2 |
| **5 · Implements (M8)** | In order: tillage → planting → spraying/fertilizer → forage → harvesting → root crops → land clearing → PTO stationary machines | Each implement hitches to the tractor, animates and has a cutaway |
| **6 · Supporting labs (M9–M11)** | Machine elements, testing & dynamometers, cost calculator, vibration & seat | AEE503/518 exam presets pass |
| **7 · Capstone & polish (M12)** | Field scene; guided tours for every module; exam mode; accessibility; PWA; deploy | Shareable URL; offline works; tours cover the syllabus |

**Order rationale:**
- Phase 0 is the hardest engineering (caps, solver, layout). The engine slice proves all of it early.
- Modules 1–4 build the tractor bottom-up. Implements come once the tractor exists to hitch them to.
- The order inside each phase follows exam frequency (★).

---

## 8. Verification

The physics library is tested against the notes' own worked answers. Initial fixtures:

| Topic | Fixture (source) | Expected |
|---|---|---|
| Otto cycle | 105 kPa / 295 K → 8902 kPa / 2500 K (AEE509 Misc Ex 9) | r = 10, η = 60.2 %, mep = 1135.7 kPa |
| Diesel cycle | r = 20, 100 kPa, 300 K, 2000 kJ/kg (Ex 12) | T₂ = 994 K, δ = 3, η = 60.6 %, mep = 1480 kPa |
| Dual cycle | r = 16, 2800 kJ/kg, Qv/Qp = 1.5 (Ex 15) | Pmax = 16 364 kPa, η = 64.9 % |
| Engine geometry | 100 × 124 mm, CV = PD/6 (TB) | PD = 973 400 mm³, CR = 7.0 |
| Governor | 1600 / 1500 rpm (Supp) | 6.45 % |
| Hooke's joint | δ = 20°, 1000 rpm (AEE502 guide) | 1060 … 940 rpm table; ω range 939.7–1064 |
| Hooke's inertia | 147 N, k = 0.25 m, θ = 45° | α = −1365 rad/s² |
| Pump | 1800 rpm, 18 MPa, ηv 0.8, ηT 0.9 | Ph = 64.8 kW, Ps = 90 kW |
| Cylinder | 76.2 mm bore / 25 mm rod / 17.2 MPa / 68.13 L/min | 78.4 / 70.0 kN; 0.249 / 0.279 m/s |
| Weight transfer | W 28.5 kN, Rf 9 kN, L 2083 mm, P 12 kN, h 580 mm (AEE510 exam) | x = 657.8 mm, ΔW = 3.34 kN |
| Drawbar | 2000 rpm, 65 N·m; μ 0.85 × 25 kN | 13.6 kW; 21.25 kN; +10.29 kN |
| Tractor ideal | Farmland gear 3 (q = 139.5), D ≈ 1.26 m | 4.07 km/h @ 0 kN; 38.31 kN @ 2.21 km/h |
| Belt | Crossed, 7.5 kW, 250/500, C 1.25 m, f 0.3 (AEE503) | α = 214.9°, b = 92 mm |
| Gears | Helical 200 N·m, Ø250, φ 27°, α 30° | Ft 1600, Fr 815, Fa 924 N |
| Brake | Single shoe 225 N·m, f 0.3 (Fig 15-10) | F = 805 / 861 N; self-lock c ≥ 1.2 m |
| Vibration | θ̈ + 10θ̇ + 16θ = 32u(t) (AEE518) | θ = 2 + ⅔e^(−8t) − (8/3)e^(−2t) |
| Log decrement | m 4 kg, k 5 kN/m, 0.25 in 5 cycles | ζ = 0.044, b = 12.5 N·s/m |
| Field capacity | 28 ft × 6 mph × 79 % (ISU) | 16 ac/h |
| Costs | 180 hp tractor ISU example | total $46.56/h |

Visual checks run per scene in the browser preview: section caps, label placement, and frame rate.

---

## 9. Content accuracy

**Probable errors in notes or marking guides.** The app shows the computed value with a "note discrepancy" badge. These should be confirmed with the lecturer before being relied on.
- **AEE509 Thermo p5:** says (δᵏ−1)/(k(δ−1)) < 1. It is actually > 1, which is *why* Diesel η < Otto η at the same r.
- **AEE509 Misc p10:** says the dual cycle is less efficient than the Diesel cycle at the same r and δ. Mathematically it is more efficient.
- **AEE502 Agricultural Machineries plough example:** treats 180 N as kgf ("2.4 hp"). The correct figure is ≈ 0.245 hp.
- **AEE502 2018/19 guide:** the two-bottom plough answer uses one bottom. Correct is 420 N / ≈ 327 W.
- **AEE503 MG19:** the multiple V-belt answer drops mv² inconsistently. It needs 3 belts, not 2.06.
- **AEE503 M8:** the cone-clutch R_m is given as ½(Ro − Ri). It should be ½(Ro + Ri).
- **AEE503 M4:** sign typo in the open-belt α₂.
- **AEE518 LN:** the cantilever example uses E = 2.07×10¹³. That gives ω_n 93.5 rad/s; with E = 207 GPa, ω_n is 9.35 rad/s.
- **AEE503 MG21:** the helical spring uses K_s, not the Wahl factor (1.184).
- **AEE501 MGMT:** operating cost is given as $24.69/h in one place and $18.09/h in another.

**Content not in the notes, added from standard textbooks and badged "beyond notes":**
- Willis planetary equation;
- Ackermann geometry;
- lateral rollover threshold;
- hydraulic gear-pump internals (named but not drawn);
- typical valve-timing degrees;
- torque-converter characteristic curves;
- chain polygon effect;
- disc-brake theory;
- 6-DOF tractor model (the referenced chapter is missing).

**Missing pages:** Culpin p388 is not in the scan. AGRICULTURAL MACHINERIES.docx skips §12.7.2 → §13.4 (harrows and seed-drill detail). Those scenes use textbook-standard designs.

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Section caps on many overlapping parts are expensive or glitchy | Watertight-mesh rule; caps batched per material; only the active cut assembly is capped; fall back to hatch-textured back faces on weak GPUs |
| Scope is very large (≈ 80 scenes) | Shared core plus data-driven scenes; strict phase order; ★ topics first; each phase shippable |
| Soil and crop physics are too heavy | Visual soil uses a deformable heightfield and procedural furrow ribbons; forces come from the notes' equations, not DEM simulation |
| Modelling accuracy vs effort | Parametric generators reused everywhere (gears, lathe parts); fidelity concentrated on the ★ cutaways |
| Phone performance | Per-module lazy loading, LOD, reduced cap/flow quality tier |

---

## 11. Decisions (confirmed 2026-10-06)

1. **Platform**: web app (Three.js / React Three Fiber).
2. **Audience**: **both** a teaching tool (students and lecturers) **and** an AgriTech product. Implications:
   - Guided tours and exam mode are first-class features, not extras. Every module ships with at least one tour.
   - Product polish: landing page, consistent design system, brand-neutral (no manufacturer logos), credits/sources page, accessibility (keyboard navigation, reduced motion, colour-blind-safe flow colours), mobile layout, PWA offline.
   - Public hosting (static build on Vercel / Netlify / GitHub Pages). Share links deep-link to a scene, camera and cut-plane state.
   - Content strings live in content files, so the app is i18n-ready; English ships first.
3. **Visual style**: technical-realistic. PBR metals and rubber, with engineering hatching on section caps.
4. **Scope**: **all modules (M1–M12)**, built in roadmap phase order. The foundation comes first because every module depends on it.
5. **Hosting**: public link (follows from 2).

---

## 12. Progress

### Phase 0: foundations and vertical slice ✅ (2026-10-06)

**Built**
- **App scaffold:** Vite 8, React 19, TypeScript, R3F 9, Tailwind 4. The browser opens the engine scene from the landing page.
- **Section caps:** single-pass back-face caps with per-material hatching (`src/render/materials.ts`). Housings are sectioned; moving parts stay whole unless "section everything" is on. Supports multi-plane quarter cuts, presets and a plane slider.
- **Part registry** (`src/render/Part.tsx`): click to inspect, info card with citations, isolate, hide, explode, X-ray and labels.
- **Drive-graph solver** (`src/core/drive.ts`): gears, belts, couplings, brakes, differential, planetary and Hooke's joint, with coasting when a clutch is released.
- **Shared tools:**
  - sim clock with slow motion (1/200× to 1×);
  - flow particles;
  - live charts (uPlot) with a state marker;
  - KaTeX "show working" panel;
  - guided-tour player;
  - errata and sources page.
- **Geometry and workers:**
  - generators: lathe, pipe, spring, involute gears (spur, helical, ring), cams from lift curves, CSG;
  - all generators tested watertight;
  - CSG is built in a **web worker** (`src/geometry/build.ts`).
- **Slice: four-stroke diesel cutaway** (`src/modules/engine/four-stroke`):
  - 100 × 124 mm engine, about 40 parts;
  - valve train driven from the cam profile;
  - live P–V and T–s plots for the Otto, Diesel and Dual cycles;
  - compression ratio changes the deck clearance;
  - exam presets, valve-timing wheel and a 9-step tour.

**Verified**
- 48 tests pass, covering the physics fixtures from the notes, the drive graph and geometry watertightness.
- Production build succeeds: about 380 KB gzipped initially, plus 160 KB for the scene.
- Checked in the browser at desktop (1600×900) and phone (375×812) sizes.

**Found while building:** a further note error was added to errata. Misc. Ex 9 uses Cv = 0.778 instead of 0.718, which inflates its mep.

**Next: Phase 1, the remaining M1 engine scenes.** In order: two-stroke; multi-cylinder and firing order; lubrication; cooling; diesel fuel system; carburettor; air cleaner and governor; ignition; performance calculator.

### Scene build — paused 2026-10-07 at 25 / 69 live

- Built by parallel builder agents following `docs/SCENE_GUIDE.md`, then reviewed in the browser by the lead.
- **Shared assets added in this phase:**
  - tractor: `src/tractor/`;
  - soil heightfield: `src/render/soil.ts`;
  - part generators: `src/geometry/parts.ts`;
  - physics for clutch, hydraulics, transmission, drives, joints, pumps and tyres.
- **Live:**
  - all M1 engine scenes except lubrication, cooling and performance;
  - all M2 power-train scenes except powershift;
  - M3 Hooke's / double cardan / CV joints;
  - M4 pumps and cylinder;
  - M5 steering boxes;
  - M9 belts and chains.
- **Partial:** engine/lubrication, engine/performance, powertrain/powershift, elements/gears, traction/tracks.
- **Wave 2 (the 25 tractor-based scenes) not started.**

### All 66 scenes built (2026-10-08)

- tsc is clean, 1042/1042 tests pass, and the production build succeeds.
- **Next:** the polish pass in `docs/QA.md`, plus visual QA of every scene in the browser.
