import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { About } from './ui/About'
import { Landing } from './ui/Landing'
import { Viewer } from './ui/Viewer'

// study pages (loaded on demand)
const ExamPage = lazy(() => import('./study/ui/ExamPage'))
const ProgressPage = lazy(() => import('./study/ui/ProgressPage'))
const FormulasPage = lazy(() => import('./study/ui/FormulasPage'))
const page = (el: ReactNode) => <Suspense fallback={<div className="grid h-full place-items-center text-[13px] text-mute">Loading…</div>}>{el}</Suspense>

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/exam" element={page(<ExamPage />)} />
        <Route path="/progress" element={page(<ProgressPage />)} />
        <Route path="/formulas" element={page(<FormulasPage />)} />
        <Route path="/m/:moduleId" element={<Viewer />} />
        <Route path="/m/:moduleId/:sceneId" element={<Viewer />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </HashRouter>
  )
}
