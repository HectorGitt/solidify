/**
 * A build the Create page has asked for, handed to the model workspace (/create/new), which starts it.
 * Kept in memory only: a photo is too large for the address bar, and a reload simply returns to Create.
 */
export interface PendingBuild {
  prompt: string
  photo?: { name: string; url: string }
}

let pending: PendingBuild | null = null

export const setPendingBuild = (b: PendingBuild) => {
  pending = b
}

/** the waiting build, if any; it stays until `clearPendingBuild`, so a re-render can read it again */
export const peekPendingBuild = () => pending

export const clearPendingBuild = () => {
  pending = null
}
