/**
 * A model to look at in the workspace without saving it (/create/preview): a draft in the review queue, a
 * published library model. In memory only, like a pending build; a reload returns to where it came from.
 */
export interface PreviewModel {
  title: string
  prompt: string
  spec: Record<string, unknown>
  explanation?: string
  /** where "back" goes (the admin page tab it came from) */
  backTo: string
  /** a draft under review: changes made in the workspace can be saved back to it */
  draftId?: string
}

let preview: PreviewModel | null = null

export const setPreviewModel = (p: PreviewModel) => {
  preview = p
}
export const peekPreviewModel = () => preview
