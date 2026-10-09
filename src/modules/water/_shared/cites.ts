import { cite } from '@/content/citations'

/** AEE507 source files (docs/notes-inventory/AEE507-water-irrigation.md). Data only — never shown as text. */
export const C = {
  ipp: (w: string) => cite('AEE507', 'irrigation principle and practices(AEE 507).pdf', w),
  sg: (w: string) => cite('AEE507', 'Irrigation Principles and Practices STUDY GUIDE.pdf', w),
  wrd: (w: string) => cite('AEE507', 'water resource development (507).pdf', w),
  vw: (w: string) => cite('AEE507', 'vegetated waterways (507).pdf', w),
  ce: (w: string) => cite('AEE507', 'AEE 507 Conservation and the environment.pdf', w),
  we: (w: string) => cite('AEE507', 'AEE 507 -WIND EROSION.pptx', w),
  csa: (w: string) => cite('AEE507', 'CamScanner 12-04-2024 09.12.pdf', w),
  csb: (w: string) => cite('AEE507', 'CamScanner 12-13-2023 08.50.pdf', w),
  s1: (w: string) => cite('AEE507', '507 sample 1.pdf', w),
  s2: (w: string) => cite('AEE507', '507 sample 2.pdf', w),
}
