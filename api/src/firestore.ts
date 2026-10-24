import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import type { AuthUser, Verifier } from './auth.js'
import type { Db, Doc, Row } from './db.js'

/** Firebase Admin uses the Cloud Run service account (Application Default Credentials). */
function app() {
  return getApps()[0] ?? initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT })
}

export class FirestoreDb implements Db {
  private fs: Firestore
  constructor() {
    this.fs = getFirestore(app())
  }
  async get<T extends Doc>(path: string) {
    const s = await this.fs.doc(path).get()
    return s.exists ? (s.data() as T) : null
  }
  async set(path: string, data: Doc, opts?: { merge?: boolean }) {
    await this.fs.doc(path).set(data, { merge: !!opts?.merge })
  }
  async create(path: string, data: Doc) {
    try {
      await this.fs.doc(path).create(data)
      return true
    } catch (e) {
      // ALREADY_EXISTS
      if ((e as { code?: number }).code === 6) return false
      throw e
    }
  }
  async delete(path: string) {
    await this.fs.doc(path).delete()
  }
  async list<T extends Doc>(collection: string, opts?: { limit?: number }): Promise<Row<T>[]> {
    let q = this.fs.collection(collection).orderBy('__name__')
    if (opts?.limit) q = q.limit(opts.limit)
    const s = await q.get()
    return s.docs.map((d) => ({ id: d.id, data: d.data() as T }))
  }
  async where<T extends Doc>(collection: string, field: string, value: unknown, opts?: { limit?: number }): Promise<Row<T>[]> {
    let q = this.fs.collection(collection).where(field, '==', value)
    if (opts?.limit) q = q.limit(opts.limit)
    const s = await q.get()
    return s.docs.map((d) => ({ id: d.id, data: d.data() as T }))
  }
  async transact<T extends Doc>(path: string, fn: (prev: T | null) => T) {
    const ref = this.fs.doc(path)
    return this.fs.runTransaction(async (tx) => {
      const s = await tx.get(ref)
      const next = fn(s.exists ? (s.data() as T) : null)
      tx.set(ref, next)
      return next
    })
  }
}

/** Verifies Firebase Authentication ID tokens sent as `Authorization: Bearer <token>`. */
export class FirebaseVerifier implements Verifier {
  async verify(token: string): Promise<AuthUser> {
    const t = await getAuth(app()).verifyIdToken(token)
    return { uid: t.uid, email: t.email, name: (t.name as string | undefined) ?? undefined }
  }
}
