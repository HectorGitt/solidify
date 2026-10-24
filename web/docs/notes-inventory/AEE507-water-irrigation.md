<!-- Inventory of course notes produced by a research agent on 2026-10-09; source files under C:/Users/USER/Documents/School/500L/Hammattan/AEE507 -->

## AEE507 (Soil & Water Conservation Engineering, D.A. Okunade / A.P. Adeboye, OAU Ile-Ife): inventory for the 3D simulation

**How I read the sources.** Nearly every PDF here is a scan with a garbled OCR layer, so pdftotext was only useful for the Study Guide and the sample papers. I rendered the other pages to PNG with PyMuPDF and read them visually. The PNGs are in `scratchpad\img\irr*.png`, `img\cs*.png` and `scratchpad\a507img\{wrd,vw,ce}*.png`. I extracted the slide XML text from the PPTX.

**Source abbreviations** (page = PDF page; the printed page number is given where it helps):
- **IPP**: `irrigation principle and practices(AEE 507).pdf`, typed handout "Unit 8: Irrigation Principles and Practices", 12 pp. p12 is Problem Set V/I (1995).
- **SG**: `Irrigation Principles and Practices STUDY GUIDE.pdf`, CASFS/UC Santa Cruz guide in US units, 14 pp.
- **WRD**: `water resource development (507).pdf`, "Unit 7: Water Resource Development", 11 pp. p10 is the handwritten-annotated Problem Set VI; p11 is a clean retype of it (2019).
- **VW**: `vegetated waterways (507).pdf`. Schwab et al., *Soil & Water Conservation Engineering*, Ch. 7 (book pp. 134–152), 10 two-page spreads.
- **CE**: `AEE 507 Conservation and the environment.pdf`. Schwab Ch. 1 (book pp. xiv–~16), 9 spreads. It is descriptive only.
- **WE**: `AEE 507 -WIND EROSION.pptx` (Adeboye), 26 slides.
- **CS-A**: `CamScanner 12-04-2024 09.12.pdf`, typed course text §1.0 Introduction (text pp. 3–6), 4 pp.
- **CS-B**: `CamScanner 12-13-2023 08.50.pdf`, typed course text §2.0 Water Erosion & Control (text pp. 7–16) plus Tutorial Problem Set 2, 11 pp.
- **S1**: `507 sample 1.pdf`, exam 2018/19 (26 Jul 2019). Answer Q1 plus any 3.
- **S2**: `507 sample 2.pdf`, exam 2017/18 (Aug 2018). Answer any 4.

**Not in any AEE507 file.** None of the following appear, so take them from other courses or standard texts and label them as such:
- Pump curves, pump power/head, or any pump selection.
- Canal or dam design, and weirs, flumes or flow measurement.
- Infiltration equations (Kostiakov, Horton, Philip).
- Sprinkler spacing or application-rate formulas.
- The wind erosion equation (WEQ).
- Terrace spacing formulas.
- Furrow advance/recession equations.

---

## 1. Systems, structures and processes to model

### 1.1 Irrigation purposes and scheduling (IPP p1, p5; SG p1–4)
- **Purposes (IPP p1):**
  1. Supply moisture.
  2. Insure against short droughts.
  3. Cool soil and air.
  4. Reduce frost hazard.
  5. Wash out or dilute salts.
  6. Reduce soil piping.
  7. Soften tillage pans and clods.
  8. Delay bud formation by evaporative cooling.
- **Objective (IPP p1):** keep soil-water and salt levels where growth is not limited, or maximise net return.
- **Time to irrigate (IPP p5):** set by crop water need, the water available, and root-zone storage capacity.
  - Use soil-moisture measurement or indicator plants.
  - Irrigate before growth is retarded.
- **Soil-water states (SG p4):** saturation → gravitational water drains → field capacity (100%) → 50% FC, the usual trigger → permanent wilting point.
  - Plant-available water = FC − PWP.
  - Tools: soil auger, tensiometer, gypsum blocks.
- **Sensitive crop stages (SG p2–3), in order:** flowering > yield formation > seedling > ripening.
- **3D idea: soil-column "bucket".** A root-zone column fills to FC, ET drains it, and the bar turns red at 50% depletion so the irrigation event refills it.
  - Show gravitational water percolating out below the roots.
  - Expose an ET slider driven by temperature, wind and humidity (SG p4: ET rises with temperature and wind, falls with humidity).

### 1.2 Surface irrigation (IPP p5–6)
- **Principle:** water is turned on at the high point and flows downslope, and the flow diminishes as it infiltrates.
- **Characteristics:**
  - Adaptable to nearly all soils and crops.
  - Flexible: a whole farm can be irrigated in 1–3 days within a 10–14-day interval.
  - Cheap, because power needs are low.
  - Needs land grading.
- **Wild flooding:** water released from field ditches with no levees. Used where water is abundant.
- **Controlled flooding (checks/basins):** large streams fill level plots surrounded by levees (ridges, bunds, dikes) to the desired depth, then the water infiltrates or drains.
  - **3D:** paddies filling and a ponded water plane dropping as it infiltrates.
- **Furrows:** small channels run down or across the slope; water seeps through the furrow bottom and sides.
  - Only ½ to ⅕ of the surface is wetted, which cuts evaporation.
  - **3D:** furrow cross-section with wetting bulbs spreading laterally and downward, and a wetting front advancing along the furrow.
- **Borders:** parallel earth ridges guide a sheet of water down the slope. Strips are 3–30 m wide and 100–800 m long.
  - **3D:** sheet flow advancing down the strip, then recession.
- **Head-to-tail infiltration gradient** (key for the efficiency equations, §2.2): penetration depth falls linearly from head to tail, e.g. 1.8 m to 1.2 m in the exam problem.
  - Show the root-zone line, the deep-percolation loss at the head and under-irrigation at the tail.

### 1.3 Trickle / drip (IPP p6–7, Fig. 1; SG p5–9)
- **Operation:** a low-pressure system. Emitters discharge 1–8 L/h at 0.15–2 atm (2–30 psi).
  - Laterals usually lie on the surface but can be buried.
  - Discharge depends on orifice size and pressure.
- **Fig. 1 layout:** water source (well) → control head (valve) → main line → manifold → plastic laterals → emitters.
- **Components (IPP p7):**
  1. Screen/filter, because small orifices plug.
  2. Fertiliser injector.
  3. Vacuum breaker / backflow valve to protect the source.
  4. Automatic control valve.
  5. Moisture sensors.
  6. Control head at the source: pump, filters, fertiliser tank, controllers, water meter, pressure regulators.
- **SG list:** in-line emitters, T-tape, header design, filtration, pressure regulation, flushing, fertigation.
- **Benefits:**
  - Good for young orchards, high-value crops, and saline water.
  - Little evaporation and less weed growth.
  - Works on uneven terrain.
  - Can be fully automated.
- **Drawbacks:** emitter clogging, and salt accumulates at the edge of the wetted zone.
- **3D:** cutaway of the control head with flow arrows, a drip line with a pulsing emitter, and an onion-shaped wetted bulb under each emitter.

### 1.4 Sprinkler systems (IPP p7–9, Fig. 2)
- **Parts:** pump unit, mainline, laterals, risers, sprinkler heads, quick couplers, control devices.
- **Advantages:**
  - Suits sandy or shallow soils and uneven slopes.
  - Needs no land grading.
  - Good control of light applications.
  - Can apply fertiliser.
- **Disadvantages:**
  - High initial cost.
  - Labour for portable systems.
  - High pumping power.
  - Affected by wind and high evaporation.
- **Classification** depends on whether heads run singly (gun, boom), in groups along a lateral, and how they are moved.

| Type | Mechanics for animation |
|---|---|
| Solid set | Portable aluminium laterals placed at the start of the season and left in place |
| Permanent | Buried mains and laterals; only the risers show |
| Hand-move lateral | Uncoupled and carried one length at a time; quick couplers |
| Side-roll / wheel-move | Lateral pipe is the axle of large wheels (up to 400 m long), rolled forward by a centre or end engine |
| Side-move with trail lines | Lateral carried on wheeled A-frames, with trailing lines behind |
| Tow-move | Lateral on skids or wheels, towed from the end |
| **Centre pivot** | One lateral anchored at a pivot, sweeping in a circle. Drive towers 25–75 m apart on wheels, tracks or skids. Lateral 61–795 m. Pipe slung on cables or A-frame trusses. Drives powered by water, oil hydraulics or electricity. Optional end gun (part circle). Handwritten note: about 50–54 ha irrigated when R ≈ 400 m |
| Travelling gun | High-capacity sprinkler on a chassis with a flexible hose (75–130 mm, up to 402 m long). Pulled along travel lanes by a cable winding onto a reel driven by a water turbine, water piston or engine |
| Travelling lateral (linear move) | Lateral moves in a straight line, fed by flexible hose or a ditch pump. Irrigates a rectangle including the corners; uniformity better than guns |

- **3D:** centre-pivot top view with a rotating lateral, towers that step-advance in a stop-go alignment, and an end gun sweeping the corners. Show a travelling gun reeling in.

### 1.5 Sub-irrigation (IPP p9–10)
- **(a) Water-table control:** an existing or created water table feeds the root zone by capillarity, supplied through open ditches, mole drains or tile drains.
  - Needs permeable topsoil over an impermeable layer or high water table, and good-quality water, since salts rise.
- **(b) Perforated pipes** buried about 10–20 cm deep (OCR uncertain). Used for row crops such as cotton.
- **Advantages:** low labour, fewer weed seeds, less evaporation, no surface disruption.
- **Disadvantages:** salinity hazard and high cost.
- **3D:** cross-section showing a water table rising from tile drains and capillary arrows into the roots.

### 1.6 Selecting an irrigation method (IPP p10–11; S1 Q5b, S2 Q4b exam)
1. Cost (system, land preparation, labour).
2. Labour availability.
3. Water availability and supply.
4. Water quality.
5. Reliability.
6. Crop and its value.
7. Energy type available (gravity may be enough).
8. Soil condition and degree of land preparation possible.
9. Topography and climate (wind).

**When to choose surface irrigation:** gentle uniform slopes, medium or fine soils, ample water, cheap labour.

**When to choose sprinkler irrigation:** sandy or shallow soils, undulating land, scarce water, light frequent applications.

**3D:** a "method chooser" that changes the scene by soil, slope and water.

### 1.7 Leaching / salinity (IPP p3)
- Salts come from surface or ground water and from irrigation water.
- Leaching means applying extra water beyond the crop's need. It requires drainage below the root zone.
- **3D:** salt-particle overlay in the soil column, flushed downward by the leaching fraction.

### 1.8 Water resource development (WRD p1–4)
**Four methods** (WRD p1; an exam question):
1. Eliminating losses in storage, conveyance and application, e.g. lining canals.
2. Controlling phreatophytes (water-loving plants on the capillary fringe) by chemical or mechanical means, or by channelisation.
3. Suppressing evaporation:
   - Lower the surface-area/volume ratio of reservoirs.
   - Store water underground.
   - Spread monomolecular films (hexadecanol).
   - Water harvesting with sealants and ground covers.
4. Artificial groundwater recharge:
   - **Basin:** dikes along the contour, with water cascading from basin to basin.
   - **Furrow/ditch:** closely spaced parallel ditches.
   - **Flooding:** a thin water layer over the land.
   - **Pits/shafts:** municipal and industrial use.

**Water sources:** atmospheric moisture, surface water, subsurface water.

**Pond and reservoir types (WRD p2–3):**
1. **Dugout pond fed by groundwater.** Slope < 4% and water table within 1 m of the surface.
2. **On-stream pond.** Fed by runoff, a stream or a spring.
   - Either a scooped-out basin below a spring, or a dam across a valley.
   - Keep the pond surface below the spring outlet.
   - Divert surface water away to reduce sediment.
3. **Off-stream (by-pass) pond.** Sits beside a stream, with an intake pipe or channel. Controls exclude floodwater and sediment.

**Site requirements (WRD p3):**
1. Topography that keeps fill cheap.
2. A reliable, unpolluted supply.
3. Impervious soil for fill.
4. Mechanical and flood spillways.
5. A drain pipe on large ponds.
6. Safety.
7. Maintenance against waves, burrowing animals and livestock.

**Storage depends on (WRD p3–4):**
- Water needs (Table 1).
- Evaporation ≈ 0.7 × pan evaporation.
- Seepage.
- Sedimentation allowance.
- Carry-over.
- **Rule of thumb:** allow 40–60% of total storage for seepage, evaporation and other non-usable losses.

**3D:** farm pond cutaway showing the dam/embankment, principal spillway pipe, emergency spillway, drain pipe, sediment pool, a seepage line through the fill, and an evaporation arrow.

### 1.9 Groundwater, aquifers and wells (WRD p4–9; Figs. 1–4)
- **Fig. 1, earth's crust profile:**
  - **Zone of rock fracture,** split into:
    - **Unsaturated zone:** soil water 0–15 m, intermediate water, capillary fringe.
    - **Saturated zone:** groundwater (phreatic), 0–300 m.
  - **Zone of rock flowage:** internal, chemically combined water, from about 90 m to several miles down.
  - Also shown: perched water table on an impervious lens, confined water between confining strata, and a shallow and a deep well.
  - **3D:** layered geological cutaway with labelled zones; the user drops wells to different depths.
- **Table 2 (WRD p5), aquifer properties** (total porosity %, specific yield %, relative K):

  | Material | Porosity % | Specific yield % | Relative K |
  |---|---|---|---|
  | Dense limestone/shale | 5 | 2 | 1 |
  | Sandstone | 15 | 8 | 700 |
  | Gravel | 25 | 22 | 5000 |
  | Sand | 35 | 25 | 800 |
  | Clay | 45 | 3 | 1 |

  Gravel and sand are the good aquifers.
- **Well classes (WRD p5–6):**
  - **Gravity (unconfined):** penetrates the water table and is not under pressure. Shallow or deep. Springs and seeps form where an impervious stratum outcrops. Dugout ponds where the water table is near the surface.
  - **Artesian (confined):** the water level rises above the bottom of the confining bed. It is not necessarily a flowing well.
  - **Combination** of the two.
- **Artesian conditions (WRD p6, Fig. 2):**
  1. A pervious stratum with an intake (recharge) area.
  2. Impervious strata above and below.
  3. Inclined strata.
  4. A recharge source.
  5. No free outlet at a lower elevation.
  - **3D (Fig. 2):** tilted aquifer sandwich, a piezometric surface line sloping away from the intake hills, a flowing well where ground is below the piezometric surface and a pumped artesian well elsewhere.
- **Well hydraulics (WRD p6):**
  - Pumping lowers the level and forms an inverted cone of depression (apex = pumping level). The radius of influence R is where drawdown → 0.
  - **Well loss / seepage face:** the level just outside the casing is higher than inside.
  - **Fig. 3 (unconfined):** H, hw, hs, r, R, s1, s2, observation wells h1, h2, impervious base.
  - **Fig. 4 (confined):** aquifer thickness d, piezometric head H.
- **3D:** animated cone of depression growing to steady state as a pump-rate slider changes. Observation wells show drawdowns s1 and s2, with a well-loss step at the casing.
- **Table 3 (WRD p8), radius of influence:**

  | Formation | R (m) |
  |---|---|
  | Fine sand with clay and silt | 30–90 |
  | Fine–medium clean sand | 90–180 |
  | Coarse sand + fine gravel | 180–300 |
  | Coarse sand and gravel | 300–600 |

### 1.10 Water erosion processes (CS-B p1–4; CE p2–3; S2 Q3b)
- **Erosion is detachment plus transport.**
- **Factors:** climate, soil, vegetation, topography.
- **Vegetation reduces erosion by:**
  - Intercepting rain.
  - Slowing flow.
  - Physically restraining soil.
  - Aggregation through roots.
  - Biological activity.
  - Transpiration.
- **Forces:** attaching (holding) forces vs. detaching/transporting forces.
- **Types, in sequence:**
  1. **Raindrop splash.** KE–intensity relation, E in MJ/ha·mm (the formula is illegible in the scan).
  2. **Sheet.**
  3. **Interrill** (splash + sheet).
  4. **Rill** (concentrated flow in small channels).
  5. **Gully** (too large to remove by tillage; the advanced stage of rill).
  6. **Stream-channel/bank erosion:** bank collapse from flow over the side, or scour and undercutting below the water surface.
- **Fig 2.1 (CS-B p2), splash on (a) sloping land, (b) inclined rain, (c) vertical rain:** more soil goes downhill or downwind.
  - **3D:** droplets hitting a tilting soil plane, with splash-crown particles biased downslope and downwind. Sliders for slope and wind angle. Mulch blocks the splash.
- **Fig 2.2 (CS-B p3), texture vs detachability and transportability:**
  - Detachability rises from clay → silt → sand (coarser is easier to detach).
  - Transportability is highest for clay and lowest for sand.
  - Silt is the most erodible.
- **Erosivity vs erodibility (CS-B p4):** R = EI30 (storm KE × max 30-min intensity), summed per year.

### 1.11 Erosion control practices (CS-B p6–10; CE)
- **Grouped (CS-B p6) as:**
  - (i) Mechanical: contouring, terraces, waterways, strip cropping, tillage.
  - (ii) Agro-ecosystem (soil management: reconsolidation, organic matter, amendments).
  - (iii) Crop and vegetation management (rotations, cover crops, mulching, strip cropping).
- **Contouring:** tillage, planting and harvest done across the slope at near-constant elevation. Water ponds in the small depressions.
- **Terraces (CS-B p6–7):**
  - Broad channels and earth embankments across the slope intercept runoff and carry it to a protected outlet.
  - **Functions:** shorten slope length, stop gullies, settle sediment.
  - **Diversion terrace** sized like a channel (exam: Q = 0.85 m³/s, §2.5).
  - **3D:** hillside with terrace ridges and channels; runoff routed along the channel to a grassed outlet; slope-length reset per terrace interval.
- **Strip cropping:** alternating strips on the contour (water erosion) or normal to the wind (wind erosion).
- **Tillage table (CS-B p7–9):**
  - **Conventional:** mouldboard/disc plough + harrows.
  - **No-till:** narrow seedbed, residue kept, herbicide weed control.
  - **Strip tillage.**
  - **Ridge tillage:** with cross-ties, the "field-ridge" basins.
  - **Mulch tillage:** ≥ 30% residue cover.
  - **Reduced/minimum tillage.**
- **3D:** one field shown under each tillage mode with the residue-cover percentage visible.
- **Agronomic measures (CS-B p10):**
  - Cover crops: they can compete for moisture.
  - Mulching: simulates plant cover.
  - Strip cropping: dense strips trap sediment from tilled strips.
- **CE (Schwab Ch. 1), descriptive:**
  - Conservation ethics.
  - Fig. 1.1: interrill, rill and gully erosion with wind erosion in one field (a good reference photo for a combined erosion scene).
  - Fig. 1.2: US erosion map.
  - Drainage: polders.
  - Irrigation: Fig. 1.5, centre pivot.
  - Flood control: Fig. 1.8–1.9.
  - Water conservation: snow trapping (Fig. 1.11), plastic mulch (Fig. 1.12).
  - Environmental impact and land use (Fig. 1.13–1.14).

### 1.12 Vegetated (grassed) waterways (VW, book pp. 134–149)
- **Uses (book p134):** carry runoff from terraces, contour furrows, diversions, and emergency spillways of ponds without channel or gully erosion.
  - Example in the text: 1.4 m³/s for 30 m down a 5% slope releases energy at a rate of > 20 kW.
  - Not for continuous flows such as tile drain discharge, since prolonged wetness kills the grass.
- **Design approach:** reduce peak flow by field practices, then give the channel a stable lining (vegetation) and a shape and grade that keep velocity below the permissible value.
- **Design runoff:** 10-year return-period storm. Long channels are designed in reaches.
- **Shapes (book p135, Fig. 7.1):**
  - **Parabolic:** natural-like; best where flow is meandering.
  - **Trapezoidal:** blade-built; side slopes 4:1 or flatter for mowing and crossing; flat bottoms can meander and deposit sediment.
  - **Triangular:** V-bottom.
  - Under normal flow and deposition, trapezoidal and triangular sections become parabolic.
- **Vegetation (Table 7.1):** e.g. Kentucky bluegrass, tall fescue, Bermuda, brome, reed canary.
- **Permissible velocities (Table 7.2, m/s, erosion-resistant / easily eroded soil):**

  | Cover | Slope | Resistant | Easily eroded |
  |---|---|---|---|
  | Bermuda grass | 0–5% | 2.4 | 1.8 |
  | Bermuda grass | 5–10% | 2.1 | 1.5 |
  | Bermuda grass | >10% | 1.8 | 1.2 |
  | Bahia, buffalo grass, Kentucky bluegrass, smooth brome, blue grama, tall fescue | 0–5% | 2.1 | 1.5 |
  | Same group | 5–10% | 1.8 | 1.2 |
  | Same group | >10% | 1.5 | 0.9 |
  | Grass mixtures, reed canary | 0–5% | 1.5 | 1.2 |
  | Grass mixtures, reed canary | 5–10% | 1.2 | 0.9 |
  | Lespedeza, weeping lovegrass, redtop, alfalfa, red fescue | 0–5% | 1.0 | 0.8 |
  | Annuals: common lespedeza, Sudan grass | 0–5% | 1.0 | 0.8 |

- **Fig. 7.2:** velocity isovels in a grass-lined channel. The mean is about 0.8 m/s, but the velocity at the bed inside the grass is < 0.3 m/s.
  - **3D:** colour-mapped isovels over a grass-occupied boundary layer.
- **Fig. 7.3, Ree's n vs flow depth:**
  - Low flows: n ≈ 0.3–0.5 (grass upright).
  - Intermediate flows: grass bends; n drops sharply as it submerges.
  - High flows: grass fully submerged, n ≈ 0.03–0.04.
  - **3D:** grass blades that bend over and flatten as the flow-depth slider rises; n readout falls.
- **Retardance classes A–E (Table 7.3):** A = very high, e.g. reed canary 0.9 m tall; E = very low, e.g. cut Bermuda 0.04 m, burned stubble.
  - Fig. 7.4: n vs vR curves per class; for small channels n = 0.04 is common.
- **Two-condition design rule (Ex. 7.1):**
  - Size the bottom width for stability at minimum retardance (short, mowed grass → high v).
  - Size the depth for capacity at maximum retardance (long grass), then add freeboard (0.1 m).
- **Nomographs:** Figs. 7.5–7.7 (retardance B, C, D); Fig. 7.8 gives trapezoidal 4:1 dimensions.
- **Construction and maintenance (VW p7–9, book pp. 146–149):**
  - **Drainage:** a small concrete or asphalt channel (~0.2 m²) along the bottom, or a subsurface drain offset to one side.
  - **Shaping:** small waterways with farm equipment, large gullies with a bulldozer.
  - **Seedbed and seeding:** quick annuals plus perennials, sodding for high flows, and mulch or paper net (Fig. 7.9).
  - **Failure causes:** insufficient capacity, excessive velocity, poor cover from lanes or machinery, furrows not staggered at the edge.
  - **Maintenance:** mow and rake, fertilise, control rodents.
  - **Sediment:** watershed conservation, rank cover, high velocities.
  - **Large gullies:** control inflow with diversion terraces, slope the banks (1:1 for trees, 4:1 for a grassed waterway), natural or artificial revegetation.

### 1.13 Wind erosion (WE slides 4–25)
- **Definition (s4):** detachment, transport and deposition by wind. It occurs when wind force exceeds the soil's threshold.
- **Causes:** loose, fine, dry soil; a smooth bare surface; strong wind.
- **Cures:**
  - Compact or moisten the soil, or form stable clods.
  - Roughen the surface or add cover.
  - Reduce near-ground wind speed.
- **Initiation (s5–6):**
  - Wind is turbulent except in a thin laminar layer at the surface.
  - Velocity rises with the log of height, and this gradient sets the shear force.
  - **Fluid threshold velocity:** the minimum for direct wind lift. ≤ 5 m/s at 0.3 m height is non-erosive for mineral soils.
  - **Impact threshold:** the minimum to sustain movement through saltation impacts.
  - **Fig. 2 (s6):** small particles hide in the laminar layer, while larger particles protrude into the turbulent layer.
- **Processes (s7–10):**
  - **Detachment:** dry bare soil; a function of friction velocity and particle size.
  - **Transport:** > 93% occurs within 1 m of the surface.
    - **Suspension:** < 0.05 mm, carried by turbulence until rain or calm.
    - **Saltation:** 0.05–0.5 mm, short leaps; the key process that drives the other two.
    - **Surface creep:** 0.5–1 mm grains bumped along; about ⅓ of the movement. Grains > 1 mm stay as "desert pavement / lag gravel".
  - **Deposition:** gravity exceeds lift when wind slows at barriers, windbreaks, ditches or wet soil; rain also washes dust out.
- **Fig. 1 (s11), mechanics of wind erosion:**
  - **3D particle system** with three particle classes:
    - Fine dust plumes rising high.
    - Mid grains in ballistic hops (impact angle ~10–15°, standard physics) that kick other grains.
    - Coarse grains rolling.
  - Show a log wind profile drawn as an arrow fan, and a threshold gauge.
- **Factors (s12–17):**
  - **Climate:** speed, duration, direction, turbulence, shear velocity, rain, temperature, evaporation, humidity, freeze–thaw.
  - **Land surface:** slope, field length, width and orientation, roughness, non-erodibles, residue orientation.
  - **Land use and management.**
  - **Soil properties:** texture, aggregates, stability, water content, bulk density, crust, organic matter, CaCO₃.
  - **Erosivity** vs **erodibility.**
- **Control (s18–25):**
  - **Windbreaks / shelterbelts:** rows of trees, shrubs or tall grass. Figs. 2–3 show North Dakota and three-row windbreaks.
  - Vegetative cover and reduced fallow cultivation.
  - Reduced grazing.
  - Minimum tillage, with low speed and residue kept.
  - Strip cropping normal to the wind.
  - Soil stabilisers.
  - Roughening the surface and shortening the field.
  - **Residues:** standing stalks plus coarse flat residue work best; erosion falls in proportion to residue; residue raises the threshold velocity.
  - Perennial grasses.
  - **Conservation tillage:** no-till, stubble-mulch, cover crops.
- **3D:** shelterbelt cross-section with a wind-speed profile that drops in the lee zone and a deposition drift behind it. Toggle residue: standing vs flat vs bare.

---

## 2. Equations

### 2.1 Evapotranspiration / consumptive use (IPP p1–2)
| # | Name | Equation | Variables |
|---|---|---|---|
| 1 | Blaney–Criddle, USDA-SCS | ET = K_cs · K_t · N · P · (0.46T + 8.13) | ET in mm per period; K_cs = crop coefficient; K_t = 0.0311T + 0.24; N = days in period (10 ≤ N ≤ 31, monthly); P = mean daily % of annual daytime hours; T = mean daily temperature, °C. One-stage method (no reference ET) |
| 2 | Adjusted B–C (Fapohunda & Ude 1992) | ET = (1.49 − 0.01·RH) · K_cs · K_t · N · P · (0.46T + 8.13) | RH = relative humidity, % |
| 3 | B–C FAO (Doorenbos & Pruitt 1977) | ET_p = N[a_B + b_B · P(0.46T + 8.13)] | a_B = 0.0043·RH_min − n/N − 1.41. b_B = 0.81917 − 0.0040922·RH_min + 1.0705(n/N) + 0.065649·U_day − 0.005968·RH_min·(n/N) − 0.0005967·RH_min·U_day (partly illegible). RH_min = %; n/N = sunshine ratio; U_day = daytime wind at 2 m, m/s |
| 4 | Blaney–Morin Nigeria (Duru 1984) | ET_p = r_t (0.45T + 8)(520 − R^1.31)/100 | mm/day; r_t = monthly/annual radiation ratio; R = mean monthly RH, % |
| 5 | Jensen–Haise | ET_p = C_T (T − T_x) R_s | Langleys/day, for alfalfa. C_T = 1/(C₁ + 7.6·C_H); C_H = 50/(e₂ − e₁) in mb (saturated vapour pressure at mean max/min of the warmest month); C₁ = 38 − 2E/305 (E = elevation, m); T_x = −2.5 − 0.14(e₂ − e₁) − E/550; R_s = solar radiation, Langleys |
| 5a | Unit conversion | ET (mm/day) = ET (Ly/day) × 10/L | L = 595.9 − 0.55T cal/g. Saturated vapour pressure e° = 1.3329·exp(21.07 − 5336/(T + 273.1)), mb |

**Worked check (IPP p12, Problem 1).** Ile-Ife, July 1989, maize. T = 21.2 °C, RH 84%, Rs 549 Ly/day, Tmax 30.8, Tmin 15.6, monthly daylight % = 8.75, k = 1.06, elevation 540 m.
- **SCS:** K_t = 0.0311(21.2) + 0.24 = 0.899. f = 8.75 × (0.46 × 21.2 + 8.13) = 8.75 × 17.88 = 156.5.
- ET = 1.06 × 0.899 × 156.5 ≈ **149 mm/month ≈ 4.8 mm/day**. The monthly % already includes the N·P product.
- **Adjusted:** × (1.49 − 0.84) = 0.65 → **97 mm/month ≈ 3.1 mm/day**.

### 2.2 Irrigation requirement and efficiencies (IPP p3–5; SG)
| # | Name | Equation | Notes |
|---|---|---|---|
| 6 | Leaching requirement | LR = D_d/D_i = EC_i/EC_d | d = drainage water, i = irrigation water. Assumes adequate drainage, no rain leaching, no crop uptake of salt |
| 7 | Weighted EC with rain | EC_(r+i) = (D_r·EC_r + D_i·EC_i)/(D_r + D_i) | |
| 8 | General efficiency | E = (output/input) × 100 | |
| 9 | Conveyance | E_c = 100·W_d/W_i | W_d = delivered by the distribution system; W_i = introduced at the source |
| 10 | Application | E_a = 100·W_s/W_d | W_s = stored in the root zone; W_d = delivered to the field |
| 11 | Storage | E_s = 100·W_s/W_n | W_n = needed in the root zone before irrigation (deficit) |
| 12 | Water use | E_u = 100·W_u/W_d | W_u = beneficially used, including leaching. Crop water-use efficiency = Y/ET, kg/ha·cm |
| 13 | Distribution (Christiansen uniformity) | E_d = 100(1 − y/d); y = Σ\|x̄ − x_i\|/n | d = x̄ = mean depth stored; x_i = depth at point i |
| 14 | Consumptive use efficiency | E_cu = 100·W_cu/W_d | W_cu = normal consumptive use; W_d = net water depleted from the root zone, including deep percolation and evaporation |
| 15 | Irrigation requirement | IR = (ΣET − ΣR_e)/E_a | Season-long; the four-step procedure: ET → sum → minus effective rain → ÷ E_a |
| 16 | Root-zone deficit (exam form) | W_n = WHC (cm/m) × D_root × depletion fraction × area | e.g. 20 cm/m × 1.8 m × 0.6 |
| 17 | SG water budget | hours/week = ET volume ÷ system output (+10–20% for losses) | 1 acre-inch = 27,158 gal; 1 acre = 43,560 ft²; 1 ft³ = 7.48 gal; required flow = ET × 1.25 (75% E_a) × area ÷ pumping minutes |

**Worked examples:**
- **A. Efficiency problem** (S1 Q3c, S2 Q2c, IPP p12 #5). 175 L/s diverted, 105 L/s delivered, 2 ha, 8 h, root zone 1.8 m, runoff 50 L/s for 3 h, penetration linear 1.8 → 1.2 m, WHC 20 cm/m, irrigate at 60% depletion (exam) or 50% (1995 set).
  - E_c = 105/175 = **60%**.
  - W_d = 0.105 × 28,800 = 3024 m³; runoff = 0.05 × 10,800 = 540 m³.
  - W_s = 2484 m³ (no deep percolation, since the maximum depth equals the root zone), so E_a = **82.1%**.
  - W_n = 0.20 × 1.8 × 0.6 × 20,000 = 4320 m³, so E_s = **57.5%**. At 50% depletion: 3600 m³ → 69%.
  - For a linear depth profile y = range/4 = 0.15 and x̄ = 1.5, so E_d = **90%**.
- **B. Auger problem** (S1 Q5d; IPP p12 #4). Root depth 1.10 m. Depths 0.82, 0.98, 1.10, 1.22, 1.07, 0.90, 0.85, 1.10 (the 1995 version has 0.62 first).
  - x̄ = 1.005; Σ|dev| = 0.94; y = 0.1175, so E_d = **88.3%**.
  - Stored within the root zone (cap at 1.10) gives a mean of 0.99, so E_s = 0.99/1.10 = **90%**.
- **C. IPP p12 #2.** 76 mm applied; top 0.6 m goes from 18% to 24% (dry weight); ρ_d = 1201 kg/m³.
  - Stored = 0.06 × 1.201 × 600 mm = 43.2 mm, so E_a = **56.9%**.
- **D. IPP p12 #3.** 0.085 m³/s for 2 h = 612 m³; runoff 0.042 m³/s for 1 h = 151 m³; depth 1.68 → 1.0 m; root zone 1.68 m.
  - E_a = **75.3%**.
  - E_d = 1 − 0.17/1.34 = **87.3%**.
- **E. SG Exercises 1–6:**

  | Ex. | Setup | Result |
  |---|---|---|
  | 1 | Drip, 1 acre: ET 0.15 in/day → 28,516 gal/week; T-tape 0.74 gpm/100 ft, 14,520 row-ft/acre | 6446 gal/h → **4.4 h/week** in 2–3 sets |
  | 2 | Sprinkler: 1/8" nozzle at 45 psi = 3 gpm; 20 × 20 ft spacing → 109 heads | 19,800 gal/h → **1.4 h/week** (1.6–1.7 h with +10–20%) |
  | 3 | 100 ft² bed: 62.3 gal/week; 150 emitters × 0.334 gal/h = 50.1 gal/h | **1.25 h/week** |
  | 5 | 10 acres, ET 0.30 in/day, 75% E_a, 12 h/day | **141 gpm** (70 gpm at 24 h) |
  | 6 | 15 gpm well, ET 0.20 in/day | **1.6 acres** (3.2 at 24 h) |

### 2.3 Farm pond storage (WRD p3, Table 1)
- **Water needs (ha-m/yr):**
  - Household: 0.01 per person.
  - Fire protection: 0.03.
  - Dry cow/steer (450 kg): 0.002.
  - Milk cow including milkhouse: 0.004.
  - Horse: 0.0014.
  - Turkeys: 0.0017 per 100.
  - Chickens: 0.001 per 100.
  - Swine (45 kg): 0.0002.
  - Sheep: 0.0002.
  - Orchard spray: 0.0002 per application.
  - Irrigation: humid 0.3–0.45 m/season; arid 0.3–1.5 m/season (exam uses 0.7 m, semi-arid).
- **Storage formula:** Storage = Σneeds/(1 − loss fraction). Some answers use Σneeds × (1 + loss); say which convention you use.

**Worked examples:**
- **S1 Q5c.** 1000 steers, 500 cows, 100 hogs, 10,000 chickens, 10 ha vegetables, 10 persons, fire, 20% loss.
  - Needs: 2.0 + 2.0 + 0.02 + 0.1 + 7.0 + 0.1 + 0.03 = 11.25 ha-m.
  - Storage = **14.06 ha-m** (÷ 0.8).
- **S2 Q5c.** Same herd, 5 ha, 8 persons: 7.73 ha-m → **9.66 ha-m**.
- **WRD p10–11 PS VI 1b.** 9.87 ha-m with 60% loss leaves 3.948 ha-m usable; ÷ 0.61 m = **6.47 ha**.

### 2.4 Groundwater and well hydraulics (WRD p4–9)
| # | Name | Equation | Variables |
|---|---|---|---|
| 18 | Specific yield | S_y = 100·W_y/V | W_y = drained water volume; V = gross soil volume |
| 19 | Darcy | Q = K·i·a; i = (h₁ − h₂)/l | K in m/day |
| 20 | Radial flow, unconfined | Q = 2πrh·K·dh/dr → h·dh = Q/(2πK)·dr/r | |
| 21 | Dupuit–Thiem, unconfined (gravity) well | **Q = πK(H² − h_w²)/ln(R/r_w)** | H = original saturated thickness above the impervious base; h_w = water depth in the well; R = radius of influence; r_w = well radius. A derivation "from first principles" was asked in S1 Q4c |
| 21a | With seepage face | Same, but with h_s (depth just outside the casing) in place of h_w | Well loss = h_s − h_w |
| 22 | Two observation wells (unconfined) | Q = πK(h₂² − h₁²)/ln(r₂/r₁); h_i = H − s_i | Gives K; T = K·H (transmissibility, m²/day) |
| 23 | Radial flow, confined | Q = 2πrdK·dh/dr | |
| 24 | Confined (artesian) well | **Q = 2πKd(H − h_w)/ln(R/r_w)** | d = aquifer thickness |
| 25 | Confined, two piezometers | Q = 2πT(s₁ − s₂)/ln(r₂/r₁); T = K·d | |

**Thiem assumptions:** infinite areal extent; homogeneous, isotropic, uniform thickness; full penetration with horizontal flow; steady state (Darcy holds).

**Worked examples:**
- **S1 Q3d / WRD PS VI 3a.** r_w = 0.305 m; H = 24.38 m; drawdown 9.14 → h_w = 15.24 m; K = 76 mm/h = 1.824 m/day; R = 183 m.
  - Q = π(1.824)(594.4 − 232.3)/ln(600) = **324 m³/day ≈ 3.75 L/s**.
- **S1 Q2d.** H = 10 m; K = 0.05 m/s; r_w = 0.10 m; s = 4 m → h_w = 6 m; R = 300 m.
  - Q = π(0.05)(64)/ln 3000 = **1.256 m³/s**.
  - With r_w = 0.20 m: Q = **1.375 m³/s**, only +9.5%. The lesson: well radius matters little.
  - The tutorial version uses K = 0.005 m/s, which gives a tenth of these values.
- **S1 Q4d / S2 Q4d.** Q = 1000 L/min = 1440 m³/day; r₁ = 14 m, s₁ = 2.62 m; r₂ = 40 m, s₂ = 1.50 m; H = 18 m.
  - h₁ = 15.38 m and h₂ = 16.50 m, so K = 1440·ln(40/14)/[π(272.25 − 236.54)] = **13.5 m/day** and T = **243 m²/day**.
  - Drawdown in the pumped well (r_w = 0.15 m): h_w² = 236.54 − 1440·ln(14/0.15)/(π·13.47) = 82.2, so h_w = 9.07 m and **s_w ≈ 8.9 m**.
- **WRD PS VI 2a.** Q for r_w = 0.19 m, H = 15 m, s = 6 m, K = 21 m/day, R = 180 m.
  - Q = π·21·(225 − 81)/ln(947) = **1385 m³/day**.

### 2.5 Open-channel / waterway design (VW Fig. 7.1, Eq. 7.1–7.2; S1 Q2b, S2 Q3a)
- **Manning:** v = R^(2/3)·s^(1/2)/n, with R = a/p.
- **Continuity:** q = a·v.

**Fig. 7.1 cross-section geometry** (Z = horizontal:vertical side slope; d = flow depth; D = design depth = d + freeboard; t = top width at d; T = top width at D):

| Shape | Area a | Wetted perimeter p | R | Top width |
|---|---|---|---|---|
| Trapezoidal | bd + Zd² | b + 2d√(Z² + 1) | (bd + Zd²)/(b + 2d√(Z² + 1)) | t = b + 2Zd; T = b + 2ZD |
| Triangular | Zd² | 2d√(Z² + 1) | Zd/(2√(Z² + 1)) ≈ d/2 | t = 2Zd; T = tD/d |
| Parabolic | (2/3)td | t + 8d²/(3t) | t²d/(1.5t² + 4d²) ≈ 2d/3 | t = 1.5a/d; T = t(D/d)^½ |

**Proof asked in the exam (a = bd + Zd², p = b + 2d√(Z² + 1)):** the trapezoid is a rectangle bd plus two triangles of ½·d·Zd each. Each sloping side has length √(d² + (Zd)²) = d√(1 + Z²).

**Design procedure (Ex. 7.1, 7.2):**
1. Take v_perm from Table 7.2.
2. a = Q/v.
3. R from Manning, R = (vn/√s)^1.5, or from the retardance nomograph (Figs. 7.5–7.7).
4. Solve for b and d. For trapezoidal: p = a/R, b = p − 2d√(Z² + 1), then solve (p − 2d√(Z² + 1))d + Zd² = a, a quadratic in d; take the root with b > 0.
5. Check capacity at high retardance (add the Table 7.4 depth increment: e.g. 0.12–0.17 m for D → B; 0.03 m for C → B).
6. Add 0.1 m freeboard.
7. Compute t and T.

**Textbook worked examples:**
- **Ex. 7.1.** 5 m³/s; s = 3%; Bermuda; Z = 4.
  - v = 2.4 m/s → R = 0.31 m and a = 2.08 m², so **b = 4 m, d = 0.4 m**.
  - Long-grass (class B) check: d = 0.5 m, a = 3 m², R = 0.37 m, v = 1.7 m/s, q = 5.1 m³/s ✓.
  - SCS program result: b = 4.3 m, d = 0.57 m, D = 0.67 m, T = 9.3 m.
- **Ex. 7.2, parabolic, same Q.**
  - d = 1.5R = 0.46 m; t = 3a/2d = 6.78 m; d = 0.46 + 0.15 = 0.61 m; D = 0.71 m; T = 6.78(0.71/0.46)^½ = 8.42 m.
  - Refined: d = 0.57 m, R = 0.38 m, v = 1.75 m/s, t = 7.54 m, q = 5.01 m³/s.

**Exam solutions** (computed by Manning only, Z = 4, freeboard 0.1 m):
- **S1 Q2b / S2 Q2b.** Q = 5.67 m³/s; s = 3%; v_max = 1.75 m/s; n = 0.055.
  - a = 3.24 m², R = 0.414 m, p = 7.82 m.
  - 4.246d² − 7.822d + 3.24 = 0, so d = 0.629 m.
  - **b = 2.64 m, d = 0.63 m, D = 0.73 m, t = 7.67 m, T = 8.47 m.**
- **S2 Q5d.** Q = 7.26 m³/s; v_max = 1.15 m/s.
  - a = 6.31 m², R = 0.221 m, p = 28.6 m.
  - **d = 0.23 m, b = 26.7 m, D = 0.33 m, t = 28.6 m, T = 29.4 m.** The result is a very wide, shallow channel, which is a teaching point.
- **Diversion terrace (S1 Q1c, S2 Q1c, VW Prob 7.8).** Q = 0.85 m³/s; v = 0.9 m/s; b = 2.44 m; Z = 4; n = 0.046.
  - a = 0.944 m²; 4d² + 2.44d − 0.944 = 0, so **d = 0.269 m and D = 0.369 m**.
  - p = 4.66 m and R = 0.203 m, so **s = (vn/R^(2/3))² = 1.44%**.
- **S1 Q2c.** a = 2.55 m², d = 0.4 m, s = 3.5%, n = 0.04.
  - Trapezoidal (Z = 4 assumed): b = 4.78 m, R = 0.316 m, **v = 2.17 m/s**.
  - Parabolic: t = 9.56 m, R = 0.265 m, **v = 1.93 m/s**.
- **S2 Q3d / VW Prob 7.1.** a = 1.86 m², d = 0.3 m, s = 4%, n = 0.04.
  - Parabolic: R = 0.199 m, **v = 1.71 m/s**.
  - Triangular: Z = 20.7, R = 0.150 m, **v = 1.41 m/s**.
  - Trapezoidal 4:1: b = 5.0 m, R = 0.249 m, **v = 1.98 m/s**.

**Roughness:** n depends on vR and retardance class (Fig. 7.4; the approximate fitted curve is printed on the figure, Temple 1980). Use n ≈ 0.04 for small channels.

### 2.6 Soil loss: USLE (CS-B p4–6)
| # | Factor | Equation / values |
|---|---|---|
| 26 | USLE | **A = R·K·L·S·C·P**, with A in Mg/ha/yr |
| 27 | R | EI30: storm KE × maximum 30-min intensity, summed over the year. The KE equation (E in MJ/ha·mm vs I in mm/h) is illegible in the scan; the standard SI Wischmeier form is E = 0.119 + 0.0873 log₁₀ I, which is *not from the notes* |
| 28 | K | K = 2.8×10⁻⁷ M^1.14 (12 − a) + 4.3×10⁻³ (b − 2) + 3.3×10⁻³ (c − 3). M = (%silt + %vfs)(100 − %clay); a = % organic matter; b = structure code 1–4; c = permeability class 1 (rapid) to 6 (very slow) |
| 29 | L | L = (l/22)^m |
| 30 | m | m = β/(1 + β), with β = (sinθ/0.0896)/[3(sinθ)^0.8 + 0.56] (printed as sinθ/(sinθ + 0.269(sinθ)^0.8 + 0.05)); θ = tan⁻¹(s/100). m is reduced (up to 50%) where rill erosion exceeds interrill |
| 31 | S | S = 3.0(sinθ)^0.8 + 0.56 for l < 4 m; 10.8 sinθ + 0.03 for l > 4 m and s < 9%; 16.8 sinθ − 0.50 for l > 4 m and s ≥ 9% |
| 31a | LS (exam hint, S2) | S = (0.43 + 0.30s + 0.043s²)/6.574 (s in %; the Wischmeier slope factor for 22 m) |
| 32 | C | Σ(soil-loss ratio for each crop stage × fraction of annual EI in that stage) |
| 33 | P | P = P_c × P_s × P_t. P_s: 1.0 contour only or alternating corn/grain; 0.75 for a 4-yr rotation with 2 yr row crop; 0.5 with 1 yr row crop. P_t: 1.0 no terraces; 0.2 graded sod outlets; 0.1 underground outlets. Exam hints: P_contour = 0.5, P_strip = 0.25, P_terrace = 0.10–0.12 |

**Worked examples:**
- **S2 Q1b / CS-B PS2 #4.** A₀ = 44.8 Mg/ha with P = 1 and C = 0.25, so RKLS = 179.2.
  - (i) Contour (P = 0.5) with C = 0.15 → **13.4 Mg/ha**.
  - (ii) Strip crop (0.25) → **6.7 Mg/ha**.
  - (iii) Terrace (0.12) → 3.2 Mg/ha, i.e. **−76%** vs contouring.
- **S1 Q1b.** R = 135; K = 0.47; slope 2.74/45.66 = 6.0% (θ = 3.43°); l = 45.66 m; C = 0.5; contour P = 0.5.
  - m = 0.433 → L = 1.37; S = 10.8(0.0599) + 0.03 = 0.677; LS = 0.93.
  - A = 135 × 0.47 × 0.93 × 0.5 × 0.5 = **14.7 Mg/ha**, which exceeds 6.72.
  - Strip cropping (P = 0.25) → 7.4 Mg/ha, still too high.
  - **Terracing (P = 0.10) → 2.9 Mg/ha ✓.**
  - If the S2 hint's LS form is used instead, the numbers shift; the conclusion holds.
- **CS-B PS2 #2.** K = 0.15, l = 91 m, s = 10%, C = 0.2, P = 1, R = 750; target 6.7 Mg/ha.
- **CS-B PS2 #3.** Terraced field: 6%, C = 0.2, K = 0.3, l = 183 m, terraces at 24 m. Loss at the terrace outlet, in the channel (contour factor), and with upslope ploughing.

### 2.7 Sediment movement
- Exam question: "SG 2.5, bed velocity 0.15 m/s; max particle size?" (S2 Q4c; CS-B PS2 #1).
- **The formula is not in any file read.** Standard texts use the "sixth-power law" or Schwab's bed-velocity relation; add one and label it external.

---

## 3. Figures worth reproducing in 3D (priority order)
1. **Cone of depression, unconfined vs confined well** (WRD Figs. 3–4, p6–8). Animated pumping, observation wells, R, h_w, seepage face; live Q readout from Eq. 21/24.
2. **Subsurface water zones and artesian system** (WRD Figs. 1–2, p5–6). Layered cutaway, perched table, flowing well, piezometric surface.
3. **Waterway cross-sections** (VW Fig. 7.1). Morph trapezoid → triangle → parabola with a, p, R and v computed live by Manning; freeboard band; grass bending with depth (Fig. 7.3) and isovels (Fig. 7.2).
4. **Furrow/border field with head–tail infiltration profile** (IPP p6; efficiency problems). Visualise W_d, runoff, deep percolation, root-zone deficit, and E_a, E_s, E_d gauges.
5. **Centre pivot plus travelling gun** (IPP p9 Fig. 2). Pivot tower kinematics, end gun, corner coverage.
6. **Drip system layout and wetted bulb** (IPP p6 Fig. 1). Control head (filter, injector, backflow valve), manifold, laterals, emitters.
7. **Raindrop splash on slope and wind** (CS-B p2 Fig. 2.1), plus the erosion sequence sheet → rill → gully (CE Fig. 1.1).
8. **Wind erosion mechanics** (WE s6, s11). Saltation, suspension and creep particles; log wind profile; threshold; windbreak lee zone (s20–21).
9. **Terraced hillside with grassed outlet** (CS-B p6–7). Slope-length reset; USLE A recomputed as P and terraces toggle.
10. **Farm pond types** (WRD p2–3). Dugout vs on-stream vs off-stream, with spillways and a storage budget bar.
11. **Detachability/transportability vs texture** (CS-B p3 Fig. 2.2), as an interactive chart beside a particle demo.

---

## 4. Exam priorities (S1 = 2018/19, S2 = 2017/18; both by D.A. Okunade; plus the tutorial sets)
Questions repeat almost verbatim across years.

| Topic | Frequency | Typical question |
|---|---|---|
| Irrigation efficiencies (E_c, E_a, E_s, E_d) | **Both papers + 1995 set** | The 175/105 L/s, 2 ha, 8 h, 1.8→1.2 m problem; the auger-depth E_d/E_s problem |
| Trapezoidal grassed waterway design (b, d, D, t, T) | **Both papers** | 5.67 or 7.26 m³/s, 3%, 4:1, v 1.75/1.15, n 0.055 |
| Diversion terrace (d, D, slope) | **Both papers, Q1** | 0.85 m³/s, 0.9 m/s, b 2.44 m, n 0.046 |
| Proof a = bd + Zd², p = b + 2d√(Z² + 1) | **Both** | Geometry derivation |
| Velocity in parabolic/triangular/trapezoidal channels | **Both** | Same area and depth; compare v |
| USLE soil loss + choose a conservation practice | **Both, Q1** | P-factor switching; contour vs strip vs terrace |
| Well discharge (gravity well, radius doubling) | **Both** | Dupuit–Thiem; r_w = 10 → 20 cm |
| Aquifer properties from 2 observation wells, drawdown in the well | **Both** | 1000 L/min, 14/40 m, 2.62/1.50 m, 18 m |
| Derive the unconfined well equation from first principles | S1 | Darcy + radial integration |
| Farm pond storage capacity | **Both** | Table 1 needs + 20% loss |
| Why control erosion; 5 control methods | **Both, Q1a** | Descriptive |
| Purposes/objectives of irrigation; improving performance | **Both** | IPP p1 |
| Criteria for selecting an irrigation system; surface vs sprinkler | **Both** | IPP p10–11 |
| Uses/functions of vegetated waterways + design parameters | **Both** | VW p1: Q (10-yr), v_perm, n/retardance, shape, slope, freeboard, vegetation |
| Four methods of water resource development | S1 | WRD p1 |
| Stream-bank erosion + sediment movement modes | **Both** | Suspension, saltation, bed load / creep |
| Raindrop erosion sketch (slope, wind) | S2 | CS-B Fig. 2.1 |
| Confined vs unconfined aquifer | S2 | WRD p5–6 |
| Maximum particle size moved (SG 2.5, 0.15 m/s) | S2 + PS2 | Formula missing from the notes |
| ET by Blaney–Criddle / Jensen–Haise | 1995 set | IPP p12 #1 |

**Format:** 2½ h. S1: Q1 compulsory plus any 3. S2: any 4.

**Wind erosion (PPTX) does not appear in either sample paper.** Those papers predate the 2025 slides, so treat wind erosion as a new descriptive topic: processes, the three transport modes with size ranges, factors, and controls.

---

## Gaps in the notes
- **Pumps:** no pump curves, pump power/head, or pump selection. Use AEE510/hydraulics or standard texts, labelled "external".
- **Structures and measurement:** no design material for canals, dams, weirs, flumes or Parshall flumes. Ponds and spillways are described only qualitatively (WRD p3).
- **Infiltration and sprinklers:** no infiltration models, sprinkler spacing or application-rate formulas, or Christiansen-type catch-can tests. The only sprinkler numbers are SG's 20 × 20 ft spacing and 3 gpm nozzle.
- **Wind erosion:** no WEQ (E = f(IKCLV)) and no windbreak protection-distance rule.
- **Terraces:** no terrace spacing formula (VI = Xs + Y).
- **Scan legibility:** the rainfall KE–intensity equation (CS-B p2) and part of the FAO B–C b-coefficient (IPP p2) are illegible.
- **Sediment:** the sediment-size formula is missing.
- **IPP p7–8 and p10–11:** these scans are poor; content was taken from the partial OCR plus visual checks of p9.
