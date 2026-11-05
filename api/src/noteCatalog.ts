/**
 * The rigs a document figure can open as, for the vision prompt. Keep in step with
 * web/src/note3d/catalogTargets.ts: a web test reads this file and checks every scene and key exists there.
 */
export const NOTE_CATALOG = [
  { moduleId: 'materials', sceneId: 'beam', what: 'a beam on supports with point loads and a uniform load', keys: 'support ("simple" | "cantilever"), L (m), P1 (kN), x1 (m), P2 (kN), x2 (m), w (kN/m)' },
  { moduleId: 'materials', sceneId: 'stress-state', what: 'a plane-stress element or Mohr circle', keys: 'sx (MPa), sy (MPa), txy (MPa), theta (deg)' },
  { moduleId: 'materials', sceneId: 'pressure-vessel', what: 'a thin-walled cylinder under internal pressure', keys: 'p (MPa), r (mm), t (mm), length (mm)' },
  { moduleId: 'materials', sceneId: 'torsion', what: 'a solid or hollow shaft in torsion', keys: 'T (kN·m), L (m), D (mm), d (mm), hollow (true | false)' },
  { moduleId: 'materials', sceneId: 'buckling', what: 'a column or strut under axial load', keys: 'ends ("pinned-pinned" | "fixed-fixed" | "fixed-free" | "fixed-pinned"), L (m), D (mm), d (mm)' },
  { moduleId: 'mechanisms', sceneId: 'four-bar', what: 'a four-bar linkage', keys: 'frame (cm), crank (cm), coupler (cm), rocker (cm), rpm (rev/min)' },
  { moduleId: 'drawing', sceneId: 'true-length', what: 'a line in space, true length or auxiliary view', keys: 'dx (mm), dy (mm), dz (mm)' },
  { moduleId: 'drawing', sceneId: 'interpenetration', what: 'two cylinders meeting, curve of intersection', keys: 'R (mm), r (mm), angle (deg), offset (mm)' },
  { moduleId: 'thermal', sceneId: 'heat-exchanger', what: 'a double-pipe or shell-and-tube heat exchanger', keys: 'flow ("parallel" | "counter"), Thi (°C), Tci (°C), mh (kg/s), mc (kg/s), U (W/m²K), A (m²)' },
  { moduleId: 'thermal', sceneId: 'refrigeration', what: 'a vapour-compression refrigeration cycle or plant', keys: 'fluid ("ammonia" | "r134a"), Te (°C), Tc (°C)' },
  { moduleId: 'thermal', sceneId: 'steam-plant', what: 'a Rankine cycle or steam power plant', keys: 'pb (bar), pc (bar), T (°C)' },
] as const

export const catalogPromptText = () => NOTE_CATALOG.map((c) => `- ${c.moduleId}/${c.sceneId}: ${c.what}. params: ${c.keys}`).join('\n')
