import { cite } from '@/content/citations'

/**
 * AEE 504 sources for crop separation and cleaning equipment:
 * - SEP = "seperation 504.docx" (Note 1: Separation – cleaning, sorting, grading; eqs 1–18)
 * - RED = "AGE 504 note 2, reduction.doc" (Notes 2: Size reduction – sieve shaker, IS sieve series, FM, UI)
 * - HAND = "AGE 504 Handling and planning new.docx" (Note 3: Pneumatic conveying & cyclones)
 * - PQ = "AEE 504 past question.pdf" (6 scanned pages: PQ p3 Q3b, PQ p1 Q3c, PQ p5 Q v, PQ p6 Q2c)
 * - WHEAT = "Wheat flour milling process flow diagram" (IMG-WHEAT cleaning house flow)
 */
export const P504 = {
  sep: (where?: string) => cite('AEE504', 'seperation 504.docx', where),
  red: (where?: string) => cite('AEE504', 'AGE 504 note 2, reduction.doc', where),
  hand: (where?: string) => cite('AEE504', 'AGE 504 Handling and planning new.docx', where),
  pq: (where?: string) => cite('AEE504', 'AEE 504 past question.pdf', where),
  t23: (where?: string) => cite('AEE504', 'IMG-20250531-WA0012.jpg (2022/23 test)', where),
  wheat: (where?: string) => cite('AEE504', 'Wheat flour milling process flow diagram (…22.22.29_ca19ba9b.jpg)', where),
  garri: (where?: string) => cite('AEE504', 'gari flow chart image (…22.22.28_06e55df2.jpg)', where),
  fel: (where?: string) => cite('Textbook', 'Fellows, Food Processing Technology 2e', where),
}
