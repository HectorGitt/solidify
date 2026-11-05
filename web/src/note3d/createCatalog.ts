import { MODULES } from '@/modules/catalog'
import type { ModuleDef, SceneEntry } from '@/modules/types'
import type { MaterialKey } from '@/render/materials'
import { BEARING_BRACKET_ORTHO_SPEC, FLANGED_COUPLING_SPEC } from './sampleTextbooks'
import type { NotePartSpec, NoteSceneSpec } from './schema'

// ============================================================================
// 1. TWO-STAGE SPUR GEAR REDUCER
// ============================================================================
export const TWO_STAGE_REDUCER_SPEC: NoteSceneSpec = {
  id: 'create-two-stage-reducer',
  title: 'Two-Stage Spur Gear Reducer',
  summary:
    'Two-stage parallel-shaft spur gear speed reducer with involute pinions (z1, z3) and wheels (z2, z4) inside a sectioned cast-iron housing with live ratio, torque, and Lewis tooth bending stress.',
  units: 'mm',
  extent: 0.48,
  floorY: -0.19,
  camera: {
    position: [0.56, 0.42, 0.62],
    target: [0, 0, 0],
  },
  recommendedCut: {
    enabled: true,
    normal: [0, 0, 1],
    pos: 0.02,
  },
  parameters: [
    { id: 'P', label: 'Motor Power P', symbol: 'P', value: 15, min: 2, max: 45, step: 0.5, unit: 'kW' },
    { id: 'rpm', label: 'Input Speed n₁', symbol: 'n_1', value: 1450, min: 300, max: 3000, step: 25, unit: 'rpm' },
    { id: 'z1', label: 'Stage 1 Pinion Teeth z₁', symbol: 'z_1', value: 16, min: 12, max: 28, step: 1, unit: 'teeth' },
    { id: 'z2', label: 'Stage 1 Wheel Teeth z₂', symbol: 'z_2', value: 72, min: 36, max: 96, step: 2, unit: 'teeth' },
    { id: 'z3', label: 'Stage 2 Pinion Teeth z₃', symbol: 'z_3', value: 16, min: 12, max: 28, step: 1, unit: 'teeth' },
    { id: 'z4', label: 'Stage 2 Wheel Teeth z₄', symbol: 'z_4', value: 72, min: 36, max: 96, step: 2, unit: 'teeth' },
    { id: 'm', label: 'Gear Module m', symbol: 'm', value: 0.0028, min: 0.002, max: 0.004, step: 0.0002, unit: 'm' },
    { id: 'b', label: 'Gear Face Width b', symbol: 'b', value: 0.032, min: 0.018, max: 0.055, step: 0.002, unit: 'm' },
    { id: 'shaftExt', label: 'Output Shaft Extension', symbol: 'L_{out}', value: 0.09, min: 0.04, max: 0.18, step: 0.005, unit: 'm' },
  ],
  calculations: [
    {
      id: 'i_tot',
      label: 'Overall Gear Ratio',
      symbol: 'i_{tot}',
      formula: '(z2 / z1) * (z4 / z3)',
      unit: ': 1',
      latex: 'i_{\\text{tot}} = \\frac{z_2}{z_1} \\cdot \\frac{z_4}{z_3}',
      description: 'Product of Stage 1 and Stage 2 tooth ratios.',
    },
    {
      id: 'n_out',
      label: 'Output Shaft Speed',
      symbol: 'n_{out}',
      formula: 'rpm / i_tot',
      unit: 'rpm',
      latex: 'n_{\\text{out}} = \\frac{n_1}{i_{\\text{tot}}}',
    },
    {
      id: 'T_in',
      label: 'Input Motor Torque',
      symbol: 'T_{in}',
      formula: '(P * 1000 * 60) / (2 * pi * rpm)',
      unit: 'N·m',
      latex: 'T_{\\text{in}} = \\frac{60 P}{2\\pi n_1}',
    },
    {
      id: 'T_out',
      label: 'Output Shaft Torque (η = 96%)',
      symbol: 'T_{out}',
      formula: '0.96 * T_in * i_tot',
      unit: 'N·m',
      latex: 'T_{\\text{out}} = \\eta \\, T_{\\text{in}} \\, i_{\\text{tot}}',
    },
    {
      id: 'a_total',
      label: 'Total Shaft Span (a₁ + a₂)',
      symbol: 'a_{tot}',
      formula: 'm * ((z1 + z2) / 2 + (z3 + z4) / 2) * 1000',
      unit: 'mm',
      latex: 'a_1 + a_2 = \\frac{m(z_1+z_2)}{2} + \\frac{m(z_3+z_4)}{2}',
    },
    {
      id: 'sigma_b',
      label: 'Stage-2 Pinion Bending Stress',
      symbol: '\\sigma_b',
      formula: '((2 * T_in * (z2 / z1)) / (m * z3)) / (b * m * 0.31) / 1000000',
      unit: 'MPa',
      latex: '\\sigma_b = \\frac{F_{t2}}{b \\cdot m \\cdot Y}',
      limit: { kind: 'max', value: 240, label: 'Allowable 240 MPa' },
    },
  ],
  parts: [
    {
      id: 'gearbox-casing',
      name: 'Cast-Iron Reducer Housing',
      material: 'castIron',
      role: 'housing',
      cut: true,
      explode: [0, 0.14, 0],
      info: {
        summary: 'Ribbed grey cast-iron casing supporting the three parallel bearing axes.',
        role: 'Encloses the oil bath and reacts bearing radial loads from both gear stages.',
      },
      shapes: [
        {
          kind: 'box',
          op: 'add',
          sx: 'm * (z1 + z2 + z3 + z4) * 0.55 + 0.18',
          sy: 'm * z4 + 0.08',
          sz: 'b * 2.8 + 0.06',
          position: [0, 0, 0],
        },
        {
          kind: 'box',
          op: 'subtract',
          sx: 'm * (z1 + z2 + z3 + z4) * 0.55 + 0.14',
          sy: 'm * z4 + 0.04',
          sz: 'b * 2.8 + 0.02',
          position: [0, 0.005, 0],
        },
        {
          kind: 'box',
          op: 'add',
          sx: 'm * (z1 + z2 + z3 + z4) * 0.55 + 0.22',
          sy: 0.018,
          sz: 'b * 2.8 + 0.1',
          position: [0, '-(m * z4) / 2 - 0.035', 0],
        },
      ],
    },
    {
      id: 'input-pinion-shaft',
      name: 'Input Shaft & Stage-1 Pinion (z₁)',
      material: 'steelDark',
      role: 'moving',
      cut: false,
      position: ['-m * (z1 + z2) / 2', 0, '-b * 0.65'],
      rotation: [Math.PI / 2, 0, 0],
      explode: [-0.1, 0, -0.08],
      motion: {
        kind: 'rotate',
        axis: 'y',
        speed: 'rpm / 60 * 0.35',
      },
      info: {
        summary: 'High-speed motor input shaft with integral case-hardened pinion z₁.',
        role: 'Drives Stage-1 wheel z₂ at speed n₁.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 0.014,
          h: 'b * 3.2',
          position: [0, -0.03, 0],
        },
        {
          kind: 'gear',
          teeth: 'z1',
          module: 'm',
          h: 'b',
          rInner: 0.008,
          position: [0, 0, 0],
        },
      ],
    },
    {
      id: 'intermediate-countershaft',
      name: 'Countershaft Assembly (Wheel z₂ + Pinion z₃)',
      material: 'steel',
      role: 'moving',
      cut: false,
      position: [0, 0, 0],
      rotation: [Math.PI / 2, 0, 0],
      explode: [0, 0.08, 0],
      motion: {
        kind: 'rotate',
        axis: 'y',
        speed: '-(rpm / 60 * 0.35) * (z1 / z2)',
      },
      info: {
        summary: 'Intermediate layshaft carrying driven wheel z₂ and second-stage pinion z₃.',
        role: 'Compounds the two reduction stages along parallel axes.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 0.018,
          h: 'b * 2.8',
          position: [0, 0, 0],
        },
        {
          kind: 'gear',
          teeth: 'z2',
          module: 'm',
          h: 'b',
          rInner: 0.014,
          position: [0, '-b * 0.65', 0],
        },
        {
          kind: 'gear',
          teeth: 'z3',
          module: 'm',
          h: 'b',
          rInner: 0.01,
          position: [0, 'b * 0.65', 0],
        },
      ],
    },
    {
      id: 'output-gear-shaft',
      name: 'Output Shaft & Stage-2 Wheel (z₄)',
      material: 'forged',
      role: 'moving',
      cut: false,
      position: ['m * (z3 + z4) / 2', 0, 'b * 0.65'],
      rotation: [Math.PI / 2, 0, 0],
      explode: [0.1, 0, 0.09],
      motion: {
        kind: 'rotate',
        axis: 'y',
        speed: '(rpm / 60 * 0.35) * (z1 / z2) * (z3 / z4)',
      },
      info: {
        summary: 'Low-speed, high-torque output wheel z₄ keyed to the output transmission shaft.',
        role: 'Delivers multiplied output torque T_out to the driven machine.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 0.022,
          h: 'b * 2.2 + shaftExt',
          position: [0, 'shaftExt * 0.5', 0],
        },
        {
          kind: 'gear',
          teeth: 'z4',
          module: 'm',
          h: 'b',
          rInner: 0.018,
          position: [0, 0, 0],
        },
      ],
    },
  ],
}

// ============================================================================
// 2. PLANETARY (EPICYCLIC) GEAR SET
// ============================================================================
export const PLANETARY_GEARSET_SPEC: NoteSceneSpec = {
  id: 'create-planetary-gearset',
  title: 'Planetary (Epicyclic) Gear Reduction Unit',
  summary:
    'Coaxial epicyclic gear train with central sun gear (z_S), three orbiting planet gears (z_P) mounted on a planet carrier, and stationary internal ring gear housing (z_R).',
  units: 'mm',
  extent: 0.44,
  floorY: -0.18,
  camera: {
    position: [0.46, 0.34, 0.52],
    target: [0, 0, 0],
  },
  recommendedCut: {
    enabled: true,
    normal: [1, 0, 0],
    pos: 0,
  },
  parameters: [
    { id: 'P', label: 'Input Power P', symbol: 'P', value: 18, min: 2, max: 60, step: 1, unit: 'kW' },
    { id: 'rpm', label: 'Sun Gear Speed n_S', symbol: 'n_S', value: 1500, min: 300, max: 3000, step: 50, unit: 'rpm' },
    { id: 'z_s', label: 'Sun Gear Teeth z_S', symbol: 'z_S', value: 18, min: 12, max: 32, step: 2, unit: 'teeth' },
    { id: 'z_p', label: 'Planet Gear Teeth z_P', symbol: 'z_P', value: 24, min: 14, max: 36, step: 2, unit: 'teeth' },
    { id: 'm', label: 'Gear Module m', symbol: 'm', value: 0.003, min: 0.002, max: 0.0045, step: 0.0002, unit: 'm' },
    { id: 'b', label: 'Face Width b', symbol: 'b', value: 0.036, min: 0.02, max: 0.06, step: 0.002, unit: 'm' },
  ],
  calculations: [
    {
      id: 'z_r',
      label: 'Ring Gear Teeth (z_S + 2z_P)',
      symbol: 'z_R',
      formula: 'z_s + 2 * z_p',
      unit: 'teeth',
      latex: 'z_R = z_S + 2 z_P',
    },
    {
      id: 'i_epicyclic',
      label: 'Carrier Reduction Ratio',
      symbol: 'i_c',
      formula: '1 + (z_r / z_s)',
      unit: ': 1',
      latex: 'i = 1 + \\frac{z_R}{z_S}',
    },
    {
      id: 'n_carrier',
      label: 'Carrier Output Speed',
      symbol: 'n_C',
      formula: 'rpm / i_epicyclic',
      unit: 'rpm',
      latex: 'n_C = \\frac{n_S}{1 + z_R/z_S}',
    },
    {
      id: 'T_carrier',
      label: 'Carrier Output Torque (η = 97%)',
      symbol: 'T_C',
      formula: '0.97 * ((P * 1000 * 60) / (2 * pi * rpm)) * i_epicyclic',
      unit: 'N·m',
      latex: 'T_C = \\eta \\, T_S \\, i',
    },
    {
      id: 'F_planet',
      label: 'Tangential Load per Planet (3 planets)',
      symbol: 'F_t',
      formula: '(((P * 1000 * 60) / (2 * pi * rpm)) / ((m * z_s) / 2)) / 3 / 1000',
      unit: 'kN',
      latex: 'F_t = \\frac{2 T_S}{3 \\, m \\, z_S}',
    },
  ],
  parts: [
    {
      id: 'ring-gear-housing',
      name: 'Stationary Annulus Ring Housing (z_R)',
      material: 'castIron',
      role: 'housing',
      cut: true,
      explode: [0, 0, -0.1],
      rotation: [Math.PI / 2, 0, 0],
      info: {
        summary: 'Outer cylindrical cast-iron housing with internal annulus teeth.',
      },
      shapes: [
        {
          kind: 'tube',
          rOuter: 'm * (z_s + 2 * z_p) * 0.5 + 0.032',
          rInner: 'm * (z_s + 2 * z_p) * 0.5',
          h: 'b * 1.8',
          position: [0, 0, 0],
        },
      ],
    },
    {
      id: 'sun-gear-shaft',
      name: 'Central Sun Gear & Input Shaft (z_S)',
      material: 'brass',
      role: 'moving',
      cut: false,
      rotation: [Math.PI / 2, 0, 0],
      explode: [0, 0, -0.06],
      motion: {
        kind: 'rotate',
        axis: 'y',
        speed: 'rpm / 60 * 0.35',
      },
      info: {
        summary: 'High-speed central sun pinion driving the three surrounding planet gears.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 0.014,
          h: 'b * 3.0',
          position: [0, -0.03, 0],
        },
        {
          kind: 'gear',
          teeth: 'z_s',
          module: 'm',
          h: 'b',
          rInner: 0.009,
          position: [0, 0, 0],
        },
      ],
    },
    {
      id: 'planet-carrier-assembly',
      name: 'Orbiting Planet Gears (3 × z_P) & Carrier',
      material: 'steel',
      role: 'moving',
      cut: false,
      rotation: [Math.PI / 2, 0, 0],
      explode: [0, 0, 0.08],
      motion: {
        kind: 'rotate',
        axis: 'y',
        speed: '(rpm / 60 * 0.35) / (1 + (z_s + 2 * z_p) / z_s)',
      },
      info: {
        summary: 'Three equally spaced planet gears meshing simultaneously with the sun and ring gears.',
      },
      shapes: [
        {
          kind: 'gear',
          teeth: 'z_p',
          module: 'm',
          h: 'b',
          rInner: 0.008,
          radialCount: 3,
          radialRadius: 'm * (z_s + z_p) * 0.5',
          position: [0, 0, 0],
        },
        {
          kind: 'cylinder',
          r: 0.008,
          h: 'b * 1.5',
          radialCount: 3,
          radialRadius: 'm * (z_s + z_p) * 0.5',
          position: [0, 'b * 0.3', 0],
        },
        {
          kind: 'tube',
          rOuter: 'm * (z_s + z_p) * 0.5 + 0.015',
          rInner: 0.018,
          h: 0.014,
          position: [0, 'b * 0.72', 0],
        },
        {
          kind: 'cylinder',
          r: 0.02,
          h: 0.09,
          position: [0, 'b * 0.72 + 0.045', 0],
        },
      ],
    },
  ],
}

// ============================================================================
// 3. CENTRIFUGAL WATER / SLURRY PUMP
// ============================================================================
export const CENTRIFUGAL_PUMP_SPEC: NoteSceneSpec = {
  id: 'create-centrifugal-pump',
  title: 'Centrifugal Volute Water Pump',
  summary:
    'Radial-flow centrifugal pump with sectioned cast-iron volute casing, enclosed bronze vane impeller, axial suction eye, tangential discharge flange, and live hydraulic head & power calculations.',
  units: 'mm',
  extent: 0.46,
  floorY: -0.2,
  camera: {
    position: [0.48, 0.36, 0.54],
    target: [0, 0, 0],
  },
  recommendedCut: {
    enabled: true,
    normal: [0, 0, 1],
    pos: 0.01,
  },
  parameters: [
    { id: 'rpm', label: 'Pump Speed n', symbol: 'n', value: 1750, min: 600, max: 3500, step: 50, unit: 'rpm' },
    { id: 'D2', label: 'Impeller Outer ØD₂', symbol: 'D_2', value: 0.22, min: 0.14, max: 0.34, step: 0.01, unit: 'm' },
    { id: 'b2', label: 'Impeller Exit Width b₂', symbol: 'b_2', value: 0.032, min: 0.018, max: 0.06, step: 0.002, unit: 'm' },
    { id: 'Q_lps', label: 'Flow Rate Q', symbol: 'Q', value: 28, min: 5, max: 80, step: 1, unit: 'L/s' },
    { id: 'vanes', label: 'Impeller Vane Count Z', symbol: 'Z', value: 6, min: 4, max: 10, step: 1, unit: 'vanes' },
    { id: 'eta', label: 'Pump Efficiency η', symbol: '\\eta', value: 0.76, min: 0.5, max: 0.9, step: 0.02, unit: '' },
  ],
  calculations: [
    {
      id: 'u2',
      label: 'Impeller Tip Speed u₂',
      symbol: 'u_2',
      formula: '(pi * D2 * rpm) / 60',
      unit: 'm/s',
      latex: 'u_2 = \\frac{\\pi D_2 n}{60}',
    },
    {
      id: 'H_m',
      label: 'Shut-off / Rated Manometric Head',
      symbol: 'H',
      formula: '0.52 * (u2 ^ 2) / 9.81',
      unit: 'm',
      latex: 'H \\approx \\psi \\frac{u_2^2}{2g}',
    },
    {
      id: 'P_hyd',
      label: 'Water Hydraulic Power',
      symbol: 'P_h',
      formula: '(1000 * 9.81 * (Q_lps / 1000) * H_m) / 1000',
      unit: 'kW',
      latex: 'P_h = \\rho g Q H',
    },
    {
      id: 'P_shaft',
      label: 'Required Motor Shaft Power',
      symbol: 'P_s',
      formula: 'P_hyd / eta',
      unit: 'kW',
      latex: 'P_s = \\frac{\\rho g Q H}{\\eta}',
      limit: { kind: 'max', value: 25, label: 'Motor Frame 25 kW' },
    },
  ],
  parts: [
    {
      id: 'volute-casing',
      name: 'Cast-Iron Spiral Volute Casing',
      material: 'paintBlue',
      role: 'housing',
      cut: true,
      explode: [0, 0, 0.12],
      rotation: [Math.PI / 2, 0, 0],
      info: {
        summary: 'Spiral volute casing converting high-velocity impeller discharge into static pressure head.',
      },
      shapes: [
        {
          kind: 'tube',
          rOuter: 'D2 * 0.68',
          rInner: 'D2 * 0.53',
          h: 'b2 * 2.2 + 0.03',
          position: [0, 0, 0],
        },
        {
          kind: 'tube',
          rOuter: 'D2 * 0.28',
          rInner: 'D2 * 0.21',
          h: 0.09,
          position: [0, 'b2 * 1.1 + 0.04', 0],
        },
        {
          kind: 'cylinder',
          r: 0.038,
          h: 0.14,
          rotation: [0, 0, Math.PI / 2],
          position: ['D2 * 0.58', 0, '-D2 * 0.35'],
        },
      ],
    },
    {
      id: 'bronze-impeller',
      name: 'Radial Vane Centrifugal Impeller',
      material: 'bronze',
      role: 'moving',
      cut: false,
      rotation: [Math.PI / 2, 0, 0],
      explode: [0, 0, 0.02],
      motion: {
        kind: 'rotate',
        axis: 'y',
        speed: 'rpm / 60 * 0.35',
      },
      info: {
        summary: 'Cast phosphor-bronze impeller imparting angular momentum to the fluid.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 'D2 * 0.5',
          h: 0.008,
          position: [0, '-b2 * 0.5', 0],
        },
        {
          kind: 'tube',
          rOuter: 'D2 * 0.5',
          rInner: 'D2 * 0.22',
          h: 0.007,
          position: [0, 'b2 * 0.5', 0],
        },
        {
          kind: 'box',
          sx: 'D2 * 0.28',
          sy: 'b2',
          sz: 0.007,
          radialCount: 'vanes',
          radialRadius: 'D2 * 0.32',
          position: [0, 0, 0],
        },
      ],
    },
    {
      id: 'pump-drive-shaft',
      name: 'Stainless Pump Shaft & Bearing Pedestal',
      material: 'steel',
      role: 'moving',
      cut: false,
      rotation: [Math.PI / 2, 0, 0],
      explode: [0, 0, -0.1],
      motion: {
        kind: 'rotate',
        axis: 'y',
        speed: 'rpm / 60 * 0.35',
      },
      info: {
        summary: 'Overhung stainless drive shaft coupling the impeller to the electric motor.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 0.018,
          h: 0.22,
          position: [0, -0.09, 0],
        },
      ],
    },
  ],
}

// ============================================================================
// 4. DOUBLE-ACTING HYDRAULIC CYLINDER / ACTUATOR
// ============================================================================
export const HYDRAULIC_CYLINDER_SPEC: NoteSceneSpec = {
  id: 'create-hydraulic-cylinder',
  title: 'Double-Acting Hydraulic Cylinder Actuator',
  summary:
    'Heavy-duty hydraulic linear actuator with honed steel barrel, reciprocating piston and hard-chrome piston rod, tie-rod end caps, and live extension/retraction force & oil flow calculations.',
  units: 'mm',
  extent: 0.52,
  floorY: -0.16,
  camera: {
    position: [0.46, 0.32, 0.56],
    target: [0, 0, 0],
  },
  recommendedCut: {
    enabled: true,
    normal: [0, 0, 1],
    pos: 0,
  },
  parameters: [
    { id: 'boreD', label: 'Cylinder Bore ØD', symbol: 'D', value: 0.1, min: 0.05, max: 0.2, step: 0.005, unit: 'm' },
    { id: 'rodD', label: 'Piston Rod Ød', symbol: 'd', value: 0.055, min: 0.025, max: 0.12, step: 0.005, unit: 'm' },
    { id: 'stroke', label: 'Working Stroke S', symbol: 'S', value: 0.26, min: 0.12, max: 0.45, step: 0.01, unit: 'm' },
    { id: 'p_bar', label: 'System Pressure p', symbol: 'p', value: 180, min: 40, max: 320, step: 10, unit: 'bar' },
    { id: 'Q_lpm', label: 'Pump Flow Rate Q', symbol: 'Q', value: 45, min: 10, max: 120, step: 5, unit: 'L/min' },
  ],
  calculations: [
    {
      id: 'F_ext',
      label: 'Extension Push Force',
      symbol: 'F_{ext}',
      formula: '((pi * (boreD ^ 2)) / 4) * (p_bar * 100000) / 1000',
      unit: 'kN',
      latex: 'F_{\\text{ext}} = p \\frac{\\pi D^2}{4}',
    },
    {
      id: 'F_ret',
      label: 'Retraction Pull Force (Annulus)',
      symbol: 'F_{ret}',
      formula: '((pi * ((boreD ^ 2) - (rodD ^ 2))) / 4) * (p_bar * 100000) / 1000',
      unit: 'kN',
      latex: 'F_{\\text{ret}} = p \\frac{\\pi (D^2 - d^2)}{4}',
    },
    {
      id: 'v_ext',
      label: 'Extension Speed',
      symbol: 'v_{ext}',
      formula: '(Q_lpm / 60000) / ((pi * (boreD ^ 2)) / 4)',
      unit: 'm/s',
      latex: 'v_{\\text{ext}} = \\frac{Q}{A_p}',
    },
    {
      id: 'sigma_hoop',
      label: 'Barrel Wall Hoop Stress (t = 10 mm)',
      symbol: '\\sigma_h',
      formula: '((p_bar * 0.1) * (boreD * 1000)) / (2 * 10)',
      unit: 'MPa',
      latex: '\\sigma_h = \\frac{p D}{2 t}',
      limit: { kind: 'max', value: 220, label: 'Allowable 220 MPa' },
    },
  ],
  parts: [
    {
      id: 'cylinder-barrel',
      name: 'Honed Steel Cylinder Barrel & End Caps',
      material: 'paintRed',
      role: 'housing',
      cut: true,
      rotation: [0, 0, Math.PI / 2],
      explode: [0, 0.12, 0],
      info: {
        summary: 'Seamless cold-drawn steel tube sealed by head and cap glands.',
      },
      shapes: [
        {
          kind: 'tube',
          rOuter: 'boreD * 0.5 + 0.012',
          rInner: 'boreD * 0.5',
          h: 'stroke + 0.1',
          position: [0, 0, 0],
        },
        {
          kind: 'cylinder',
          r: 'boreD * 0.5 + 0.018',
          h: 0.028,
          position: [0, '-(stroke * 0.5 + 0.05)', 0],
        },
        {
          kind: 'tube',
          rOuter: 'boreD * 0.5 + 0.018',
          rInner: 'rodD * 0.5 + 0.002',
          h: 0.028,
          position: [0, 'stroke * 0.5 + 0.05', 0],
        },
      ],
    },
    {
      id: 'piston-and-rod',
      name: 'Piston & Hard-Chrome Piston Rod',
      material: 'chrome',
      role: 'moving',
      cut: false,
      rotation: [0, 0, Math.PI / 2],
      explode: [0.16, 0, 0],
      motion: {
        kind: 'translate',
        axis: 'x',
        speed: 1.6,
        amplitude: 'stroke * 0.35',
      },
      info: {
        summary: 'Ground hard-chrome piston rod transmitting hydraulic thrust to the clevis eye.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 'boreD * 0.49',
          h: 0.042,
          position: [0, -0.02, 0],
        },
        {
          kind: 'cylinder',
          r: 'rodD * 0.5',
          h: 'stroke + 0.14',
          position: [0, 'stroke * 0.5 + 0.04', 0],
        },
      ],
    },
  ],
}

// ============================================================================
// 5. SINGLE-CYLINDER PISTON ENGINE / SLIDER-CRANK
// ============================================================================
export const PISTON_ENGINE_SPEC: NoteSceneSpec = {
  id: 'create-piston-engine',
  title: 'Single-Cylinder Reciprocating Piston Engine',
  summary:
    'Sectioned air-cooled cylinder block with reciprocating aluminium piston, crankshaft and counterweighted crank web, flywheel, and live displacement, piston speed & power output calculations.',
  units: 'mm',
  extent: 0.48,
  floorY: -0.22,
  camera: {
    position: [0.48, 0.34, 0.56],
    target: [0, 0, 0],
  },
  recommendedCut: {
    enabled: true,
    normal: [0, 0, 1],
    pos: 0,
  },
  parameters: [
    { id: 'B', label: 'Cylinder Bore B', symbol: 'B', value: 0.095, min: 0.065, max: 0.14, step: 0.005, unit: 'm' },
    { id: 'S', label: 'Piston Stroke S', symbol: 'S', value: 0.11, min: 0.07, max: 0.16, step: 0.005, unit: 'm' },
    { id: 'rpm', label: 'Engine Speed n', symbol: 'n', value: 2200, min: 800, max: 4000, step: 100, unit: 'rpm' },
    { id: 'bmep', label: 'Brake Mean Effective Pressure', symbol: 'p_{me}', value: 8.5, min: 4, max: 16, step: 0.5, unit: 'bar' },
    { id: 'CR', label: 'Compression Ratio r_c', symbol: 'r_c', value: 16.5, min: 8, max: 22, step: 0.5, unit: ': 1' },
  ],
  calculations: [
    {
      id: 'V_s',
      label: 'Swept Displacement Volume',
      symbol: 'V_s',
      formula: '((pi * (B ^ 2)) / 4) * S * 1000000',
      unit: 'cm³',
      latex: 'V_s = \\frac{\\pi B^2}{4} S',
    },
    {
      id: 'c_m',
      label: 'Mean Piston Speed',
      symbol: 'c_m',
      formula: '(2 * S * rpm) / 60',
      unit: 'm/s',
      latex: 'c_m = \\frac{2 S n}{60}',
      limit: { kind: 'max', value: 14, label: 'Wear Limit 14 m/s' },
    },
    {
      id: 'P_brake',
      label: 'Four-Stroke Brake Power',
      symbol: 'P_b',
      formula: '((bmep * 100000) * (((pi * (B ^ 2)) / 4) * S) * (rpm / 120)) / 1000',
      unit: 'kW',
      latex: 'P_b = \\frac{p_{\\text{me}} V_s n}{2 \\times 60}',
    },
    {
      id: 'eta_th',
      label: 'Ideal Air-Standard Efficiency',
      symbol: '\\eta_{th}',
      formula: '(1 - (1 / (CR ^ 0.4))) * 100',
      unit: '%',
      latex: '\\eta = 1 - \\frac{1}{r_c^{\\gamma - 1}}',
    },
  ],
  parts: [
    {
      id: 'cylinder-block',
      name: 'Finned Cast-Iron Cylinder Liner & Crankcase',
      material: 'castIron',
      role: 'housing',
      cut: true,
      explode: [0, 0.14, 0],
      info: {
        summary: 'Honed cylinder barrel and lower crankcase housing.',
      },
      shapes: [
        {
          kind: 'tube',
          rOuter: 'B * 0.5 + 0.018',
          rInner: 'B * 0.5',
          h: 'S * 1.65',
          position: [0, 0.055, 0],
        },
        {
          kind: 'tube',
          rOuter: 'S * 0.72 + 0.025',
          rInner: 'S * 0.72',
          h: 'B + 0.05',
          rotation: [Math.PI / 2, 0, 0],
          position: [0, -0.075, 0],
        },
      ],
    },
    {
      id: 'aluminium-piston',
      name: 'Reciprocating Aluminium Piston & Crown',
      material: 'aluminium',
      role: 'moving',
      cut: false,
      position: [0, 0.055, 0],
      explode: [0, 0.18, 0],
      motion: {
        kind: 'translate',
        axis: 'y',
        speed: 'rpm / 60 * 0.15',
        amplitude: 'S * 0.45',
      },
      info: {
        summary: 'Trunk piston with ring grooves reciprocating between TDC and BDC.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 'B * 0.49',
          h: 'B * 0.75',
          position: [0, 0, 0],
        },
      ],
    },
    {
      id: 'crankshaft-flywheel',
      name: 'Forged Crankshaft & Cast-Iron Flywheel',
      material: 'forged',
      role: 'moving',
      cut: false,
      position: [0, -0.075, 0],
      rotation: [Math.PI / 2, 0, 0],
      explode: [0, -0.08, 0.1],
      motion: {
        kind: 'rotate',
        axis: 'y',
        speed: 'rpm / 60 * 0.15',
      },
      info: {
        summary: 'Rotating crankshaft, crankpin throw, and energy-storing flywheel rim.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 0.018,
          h: 0.22,
          position: [0, 0, 0],
        },
        {
          kind: 'cylinder',
          r: 'S * 0.52',
          h: 0.026,
          position: ['S * 0.2', 0, 0],
        },
        {
          kind: 'cylinder',
          r: 'S * 0.85',
          h: 0.028,
          position: [0, -0.095, 0],
        },
      ],
    },
  ],
}

// ============================================================================
// 6. V-BELT & PULLEY POWER DRIVE
// ============================================================================
export const BELT_DRIVE_SPEC: NoteSceneSpec = {
  id: 'create-belt-drive',
  title: 'Two-Pulley V-Belt Power Transmission Drive',
  summary:
    'Grooved driver and driven cast-iron sheaves connected by a tensioned V-belt drive with ventilated mesh guard, motor shaft, and live belt speed & tension calculations.',
  units: 'mm',
  extent: 0.54,
  floorY: -0.2,
  camera: {
    position: [0.54, 0.36, 0.62],
    target: [0, 0, 0],
  },
  recommendedCut: {
    enabled: true,
    normal: [0, 0, 1],
    pos: 0.02,
  },
  parameters: [
    { id: 'P', label: 'Transmitted Power P', symbol: 'P', value: 11, min: 1.5, max: 35, step: 0.5, unit: 'kW' },
    { id: 'rpm', label: 'Motor Pulley Speed n₁', symbol: 'n_1', value: 1440, min: 400, max: 2800, step: 40, unit: 'rpm' },
    { id: 'D1', label: 'Driver Pulley ØD₁', symbol: 'D_1', value: 0.12, min: 0.08, max: 0.22, step: 0.01, unit: 'm' },
    { id: 'D2', label: 'Driven Pulley ØD₂', symbol: 'D_2', value: 0.28, min: 0.16, max: 0.42, step: 0.01, unit: 'm' },
    { id: 'C', label: 'Centre Distance C', symbol: 'C', value: 0.34, min: 0.24, max: 0.48, step: 0.02, unit: 'm' },
  ],
  calculations: [
    {
      id: 'i_belt',
      label: 'Velocity Ratio',
      symbol: 'i',
      formula: 'D2 / D1',
      unit: ': 1',
      latex: 'i = \\frac{D_2}{D_1}',
    },
    {
      id: 'n2',
      label: 'Driven Shaft Speed n₂',
      symbol: 'n_2',
      formula: 'rpm / i_belt',
      unit: 'rpm',
      latex: 'n_2 = \\frac{n_1 D_1}{D_2}',
    },
    {
      id: 'v_belt',
      label: 'Belt Linear Speed',
      symbol: 'v',
      formula: '(pi * D1 * rpm) / 60',
      unit: 'm/s',
      latex: 'v = \\frac{\\pi D_1 n_1}{60}',
      limit: { kind: 'max', value: 25, label: 'Optimal ≤ 25 m/s' },
    },
    {
      id: 'F_eff',
      label: 'Effective Belt Pull (T₁ − T₂)',
      symbol: 'F_e',
      formula: '(P * 1000) / v_belt',
      unit: 'N',
      latex: 'T_1 - T_2 = \\frac{P}{v}',
    },
  ],
  parts: [
    {
      id: 'belt-guard-housing',
      name: 'Sheet-Metal Safety Belt Guard',
      material: 'paintYellow',
      role: 'housing',
      cut: true,
      explode: [0, 0, 0.12],
      info: {
        summary: 'Protective perimeter guard enclosing the rotating sheaves and belt.',
      },
      shapes: [
        {
          kind: 'box',
          op: 'add',
          sx: 'C + (D1 + D2) * 0.55 + 0.06',
          sy: 'D2 + 0.06',
          sz: 0.09,
          position: [0, 0, 0],
        },
        {
          kind: 'box',
          op: 'subtract',
          sx: 'C + (D1 + D2) * 0.55 + 0.03',
          sy: 'D2 + 0.03',
          sz: 0.07,
          position: [0, 0, 0],
        },
      ],
    },
    {
      id: 'driver-pulley-part',
      name: 'Driver Motor Sheave (ØD₁)',
      material: 'castIron',
      role: 'moving',
      cut: false,
      position: ['-C * 0.5', 0, 0],
      rotation: [Math.PI / 2, 0, 0],
      explode: [-0.08, 0, -0.06],
      motion: {
        kind: 'rotate',
        axis: 'y',
        speed: 'rpm / 60 * 0.3',
      },
      info: {
        summary: 'High-speed motor V-groove pulley.',
      },
      shapes: [
        {
          kind: 'pulley',
          rOuter: 'D1 * 0.5',
          rInner: 0.014,
          h: 0.036,
          position: [0, 0, 0],
        },
        {
          kind: 'cylinder',
          r: 0.016,
          h: 0.12,
          position: [0, -0.03, 0],
        },
      ],
    },
    {
      id: 'driven-pulley-part',
      name: 'Driven Machine Sheave (ØD₂)',
      material: 'steel',
      role: 'moving',
      cut: false,
      position: ['C * 0.5', 0, 0],
      rotation: [Math.PI / 2, 0, 0],
      explode: [0.08, 0, 0.06],
      motion: {
        kind: 'rotate',
        axis: 'y',
        speed: '(rpm / 60 * 0.3) * (D1 / D2)',
      },
      info: {
        summary: 'Large driven V-belt pulley stepping down speed and multiplying torque.',
      },
      shapes: [
        {
          kind: 'pulley',
          rOuter: 'D2 * 0.5',
          rInner: 0.02,
          h: 0.038,
          position: [0, 0, 0],
        },
        {
          kind: 'cylinder',
          r: 0.022,
          h: 0.14,
          position: [0, 0.03, 0],
        },
      ],
    },
  ],
}

// ============================================================================
// 7. VENTILATED DISC BRAKE & HYDRAULIC CALIPER
// ============================================================================
export const DISC_BRAKE_SPEC: NoteSceneSpec = {
  id: 'create-disc-brake',
  title: 'Ventilated Disc Brake & Hydraulic Caliper',
  summary:
    'Rotating cast-iron brake rotor disc straddled by a hydraulic floating caliper and twin friction pads with live clamping force, braking torque, and heat flux calculations.',
  units: 'mm',
  extent: 0.44,
  floorY: -0.2,
  camera: {
    position: [0.44, 0.3, 0.5],
    target: [0, 0, 0],
  },
  recommendedCut: {
    enabled: true,
    normal: [1, 0, 0],
    pos: 0,
  },
  parameters: [
    { id: 'D_disc', label: 'Brake Rotor Outer ØD', symbol: 'D', value: 0.3, min: 0.2, max: 0.42, step: 0.01, unit: 'm' },
    { id: 'd_pist', label: 'Caliper Piston Ød_p', symbol: 'd_p', value: 0.054, min: 0.036, max: 0.075, step: 0.002, unit: 'm' },
    { id: 'p_bar', label: 'Brake Line Pressure p', symbol: 'p', value: 85, min: 20, max: 160, step: 5, unit: 'bar' },
    { id: 'mu', label: 'Pad Friction Coefficient μ', symbol: '\\mu', value: 0.38, min: 0.25, max: 0.55, step: 0.02, unit: '' },
    { id: 'rpm', label: 'Wheel Speed n', symbol: 'n', value: 600, min: 100, max: 1500, step: 50, unit: 'rpm' },
  ],
  calculations: [
    {
      id: 'F_clamp',
      label: 'Caliper Clamping Normal Force',
      symbol: 'F_N',
      formula: '((pi * (d_pist ^ 2)) / 4) * (p_bar * 100000) / 1000',
      unit: 'kN',
      latex: 'F_N = p \\frac{\\pi d_p^2}{4}',
    },
    {
      id: 'T_brake',
      label: 'Total Braking Torque (2 Pads)',
      symbol: 'T_b',
      formula: '2 * mu * (F_clamp * 1000) * (D_disc * 0.38)',
      unit: 'N·m',
      latex: 'T_b = 2 \\mu F_N R_e',
    },
    {
      id: 'P_heat',
      label: 'Instantaneous Thermal Power',
      symbol: 'P_{th}',
      formula: '(T_brake * 2 * pi * rpm) / 60000',
      unit: 'kW',
      latex: 'P_{\\text{th}} = T_b \\, \\omega',
    },
  ],
  parts: [
    {
      id: 'brake-caliper-housing',
      name: 'Hydraulic Brake Caliper Bridge & Piston',
      material: 'paintRed',
      role: 'housing',
      cut: true,
      position: [0, 'D_disc * 0.38', 0],
      explode: [0, 0.12, 0],
      info: {
        summary: 'Cast ductile-iron caliper housing straddling the outer friction ring of the rotor.',
      },
      shapes: [
        {
          kind: 'box',
          sx: 0.12,
          sy: 0.075,
          sz: 0.095,
          position: [0, 0, 0],
        },
      ],
    },
    {
      id: 'brake-rotor-disc',
      name: 'Cast-Iron Ventilated Brake Rotor & Hub',
      material: 'castIron',
      role: 'moving',
      cut: false,
      rotation: [Math.PI / 2, 0, 0],
      explode: [0, 0, -0.09],
      motion: {
        kind: 'rotate',
        axis: 'y',
        speed: 'rpm / 60 * 0.3',
      },
      info: {
        summary: 'Precision-ground grey cast-iron friction disc bolted to the wheel hub.',
      },
      shapes: [
        {
          kind: 'tube',
          rOuter: 'D_disc * 0.5',
          rInner: 'D_disc * 0.22',
          h: 0.024,
          position: [0, 0, 0],
        },
        {
          kind: 'cylinder',
          r: 'D_disc * 0.24',
          h: 0.065,
          position: [0, -0.02, 0],
        },
      ],
    },
  ],
}

// ============================================================================
// 8. SHELL-AND-TUBE HEAT EXCHANGER
// ============================================================================
export const HEAT_EXCHANGER_SPEC: NoteSceneSpec = {
  id: 'create-heat-exchanger',
  title: 'Shell-and-Tube Heat Exchanger',
  summary:
    'Sectioned cylindrical steel shell containing a bundle of copper heat-transfer tubes, front/rear tube sheets, segmental baffles, and live LMTD & thermal duty calculations.',
  units: 'mm',
  extent: 0.56,
  floorY: -0.2,
  camera: {
    position: [0.54, 0.36, 0.62],
    target: [0, 0, 0],
  },
  recommendedCut: {
    enabled: true,
    normal: [0, 0, 1],
    pos: 0,
  },
  parameters: [
    { id: 'shellD', label: 'Shell Inner ØD_s', symbol: 'D_s', value: 0.24, min: 0.16, max: 0.38, step: 0.01, unit: 'm' },
    { id: 'tubeL', label: 'Tube Bundle Length L', symbol: 'L', value: 0.42, min: 0.26, max: 0.62, step: 0.02, unit: 'm' },
    { id: 'tubes', label: 'Outer Ring Tube Count N_t', symbol: 'N_t', value: 8, min: 4, max: 14, step: 1, unit: 'tubes' },
    { id: 'U_val', label: 'Overall Heat Transfer Coeff U', symbol: 'U', value: 850, min: 250, max: 1800, step: 50, unit: 'W/m²K' },
    { id: 'dT_lm', label: 'Log-Mean Temp Difference ΔT_lm', symbol: '\\Delta T_{lm}', value: 38, min: 10, max: 85, step: 2, unit: 'K' },
  ],
  calculations: [
    {
      id: 'A_ht',
      label: 'Heat Transfer Surface Area',
      symbol: 'A',
      formula: '(tubes + 1) * pi * 0.024 * tubeL',
      unit: 'm²',
      latex: 'A = N_t \\pi d_o L',
    },
    {
      id: 'Q_duty',
      label: 'Thermal Heat Duty Q̇',
      symbol: '\\dot{Q}',
      formula: '(U_val * A_ht * dT_lm) / 1000',
      unit: 'kW',
      latex: '\\dot{Q} = U A \\Delta T_{\\text{lm}}',
    },
  ],
  parts: [
    {
      id: 'exchanger-shell',
      name: 'Pressure Vessel Steel Shell & Nozzles',
      material: 'paintBlue',
      role: 'housing',
      cut: true,
      rotation: [0, 0, Math.PI / 2],
      explode: [0, 0.14, 0],
      info: {
        summary: 'Cylindrical shell containing the shell-side fluid and cross-flow baffles.',
      },
      shapes: [
        {
          kind: 'tube',
          rOuter: 'shellD * 0.5 + 0.012',
          rInner: 'shellD * 0.5',
          h: 'tubeL + 0.06',
          position: [0, 0, 0],
        },
      ],
    },
    {
      id: 'copper-tube-bundle',
      name: 'Copper Tube Bundle & Tube Sheets',
      material: 'copper',
      role: 'static',
      cut: false,
      rotation: [0, 0, Math.PI / 2],
      explode: [0.16, 0, 0],
      info: {
        summary: 'Parallel copper tubes expanded into twin forged steel tube sheets.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 0.012,
          h: 'tubeL',
          position: [0, 0, 0],
        },
        {
          kind: 'cylinder',
          r: 0.011,
          h: 'tubeL',
          radialCount: 'tubes',
          radialRadius: 'shellD * 0.31',
          position: [0, 0, 0],
        },
        {
          kind: 'cylinder',
          r: 'shellD * 0.49',
          h: 0.018,
          position: [0, '-tubeL * 0.48', 0],
        },
        {
          kind: 'cylinder',
          r: 'shellD * 0.49',
          h: 0.018,
          position: [0, 'tubeL * 0.48', 0],
        },
      ],
    },
  ],
}

// ============================================================================
// 9. STRUCTURAL CANTILEVER / BENDING BEAM RIG
// ============================================================================
export const STRUCTURAL_BEAM_SPEC: NoteSceneSpec = {
  id: 'create-structural-beam',
  title: 'Structural Steel Beam Bending & Deflection Rig',
  summary:
    'Structural steel girder under transverse point load with clamped support pedestal, load actuator, and live bending moment, section modulus, stress & deflection calculations.',
  units: 'mm',
  extent: 0.56,
  floorY: -0.18,
  camera: {
    position: [0.5, 0.34, 0.58],
    target: [0, 0, 0],
  },
  recommendedCut: {
    enabled: false,
    normal: [0, 0, 1],
    pos: 0,
  },
  parameters: [
    { id: 'L', label: 'Beam Span Length L', symbol: 'L', value: 0.42, min: 0.24, max: 0.65, step: 0.02, unit: 'm' },
    { id: 'h_beam', label: 'Beam Depth h', symbol: 'h', value: 0.065, min: 0.035, max: 0.11, step: 0.005, unit: 'm' },
    { id: 'b_beam', label: 'Beam Flange Width b', symbol: 'b', value: 0.045, min: 0.025, max: 0.08, step: 0.005, unit: 'm' },
    { id: 'F_kN', label: 'Applied Load F', symbol: 'F', value: 18, min: 2, max: 60, step: 1, unit: 'kN' },
  ],
  calculations: [
    {
      id: 'M_max',
      label: 'Maximum Bending Moment (F·L)',
      symbol: 'M_{max}',
      formula: 'F_kN * L',
      unit: 'kN·m',
      latex: 'M_{\\max} = F \\cdot L',
    },
    {
      id: 'sigma_bend',
      label: 'Peak Fibre Bending Stress',
      symbol: '\\sigma_b',
      formula: '((F_kN * 1000 * L) / ((b_beam * (h_beam ^ 2)) / 6)) / 1000000',
      unit: 'MPa',
      latex: '\\sigma_b = \\frac{6 M}{b h^2}',
      limit: { kind: 'max', value: 250, label: 'S275 Yield 250 MPa' },
    },
    {
      id: 'delta_tip',
      label: 'Cantilever Tip Deflection (E = 205 GPa)',
      symbol: '\\delta',
      formula: '((F_kN * 1000 * (L ^ 3)) / (3 * 205000000000 * ((b_beam * (h_beam ^ 3)) / 12))) * 1000',
      unit: 'mm',
      latex: '\\delta = \\frac{F L^3}{3 E I}',
    },
  ],
  parts: [
    {
      id: 'support-pedestal',
      name: 'Clamped Anchor Column Support',
      material: 'castIron',
      role: 'housing',
      cut: true,
      position: ['-L * 0.5 - 0.035', -0.02, 0],
      explode: [-0.1, 0, 0],
      info: {
        summary: 'Rigid fixed wall pedestal reacting the root bending moment and vertical shear.',
      },
      shapes: [
        {
          kind: 'box',
          sx: 0.075,
          sy: 0.22,
          sz: 0.14,
          position: [0, 0, 0],
        },
      ],
    },
    {
      id: 'steel-girder-beam',
      name: 'Structural Steel Beam Section',
      material: 'steel',
      role: 'static',
      cut: false,
      explode: [0, 0.06, 0],
      info: {
        summary: 'Structural steel beam carrying bending moment M(x) and shear V(x).',
      },
      shapes: [
        {
          kind: 'box',
          sx: 'L',
          sy: 'h_beam',
          sz: 'b_beam',
          position: [0, 0, 0],
        },
      ],
    },
    {
      id: 'load-applicator',
      name: 'Hydraulic Tip Load Ram (F)',
      material: 'paintYellow',
      role: 'moving',
      cut: false,
      position: ['L * 0.42', 'h_beam * 0.5 + 0.045', 0],
      explode: [0, 0.12, 0],
      info: {
        summary: 'Point-load clevis applying downward shear force F near the free tip.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 0.018,
          h: 0.08,
          position: [0, 0, 0],
        },
      ],
    },
  ],
}

// ============================================================================
// 10. FLANGED SHAFT COUPLING
// ============================================================================
export const COUPLING_WITH_CALCS_SPEC: NoteSceneSpec = {
  ...FLANGED_COUPLING_SPEC,
  id: 'create-flanged-coupling',
  parameters: [
    ...FLANGED_COUPLING_SPEC.parameters,
    { id: 'T', label: 'Transmitted Torque T', symbol: 'T', value: 1800, min: 300, max: 5000, step: 50, unit: 'N·m' },
    { id: 'bolts', label: 'Number of Bolts N', symbol: 'N', value: 6, min: 4, max: 12, step: 1, unit: 'bolts' },
    { id: 'boltD', label: 'Bolt Diameter d_b', symbol: 'd_b', value: 0.016, min: 0.01, max: 0.024, step: 0.002, unit: 'm' },
  ],
  calculations: [
    {
      id: 'tau_shaft',
      label: 'Shaft Torsional Shear Stress',
      symbol: '\\tau_s',
      formula: '(16 * T) / (pi * (shaftD ^ 3)) / 1000000',
      unit: 'MPa',
      latex: '\\tau_s = \\frac{16 T}{\\pi d^3}',
      limit: { kind: 'max', value: 115, label: 'Allowable 115 MPa' },
    },
    {
      id: 'F_bolt',
      label: 'Shear Load per Bolt',
      symbol: 'F_b',
      formula: '(2 * T) / (bolts * pcd) / 1000',
      unit: 'kN',
      latex: 'F_b = \\frac{2 T}{N \\cdot D_p}',
    },
    {
      id: 'tau_bolt',
      label: 'Bolt Shear Stress',
      symbol: '\\tau_b',
      formula: '((2 * T) / (bolts * pcd)) / (pi * ((boltD / 2) ^ 2)) / 1000000',
      unit: 'MPa',
      latex: '\\tau_b = \\frac{4 F_b}{\\pi d_b^2}',
      limit: { kind: 'max', value: 150, label: 'Allowable 150 MPa' },
    },
    {
      id: 'sf_bolt',
      label: 'Bolt Factor of Safety',
      symbol: 'n_{SF}',
      formula: '150 / tau_bolt',
      unit: '×',
      latex: 'n_{\\text{SF}} = \\frac{\\tau_{\\text{allow}}}{\\tau_b}',
      limit: { kind: 'min', value: 1.5, label: 'Min 1.5×' },
    },
  ],
}

// ============================================================================
// 11. MAIZE SHELLER / ROTARY DRUM THRESHER
// ============================================================================
export const MAIZE_SHELLER_SPEC: NoteSceneSpec = {
  id: 'create-maize-sheller',
  title: 'Agricultural Maize Sheller Threshing Drum & Belt Drive',
  summary:
    'Peg-tooth threshing drum driven by a V-belt reduction pulley inside a perforated concave screen and sheet-steel top hood.',
  units: 'mm',
  extent: 0.56,
  floorY: -0.22,
  camera: {
    position: [0.62, 0.44, 0.68],
    target: [0, 0, 0],
  },
  recommendedCut: {
    enabled: true,
    normal: [0, 0, 1],
    pos: 0.02,
  },
  parameters: [
    { id: 'P', label: 'Engine Power P', symbol: 'P', value: 5.5, min: 1.5, max: 15, step: 0.5, unit: 'kW' },
    { id: 'n_motor', label: 'Motor Speed n₁', symbol: 'n_1', value: 1440, min: 800, max: 2200, step: 20, unit: 'rpm' },
    { id: 'd_driver', label: 'Driver Pulley ØD₁', symbol: 'D_1', value: 0.11, min: 0.07, max: 0.18, step: 0.005, unit: 'm' },
    { id: 'd_driven', label: 'Drum Pulley ØD₂', symbol: 'D_2', value: 0.22, min: 0.14, max: 0.34, step: 0.01, unit: 'm' },
    { id: 'drumD', label: 'Threshing Drum ØD_d', symbol: 'D_d', value: 0.24, min: 0.16, max: 0.34, step: 0.01, unit: 'm' },
    { id: 'drumL', label: 'Threshing Drum Length L', symbol: 'L_d', value: 0.36, min: 0.22, max: 0.52, step: 0.02, unit: 'm' },
    { id: 'pegRows', label: 'Peg Count per Ring', symbol: 'N_p', value: 8, min: 4, max: 12, step: 1, unit: 'pegs' },
  ],
  calculations: [
    {
      id: 'i_belt',
      label: 'Belt Drive Ratio',
      symbol: 'i_{belt}',
      formula: 'd_driven / d_driver',
      unit: ': 1',
      latex: 'i = \\frac{D_2}{D_1}',
    },
    {
      id: 'n_drum',
      label: 'Drum Rotational Speed',
      symbol: 'n_d',
      formula: 'n_motor / i_belt',
      unit: 'rpm',
      latex: 'n_d = \\frac{n_1}{i}',
    },
    {
      id: 'v_tip',
      label: 'Peg Peripheral Tip Speed',
      symbol: 'v_t',
      formula: '(pi * (drumD + 0.05) * n_drum) / 60',
      unit: 'm/s',
      latex: 'v_t = \\frac{\\pi D_{\\text{tip}} n_d}{60}',
      limit: { kind: 'max', value: 14.5, label: 'Grain Crack Limit 14.5 m/s' },
    },
    {
      id: 'T_drum',
      label: 'Threshing Drum Torque',
      symbol: 'T_d',
      formula: '(0.94 * P * 1000 * 60) / (2 * pi * n_drum)',
      unit: 'N·m',
      latex: 'T_d = \\frac{60 \\, \\eta P}{2\\pi n_d}',
    },
    {
      id: 'Q_cap',
      label: 'Estimated Shelling Capacity',
      symbol: 'Q',
      formula: 'drumL * drumD * n_drum * 18.5',
      unit: 'kg/h',
      latex: 'Q \\propto L_d D_d n_d',
    },
  ],
  parts: [
    {
      id: 'sheller-hood',
      name: 'Sheet-Steel Threshing Hood & Concave Casing',
      material: 'paintGreen',
      role: 'housing',
      cut: true,
      explode: [0, 0.16, 0],
      rotation: [0, 0, Math.PI / 2],
      info: {
        summary: 'Cylindrical threshing chamber housing with lower concave clearance around the peg drum.',
        role: 'Retains maize cobs against the rotating threshing pegs while kernels pass through the concave.',
      },
      shapes: [
        {
          kind: 'tube',
          rOuter: 'drumD / 2 + 0.055',
          rInner: 'drumD / 2 + 0.042',
          h: 'drumL + 0.04',
          position: [0, 0, 0],
        },
      ],
    },
    {
      id: 'threshing-drum',
      name: 'Peg-Tooth Threshing Rotor Drum',
      material: 'steel',
      role: 'moving',
      cut: false,
      rotation: [0, 0, Math.PI / 2],
      explode: [0, 0.04, 0],
      motion: {
        kind: 'rotate',
        axis: 'y',
        speed: '(n_motor / (d_driven / d_driver)) / 60 * 0.4',
      },
      info: {
        summary: 'Balanced steel cylinder fitted with radial threshing pegs on a central main shaft.',
        role: 'Strips maize kernels from cobs by impact and rubbing action.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 0.02,
          h: 'drumL + 0.22',
          position: [0, -0.03, 0],
        },
        {
          kind: 'cylinder',
          r: 'drumD / 2',
          h: 'drumL',
          position: [0, 0, 0],
        },
        {
          kind: 'cylinder',
          r: 0.008,
          h: 0.05,
          radialCount: 'pegRows',
          radialRadius: 'drumD / 2 + 0.015',
          rotation: [0, 0, Math.PI / 2],
          position: [0, '-drumL * 0.28', 0],
        },
        {
          kind: 'cylinder',
          r: 0.008,
          h: 0.05,
          radialCount: 'pegRows',
          radialRadius: 'drumD / 2 + 0.015',
          rotation: [0, 0, Math.PI / 2],
          position: [0, 0, 0],
        },
        {
          kind: 'cylinder',
          r: 0.008,
          h: 0.05,
          radialCount: 'pegRows',
          radialRadius: 'drumD / 2 + 0.015',
          rotation: [0, 0, Math.PI / 2],
          position: [0, 'drumL * 0.28', 0],
        },
      ],
    },
    {
      id: 'driven-pulley',
      name: 'Driven V-Belt Sheave (ØD₂)',
      material: 'castIron',
      role: 'moving',
      cut: false,
      position: ['drumL / 2 + 0.08', 0, 0],
      rotation: [0, 0, Math.PI / 2],
      explode: [0.12, 0, 0],
      motion: {
        kind: 'rotate',
        axis: 'y',
        speed: '(n_motor / (d_driven / d_driver)) / 60 * 0.4',
      },
      info: {
        summary: 'Cast-iron V-belt sheave keyed to the threshing drum shaft.',
        role: 'Steps down motor speed by ratio D₂ / D₁.',
      },
      shapes: [
        {
          kind: 'pulley',
          rOuter: 'd_driven / 2',
          rInner: 0.02,
          h: 0.034,
          position: [0, 0, 0],
        },
      ],
    },
  ],
}

// ============================================================================
// 12. ECCENTRIC CAM & HELICAL SPRING RETURN PRESS
// ============================================================================
export const ECCENTRIC_CAM_PRESS_SPEC: NoteSceneSpec = {
  id: 'create-eccentric-cam-press',
  title: 'Eccentric Cam & Helical Spring Return Press',
  summary:
    'Rotating eccentric cam disc driving a vertical reciprocating ram with a helical compression return spring inside a cast-iron guide frame.',
  units: 'mm',
  extent: 0.38,
  floorY: -0.18,
  camera: {
    position: [0.42, 0.28, 0.48],
    target: [0, 0, 0],
  },
  recommendedCut: {
    enabled: true,
    normal: [0, 0, 1],
    pos: 0,
  },
  parameters: [
    { id: 'rpm', label: 'Cam Speed n', symbol: 'n', value: 180, min: 30, max: 600, step: 10, unit: 'rpm' },
    { id: 'ecc', label: 'Cam Eccentricity e', symbol: 'e', value: 0.022, min: 0.008, max: 0.04, step: 0.002, unit: 'm' },
    { id: 'camR', label: 'Cam Base Radius R', symbol: 'R', value: 0.055, min: 0.035, max: 0.08, step: 0.005, unit: 'm' },
    { id: 'wireD', label: 'Spring Wire Diameter d', symbol: 'd_w', value: 0.007, min: 0.004, max: 0.012, step: 0.0005, unit: 'm' },
    { id: 'coilD', label: 'Spring Mean Coil ØD', symbol: 'D_s', value: 0.054, min: 0.036, max: 0.076, step: 0.002, unit: 'm' },
    { id: 'coils', label: 'Active Coils N_a', symbol: 'N_a', value: 7, min: 4, max: 14, step: 1, unit: 'coils' },
  ],
  calculations: [
    {
      id: 'stroke',
      label: 'Total Ram Stroke (2e)',
      symbol: 'S',
      formula: '2 * ecc * 1000',
      unit: 'mm',
      latex: 'S = 2e',
    },
    {
      id: 'v_max',
      label: 'Peak Plunger Velocity',
      symbol: 'v_{max}',
      formula: '(2 * pi * rpm / 60) * ecc',
      unit: 'm/s',
      latex: 'v_{\\max} = \\omega \\, e',
    },
    {
      id: 'k_spring',
      label: 'Spring Stiffness k (G = 79 GPa)',
      symbol: 'k',
      formula: '(79000000000 * (wireD ^ 4)) / (8 * (coilD ^ 3) * coils) / 1000',
      unit: 'N/mm',
      latex: 'k = \\frac{G d_w^4}{8 D_s^3 N_a}',
    },
    {
      id: 'F_peak',
      label: 'Peak Return Spring Force',
      symbol: 'F_{max}',
      formula: 'k_spring * (stroke + 10)',
      unit: 'N',
      latex: 'F_{\\max} = k (2e + \\delta_0)',
    },
    {
      id: 'tau_spring',
      label: 'Spring Torsional Shear Stress',
      symbol: '\\tau_s',
      formula: '(8 * F_peak * coilD) / (pi * (wireD ^ 3)) * 1.18 / 1000000',
      unit: 'MPa',
      latex: '\\tau = K_W \\frac{8 F_{\\max} D_s}{\\pi d_w^3}',
      limit: { kind: 'max', value: 520, label: 'Allowable 520 MPa' },
    },
  ],
  parts: [
    {
      id: 'press-frame',
      name: 'Cast-Iron Guide Frame',
      material: 'castIron',
      role: 'housing',
      cut: true,
      explode: [0, 0, -0.09],
      info: {
        summary: 'Vertical C-frame guide housing supporting the reciprocating plunger and return spring.',
      },
      shapes: [
        {
          kind: 'tube',
          rOuter: 'coilD * 0.78',
          rInner: 'coilD * 0.6',
          h: 0.14,
          position: [0, 0.04, 0],
        },
        {
          kind: 'box',
          sx: 0.18,
          sy: 0.022,
          sz: 0.14,
          position: [0, -0.15, 0],
        },
      ],
    },
    {
      id: 'eccentric-cam',
      name: 'Rotating Eccentric Cam Disc',
      material: 'bronze',
      role: 'moving',
      cut: false,
      position: [0, -0.08, 0],
      rotation: [Math.PI / 2, 0, 0],
      explode: [0, -0.06, 0.08],
      motion: {
        kind: 'rotate',
        axis: 'y',
        speed: 'rpm / 60 * 0.5',
      },
      info: {
        summary: 'Circular cam disc mounted with eccentricity e from the input driveshaft.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 'camR',
          h: 0.032,
          position: ['ecc', 0, 0],
        },
        {
          kind: 'cylinder',
          r: 0.012,
          h: 0.09,
          position: [0, 0, 0],
        },
      ],
    },
    {
      id: 'return-spring',
      name: 'Helical Compression Return Spring',
      material: 'steelDark',
      role: 'moving',
      cut: false,
      position: [0, 0.04, 0],
      explode: [0, 0.12, 0],
      info: {
        summary: 'Helical spring keeping the follower shoe in positive contact with the cam profile.',
      },
      shapes: [
        {
          kind: 'spring',
          r: 'coilD / 2',
          wireRadius: 'wireD / 2',
          h: 0.11,
          turns: 'coils',
          position: [0, 0, 0],
        },
      ],
    },
    {
      id: 'follower-plunger',
      name: 'Reciprocating Follower Ram',
      material: 'chrome',
      role: 'moving',
      cut: false,
      position: [0, 0.04, 0],
      explode: [0, 0.08, 0],
      motion: {
        kind: 'translate',
        axis: 'y',
        speed: 'rpm / 60 * 0.5',
        amplitude: 'ecc',
      },
      info: {
        summary: 'Hard-chrome ground plunger translating vertically by stroke S = 2e.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 0.014,
          h: 0.18,
          position: [0, 0.02, 0],
        },
        {
          kind: 'cylinder',
          r: 'coilD * 0.52',
          h: 0.012,
          position: [0, -0.04, 0],
        },
      ],
    },
  ],
}

// ============================================================================
// 13. JOURNAL BEARING PLUMMER BLOCK
// ============================================================================
export const PLUMMER_BLOCK_WITH_CALCS_SPEC: NoteSceneSpec = {
  ...BEARING_BRACKET_ORTHO_SPEC,
  id: 'create-plummer-block',
  parameters: [
    ...BEARING_BRACKET_ORTHO_SPEC.parameters,
    { id: 'W', label: 'Radial Bearing Load W', symbol: 'W', value: 8.5, min: 1, max: 30, step: 0.5, unit: 'kN' },
    { id: 'rpm', label: 'Journal Speed n', symbol: 'n', value: 900, min: 100, max: 2400, step: 50, unit: 'rpm' },
  ],
  calculations: [
    {
      id: 'p_bearing',
      label: 'Projected Bearing Pressure',
      symbol: 'p',
      formula: '(W * 1000) / (boreD * 0.076) / 1000000',
      unit: 'MPa',
      latex: 'p = \\frac{W}{d \\cdot L}',
      limit: { kind: 'max', value: 3.5, label: 'Max 3.5 MPa' },
    },
    {
      id: 'v_journal',
      label: 'Journal Surface Speed',
      symbol: 'U',
      formula: '(pi * boreD * rpm) / 60',
      unit: 'm/s',
      latex: 'U = \\frac{\\pi d n}{60}',
    },
    {
      id: 'pv_factor',
      label: 'Bearing PV Factor',
      symbol: 'pV',
      formula: 'p_bearing * v_journal',
      unit: 'MPa·m/s',
      latex: 'pV = p \\cdot U',
      limit: { kind: 'max', value: 6.5, label: 'Bronze Limit 6.5' },
    },
  ],
}

export interface CreatePresetTemplate {
  id: string
  title: string
  prompt: string
  tag: string
  spec: NoteSceneSpec
}

export const CREATE_TEMPLATES: CreatePresetTemplate[] = [
  {
    id: 'two-stage-reducer',
    title: 'Two-Stage Gear Reducer',
    prompt: 'A two-stage spur gear reducer, 20 : 1, for a 15 kW motor at 1450 rpm.',
    tag: 'Gearbox · Power Transmission',
    spec: TWO_STAGE_REDUCER_SPEC,
  },
  {
    id: 'planetary-gearset',
    title: 'Planetary Gear Set',
    prompt: 'A planetary epicyclic gear set with an 18-tooth sun gear and 3 planet gears for an 18 kW drive.',
    tag: 'Epicyclic · Powertrain',
    spec: PLANETARY_GEARSET_SPEC,
  },
  {
    id: 'centrifugal-pump',
    title: 'Centrifugal Water Pump',
    prompt: 'A centrifugal volute water pump with a 220 mm 6-vane bronze impeller running at 1750 rpm.',
    tag: 'Fluid Machinery · Irrigation',
    spec: CENTRIFUGAL_PUMP_SPEC,
  },
  {
    id: 'hydraulic-cylinder',
    title: 'Hydraulic Cylinder',
    prompt: 'A double-acting hydraulic cylinder with a 100 mm bore and 55 mm chrome rod at 180 bar.',
    tag: 'Hydraulics · Actuators',
    spec: HYDRAULIC_CYLINDER_SPEC,
  },
  {
    id: 'piston-engine',
    title: 'Piston Engine',
    prompt: 'A single-cylinder four-stroke diesel piston engine, 95 mm bore × 110 mm stroke at 2200 rpm.',
    tag: 'Engines · Slider-Crank',
    spec: PISTON_ENGINE_SPEC,
  },
  {
    id: 'maize-sheller',
    title: 'Maize Sheller Drum',
    prompt: 'A 5.5 kW maize sheller peg-tooth threshing drum and V-belt reduction drive.',
    tag: 'Agri-Machinery · Threshing',
    spec: MAIZE_SHELLER_SPEC,
  },
  {
    id: 'flanged-coupling',
    title: 'Flanged Shaft Coupling',
    prompt: 'A cast-iron flanged shaft coupling for a 45 mm shaft with 6 bolts transmitting 1.8 kN·m.',
    tag: 'Machine Elements · Fasteners',
    spec: COUPLING_WITH_CALCS_SPEC,
  },
  {
    id: 'eccentric-cam-press',
    title: 'Cam & Spring Press',
    prompt: 'An eccentric cam and helical compression return spring mechanism running at 180 rpm.',
    tag: 'Kinematics · Cam & Spring',
    spec: ECCENTRIC_CAM_PRESS_SPEC,
  },
]

// ============================================================================
// CATALOG SCENE MATCHER (Matches all ~115 ready scenes across MODULES)
// ============================================================================
export interface CatalogSceneMatch {
  module: ModuleDef
  scene: SceneEntry
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'for', 'with', 'and', 'or', 'in', 'on', 'to', 'at', 'by', 'from',
  'model', 'machine', 'build', 'create', 'make', 'design', 'show', 'me', 'our', 'my', '3d',
])

export function matchCatalogSceneFromPrompt(prompt: string): CatalogSceneMatch | null {
  const lower = prompt.toLowerCase()
  const tokens = lower
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  if (tokens.length === 0) return null

  let best: CatalogSceneMatch | null = null
  let bestScore = 0

  for (const mod of MODULES) {
    for (const sc of mod.scenes) {
      if (!sc.load) continue
      const titleLower = sc.title.toLowerCase()
      const idLower = sc.id.toLowerCase()
      const summaryLower = sc.summary.toLowerCase()

      let score = 0
      if (lower.includes(titleLower)) score += 12
      if (lower.includes(idLower.replace(/-/g, ' '))) score += 10

      for (const tok of tokens) {
        if (idLower.split('-').includes(tok)) score += 5
        else if (titleLower.includes(tok)) score += 4
        else if (summaryLower.includes(tok)) score += 1.5
      }

      if (score > bestScore) {
        bestScore = score
        best = { module: mod, scene: sc }
      }
    }
  }

  return bestScore >= 4 ? best : null
}

// ============================================================================
// UNIVERSAL CUSTOM MACHINE SYNTHESIZER
// ============================================================================
let customBuildSeq = 1

function extractTitleFromPrompt(prompt: string): string {
  const cleaned = prompt
    .replace(/^(?:(?:build|create|make|design|model|show|generate)\s+(?:me\s+)?)?(?:a|an|the|our|my)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return 'Custom Parametric Machine Assembly'
  const words = cleaned.split(' ').slice(0, 9)
  return words
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/[.,;:!?]+$/, '')
}

function synthesizeCustomMachineSpec(prompt: string): NoteSceneSpec {
  const lower = prompt.toLowerCase()
  const title = extractTitleFromPrompt(prompt)
  const slug = `create-custom-${customBuildSeq++}`

  // Choose base archetype closest to the words in the prompt
  let base: NoteSceneSpec
  if (lower.includes('planetary') || lower.includes('epicyclic')) {
    base = cloneSpec(PLANETARY_GEARSET_SPEC)
  } else if (
    lower.includes('pump') ||
    lower.includes('impeller') ||
    lower.includes('turbine') ||
    lower.includes('fan') ||
    lower.includes('blower') ||
    lower.includes('compressor') ||
    lower.includes('cyclone')
  ) {
    base = cloneSpec(CENTRIFUGAL_PUMP_SPEC)
  } else if (
    lower.includes('hydraulic') ||
    lower.includes('cylinder') ||
    lower.includes('actuator') ||
    lower.includes('ram') ||
    lower.includes('jack')
  ) {
    base = cloneSpec(HYDRAULIC_CYLINDER_SPEC)
  } else if (
    lower.includes('engine') ||
    lower.includes('diesel') ||
    lower.includes('petrol') ||
    lower.includes('piston') ||
    lower.includes('crank') ||
    lower.includes('four-stroke') ||
    lower.includes('two-stroke')
  ) {
    base = cloneSpec(PISTON_ENGINE_SPEC)
  } else if (
    lower.includes('belt') ||
    lower.includes('pulley') ||
    lower.includes('sheave') ||
    lower.includes('chain') ||
    lower.includes('conveyor')
  ) {
    base = cloneSpec(BELT_DRIVE_SPEC)
  } else if (lower.includes('brake') || lower.includes('clutch') || lower.includes('caliper') || lower.includes('flywheel')) {
    base = cloneSpec(DISC_BRAKE_SPEC)
  } else if (
    lower.includes('heat') ||
    lower.includes('exchanger') ||
    lower.includes('boiler') ||
    lower.includes('condenser') ||
    lower.includes('evaporator') ||
    lower.includes('silo') ||
    lower.includes('tank') ||
    lower.includes('vessel') ||
    lower.includes('digester') ||
    lower.includes('dryer')
  ) {
    base = cloneSpec(HEAT_EXCHANGER_SPEC)
  } else if (
    lower.includes('beam') ||
    lower.includes('cantilever') ||
    lower.includes('truss') ||
    lower.includes('column') ||
    lower.includes('girder') ||
    lower.includes('bridge') ||
    lower.includes('frame')
  ) {
    base = cloneSpec(STRUCTURAL_BEAM_SPEC)
  } else if (
    lower.includes('sheller') ||
    lower.includes('thresh') ||
    lower.includes('maize') ||
    lower.includes('drum') ||
    lower.includes('mill') ||
    lower.includes('roaster') ||
    lower.includes('mixer') ||
    lower.includes('auger') ||
    lower.includes('harvester') ||
    lower.includes('plough') ||
    lower.includes('harrow') ||
    lower.includes('planter') ||
    lower.includes('sprayer')
  ) {
    base = cloneSpec(MAIZE_SHELLER_SPEC)
  } else if (lower.includes('coupling') || lower.includes('flange') || lower.includes('shaft') || lower.includes('torsion') || lower.includes('pto')) {
    base = cloneSpec(COUPLING_WITH_CALCS_SPEC)
  } else if (lower.includes('cam') || lower.includes('spring') || lower.includes('valve') || lower.includes('governor') || lower.includes('press')) {
    base = cloneSpec(ECCENTRIC_CAM_PRESS_SPEC)
  } else if (lower.includes('bearing') || lower.includes('plummer') || lower.includes('pedestal') || lower.includes('journal') || lower.includes('bracket')) {
    base = cloneSpec(PLUMMER_BLOCK_WITH_CALCS_SPEC)
  } else {
    base = cloneSpec(TWO_STAGE_REDUCER_SPEC)
  }

  base.id = slug
  base.title = title
  base.summary = `Custom parametric 3D assembly generated for “${prompt.trim()}” with sectioned housing, animated moving elements, and live engineering calculations.`
  return base
}

function cloneSpec(spec: NoteSceneSpec): NoteSceneSpec {
  return JSON.parse(JSON.stringify(spec)) as NoteSceneSpec
}

function setParamValue(spec: NoteSceneSpec, id: string, nextVal: number): boolean {
  const p = spec.parameters.find((x) => x.id === id)
  if (!p) return false
  p.value = nextVal
  if (nextVal < p.min) p.min = Math.max(0.0001, Number((nextVal * 0.5).toPrecision(3)))
  if (nextVal > p.max) p.max = Number((nextVal * 1.4).toPrecision(3))
  return true
}

function updateMaterialsInParts(parts: NotePartSpec[], targetPartKeyword: string | null, mat: MaterialKey): string[] {
  const changed: string[] = []
  for (const part of parts) {
    const match =
      !targetPartKeyword ||
      part.name.toLowerCase().includes(targetPartKeyword) ||
      part.id.toLowerCase().includes(targetPartKeyword) ||
      (targetPartKeyword === 'housing' && part.role === 'housing')
    if (match) {
      part.material = mat
      changed.push(part.name)
    }
    if (part.children?.length) {
      changed.push(...updateMaterialsInParts(part.children, targetPartKeyword, mat))
    }
  }
  return changed
}

/**
 * Determines if the user prompt is requesting an edit/question on the existing model
 * vs describing a machine to build.
 */
function isEditOrQuestionPrompt(prompt: string, currentSpec?: NoteSceneSpec): boolean {
  if (!currentSpec) return false
  const lower = prompt.trim().toLowerCase()

  // Questions about the current model
  if (/^(why|how|what|explain|calculate|is\s+this|can\s+this)\b/.test(lower)) {
    return true
  }

  // Starts with an explicit edit verb
  if (
    /^(make|set|change|increase|decrease|reduce|double|halve|switch|use|update|modify|adjust|add|remove|lengthen|shorten|widen)\b/.test(
      lower,
    )
  ) {
    return true
  }

  // Comparative edits like "40 mm longer", "20% faster", "aluminium housing"
  if (/\b(longer|shorter|wider|narrower|taller|thicker|thinner|bigger|smaller|faster|slower)\b/.test(lower)) {
    return true
  }

  // Pure material or parameter assignment without describing a machine noun
  const machineNouns = [
    'reducer', 'gearbox', 'planetary', 'epicyclic', 'pump', 'impeller', 'turbine', 'cylinder',
    'actuator', 'engine', 'diesel', 'petrol', 'piston', 'belt', 'pulley', 'brake', 'clutch',
    'caliper', 'exchanger', 'boiler', 'beam', 'cantilever', 'truss', 'sheller', 'thresher',
    'maize', 'mill', 'roaster', 'mixer', 'conveyor', 'auger', 'coupling', 'cam', 'press',
    'bearing', 'plummer', 'pedestal', 'linkage', 'four-bar', 'slider-crank', 'geneva',
    'governor', 'flywheel', 'plough', 'harrow', 'planter', 'sprayer', 'harvester', 'tractor',
  ]
  const mentionsMachineNoun = machineNouns.some((n) => lower.includes(n))
  if (!mentionsMachineNoun) {
    return true
  }

  return false
}

export interface BuildOrRefineResult {
  spec: NoteSceneSpec
  explanation: string
  isNewMachine: boolean
  matchedCatalogScene: CatalogSceneMatch | null
}

/**
 * Parses a natural-language machine description or design-by-chat refinement instruction
 * and returns a tailored `NoteSceneSpec`, an explanation of what was built or modified,
 * and an optional matched catalog scene from `MODULES`.
 */
export function buildOrRefineModelFromText(
  prompt: string,
  currentSpec?: NoteSceneSpec,
): BuildOrRefineResult {
  const lower = prompt.toLowerCase()
  const changes: string[] = []
  const matchedCatalogScene = matchCatalogSceneFromPrompt(prompt)

  const isEdit = isEditOrQuestionPrompt(prompt, currentSpec)
  let spec: NoteSceneSpec
  let isNewMachine = false

  if (!isEdit || !currentSpec) {
    isNewMachine = true
    if (lower.includes('planetary') || lower.includes('epicyclic')) {
      spec = cloneSpec(PLANETARY_GEARSET_SPEC)
      changes.push('Constructed Planetary (Epicyclic) Gear Set with central sun gear (z_S), 3 orbiting planet gears (z_P), carrier, and internal ring gear (z_R).')
    } else if (lower.includes('pump') || lower.includes('impeller') || lower.includes('volute') || lower.includes('centrifugal')) {
      spec = cloneSpec(CENTRIFUGAL_PUMP_SPEC)
      changes.push('Constructed Centrifugal Volute Pump with sectioned spiral casing, radial vane bronze impeller, and suction/discharge nozzles.')
    } else if (lower.includes('hydraulic') || (lower.includes('cylinder') && !lower.includes('engine') && !lower.includes('diesel')) || lower.includes('actuator')) {
      spec = cloneSpec(HYDRAULIC_CYLINDER_SPEC)
      changes.push('Constructed Double-Acting Hydraulic Cylinder with honed steel barrel, reciprocating piston, and hard-chrome rod.')
    } else if (lower.includes('engine') || lower.includes('diesel') || lower.includes('petrol') || lower.includes('piston') || lower.includes('slider-crank') || lower.includes('four-stroke')) {
      spec = cloneSpec(PISTON_ENGINE_SPEC)
      changes.push('Constructed Reciprocating Piston Engine with sectioned finned cylinder block, aluminium piston, crankshaft, and flywheel.')
    } else if ((lower.includes('belt') || lower.includes('pulley') || lower.includes('sheave')) && !lower.includes('sheller')) {
      spec = cloneSpec(BELT_DRIVE_SPEC)
      changes.push('Constructed Two-Pulley V-Belt Power Transmission Drive with driver sheave, driven sheave, and safety guard.')
    } else if (lower.includes('brake') || lower.includes('caliper') || lower.includes('rotor disc')) {
      spec = cloneSpec(DISC_BRAKE_SPEC)
      changes.push('Constructed Ventilated Disc Brake Rotor and straddling Hydraulic Caliper assembly.')
    } else if (lower.includes('heat exchanger') || lower.includes('shell and tube') || lower.includes('shell-and-tube') || lower.includes('condenser') || lower.includes('boiler')) {
      spec = cloneSpec(HEAT_EXCHANGER_SPEC)
      changes.push('Constructed Shell-and-Tube Heat Exchanger with sectioned pressure shell, copper tube bundle, and tube sheets.')
    } else if (lower.includes('beam') || lower.includes('cantilever') || lower.includes('girder') || lower.includes('bending')) {
      spec = cloneSpec(STRUCTURAL_BEAM_SPEC)
      changes.push('Constructed Structural Steel Beam Bending Rig with fixed anchor support, steel girder section, and hydraulic tip load ram.')
    } else if (lower.includes('sheller') || lower.includes('thresh') || lower.includes('maize')) {
      spec = cloneSpec(MAIZE_SHELLER_SPEC)
      changes.push('Constructed Peg-Tooth Maize Sheller Threshing Drum, concave hood, and V-belt reduction drive.')
    } else if (lower.includes('coupling') || lower.includes('flange')) {
      spec = cloneSpec(COUPLING_WITH_CALCS_SPEC)
      changes.push('Constructed Rigid Flanged Shaft Coupling with coaxial shafts, cast-iron flanged hubs, and bolt circle.')
    } else if (lower.includes('cam') || lower.includes('spring') || lower.includes('press')) {
      spec = cloneSpec(ECCENTRIC_CAM_PRESS_SPEC)
      changes.push('Constructed Eccentric Cam & Helical Return Spring Press with reciprocating follower ram.')
    } else if (lower.includes('bearing') || lower.includes('plummer') || lower.includes('pedestal')) {
      spec = cloneSpec(PLUMMER_BLOCK_WITH_CALCS_SPEC)
      changes.push('Constructed Cast-Iron Journal Bearing Plummer Block Pedestal with bronze bushing.')
    } else if (lower.includes('reducer') || lower.includes('gearbox') || lower.includes('spur gear')) {
      spec = cloneSpec(TWO_STAGE_REDUCER_SPEC)
      changes.push('Constructed Two-Stage Spur Gear Reducer with meshing pinions (z₁, z₃), driven wheels (z₂, z₄), and sectioned housing.')
    } else {
      spec = synthesizeCustomMachineSpec(prompt)
      changes.push(`Synthesized custom 3D parametric assembly “${spec.title}” with ${spec.parts.length} cuttable/animatable parts and ${spec.calculations?.length ?? 0} live engineering formulas.`)
    }
    // Give every newly built machine a fresh revision suffix so <Stage> re-frames the camera
    spec.id = `${spec.id.replace(/-rev\d+$/, '')}-rev${customBuildSeq++}`
  } else {
    spec = cloneSpec(currentSpec)
  }

  // 2. Extract numerical engineering specifications & edits from the prompt
  // Power in kW (e.g. "15 kW", "22kW")
  const kwMatch = /(\d+(?:\.\d+)?)\s*kw\b/i.exec(prompt)
  if (kwMatch) {
    const kw = parseFloat(kwMatch[1])
    if (setParamValue(spec, 'P', kw)) {
      changes.push(`Set power P = ${kw} kW.`)
    }
  }

  // Speed in rpm (e.g. "1450 rpm", "900rpm")
  const rpmMatch = /(\d+(?:\.\d+)?)\s*rpm\b/i.exec(prompt)
  if (rpmMatch) {
    const rpm = parseFloat(rpmMatch[1])
    const u1 = setParamValue(spec, 'rpm', rpm)
    const u2 = setParamValue(spec, 'n_motor', rpm)
    if (u1 || u2) changes.push(`Set rotational speed n = ${rpm} rpm.`)
  }

  // Pressure in bar (e.g. "180 bar", "220 bar")
  const barMatch = /(\d+(?:\.\d+)?)\s*bar\b/i.exec(prompt)
  if (barMatch) {
    const bar = parseFloat(barMatch[1])
    if (setParamValue(spec, 'p_bar', bar) || setParamValue(spec, 'bmep', bar)) {
      changes.push(`Set operating pressure p = ${bar} bar.`)
    }
  }

  // Load / Force in kN (e.g. "12 kN", "25 kN")
  const knMatch = /(\d+(?:\.\d+)?)\s*kn\b/i.exec(prompt)
  if (knMatch && !lower.includes('kn·m') && !lower.includes('kn.m')) {
    const kn = parseFloat(knMatch[1])
    if (setParamValue(spec, 'W', kn) || setParamValue(spec, 'F_kN', kn)) {
      changes.push(`Set applied load = ${kn} kN.`)
    }
  }

  // Ratio (e.g. "20 : 1", "20:1", "16:1")
  const ratioMatch = /(\d+(?:\.\d+)?)\s*:\s*1\b/.exec(prompt)
  if (ratioMatch && spec.id.startsWith('create-two-stage-reducer')) {
    const targetRatio = Math.max(2, Math.min(36, parseFloat(ratioMatch[1])))
    const stageRatio = Math.sqrt(targetRatio)
    const z1 = spec.parameters.find((p) => p.id === 'z1')?.value ?? 16
    const z2 = Math.max(24, Math.min(96, Math.round(z1 * stageRatio)))
    const z3 = spec.parameters.find((p) => p.id === 'z3')?.value ?? 16
    const z4 = Math.max(24, Math.min(96, Math.round(z3 * (targetRatio / (z2 / z1)))))
    setParamValue(spec, 'z2', z2)
    setParamValue(spec, 'z4', z4)
    const actualRatio = ((z2 / z1) * (z4 / z3)).toFixed(2)
    changes.push(`Sized Stage-1 (${z2}/${z1}) and Stage-2 (${z4}/${z3}) gear pairs for overall ratio i = ${actualRatio} : 1.`)
  }

  // Relative or absolute length/size changes (e.g. "Make the output shaft 40 mm longer", "make it bigger")
  const longerMatch = /(\d+(?:\.\d+)?)\s*mm\s+(?:longer|wider|taller|bigger|larger)/i.exec(prompt)
  if (longerMatch) {
    const deltaM = parseFloat(longerMatch[1]) / 1000
    const extParam =
      spec.parameters.find((p) => ['shaftExt', 'drumL', 'stroke', 'tubeL', 'L', 'C', 'S'].includes(p.id)) ??
      spec.parameters.find((p) => p.unit === 'm')
    if (extParam) {
      const next = Number((extParam.value + deltaM).toFixed(3))
      setParamValue(spec, extParam.id, next)
      changes.push(`Increased ${extParam.label} by ${longerMatch[1]} mm to ${(next * 1000).toFixed(0)} mm.`)
    }
  } else if (/\b(longer|bigger|larger|wider|increase)\b/i.test(prompt) && !isNewMachine) {
    const extParam =
      spec.parameters.find((p) => ['shaftExt', 'drumL', 'stroke', 'tubeL', 'L', 'D2', 'boreD'].includes(p.id)) ??
      spec.parameters[0]
    if (extParam) {
      const next = Number((extParam.value * 1.25).toPrecision(3))
      setParamValue(spec, extParam.id, next)
      changes.push(
        `Increased ${extParam.label} by 25% to ${extParam.unit === 'm' ? `${(next * 1000).toFixed(0)} mm` : `${next} ${extParam.unit}`}.`,
      )
    }
  }

  const shorterMatch = /(\d+(?:\.\d+)?)\s*mm\s+(?:shorter|narrower|smaller|thinner)/i.exec(prompt)
  if (shorterMatch) {
    const deltaM = parseFloat(shorterMatch[1]) / 1000
    const extParam =
      spec.parameters.find((p) => ['shaftExt', 'drumL', 'stroke', 'tubeL', 'L', 'C', 'S'].includes(p.id)) ??
      spec.parameters.find((p) => p.unit === 'm')
    if (extParam) {
      const next = Math.max(0.015, Number((extParam.value - deltaM).toFixed(3)))
      setParamValue(spec, extParam.id, next)
      changes.push(`Reduced ${extParam.label} by ${shorterMatch[1]} mm to ${(next * 1000).toFixed(0)} mm.`)
    }
  } else if (/\b(shorter|smaller|narrower|decrease|reduce)\b/i.test(prompt) && !isNewMachine) {
    const extParam =
      spec.parameters.find((p) => ['shaftExt', 'drumL', 'stroke', 'tubeL', 'L', 'D2', 'boreD'].includes(p.id)) ??
      spec.parameters[0]
    if (extParam) {
      const next = Number((extParam.value * 0.8).toPrecision(3))
      setParamValue(spec, extParam.id, next)
      changes.push(
        `Reduced ${extParam.label} by 20% to ${extParam.unit === 'm' ? `${(next * 1000).toFixed(0)} mm` : `${next} ${extParam.unit}`}.`,
      )
    }
  }

  // Tooth count edits (e.g. "18 teeth", "pinion to 20 teeth")
  const teethMatch = /(\d+)\s*(?:teeth|tooth)/i.exec(prompt)
  if (teethMatch) {
    const z = parseInt(teethMatch[1], 10)
    if (lower.includes('wheel') || lower.includes('z2') || lower.includes('z4')) {
      setParamValue(spec, 'z2', z)
      changes.push(`Updated wheel tooth count to ${z} teeth.`)
    } else if (lower.includes('planet')) {
      setParamValue(spec, 'z_p', z)
      changes.push(`Updated planet gear tooth count z_P = ${z} teeth.`)
    } else {
      setParamValue(spec, 'z1', z)
      setParamValue(spec, 'z_s', z)
      changes.push(`Updated pinion/sun tooth count to ${z} teeth.`)
    }
  }

  // Bolt / peg / vane / tube count edits (e.g. "8 bolts", "8 vanes", "10 tubes")
  const countMatch = /(\d+)\s*(?:bolts|pegs|vanes|blades|tubes|coils)/i.exec(prompt)
  if (countMatch) {
    const n = parseInt(countMatch[1], 10)
    setParamValue(spec, 'bolts', n)
    setParamValue(spec, 'pegRows', n)
    setParamValue(spec, 'vanes', n)
    setParamValue(spec, 'tubes', n)
    setParamValue(spec, 'coils', n)
    changes.push(`Updated circular array count to ${n}.`)
  }

  // Diameter in mm (e.g. "bore 60 mm", "shaft 55 mm", "220 mm impeller")
  const mmMatch = /(\d+(?:\.\d+)?)\s*mm\b/i.exec(prompt)
  if (mmMatch && !longerMatch && !shorterMatch) {
    const dMeters = parseFloat(mmMatch[1]) / 1000
    if (lower.includes('rod')) {
      setParamValue(spec, 'rodD', dMeters)
      changes.push(`Set rod diameter to ${mmMatch[1]} mm.`)
    } else if (lower.includes('stroke')) {
      setParamValue(spec, 'stroke', dMeters)
      setParamValue(spec, 'S', dMeters)
      changes.push(`Set stroke to ${mmMatch[1]} mm.`)
    } else {
      const updated =
        setParamValue(spec, 'shaftD', dMeters) ||
        setParamValue(spec, 'boreD', dMeters) ||
        setParamValue(spec, 'drumD', dMeters) ||
        setParamValue(spec, 'D2', dMeters) ||
        setParamValue(spec, 'D_disc', dMeters) ||
        setParamValue(spec, 'shellD', dMeters) ||
        setParamValue(spec, 'B', dMeters)
      if (updated) changes.push(`Set primary diameter to ${mmMatch[1]} mm (${dMeters} m).`)
    }
  }

  // Torque in N·m or kN·m
  const knmMatch = /(\d+(?:\.\d+)?)\s*kn[·.]?m/i.exec(prompt)
  if (knmMatch) {
    const tNm = parseFloat(knmMatch[1]) * 1000
    setParamValue(spec, 'T', tNm)
    changes.push(`Set transmitted torque T = ${tNm} N·m.`)
  }

  // Material changes (e.g. "aluminium housing", "bronze gear", "brass")
  const matMap: [string, MaterialKey, string][] = [
    ['aluminium', 'aluminium', 'Aluminium alloy'],
    ['aluminum', 'aluminium', 'Aluminium alloy'],
    ['bronze', 'bronze', 'Phosphor bronze'],
    ['brass', 'brass', 'Brass'],
    ['chrome', 'chrome', 'Hard chrome'],
    ['cast iron', 'castIron', 'Cast iron'],
    ['copper', 'copper', 'Copper'],
    ['forged', 'forged', 'Forged alloy steel'],
    ['green', 'paintGreen', 'Painted steel (green)'],
    ['yellow', 'paintYellow', 'Painted steel (yellow)'],
    ['blue', 'paintBlue', 'Painted steel (blue)'],
    ['red', 'paintRed', 'Painted steel (red)'],
  ]
  for (const [kw, matKey, label] of matMap) {
    if (lower.includes(kw)) {
      const targetPart =
        lower.includes('housing') || lower.includes('casing') || lower.includes('hood') || lower.includes('shell')
          ? 'housing'
          : lower.includes('pinion') || lower.includes('sun')
            ? 'pinion'
            : lower.includes('shaft') || lower.includes('rod')
              ? 'shaft'
              : lower.includes('impeller') || lower.includes('rotor') || lower.includes('drum')
                ? 'impeller'
                : null
      const updated = updateMaterialsInParts(spec.parts, targetPart, matKey)
      if (updated.length > 0) {
        changes.push(`Changed material of ${updated.slice(0, 2).join(', ')} to ${label}.`)
      }
      break
    }
  }

  // Question answering ("Why isn't this 20:1?")
  if (lower.includes('why') && lower.includes('20')) {
    const z1 = spec.parameters.find((p) => p.id === 'z1')?.value ?? 16
    const z2 = spec.parameters.find((p) => p.id === 'z2')?.value ?? 72
    const z3 = spec.parameters.find((p) => p.id === 'z3')?.value ?? 16
    const z4 = spec.parameters.find((p) => p.id === 'z4')?.value ?? 72
    const actual = ((z2 / z1) * (z4 / z3)).toFixed(2)
    changes.push(
      `Gear teeth must be whole integers: with z₁=${z1}, z₂=${z2} (i₁=${(z2 / z1).toFixed(2)}) and z₃=${z3}, z₄=${z4} (i₂=${(z4 / z3).toFixed(2)}), the exact compound ratio is i = ${actual} : 1. Set z₁=16, z₂=64 (4:1) and z₃=16, z₄=80 (5:1) for an exact 20.00 : 1 ratio — updated now!`,
    )
    setParamValue(spec, 'z1', 16)
    setParamValue(spec, 'z2', 64)
    setParamValue(spec, 'z3', 16)
    setParamValue(spec, 'z4', 80)
  }

  if (matchedCatalogScene && isNewMachine) {
    changes.push(
      `Also matched full laboratory rig “${matchedCatalogScene.scene.title}” (${matchedCatalogScene.module.code} · ${matchedCatalogScene.module.title}).`,
    )
  }

  const explanation =
    changes.length > 0
      ? changes.join(' ')
      : `Updated ${spec.title} parameters and recalculated live engineering outputs.`

  return { spec, explanation, isNewMachine, matchedCatalogScene }
}
