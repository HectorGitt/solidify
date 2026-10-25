import type { QuestionProgress } from './progress'

/**
 * Spaced repetition (a Leitner scheme) and topic mastery.
 *
 * Each question sits in a box 0–4. A fully correct answer moves it up one box and schedules the
 * next review further away (1, 3, 7, then 21 days); anything less sends it back to box 0, due
 * tomorrow. Reviews always use fresh numbers, so a question is only "learned" when the method is.
 */

export const DAY = 24 * 3600 * 1000
/** days until the next review after reaching box b (index = box) */
export const INTERVAL_DAYS = [1, 1, 3, 7, 21] as const
export const TOP_BOX = INTERVAL_DAYS.length - 1

/** The next schedule after an attempt scoring `score` (0–1; 1 = fully correct). */
export function schedule(prev: Pick<QuestionProgress, 'box'> | undefined, score: number, now: number): { box: number; due: number } {
  const box = score >= 1 ? Math.min((prev?.box ?? 0) + 1, TOP_BOX) : 0
  return { box, due: now + INTERVAL_DAYS[box] * DAY }
}

/** Questions due for review now, most overdue first. Only questions already attempted are scheduled. */
export function dueQuestions(questions: Record<string, QuestionProgress>, ids: string[], now: number): string[] {
  return ids
    .filter((id) => {
      const q = questions[id]
      return q && q.attempts > 0 && (q.due ?? 0) <= now
    })
    .sort((a, b) => (questions[a].due ?? 0) - (questions[b].due ?? 0))
}

/**
 * How well one question is known, 0–1: the box it has reached (spaced, correct recalls), with
 * the last attempt's score counting for a question that has never been fully right.
 */
export function questionMastery(q: QuestionProgress | undefined): number {
  if (!q || q.attempts === 0) return 0
  const box = q.box ?? (q.correct > 0 ? 1 : 0)
  if (box > 0) return box / TOP_BOX
  return 0.25 * Math.min(1, Math.max(0, q.score ?? 0))
}

export interface TopicMastery {
  topic: string
  ids: string[]
  /** 0–1 averaged over every question in the topic (unseen = 0) */
  mastery: number
  attempted: number
  due: number
}

/** Mastery per topic for a set of questions. */
export function topicMastery(
  questions: Record<string, QuestionProgress>,
  items: { id: string; topic: string }[],
  now: number,
): TopicMastery[] {
  const by = new Map<string, string[]>()
  for (const it of items) by.set(it.topic, [...(by.get(it.topic) ?? []), it.id])
  return [...by.entries()].map(([topic, ids]) => ({
    topic,
    ids,
    mastery: ids.reduce((s, id) => s + questionMastery(questions[id]), 0) / ids.length,
    attempted: ids.filter((id) => (questions[id]?.attempts ?? 0) > 0).length,
    due: dueQuestions(questions, ids, now).length,
  }))
}

/**
 * What to practise next: the topic with reviews due, else the weakest topic already started,
 * else the first topic not yet started.
 */
export function suggestTopic(topics: TopicMastery[]): TopicMastery | undefined {
  const due = topics.filter((t) => t.due > 0).sort((a, b) => b.due - a.due)
  if (due.length) return due[0]
  const started = topics.filter((t) => t.attempted > 0 && t.mastery < 1).sort((a, b) => a.mastery - b.mastery)
  if (started.length) return started[0]
  return topics.find((t) => t.attempted === 0)
}
