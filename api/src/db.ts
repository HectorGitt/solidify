/**
 * Minimal document store. Paths alternate collection/document like Firestore:
 * "users/abc" is a document, "classes/c1/members" is a collection.
 * Production uses Firestore (firestore.ts); tests use MemoryDb.
 */
export type Doc = Record<string, unknown>

export interface Row<T> {
  id: string
  data: T
}

export interface Db {
  get<T extends Doc>(path: string): Promise<T | null>
  set(path: string, data: Doc, opts?: { merge?: boolean }): Promise<void>
  /** Create only if absent; returns false when the document already exists. */
  create(path: string, data: Doc): Promise<boolean>
  delete(path: string): Promise<void>
  list<T extends Doc>(collection: string, opts?: { limit?: number }): Promise<Row<T>[]>
  where<T extends Doc>(collection: string, field: string, value: unknown, opts?: { limit?: number }): Promise<Row<T>[]>
  /** Read-modify-write atomically. `fn` receives the current value (or null) and returns the new one. */
  transact<T extends Doc>(path: string, fn: (prev: T | null) => T): Promise<T>
}

const clone = <T>(v: T): T => structuredClone(v)

export class MemoryDb implements Db {
  private docs = new Map<string, Doc>()

  async get<T extends Doc>(path: string) {
    const d = this.docs.get(path)
    return d ? (clone(d) as T) : null
  }
  async set(path: string, data: Doc, opts?: { merge?: boolean }) {
    const prev = opts?.merge ? (this.docs.get(path) ?? {}) : {}
    this.docs.set(path, clone({ ...prev, ...data }))
  }
  async create(path: string, data: Doc) {
    if (this.docs.has(path)) return false
    this.docs.set(path, clone(data))
    return true
  }
  async delete(path: string) {
    this.docs.delete(path)
  }
  async list<T extends Doc>(collection: string, opts?: { limit?: number }) {
    const rows: Row<T>[] = []
    for (const [p, d] of this.docs) {
      const i = p.lastIndexOf('/')
      if (p.slice(0, i) === collection) rows.push({ id: p.slice(i + 1), data: clone(d) as T })
    }
    rows.sort((a, b) => a.id.localeCompare(b.id))
    return opts?.limit ? rows.slice(0, opts.limit) : rows
  }
  async where<T extends Doc>(collection: string, field: string, value: unknown, opts?: { limit?: number }) {
    const rows = (await this.list<T>(collection)).filter((r) => r.data[field] === value)
    return opts?.limit ? rows.slice(0, opts.limit) : rows
  }
  async transact<T extends Doc>(path: string, fn: (prev: T | null) => T) {
    const next = fn(await this.get<T>(path))
    this.docs.set(path, clone(next))
    return clone(next)
  }
}
