import type { DetectedPageFigure, FigureCandidate, NoteSceneSpec } from './schema'


export interface TextbookParagraphBlock {
  kind: 'heading' | 'subheading' | 'paragraph' | 'equation' | 'example-box' | 'figure-slot'
  text?: string
  number?: string
  latex?: string
  figureId?: string
}

export interface RenderedTextbookPage {
  pageNumber: number
  /** High-DPI rendered page image (data URL) for Page-Fidelity overlay mode */
  pageImageUrl: string
  /** Aspect ratio (width / height), typically 1 / 1.414 (A4) or 8.5 / 11 */
  aspectRatio: number
  /** Extracted raw text of the page */
  pageText: string
  /** Structured blocks so both Page-Fidelity Overlay Mode and Reflowed Textbook Mode work */
  blocks: TextbookParagraphBlock[]
  /** Detected figures on this page whose 2D bounding boxes are replaced in-place by <InlineFigure3D> */
  figures: DetectedPageFigure[]
  /** drawings found that can be built in 3D on request ("Make every figure 3D") */
  candidates?: FigureCandidate[]
}

export interface TextbookDocument {
  id: string
  title: string
  subtitle: string
  sourceLabel: string
  courseCode: string
  pages: RenderedTextbookPage[]
  /** an uploaded PDF: how many pages it has, so more can be read later */
  pageCount?: number
}

/* -------------------------------------------------------------------------- */
/* Procedural CAD Specs for Custom Textbook Figures (Tier 2)                  */
/* -------------------------------------------------------------------------- */

export const FLANGED_COUPLING_SPEC: NoteSceneSpec = {
  id: 'note-flanged-coupling',
  title: 'Rigid Flanged Shaft Coupling (Section A–A)',
  summary:
    'Two cast-iron flanged hubs keyed to coaxial steel transmission shafts and bolted together across a spigot register by N reamed through-bolts on pitch circle diameter Dp.',
  units: 'mm',
  extent: 0.28,
  floorY: -0.13,
  camera: {
    position: [0.32, 0.22, 0.36],
    target: [0, 0, 0],
  },
  recommendedCut: {
    enabled: true,
    normal: [0, 0, 1],
    pos: 0,
  },
  showProjectionPlanes: 'none',
  parameters: [
    { id: 'shaftD', label: 'Shaft diameter d', symbol: 'd', value: 0.045, min: 0.025, max: 0.065, step: 0.002, unit: 'm' },
    { id: 'flangeOD', label: 'Flange outer diameter D', symbol: 'D', value: 0.19, min: 0.14, max: 0.25, step: 0.005, unit: 'm' },
    { id: 'pcd', label: 'Bolt pitch circle Dp', symbol: 'D_p', value: 0.135, min: 0.095, max: 0.18, step: 0.005, unit: 'm' },
    { id: 'webT', label: 'Flange web thickness tf', symbol: 't_f', value: 0.022, min: 0.014, max: 0.036, step: 0.002, unit: 'm' },
  ],
  parts: [
    {
      id: 'input-shaft',
      name: 'Driving Shaft (Left)',
      material: 'steel',
      role: 'moving',
      position: [0, 0, 0],
      rotation: [0, 0, Math.PI / 2],
      explode: [-0.09, 0, 0],
      info: {
        summary: '45 mm cold-rolled steel input shaft transmitting torque T = 1.8 kN·m.',
        role: 'Transfers torsional shear stress into the left flange hub via a rectangular sunk key.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 'shaftD / 2',
          h: 0.16,
          position: [0, 0.08, 0],
        },
      ],
    },
    {
      id: 'output-shaft',
      name: 'Driven Shaft (Right)',
      material: 'steel',
      role: 'moving',
      position: [0, 0, 0],
      rotation: [0, 0, Math.PI / 2],
      explode: [0.09, 0, 0],
      info: {
        summary: 'Coaxial driven steel shaft aligned by the coupling register spigot.',
        role: 'Receives torque from the right-hand flange hub.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 'shaftD / 2',
          h: 0.16,
          position: [0, -0.08, 0],
        },
      ],
    },
    {
      id: 'left-flange-hub',
      name: 'Left Cast-Iron Flange Hub',
      material: 'castIron',
      role: 'housing',
      position: [0, 0, 0],
      rotation: [0, 0, Math.PI / 2],
      explode: [-0.04, 0, 0],
      cut: true,
      info: {
        summary: 'Grey cast-iron flanged hub with outer diameter D = 190 mm and 6 reamed bolt holes.',
        role: 'Carries torque from the hub boss into the bolt circle at radius Dp / 2.',
      },
      shapes: [
        {
          kind: 'tube',
          op: 'add',
          rOuter: 'flangeOD / 2',
          rInner: 'shaftD / 2',
          h: 'webT',
          position: [0, 'webT / 2', 0],
        },
        {
          kind: 'tube',
          op: 'add',
          rOuter: 'shaftD * 0.95',
          rInner: 'shaftD / 2',
          h: 0.065,
          position: [0, 0.0325, 0],
        },
        {
          kind: 'cylinder',
          op: 'subtract',
          r: 0.0085,
          h: 0.08,
          radialCount: 6,
          radialRadius: 'pcd / 2',
          position: [0, 'webT / 2', 0],
        },
      ],
    },
    {
      id: 'right-flange-hub',
      name: 'Right Cast-Iron Flange Hub',
      material: 'forged',
      role: 'housing',
      position: [0, 0, 0],
      rotation: [0, 0, Math.PI / 2],
      explode: [0.04, 0, 0],
      cut: true,
      info: {
        summary: 'Mating cast-iron flange with female spigot recess for concentric alignment.',
        role: 'Bolted tightly against the left flange face to transmit torque by bolt shear and friction.',
      },
      shapes: [
        {
          kind: 'tube',
          op: 'add',
          rOuter: 'flangeOD / 2',
          rInner: 'shaftD / 2',
          h: 'webT',
          position: [0, '-webT / 2', 0],
        },
        {
          kind: 'tube',
          op: 'add',
          rOuter: 'shaftD * 0.95',
          rInner: 'shaftD / 2',
          h: 0.065,
          position: [0, -0.0325, 0],
        },
        {
          kind: 'cylinder',
          op: 'subtract',
          r: 0.0085,
          h: 0.08,
          radialCount: 6,
          radialRadius: 'pcd / 2',
          position: [0, '-webT / 2', 0],
        },
      ],
    },
    {
      id: 'coupling-bolts',
      name: 'Reamed Coupling Bolts (6× M16)',
      material: 'chrome',
      role: 'moving',
      position: [0, 0, 0],
      rotation: [0, 0, Math.PI / 2],
      explode: [0.07, 0, 0],
      cut: false,
      info: {
        summary: 'Six close-tolerance M16 hex bolts on pitch circle diameter Dp = 135 mm.',
        role: 'Resists direct shear force F = 2T / (n · Dp) across the flange parting plane.',
      },
      shapes: [
        {
          kind: 'cylinder',
          op: 'add',
          r: 0.008,
          h: 'webT * 2.4',
          radialCount: 6,
          radialRadius: 'pcd / 2',
          position: [0, 0, 0],
        },
        {
          kind: 'cylinder',
          op: 'add',
          r: 0.013,
          h: 0.01,
          radialCount: 6,
          radialRadius: 'pcd / 2',
          position: [0, 'webT * 1.15', 0],
        },
      ],
    },
    {
      id: 'sunk-key',
      name: 'Parallel Sunk Feather Key',
      material: 'brass',
      role: 'moving',
      position: [0, 'shaftD / 2', 0],
      explode: [0, 0.045, 0],
      cut: false,
      info: {
        summary: '14 mm × 9 mm rectangular parallel key seated in shaft and hub keyways.',
        role: 'Prevents relative rotation between shaft and hub; sized for crushing and shear.',
      },
      shapes: [
        {
          kind: 'box',
          sx: 0.11,
          sy: 0.009,
          sz: 0.014,
        },
      ],
    },
  ],
  annotations: [
    {
      id: 'torque-in',
      kind: 'moment',
      label: 'Torque T',
      value: '1.8 kN·m',
      from: [-0.12, 0.035, 0],
      to: [-0.12, 0.035, 0.055],
      color: '#f59e0b',
    },
    {
      id: 'dim-pcd',
      kind: 'dimension',
      label: 'Pitch Circle Dp',
      value: '135 mm',
      from: [0.005, 'pcd / 2', 0],
      to: [0.005, '-pcd / 2', 0],
      color: '#38bdf8',
    },
  ],
}

export const STEPPED_GEAR_SHAFT_SPEC: NoteSceneSpec = {
  id: 'note-stepped-gear-shaft',
  title: 'Stepped Countershaft with Helical Pinion & Bearings',
  summary:
    'Turned alloy-steel transmission countershaft featuring bearing journals, shoulder fillets, and an integral 22-tooth involute spur gear.',
  units: 'mm',
  extent: 0.28,
  floorY: -0.11,
  camera: {
    position: [0.28, 0.18, 0.32],
    target: [0, 0, 0],
  },
  recommendedCut: {
    enabled: false,
    normal: [0, 0, 1],
    pos: 0,
  },
  parameters: [
    { id: 'gearTeeth', label: 'Pinion teeth N', symbol: 'N', value: 22, min: 14, max: 36, step: 1, unit: 'teeth' },
    { id: 'gearMod', label: 'Gear module m', symbol: 'm', value: 0.0045, min: 0.003, max: 0.006, step: 0.0005, unit: 'm' },
    { id: 'faceW', label: 'Gear face width b', symbol: 'b', value: 0.038, min: 0.02, max: 0.06, step: 0.002, unit: 'm' },
    { id: 'journalR', label: 'Bearing journal radius r', symbol: 'r_j', value: 0.02, min: 0.014, max: 0.03, step: 0.002, unit: 'm' },
  ],
  parts: [
    {
      id: 'stepped-shaft',
      name: 'Turned Stepped Alloy Shaft',
      material: 'steel',
      role: 'moving',
      rotation: [0, 0, Math.PI / 2],
      motion: { kind: 'rotate', axis: 'y', speed: 1.4 },
      info: {
        summary: 'Precision-ground stepped shaft with bearing seats at both ends and central gear seat.',
        role: 'Supports bending from gear tooth loads Ft and Fr while transmitting torque.',
      },
      shapes: [
        {
          kind: 'cylinder',
          r: 'journalR',
          h: 0.26,
        },
        {
          kind: 'cylinder',
          r: 'journalR * 1.35',
          h: 0.14,
        },
      ],
    },
    {
      id: 'spur-gear-wheel',
      name: 'Involute Spur Gear (22T)',
      material: 'forged',
      role: 'moving',
      explode: [0, 0.06, 0],
      motion: { kind: 'rotate', axis: 'z', speed: 1.4 },
      rotation: [0, Math.PI / 2, 0],
      info: {
        summary: '20° pressure-angle involute gear mounted at mid-span.',
        role: 'Generates tangential force Ft = 2T / d and radial separating force Fr = Ft tan(20°).',
      },
      shapes: [
        {
          kind: 'gear',
          teeth: 22,
          module: 'gearMod',
          h: 'faceW',
          rInner: 'journalR * 1.35',
        },
      ],
    },
    {
      id: 'left-bearing',
      name: 'Left Deep-Groove Ball Bearing (A)',
      material: 'chrome',
      role: 'housing',
      position: [-0.1, 0, 0],
      rotation: [0, 0, Math.PI / 2],
      explode: [-0.06, 0, 0],
      cut: true,
      info: {
        summary: 'Self-aligning support bearing at reaction A.',
        role: 'Provides radial reaction RA against gear tooth bending loads.',
      },
      shapes: [
        {
          kind: 'tube',
          rOuter: 'journalR * 2.1',
          rInner: 'journalR',
          h: 0.024,
        },
      ],
    },
    {
      id: 'right-bearing',
      name: 'Right Deep-Groove Ball Bearing (B)',
      material: 'chrome',
      role: 'housing',
      position: [0.1, 0, 0],
      rotation: [0, 0, Math.PI / 2],
      explode: [0.06, 0, 0],
      cut: true,
      info: {
        summary: 'Radial support bearing at reaction B.',
        role: 'Balances moment about bearing A.',
      },
      shapes: [
        {
          kind: 'tube',
          rOuter: 'journalR * 2.1',
          rInner: 'journalR',
          h: 0.024,
        },
      ],
    },
  ],
  annotations: [
    {
      id: 'ft-load',
      kind: 'force',
      label: 'Tangential Tooth Load Ft',
      value: '3.4 kN',
      from: [0, 0.095, 0.05],
      to: [0, 0.055, 0.005],
      color: '#ef4444',
    },
    {
      id: 'ra-reaction',
      kind: 'force',
      label: 'Reaction RA',
      value: '1.7 kN',
      from: [-0.1, -0.075, 0],
      to: [-0.1, -0.035, 0],
      color: '#10b981',
    },
    {
      id: 'rb-reaction',
      kind: 'force',
      label: 'Reaction RB',
      value: '1.7 kN',
      from: [0.1, -0.075, 0],
      to: [0.1, -0.035, 0],
      color: '#10b981',
    },
  ],
}

export const BEARING_BRACKET_ORTHO_SPEC: NoteSceneSpec = {
  id: 'note-bearing-bracket',
  title: 'Cast-Iron Pedestal Bearing Bracket (Orthographic Projection)',
  summary:
    'Machined cast-iron pedestal bracket with a slotted base plate, vertical stiffening web, cylindrical journal boss, and counterbored mounting holes.',
  units: 'mm',
  extent: 0.28,
  floorY: -0.08,
  camera: {
    position: [0.3, 0.22, 0.34],
    target: [0, 0.02, 0],
  },
  showProjectionPlanes: 'first-angle',
  recommendedCut: {
    enabled: true,
    normal: [1, 0, 0],
    pos: 0,
  },
  parameters: [
    { id: 'baseW', label: 'Base plate width W', symbol: 'W', value: 0.18, min: 0.12, max: 0.24, step: 0.005, unit: 'm' },
    { id: 'bossOD', label: 'Journal boss outer dia D', symbol: 'D', value: 0.084, min: 0.06, max: 0.11, step: 0.004, unit: 'm' },
    { id: 'boreD', label: 'Bearing bore dia d', symbol: 'd', value: 0.048, min: 0.028, max: 0.064, step: 0.002, unit: 'm' },
    { id: 'centerH', label: 'Shaft centre height H', symbol: 'H', value: 0.075, min: 0.05, max: 0.11, step: 0.005, unit: 'm' },
  ],
  parts: [
    {
      id: 'bracket-body',
      name: 'Cast-Iron Pedestal Bracket Body',
      material: 'castIron',
      role: 'housing',
      cut: true,
      info: {
        summary: 'One-piece grey cast-iron casting combining base plate, vertical column, and bearing housing boss.',
        role: 'Supports a rotating shaft at height H above the machine bed.',
      },
      shapes: [
        // Base plate
        {
          kind: 'box',
          op: 'add',
          sx: 'baseW',
          sy: 0.02,
          sz: 0.1,
          position: [0, -0.05, 0],
        },
        // Vertical support column
        {
          kind: 'box',
          op: 'add',
          sx: 'bossOD * 0.85',
          sy: 'centerH',
          sz: 0.026,
          position: [0, '-0.04 + centerH / 2', 0],
        },
        // Cylindrical bearing boss along Z
        {
          kind: 'tube',
          op: 'add',
          rOuter: 'bossOD / 2',
          rInner: 'boreD / 2',
          h: 0.076,
          rotation: [Math.PI / 2, 0, 0],
          position: [0, '-0.04 + centerH', 0],
        },
        // Left & right mounting bolt holes in base
        {
          kind: 'cylinder',
          op: 'subtract',
          r: 0.009,
          h: 0.05,
          position: ['baseW * 0.36', -0.05, 0],
        },
        {
          kind: 'cylinder',
          op: 'subtract',
          r: 0.009,
          h: 0.05,
          position: ['-baseW * 0.36', -0.05, 0],
        },
      ],
    },
    {
      id: 'bronze-bushing',
      name: 'Pressed Phosphor-Bronze Bush',
      material: 'bronze',
      role: 'static',
      explode: [0, 0, 0.07],
      cut: true,
      info: {
        summary: 'Interference-fit bronze sleeve bearing inside the cast-iron boss.',
        role: 'Provides a low-friction, replaceable wear surface for the journal.',
      },
      shapes: [
        {
          kind: 'tube',
          rOuter: 'boreD / 2',
          rInner: 'boreD * 0.38',
          h: 0.082,
          rotation: [Math.PI / 2, 0, 0],
          position: [0, '-0.04 + centerH', 0],
        },
      ],
    },
  ],
  annotations: [
    {
      id: 'dim-h',
      kind: 'dimension',
      label: 'Centre Height H',
      value: '75 mm',
      from: [-0.075, -0.06, 0.04],
      to: [-0.075, 0.035, 0.04],
      color: '#38bdf8',
    },
  ],
}

/* -------------------------------------------------------------------------- */
/* Helper: Generate Crisp 2D Technical Drawing SVG Data URLs                  */
/* (Used both for Sample Textbook Pages and the 2D <-> 3D Split Toggle)       */
/* -------------------------------------------------------------------------- */

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`
}

const BEAM_2D_SVG = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 220" width="640" height="220">
  <rect width="640" height="220" fill="#fcfbf7"/>
  <g stroke="#1e293b" stroke-width="2" fill="none" font-family="Georgia, serif" font-size="13">
    <!-- Distributed load w -->
    <rect x="110" y="52" width="260" height="28" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.5"/>
    <text x="200" y="44" fill="#0369a1" font-weight="bold" stroke="none">w = 5 kN/m</text>
    <!-- Beam AB -->
    <rect x="110" y="80" width="420" height="16" fill="#cbd5e1" stroke="#0f172a" stroke-width="2"/>
    <!-- Pin support A -->
    <polygon points="110,96 96,122 124,122" fill="#94a3b8"/>
    <line x1="88" y1="122" x2="132" y2="122" stroke-width="2.5"/>
    <text x="104" y="142" fill="#0f172a" font-weight="bold" stroke="none">A</text>
    <!-- Roller support B -->
    <polygon points="530,96 516,116 544,116" fill="#94a3b8"/>
    <circle cx="523" cy="120" r="4" fill="#0f172a"/>
    <circle cx="537" cy="120" r="4" fill="#0f172a"/>
    <line x1="510" y1="125" x2="550" y2="125" stroke-width="2.5"/>
    <text x="525" y="144" fill="#0f172a" font-weight="bold" stroke="none">B</text>
    <!-- Point Load P1 -->
    <line x1="370" y1="22" x2="370" y2="78" stroke="#dc2626" stroke-width="3"/>
    <polygon points="370,80 364,66 376,66" fill="#dc2626" stroke="none"/>
    <text x="380" y="38" fill="#b91c1c" font-weight="bold" stroke="none">P₁ = 18 kN</text>
    <!-- Dimension lines -->
    <line x1="110" y1="168" x2="370" y2="168" stroke="#475569" stroke-width="1.5"/>
    <line x1="370" y1="168" x2="530" y2="168" stroke="#475569" stroke-width="1.5"/>
    <line x1="110" y1="158" x2="110" y2="178" stroke="#475569"/>
    <line x1="370" y1="158" x2="370" y2="178" stroke="#475569"/>
    <line x1="530" y1="158" x2="530" y2="178" stroke="#475569"/>
    <text x="215" y="188" fill="#334155" stroke="none">x₁ = 2.0 m</text>
    <text x="425" y="188" fill="#334155" stroke="none">1.2 m</text>
    <text x="295" y="208" fill="#0f172a" font-weight="bold" stroke="none">Span L = 3.2 m</text>
  </g>
</svg>
`)

const CANTILEVER_2D_SVG = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 220" width="640" height="220">
  <rect width="640" height="220" fill="#fcfbf7"/>
  <g stroke="#1e293b" stroke-width="2" fill="none" font-family="Georgia, serif" font-size="13">
    <!-- Fixed wall at A, hatched -->
    <rect x="96" y="40" width="14" height="96" fill="#cbd5e1" stroke="#0f172a"/>
    <line x1="96" y1="52" x2="84" y2="64"/><line x1="96" y1="72" x2="84" y2="84"/><line x1="96" y1="92" x2="84" y2="104"/><line x1="96" y1="112" x2="84" y2="124"/>
    <text x="96" y="156" fill="#0f172a" font-weight="bold" stroke="none">A</text>
    <!-- Beam, 2.2 m drawn over 330 px -->
    <rect x="110" y="80" width="330" height="16" fill="#cbd5e1" stroke="#0f172a" stroke-width="2"/>
    <text x="446" y="94" fill="#0f172a" font-weight="bold" stroke="none">B</text>
    <!-- Point load P1 at x1 = 2.0 m -->
    <line x1="410" y1="22" x2="410" y2="78" stroke="#dc2626" stroke-width="3"/>
    <polygon points="410,80 404,66 416,66" fill="#dc2626" stroke="none"/>
    <text x="420" y="38" fill="#b91c1c" font-weight="bold" stroke="none">P₁ = 12 kN</text>
    <!-- Dimensions -->
    <line x1="110" y1="168" x2="410" y2="168" stroke="#475569" stroke-width="1.5"/>
    <line x1="410" y1="168" x2="440" y2="168" stroke="#475569" stroke-width="1.5"/>
    <line x1="110" y1="158" x2="110" y2="178" stroke="#475569"/>
    <line x1="410" y1="158" x2="410" y2="178" stroke="#475569"/>
    <line x1="440" y1="158" x2="440" y2="178" stroke="#475569"/>
    <text x="225" y="188" fill="#334155" stroke="none">x₁ = 2.0 m</text>
    <text x="268" y="208" fill="#0f172a" font-weight="bold" stroke="none">L = 2.2 m</text>
  </g>
</svg>
`)

const COUPLING_2D_SVG = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 240" width="640" height="240">
  <rect width="640" height="240" fill="#fcfbf7"/>
  <g stroke="#0f172a" stroke-width="1.8" fill="none" font-family="monospace" font-size="12">
    <!-- Centerline -->
    <line x1="60" y1="120" x2="580" y2="120" stroke="#64748b" stroke-dasharray="12,4,2,4"/>
    <!-- Left & Right Shafts -->
    <rect x="90" y="98" width="190" height="44" fill="#e2e8f0"/>
    <rect x="280" y="98" width="190" height="44" fill="#e2e8f0"/>
    <!-- Left Flange Section -->
    <path d="M220,76 L280,76 L280,40 L256,40 L256,76 Z" fill="#cbd5e1"/>
    <path d="M220,164 L280,164 L280,200 L256,200 L256,164 Z" fill="#cbd5e1"/>
    <!-- Right Flange Section -->
    <path d="M280,40 L304,40 L304,76 L340,76 L340,98 L280,98 Z" fill="#94a3b8"/>
    <path d="M280,200 L304,200 L304,164 L340,164 L340,142 L280,142 Z" fill="#94a3b8"/>
    <!-- Top & Bottom Bolts -->
    <rect x="248" y="54" width="64" height="10" fill="#38bdf8"/>
    <rect x="248" y="176" width="64" height="10" fill="#38bdf8"/>
    <!-- Labels -->
    <text x="115" y="90" fill="#0f172a" stroke="none">Shaft Ød = 45 mm</text>
    <text x="365" y="56" fill="#0f172a" stroke="none">Flange ØD = 190 mm</text>
    <text x="365" y="76" fill="#0369a1" stroke="none">Bolt Circle Dp = 135 mm (6× M16)</text>
    <text x="235" y="226" fill="#334155" font-weight="bold" stroke="none">SECTION A–A (Orthographic Cutaway)</text>
  </g>
</svg>
`)

const FOUR_BAR_2D_SVG = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 220" width="640" height="220">
  <rect width="640" height="220" fill="#fcfbf7"/>
  <g stroke="#0f172a" stroke-width="2.2" fill="none" font-family="Georgia, serif" font-size="13">
    <!-- Ground link O2 - O4 -->
    <line x1="150" y1="165" x2="460" y2="165" stroke="#64748b" stroke-dasharray="8,5"/>
    <!-- Crank L2 -->
    <line x1="150" y1="165" x2="210" y2="85" stroke="#10b981" stroke-width="4"/>
    <!-- Coupler L3 -->
    <line x1="210" y1="85" x2="420" y2="60" stroke="#0284c7" stroke-width="4"/>
    <!-- Rocker L4 -->
    <line x1="420" y1="60" x2="460" y2="165" stroke="#f59e0b" stroke-width="4"/>
    <!-- Joints -->
    <circle cx="150" cy="165" r="6" fill="#ffffff"/>
    <circle cx="210" cy="85" r="6" fill="#ffffff"/>
    <circle cx="420" cy="60" r="6" fill="#ffffff"/>
    <circle cx="460" cy="165" r="6" fill="#ffffff"/>
    <text x="128" y="190" fill="#0f172a" stroke="none">O₂</text>
    <text x="148" y="118" fill="#047857" font-weight="bold" stroke="none">L₂ = 80 mm</text>
    <text x="290" y="55" fill="#0369a1" font-weight="bold" stroke="none">Coupler L₃ = 210 mm</text>
    <text x="452" y="115" fill="#b45309" font-weight="bold" stroke="none">L₄ = 140 mm</text>
    <text x="275" y="188" fill="#475569" stroke="none">Ground Link L₁ = 240 mm</text>
  </g>
</svg>
`)

const MOHR_STRESS_2D_SVG = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 220" width="640" height="220">
  <rect width="640" height="220" fill="#fcfbf7"/>
  <g stroke="#0f172a" stroke-width="2" fill="none" font-family="Georgia, serif" font-size="13">
    <rect x="255" y="55" width="110" height="110" fill="#f1f5f9" stroke="#0f172a" stroke-width="2.5"/>
    <!-- Sigma X arrows -->
    <line x1="365" y1="110" x2="435" y2="110" stroke="#dc2626" stroke-width="2.5"/>
    <polygon points="438,110 426,104 426,116" fill="#dc2626" stroke="none"/>
    <line x1="255" y1="110" x2="185" y2="110" stroke="#dc2626" stroke-width="2.5"/>
    <polygon points="182,110 194,104 194,116" fill="#dc2626" stroke="none"/>
    <text x="445" y="115" fill="#b91c1c" font-weight="bold" stroke="none">σₓ = +80 MPa</text>
    <!-- Sigma Y arrows -->
    <line x1="310" y1="55" x2="310" y2="15" stroke="#0284c7" stroke-width="2.5"/>
    <polygon points="310,55 304,43 316,43" fill="#0284c7" stroke="none"/>
    <text x="322" y="28" fill="#0369a1" font-weight="bold" stroke="none">σᵧ = -40 MPa</text>
    <!-- Tau XY -->
    <text x="272" y="115" fill="#0f172a" font-weight="bold" stroke="none">τₓᵧ = 35 MPa</text>
  </g>
</svg>
`)

const INTERPENETRATION_2D_SVG = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 220" width="640" height="220">
  <rect width="640" height="220" fill="#fcfbf7"/>
  <g stroke="#0f172a" stroke-width="2" fill="none" font-family="monospace" font-size="12">
    <!-- Main vertical cylinder -->
    <rect x="220" y="25" width="120" height="170" fill="#e2e8f0"/>
    <!-- Branch horizontal cylinder -->
    <rect x="340" y="65" width="110" height="80" fill="#cbd5e1"/>
    <!-- Curve of interpenetration -->
    <path d="M340,65 Q295,105 340,145" stroke="#dc2626" stroke-width="3" fill="none"/>
    <text x="232" y="182" fill="#0f172a" stroke="none">Main Ø2R = 110 mm</text>
    <text x="352" y="55" fill="#0369a1" stroke="none">Branch Ø2r = 76 mm</text>
    <text x="355" y="110" fill="#b91c1c" font-weight="bold" stroke="none">Curve of Intersection</text>
  </g>
</svg>
`)

/**
 * Generates a realistic high-resolution textbook page background image (Data URL)
 * so Page-Fidelity mode looks like an authentic typeset engineering textbook PDF page,
 * with the 2D figures placed at their exact `[ymin, xmin, ymax, xmax]` slots!
 */
function renderSyntheticPageImage(opts: {
  chapterHeader: string
  pageNumber: number
  topParagraphs: string[]
  figure1Caption: string
  midParagraphs: string[]
  figure2Caption: string
  bottomEquation: string
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 1200" width="850" height="1200">
  <rect width="850" height="1200" fill="#fcfbf7"/>
  <!-- Subtle paper border & header rule -->
  <line x1="70" y1="68" x2="780" y2="68" stroke="#94a3b8" stroke-width="1"/>
  <text x="70" y="54" font-family="Georgia, serif" font-size="13" font-style="italic" fill="#475569">${esc(opts.chapterHeader)}</text>
  <text x="780" y="54" text-anchor="end" font-family="Georgia, serif" font-size="13" font-weight="bold" fill="#1e293b">Page ${opts.pageNumber}</text>

  <!-- Top textbook text -->
  <g font-family="Georgia, serif" font-size="15.5" fill="#1e293b">
    ${opts.topParagraphs
      .map((line, idx) => `<text x="70" y="${108 + idx * 24}">${esc(line)}</text>`)
      .join('\n    ')}
  </g>

  <!-- Middle textbook text & derivation -->
  <g font-family="Georgia, serif" font-size="15.5" fill="#1e293b">
    ${opts.midParagraphs
      .map((line, idx) => `<text x="70" y="${662 + idx * 24}">${esc(line)}</text>`)
      .join('\n    ')}
  </g>

  <!-- Footer equation -->
  <text x="425" y="1152" text-anchor="middle" xml:space="preserve" font-family="Georgia, serif" font-size="16" font-weight="bold" fill="#0f172a">${esc(opts.bottomEquation)}</text>
</svg>`
  return svgDataUrl(svg)
}

export const SAMPLE_TEXTBOOKS: TextbookDocument[] = [
  {
    id: 'solidify-notes-beams-stress',
    title: 'Beams and plane stress',
    subtitle: 'Solidify sample notes · Strength of materials',
    sourceLabel: 'Sample notes written for Solidify',
    courseCode: 'MEE204',
    pages: [
      {
        pageNumber: 1,
        aspectRatio: 850 / 1200,
        pageImageUrl: renderSyntheticPageImage({
          chapterHeader: 'UNIT 4 · BENDING OF BEAMS',
          pageNumber: 1,
          topParagraphs: [
            '4.1  Simply Supported Wide-Flange Beam Under Point and Distributed Loading',
            'A structural steel beam of span L = 3.2 m rests on a pin at A and a roller at B.',
            'It carries a uniform distributed load w = 5 kN/m together with a concentrated load',
            'P1 = 18 kN applied at x1 = 2.0 m from the left support A.',
          ],
          figure1Caption: 'Figure 4.1  Simply supported steel beam (L = 3.2 m, P1 = 18 kN, w = 5 kN/m).',
          midParagraphs: [
            '4.2  Cantilever with a Point Load near the Free End',
            'Compare the simply supported span above with a shorter cantilever beam of length',
            'L = 2.2 m fixed at wall A and carrying a concentrated tip load P1 = 12 kN at x1 = 2.0 m',
            'with no distributed load (w = 0).',
          ],
          figure2Caption: 'Figure 4.2  Cantilever beam fixed at left wall (L = 2.2 m, P1 = 12 kN, w = 0 kN/m).',
          bottomEquation: 'EI d²v/dx² = M(x);  δmax = P₁x₁²(3L − x₁) / 6EI   (4.2)',
        }),
        pageText:
          '4.1 Simply Supported Wide-Flange Beam: Span L = 3.2 m, P1 = 18 kN at x1 = 2.0 m, w = 5 kN/m. 4.2 Cantilever Beam: Span L = 2.2 m, P1 = 12 kN at x1 = 2.0 m, w = 0 kN/m.',
        blocks: [
          {
            kind: 'heading',
            number: '4.1',
            text: 'Simply Supported Beam Under Combined Point & Distributed Loads',
          },
          {
            kind: 'paragraph',
            text: 'A wide-flange steel beam of span L = 3.2 m rests on a pin support at A (x = 0) and a roller support at B (x = L). It carries a downward point load P1 = 18 kN at x1 = 2.0 m together with a uniformly distributed load w = 5 kN/m along its span.',
          },
          {
            kind: 'equation',
            number: '(4.1)',
            latex: 'EI \\frac{d^2 v}{dx^2} = M(x) = R_A x - \\frac{1}{2} w x^2 - P_1 \\langle x - x_1 \\rangle^1',
          },
          {
            kind: 'figure-slot',
            figureId: 'fig-4-1-ss-beam',
          },
          {
            kind: 'heading',
            number: '4.2',
            text: 'Cantilever with a Point Load near the Free End',
          },
          {
            kind: 'paragraph',
            text: 'On the same page, consider a shorter cantilever beam of span L = 2.2 m fixed at the left wall, carrying P1 = 12 kN near its free end (x1 = 2.0 m, w = 0 kN/m). Because only one figure runs live at a time and loads its own values on activation, these two beam rigs never overwrite each other.',
          },
          {
            kind: 'figure-slot',
            figureId: 'fig-4-2-cantilever-beam',
          },
          {
            kind: 'equation',
            number: '(4.2)',
            latex: '\\delta_{\\max} = \\frac{P_1 x_1^2 (3L - x_1)}{6 E I}',
          },
        ],
        figures: [
          {
            id: 'fig-4-1-ss-beam',
            pageNumber: 1,
            box: [190, 70, 515, 930],
            title: 'Figure 4.1',
            caption: 'Simply supported I-beam (L = 3.2 m, P1 = 18 kN at x1 = 2.0 m, w = 5 kN/m).',
            courseTag: 'MEE204',
            confidence: 0.96,
            originalCropUrl: BEAM_2D_SVG,
            extractedGivens: [
              { symbol: 'L', label: 'Beam span', value: 3.2, unit: 'm' },
              { symbol: 'P_1', label: 'Point load', value: 18, unit: 'kN' },
              { symbol: 'x_1', label: 'Load position', value: 2.0, unit: 'm' },
              { symbol: 'w', label: 'Distributed load', value: 5, unit: 'kN/m' },
            ],
            visualization: {
              kind: 'catalog',
              moduleId: 'materials',
              sceneId: 'beam',
              params: { span: 3.2, p1: 18, x1: 2.0, w: 5, support: 0 },
              paramSpecs: [
                { id: 'span', label: 'Beam span L', symbol: 'L', value: 3.2, min: 2.0, max: 5.0, step: 0.1, unit: 'm' },
                { id: 'p1', label: 'Point load P1', symbol: 'P_1', value: 18, min: 0, max: 40, step: 1, unit: 'kN' },
                { id: 'x1', label: 'Load position x1', symbol: 'x_1', value: 2.0, min: 0.4, max: 2.8, step: 0.1, unit: 'm' },
                { id: 'w', label: 'UDL intensity w', symbol: 'w', value: 5, min: 0, max: 15, step: 0.5, unit: 'kN/m' },
              ],
            },
          },
          {
            id: 'fig-4-2-cantilever-beam',
            pageNumber: 1,
            box: [620, 70, 925, 930],
            title: 'Figure 4.2',
            caption: 'Cantilever with a point load near the free end (L = 2.2 m, P1 = 12 kN at x1 = 2.0 m).',
            courseTag: 'MEE204',
            confidence: 0.94,
            originalCropUrl: CANTILEVER_2D_SVG,
            extractedGivens: [
              { symbol: 'L', label: 'Cantilever length', value: 2.2, unit: 'm' },
              { symbol: 'P_1', label: 'Tip load', value: 12, unit: 'kN' },
              { symbol: 'x_1', label: 'Load position', value: 2.0, unit: 'm' },
              { symbol: 'w', label: 'UDL intensity', value: 0, unit: 'kN/m' },
            ],
            visualization: {
              kind: 'catalog',
              moduleId: 'materials',
              sceneId: 'beam',
              params: { span: 2.2, p1: 12, x1: 2.0, w: 0, support: 1 },
              paramSpecs: [
                { id: 'span', label: 'Cantilever span L', symbol: 'L', value: 2.2, min: 1.5, max: 4.5, step: 0.1, unit: 'm' },
                { id: 'p1', label: 'Tip load P1', symbol: 'P_1', value: 12, min: 0, max: 40, step: 1, unit: 'kN' },
                { id: 'x1', label: 'Load position x1', symbol: 'x_1', value: 2.0, min: 0.4, max: 2.2, step: 0.1, unit: 'm' },
                { id: 'w', label: 'UDL intensity w', symbol: 'w', value: 0, min: 0, max: 15, step: 0.5, unit: 'kN/m' },
              ],
            },
          },
        ],
      },
      {
        pageNumber: 2,
        aspectRatio: 850 / 1200,
        pageImageUrl: renderSyntheticPageImage({
          chapterHeader: 'UNIT 4 · STRESS AT A POINT',
          pageNumber: 2,
          topParagraphs: [
            '4.3  Plane-Stress Transformation & Mohr’s Circle on a Web Element',
            'An element cut from the beam web experiences normal stresses σx = +80 MPa, σy = −40 MPa,',
            'and shear stress τxy = +35 MPa. Rotate the inclined plane θ in 3D to find the principal',
            'planes and maximum in-plane shear stress.',
          ],
          figure1Caption: 'Figure 4.3  3D Plane-stress element (σx = 80 MPa, σy = −40 MPa, τxy = 35 MPa).',
          midParagraphs: [
            '4.4  A Freehand Sketch',
            'Not every figure is drawn to scale. The margin sketch below shows a loaded bracket',
            'without dimensions: it describes the idea, and the numbers come from the problem',
            'statement that goes with it.',
          ],
          figure2Caption: 'Figure 4.4  Freehand sketch of a loaded bracket (not to scale).',
          bottomEquation: 'σ₁,₂ = (σx + σy)/2 ± √[((σx − σy)/2)² + τxy²]   (4.3)',
        }),
        pageText:
          '4.3 Plane-Stress Transformation and Mohr Circle: sigma_x = 80 MPa, sigma_y = -40 MPa, tau_xy = 35 MPa. 4.4 A freehand sketch of a loaded bracket, not to scale.',
        blocks: [
          {
            kind: 'heading',
            number: '4.3',
            text: 'Plane-Stress Transformation & Mohr’s Circle',
          },
          {
            kind: 'paragraph',
            text: 'At a point in the web, the 2D stress state is σx = +80 MPa, σy = −40 MPa, and τxy = 35 MPa. Rotating the cut plane by θ reveals the principal normal stresses σ1, σ2.',
          },
          {
            kind: 'figure-slot',
            figureId: 'fig-4-3-mohr',
          },
          {
            kind: 'heading',
            number: '4.4',
            text: 'A Freehand Sketch',
          },
          {
            kind: 'paragraph',
            text: 'Not every figure is drawn to scale. The margin sketch below shows a loaded bracket without dimensions: it describes the idea, and the numbers come from the problem statement that goes with it.',
          },
          {
            kind: 'figure-slot',
            figureId: 'fig-4-4-low-conf',
          },
        ],
        figures: [
          {
            id: 'fig-4-3-mohr',
            pageNumber: 2,
            box: [190, 70, 515, 930],
            title: 'Figure 4.3',
            caption: '3D Plane-stress element under σx = 80 MPa, σy = −40 MPa, τxy = 35 MPa.',
            courseTag: 'MEE204',
            confidence: 0.95,
            originalCropUrl: MOHR_STRESS_2D_SVG,
            extractedGivens: [
              { symbol: 'σ_x', label: 'Normal stress X', value: 80, unit: 'MPa' },
              { symbol: 'σ_y', label: 'Normal stress Y', value: -40, unit: 'MPa' },
              { symbol: 'τ_xy', label: 'Shear stress', value: 35, unit: 'MPa' },
            ],
            visualization: {
              kind: 'catalog',
              moduleId: 'materials',
              sceneId: 'stress-state',
              params: { sx: 80, sy: -40, txy: 35, angle: 25 },
            },
          },
          {
            id: 'fig-4-4-low-conf',
            pageNumber: 2,
            box: [620, 70, 925, 930],
            title: 'Figure 4.4',
            caption: 'Freehand sketch of a loaded bracket (not to scale).',
            courseTag: 'MEE204',
            confidence: 0.58,
            originalCropUrl: MOHR_STRESS_2D_SVG,
            extractedGivens: [
              { symbol: 'σ_x', label: 'Estimated stress', value: 50, unit: 'MPa' },
            ],
            visualization: {
              kind: 'catalog',
              moduleId: 'materials',
              sceneId: 'stress-state',
              params: { sx: 50, sy: 0, txy: 10, angle: 0 },
            },
          },
        ],
      },
    ],
  },
  {
    id: 'solidify-notes-mechanisms-drawing',
    title: 'Linkages and intersecting solids',
    subtitle: 'Solidify sample notes · Mechanisms and technical drawing',
    sourceLabel: 'Sample notes written for Solidify',
    courseCode: 'MEE301',
    pages: [
      {
        pageNumber: 1,
        aspectRatio: 850 / 1200,
        pageImageUrl: renderSyntheticPageImage({
          chapterHeader: 'UNITS 2 AND 5 · LINKAGES AND INTERSECTING SOLIDS',
          pageNumber: 1,
          topParagraphs: [
            '2.1  Grashof Condition & Transmission Angle in a Planar Four-Bar Linkage',
            'A planar four-bar linkage consists of ground link L1 = 240 mm, input crank L2 = 80 mm,',
            'coupler L3 = 210 mm, and output rocker L4 = 140 mm. Since s + l = 80 + 240 = 320 mm is',
            'less than p + q = 210 + 140 = 350 mm, the linkage is a Grashof crank-rocker.',
          ],
          figure1Caption: 'Figure 2.1  Planar Grashof four-bar linkage showing transmission angle μ and coupler curve.',
          midParagraphs: [
            '5.2  Curve of Interpenetration of Two Intersecting Cylinders (Tee Branch)',
            'When a horizontal branch pipe of radius r = 38 mm penetrates a vertical main cylinder of',
            'radius R = 55 mm at offset e = 0 mm, their surfaces intersect along a 3D saddle curve',
            'x(θ) = √(R² − (r sin θ)²), y(θ) = r cos θ.',
          ],
          figure2Caption: 'Figure 5.2  Intersecting cylinders of radii R = 55 mm and r = 38 mm with surface development.',
          bottomEquation: 's + l ≤ p + q   (Grashof)      and      x(θ) = √(R² − (r sin θ + e)²)     (5.2)',
        }),
        pageText:
          '2.1 Grashof Condition and Transmission Angle in a Planar Four-Bar Linkage: L1 = 240 mm, L2 = 80 mm, L3 = 210 mm, L4 = 140 mm. 5.2 Curve of Interpenetration of Two Intersecting Cylinders: R = 55 mm, r = 38 mm.',
        blocks: [
          {
            kind: 'heading',
            number: '2.1',
            text: 'Grashof Condition & Transmission Angle in a Four-Bar Linkage',
          },
          {
            kind: 'paragraph',
            text: 'For a planar four-bar mechanism with ground link L1 = 240 mm, crank L2 = 80 mm, coupler L3 = 210 mm, and rocker L4 = 140 mm, the shortest + longest sum is s + l = 80 + 240 = 320 mm < p + q = 210 + 140 = 350 mm. Therefore crank L2 revolves through a full 360° while driving rocker L4 between its toggle limits.',
          },
          {
            kind: 'equation',
            number: '(2.1)',
            latex: '\\cos \\mu = \\frac{L_3^2 + L_4^2 - L_1^2 - L_2^2 + 2 L_1 L_2 \\cos \\theta_2}{2 L_3 L_4}',
          },
          {
            kind: 'figure-slot',
            figureId: 'fig-2-1-fourbar',
          },
          {
            kind: 'heading',
            number: '5.2',
            text: 'Curve of Interpenetration of Intersecting Cylinders',
          },
          {
            kind: 'paragraph',
            text: 'When a branch cylinder of radius r = 38 mm intersects a vertical main cylinder of radius R = 55 mm, common generators locate the 3D curve of interpenetration. Slice or unfold the lateral sheet development right inside the 3D figure below.',
          },
          {
            kind: 'figure-slot',
            figureId: 'fig-5-2-interpenetration',
          },
          {
            kind: 'equation',
            number: '(5.2)',
            latex: 'x(\\theta) = \\sqrt{R^2 - (r \\sin \\theta + e)^2}, \\qquad y(\\theta) = r \\cos \\theta',
          },
        ],
        figures: [
          {
            id: 'fig-2-1-fourbar',
            pageNumber: 1,
            box: [190, 70, 515, 930],
            title: 'Figure 2.1',
            caption: 'Grashof four-bar crank-rocker linkage (L1 = 240 mm, L2 = 80 mm, L3 = 210 mm, L4 = 140 mm).',
            courseTag: 'MEE301',
            confidence: 0.94,
            originalCropUrl: FOUR_BAR_2D_SVG,
            extractedGivens: [
              { symbol: 'L_1', label: 'Ground link', value: 240, unit: 'mm' },
              { symbol: 'L_2', label: 'Input crank', value: 80, unit: 'mm' },
              { symbol: 'L_3', label: 'Coupler', value: 210, unit: 'mm' },
              { symbol: 'L_4', label: 'Output rocker', value: 140, unit: 'mm' },
            ],
            visualization: {
              kind: 'catalog',
              moduleId: 'mechanisms',
              sceneId: 'four-bar',
              params: { l1: 240, l2: 80, l3: 210, l4: 140, rpm: 30 },
              paramSpecs: [
                { id: 'l1', label: 'Ground link L1', symbol: 'L_1', value: 240, min: 150, max: 300, step: 5, unit: 'mm' },
                { id: 'l2', label: 'Input crank L2', symbol: 'L_2', value: 80, min: 40, max: 160, step: 5, unit: 'mm' },
                { id: 'l3', label: 'Coupler L3', symbol: 'L_3', value: 210, min: 120, max: 280, step: 5, unit: 'mm' },
                { id: 'l4', label: 'Output rocker L4', symbol: 'L_4', value: 140, min: 80, max: 240, step: 5, unit: 'mm' },
              ],
            },
          },
          {
            id: 'fig-5-2-interpenetration',
            pageNumber: 1,
            box: [620, 70, 925, 930],
            title: 'Figure 5.2',
            caption: 'Cylinder-to-cylinder tee interpenetration (R = 55 mm, r = 38 mm) with 3D saddle curve and flat pattern.',
            courseTag: 'MEE201',
            confidence: 0.91,
            originalCropUrl: INTERPENETRATION_2D_SVG,
            extractedGivens: [
              { symbol: 'R', label: 'Main cylinder radius', value: 55, unit: 'mm' },
              { symbol: 'r', label: 'Branch cylinder radius', value: 38, unit: 'mm' },
              { symbol: 'e', label: 'Axis offset', value: 0, unit: 'mm' },
            ],
            visualization: {
              kind: 'catalog',
              moduleId: 'drawing',
              sceneId: 'interpenetration',
              params: { mainR: 55, branchR: 38, offset: 0, unfold: 0.35 },
              paramSpecs: [
                { id: 'mainR', label: 'Main radius R', symbol: 'R', value: 55, min: 40, max: 75, step: 1, unit: 'mm' },
                { id: 'branchR', label: 'Branch radius r', symbol: 'r', value: 38, min: 20, max: 55, step: 1, unit: 'mm' },
                { id: 'offset', label: 'Axis offset e', symbol: 'e', value: 0, min: -20, max: 20, step: 1, unit: 'mm' },
                { id: 'unfold', label: 'Unfold development', symbol: 'u', value: 0.35, min: 0, max: 1, step: 0.05, unit: '' },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: 'solidify-notes-procedural-cad',
    title: 'Shafts and couplings',
    subtitle: 'Solidify sample notes · Machine design',
    sourceLabel: 'Sample notes written for Solidify',
    courseCode: 'MEE202',
    pages: [
      {
        pageNumber: 1,
        aspectRatio: 850 / 1200,
        pageImageUrl: renderSyntheticPageImage({
          chapterHeader: 'UNIT 8 · SHAFTS AND COUPLINGS',
          pageNumber: 1,
          topParagraphs: [
            '8.1  Stepped Transmission Countershaft with Spur Pinion',
            'A turned alloy-steel countershaft is supported on ball bearings at A and B and carries',
            'a 22-tooth involute spur pinion (m = 4.5 mm, face width b = 38 mm) at mid-span.',
            'The shaft steps down at each bearing seat to locate the bearings axially.',
          ],
          figure1Caption: 'Figure 8.1  Stepped countershaft with 22-tooth spur gear and bearing reactions.',
          midParagraphs: [
            '8.2  Rigid Flanged Shaft Coupling in Section A–A',
            'Two coaxial shafts of diameter d = 45 mm are joined by a cast-iron flanged coupling',
            'with N = 6 reamed bolts on pitch circle diameter Dp = 135 mm transmitting T = 1.8 kN·m.',
            'The bolts are fitted in reamed holes, so they carry the torque in shear.',
          ],
          figure2Caption: 'Figure 8.2  Section A–A of a rigid flanged shaft coupling.',
          bottomEquation: 'τbolt = 8T / (π db² N Dp);  Mmax = √(Fr² + Ft²) L / 4   (8.2)',
        }),
        pageText:
          '8.1 Stepped Transmission Countershaft with 22-tooth Spur Pinion. 8.2 Rigid Flanged Shaft Coupling in Torsional Shear: Shaft diameter d = 45 mm, flange OD D = 190 mm, bolt pitch circle Dp = 135 mm, torque T = 1.8 kN m.',
        blocks: [
          {
            kind: 'heading',
            number: '8.1',
            text: 'Stepped Countershaft with Involute Spur Pinion & Bearings',
          },
          {
            kind: 'paragraph',
            text: 'A turned alloy-steel countershaft is supported on self-aligning ball bearings at A and B (span L = 200 mm) and carries a 22-tooth 20° involute spur gear of module m = 4.5 mm and face width b = 38 mm at mid-span.',
          },
          {
            kind: 'figure-slot',
            figureId: 'fig-8-1-gearshaft',
          },
          {
            kind: 'heading',
            number: '8.2',
            text: 'Rigid Flanged Shaft Coupling (2D Back-Projection Verified)',
          },
          {
            kind: 'paragraph',
            text: 'When a figure does not match an existing catalog rig, Solidify builds the 3D assembly from basic solids and projects its 3D silhouette back onto 2D to verify that the built part matches the drawing proportions before replacing the figure.',
          },
          {
            kind: 'equation',
            number: '(8.2)',
            latex: '\\tau_{\\text{bolt}} = \\frac{F_b}{A_b} = \\frac{2T / (N \\cdot D_p)}{\\frac{\\pi}{4} d_b^2} \\le \\frac{S_{sy}}{n_d}',
          },
          {
            kind: 'figure-slot',
            figureId: 'fig-8-2-coupling',
          },
        ],
        figures: [
          {
            id: 'fig-8-1-gearshaft',
            pageNumber: 1,
            box: [190, 70, 515, 930],
            title: 'Figure 8.1',
            caption: 'Stepped alloy-steel countershaft with 22-tooth involute spur pinion and bearing reactions RA, RB.',
            courseTag: 'MEE202',
            confidence: 0.89,
            extractedGivens: [
              { symbol: 'N', label: 'Pinion teeth', value: 22, unit: '' },
              { symbol: 'm', label: 'Module', value: 4.5, unit: 'mm' },
              { symbol: 'F_t', label: 'Tangential load', value: 3.4, unit: 'kN' },
            ],
            visualization: {
              kind: 'procedural',
              spec: STEPPED_GEAR_SHAFT_SPEC,
            },
          },
          {
            id: 'fig-8-2-coupling',
            pageNumber: 1,
            box: [620, 70, 925, 930],
            title: 'Figure 8.2',
            caption: 'Rigid flanged shaft coupling in half-section (Ø45 mm shaft, 6× M16 bolts on Ø135 mm PCD).',
            courseTag: 'MEE202',
            confidence: 0.86,
            originalCropUrl: COUPLING_2D_SVG,
            extractedGivens: [
              { symbol: 'd', label: 'Shaft diameter', value: 45, unit: 'mm' },
              { symbol: 'D', label: 'Flange outer diameter', value: 190, unit: 'mm' },
              { symbol: 'D_p', label: 'Bolt pitch circle', value: 135, unit: 'mm' },
              { symbol: 'T', label: 'Transmitted torque', value: 1.8, unit: 'kN·m' },
            ],
            visualization: {
              kind: 'procedural',
              spec: FLANGED_COUPLING_SPEC,
            },
          },
        ],
      },
    ],
  },
]
