import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { About } from './ui/About'
import { Landing } from './ui/Landing'
import { Viewer } from './ui/Viewer'
import { PartSearch } from './ui/PartSearch'
import { useAuth } from './cloud/auth'
import { startProfile } from './cloud/profile'
import { startSync } from './cloud/sync'
import { ReportDialog } from './cloud/ui/ReportDialog'
import { SignInDialog } from './cloud/ui/SignInDialog'

// study pages (loaded on demand)
const ExamPage = lazy(() => import('./study/ui/ExamPage'))
const ProgressPage = lazy(() => import('./study/ui/ProgressPage'))
const FormulasPage = lazy(() => import('./study/ui/FormulasPage'))
const ChallengesPage = lazy(() => import('./challenges/ChallengesPage'))
const PromoPage = lazy(() => import('./ui/PromoPage'))
const ClassesPage = lazy(() => import('./cloud/ui/ClassesPage'))
const ClassPage = lazy(() => import('./cloud/ui/ClassPage'))
const page = (el: ReactNode) => <Suspense fallback={<div className="grid h-full place-items-center text-[13px] text-mute">Loading…</div>}>{el}</Suspense>

export default function App() {
  useEffect(() => {
    useAuth.getState().init()
    startProfile()
    startSync()
  }, [])
  return (
    <HashRouter>
      <PartSearch />
      <SignInDialog />
      <ReportDialog />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/exam" element={page(<ExamPage />)} />
        <Route path="/progress" element={page(<ProgressPage />)} />
        <Route path="/formulas" element={page(<FormulasPage />)} />
        <Route path="/challenges" element={page(<ChallengesPage />)} />
        <Route path="/promo" element={page(<PromoPage />)} />
        <Route path="/classes" element={page(<ClassesPage />)} />
        <Route path="/classes/:classId" element={page(<ClassPage />)} />
        <Route path="/m/:moduleId" element={<Viewer />} />
        <Route path="/m/:moduleId/:sceneId" element={<Viewer />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </HashRouter>
  )
}
