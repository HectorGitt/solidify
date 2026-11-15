/**
 * A model to look at in the workspace without saving it (/create/preview): a draft in the review queue, a
 * published library model, a model file opened from the computer. In memory only, like a pending build; a
 * reload returns to where it came from.
 */
export interface PreviewModel {
  title: string
  prompt: string
  spec: Record<string, unknown>
  explanation?: string
  /** where "back" goes (the admin page tab it came from, the Open a model file page) */
  backTo: string
  /** a draft under review: changes made in the workspace can be saved back to it */
  draftId?: string
  /** opened from a share link: who shared it, and whether it is the student’s own */
  shared?: { id: string; by: string; yours: boolean }
}

let preview: PreviewModel | null = null
const BACK_KEY = 'solidify.preview.back'

export const setPreviewModel = (p: PreviewModel) => {
  preview = p
  // remembered for the tab, so a reload (which loses the model) goes back to where it was opened
  try {
    sessionStorage.setItem(BACK_KEY, p.backTo)
  } catch {
    /* storage off: a reload goes to the default */
  }
}
export const peekPreviewModel = () => preview

/** where a preview was opened from, after a reload has lost the model itself */
export const previewBackAfterReload = (fallback: string) => {
  try {
    const v = sessionStorage.getItem(BACK_KEY)
    return v && v.startsWith('/') ? v : fallback
  } catch {
    return fallback
  }
}
