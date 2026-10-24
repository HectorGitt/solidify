import type { Auth, User } from 'firebase/auth'
import { create } from 'zustand'
import { FIREBASE_CONFIG } from './config'

/**
 * Sign-in with Firebase Authentication (Google or email/password).
 * The Firebase SDK is loaded on demand: visitors who have never signed in don't download it.
 */

export interface AccountUser {
  uid: string
  email: string | null
  name: string | null
  photo: string | null
}

type Status = 'loading' | 'signed-out' | 'signed-in'

interface AuthState {
  status: Status
  user: AccountUser | null
  /** open the sign-in dialog from anywhere */
  dialog: boolean
  init: () => void
  openDialog: (open?: boolean) => void
  signInGoogle: () => Promise<void>
  signInEmail: (email: string, password: string) => Promise<void>
  signUpEmail: (name: string, email: string, password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  signOut: () => Promise<void>
  /** a fresh ID token for the API, or null when signed out */
  token: () => Promise<string | null>
}

/** Remembered so returning users get their session restored without a sign-in click. */
const FLAG = 'solidify.signedIn'
const flag = {
  get: () => {
    try {
      return localStorage.getItem(FLAG) === '1'
    } catch {
      return false
    }
  },
  set: (on: boolean) => {
    try {
      if (on) localStorage.setItem(FLAG, '1')
      else localStorage.removeItem(FLAG)
    } catch {
      /* storage unavailable */
    }
  },
}

type FirebaseAuth = typeof import('firebase/auth')
let loading: Promise<{ auth: Auth; fa: FirebaseAuth }> | null = null

function firebase() {
  return (loading ??= (async () => {
    const [{ initializeApp, getApps }, fa] = await Promise.all([import('firebase/app'), import('firebase/auth')])
    const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG)
    const auth = fa.getAuth(app)
    fa.onAuthStateChanged(auth, (u) => {
      flag.set(!!u)
      useAuth.setState({ status: u ? 'signed-in' : 'signed-out', user: u ? toUser(u) : null })
    })
    return { auth, fa }
  })())
}

const toUser = (u: User): AccountUser => ({ uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL })

/** Friendly text for Firebase Auth error codes. */
export function authMessage(e: unknown): string | null {
  const code = (e as { code?: string })?.code ?? ''
  const map: Record<string, string | null> = {
    'auth/invalid-credential': 'That email and password don’t match an account.',
    'auth/wrong-password': 'That email and password don’t match an account.',
    'auth/user-not-found': 'That email and password don’t match an account.',
    'auth/invalid-email': 'That doesn’t look like an email address.',
    'auth/email-already-in-use': 'There’s already an account with that email. Sign in instead.',
    'auth/weak-password': 'Use a password of at least 8 characters.',
    'auth/missing-password': 'Enter your password.',
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'auth/network-request-failed': 'No connection. Check your internet and try again.',
    'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
    'auth/popup-closed-by-user': null,
    'auth/cancelled-popup-request': null,
    'auth/account-exists-with-different-credential': 'This email already signs in another way. Use email and password.',
  }
  if (code in map) return map[code]
  return 'Sign-in failed. Please try again.'
}

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  dialog: false,
  init: () => {
    if (flag.get()) void firebase()
    else set({ status: 'signed-out' })
  },
  openDialog: (open = true) => set({ dialog: open }),
  signInGoogle: async () => {
    const { auth, fa } = await firebase()
    const provider = new fa.GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    await fa.signInWithPopup(auth, provider)
    set({ dialog: false })
  },
  signInEmail: async (email, password) => {
    const { auth, fa } = await firebase()
    await fa.signInWithEmailAndPassword(auth, email.trim(), password)
    set({ dialog: false })
  },
  signUpEmail: async (name, email, password) => {
    if (password.length < 8) throw Object.assign(new Error('weak'), { code: 'auth/weak-password' })
    const { auth, fa } = await firebase()
    const cred = await fa.createUserWithEmailAndPassword(auth, email.trim(), password)
    if (name.trim()) {
      await fa.updateProfile(cred.user, { displayName: name.trim() })
      set({ user: toUser(cred.user) })
    }
    set({ dialog: false })
  },
  resetPassword: async (email) => {
    const { auth, fa } = await firebase()
    await fa.sendPasswordResetEmail(auth, email.trim())
  },
  signOut: async () => {
    const { auth, fa } = await firebase()
    await fa.signOut(auth)
    flag.set(false)
  },
  token: async () => {
    if (useAuth.getState().status !== 'signed-in') return null
    const { auth } = await firebase()
    return auth.currentUser ? auth.currentUser.getIdToken() : null
  },
}))
