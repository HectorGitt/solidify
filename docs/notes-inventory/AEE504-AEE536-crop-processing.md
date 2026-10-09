<!-- Inventory of course notes produced by a research agent on 2026-10-09; source files under C:/Users/USER/Documents/School/500L/Rain/AEE504 and /AEE536 -->

## Inventory of the AEE504 (crop processing / handling) and AEE536 (food preservation and packaging) notes

**How I read the files**
- I extracted every `.docx` with python-docx. I pulled the OMML equations out of `word/document.xml` separately, because python-docx drops them.
- The `.doc` size-reduction note was a crude binary text pull. Its equations are Equation.3 OLE objects and cannot be recovered. I took the law forms from Fellows Ch. 4 and say so wherever I use them.
- I read the PDFs with pdftotext. The past-question PDF is scanned (6 pages), so I rendered it to PNG with pypdfium2 and viewed every page. The PNGs are in the scratchpad: `.../scratchpad/pq/pq_p1..6.png` and `pondo_image1.png`.
- I viewed all 7 jpgs.

Short names used below:
- **HAND** = `AEE504/AGE 504 Handling and planning new.docx`. It contains Note 3 "Materials Handling" and Note 4 "Factory Layout". It has no page numbers, so I cite sections.
- **RED** = `AEE504/AGE 504 note 2, reduction.doc` (Notes 2: Size Reduction, by Mrs Aregbesola).
- **SEP** = `AEE504/seperation 504.docx` (Note 1: Separation – cleaning, sorting and grading). Equations are numbered (1)–(18) in two series.
- **PONDO** = `AEE504/pondoyam flow chart.docx`. It holds a single embedded PNG.
- **RICE** = `AEE504/RICE 101.pdf` (USA Rice Federation "Rice Technical Information Kit", 18 pp.).
- **GSTD** = `AEE504/garri standards.pdf` (Codex STAN 151-1989, 3 pp.).
- **PQ** = `AEE504/AEE 504 past question.pdf`, 6 scanned pages:
  - p1–2: April 2015 exam (2013/14 session);
  - p3–4: March 2017 exam (2015/16 session);
  - p5: 2015/16 test;
  - p6: an undated exam.
- The AEE504 images:
  - **IMG-T23** = `IMG-20250531-WA0012.jpg`, the 2022/23 test;
  - **IMG-CPO** = `...22.22.27_22a3c597.jpg`, "Crude Palm Oil Milling Process" pictorial;
  - **IMG-GARRI** = `...22.22.28_06e55df2.jpg`, gari flow chart;
  - **IMG-POMB** = `...22.22.28_c83b592a.jpg`, palm oil mass-balance flow chart;
  - **IMG-WHEAT** = `...22.22.29_ca19ba9b.jpg`, "Wheat Flour Milling Process Flow diagram".
- **N536** = `AEE536/AEE 536 Notes New.docx`. Sections: 1 Spoilage; 2 Intro; 3A–E Methods; 4 Specific groups; "Useful Notes".
- **PRAC** = `AEE536/AEE 536 PRACTICAL.docx`.
- **PACK** = `AEE536/Packaging and Food Preservation.docx`.
- The AEE536 images:
  - **IMG-536a** = `IMG-20250531-WA0010.jpg`, the 2019/20 test;
  - **IMG-536b** = `IMG-20250531-WA0011.jpg`, the 2022/23 test.
- **FEL** = Fellows, *Food Processing Technology* 2e. I used it only for the Kick, Rittinger and Bond law forms (Ch. 4, eqs 4.1–4.3, Sample problem 4.1).

**Not covered anywhere in these notes (do not invent from them):**
- **Cassava machines:** no peeler, grater, press or garri fryer/roaster. Cassava appears only as flow-chart steps (IMG-GARRI, GSTD §2.1) and as hammer-mill "mash for garri" (PQ p1 Q2c, p3 Q3b).
- **Rice machines:** no huller, polisher or parboiler. There are only flow-chart blocks: RICE p9, plus the PQ p4 Q5 parboiled-rice question.
- **No drying-rate equations or dryer designs.** Drying appears only as process steps (pondo 70 °C for 10 h; rice dried to ≈12 % MC, RICE p9) and as traditional sun drying (N536 §3A).
- **No storage-structure dimensions** other than the yam barn (N536 "Yam Storage").
- **No irradiator, retort or pasteuriser hardware detail.**
- **No D/Z worked example** and no explicit Z equation.
- **No thermal-processing F0 calculations.** The Thermal-Processing PDF was skipped as instructed.

---

### 1. Machines, processes and equipment

#### 1A. Conveyors and handling (HAND Note 3)
Objectives of handling systems (HAND Note 3, list 1–7):
- eliminate unnecessary handling;
- keep flow continuous;
- handle large amounts at a time;
- use free-flow properties;
- cause no damage;
- use unit loads and bulk handling;
- make automation easier.

The seven device classes are belt, chain, screw, bucket, pneumatic, gravity, and cranes/trucks/carts.

**Belt conveyor** (HAND "Belt conveyors")
- **Parts:**
  - an endless belt between two end pulleys (one of them the drive pulley);
  - idlers supporting the load. The belt is flat for bags, or troughed/V for bulk;
  - a drive mechanism;
  - loading and discharge devices. Loading is by hopper with gate valve, manual, flight system, or from a screw or other conveyor;
  - a supporting idler table.
- **Belting:** stitched canvas, solid woven, stitched rubber, plain canvas, rubber.
- **Motion:** the belt translates and the load sits still on the belt, with no relative motion, which is why there is little damage.
- **Speed:** grain ≤3.5 m/s; recommended 2.5–2.8 m/s.
- **Limits:** limited elevation angle. High efficiency because of antifriction bearings.
- **Cutaway:** a troughed cross-section showing the trough angle, surcharge area As above line AB, surcharge angle α and clear margin M.

**Chain conveyor** (HAND "Chain conveyors")
- **Chain types:**
  - malleable detachable and steel detachable (light/intermittent duty);
  - pintle (medium);
  - roller (rolling contact, less friction);
  - combination (heavy).
- **Conveyor types:**
  1. plain chain;
  2. pusher (attachments push the load);
  3. carrier;
  4. slat (two or more strands with wood or metal slats);
  5. apron (on 2–3 strands; carries lime, sand, coal, palm kernels, sugar cane);
  6. scraper-flight;
  7. trolley (an overhead I-beam track with chained trolleys, for meat, fruit and crates).
- **Sprockets:** ≥12 teeth, or 6–8 teeth only at low speed where space is limited. Too few teeth give jerky motion and wear.
- **Speed:** 23 m/min (large granules) to 38 m/min (small granules).
- **Character:** noisy, slow and inefficient compared with a belt, but simple to design.

**Screw / auger conveyor** (HAND "Screw or Auger conveyor")
- **Parts:** helical flight on a shaft (diameter d) in a trough/housing, screw diameter D, pitch p.
- **Screw types:**
  - standard pitch (horizontal);
  - ⅓ or ½ pitch (inclined/vertical, uniform feed);
  - cut/paddle screw (mixing);
  - ribbon flight, with a gap between flight and shaft (sticky/viscous materials).
- **Use:** horizontal or inclines up to 20°, for powders and damp, sticky, hot or chemically active materials.
- **Capacity:** actual capacity is 30–50 % of theoretical, because of housing clearance, material flow characteristics, length and lift.
- **Cutaway:** flight helix and the clearance gap; a ribbon variant with an open centre.

**Bucket elevator** (HAND "Bucket elevators")
- **Head assembly:** head shaft, sprocket, bearings, drive assembly, supporting structure, buckets, chain, casing.
- **Foot (boot):** foot shaft, sprocket, bearings, structure.
- **Intermediate section:** casing, buckets and chains.
- **Four discharge types:**
  1. **Centrifugal:** high speed; buckets scoop from the boot and throw the material over the head sprocket. For fine loose material and palm fruits.
  2. **Positive (perfect):** slow; buckets are fully inverted over the spout by a pair of wheels. For sticky or cohesive material.
  3. **Continuous:** 30–38 m/min. Buckets are adjacent with flat fronts and projecting sides; each bucket acts as a chute for the next. About 2× the capacity of the positive type and gentle on fragile material.
  4. **Super-capacity:** extra-long buckets end-hung between two chains.
- **Belt or chain:** usually a single detachable chain.
- **Animation:** the bucket path around the head pulley, with the discharge trajectory changing by type.

**Pneumatic conveyor** (HAND "Pneumatic conveyor")
- **Parts:** fan/blower, duct system, cyclone collector.
- **Pressure classes:**
  - **Low pressure:** below 35 cm water; high-velocity, low-density air. It can be:
    - **positive** (fan at the head; one point to many points);
    - **negative/suction** (fan at the tail; many points to one point).
  - **High pressure:** positive-displacement blower; low-velocity, dense air.
- **Air velocity:** about 1500 m/min for most farm jobs.
- **Pros:** self-cleaning, any routing, one moving part, low cost.
- **Cons:** choking, high power, particle impact damage.
- **Static-pressure losses:** duct friction, elbows, entrance, cyclone, material.

**Gravity conveyor:** rollers or wheels on an incline, for boxes and lugs. **Cranes:** stacking. **Lift and carrying trucks and carts:** for intermittent flow of bags, bales and boxes. (All from HAND.)

**Comparison table** (HAND, table 0). Columns: material, capacity, power, cost, damage, distance, technical requirement, advantages, disadvantages.

| Conveyor | Typical materials | Capacity | Power | Cost | Damage | Distance | Tech |
|---|---|---|---|---|---|---|---|
| Belt | grain, packages, yam tubers, palm bunches | High | Low | High | Low | Long | High |
| Chain | feed, grain, wastes | Med | Med | Low/Med | High | Short | Low |
| Screw | ground, granular, chipped | Med | Low/Med | Med | High | Short | Low |
| Bucket | ground, granular, lump | Med | Low | Med/High | Med | Short | High |
| Pneumatic | grain, feed, chopped | Variable | High | Low/Med | Low/Med | Long | High |

#### 1B. Factory layout and planning (HAND Note 4)
- **Process-chart types:**
  - Operation Process Chart;
  - Flow Process Chart (includes transport, inspection, storage, delay, labour, times, distances);
  - Layout Diagram (a plan to scale showing flow direction).
- **ASME-type symbols:**
  - Operation О;
  - Transportation (arrow);
  - Inspection (square);
  - Storage (desirable interruption, triangle);
  - Delay (undesirable interruption, D).
- **Material-movement notations:**
  - material added before an operation;
  - material added during an operation;
  - material removed;
  - material divided;
  - optional routes.
- **Layout patterns:**
  - straight line;
  - serpentine/zig-zag;
  - U-shaped (finished product returns near the start);
  - circular (finished product at exactly the start point);
  - odd-angle.
- **Good-layout rules:**
  - minimise handling;
  - continuous flow that does not cross itself;
  - group like operations in rows;
  - keep aisles clear;
  - place the admin block at the first approach;
  - locate generator, borehole, tanks and transformer suitably;
  - leave room for expansion.
- **Planning steps 1–8:**
  1. activities and inputs;
  2. flow chart, noting noise, heat, dust, steam and water at each stage;
  3. equipment flow diagram with space and height;
  4. assignment to buildings;
  5. conveying modes;
  6. offices;
  7. site works (drainage, roads);
  8. utilities.

  Planning should ensure materials arrive on time, storage, handling and staff are sufficient, and equipment meets throughput (HAND Note 4, bullet list).
- **3D idea:** a factory-floor sandbox where the user drags machines into straight, U or serpentine layouts, with crossing-flow and aisle checks.

#### 1C. Size-reduction machines (RED)
- **Forces:** compression (for friable/crystalline foods), impact + shear (fibrous foods), shear (soft foods). The modes are:
  - **Cutting/slicing/dicing:** knife; large → medium → small → granular.
  - **Crushing/impact:** irregular fragments, e.g. nut cracking.
  - **Shearing:** sharp edge ≈ cutting; dull edge ≈ crushing.

  (RED "Definitions")
- **Equipment-applicability table** (RED Table 1; the matrix values were lost in extraction). It lists:
  - slicers, dicers, shredders, bowl choppers, pre-crushers;
  - hammer mills, fine impact mills, classifier mills, air-jet mills, ball mills;
  - disc mills, roller mills, pulpers.

  Product key: 1 = soft brittle, 2 = hard abrasive, 3 = elastic/tough/cuttable, 4 = fibrous, 5 = heat-sensitive/greasy. Fineness key: a = coarse lumps … d = fine to ultrafine.
- **Desired machine characteristics:** large capacity, low power per unit mass, controlled size and shape, uniform product, low cost, ease of operation.

**Hammer mill** (RED "Hammer Mills")
- **Parts:** central rotating shaft, a disc on the shaft, swinging hammers (beaters) pivoted at the disc edge, cylindrical casing, stainless-steel mesh screen around the rotor, feed hopper.
- **Motion:** 1500–4000 rpm. The hammers swing out radially under centrifugal force and beat the feed until it passes the screen.
- **Fineness control:** screen size, speed, feed rate.
- **Pros:** simple; versatile; not seriously damaged by foreign objects or by running empty; hammer wear does not cut efficiency much.
- **Cons:** non-uniform grind, high power.
- **Cutaway:** the rotor with pivoting hammers inside the screen ring, and particles exiting through the screen.
- **Course link:** PQ p1 Q2c (1.5 mm screen, cassava mash for garri) and p3 Q3b.

**Burr / plate (disc, attrition) mill** (RED "Burr mills or plate mills")
- **Parts:** two hard roughened metal plates (burrs), one stationary and one rotating; feed enters at the centre (eye); a gap-adjustment mechanism.
- **Motion:** 350–700 rpm. Crushing + shearing as material moves radially outward between the plates.
- **Fineness control:** plate type and plate gap.
- **Problems:** overfeeding cuts efficiency and overheats. Foreign objects break the plates, running empty wears the burrs, and worn burrs give poor results.
- **Pros:** low cost, fairly uniform product, low power.
- **Cutaway:** the plate gap with a radial particle path; a gap slider that changes the fineness modulus (PQ p1 Q3c: sorghum 4.3 mm at two gap settings).

**Roller mill** (RED "Roller mills")
- **Parts:** two or more steel rollers revolving towards each other, smooth or fluted (serrated), with a nip gap.
- **Motion:** counter-rotation; compression (pressing and squeezing).
- **Use:** very fine products.
- **Pros:** high capacity, uniform, durable, little attention needed.
- **Cons:** high initial cost and high technical requirement.
- **Course link:** PQ p6 Q2c (cassava flour from a roller mill) and Q3b (plate vs roller mills). IMG-WHEAT uses first-break rollers and reducing rollers.

**Sieve shaker for particle-size analysis** (RED "Methods of measuring size characteristics")
- A sieve stack with the largest aperture at the top and a blind pan at the bottom, plus a lid.
- Sample about 250 g dried, given a fixed vertical gyratory motion for about 5 min.
- IS sieve series 100, 70, 50, 40, 30, 20, 15 + pan, with openings 1.000, 0.708, 0.500, 0.420, 0.296, 0.211, 0.157 mm.
- **Size classes:**
  - dimension range ≥0.3125 cm, measured with micrometer, vernier or rule;
  - sieve range 0.00725–0.3125 cm (ground feed, fertilizer);
  - microscopic range below 0.00725 cm (cement, dust).
- **3D idea:** an animated shaker with per-sieve mass bars that feeds the FM and UI calculator.

#### 1D. Separation, cleaning, sorting and grading (SEP)
- **Definitions:**
  - **Cleaning:** removal of contaminants. It includes peeling, blanching, skinning and descaling.
  - **Sorting:** separation by a measurable physical property (size, shape, density, texture, colour).
  - **Grading:** assessment of overall quality on several attributes.

  (SEP "Definitions")
- **Grade factors:** physical, chemical and biological.
- **Contaminant table:** metals, mineral, plant, animal, chemical, microbial cells, microbial products (SEP Table 1, from Fellows).
- **Dry methods:** screening, brushing, aspiration, abrasion, magnetic separation. Cheap and leave the product dry, but create dust/explosion hazards (SEP "Dry cleaning methods").

**Dry-cleaning equipment**
- **Screens:** a perforated bed on a frame, fixed or variable aperture; fixed types are flat-bed or rotary drum. Overflow (retained) and underflow (passing). A set of screens gives n fractions.
- **Air classifiers / winnowers / aspirators:** feed falls into a controlled air stream and splits into light, middle and heavy streams. The clean product is the middle stream; stones and metal drop out; stalks, husks and hairs float off. This depends on the aerodynamic properties (shape, size, density, surface, orientation).
- **Magnetic separators:** product cascades over magnets in conveyor trunking, rotating or stationary magnetic drums, magnetised belts, overhead belt magnets, or staggered magnetised grids.
- **Others named:**
  - specific-gravity separator (density);
  - spiral separator (roundness, friction);
  - disc and cylinder separators (size, shape);
  - indented-cylinder separator (length);
  - centrifugal separators;
  - colour sorter (colour, brightness).

**Wet-cleaning equipment**
- **Soaking tank:** a pre-clean.
- **Water sprays:** low or high pressure.
- **Rotary drum washer:** the most common. Performance depends on speed, drum surface roughness and corrugation, and retention time; time is set by the drum pitch.
- **Rotating brushes:** fibre, rubber or sponge, sometimes in a water bath; remove spray residues and soil.
- **Shuffle/shaker washer:** vigorous reciprocation; tough jobs only, expensive.
- **Pros and cons:** wet methods are more effective for root crops, dustless and gentler, but carry effluent and spoilage risk with warm water.

  (SEP "Wet cleaning methods")

**Screening-efficiency factors** (SEP "The Screening Operation")
- hole size and shape;
- screen inclination;
- number of screens;
- air blast or none;
- mode of vibration: horizontal gyration, vertical gyration, gyrate-one-end/shake-other, shaking, eccentric mechanical vibrator, electric vibrator;
- feed rate;
- particle size (large blinding small);
- moisture (fines cling);
- worn screen;
- blinding/clogging;
- electrostatics.

**Cyclone separator** (SEP "Cyclone separator")
- Gas and material enter tangentially at the top and spiral down an outer helical vortex.
- Solids discharge at the bottom cone; gas leaves through the top centre via the inner vortex.
- Used with pneumatic conveyors and for dust and fly-ash removal.
- **Cutaway:** double helix, outer descending and inner ascending.

**Centrifuge** (SEP "Centrifugation")
- Separates immiscible liquids of different density (oil-palm clarification, cream from milk) and fine solids from liquid.
- Particles move radially and never reach terminal velocity.
- Course link: PQ p5 Q v; IMG-T23 Q c (device to hasten decanting of palm oil).

#### 1E. Palm oil mill, wheat mill and other plant flow sheets (images and PQ)
**Crude palm oil mill** (IMG-CPO pictorial; IMG-POMB mass balance; flow-chart questions in PQ p1 Q1, PQ p5, IMG-T23)

Fruit/oil line: FFB in (tipping truck / FFB cage) → sterilising (horizontal pressure cylinders) → threshing (rotary drum; stripped bunches out to fertiliser) → digesting (vertical digester) → pressing (screw press).

Two streams leave the press:
- **Oil:** → screening → settling/clarification tank → clear oil → purification (centrifugal purifier) → vacuum drying → CPO storage tank → truck/ship to the refinery.
  - Sludge → sludge settling → centrifuging → effluent treatment → land disposal.
- **Press cake:** → depericarping (fibre to the co-generation boiler, which supplies mill power and steam) → nut cracking → shells to the boiler; kernels → kernel drying → kernel crushing plant.

Mass balance per 1000 kg FFB (IMG-POMB):
- empty bunches 234 kg; fruits 666 kg;
- fibre 180 kg;
- total shell 73 kg (dry + wet);
- kernels 67 kg;
- sludge 180 kg;
- crude palm oil 225 kg.

Separation nodes in IMG-POMB: screening, clarification, desanding, separation, purification, nut/fibre separation, dry separation (dry shell), wet separation (hydrocyclone/clay bath, waste water).

Traditional route (IMG-T23): palm bunches → heaping → manual fruit removal → digestion by "matching" (treading) in a canoe → clarification by adding water and boiling in metal drums → decanting (water/oil) → drying → palm oil.

**Wheat flour mill** (IMG-WHEAT, 20 blocks)
1. storage bins
2. blending bins
3. separator (reciprocating screens)
4. aspirators (air currents)
5. disc separator
6. scourer
7. magnetic separator
8. washer/stoner
9. tempering
10. entoleter
11. first-break rollers
12. sifter
13. purifier
14. reducing rollers
15. sifters
16. bleaching
17. bulk storage
18. enriching
19. packaging
20. dispatch

This is an excellent "cleaning-house" chain for a 3D line.

**Other plant flow sheets referenced only as questions**
- animal feed mill (PQ p3 Q1, dust device at "point A");
- tomato paste factory (PQ p3 Q4: fruit → sorting → cleaning → chopping → thermal treatment → refining → concentration → thermal treatment → canning → thermal treatment → paste);
- frozen chicken, 250 birds/day (PQ p1 Q4).

#### 1F. Preservation equipment and processes (N536, PACK)
**Blanchers** (N536 §3B "Blanching")
- **Types:** steam blancher (saturated-steam tunnel) and hot-water blancher (bath).
- **Conditions:** 70–100 °C for about 2–3 min.
- **Steam blancher:** lower leaching, less effluent, easy to clean. But food needs separate washing, blanching is uneven if piled high, and some mass is lost.
- **Hot-water blancher:** cheaper and more energy-efficient, but has water and effluent costs, thermophile risk and leaching.
- **Additives:** Na₂CO₃ or CaO to keep chlorophyll; CaCl₂ to keep firmness (pectates); a salt dip against browning.

**Pasteuriser** (N536 "Pasteurisation")
- Below 100 °C. In low-acid foods (pH >4.5, milk) it targets pathogens and extends shelf life by days. In acid foods (pH <4.5) it gives weeks.
- **Equipment:** in-container, or for unpacked liquids, swept-surface or plate heat exchangers or open boiling pans. The product is then refrigerated.

**Steriliser / canning retort** (N536 "Sterilisation")
- Above 100 °C; shelf life over 6 months at ambient.
- Methods: in-pack, or sterilise-then-fill (aseptic).
- **Cold point:** the slowest-heating point in the container must reach and hold the sterilisation temperature. Sometimes the container is agitated.
- **3D idea:** a can cutaway with an isotherm animation converging on the cold point.
- Heat penetration depends on organism resistance, heating conditions and agitation, the container (type, size, shape) and the food state (conductivity, viscosity, pH).

**Refrigeration / cold store and freezer** (N536 §3C)
- **Chilling range:** 16 to −2.2 °C. Most foods begin freezing at about −2.2 °C.
- **Frozen storage:** ≤ −18 °C.
- **Cooling-load sources:**
  - product sensible and latent heat;
  - respiration;
  - wall, ceiling and floor gains;
  - door openings;
  - lights, fans, motors and people.
- **Freezer:** an air-blast "wind tunnel" in the worked example.
- **Freezing-curve stages** (N536 "Dynamics of Food Freezing"):
  - **AS:** super-cooling, up to 10 °C below the freezing point;
  - **SB:** jump to the freezing point;
  - **BC:** plateau as latent heat is removed and most ice forms;
  - **CD:** solute crystallises and the temperature rises to the eutectic;
  - **DE:** water and solutes keep crystallising (the freezing plateau tf);
  - **EF:** cooling to the freezer temperature.

  Fraction frozen at −20 °C: lamb 88 %, fish 91 %, egg albumin 93 %.
- **Pre-cooling methods** ("Useful Notes – Leafy vegetables"): room cooling with forced air, hydro-cooling (immersion or spray), package ice, vacuum cooling (below 30 min).
- **Chilling injury:** browning, failure to ripen, skin blemishes.

**Irradiation plant** (N536 §3D; no hardware described)
- γ-rays/electrons cause radiolysis of water to H·, OH·, HO₂· and H₂O₂.
- **Dose classes:**
  - radappertization 30–40 kGy;
  - radicidation 2.5–10 kGy;
  - radurization 0.75–2.5 kGy.
- **Dose table** (Table 3.3):
  - sprout inhibition 0.1–0.2 kGy;
  - disinfestation 0.1–2;
  - parasites 0.1–6;
  - chill-life extension and mould control 2–5;
  - pathogens 2.5–10;
  - packaging sterilisation 10–25;
  - herbs and spices 7–10.
- **Energy comparison** (Table 3.2, kJ/kg): refrigerated 17 760; frozen 46 600; canned 20 180; irradiated + refrigerated 17 860.
- **Safety limit:** a mean dose ≤10 kGy is safe (JECFI). Label "Treated by irradiation, do not irradiate again".

**Smokehouse** (N536 §3E "Woodsmoke")
- Hickory, oak, maple, beech, birch, walnut or mahogany wood, or corn cobs; sawdust is added for smudge.
- Meats at 43–71 °C for hours to days.
- Smoke has a disperse phase and a gas phase of over 200 compounds; formaldehyde is the most effective.
- Liquid smoke gives flavour only.

**Chemical preservatives** (N536 §3E, Table 3.4)
- benzoate 0.05–0.1 %, best at pH 2.5–4.0;
- sorbates up to 0.3 %;
- propionates (bread; up to pH 5–6);
- SO₂ up to 100 ppm in must and 500 ppm at bottling;
- nitrite about 50 µg/g;
- ethanol germicidal at 70–95 %;
- nisin;
- ethylene and propylene oxide fumigants.

**Yam barn and tuber storage** (N536 "Yam Storage"; very 3D-able)
- **Barn:** vertical wooden poles about 3 m high, often oil-palm frond midribs, spaced about 50 cm apart, braced by horizontal sticks and occasional stout legs dug into the ground. Tubers are tied to the poles with their long axis horizontal, one rope per pole. Palm fronds on top give shade.
- **Other methods:**
  - leaving the yam in the ground;
  - heaping on vines under a tree;
  - raised platform (Pacific; tubers not stacked on each other);
  - underground ditch (poor, with rodent damage);
  - cold room at about 15 °C, never below 10 °C (browning), with the AC run continuously to avoid condensation rot.
- **Loss sources:** rotting, pests, respiration, sprouting, dehydration.

**Grain storage** (N536 "Useful Notes")
- Structures: silos, bins, warehouses; bag vs bulk; triple-bag (hermetic) storage (outline §4b).
- About 30 % of stored grain is lost worldwide.
- **Agents:** insects (heat and moisture hot-spots), moulds (hyphae, toxins), moisture, temperature, rodents.
- **Good practice:**
  - clean and repair stores;
  - store at safe MC;
  - check temperature, RH, rodents and moisture regularly;
  - keep the natural protection (maize husk, rice as paddy);
  - aerate with intermittent fans.
- The factor tree (scientific vs socioeconomic) is drawn with "=====" arrows in the notes.

**Packaging** (PACK)
- **Functions:** containment, protection, communication, machinability, convenience.
- **Barrier requirements:** light, heat, moisture, gases, microbes, insects; mechanical strength against stacking, abrasion, puncture and vibration; cushioning such as egg cartons and pulp trays.
- **Materials:**
  - textiles/jute: poor barrier;
  - wood: barrels, good stacking;
  - metal cans: impermeable and tamper-proof, but heavy and costly;
  - glass: inert and transparent, but heavy and fragile;
  - flexible film: below 0.25 mm, heat-sealable, high-speed fill;
  - plastic containers;
  - paper;
  - combined systems.
- **Labelling:** date and batch, expiry/best-before, ingredients, NAFDAC number, manufacturer, destination, instructions, barcode/UPC; "IoT in packaging" is a heading only.
- **Packaging-line idea:** fill → seal → label/date-code → collate. PACK names "high speed filling, closing and collating" under machinability.
- **Dating terms** (N536 "Concept of Shelf life"): pack date, display date, sell-by, best-used-by, use-by/expiry. MAQ = Minimum Acceptable Quality.
- **Garri packaging** (GSTD §6): clean, sturdy, strongly sewn or sealed sacks.

---

### 2. Equations

#### 2A. Handling and conveyors (HAND Note 3)
| # | Equation | Variables / notes | Source |
|---|---|---|---|
| H1 | Capacity (m³/h) = A (m²) × v (m/min) × 60 | belt cross-section area × belt speed | HAND "Belt conveyors" |
| H2 | C = V(A + As) | A = load area, As = surcharge area above line AB, α = surcharge angle, M = clear margin | HAND "Design (preliminary)" |
| H3 | Vmax = 1.524 m/s (non-abrasive); 2.032 m/s for grain on a 35 cm belt | belt speed limits (the text also gives ≤3.5 m/s, 2.5–2.8 recommended) | HAND |
| H4 | P_belt = P_empty (friction) + P_horizontal (capacity × friction coefficient × speed) + P_lift | for belts up to 90 cm wide; add up to 20 % above that | HAND "Power to drive belt conveyors" |
| H5 | P_chain = 2VLW_c f + W(LF_c + H)V | L length, W material weight per unit length, W_c chain + flight weight per unit length, F_c material friction coefficient, f chain/runway friction coefficient, H lift, V speed. Add a safety factor and pick the chain from a table | HAND "Steps in determining the proper chain" |
| H6 | Volume/rev = π(D² − d²)p/4 | D screw diameter, d shaft diameter, p pitch. Actual = 30–50 % of this | HAND "Theoretical capacity" |
| H7 | P_screw = [π(D² − d²)/4]·p·ρ·n·L·F | n rpm, L length, ρ specific gravity, F material factor (from manual). × safety factor 1.25–2 | HAND "Power requirement" |
| H8 | P_bucket = Q·H, + 10–15 % | Q weight rate, H height | HAND "Bucket elevators" |
| H9 | Pipe area = Q/V; fan power P = Q·H/E | Q air flow, V about 1500 m/min, H total static pressure, E system efficiency | HAND "Pneumatic Systems Design" |

No worked examples are given for H1–H9.

#### 2B. Size reduction (RED, with FEL Ch. 4 for the law forms)
- **General law** (RED "Energy requirements"; the integral survives as OMML fragments in the .doc): dE/dL = −C/Lⁿ, so E = C∫dL/Lⁿ.
- **Kick** (n = 1): E = C_K ln(L₁/L₂). E is energy per unit mass of feed, L₁ the initial size, L₂ the final size (RED; FEL eq 4.1). Best for coarse grinding.
- **Size-reduction ratio:** RR = L₁/L₂. Coarse grinding is below 8:1; fine grinding can exceed 100:1 (RED).
- **Rittinger** (n = 2): E = C_R(1/L₂ − 1/L₁). Proportional to the new surface; assumes shearing. Best for fine grinding (RED; FEL eq 4.2).
- **Bond:** E = W_i(√(100/d₂) − √(100/d₁)), equivalent to RED's "E = 2C_B(1/√L₂ − 1/√L₁)". W_i is the Bond work index, 40 000–80 000 J/kg for hard foods (sugar, grain). d₁ and d₂ are the sieve apertures passing 80 % of feed and product (FEL eq 4.3).
  - RED garbles the exponent as "n = 1". The correct value is n = 1.5; flag this.
  - Bond is intermediate between Kick and Rittinger (RED).
- **Fineness modulus** (RED "fineness modulus method"):
  - FM = Σ(% retained on sieve i × multiplier)/100, with multipliers 7, 6, 5, 4, 3, 2, 1, 0 from the top sieve (100) to the pan.
  - **Worked (RED):** % retained 1.0, 2.5, 7.0, 24.0, 35.5, 22.5, 7.5, 0 → products 7, 15, 35, 96, 106.5, 45, 7.5, 0 → sum 312.0 → **FM = 3.12**.
- **Average particle size** (RED): D = 0.135(1.366)^FM. The text says "in cm" but appends "mm"; treat it as **mm**, the Indian-standard form. For FM 3.12, D ≈ 0.357 mm (computed).
- **Uniformity index** (RED): coarse = % on sieves 100 + 70 + 50; medium = 40 + 30; fine = 20 + 15 + pan. Divide each by 10 and round.
  - **Worked (RED):** 10.5 → 1; 59.5 → 6; 30.0 → 3, so **UI = 1:6:3**.
- **Differential sieve analysis** (RED): table columns are mesh no., opening, average opening d_pi, mass retained, mass fraction. Plot the cumulative fraction against opening and read d₈₀; the worked value read off the curve is d₈₀ = 1.13 mm.

**Worked: FEL Sample problem 4.1.** Food is milled from 6 mm to 0.0012 mm on a 10 hp motor (7457 W). Could it reach 0.0008 mm? With Rittinger: P₂/P₁ = (1/0.0008 − 1/6)/(1/0.0012 − 1/6) ≈ 1.5, so about 11.2 kW (15 hp) is needed. The motor is not adequate.

**Worked: PQ p6 Q3c (my solution).** Food 4.22 → 0.4 mm on a ½ hp motor (372.85 W); target 0.004 mm.
- Kick: P = 372.85 × ln(4.22/0.004)/ln(4.22/0.4) = 372.85 × 6.961/2.356 ≈ **1.10 kW**.
- Rittinger: P = 372.85 × (250 − 0.237)/(2.5 − 0.237) ≈ **41.2 kW**.
- Not adequate under either law.

**Worked: PQ p1 Q3c + Q5b (my solution).** Sorghum 4.3 mm in a burr mill at two gap settings. Mass retained (g) on sieves 70/50/40/30/20/15/pan:
- setting 1: 6.8 / 16.5 / 40.1 / 86.2 / 91.0 / 7.3 / 2.1 (sum 250 g);
- setting 2: 5.4 / 13.5 / 38.1 / 70.8 / 101.6 / 9.2 / 11.4 (sum 250 g).

Results:
- **Setting 1:** % = 2.72, 6.6, 16.04, 34.48, 36.4, 2.92, 0.84. FM = 292.6/100 = **2.93**; D = 0.135·1.366^2.93 = **0.337 mm**; UI 9.3 : 50.5 : 40.2, so **1:5:4**.
- **Setting 2:** FM = **2.71**; D = **0.314 mm**; UI 7.6 : 43.6 : 48.9, so **1:4:5**.
- **Q5b** (6.5 kW at setting 1, using D as product size):
  - Rittinger: P₂ = 6.5 × (1/0.314 − 1/4.3)/(1/0.337 − 1/4.3) ≈ **7.0 kW**.
  - Bond: P₂ = 6.5 × (0.314^−½ − 4.3^−½)/(0.337^−½ − 4.3^−½) ≈ **6.8 kW**.

**PQ p6 Q2c** (no solution in the source): roller-mill cassava flour, sieves 0.9275/4/8/14/28/48/100/pan retained 0.00 / 0.28 / 1.37 / 9.68 / 3.65 / 4.86 / 8.36 / 0.00. The task is to compute FM, average size and UI.

#### 2C. Separation (SEP)
**Screen mass balance**
- F = A + B (1)
- F·X_F = A·X_A + B·X_B (2)
- Mass ratios: B/F = (X_A − X_F)/(X_A − X_B) (3); A/F = (X_F − X_B)/(X_A − X_B) (4). The extracted text of (3) reads "X_A − X_B" in the numerator, which is a typo.
- Variables: X_F, X_A, X_B are the mass fractions of oversize (≥ D_pc) in the feed, overflow A and underflow B. D_pc is the cut diameter, taken as the mesh opening.
- An ideal screen separates sharply at D_pc.

**Screen effectiveness**
- E_A = A·X_A/(F·X_F) (5–6)
- E_B = B(1 − X_B)/[F(1 − X_F)] (7–8)
- E = E_A·E_B = (X_F − X_B)(X_A − X_F)X_A(1 − X_B) / [(X_A − X_B)²(1 − X_F)X_F] (9)
- Effectiveness falls as capacity rises.

**Worked: PQ p3 Q3b (my solution).** Cassava mash from a hammer mill. % retained on IS 50/30/20/15/pan:
- feed 16 / 59 / 18 / 4 / 3;
- overflow 61.5 / 34 / 3.5 / 1.0 / 0;
- underflow 3.0 / 58 / 23.2 / 7.8 / 8.0.

Results:
- **IS 30:** X_F = 0.75, X_A = 0.955, X_B = 0.61, so **E ≈ 0.48**.
- **IS 15:** X_F = 0.97, X_A = 1.00, X_B = 0.92, so **E ≈ 0.64**.

**Particle aerodynamics** (SEP "Aerodynamics of small particles", eqs 1–12)
- Force balance: M dv/dt = Mg(ρp − ρa)/ρp − CV²ρa·A/(2g). Specific-weight form.
- Drag: F = CV²ρa·A/2g (4).
- Terminal velocity: V = √[2Mg(ρp − ρa)/(C·ρp·ρa·A)] (8–9). This needs iteration because C depends on V.
- Reynolds number: Re = DVρa/µ (10).
- **Stokes regime** (Re < 0.1, C = 24/Re), with A = πr² and M = (4/3)πr³ρp/g:
  - V = 2gr²(ρp − ρa)/(9µ) = gD²(ρp − ρa)/(18µ) (11–12).
  - Terminal velocity depends on size, shape, both densities, viscosity and g.
- **Use:** aspirator and winnower air-speed design. A 3D column can set the air speed between the terminal velocities of chaff and grain.

**Cyclone** (SEP eqs 13–17)
- Centrifugal force C_f = WV²/(gR).
- Resultant F² = C_f² + W², so F = W√(V⁴/(g²R²) + 1).
- **Performance (separation) factor S = C_f/W = V²/(gR).**

**Centrifuge Stokes equation** (SEP eq 18)
- U = D_p²·rω²(ρp − ρf)/(18µ), with a = rω and ω = 2πN (N in rev/s).

**Worked: PQ p5 Q v** (data incomplete). Oil globules D = 50 µm, ρ_oil = 900, ρ_water = 1000 kg/m³, µ = 10⁻³ Pa·s.
- No r or N is given. Under gravity, V = gD²Δρ/(18µ) = 1.36×10⁻⁴ m/s (oil rises).
- Under centrifugation, multiply by rω²/g.

#### 2D. Preservation kinetics, refrigeration and freezing (N536)
**Microbial death kinetics** (N536 "Principles of thermal destruction", eqs 1.1–1.7)
- dN/dt = −kN (1.1)
- ln(N_i/N) = kt, so N = N_i·e^(−kt) (1.2)
- D-value: the time for a 90 % (1-log) reduction. N/N_i = 1/10 = e^(−kD) (1.3), so **D = 2.303/k** (1.4).
- **t = D·log(N_i/N)** (1.5). A plot of log N against t is a straight line ("logarithmic order of death").
- Arrhenius: k = A·e^(−E/RT) (1.6), with E in kJ/g-mol and T in K.
- ln(N_i/N) = A∫e^(−E/RT)dt (1.7)
- D_T notation, e.g. D₂₅₀.
- **Z-value**, verbal only: the degrees for the TDT curve to traverse one log cycle. Standard form, not in the notes: z = (T₂ − T₁)/log(D₁/D₂).
- **F-value:** the thermal death time at a stated temperature.
- **Factors affecting heat resistance:** time–temperature, initial load, history of cells/spores, food composition (moisture, pH, solutes).
- **Radiation D₁₀:** the dose for a 1-log reduction (N536 §3D). Parasites: Toxoplasma 0.25 kGy, Trichinella 0.3 kGy.

**Refrigeration ton** (N536 "Refrigeration load")
- 1 TR = 303.8×10³ kJ / (24×3600 s) = **3.516 kW**. This is latent heat for one ton of ice melting in 24 h.

**Product cooling load** (N536 eq (1))
- H = m[C_a·ΔT_a + h_l + C_b·ΔT_b]
- C_a and C_b are the specific heats above and below freezing, h_l the latent heat.
- **Worked (N536):** meat at 90 t/day, 2 → −12 °C, freezing point −1 °C, C_a = 3.2, h_l = 225, C_b = 1.63 kJ/kg·K.
  - H = (90 000/86 400)(3.2×3 + 225 + 1.63×11) = **263 kW**.
- **Heat of respiration** (N536 Table 3.1, J/kg per 24 h at 0 / 4.4 / 15.6 °C):

  | Product | 0 °C | 4.4 °C | 15.6 °C |
  |---|---|---|---|
  | Apples | 312–1560 | 625–2810 | 2390–8215 |
  | Oranges | 416–1040 | 1350–1665 | 3850–5405 |
  | Tomatoes (ripe) | 1040 | 1350 | 5820 |

  Other rows: cucumbers, melons, onions, potatoes, green tomatoes.
- **Assignment** (my numbers): 1 t oranges at 16 °C gives 1000 × (3850–5405)/86 400 ≈ 45–63 W. 500 kg ripe tomatoes at about 5 °C gives about 7.8 W.

**Plank freezing time** (N536 eq (2))
- t_f = [ρH_L/(T_f − T∞)]·[P′a/h_c + R′a²/k]
- Shape factors:
  - infinite slab P′ = 1/2, R′ = 1/8;
  - infinite cylinder P′ = 1/4, R′ = 1/16;
  - sphere P′ = 1/6, R′ = 1/24.
- **Worked (N536):** a 7 cm sphere in an air-blast tunnel. Initial 10 °C, air −15 °C, T_f = −1.25 °C, ρ = 1000 kg/m³, H_L = 250 kJ/kg, k = 1.2 W/m·K, h_c = 50 W/m²·K.
  - t_f = (1000×250/13.75)(0.07/(6×50) + 0.07²/(24×1.2)) = **7.335×10³ s ≈ 2.04 h**.
- **Packaged form** (N536 eq (3)): t_f = [ρH_L/(T_f − T∞)]·[P′a(1/h_c + x/k₁) + R′a²/k₂]. x is the package thickness, k₁ the package conductivity, k₂ the frozen-zone conductivity.
- **Factors affecting freezing rate:** k, area, distance, ΔT, boundary film, packaging.
- **Plank assumptions:** single freezing point, sensible heat ignored, constant properties, freezing front similar to the product shape, etc.

**Water properties** (N536): cp 4200 J/kg·K; latent heat of crystallisation 335 kJ/kg.

**Radiation units** (N536 "Units of Radiation")
- roentgen: 2.08×10⁹ ion pairs per cm³ of air;
- eV = 1.6×10⁻¹⁹ J; 32.5 eV per ion pair;
- rad = 10⁻⁵ J/g;
- Gy = 1 J/kg = 10² rad.

#### 2E. Standards and specification numbers
- **Garri (GSTD §3.3 and Annex):**
  - moisture ≤12.0 % m/m;
  - total acidity 0.6–1.0 % as lactic acid;
  - crude fibre ≤2 %;
  - ash ≤2.75 %.

  The Annex extraction is column-shifted. These values are the standard reading.
- **Garri granularity** (AFNOR square-mesh sieves):

  | Grade | 100 % passes | ≤40 % passes |
  |---|---|---|
  | Extra-fine | 0.50 mm | ≥40 % passes 0.25 mm |
  | Fine | 1 mm | 0.5 mm |
  | Medium | 1.25 mm | 1.00 mm |
  | Coarse | 2 mm | 1.25 mm |

  Unclassified gari follows buyer preference.
- **Rice** (RICE p9–12):
  - dried to about 12 % MC before storage;
  - long grain: L/W >3:1, amylose 19–23 %;
  - medium grain: L/W 2.0–2.9, amylose 12–19 %;
  - short grain: L/W <2, amylose 12–19 %;
  - waxy rice: ≤1 % amylose;
  - head rice: ≥¾ of kernel length, about 55 % of kernels for long grain;
  - second heads: ½–¾ length;
  - brewers: about ¼ kernel.

---

### 3. Flow charts (step lists)

**Pounded-yam ("pondo") / improved yam flour** (PONDO image)
1. Yam tuber
2. Washing
3. Peeling
4. Slicing
5. Sulphating (sodium metabisulphite)
6. Cooking, 10 min at 100 °C
7. Drying, 10 h at 70 °C
8. Milling
9. Improved yam flour

PQ p6 Q1 uses a pondo flow chart with handling points A–D, which are not shown in the scan. It asks for the size-reduction machine, the separation and cleaning devices to add, conveyors at A–D, quality assessment and by-product use.

**Garri** (IMG-GARRI)
1. Fresh cassava roots
2. Peeling and washing (out: peels and waste water)
3. Grating
4. Fermentation and dewatering (out: cassava waste liquor)
5. Disintegration and sieving, which splits into:
   - [residue → dried and milled into flour], and
   - fermented wet granules
6. Roasting
7. Cooling
8. Sieving, which splits into:
   - uniform/fine gari, and
   - coarse gari → milling → rejoins
9. Grading
10. Packaging
11. High-quality gari

GSTD §2.1 adds that "suitable heat treatment" means toasting or grilling, which partially gelatinises the starch and dehydrates the granules. GSTD's own sequence is: peeling → washing → grating → fermentation → pressing → fragmentation → granulation → drying if necessary → sifting → heat treatment.

**Rice** (RICE p9, "Rice Processing Flow Chart")

Regular route:
1. Dried rough (paddy) rice (≈12 % MC)
2. Cleaning
3. Clean rough rice
4. Shelling (co-product: hulls)
5. Brown rice, which can go to:
   - packaging, or
   - grinding and sifting → brown rice flour/meal, or
   - precook
6. Milling (co-product: rice bran → stabilizing → processed bran or oil extraction)
7. Grading and sorting (co-products: second heads, screenings, brewers)
8. Whole-kernel milled rice, which can go to:
   - enriching → regular white rice → packaging, or
   - cooking, enriching, cooling and drying → precooked/instant white or brown rice, or
   - grinding and sifting → rice flour/meal

Parboiled branch (from clean rough rice):
1. Warm-water soak under pressure
2. Steamed and dried
3. Shelling
4. Parboiled brown rice
5. Milling
6. Parboiled milled rice, which can go to:
   - cooking, cooling and drying → precooked parboiled whole kernel, or
   - grinding and sifting → flour/meal
7. Packaging

RICE p11: parboiling gelatinises the starch, giving firmer, separate, more stable grains.

PQ p4 Q5 asks for a "good-quality whole-grain parboiled rice" flow chart, the causes of poor local parboiled rice, 5 siting factors and 3 by-products. Use this chart with hulls, bran and brokens.

**Palm oil (modern, and traditional)**: see §1E (IMG-CPO, IMG-POMB with mass balance, IMG-T23).

**Wheat flour**: see §1E (IMG-WHEAT, 20 steps).

**Onion powder** (IMG-536b)
1. Onion bulbs
2. Blanching/peeling
3. Cleaning
4. Slicing
5. Blanching
6. Drying
7. Preservative
8. Packaging
9. Sterilisation
10. Packaged onion powder

The test asks which hurdles this sequence uses.

**Tomato paste** (PQ p3 Q4) and **frozen chicken** (PQ p1 Q4): question-only sequences, given in §1E.

---

### 4. Figures worth building in 3D (priority order)
1. **Hammer mill cutaway** (RED): swinging pivoted hammers at 1500–4000 rpm inside a screen ring. A screen-size slider changes the output size (FM/D). Pair it with a **burr mill** (plate-gap slider, 350–700 rpm) and a **roller mill** (counter-rotating fluted rolls, nip). Show Kick, Rittinger and Bond energy live (§2B).
2. **Sieve shaker + FM/UI calculator** (RED; PQ p1, p6): a stack of 7 IS sieves and pan with gyratory motion; mass piles build per tray and the calculator reports FM, D and UI.
3. **Separation bench** (SEP):
   - an inclined vibrating screen showing overflow/underflow and effectiveness E (eq 9);
   - an **air-column aspirator/winnower** where the air speed sits between Stokes terminal velocities and chaff lifts while grain falls;
   - a **cyclone** with double-vortex particles and S = V²/gR;
   - a **magnetic drum** pulling tramp metal;
   - a **rotary drum washer** and brush washer.
4. **Conveyor yard** (HAND):
   - troughed belt with the surcharge cross-section;
   - screw auger cutaway (D, d, p; standard, half-pitch, ribbon);
   - **bucket elevator** with the 3 discharge modes (centrifugal throw, positive inversion, continuous chute);
   - chain variants (slat, apron, scraper flight);
   - pneumatic loop (blower → duct → cyclone, positive vs suction).

   Each shows a capacity/power readout (H1–H9).
5. **Palm-oil mill line** (IMG-CPO/POMB): FFB cage → steriliser → thresher drum → digester → screw press → clarifier tank → centrifuge → vacuum dryer → tank. Mass-flow labels run 1000 → 225 kg CPO.
6. **Garri line**: peeler → grater → fermentation bags/press → sieve → roaster pan → sieve/grader → bagging. Equipment geometry is not in the notes, so use generic forms. Pair it with the **pondo line** (washer, peeler, slicer, sulphiting tank, cooker, cabinet dryer 70 °C, mill).
7. **Rice mill** (RICE p9): cleaner → (parboil soak tank and steamer) → huller/sheller → whitener/polisher → grader (head, second heads, brewers) → enricher. Kernel cross-section layers: hull, bran, germ, endosperm (RICE p6 and p11).
8. **Factory layout sandbox** (HAND Note 4): straight, serpentine, U, circular and odd-angle patterns with process-chart symbols.
9. **Preservation**:
   - retort with a can cutaway animating the cold point;
   - blancher (steam tunnel vs water bath);
   - freezing-curve plot (AS–EF) tied to a sphere freezing in an air-blast tunnel (Plank calculator);
   - cold room with load sources (respiration, doors, lights);
   - log-survivor plot (D, z).
10. **Yam barn** (N536): poles about 3 m on a 50 cm grid, tied tubers, palm-frond roof. Show it beside a platform store and a 15 °C cold room. Add a grain silo/bin and a triple-bag cutaway.

---

### 5. Exam questions and priorities

**AEE504 papers**

PQ p1–2, 2015 paper (Q1 + any 3):
- Q1: palm oil mill flow diagram (separating devices, by-products, handling at "HS" points, size reduction of kernel shells, layout sketch).
- Q2: dimension, sieve and microscopic ranges; hammer mill 1.5 mm for garri mash quality.
- Q3: aerodynamics importance; size-reducer characteristics; **burr mill FM/UI at two settings**.
- Q4: frozen-chicken flow chart, equipment chart and grouping.
- Q5: food-processing challenges in Nigeria; **Rittinger and Bond power for the two settings (6.5 kW at setting 1)**; belt vs screw conveyors.

PQ p3–4, 2017 paper (Q1 + Q5 + 2):
- Q1: feed mill (dust device at A; grinder choice; handling system to bypass the mixers; conversion to a flour mill).
- Q2: separation vs cleaning vs sorting; separating a mixed spill of sugar, rice and beans.
- Q3: benefits of size reduction; **screening efficiency at IS 30 and IS 15**; sketch of the device outlay.
- Q4: tomato-paste washing method and conveyors between stages; objectives of handling.
- Q5: parboiled-rice factory.

PQ p5, 2015/16 test:
- advantages and disadvantages of wet cleaning;
- local vs factory palm oil;
- 5 screening-efficiency factors;
- separator for palm oil and water;
- **centrifuge separating velocity** (50 µm, 900/1000 kg/m³, 10⁻³ Pa·s).

PQ p6:
- pondo flow chart (size reducer, separators, conveyors at A–D, quality, by-products);
- dry cleaning; overflow, underflow, cut diameter and effectiveness definitions; **roller-mill cassava FM/D/UI**;
- 5 reasons for aerodynamics; plate vs roller mills; **Kick and Rittinger motor-adequacy check (4.22 → 0.4 → 0.004 mm, ½ hp)**;
- bucket conveyors; conveyors for cassava tubers, groundnut oil and tomatoes; defence of chain conveyors.

IMG-T23, 2022/23 test:
- cleaning, sorting and grading with examples;
- traditional palm-oil route (why quality is low; a washing method; a decanting device, i.e. a centrifuge, and 2 industries that use it; suggested improvements).

**AEE504 priorities**, in order of recurrence:
1. Flow-chart analysis with device selection (every paper).
2. Sieve analysis: FM, D, UI (3 papers).
3. Kick, Rittinger and Bond power (2 papers).
4. Screen effectiveness (1 paper + definitions twice).
5. Conveyor selection and comparison (every paper).
6. Stokes/centrifuge velocity and aerodynamics (3 papers).
7. Palm-oil processing (4 items).

**AEE536 tests**

IMG-536a (2019/20):
- define spoilage and shelf life;
- 4 spoilage signs, 3 causes and 2 traditional preservation methods for a Nigerian produce;
- 2–3 hurdles and their demerits.

IMG-536b (2022/23), onion-powder flow:
- 4 spoilage factors;
- how hurdle technology is used;
- perishability class;
- best-before date with reasoning.

N536 assignments:
- expiry vs best-before vs use-by;
- 3–5 literature references on local preservatives;
- heat of respiration (oranges, tomatoes).

PRAC: a supermarket survey of packaging type, manufacture date and expiry date for 4 products in each of 8 groups, then classify them as perishable, semi-perishable or non-perishable.

**AEE536 priorities:**
1. Spoilage causes, shelf life and dating.
2. Hurdle technology (both tests).
3. Traditional methods.
4. Perishability classes.
5. D/k/Arrhenius relations, Plank freezing time and cooling load (the only numeric material, with worked examples in N536).
6. Irradiation dose classes.
7. Preservatives table.
8. Packaging functions and materials.
