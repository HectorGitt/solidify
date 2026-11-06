import { api } from './api'

/** what the admin page reads: the nightly test results, usage events, the review queue, feedback and the waitlist */

export interface EvalCheck {
  name: string
  ok: boolean
  detail?: string
}

export interface EvalSummary {
  score: number
  passed: number
  total: number
}

export interface EvalRun {
  runAt: number
  label?: string
  summary: EvalSummary
  cases: { id: string; prompt: string; score: number; seconds: number; checks: EvalCheck[]; error?: string }[]
}

export interface EventDay {
  day: string
  [kind: string]: string | number
}

export interface EventNote {
  kind: string
  subject: string
  detail: string
  day: string
}

export interface LibraryDraft {
  id: string
  title: string
  prompt: string
  topic?: string
  spec: Record<string, unknown>
  explanation?: string
  score: number
  checks?: EvalCheck[]
  parts: number
  createdAt: number
}

export interface LibraryCard {
  id: string
  title: string
  prompt: string
  topic?: string
  score: number
  parts: number
  createdAt: number
  publishedAt?: number
}

export interface LibraryItem extends LibraryCard {
  spec: Record<string, unknown>
  explanation?: string
}

export interface FeedbackItem {
  id: string
  kind: 'bug' | 'error' | 'idea' | 'sales'
  message: string
  route?: string
  partId?: string
  contact?: string
  name?: string
  organisation?: string
  seats?: string
  createdAt: number
}

export interface WaitlistEntry {
  email: string
  name?: string
  role?: string
  interest?: string[] | string
  organisation?: string
  useCase?: string
  createdAt: number
}

export const getEvals = () => api<{ runs: Omit<EvalRun, 'cases'>[]; latest: EvalRun | null }>('/v1/evals')
export const getEventSummary = () => api<{ days: EventDay[]; notes: EventNote[] }>('/v1/events/summary')
export const getDrafts = () => api<{ drafts: LibraryDraft[] }>('/v1/library/drafts')
export const approveDraft = (id: string, title?: string) => api<{ ok: true }>(`/v1/library/drafts/${encodeURIComponent(id)}/approve`, { method: 'POST', body: title ? { title } : {} })
export const rejectDraft = (id: string) => api<{ ok: true }>(`/v1/library/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const unpublish = (id: string) => api<{ ok: true }>(`/v1/library/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const getFeedback = () => api<{ feedback: FeedbackItem[] }>('/v1/feedback')
export const getWaitlist = () => api<{ count: number; entries: WaitlistEntry[] }>('/v1/waitlist')

/** the published library: anyone may read it */
export const listLibrary = () => api<{ items: LibraryCard[] }>('/v1/library')
export const getLibraryItem = (id: string) => api<LibraryItem>(`/v1/library/${encodeURIComponent(id)}`)
