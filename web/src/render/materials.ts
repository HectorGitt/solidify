import * as THREE from 'three'

/**
 * Material library + section-cap shader.
 *
 * Section caps use a single-pass "back-face cap" technique: when a closed mesh is clipped,
 * the only back faces that survive the depth test are those seen through the cut (wherever
 * the part is whole, its own front faces are nearer and hide them). For those fragments we
 * cast the view ray onto the cut plane(s) and shade the hit point as a flat hatched cap in
 * the part's section style. The fragment keeps its true depth — writing the plane's depth
 * instead would let caps of uncut parts paint over their own front faces. Exact for
 * non-interpenetrating watertight meshes; no extra draw calls.
 */

export type HatchStyle = 'none' | 'steel' | 'castIron' | 'light' | 'bronze' | 'cross' | 'dots' | 'fluid' | 'grain'

const HATCH_ID: Record<HatchStyle, number> = {
  none: 0,
  steel: 1,
  castIron: 2,
  light: 3,
  bronze: 4,
  cross: 5,
  dots: 6,
  fluid: 7,
  grain: 8,
}

export interface MaterialDef {
  label: string
  color: string
  metalness: number
  roughness: number
  hatch: HatchStyle
  /** colour of the section cap (defaults to a lighter tint of `color`) */
  cap?: string
  clearcoat?: number
  transparent?: boolean
  opacity?: number
  emissive?: string
  emissiveIntensity?: number
}

/** Engineering materials. Paints are deliberately generic (no manufacturer liveries). */
export const MATERIALS = {
  castIron: { label: 'Cast iron', color: '#5d6266', metalness: 0.55, roughness: 0.62, hatch: 'castIron', cap: '#9aa3a8' },
  steel: { label: 'Steel (machined)', color: '#b9c0c6', metalness: 1, roughness: 0.28, hatch: 'steel', cap: '#c8d0d6' },
  /** flat machined faces (gear sides, plates) — less metallic so broad faces don't reflect only the dark backdrop */
  steelMatte: { label: 'Steel (ground)', color: '#a3aab0', metalness: 0.55, roughness: 0.4, hatch: 'steel', cap: '#c8d0d6' },
  steelDark: { label: 'Steel (heat-treated)', color: '#6f767c', metalness: 0.9, roughness: 0.4, hatch: 'steel', cap: '#a9b2b8' },
  chrome: { label: 'Hard chrome', color: '#e6eaee', metalness: 1, roughness: 0.12, hatch: 'steel', cap: '#d8dee3' },
  forged: { label: 'Forged steel', color: '#7c858c', metalness: 0.85, roughness: 0.45, hatch: 'steel', cap: '#b4bcc2' },
  aluminium: { label: 'Aluminium alloy', color: '#c9ccd0', metalness: 0.9, roughness: 0.38, hatch: 'light', cap: '#dfe3e7' },
  bronze: { label: 'Bronze', color: '#b07b3c', metalness: 1, roughness: 0.35, hatch: 'bronze', cap: '#d6a465' },
  brass: { label: 'Brass', color: '#c9a24a', metalness: 1, roughness: 0.3, hatch: 'bronze', cap: '#e0c27a' },
  copper: { label: 'Copper', color: '#b8653a', metalness: 1, roughness: 0.3, hatch: 'bronze', cap: '#d98b62' },
  bearing: { label: 'White metal (bearing)', color: '#c7c4b8', metalness: 0.8, roughness: 0.35, hatch: 'dots', cap: '#d8d4c6' },
  rubber: { label: 'Rubber', color: '#1d1f21', metalness: 0, roughness: 0.92, hatch: 'cross', cap: '#3a3e42' },
  friction: { label: 'Friction lining', color: '#6b5a45', metalness: 0, roughness: 0.95, hatch: 'dots', cap: '#9b8466' },
  gasket: { label: 'Gasket', color: '#8a7b5c', metalness: 0.1, roughness: 0.8, hatch: 'dots', cap: '#a8977a' },
  ceramic: { label: 'Porcelain', color: '#ece9e1', metalness: 0, roughness: 0.25, hatch: 'cross', cap: '#f4f1ea' },
  plastic: { label: 'Plastic', color: '#2b2f33', metalness: 0, roughness: 0.6, hatch: 'cross', cap: '#555b61' },
  wood: { label: 'Wood', color: '#8a6238', metalness: 0, roughness: 0.8, hatch: 'grain', cap: '#b48a5c' },
  paintGreen: { label: 'Painted steel (green)', color: '#2f6b3a', metalness: 0.35, roughness: 0.42, hatch: 'steel', cap: '#9fb7a3', clearcoat: 0.6 },
  paintYellow: { label: 'Painted steel (yellow)', color: '#d9a21b', metalness: 0.35, roughness: 0.42, hatch: 'steel', cap: '#d8c48a', clearcoat: 0.6 },
  paintRed: { label: 'Painted steel (red)', color: '#a3271f', metalness: 0.35, roughness: 0.42, hatch: 'steel', cap: '#c9928d', clearcoat: 0.6 },
  paintGrey: { label: 'Painted steel (grey)', color: '#4a5056', metalness: 0.35, roughness: 0.5, hatch: 'steel', cap: '#9aa1a7', clearcoat: 0.4 },
  paintBlack: { label: 'Painted steel (black)', color: '#1f2326', metalness: 0.3, roughness: 0.5, hatch: 'steel', cap: '#6d747a', clearcoat: 0.4 },
  paintBlue: { label: 'Painted steel (blue)', color: '#2a5d9c', metalness: 0.35, roughness: 0.42, hatch: 'steel', cap: '#93add0', clearcoat: 0.6 },
  paintOrange: { label: 'Painted steel (orange)', color: '#d0631c', metalness: 0.35, roughness: 0.42, hatch: 'steel', cap: '#e0a77f', clearcoat: 0.6 },
  galvanised: { label: 'Galvanised steel', color: '#a9b0ae', metalness: 0.8, roughness: 0.55, hatch: 'steel', cap: '#c3c9c7' },
  leather: { label: 'Leather', color: '#7a4b2a', metalness: 0, roughness: 0.75, hatch: 'grain', cap: '#a57250' },
  nylon: { label: 'Nylon / polymer', color: '#d9d4c3', metalness: 0, roughness: 0.5, hatch: 'cross', cap: '#e8e3d4' },
  concrete: { label: 'Concrete', color: '#7d7f7b', metalness: 0, roughness: 0.95, hatch: 'dots', cap: '#9c9e99' },
  crop: { label: 'Crop', color: '#6f9a3a', metalness: 0, roughness: 0.8, hatch: 'none' },
  straw: { label: 'Straw', color: '#d8bf72', metalness: 0, roughness: 0.85, hatch: 'grain', cap: '#e5d293' },
  glass: { label: 'Glass', color: '#b9d6e0', metalness: 0, roughness: 0.05, hatch: 'none', transparent: true, opacity: 0.3 },
  oil: { label: 'Engine oil', color: '#a8741c', metalness: 0, roughness: 0.15, hatch: 'fluid', cap: '#c98d22', transparent: true, opacity: 0.85 },
  hydraulicOil: { label: 'Hydraulic oil', color: '#b8402c', metalness: 0, roughness: 0.15, hatch: 'fluid', cap: '#cf5a3f', transparent: true, opacity: 0.85 },
  coolant: { label: 'Coolant', color: '#2b8fb3', metalness: 0, roughness: 0.1, hatch: 'fluid', cap: '#3fa9cf', transparent: true, opacity: 0.8 },
  fuel: { label: 'Diesel fuel', color: '#d7c25a', metalness: 0, roughness: 0.1, hatch: 'fluid', cap: '#e4d377', transparent: true, opacity: 0.8 },
  water: { label: 'Water', color: '#3d8fd1', metalness: 0, roughness: 0.05, hatch: 'fluid', cap: '#5aa6e0', transparent: true, opacity: 0.7 },
  soil: { label: 'Soil', color: '#5b4330', metalness: 0, roughness: 1, hatch: 'dots', cap: '#7a5c42' },
  grain: { label: 'Grain', color: '#d6b25e', metalness: 0, roughness: 0.8, hatch: 'dots', cap: '#e2c57c' },
} satisfies Record<string, MaterialDef>

export type MaterialKey = keyof typeof MATERIALS

export type Highlight = 'none' | 'hover' | 'select'
export type Variant = 'solid' | 'cut' | 'xray'

/* ------------------------------ Shared cut uniforms ------------------------------ */

export const MAX_CUT_PLANES = 4

/** Shared by every cut material — mutate in place, never reassign. */
export const cutPlanes: THREE.Plane[] = []

export const capUniforms = {
  uCapPlanes: { value: Array.from({ length: MAX_CUT_PLANES }, () => new THREE.Vector4()) },
  uCapCount: { value: 0 },
  uCapIntersect: { value: 0 },
  /** world units per hatch line spacing */
  uHatchScale: { value: 0.004 },
  uCapIntersectFlag: { value: false },
}

/** Called once per frame by <CutController/>. */
export function syncCapUniforms(camera: THREE.Camera, intersection: boolean) {
  capUniforms.uCapCount.value = cutPlanes.length
  capUniforms.uCapIntersect.value = intersection ? 1 : 0
  for (let i = 0; i < MAX_CUT_PLANES; i++) {
    const p = cutPlanes[i]
    if (p) capUniforms.uCapPlanes.value[i].set(p.normal.x, p.normal.y, p.normal.z, p.constant)
  }
  void camera
}

/* ------------------------------ Shader injection ------------------------------ */

const VERT_DECL = /* glsl */ `
varying vec3 vCapWorldPos;
`
const VERT_BODY = /* glsl */ `
#include <project_vertex>
{
  vec4 capWP = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    capWP = instanceMatrix * capWP;
  #endif
  vCapWorldPos = ( modelMatrix * capWP ).xyz;
}
`

const FRAG_DECL = /* glsl */ `
varying vec3 vCapWorldPos;
uniform vec4 uCapPlanes[${MAX_CUT_PLANES}];
uniform int uCapCount;
uniform int uCapIntersect;
uniform float uHatchScale;
uniform vec3 uCapColor;
uniform int uHatch;
uniform vec3 uCapHighlight;

float capLine( float s, float halfWidth ) {
  float w = fwidth( s );
  float f = fract( s );
  float d = min( f, 1.0 - f );
  float l = 1.0 - smoothstep( halfWidth - w, halfWidth + w, d );
  // fade to average coverage when lines get too dense to resolve
  return mix( l, 2.0 * halfWidth, smoothstep( 0.25, 0.6, w ) );
}

float capPattern( vec2 q, int style ) {
  float a = ( q.x + q.y ) * 0.70710678;
  float b = ( q.x - q.y ) * 0.70710678;
  if ( style == 1 ) return capLine( a, 0.09 );                          // steel: fine 45°
  if ( style == 2 ) return capLine( a * 0.6, 0.12 );                    // cast iron: wider 45°
  if ( style == 3 ) return capLine( a * 0.5, 0.06 ) * 0.6;              // light alloy
  if ( style == 4 ) {                                                    // bronze: line + dashed line
    float main = capLine( a * 0.5, 0.08 );
    float dash = step( 0.5, fract( b * 0.35 ) ) * capLine( a * 0.5 + 0.5, 0.06 );
    return max( main, dash );
  }
  if ( style == 5 ) return max( capLine( a * 0.6, 0.08 ), capLine( b * 0.6, 0.08 ) ); // rubber/plastic: cross
  if ( style == 6 ) {                                                    // dots
    vec2 g = fract( q * 0.7 ) - 0.5;
    float r = length( g );
    float w = fwidth( r );
    return ( 1.0 - smoothstep( 0.16 - w, 0.16 + w, r ) ) * 0.8;
  }
  if ( style == 7 ) return 0.12 * capLine( q.y * 0.35, 0.04 );          // fluid: faint level lines
  if ( style == 8 ) return capLine( q.y * 0.8 + 0.25 * sin( q.x * 0.9 ), 0.07 ); // wood grain
  return 0.0;
}
`

const FRAG_BODY = /* glsl */ `
#include <opaque_fragment>
#ifdef CAP_ENABLED
if ( !gl_FrontFacing ) {
  vec3 P = vCapWorldPos;
  vec3 O = cameraPosition;
  if ( isOrthographic ) {
    vec3 fwd = -vec3( viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2] );
    O = P - fwd * 1000.0;
  }
  float tBest = uCapIntersect == 1 ? 1e9 : -1e9;
  vec4 plane = vec4( 0.0 );
  bool found = false;
  for ( int i = 0; i < ${MAX_CUT_PLANES}; i++ ) {
    if ( i >= uCapCount ) break;
    vec4 pl = uCapPlanes[ i ];
    float dO = dot( pl.xyz, O ) + pl.w;
    float dP = dot( pl.xyz, P ) + pl.w;
    if ( dO < 0.0 && dP >= -1e-5 ) {
      float t = dO / ( dO - dP );
      bool better = uCapIntersect == 1 ? ( t < tBest ) : ( t > tBest );
      if ( better ) { tBest = t; plane = pl; found = true; }
    }
  }
  if ( found ) {
    vec3 X = O + ( P - O ) * tBest;
    vec3 n = plane.xyz;
    vec3 helper = abs( n.y ) < 0.99 ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
    vec3 u = normalize( cross( helper, n ) );
    vec3 v = cross( n, u );
    vec2 q = vec2( dot( X, u ), dot( X, v ) ) / uHatchScale;
    float line = capPattern( q, uHatch );
    float shade = 0.62 + 0.16 * abs( dot( n, normalize( vec3( 0.35, 0.8, 0.45 ) ) ) );
    vec3 col = uCapColor * shade;
    col = mix( col, col * 0.38, line );
    col += uCapHighlight;
    gl_FragColor = vec4( col, 1.0 );
  } else {
    // interior seen through an opening that isn't a cut (non-watertight mesh): dark cavity
    gl_FragColor = vec4( uCapColor * 0.18, 1.0 );
  }
}
#endif
`

function injectCap(mat: THREE.MeshStandardMaterial, def: MaterialDef, highlight: Highlight, capColor = new THREE.Color(def.cap ?? def.color)) {
  const hl = highlight === 'select' ? new THREE.Color(0.10, 0.07, 0.0) : highlight === 'hover' ? new THREE.Color(0.05, 0.05, 0.05) : new THREE.Color(0, 0, 0)
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCapPlanes = capUniforms.uCapPlanes
    shader.uniforms.uCapCount = capUniforms.uCapCount
    shader.uniforms.uCapIntersect = capUniforms.uCapIntersect
    shader.uniforms.uHatchScale = capUniforms.uHatchScale
    shader.uniforms.uCapColor = { value: capColor }
    shader.uniforms.uHatch = { value: HATCH_ID[def.hatch] }
    shader.uniforms.uCapHighlight = { value: hl }
    shader.vertexShader = VERT_DECL + shader.vertexShader.replace('#include <project_vertex>', VERT_BODY)
    shader.fragmentShader = FRAG_DECL + shader.fragmentShader.replace('#include <opaque_fragment>', FRAG_BODY)
  }
  mat.defines = { ...(mat.defines ?? {}), CAP_ENABLED: '' }
  mat.customProgramCacheKey = () => `cap|${def.hatch}|${highlight}`
}

/* ------------------------------ Factory + cache ------------------------------ */

const cache = new Map<string, THREE.Material>()

export interface MaterialOptions {
  variant: Variant
  highlight: Highlight
  intersection: boolean
  /** override base colour (e.g. gas temperature) — creates an uncached material */
  color?: string
  /** system colour mixed into the base colour (colour-by-system views) */
  tint?: string
}

/**
 * A liquid fills its sump, tank or jacket right up to the walls, so its surface and the container's inner
 * surface are in the same place and the depth test can't tell which is in front: as the camera moves,
 * patches of the casing break through the oil (worst in a cut-away, where the oil's far side is drawn as
 * its section). A small depth nudge toward the camera makes the liquid win wherever the two coincide; it is
 * far thinner than any wall, so the liquid never shows through one.
 */
function liquidWins(m: THREE.Material) {
  m.polygonOffset = true
  m.polygonOffsetFactor = -1
  m.polygonOffsetUnits = -4
}

function baseMaterial(def: MaterialDef, highlight: Highlight) {
  const params: THREE.MeshPhysicalMaterialParameters = {
    color: def.color,
    metalness: def.metalness,
    roughness: def.roughness,
    clearcoat: def.clearcoat ?? 0,
    clearcoatRoughness: 0.3,
    transparent: def.transparent ?? false,
    opacity: def.opacity ?? 1,
    emissive: def.emissive ?? '#000000',
    emissiveIntensity: def.emissiveIntensity ?? 1,
  }
  const m = new THREE.MeshPhysicalMaterial(params)
  if (def.hatch === 'fluid') liquidWins(m)
  if (highlight === 'select') {
    m.emissive = new THREE.Color('#f0a020')
    m.emissiveIntensity = 0.28
  } else if (highlight === 'hover') {
    m.emissive = new THREE.Color('#ffffff')
    m.emissiveIntensity = 0.08
  }
  return m
}

export function getMaterial(key: MaterialKey, opts: MaterialOptions): THREE.Material {
  const def: MaterialDef = MATERIALS[key]
  const cacheKey = `${key}|${opts.variant}|${opts.highlight}|${opts.intersection ? 'I' : 'U'}|${opts.tint ?? ''}`
  const hit = cache.get(cacheKey)
  if (hit) return hit

  const m = baseMaterial(def, opts.highlight)
  if (opts.tint) {
    // keep the material's character (metal, rubber…) but read as its system's colour
    const t = new THREE.Color(opts.tint)
    m.color.lerp(t, 0.55)
    if (opts.highlight === 'none') {
      m.emissive = t
      m.emissiveIntensity = 0.12
    }
  }
  if (opts.variant === 'xray') {
    m.transparent = true
    m.opacity = 0.1
    m.depthWrite = false
    m.side = THREE.FrontSide
    m.color.lerp(new THREE.Color('#9fc4ff'), 0.4)
  } else if (opts.variant === 'cut') {
    m.clippingPlanes = cutPlanes
    m.clipIntersection = opts.intersection
    m.clipShadows = true
    if (def.hatch !== 'none') {
      // fluids are drawn opaque in section so their cut face reads as a solid fill
      m.transparent = false
      m.opacity = 1
      m.side = THREE.DoubleSide
      injectCap(m, def, opts.highlight)
    }
  }
  cache.set(cacheKey, m)
  return m
}

/**
 * An uncached, always-clipped material whose body and cap colours can be changed every
 * frame (e.g. cylinder gas coloured by temperature). Mutate `color` / `emissive` / `capColor`.
 */
export function createDynamicCutMaterial(base: Partial<MaterialDef> & { color: string; vertexColors?: boolean }) {
  const def: MaterialDef = { label: 'dynamic', metalness: 0, roughness: 0.5, hatch: 'fluid', ...base }
  const capColor = new THREE.Color(def.cap ?? def.color)
  const m = new THREE.MeshPhysicalMaterial({ color: def.color, vertexColors: base.vertexColors ?? false, metalness: def.metalness, roughness: def.roughness, emissive: def.emissive ?? '#000000', emissiveIntensity: def.emissiveIntensity ?? 1 })
  m.clippingPlanes = cutPlanes
  m.side = THREE.DoubleSide
  if (def.hatch === 'fluid') liquidWins(m)
  injectCap(m, def, 'none', capColor)
  m.customProgramCacheKey = () => `dyncap|${def.hatch}`
  return { material: m, capColor }
}

/** Plain clipped-or-not material for helper geometry (flows, gas) that should obey the cut. */
export function getCustomMaterial(id: string, make: () => THREE.Material) {
  const hit = cache.get(id)
  if (hit) return hit
  const m = make()
  cache.set(id, m)
  return m
}

export function materialLabel(key: MaterialKey) {
  return MATERIALS[key].label
}
