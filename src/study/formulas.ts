import { SRC, type Citation } from '@/content/citations'
import type { Course } from './types'

/**
 * Hand-written registry of the key equations behind each scene, for the formula sheet.
 * TeX is rendered with KaTeX. `beyond` marks standard results not in the 500L notes;
 * `errata` points at src/content/errata.ts where the notes state the result differently.
 */
export interface Formula {
  id: string
  course: Course
  topic: string
  name: string
  tex: string
  /** "module/scene" */
  scene: string
  cite: Citation
  beyond?: boolean
  errata?: string
  /** symbols, plain text */
  note?: string
}

const r = String.raw
type Opt = Pick<Formula, 'beyond' | 'errata' | 'note'>
let seq = 0
const F = (course: Course, topic: string, name: string, tex: string, scene: string, cite: Citation, o: Opt = {}): Formula => ({
  id: `${course}-${++seq}`,
  course,
  topic,
  name,
  tex,
  scene,
  cite,
  ...o,
})

const PERF = 'engine/performance'
const FOUR = 'engine/four-stroke-diesel'

export const FORMULAS: Formula[] = [
  // ------------------------------------------------------------------ AEE509 engines
  F('AEE509', 'Engine dimensions', 'Piston displacement (per cylinder)', r`PD = \tfrac{\pi}{4}D^2 L`, PERF, SRC.tb509('engine terms'), { note: 'D bore, L stroke' }),
  F('AEE509', 'Engine dimensions', 'Compression ratio', r`CR = \dfrac{V_s + V_c}{V_c} = \dfrac{TCV}{CV}`, PERF, SRC.tb509('engine terms')),
  F('AEE509', 'Engine dimensions', 'Mean piston speed', r`S_p = \dfrac{2 L N}{60}`, PERF, SRC.misc509('Ex 6')),
  F('AEE509', 'Power & efficiency', 'Brake power', r`BP = \dfrac{2\pi N T}{60}`, PERF, SRC.misc509('performance')),
  F('AEE509', 'Power & efficiency', 'Brake mean effective pressure', r`bmep = \dfrac{60\,BP}{L A\,n\,z},\quad n = \tfrac{N}{2}\ (\text{4-stroke}),\ N\ (\text{2-stroke})`, PERF, SRC.misc509('Ex 2, Ex 4')),
  F('AEE509', 'Power & efficiency', 'Indicated power from imep', r`IP = \dfrac{imep\,L A\,n\,z}{60}`, PERF, SRC.misc509('performance')),
  F('AEE509', 'Power & efficiency', 'Mechanical efficiency', r`\eta_m = \dfrac{BP}{IP} = \dfrac{bmep}{imep}`, PERF, SRC.misc509('Ex 2')),
  F('AEE509', 'Power & efficiency', 'Friction power', r`FP = IP - BP`, PERF, SRC.exam509('2022/23 Q2')),
  F('AEE509', 'Power & efficiency', 'Brake thermal efficiency', r`\eta_{bth} = \dfrac{BP}{\dot m_f\,HV}`, PERF, SRC.misc509('Ex 7')),
  F('AEE509', 'Power & efficiency', 'Indicated thermal efficiency', r`\eta_{ith} = \dfrac{IP}{\dot m_f\,HV}`, 'engine/two-stroke', SRC.misc509('Ex 5')),
  F('AEE509', 'Fuel & air', 'Specific fuel consumption', r`sfc = \dfrac{\dot m_f}{BP}\ \ \text{kg/kWh}`, PERF, SRC.misc509('Ex 1')),
  F('AEE509', 'Fuel & air', 'Specific air consumption', r`sac = (A/F)\,sfc`, PERF, SRC.misc509('Ex 1')),
  F('AEE509', 'Fuel & air', 'Volumetric efficiency', r`\eta_v = \dfrac{\dot m_a}{\rho_a\,\dot V_s},\quad \rho_a = \dfrac{p}{RT}`, PERF, SRC.misc509('Ex 4, Ex 5')),
  F('AEE509', 'Fuel & air', 'Power from the air flow', r`BP = \eta\,\dot m_a\,(F/A)\,HV`, PERF, SRC.misc509('Ex 3')),
  F('AEE509', 'Air-standard cycles', 'Isentropic compression', r`T_2 = T_1 r^{k-1},\quad P_2 = P_1 r^{k}`, FOUR, SRC.thermo509('Otto cycle')),
  F('AEE509', 'Air-standard cycles', 'Otto efficiency', r`\eta_{Otto} = 1 - \dfrac{1}{r^{k-1}}`, FOUR, SRC.thermo509('Otto cycle')),
  F('AEE509', 'Air-standard cycles', 'Diesel efficiency', r`\eta_{D} = 1 - \dfrac{1}{r^{k-1}}\left[\dfrac{\delta^k - 1}{k(\delta - 1)}\right]`, FOUR, SRC.thermo509('p5'), { errata: 'diesel-factor' }),
  F('AEE509', 'Air-standard cycles', 'Dual-cycle efficiency', r`\eta = 1 - \dfrac{\alpha\delta^k - 1}{r^{k-1}\left[(\alpha - 1) + k\alpha(\delta - 1)\right]}`, FOUR, SRC.misc509('p10'), { errata: 'dual-vs-diesel' }),
  F('AEE509', 'Air-standard cycles', 'Mean effective pressure', r`mep = \dfrac{w_{net}}{v_1 - v_2} = \dfrac{\eta\,q_{in}}{v_1(1 - 1/r)}`, FOUR, SRC.misc509('p9, Ex 9'), { errata: 'otto-cv' }),
  F('AEE509', 'Air-standard cycles', 'Cut-off ratio from the cut-off point', r`\delta = 1 + x\,(r - 1)`, FOUR, SRC.misc509('Ex 13'), { note: 'x = cut-off as a fraction of the stroke' }),
  F('AEE509', 'Governing & systems', 'Governor regulation', r`\text{reg} = \dfrac{2(N_{nl} - N_{fl})}{N_{nl} + N_{fl}}\times 100\,\%`, 'engine/air-governor', SRC.supp509('governor')),
  F('AEE509', 'Governing & systems', 'Heat balance', r`\dot Q_{fuel} = BP + \dot Q_{cool} + \dot Q_{exh} + \dot Q_{misc}`, PERF, SRC.supp509('heat balance')),
  F('AEE509', 'Governing & systems', 'Coolant heat removal', r`\dot Q = \dot m\,c_p\,\Delta T`, 'engine/cooling', SRC.tb509('Ch 7'), { beyond: true }),

  // ------------------------------------------------------------------ AEE510 transmission, hydraulics, tyres
  F('AEE510', 'Gearing', 'Gear speeds', r`D\,N = d\,n \quad\Rightarrow\quad \dfrac{N_{driven}}{N_{driver}} = \dfrac{z_{driver}}{z_{driven}}`, 'powertrain/gearboxes', SRC.top510('p3–4')),
  F('AEE510', 'Gearing', 'Train ratio', r`i = \dfrac{\prod z_{driven}}{\prod z_{driver}}`, 'powertrain/gearboxes', SRC.top510('p4')),
  F('AEE510', 'Gearing', 'Ground speed', r`v = \dfrac{2\pi r\,N_e}{60\,i}`, 'powertrain/line-of-drive', SRC.tts510('p1')),
  F('AEE510', 'Gearing', 'Synchroniser time', r`t = \dfrac{J\,\Delta\omega}{T}`, 'powertrain/gearboxes', SRC.beyond('cone synchroniser'), { beyond: true }),
  F('AEE510', 'Planetary & differential', 'Ring-gear teeth', r`z_r = z_s + 2 z_p`, 'powertrain/planetary', SRC.beyond('planetary geometry'), { beyond: true }),
  F('AEE510', 'Planetary & differential', 'Willis equation', r`\dfrac{\omega_s - \omega_c}{\omega_r - \omega_c} = -\dfrac{z_r}{z_s}`, 'powertrain/planetary', SRC.beyond('epicyclic kinematics'), { beyond: true }),
  F('AEE510', 'Planetary & differential', 'Differential speeds', r`\omega_L + \omega_R = 2\,\omega_{cage}`, 'powertrain/differential', SRC.tts510('p8')),
  F('AEE510', 'Planetary & differential', 'Brake on the fast shaft', r`T_{brake} = \dfrac{T_{wheel}}{i}`, 'powertrain/brakes', SRC.tts510('p11')),
  F('AEE510', 'Hydraulics', 'Hydraulic power', r`P_h = \dfrac{Q\,p}{60}\quad(\text{L/min},\ \text{MPa} \to \text{kW})`, 'hydraulics/lift-circuit', SRC.hy510('p2–3')),
  F('AEE510', 'Hydraulics', 'Ram force and speed', r`F = p A,\quad v = \dfrac{Q}{A}`, 'hydraulics/cylinder', SRC.top510('App. 2 p11')),
  F('AEE510', 'Hydraulics', 'Hydrostatic flow and motor torque', r`Q = D N,\quad T_m = \dfrac{\Delta p\,D}{2\pi}`, 'powertrain/hydrostatic', SRC.pt510('p8–9'), { beyond: true }),
  F('AEE510', 'Hydraulics', 'Axial-piston displacement', r`D = z\,A\,(2R\tan\beta)`, 'powertrain/hydrostatic', SRC.beyond('axial-piston pump'), { beyond: true }),
  F('AEE510', 'Torque converter', 'Converter efficiency', r`\eta = TR \times SR = \dfrac{T_t}{T_i}\cdot\dfrac{N_t}{N_i}`, 'powertrain/torque-converter', SRC.pt510('p10')),
  F('AEE510', 'Torque converter', 'Torque balance', r`T_{turbine} = T_{impeller} + T_{stator}`, 'powertrain/torque-converter', SRC.pt510('p10')),
  F('AEE510', 'Weight transfer', 'Centre of gravity from axle loads', r`x = \dfrac{R_f\,L}{W}`, 'chassis/weight-transfer', SRC.l27('2022/23 Q2c')),
  F('AEE510', 'Weight transfer', 'Weight transfer (level pull)', r`\Delta W = \dfrac{P\,h}{L}`, 'chassis/weight-transfer', SRC.l27('weight transfer')),
  F('AEE510', 'Traction', 'Maximum pull', r`P = \mu\,W`, 'traction/traction-lab', SRC.l27('2022/23 Q3c')),
  F('AEE510', 'Traction', 'Mobility number (Brixius)', r`B_n = \dfrac{CI\,b\,d}{W}\cdot\dfrac{1 + 5\delta/h}{1 + 3b/d}`, 'traction/traction-lab', SRC.l27('eq 14')),
  F('AEE510', 'Traction', 'Gross traction ratio (Brixius)', r`GTR = 0.88\,(1 - e^{-0.1 B_n})(1 - e^{-7.5 s}) + 0.04`, 'traction/traction-lab', SRC.l27('Brixius')),
  F('AEE510', 'Traction', 'Net traction ratio', r`NTR = GTR - \left(\dfrac{1}{B_n} + 0.04 + \dfrac{0.5\,s}{\sqrt{B_n}}\right)`, 'traction/traction-lab', SRC.l27('Brixius')),
  F('AEE510', 'Traction', 'Tractive efficiency (ratios)', r`TE = \dfrac{NTR}{GTR}\,(1 - s)`, 'traction/traction-lab', SRC.l27('tractive efficiency')),
  F('AEE510', 'Tyres & ballast', 'Wheel slip (chalk-mark test)', r`s = \dfrac{N_{loaded} - N_{free}}{N_{loaded}}`, 'traction/ballast', SRC.tt510('p9–10'), { note: 'proper ballast: 10–15 % slip' }),
  F('AEE510', 'Tyres & ballast', 'Tyre contact area', r`A \approx \dfrac{W}{p_i}`, 'traction/tyre', SRC.l27('p39')),
  F('AEE510', 'Tyres & ballast', 'Overall tyre diameter (metric size)', r`d = d_{rim} + 2\,(\text{aspect})\,b`, 'traction/tyre', SRC.l27('p32')),
  F('AEE510', 'Tyres & ballast', 'Rolling radius', r`r_r \approx 1.06\,r_{static}`, 'traction/tyre', SRC.l27('p6')),
  F('AEE510', 'Tyres & ballast', 'Rear-axle weight guide', r`W_{rear} = \text{PTO hp} \times (\text{lb per hp})`, 'traction/ballast', SRC.tt510('p11')),
  F('AEE510', 'Tracks', 'Track ground pressure', r`p = \dfrac{W}{2\,b\,L}`, 'traction/tracks', SRC.beyond('track statics'), { beyond: true }),
  F('AEE510', 'Tracks', 'Track tension from sag', r`T = \dfrac{w\,s^2}{8\,\delta}`, 'traction/tracks', SRC.beyond('catenary sag'), { beyond: true }),

  // ------------------------------------------------------------------ AEE502 tractor mechanics, implements, testing
  F('AEE502', "Hooke's joint", 'Velocity ratio', r`\dfrac{\omega_B}{\omega_A} = \dfrac{\cos\delta}{1 - \sin^2\delta\,\cos^2\theta}`, 'pto/hookes-joint', SRC.hj502('speed ratio')),
  F('AEE502', "Hooke's joint", 'Speed limits', r`(\omega_B)_{max} = \dfrac{\omega_A}{\cos\delta},\quad (\omega_B)_{min} = \omega_A\cos\delta`, 'pto/hookes-joint', SRC.hj502('Example 26.3')),
  F('AEE502', "Hooke's joint", 'Angular acceleration of the driven shaft', r`\alpha_B = \dfrac{-\omega_A^2\cos\delta\,\sin^2\delta\,\sin 2\theta}{(1 - \cos^2\theta\,\sin^2\delta)^2}`, 'pto/hookes-joint', SRC.hj502('Example 26.3'), { errata: 'hooke-inertia' }),
  F('AEE502', "Hooke's joint", 'Output angle', r`\tan\theta_B = \dfrac{\tan\theta}{\cos\delta}`, 'pto/double-cardan', SRC.hj502('angular positions')),
  F('AEE502', 'Hydraulics', 'Pump flow', r`Q_T = D N,\quad Q_A = \eta_v\,Q_T`, 'hydraulics/pumps', SRC.hy510('pump efficiencies')),
  F('AEE502', 'Hydraulics', 'Pump torque', r`T_T = \dfrac{\Delta p\,D}{2\pi},\quad T_A = \dfrac{T_T}{\eta_T}`, 'hydraulics/pumps', SRC.hy510('pump efficiencies')),
  F('AEE502', 'Hydraulics', 'Overall pump efficiency', r`\eta_o = \eta_v\,\eta_T = \dfrac{P_h}{P_s}`, 'hydraulics/pumps', SRC.hy510('pump efficiencies')),
  F('AEE502', 'Hydraulics', 'Gear-pump displacement', r`D \approx 2\pi m^2 z\,b`, 'hydraulics/pumps', SRC.beyond('gear pump geometry'), { beyond: true }),
  F('AEE502', 'Tractor mechanics', 'Theoretical travel speed', r`V_0 = \dfrac{\pi D N_e}{60\,q}`, 'traction/traction-lab', SRC.mac502('Ch 2')),
  F('AEE502', 'Tractor mechanics', 'Wheel slip', r`i = 1 - \dfrac{V}{V_0}`, 'traction/traction-lab', SRC.mac502('Ch 2')),
  F('AEE502', 'Tractor mechanics', 'Tractive efficiency', r`\eta_t = \dfrac{P}{P + R}\,(1 - i)`, 'traction/traction-lab', SRC.mac502('eq 2.10')),
  F('AEE502', 'Tractor mechanics', 'Overall efficiency', r`\eta_o = \eta_e\,\eta_{tr}\,\eta_t,\quad \eta_{tr} \approx 0.98^{n}`, 'powertrain/line-of-drive', SRC.mac502('Ch 2')),
  F('AEE502', 'Tractor mechanics', 'Dynamic front axle load', r`V_f = W_f\cos\alpha - \dfrac{W\sin\alpha\,(r + y_g)}{x} - \dfrac{P\cos\theta\,y_d + P\sin\theta\,x_d}{x}`, 'chassis/weight-transfer', SRC.mac502('eq 6.4–6.5')),
  F('AEE502', 'Tractor mechanics', 'Instability limit', r`V_f \le 0`, 'chassis/stability', SRC.mac502('Ch 6')),
  F('AEE502', 'Tillage', 'Draft', r`D = k\,A = k\,n\,w\,d`, 'implements/mouldboard', SRC.am502('§12'), { errata: 'two-bottom' }),
  F('AEE502', 'Tillage', 'Draft power', r`P = D\,v,\quad \text{hp} = \dfrac{P}{735.5}`, 'implements/mouldboard', SRC.am502('§12'), { errata: 'plough-hp' }),
  F('AEE502', 'Tillage', 'Work per hectare', r`W = D\cdot\dfrac{10\,000}{w}`, 'implements/mouldboard', SRC.am502('§12')),
  F('AEE502', 'Testing', 'Dynamometer power', r`P = \dfrac{2\pi\,l\,F\,n}{60\,000}\ \text{kW}`, 'testing/dynamometers', SRC.tests502('eq 3–5')),
  F('AEE502', 'Testing', 'Hydraulic dynamometer capacity', r`P \propto N^3 D^5`, 'testing/dynamometers', SRC.tests502('p6')),
  F('AEE502', 'Spraying', 'ULV work rate', r`C = \dfrac{S\,W}{10}\ \text{ha/h}`, 'implements/sprayer', SRC.am502('§15.10–15.11')),
  F('AEE502', 'Mowing', 'Mean knife speed', r`\bar v = \dfrac{2 S N}{60}`, 'implements/mower-baler', SRC.am502('§16')),

  // ------------------------------------------------------------------ AEE501 management, clearing
  F('AEE501', 'Field capacity', 'Effective field capacity (SI)', r`C_e = \dfrac{W\,S\,FE}{10}\ \text{ha/h}`, 'testing/costs', SRC.mgmt501('field capacity')),
  F('AEE501', 'Field capacity', 'Effective field capacity (imperial)', r`C_e = \dfrac{W\,S\,FE}{8.25}\ \text{ac/h}`, 'testing/costs', SRC.mgmt501('field capacity')),
  F('AEE501', 'Machinery costs', 'Capital recovery factor', r`CRF = \dfrac{i(1+i)^n}{(1+i)^n - 1}`, 'testing/costs', SRC.mgmt501('Table 2')),
  F('AEE501', 'Machinery costs', 'Capital recovery', r`CR = (P - S)\,CRF + S\,i`, 'testing/costs', SRC.mgmt501('ISU PM 710')),
  F('AEE501', 'Machinery costs', 'Depreciation', r`D = P - S,\quad S = (S/L)_{table}\times L`, 'testing/costs', SRC.mgmt501('salvage table')),
  F('AEE501', 'Machinery costs', 'Real interest rate', r`i = i_{nominal} - i_{inflation}`, 'testing/costs', SRC.mgmt501('ISU PM 710')),
  F('AEE501', 'Machinery costs', 'Cost per hour and per area', r`c_h = \dfrac{\text{ownership}}{h} + \text{operating},\quad c_A = \dfrac{c_h}{C_e}`, 'testing/costs', SRC.mgmt501('ISU PM 710'), { errata: 'isu-operating' }),
  F('AEE501', 'Land clearing', 'Clearing time and cost', r`t = \dfrac{A}{\text{rate}},\quad \text{cost} = t\times\text{daily hire}`, 'implements/land-clearing', SRC.bush501('clearing costs'), { errata: 'clearing-days' }),

  // ------------------------------------------------------------------ AEE503 machine elements
  F('AEE503', 'Bearings', 'Stribeck static capacity', r`C_0 = \dfrac{K Z D^2}{5}`, 'elements/bearings', SRC.m503(7, 'Example 1')),
  F('AEE503', 'Bearings', 'AFBMA static capacity', r`C_0 = f_0\,i\,Z\,D^2\cos\alpha`, 'elements/bearings', SRC.m503(7, 'Example 1c')),
  F('AEE503', 'Bearings', 'Static equivalent load', r`P_0 = X_0 F_r + Y_0 F_a \ \ge F_r`, 'elements/bearings', SRC.m503(7, 'Example 2')),
  F('AEE503', 'Bearings', 'Dynamic equivalent load', r`P = X V F_r + Y F_a`, 'elements/bearings', SRC.m503(7, 'dynamic load')),
  F('AEE503', 'Bearings', 'Rating life', r`L = \left(\dfrac{C}{P}\right)^{3}\ \text{million rev},\quad L_h = \dfrac{10^6 L}{60 N}`, 'elements/bearings', SRC.m503(7, 'rating life')),
  F('AEE503', 'Belt drives', 'Open-belt wrap', r`\alpha = 180^\circ \mp 2\sin^{-1}\dfrac{R - r}{C}`, 'elements/belts', SRC.m503(4, 'slides 2–8'), { errata: 'open-belt' }),
  F('AEE503', 'Belt drives', 'Crossed-belt wrap', r`\alpha = 180^\circ + 2\sin^{-1}\dfrac{R + r}{C}`, 'elements/belts', SRC.m503(4, 'slides 2–8')),
  F('AEE503', 'Belt drives', 'Tension ratio (flat belt)', r`\dfrac{T_1 - T_c}{T_2 - T_c} = e^{f\alpha}`, 'elements/belts', SRC.m503(4, 'slides 5–8')),
  F('AEE503', 'Belt drives', 'Tension ratio (V-belt)', r`\dfrac{T_1 - T_c}{T_2 - T_c} = e^{f\alpha/\sin(\theta/2)}`, 'elements/belts', SRC.m503(4, 'slides 9–12')),
  F('AEE503', 'Belt drives', 'Belt power and centrifugal tension', r`P = (T_1 - T_2)\,v,\quad T_c = m v^2`, 'elements/belts', SRC.m503(4, 'slides 5–8'), { errata: 'v-belts' }),
  F('AEE503', 'Belt drives', 'Belt speed', r`v = \dfrac{\pi d N}{60}`, 'elements/belts', SRC.m503(4, 'slide 4')),
  F('AEE503', 'Belt drives', 'Open-belt length', r`L = 2C + \tfrac{\pi}{2}(D + d) + \dfrac{(D - d)^2}{4C}`, 'elements/belts', SRC.m503(2, 'Example 1')),
  F('AEE503', 'Chain drives', 'Design power', r`P_d = SF \times P,\quad P_{duplex} = 1.7\,P_{simplex}`, 'elements/chains', SRC.m503(3, 'selection of chain')),
  F('AEE503', 'Gears', 'Module and circular pitch', r`m = \dfrac{d}{z},\quad p_c = \pi m`, 'elements/gears', SRC.m503(5, 'slides 2–6')),
  F('AEE503', 'Gears', 'Spur gear forces', r`F_t = \dfrac{M_t}{r},\quad F_r = F_t\tan\phi`, 'elements/gears', SRC.m503(5, 'Example 1')),
  F('AEE503', 'Gears', 'Helical gear axial force', r`F_a = F_t\tan\alpha`, 'elements/gears', SRC.m503(5, 'Gear forces'), { errata: 'helical-axial' }),
  F('AEE503', 'Gears', 'Bevel gear forces', r`F_p = F_t\tan\phi\sin\beta,\quad F_g = F_t\tan\phi\cos\beta`, 'elements/gears', SRC.m503(5, 'slides 13–15')),
  F('AEE503', 'Gears', 'Torque from power', r`M_t = \dfrac{60\,P}{2\pi N}`, 'elements/gears', SRC.m503(5, 'Gear forces')),
  F('AEE503', 'Clutches', 'Clutch torque', r`T = n\,f\,F\,R_f`, 'elements/clutch-brake', SRC.m503(8, 'friction clutches')),
  F('AEE503', 'Clutches', 'Friction radius (uniform wear)', r`R_f = \dfrac{R_o + R_i}{2}`, 'elements/clutch-brake', SRC.m503(8, 'uniform wear')),
  F('AEE503', 'Clutches', 'Friction radius (uniform pressure)', r`R_f = \dfrac{2}{3}\,\dfrac{R_o^3 - R_i^3}{R_o^2 - R_i^2}`, 'elements/clutch-brake', SRC.m503(8, 'uniform pressure')),
  F('AEE503', 'Brakes', 'Shoe normal force', r`N = \dfrac{T}{f R}`, 'elements/clutch-brake', SRC.m503(9, 'Example 1')),
  F('AEE503', 'Brakes', 'Self-locking shoe brake', r`c \ge \dfrac{a}{f}`, 'elements/clutch-brake', SRC.m503(9, 'Example 1')),
  F('AEE503', 'Brakes', 'Band brake', r`\dfrac{F_1}{F_2} = e^{f\alpha},\quad T = (F_1 - F_2)\,r`, 'elements/clutch-brake', SRC.m503(9, 'Example 2')),
  F('AEE503', 'Brakes', 'Heat generated', r`H_g = f N V`, 'elements/clutch-brake', SRC.m503(9, 'Example 1')),
  F('AEE503', 'Springs & welds', 'Spring shear stress', r`\tau = K\,\dfrac{8 F C}{\pi d^2},\quad K_s = 1 + \dfrac{0.5}{C}`, 'elements/springs-welds', SRC.m503(10, 'springs'), { errata: 'wahl' }),
  F('AEE503', 'Springs & welds', 'Wahl factor', r`K_w = \dfrac{4C - 1}{4C - 4} + \dfrac{0.615}{C}`, 'elements/springs-welds', SRC.m503(10, 'springs'), { errata: 'wahl' }),
  F('AEE503', 'Springs & welds', 'Spring deflection', r`y = \dfrac{8 F C^3 n}{G d}`, 'elements/springs-welds', SRC.m503(10, 'springs')),
  F('AEE503', 'Springs & welds', 'Fillet weld leg from line force', r`w = \dfrac{f}{0.707\,s}`, 'elements/springs-welds', SRC.m503(11, 'welding')),
  F('AEE503', 'Springs & welds', 'Weld as a line (bending of a round bar)', r`Z_w = \dfrac{\pi d^2}{4},\quad f_b = \dfrac{M}{Z_w}`, 'elements/springs-welds', SRC.m503(11, 'slides 23–28')),

  // ------------------------------------------------------------------ AEE518 dynamic systems
  F('AEE518', 'Free vibration', 'Undamped natural frequency', r`\omega_n = \sqrt{\dfrac{k}{m}}`, 'vibration/smd', SRC.ln518('second-order systems')),
  F('AEE518', 'Free vibration', 'Damping ratio', r`\zeta = \dfrac{c}{2\sqrt{k m}} = \dfrac{c}{c_c}`, 'vibration/smd', SRC.ln518('second-order systems')),
  F('AEE518', 'Free vibration', 'Characteristic roots', r`s_{1,2} = -\zeta\omega_n \pm \omega_n\sqrt{\zeta^2 - 1}`, 'vibration/smd', SRC.ln518('second-order systems')),
  F('AEE518', 'Free vibration', 'Damped natural frequency', r`\omega_d = \omega_n\sqrt{1 - \zeta^2}`, 'vibration/smd', SRC.ln518('underdamped response')),
  F('AEE518', 'Free vibration', 'Logarithmic decrement', r`\delta = \dfrac{1}{n}\ln\dfrac{x_0}{x_n} = \dfrac{2\pi\zeta}{\sqrt{1 - \zeta^2}}`, 'vibration/smd', SRC.ln518('log decrement')),
  F('AEE518', 'Free vibration', 'First-order system', r`\tau\,\dot\theta + \theta = K\,u(t)`, 'vibration/smd', SRC.ln518('first-order systems'), { errata: 'thermometer-tau' }),
  F('AEE518', 'Forced vibration', 'Magnification factor', r`MF = \dfrac{X}{F_0/k} = \dfrac{1}{\sqrt{(1 - r^2)^2 + (2\zeta r)^2}}`, 'vibration/isolation', SRC.ln518('forced vibration')),
  F('AEE518', 'Forced vibration', 'Transmissibility', r`TR = \sqrt{\dfrac{1 + (2\zeta r)^2}{(1 - r^2)^2 + (2\zeta r)^2}}`, 'vibration/isolation', SRC.ln518('transmissibility')),
  F('AEE518', 'Forced vibration', 'Isolation efficiency', r`\eta_{iso} = (1 - TR)\times100\,\%`, 'vibration/isolation', SRC.ln518('transmissibility')),
  F('AEE518', 'Forced vibration', 'Rotating unbalance force', r`F_0 = m\,e\,\omega^2`, 'vibration/isolation', SRC.ln518('compressor example')),
  F('AEE518', 'Equivalent systems', 'Cantilever stiffness', r`k_e = \dfrac{3 E I}{L^3},\quad I = \dfrac{b h^3}{12}`, 'vibration/isolation', SRC.ln518('equivalent systems'), { errata: 'cantilever-E' }),
  F('AEE518', 'Equivalent systems', 'Effective mass of a cantilever', r`M_e = M + 0.23\,m_{beam}`, 'vibration/isolation', SRC.ln518('equivalent systems')),
  F('AEE518', 'Ride', 'Seat transmissibility (base excitation)', r`\left|\dfrac{X}{Y}\right| = \sqrt{\dfrac{1 + (2\zeta r)^2}{(1 - r^2)^2 + (2\zeta r)^2}}`, 'vibration/seat', SRC.ln518('eq 14')),
]
