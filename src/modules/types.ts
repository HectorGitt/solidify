import type { ComponentType } from 'react'
import type { Citation } from '@/content/citations'
import type { CutPreset } from '@/render/view'

export type Vec3 = [number, number, number]

export interface CameraPose {
  position: Vec3
  target: Vec3
}

export interface TourStep {
  title: string
  /** short paragraphs; **bold** supported */
  body: string
  cites?: Citation[]
  camera?: CameraPose
  /** part to highlight (null clears) */
  select?: string | null
  isolate?: string | null
  /** cut preset id, or false to switch the cut off */
  cut?: string | false
  sectionMoving?: boolean
  explode?: number
  xray?: boolean
  playing?: boolean
  timeScale?: number
  /** scene-specific parameter changes, applied via SceneDef.applyParams */
  params?: Record<string, unknown>
}

export interface SceneDef {
  id: string
  title: string
  summary: string
  /** 3D content, rendered inside the Canvas */
  Viewport: ComponentType
  /** DOM content for the Controls tab (parameters, working, charts) */
  Panel?: ComponentType
  camera: CameraPose
  cutPresets?: CutPreset[]
  defaultPreset?: string
  /** world units between hatch lines on section caps */
  hatchScale?: number
  /** approximate scene size (m) — sizes helpers, grid, camera limits */
  extent: number
  /** floor height */
  floorY?: number
  timeScale?: number
  cites?: Citation[]
  tour?: TourStep[]
  applyParams?: (p: Record<string, unknown>) => void
  /** reset scene-local state when entering */
  reset?: () => void
  /** part id the camera keeps following (e.g. 'tractor' in field scenes), preserving its offset */
  follow?: string
  /** async work before the scene mounts (e.g. building CSG geometry in the worker) */
  prepare?: () => Promise<unknown>
}

export interface SceneEntry {
  id: string
  title: string
  summary: string
  /** loaded on demand (code splitting); filled in automatically from the scene folder */
  load?: () => Promise<{ default: SceneDef }>
  /** folder under src/modules/<moduleId>/ (defaults to the scene id) */
  folder?: string
  /** frequently examined in past papers */
  exam?: boolean
}

export interface ModuleDef {
  id: string
  code: string
  title: string
  courses: string[]
  blurb: string
  scenes: SceneEntry[]
}
