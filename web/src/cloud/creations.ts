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
