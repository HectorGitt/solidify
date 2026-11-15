import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './ui/theme'
import { openWhereLeftOff, registerServiceWorker, watchInstallOffer } from './ui/pwa'
import { watchCrashes } from './cloud/crashes'
import { ApiError } from './cloud/api'
import { isUpdateError } from './ui/appUpdate'
import { useXRSession } from './xr/session'

// a share link (/s/<id>) that reached the app itself rather than its preview page: open the model
const sharePath = /^\/s\/([a-z0-9]{6,20})\/?$/.exec(location.pathname)
if (sharePath && !location.hash) history.replaceState(null, '', `/#/s/${sharePath[1]}${location.search}`)
// before the router reads the address: the installed app opens where it was left
openWhereLeftOff()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerServiceWorker()
watchInstallOffer()
// faults nothing caught are reported too (a failed request is not a fault: the page already says so)
watchCrashes((e) => isUpdateError(e) || e instanceof ApiError, () => useXRSession.getState().active)

// Start building the shared engine in the background straight away (it takes a few seconds), so a
// tractor or engine scene can show it as soon as it opens. Low priority, and never on every worker:
// a scene's own geometry always gets a worker first.
setTimeout(() => {
  void import('@/machines/engine.geometry').then((m) => m.prepareEngine(undefined, 'low'))
  // and the rest of the tractor's systems, which every tractor scene shows
  void import('@/tractor/systems.geometry').then((m) => m.prepareSystems('low'))
  void import('@/modules/engine/diesel-fuel/geometry').then((m) => m.prepareFuelGeometry('low'))
}, 0)
