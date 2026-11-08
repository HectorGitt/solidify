import { SolveQuestionForm } from '@/note3d/SolveQuestionDialog'
import { StudyShell } from './StudyShell'
import { YourQuestions } from './YourQuestions'

/**
 * Solve a question (/questions): paste a problem, or a screenshot of one, and it is built in 3D with its worked
 * solution; below, every question solved so far, to practise again. The same box opens from Read notes, and the
 * same list is Exam practice's "Your questions".
 */
export function QuestionsPage() {
  return (
    <StudyShell
      title="Solve a question"
      lead="Paste an exam, tutorial or textbook problem, or a screenshot of it. Solidify builds its setup in 3D and works it out step by step; move the givens to see how the answer changes. If it is one of Solidify’s checked problems, that one opens instead."
    >
      <section className="mb-8 max-w-3xl rounded-3xl border border-line bg-panel p-4 sm:p-5">
        <SolveQuestionForm intro={false} />
      </section>
      <h2 className="mb-3 text-[17px] font-semibold text-ink">Your questions</h2>
      <YourQuestions showSolve={false} />
    </StudyShell>
  )
}

export default QuestionsPage
