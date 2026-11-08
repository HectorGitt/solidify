import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { About } from './ui/About'
import { Landing } from './ui/Landing'
import { Viewer } from './ui/Viewer'
import { PartSearch } from './ui/PartSearch'
import { Toaster } from './ui/toast'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { startUpdateWatch } from './ui/appUpdate'
import { UpdateNotice } from './ui/UpdateNotice'
import { TaskTray } from './ui/TaskTray'
import { useAuth } from './cloud/auth'
import { startProfile } from './cloud/profile'
import { startSync } from './cloud/sync'
import { ReportDialog } from './cloud/ui/ReportDialog'
import { SignInDialog } from './cloud/ui/SignInDialog'
import { SalesDialog } from './cloud/ui/SalesDialog'
import { PageSkeleton, WorkspaceSkeleton } from './ui/Skeleton'

// study pages (loaded on demand)
const ExamPage = lazy(() => import('./study/ui/ExamPage'))
const QuestionsPage = lazy(() => import('./study/ui/QuestionsPage'))
const ProgressPage = lazy(() => import('./study/ui/ProgressPage'))
const FormulasPage = lazy(() => import('./study/ui/FormulasPage'))
const ChallengesPage = lazy(() => import('./challenges/ChallengesPage'))
const PromoPage = lazy(() => import('./ui/PromoPage'))
const ClassesPage = lazy(() => import('./cloud/ui/ClassesPage'))
const ClassPage = lazy(() => import('./cloud/ui/ClassPage'))
const CreatePage = lazy(() => import('./cloud/ui/CreatePage'))
const CreationLabPage = lazy(() => import('./cloud/ui/CreationLabPage'))
const ModelLab = lazy(() => import('./cloud/ui/ModelLab'))
const ReadPage = lazy(() => import('./note3d/ReadPage'))
const PaperPage = lazy(() => import('./cloud/ui/PaperPage'))
const AdminPage = lazy(() => import('./cloud/ui/AdminPage'))
const ReviewPage = lazy(() => import('./cloud/ui/ReviewPage'))
const LibraryPage = lazy(() => import('./cloud/ui/LibraryPage'))
const LabsPage = lazy(() => import('./ui/LabsPage'))
// dev only: bare scenes for scripts/capture-tiles.mjs
const ShotPage = import.meta.env.DEV ? lazy(() => import('./ui/ShotPage')) : null
const page = (el: ReactNode, fallback: ReactNode = <PageSkeleton />) => <Suspense fallback={fallback}>{el}</Suspense>

export default function App() {
  useEffect(() => {
    useAuth.getState().init()
    startProfile()
    startSync()
    startUpdateWatch()
  }, [])
  return (
    <HashRouter>
      <PartSearch />
      <SignInDialog />
      <ReportDialog />
      <SalesDialog />
      <Toaster />
      <UpdateNotice />
      <TaskTray />
      <ErrorBoundary label="page">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/exam" element={page(<ExamPage />)} />
        <Route path="/questions" element={page(<QuestionsPage />)} />
        <Route path="/progress" element={page(<ProgressPage />)} />
        <Route path="/formulas" element={page(<FormulasPage />)} />
        <Route path="/challenges" element={page(<ChallengesPage />)} />
        <Route path="/promo" element={page(<PromoPage />)} />
        <Route path="/classes" element={page(<ClassesPage />)} />
        <Route path="/classes/:classId" element={page(<ClassPage />)} />
        <Route path="/classes/:classId/papers/:paperId" element={page(<PaperPage />)} />
        <Route path="/create" element={page(<CreatePage />)} />
        <Route path="/create/lab" element={page(<CreationLabPage />)} />
        <Route path="/create/:id" element={page(<ModelLab />, <WorkspaceSkeleton />)} />
        <Route path="/read" element={page(<ReadPage />)} />
        <Route path="/admin" element={page(<AdminPage />)} />
        <Route path="/review" element={page(<ReviewPage />)} />
        <Route path="/library" element={page(<LibraryPage />)} />
        <Route path="/labs" element={page(<LabsPage />)} />
        {ShotPage ? <Route path="/shot/:moduleId/:sceneId" element={page(<ShotPage />)} /> : null}
        <Route path="/m/:moduleId" element={<Viewer />} />
        <Route path="/m/:moduleId/:sceneId" element={<Viewer />} />
        <Route path="*" element={<Landing />} />
      </Routes>
      </ErrorBoundary>
    </HashRouter>
  )
}
