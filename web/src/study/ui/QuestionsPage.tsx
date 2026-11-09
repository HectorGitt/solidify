import { SolveQuestionForm } from '@/note3d/SolveQuestionDialog'
import { StudyShell } from './StudyShell'
import { YourQuestions } from './YourQuestions'
import { usePageTourOn } from '@/ui/PageTour'

/**
 * Solve a question (/questions): paste a problem, or a screenshot of one, and it is built in 3D with its worked
 * solution; below, every question solved so far, to practise again. The same box opens from Read notes, and the
 * same list is Exam practice's "Your questions".
 */
export function QuestionsPage() {
  usePageTourOn('questions', [
    { target: 'q-box', title: 'Paste your question', text: 'Type or paste an exam, tutorial or textbook problem, or paste a screenshot of it (Ctrl+V). Solidify builds the setup in 3D and works it out step by step.' },
    { title: 'Not every answer is a model', text: 'Questions about a physical thing get a 3D model you can change; others (a transport plan, a derivation) get a written answer with tables and charts.' },
    { target: 'q-yours', title: 'Practise again', text: 'Every question you solve is kept here. Open one with new numbers to try it yourself before you see the working.' },
  ])
  return (
    <StudyShell
      title="Solve a question"
      lead="Paste an exam, tutorial or textbook problem, or a screenshot of it. Solidify builds its setup in 3D and works it out step by step; move the givens to see how the answer changes. If it is one of Solidify’s checked problems, that one opens instead."
    >
      <section className="mb-8 max-w-3xl rounded-3xl border border-line bg-panel p-4 sm:p-5">
        <SolveQuestionForm intro={false} />
      </section>
      <h2 data-tour="q-yours" className="mb-3 text-[17px] font-semibold text-ink">Your questions</h2>
      <YourQuestions showSolve={false} />
    </StudyShell>
  )
}

export default QuestionsPage
