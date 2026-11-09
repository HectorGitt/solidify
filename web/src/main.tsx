import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './ui/theme'
import { registerServiceWorker, watchInstallOffer } from './ui/pwa'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerServiceWorker()
watchInstallOffer()

// Start building the shared engine in the background straight away (it takes a few seconds), so a
// tractor or engine scene can show it as soon as it opens. Low priority, and never on every worker:
// a scene's own geometry always gets a worker first.
setTimeout(() => {
  void import('@/machines/engine.geometry').then((m) => m.prepareEngine(undefined, 'low'))
  // and the rest of the tractor's systems, which every tractor scene shows
  void import('@/tractor/systems.geometry').then((m) => m.prepareSystems('low'))
  void import('@/modules/engine/diesel-fuel/geometry').then((m) => m.prepareFuelGeometry('low'))
}, 0)
