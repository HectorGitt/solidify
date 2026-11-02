import type { Question } from '../types'
import { AEE501 } from './AEE501'
import { AEE502 } from './AEE502'
import { AEE503 } from './AEE503'
import { AEE509 } from './AEE509'
import { AEE510 } from './AEE510'
import { AEE518 } from './AEE518'
import { DRAWING, MACHINES, STRENGTH, THERMAL } from './labs'

/** Every exam-practice question, in course order. */
export const QUESTIONS: Question[] = [...AEE509, ...AEE510, ...AEE502, ...AEE501, ...AEE503, ...AEE518, ...STRENGTH, ...MACHINES, ...THERMAL, ...DRAWING]

export const findQuestion = (id: string) => QUESTIONS.find((q) => q.id === id)
