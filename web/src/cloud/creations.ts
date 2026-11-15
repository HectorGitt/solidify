import { api } from './api'

/** a saved model as listed in My models (no spec or history, so the list stays small) */
export interface CreationSummary {
  id: string
  title: string
  prompt: string
  fromPhoto: boolean
  thumbnail?: string
  parts: number
  createdAt: number
  updatedAt: number
  /** a solved question: the start of it and what it asks (for Exam practice's "Your questions") */
  question?: { text: string; find: string[]; written?: boolean }
  /** shared by link: the id in its link (/s/{shareId}) */
  shareId?: string
}

export interface CreationInput {
  title: string
  prompt?: string
  fromPhoto?: boolean
  spec: Record<string, unknown>
  params?: Record<string, number>
  history?: { prompt: string; response: string }[]
  thumbnail?: string
}

export interface Creation extends CreationSummary {
  spec: Record<string, unknown>
  params: Record<string, number>
  history: { prompt: string; response: string }[]
}

export const listCreations = () => api<{ items: CreationSummary[]; limit: number }>('/v1/creations')
export const getCreation = (id: string) => api<Creation>(`/v1/creations/${encodeURIComponent(id)}`)
export const saveNewCreation = (c: CreationInput) => api<{ id: string }>('/v1/creations', { method: 'POST', body: c })
export const updateCreation = (id: string, patch: Partial<CreationInput>) => api<void>(`/v1/creations/${encodeURIComponent(id)}`, { method: 'PUT', body: patch })
export const deleteCreation = (id: string) => api<void>(`/v1/creations/${encodeURIComponent(id)}`, { method: 'DELETE' })

/** a model shared by link, as anyone with the link sees it */
export interface SharedModel {
  id: string
  /** the sharer's first name */
  by: string
  title: string
  prompt: string
  spec: Record<string, unknown>
  params: Record<string, number>
  explanation?: string
  thumbnail?: string
  createdAt: number
  updatedAt: number
  /** the signed-in student shared it themselves */
  yours: boolean
}

/** the link anyone can open */
export const shareUrl = (shareId: string) => `${window.location.origin}/#/s/${shareId}`
/** share a saved model by link (the same link each time, until sharing stops) */
export const shareCreation = (id: string) => api<{ shareId: string }>(`/v1/creations/${encodeURIComponent(id)}/share`, { method: 'POST', body: {} })
/** stop sharing: the link stops working */
export const unshareCreation = (id: string) => api<void>(`/v1/creations/${encodeURIComponent(id)}/share`, { method: 'DELETE' })
export const getShared = (shareId: string) => api<SharedModel>(`/v1/shared/${encodeURIComponent(shareId)}`)
