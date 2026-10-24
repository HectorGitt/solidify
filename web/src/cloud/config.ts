/**
 * Public client configuration. The Firebase web config only identifies the project; it is not
 * a secret (access is enforced by Firebase Auth and the API).
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAnyDRru8AziIM_MXrP_IOfKohaNzq1v2E',
  authDomain: 'solidify-studio.firebaseapp.com',
  projectId: 'solidify-studio',
  appId: '1:602322713479:web:a3f260b18735bc8c3bb122',
  messagingSenderId: '602322713479',
}

/** The Solidify API on Cloud Run. Override with VITE_API_URL (e.g. a local `npm run dev` in api/). */
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://solidify-api-6b27sr35hq-ew.a.run.app'
