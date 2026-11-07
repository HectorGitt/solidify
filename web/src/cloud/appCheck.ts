import { FIREBASE_CONFIG, RECAPTCHA_SITE_KEY } from './config'

/**
 * App Check: a token proving a request comes from the real Solidify app (reCAPTCHA Enterprise checks the
 * browser invisibly). Sent with every API call once a site key is set; the API counts or refuses calls
 * without one, depending on its APP_CHECK setting. With no key, nothing is loaded and nothing is sent.
 */
type Getter = () => Promise<string | null>
let getter: Promise<Getter> | null = null

function start(): Promise<Getter> {
  return (async () => {
    const [{ initializeApp, getApps }, ac] = await Promise.all([import('firebase/app'), import('firebase/app-check')])
    const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG)
    const check = ac.initializeAppCheck(app, { provider: new ac.ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true })
    return async () => (await ac.getToken(check, false)).token
  })()
}

/** the current token, or null (no key set, or the check could not run: the API decides what that means) */
export async function appCheckToken(): Promise<string | null> {
  if (!RECAPTCHA_SITE_KEY || typeof window === 'undefined') return null
  try {
    getter ??= start()
    return await (await getter)()
  } catch {
    return null
  }
}
