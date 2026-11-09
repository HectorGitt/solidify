import { api } from './api'
import type { StaffRole } from './profile'

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
  thumbnail?: string
  reviewNotes?: string
  checklist?: ReviewChecklist
}

/** what a reviewer has checked on a draft */
export interface ReviewChecklist {
  calculations?: boolean
  model?: boolean
  text?: boolean
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
  thumbnail?: string
  reviewedBy?: { uid: string; name: string }
  /** anyone may open it, signed in or not */
  free?: boolean
  /** a curator's choice: free to view (true), sign-in only (false), or left to the default (the six best) */
  open?: boolean
}

export interface LibraryItem extends LibraryCard {
  spec: Record<string, unknown>
  explanation?: string
}

export interface FeedbackItem {
  id: string
  status?: 'new' | 'done'
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
export const rejectDraft = (id: string, reason?: string) => api<{ ok: true }>(`/v1/library/drafts/${encodeURIComponent(id)}${reason ? `?reason=${encodeURIComponent(reason.slice(0, 500))}` : ''}`, { method: 'DELETE' })
export const getReviewers = () => api<{ emails: string[] }>('/v1/admin/reviewers')
export const saveReviewers = (emails: string[]) => api<{ emails: string[] }>('/v1/admin/reviewers', { method: 'PUT', body: { emails } })
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

export const getAdminSettings = () => api<{ settings: QualitySettings; topics: TopicItem[] | null }>('/v1/admin/settings')
export const saveSettings = (patch: Partial<QualitySettings>) => api<{ settings: QualitySettings }>('/v1/admin/settings', { method: 'PUT', body: patch })
export const saveTopics = (items: TopicItem[]) => api<{ topics: TopicItem[] }>('/v1/admin/topics', { method: 'PUT', body: { items } })
export const resetTopics = () => api<{ topics: null }>('/v1/admin/topics', { method: 'DELETE' })
/** the next unused topics from the drafting pool (topped up by Gemini when it runs low); each is then used */
export const nextTopics = (want: number, fallback: TopicItem[]) => api<{ topics: TopicItem[]; added: number }>('/v1/admin/topics/next', { method: 'POST', body: { want, fallback: fallback.slice(0, 300) } })
export const adminBuild = (req: { prompt: string; currentSpec?: Record<string, unknown>; history?: { prompt: string; response: string }[] }) => api<BuildReply>('/v1/admin/build', { method: 'POST', body: req })
/** saves a run made on the admin page with the nightly ones */
export const saveRun = (run: Omit<EvalRun, 'cases'> & { cases: EvalRun['cases'] }) => api<{ ok: true }>('/v1/evals/runs', { method: 'POST', body: run })

export interface DraftFields {
  title: string
  prompt: string
  topic?: string
  spec: Record<string, unknown>
  explanation?: string
  score: number
  checks?: EvalCheck[]
  thumbnail?: string
}
export const addDraft = (d: DraftFields) => api<{ id: string }>('/v1/library/drafts', { method: 'POST', body: d })
export const updateDraft = (id: string, patch: Partial<DraftFields> & { reviewNotes?: string; checklist?: ReviewChecklist }) => api<LibraryDraft>(`/v1/library/drafts/${encodeURIComponent(id)}`, { method: 'PUT', body: patch })

export const publishModel = (d: DraftFields) => api<{ id: string }>('/v1/library', { method: 'POST', body: d })
export const updateLibraryItem = (id: string, patch: { title?: string; topic?: string; thumbnail?: string; open?: boolean }) => api<{ ok: true }>(`/v1/library/${encodeURIComponent(id)}`, { method: 'PUT', body: patch })

/** a line in the audit trail: who did what, to what, and when */
export interface AuditEntry {
  at: number
  by: { uid: string; name: string; email?: string }
  action: string
  target: { type: 'draft' | 'library' | 'settings' | 'reviewers' | 'topics'; id?: string; title?: string }
  detail: string
}
export const getAudit = (f: { by?: string; action?: string } = {}) =>
  api<{ entries: AuditEntry[]; people: AuditEntry['by'][]; actions: string[] }>(`/v1/admin/audit?${new URLSearchParams(Object.entries(f).filter(([, v]) => !!v) as [string, string][]).toString()}`)
export const getHistory = (id: string) => api<{ entries: AuditEntry[] }>(`/v1/review/history/${encodeURIComponent(id)}`)

/* people and their roles */
export interface Person {
  email: string
  roles: StaffRole[]
  owner: boolean
  name?: string
  uid?: string
  joined?: number
}
export interface Lookup {
  email: string
  found: boolean
  roles: StaffRole[]
  uid?: string
  name?: string
  role?: 'student' | 'teacher'
  joined?: number
  today?: { builds: number; notePages: number; tutor: number; libraryModels?: number }
  models?: number
}
/** requests without a valid App Check token, by day */
export const getAppCheckStats = () => api<{ mode: 'off' | 'monitor' | 'enforce'; days: ({ day: string } & Record<string, number | string>)[] }>('/v1/admin/app-check')
export const getPeople = () => api<{ people: Person[]; roles: StaffRole[] }>('/v1/admin/people')
export const setRoles = (email: string, roles: StaffRole[]) => api<{ email: string; roles: StaffRole[] }>('/v1/admin/people', { method: 'PUT', body: { email, roles } })
/** every account, a page at a time */
export interface Account {
  uid: string
  email: string
  name: string
  type: 'student' | 'teacher'
  joined: number
  lastSeen: number | null
  roles: StaffRole[]
  owner: boolean
  referredBy: string | null
}
export interface AccountFilter {
  q: string
  type: 'all' | 'student' | 'teacher'
  role: 'all' | 'staff' | 'none' | StaffRole
  active: 'all' | '7' | '30' | 'inactive'
  sort: 'joined' | 'seen' | 'name' | 'email'
  dir: 'asc' | 'desc'
  page: number
}
export const accountQuery = (f: AccountFilter) => new URLSearchParams(Object.entries(f).map(([k, v]) => [k, String(v)])).toString()
export const getAccounts = (f: AccountFilter) =>
  api<{ accounts: Account[]; total: number; page: number; pages: number; size: number; counts: { all: number; students: number; teachers: number; staff: number; active7: number; new7: number } }>(`/v1/admin/accounts?${accountQuery(f)}`)
export const lookupPerson = (email: string) => api<Lookup>(`/v1/admin/people/lookup?email=${encodeURIComponent(email)}`)
export const setFeedbackStatus = (id: string, status: 'new' | 'done') => api<{ ok: true }>(`/v1/feedback/${encodeURIComponent(id)}`, { method: 'PUT', body: { status } })
