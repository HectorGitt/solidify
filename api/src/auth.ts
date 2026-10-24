export interface AuthUser {
  uid: string
  email?: string
  name?: string
}

/** Turns a bearer token into a user, or throws if the token is invalid or expired. */
export interface Verifier {
  verify(token: string): Promise<AuthUser>
}

/** Test verifier: the token "user:<uid>:<name>" signs in as that user. */
export class FakeVerifier implements Verifier {
  async verify(token: string): Promise<AuthUser> {
    const m = /^user:([\w-]+)(?::(.*))?$/.exec(token)
    if (!m) throw new Error('invalid token')
    return { uid: m[1], name: m[2] || undefined, email: `${m[1]}@example.test` }
  }
}
