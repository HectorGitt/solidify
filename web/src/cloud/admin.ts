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
  tokensIn?: number
  tokensOut?: number
}

/** the model's list price, US dollars per million tokens (set on the API as MODEL_PRICE) */
export interface ModelPrice {
  inputPerM: number
  outputPerM: number
}

export const costOf = (p: ModelPrice | null, input: number, output: number) => (p ? (input * p.inputPerM + output * p.outputPerM) / 1e6 : null)

export interface EvalRun {
  runAt: number
  label?: string
  summary: EvalSummary
  cases: { id: string; prompt: string; score: number; seconds: number; checks: EvalCheck[]; error?: string; tokensIn?: number; tokensOut?: number }[]
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

export const getEvals = () => api<{ runs: Omit<EvalRun, 'cases'>[]; latest: EvalRun | null; price: ModelPrice | null }>('/v1/evals')
/** per day: `<action>_n` actions, `<action>_in` and `<action>_out` tokens, for build, edit, question and photo */
export const getAiUsage = () => api<{ days: ({ day: string } & Record<string, number | string>)[]; price: ModelPrice | null }>('/v1/ai-usage')
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

/* the admin's controls */

export interface QualitySettings {
  paused: boolean
  draftsPerNight: number
  draftMin: number
  price: ModelPrice | null
}

export interface TopicItem {
  topic: string
  prompt: string
}

/** what a build returns: the model, its explanation, and the tokens it used */
export interface BuildReply {
  spec: Record<string, unknown>
  explanation: string
  isQuestion?: boolean
  usage?: { input: number; output: number }
  ms: number
}

export const getAdminSettings = () => api<{ settings: QualitySettings; topics: TopicItem[] | null; canRunTests: boolean }>('/v1/admin/settings')
export const saveSettings = (patch: Partial<QualitySettings>) => api<{ settings: QualitySettings }>('/v1/admin/settings', { method: 'PUT', body: patch })
export const saveTopics = (items: TopicItem[]) => api<{ topics: TopicItem[] }>('/v1/admin/topics', { method: 'PUT', body: { items } })
export const resetTopics = () => api<{ topics: null }>('/v1/admin/topics', { method: 'DELETE' })
export const adminBuild = (req: { prompt: string; currentSpec?: Record<string, unknown>; history?: { prompt: string; response: string }[] }) => api<BuildReply>('/v1/admin/build', { method: 'POST', body: req })
export const runTestsNow = (r: { limit?: number; drafts?: number }) => api<{ ok: true }>('/v1/admin/run-tests', { method: 'POST', body: r })

export interface DraftFields {
  title: string
  prompt: string
  topic?: string
  spec: Record<string, unknown>
  explanation?: string
  score: number
  checks?: EvalCheck[]
}
export const addDraft = (d: DraftFields) => api<{ id: string }>('/v1/library/drafts', { method: 'POST', body: d })
export const updateDraft = (id: string, patch: Partial<DraftFields>) => api<LibraryDraft>(`/v1/library/drafts/${encodeURIComponent(id)}`, { method: 'PUT', body: patch })

export const publishModel = (d: DraftFields) => api<{ id: string }>('/v1/library', { method: 'POST', body: d })
export const updateLibraryItem = (id: string, patch: { title?: string; topic?: string }) => api<{ ok: true }>(`/v1/library/${encodeURIComponent(id)}`, { method: 'PUT', body: patch })
