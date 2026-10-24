<!-- Inventory of course notes produced by a research agent on 2026-10-09; source files under C:/Users/USER/Documents/School/500L -->

## AEE505 (Farm Structures and Environmental Control Engineering, Dr. O. A. Omotosho, OAU Ile-Ife): inventory for the 3D simulation

**How I read the sources.** Both PDFs have a text layer, so I extracted them with pdftotext. I also rendered the two figure pages to PNG with pypdfium2. They are in `scratchpad\aee505img\` as `l8.png` (zone diagram) and `a6.png` (assignment layout render).

**Source abbreviations.**
- **LN**: `Hammattan\AEE505\AEE 505 Lecture note 2 new.pdf`, 31 pages. Printed page numbers match PDF pages.
- **Ass**: `AEE505 Ass.pdf` / `.docx`, 7 pages. This is the student's own assignment, "Proposed Layout of Farmhouse for Sen. Abdulahi" (Adeniyi Olaitan Lekan, AGE/2018/004, March 2025). It is a design exercise, not a question paper.

**Important coverage gap.** The course outline (LN p2) lists "5. Environmental needs for agricultural production: (a) environmental consideration for livestock production, (b) heat and moisture production in livestock and poultry". The note does not contain any of that material. Section 5.0 (LN p23–31) covers only the workshop, machinery storage, fuel/chemical/fertilizer storage and greenhouses. These topics also have **no text in LN**:
- livestock/poultry housing;
- psychrometrics;
- heat-balance equations;
- structural loads;
- grain storage and processing. It appears as heading 3c on p2, but there is no section for it.

The **only quantitative environmental-control content** is the greenhouse ventilation rate (LN p30). Equations in §2 that are marked **[SUPP]** are standard textbook relations (ASABE / FAO *Rural Structures in the Tropics*, which the note largely follows). They are given so the simulator can model what the syllabus promises. They are **not from the notes**, and the UI should label them as such.

---

## 1. Structures, layouts and systems

### 1.1 Farmstead: definition, scale and advantages (LN p3–4)

**Definition.** The farmstead is the central operational hub of the farm. It holds the dwelling, barns, silos, workshops, stores, roads, and sometimes renewable energy, water management and waste recycling.

**Planning goals.**
- Protect the environment from odours, dust, noise, flies and heavy traffic.
- The farmstead takes **≤ about 5 % of the production area** (p3).
- It may be fenced.
- "Planning" means the systematic arrangement of buildings. "Layout" means their spatial arrangement (p3).

**Advantages of farmstead planning (p4):**
1. time efficiency
2. labour productivity
3. cost reduction
4. resource utilisation
5. minimised downtime
6. safety
7. environmental impact

**Factors influencing layout design (p4–5):**
1. type of enterprise (livestock: barns, feeding, waste; crops: silos, irrigation, storage)
2. topography (flat or gently sloping is ideal)
3. climate and orientation
4. accessibility
5. soil type (sandy soil needs reinforcement)
6. future expansion
7. environmental and legal considerations

**3D idea.** A whole-farm overview with a field-area vs farmstead-area overlay. A gauge shows the farmstead as a percentage of the production area and warns when it goes above 5 %.

### 1.2 Land acquisition and site selection, Nigeria (LN p5–7)

There are 12 criteria (a–l):
- **a. Soil quality:** soil tests for nutrients, pH and texture. The Middle Belt has loamy soil. Avoid saline or poorly drained land.
- **b. Climate:** the humid South suits cassava, yam and oil palm. The semi-arid North suits millet, sorghum and groundnut.
- **c. Water availability:** rivers, boreholes, groundwater. Use water harvesting where rainfall is erratic.
- **d. Access and infrastructure:** roads, ports, markets.
- **e. Land ownership:** customary rights and the **Land Use Act 1978**. Verify titles and obtain permits.
- **f. Security:** theft and farmer–herder conflict. Use fencing and guards.
- **g. Labour supply.**
- **h. Topography and drainage:** steep slopes need terracing.
- **i. Environmental sustainability:** no deforestation or wetland encroachment.
- **j. Market demand and crop suitability.**
- **k. Utilities:** grid, solar, telecoms.
- **l. Future expansion potential.**

**3D idea.** A site-picker mini-game. Candidate parcels carry overlays (slope, soil pH, water table, road distance, flood plain, security) and the student scores each site against criteria a–l.

### 1.3 Types of farmstead (LN p8)

- **Concentrated** (most common and favoured): buildings are grouped around a court, the farmhouse or a special driveway. All operations sit close together.
- **Distributed:** buildings are widely separated, sometimes in remote parts of the farm. It suits large farms with unrelated enterprises.

**3D idea.** Toggle between the two arrangements of the same building set. Animate tractor travel paths and show total travel distance.

### 1.4 Zone planning (LN p8–9, figure p8)

**Geometry of the figure.** Concentric zones **10–30 m wide**. The circles are nested and all tangent at one point on the main road along the bottom edge. A wind arrow points "up". Zone 1 sits near the road on the upwind side, and zone 4 is at the far, downwind end.

**The zones:**
1. **Zone 1:** family living and dwelling, at the centre. Protect it from odour, dust, flies and erosion.
2. **Zone 2:** implement and machinery storage, farm workshop (clean, dry, quiet).
3. **Zone 3:** grain and feed storage, small animal units.
4. **Zone 4:** livestock buildings, plus large-scale animal production "and beyond".
5. **Zone 5:** farm access road and courtyard (central spine).

**Advantages and caveats.**
- Zone planning provides space for present operations and future expansion, and a good living environment.
- Caveat: in many African cultures livestock are traditionally kept at the centre, so the zone concept runs against tradition (p9).

**3D idea, a key scene.**
- Translucent concentric rings on terrain, each with a width slider (10–30 m).
- Drag-and-drop buildings into zones.
- A wind vector with an odour/dust particle plume coming from zone 4. It turns red if the plume reaches zone 1.

### 1.5 Layout factors (LN p9–10)

1. **Accessibility:**
   - (a) locational: use the public road, weighed against how often trips are made to town or market;
   - (b) to fields: divide fields so that no steps are retraced.
2. **Drainage:** surface and subsurface. A gentle slope helps. A pronounced slope means earthworks.
3. **Air movement:** needed for cross-ventilation, but excessive wind damages buildings. **Put livestock downwind** of the dwelling and the neighbours.
4. **Water supply:** reassess the volume when livestock numbers expand.
5. **Production type and volume:** doubling the animals does *more* than double the space needed, because feed storage doubles, machinery grows, traffic grows, and water and power need upgrading.
6. **Safety:** fire, theft, vandalism.
7. **Utilities:** telephone, electricity, feed delivery, transport.
8. **Off-farm factors:** codes for rural housing, subdivisions, building and zoning, pollution control, fire and insurance.

**Planning goals (p10), nine in total:**
1. new enterprise
2. expand livestock
3. improve labour efficiency
4. diversify (feed production, post-harvest processing and drying)
5. a better living area
6. more value for minimum investment
7. separate living from the enterprise
8. relocate facilities to improve traffic, safety, odour and fire risk
9. a supporting enterprise that uses labour, machinery or waste

### 1.6 Planning activity centres: process analysis (LN p11)

- For each operation, define **WHAT, SIZE and QUALITY**. This determines the structural needs.
- The standard of the farmstead depends on:
  - the type of business;
  - the size of each activity;
  - manual vs mechanised production;
  - the farmer's economic base;
  - the socio-cultural setting.

### 1.7 Family dwelling (LN p11–20): the largest section of the notes

**Design questions (p12):** family size, sleeping arrangements, cooking/eating, storage, resting/conversation.

**Special rural requirements (p12–13):**
- Well-drained site that also suits a well, a latrine, or a septic tank with a drainage field. **Never build on a flood plain.**
- View of the access road and the farmstead.
- **East–west orientation** for the most shading. Modify it to catch the prevailing wind, or for more sun in cool highlands.
- Build in stages.
- Flexible rooms.
- Large kitchen.
- Separate rear entrance to the kitchen, with a small rear veranda.
- Large veranda with mosquito netting.
- Office on large farms.
- Store for dirty clothes, with washing facilities.
- Guest room.

**Categories (Table 1, p14–15).** Each column is listed with: agricultural method · products for · income · dwelling at · design · materials · expected life span.

| Farmer type | Method | Products for | Income | Dwelling at | Design | Materials | Life span |
|---|---|---|---|---|---|---|---|
| Subsistence, village | traditional | self-consumption | nil–low | village | traditional | local only | 5–30 yr |
| Subsistence, single | traditional | self-consumption | nil–low | plot | traditional | local only | 5–30 yr |
| Emergent | traditional/modern | self-consumption + sale | low–medium | plot/farm | traditional/modern | mainly local, a few industrial | 30–50 yr |
| Commercial | modern | sale | medium–high | farm | modern | mainly industrial, few local | 50–150+ yr |

**Traditional plans (p14–15):**
- **Multi-purpose house, one room:** uses the least material and has good security (one door). There is no privacy, and it is a health hazard because people and animals share one room.
- **Multi-purpose house, several rooms:** uses more material, with good security and better privacy. Health is still poor (cooking, food, sleeping and animals under one roof).
- **Single-purpose houses, one room each:** uses the most material and security may be poor. Privacy is very good, the health hazard is minimal, and the layout is easy to expand.

**Contemporary plans (p16–17):**
- **External-access type:** every room opens to the outside. Security depends on many costly doors, and there are no internal links. That separation suits an extended family or a change of owner.
- **Courtyard type:** rooms open onto an enclosed yard, which improves security and privacy. **The assignment uses this type.**
- **Corridor type:** good security and privacy, but the corridor is dark and wastes space.
- **Central-room type:** the meeting or dining room gives access to the other rooms. Security is very good, but the central room must be big enough for both circulation and furniture.

**Table 2, improvements (p15–16):**

| Area | Subsistence | Emergent | Commercial |
|---|---|---|---|
| Layout | separate animal shelters from the dwelling; nearby water; windbreak trees; garden, pit latrine | allow for expansion; windbreak; garden, latrine | functional, flexible; future extension; carport |
| Design | improve the traditional design (minimum floor area and room height) | build in stages | functional design (consult an architect) |
| Construction | surface drainage, raised floor, strong foundation, efficient roof slope, good overhang | train the builders; experienced foreman | contractor |
| Materials | improve local materials (wood treatment, wall surface treatment) | improved materials such as soil-cement and fibre-reinforced roofing | well-tested materials used per the manufacturer's recommendations |

**Room and space standards (p17–20):**
- **Bedroom:** at least **9 m²**, with at least **3 m² per person**. Cross-ventilation and insect mesh.
- **Living/meeting room:** **12–15 m²**, or **25–30 m²** if elaborately furnished.
- **Cooking:** outside in warm humid areas, inside where nights are cold. The cooking area is raised and protected from sun, rain, dust and animals.
- **Storage:** store kerosene outside. Raise pots and containers off the floor. Use a separate store for bulk grain.
- **Washing:**
  - the outdoor washing slab is at least **3 m²**, with a shelter and workbench;
  - floors slope to a drain and a **soak-away**;
  - a flush toilet needs a **septic tank and drainage field**.
- **Office:** about **9 m²** on large farms. On small farms a dining table plus a cupboard is enough.
- **Entrances:** at least two, front (for visitors) and work (kitchen/utility). Use roof overhangs.
- **Improvements to existing houses (p19):**
  - separate the animals;
  - add a latrine;
  - provide nearby water;
  - use a mud stove;
  - raise the floor **10–15 cm** above the outside ground;
  - dig cut-off drains;
  - use a waterproof foundation.
- **Contemporary construction (p19–20):**
  - foundation of stone, brick masonry or concrete;
  - walls of adobe, mud-and-pole or stabilised soil blocks;
  - corrugated steel or thatch roof. **Thatch needs a slope of about 45°** and **eaves at least 2 m** above the ground;
  - insulated ceilings reduce the temperature extremes under corrugated roofs.

**3D idea.**
- A dwelling configurator: pick the plan type (7 options) and the tool generates rooms.
- It checks the m² rules (bedroom ≥ 9 m² and ≥ 3 m² per occupant, living room 12–15 m²).
- A sun-path slider shows shading for an E–W vs N–S orientation.
- Comparison panel for security (number of exterior doors), privacy and material use.

### 1.8 Drives and parking (LN p21–22; repeated in Ass p5–6)

**Site analysis.** Look at topography, drainage, soil, existing structures and traffic patterns. Separate heavy machinery, trucks and cars, and use one-way systems where space is limited.

**Dimensions (imperial in LN; Ass gives metric):**

| Item | Value |
|---|---|
| Two-way drive | **16–20 ft** (≈ 5–6 m) |
| One-way drive | **12 ft** (≈ 3.5–4 m) |
| Large-vehicle parking stall | **12 ft × 60 ft** (≈ 3.7 × 18.3 m) |
| Turning radius, farm equipment | **40–50 ft** (≈ 12–15 m) |

**Surfaces.** Gravel or crushed stone for low traffic and temporary parking. Concrete or asphalt for high-use areas.

**Other rules.**
- Grade the surfaces and drain them.
- Signage, lighting and markings.
- Clear sight lines and no sharp turns.
- Access for emergency vehicles.
- Avoid flood-prone spots.
- Maintenance: regrading and filling potholes.
- Permeable paving. Vegetated swales and buffers (Ass).

**3D idea.** Drive a tractor plus trailer through the yard. Width and turning-radius checks are drawn as a ghost swept path. Lanes are colour-coded by traffic class, and a stall-fit test is included.

### 1.9 Farm workshop (LN p23–25)

**Purpose.** Repair and maintenance, orderly tool storage, a spares store, and shelter for work in bad weather. It saves time when an operation is time-sensitive (planting, spraying, milking).

**Size.** It scales with the farm:
- a smallholder needs only a lockable tool cupboard plus a bench with a vice;
- a large farm needs a separate building.

**Siting.** Near the work centre and the house, on well-drained, level ground, close to the power supply.

**Tropical construction.**
- Pole structure with a non-flammable roof.
- Open sides (or heavy wire netting) for light and air. If enclosed, provide windows.
- Earth floor, or concrete (preferred: clean and level).

**Required features (i–viii):**
1. Room for the largest machine plus working space around it. Use a truss roof if no intermediate posts are wanted.
2. A door wide and high enough for that machine, plus a **second door** for fire escape.
3. Lifting gear: a **timber beam if the span is ≤ 3 m**, otherwise a truss or a portable hoist.
4. Lighting and power.
5. Water supply.
6. Extinguisher for fuel fires, or **2–3 buckets of dry sand**.
7. Lockable tool cabinets with hanging doors.
8. Workbench **1 m high, ≤ 800 mm deep, ≥ 3 m long**, with a large vice and windows above.

**Safety.** Keep the welder away from woodworking and near the main door. Keep sawdust and oily rags out. Store fuel separately.

**3D idea.** A workshop interior with the bench, vice, hoist on a beam or truss, extinguisher, sand buckets and two doors. Clearance check: drive a combine or tractor inside and show the clearance envelope.

### 1.10 Machinery and implement storage (LN p25–26)

- **Hand tools:** a dry, secure multipurpose store. Hang tools on rails or hooks to keep them off a damp earth floor.
- **Ploughs, harrows, cultivators:** can stay outdoors if cleaned and greased, especially threaded adjusters. A fenced compound is enough. Wooden parts are cheap to replace.
- **Tractors and complex machines:** store under cover after an off-season check-up.
  - Use a **narrow open-sided shed** with a well-drained, raised earth or gravel floor.
  - It must be as high as the tallest machine.
  - A smooth, level floor makes hitching easier.
  - Size the shed by sketching machine outlines on graph paper plus manoeuvring space. **Mark the posts**, and arrange the machines so none has to be shifted.
- **Fire resistance:** pole frame, earth floor, sheet-metal walls, timber trusses, and metal, asbestos-cement or sisal-cement roofing.
- **Combined building:** workshop at one end, machinery storage in the rest.

**3D idea.** An open-front machine shed with a post grid. A drag-to-pack puzzle places machine footprints (tractor, plough, harrow, trailer) and flags post collisions and blocked machines.

### 1.11 Fuel, chemical and fertilizer storage (LN p26–28)

**Hazardous classes:**
- fuels and oils (petrol, diesel, kerosene, lube oil);
- gases (butane, propane, acetylene; oxygen supports combustion);
- solvent paints and cellulose thinner;
- poisons (herbicides, insecticides, rat poison, dips);
- acids and alkalis (detergents, lye, quicklime CaO);
- veterinary medicines (some need refrigeration);
- wood preservatives.

**Rules.**
- Store hazardous materials apart from everything else. Keep flammables and poisons in separate rooms, and give each type its own shelf or room.
- **Separate-building thresholds:** more than **3 L cellulose thinner, 10 L petrol, 20 L kerosene or 50 L diesel** goes in a separate building **at least 15 m from any other building**. A pole frame with steel-netting walls is suitable.
- Ventilate at **high and low levels**, or use a netted door.
- Vermin-proof, lockable, with a warning sign.
- Washing facilities nearby.
- **No floor drain.** A concrete floor, lower walls and door sill form a **spill-containment bund**.

**Fertilizer and cement.** Both are hygroscopic.
- Keep bags intact.
- Stack them on a **raised platform** under a roof.
- Shade them from heat.
- Keep fertilizer away from machinery because it is corrosive.

**3D idea.** Place a fuel store at least 15 m from other buildings, with a distance ring. A cutaway shows the bund floor, high/low vents and the airflow, and a spill animation shows liquid contained by the sill.

### 1.12 Greenhouses (LN p28–31): the only environmental-control content

**Use.** For high-value crops, research and disease isolation. Limited use in the tropics. Glass suits year-round flowers. Polythene suits short seedling runs.

**Site.** Unshaded, near a road, nearly level, well drained, sheltered from strong wind but with normal air movement. Deep medium-textured loam. Clean water. Electricity for fans.

**Light.**
- Use slender load-bearing members. Multi-span gutters and heavy wide-span trusses cast shade, so use open trusses with narrow sections.
- Light colours and reflective surfaces help.
- Supplementary lighting for photoperiod-sensitive crops.

**Orientation.** In the tropics, run the **ridge north–south** to reduce frame shading. This applies to all frame types, including multi-span.

**Size.**
- Multi-span bays of **3.2 m** are cheapest. Wider spans give better light and are easier to manage.
- Cost is lowest when **length = 4–5 × span**.

**Height.**
- **Gutter 2.8–3.0 m** on multi-span houses, so machines can move.
- **Eave ≥ 2 m** on single-span houses.
- Higher houses ventilate better in still air but are harder to maintain.

**Frame materials.**
- Steel (galvanised *after* fabrication) for the main frame.
- Aluminium for glazing bars (corrosion-proof, bolted, not welded).
- Wood only if top-grade and preservative-treated.

**Cladding:**

| Cladding | Light transmission | Notes |
|---|---|---|
| Glass | **90 %** (most) | Most durable and costly. Panes 610 or 730 mm wide, 4 mm thick, "2.8 kg/m²" as printed (p30)*. Dirt, algae and etching reduce transmission over time. |
| Polythene | ≈ glass | Cheap, lighter frame. UV degrades it, so it needs periodic replacement. |
| FRP (fibreglass polyester) | **≈ 85 %** | More impact-resistant than glass and more durable than polythene. Reseal with acrylic every **4–5 yr**. Mid cost. |

\*4 mm glass at about 2500 kg/m³ is about 10 kg/m², so the printed 2.8 kg/m² is probably an error. Flag it in the UI and don't hard-code it as a fact.

**Ventilation (key numbers).**
- In the tropics, ventilation is the most important control. It lowers temperature, reduces humidity and resupplies CO₂.
- It can be natural (vents and doors) or mechanical (fans).
- The rate is given per m² of floor area:
  - glass house: **0.04–0.05 m³/s per m²**, to keep the heat rise **< 4 °C**;
  - polythene house: **0.03–0.04 m³/s per m²**, because polythene passes long-wave radiation back out.
- Large end doors totalling **3–7 % of floor area** often give enough natural ventilation.

**Cooling and shading.**
- Evaporative cooling (pad and fan) when ventilation is not enough.
- Whitewash on the inside of the roof for shading in steady weather. It is cheap and washes off.

**3D idea, a key environmental-control scene.**
- A multi-span greenhouse with N–S ridges and a sun arc showing frame shadows.
- Cladding selector (glass / polythene / FRP) changes the transmission and the required ventilation rate.
- Fan count and door opening are linked to a live interior temperature-rise readout (ΔT).
- Whitewash toggle.
- Evaporative pad with airflow particles.

### 1.13 Topics in the syllabus but missing from the note

These are outline headings only (LN p2): **grain storage and processing**, **environmental considerations for livestock**, and **heat and moisture production by livestock and poultry**. There is nothing on livestock/poultry housing, psychrometric charts, silos or dryers. If scenes are built for these, source them from FAO *Rural Structures in the Tropics* (Ch. 13–15) or the ASABE standards and label them **[SUPP]**:
- open-sided tropical poultry house;
- pig and cattle sheds;
- silo, crib and dryer.

---

## 2. Equations and quantitative data

### 2.1 From the notes (LN)

There are no algebraic equations in the note. The only computable rules are these:

| Rule | Value | Page |
|---|---|---|
| Farmstead area | ≤ about 5 % of production area | p3 |
| Zone width | 10–30 m per ring | p8 |
| Bedroom area | ≥ 9 m², and ≥ 3 m² × occupants | p17 |
| Living room | 12–15 m² (25–30 m² if elaborate) | p17 |
| Outdoor washing slab | ≥ 3 m² | p18 |
| Office | about 9 m² | p19 |
| Floor raise | 10–15 cm above ground | p19 |
| Thatch roof | slope about 45°, eaves ≥ 2 m | p20 |
| Drives | 16–20 ft two-way, 12 ft one-way | p21 |
| Parking stall | 12 × 60 ft; turning radius 40–50 ft | p22 |
| Workbench | 1 m H × ≤ 0.8 m D × ≥ 3 m L | p25 |
| Lifting beam | timber if span ≤ 3 m, else truss or hoist | p24 |
| Hazardous store | > 3 L thinner, 10 L petrol, 20 L kerosene or 50 L diesel → separate building ≥ 15 m away | p27 |
| Greenhouse bay | 3.2 m; L = 4–5 × span; gutter 2.8–3.0 m; eave ≥ 2 m | p29 |
| Greenhouse vent rate | glass 0.04–0.05, poly 0.03–0.04 m³/s per m² floor; ΔT < 4 °C | p30 |
| Door vent area | 3–7 % of floor area | p30 |
| Light transmission | glass 90 %, FRP 85 % | p30 |

**Worked example 1: greenhouse ventilation (from LN p30 data).**
- A glass house 9.6 m wide (3 × 3.2 m bays) × 43 m long (L ≈ 4.5 × span). Floor A = 413 m².
- Required airflow Q = 0.045 × 413 = **18.6 m³/s**.
  - Polythene version: 0.035 × 413 = 14.5 m³/s.
  - Fan sizing: with 2.5 m³/s fans, the glass house needs 8 fans (18.6/2.5 = 7.4, rounded up).
- Natural option: end-door area = 3–7 % × 413 = **12–29 m²**.
- Check the heat removed at ΔT = 4 °C: q = ρ·c_p·Q·ΔT = 1.2 × 1006 × 18.6 × 4 ≈ **90 kW** (≈ 217 W/m² of floor). This is plausible for tropical solar gain, so the note's rate is consistent. This check uses equation [SUPP-1].

**Worked example 2: drive and parking layout.**
- A two-way drive at 18 ft = 5.5 m.
- Three large-vehicle stalls side by side: 3 × 12 ft = 36 ft = 11 m wide, 60 ft = 18.3 m deep.
- Turning circle for the combine: radius 45 ft = 13.7 m, so a cleared turning pad about 27 m in diameter.

**Worked example 3: dwelling.**
- Family of 7 (Ass p3: parents, 3 boys, 2 girls).
- Boys' room for 3: max(9, 3 × 3) = 9 m² minimum.
- Girls' room for 2: max(9, 6) = 9 m².
- Living room 12–15 m².

### 2.2 [SUPP] Standard relations for the missing environmental-control topics (not in notes)

| # | Equation | Variables | Typical values |
|---|---|---|---|
| SUPP-1 | Sensible heat removed by ventilation: q_s = ρ·c_p·Q·(T_i − T_o) | ρ ≈ 1.2 kg/m³, c_p ≈ 1006 J/kg·K, Q in m³/s | used in Example 1 |
| SUPP-2 | Ventilation for heat: Q = q_s / (ρ·c_p·ΔT) | q_s = animal sensible heat + solar + equipment − conduction loss | — |
| SUPP-3 | Ventilation for moisture: Q = ṁ_w / (ρ·(W_i − W_o)) | ṁ_w = animal moisture production (kg/s); W = humidity ratio (kg water per kg dry air), read from the psychrometric chart | — |
| SUPP-4 | Building heat balance: q_animals + q_solar + q_equip = Σ U·A·ΔT + ρ·c_p·Q·ΔT | U = overall heat-transfer coefficient (W/m²K) | — |
| SUPP-5 | Humidity ratio: W = 0.622·p_v/(P − p_v), with RH = p_v/p_ws | P ≈ 101.3 kPa | — |
| SUPP-6 | Latent heat: q_L = ṁ_w·h_fg | h_fg ≈ 2430 kJ/kg | — |

**Animal heat production, order of magnitude only (source per ASABE EP270.5 / FAO tables). Verify before use:**
- laying hen (≈ 2 kg): about 10 W total heat;
- broiler at market weight: about 8–10 W;
- pig (≈ 100 kg finisher): about 250 W;
- dairy cow (≈ 500–600 kg): about 1000–1200 W.

The sensible share falls as the temperature rises, and more of the heat becomes latent (moisture).

---

## 3. Figures and scenes worth building in 3D, by priority

1. **Zone-planning diagram (LN p8):** nested tangent circles, wind arrow, road, zones 1–5. This is the course's signature figure. Build it as an interactive ring planner with an odour plume (§1.4).
2. **Farmstead courtyard-type dwelling (Ass p6 render):**
   - several gable-roofed single-storey wings around a central courtyard with a pool and landscaping;
   - linked by verandas;
   - roads and parking around the outside.

   Use it as the reference model for the dwelling scene.
3. **Seven dwelling plan types (LN p14–17):** the note describes them but the figures did not extract. Build each as a simple massing model with door-count, privacy and material meters.
4. **Greenhouse (LN p29–31):**
   - multi-span vs wide-span;
   - N–S ridge;
   - cladding choice;
   - ventilation particles and a ΔT readout;
   - whitewash shading.
5. **Workshop and machinery shed (LN p23–26):** open-sided pole shed with a post grid, the workbench spec, hoist on a beam or truss, and two doors.
6. **Hazardous store (LN p27):** 15 m separation ring, bund sill, high/low vents.
7. **Drives and parking (LN p21–22):** swept-path test for a tractor plus trailer.

---

## 4. Exam questions and priorities

There is no past paper among the files. The assignment (Ass) asked the student to **design and justify a farmhouse layout for a large (potentially polygamous) Nigerian family**. Its answer covered:
- the overall concept (courtyard type);
- key zones (living, sleeping at ≥ 9 m², kitchen/dining, storage, washing/sanitation with soak-away, veranda);
- nine design factors (family size, polygamy, culture, climate and ventilation, economic context, security, expansion, water and sanitation, farm supervision);
- construction materials (concrete or stabilised soil blocks, corrugated roofing, screed and tile floors, screened windows, PVC/GI pipes);
- the drives and parking design factors.

**Likely exam questions, ranked:**
1. Define farmstead, farmstead planning and farmstead layout. State the advantages of farmstead planning (LN p3–4).
2. Factors influencing layout design / factors for site selection in Nigeria (p4–7). Expect to list and explain 6–10 of them.
3. Concentrated vs distributed farmstead. **Sketch and explain zone planning** (zones 1–5, 10–30 m, wind direction, the cultural objection) (p8–9).
4. Layout factors: accessibility, drainage, air movement, water, production volume ("doubling animals…"), safety, utilities, off-farm codes (p9–10).
5. Farm dwelling:
   - special requirements of rural dwellings;
   - Tables 1 and 2;
   - pros and cons of the 3 traditional and 4 contemporary plan types;
   - room area standards.

   A design question in the style of the assignment is likely (p11–20).
6. Drives and parking guidelines with dimensions (p21–22).
7. Workshop: siting and the eight features. Machinery storage practice and fire resistance (p23–26).
8. Hazardous-materials storage rules and the 15 m / volume thresholds. Fertilizer and cement storage (p26–28).
9. Greenhouse design parameters (light, orientation, size, height, materials, ventilation rates, cooling, shading). A small ventilation-rate calculation is possible (p28–31).
10. Livestock environment and heat/moisture production are in the syllabus but not in the note. Prepare from **[SUPP]** sources in case the lecturer teaches them separately.
