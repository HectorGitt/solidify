import { create } from 'zustand'
import { api } from './api'
import { useAuth } from './auth'

export interface ClassRef {
  id: string
  name: string
  role: 'student' | 'teacher'
}

export interface Profile {
  uid: string
  displayName: string
  email?: string
  role: 'student' | 'teacher'
  classes?: ClassRef[]
  /** can open the admin page (the API decides; this only shows the link) */
  isAdmin?: boolean
  /** can review drafts and publish them (the API decides; this only shows the link) */
  isReviewer?: boolean
}

/** The signed-in user's Solidify profile (role, display name, classes), from the API. */
export const useProfile = create<{ profile: Profile | null; set: (p: Profile) => void; refresh: () => Promise<void> }>((set) => ({
  profile: null,
  set: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
  refresh: async () => {
    if (useAuth.getState().status !== 'signed-in') return
    try {
      set({ profile: await api<Profile>('/v1/me') })
    } catch {
      /* offline: keep what we have */
    }
  },
}))

let started = false
export function startProfile() {
  if (started) return
  started = true
  useAuth.subscribe((s, prev) => {
    if (s.status === 'signed-in' && (prev.status !== 'signed-in' || s.user?.uid !== prev.user?.uid)) void useProfile.getState().refresh()
    if (s.status === 'signed-out') useProfile.setState({ profile: null })
  })
  if (useAuth.getState().status === 'signed-in') void useProfile.getState().refresh()
}
