import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { SlfyViewer } from './SlfyViewer'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SlfyViewer />
  </StrictMode>,
)
