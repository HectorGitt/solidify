import { cite } from '@/content/citations'

/**
 * AEE 504 sources used by the processing scenes I own (conveyors, size-reduction, separation,
 * plant-layout). File names as listed in docs/notes-inventory/AEE504-AEE536-crop-processing.md.
 */
export const P504 = {
  /** Note 3 Materials handling + Note 4 Factory layout (no page numbers: cite sections) */
  hand: (where?: string) => cite('AEE504', 'AGE 504 Handling and planning new.docx', where),
  /** Notes 2: Size reduction */
  red: (where?: string) => cite('AEE504', 'AGE 504 note 2, reduction.doc', where),
  /** Note 1: Separation – cleaning, sorting and grading */
  sep: (where?: string) => cite('AEE504', 'seperation 504.docx', where),
  /** scanned past questions, 6 pages */
  pq: (where?: string) => cite('AEE504', 'AEE 504 past question.pdf', where),
  /** 2022/23 test (image) */
  t23: (where?: string) => cite('AEE504', 'IMG-20250531-WA0012.jpg (2022/23 test)', where),
  garri: (where?: string) => cite('AEE504', 'gari flow chart image (…22.22.28_06e55df2.jpg)', where),
  wheat: (where?: string) => cite('AEE504', 'Wheat flour milling process flow diagram (…22.22.29_ca19ba9b.jpg)', where),
  gstd: (where?: string) => cite('AEE504', 'garri standards.pdf', where),
  /** law forms for Kick / Rittinger / Bond */
  fel: (where?: string) => cite('Textbook', 'Fellows, Food Processing Technology 2e', where),
}
