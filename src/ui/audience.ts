import { create } from 'zustand'

/**
 * Who the app is presenting to.
 * - professional: engineers, technicians, operators — engineering content only.
 * - academic: students and lecturers — adds exam presets, note citations, errata and course codes.
 */
export type Audience = 'professional' | 'academic'

const KEY = 'agritech.audience'

function load(): Audience {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'professional' || v === 'academic') return v
  } catch {
    /* storage unavailable (private mode, previews) */
  }
  return 'professional'
}

interface AudienceState {
  audience: Audience
  setAudience: (a: Audience) => void
}

export const useAudience = create<AudienceState>((set) => ({
  audience: load(),
  setAudience: (audience) => {
    try {
      localStorage.setItem(KEY, audience)
    } catch {
      /* ignore */
    }
    set({ audience })
  },
}))

export const useAcademic = () => useAudience((s) => s.audience === 'academic')

/** Section titles that only make sense for students (exam drills, marking schemes). */
const ACADEMIC_ONLY = /^(exam\b|marking\b|past question)|marking[- ]scheme/i
/** Parenthetical exam tags to strip from otherwise general titles, e.g. "Tractor types (exam list)". */
const EXAM_TAG = /\s*\((?:[^)]*\b(?:exam|marking)\b[^)]*)\)/gi

/**
 * Source references in titles — course codes, pages, figures, note abbreviations, marking guides.
 * These were authoring references and are never shown, e.g. "Torque calculator (AEE503 M8)".
 */
const REF_TAG = /\s*\((?=[^)]*(?:\bAEE\s?\d{3}\b|\bpp?\s?\d|\bTB\b|\bSupp\b|\bCh\.?\s?\d|\bFigs?\b|\bL\d\b|\bPT\b|\bTTS\b|\bTOP\b|\bLN\b|\bM\d+\b|\bBUSH\b|guide|scheme|\b(?:19|20)\d\d\/\d\d\b))[^)]*\)/g

/**
 * How a panel section should appear for an audience: hidden, or shown with a cleaned title.
 * Source references are stripped for everyone; exam drills are hidden from professionals.
 */
export function sectionForAudience(title: string, academic: boolean): { show: boolean; title: string } {
  const base = title.replace(REF_TAG, '').trim()
  if (academic) return { show: true, title: base }
  if (ACADEMIC_ONLY.test(base)) return { show: false, title: base }
  return { show: true, title: base.replace(EXAM_TAG, '').trim() }
}
