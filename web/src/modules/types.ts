import type { ComponentType } from 'react'
import type { BuildDef } from '@/render/build'
import type { Citation } from '@/content/citations'
import type { CutPreset } from '@/render/view'

export type Vec3 = [number, number, number]

export interface CameraPose {
  position: Vec3
  target: Vec3
}

/** A quick prediction question on a tour step (a "checkpoint"). */
export interface TourCheck {
  /** e.g. "If you add ballast to the rear wheels, what happens to wheel slip?" */
  question: string
  /** 2–4 short choices */
  options: string[]
  /** index of the right choice */
  answer: number
  /** why, in one or two sentences (shown after answering) */
  explain: string
  /** scene changes applied after answering, so the scene shows the answer */
  reveal?: Omit<TourStep, 'title' | 'body' | 'check' | 'cites'>
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
  /** optional checkpoint question for this step */
  check?: TourCheck
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
  /** cut preset applied on entry; leave undefined to open the scene whole (uncut) */
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
  /**
   * Live values handed to a detail scene when you drill down from here, in shared units:
   * rpm, slip (0–1), pullKN, wheelLoadKN, speedKmh, CI (kPa), tyre ('bias' | 'radial').
   */
  context?: () => SceneContext
  /** settings for this scene from the context of the scene you came from (null = ignore) */
  fromContext?: (ctx: SceneContext) => Record<string, unknown> | null
  /** side-by-side comparison of a few variants of the current settings */
  compare?: CompareDef
  /** async work before the scene mounts (e.g. building CSG geometry in the worker) */
  prepare?: () => Promise<unknown>
  /** build mode: the parts in assembly order, each with what it needs in first */
  build?: BuildDef
}

/** shared live values passed between scenes on drill-down */
export type SceneContext = Partial<{ rpm: number; slip: number; pullKN: number; wheelLoadKN: number; speedKmh: number; CI: number; tyre: 'bias' | 'radial' }>

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

export interface CompareMetric {
  label: string
  value: number
  unit?: string
  digits?: number
  /** which way is better (highlights the best variant) */
  better?: 'high' | 'low'
  /** shown instead of the number (e.g. "spins") */
  text?: string
}

export interface CompareDef {
  title: string
  /** the current settings */
  current: () => Record<string, unknown>
  /** each variant overrides some of the current settings */
  variants: { label: string; params: Record<string, unknown> }[]
  /** pure: readouts for a full set of settings */
  metrics: (p: Record<string, unknown>) => CompareMetric[]
}
