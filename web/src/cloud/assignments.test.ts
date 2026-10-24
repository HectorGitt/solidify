import { describe, expect, it } from 'vitest'
import { assignableQuestions, assignableScenes, assignmentRoute, assignmentStatus } from './assignments'

const empty = { scenes: {}, questions: {}, challenges: {} }

describe('assignments', () => {
  it('reports status the same way the teacher dashboard does', () => {
    const p = { scenes: { belts: { opened: 1, tour: 2 }, gears: { opened: 3 } }, questions: { q1: { attempts: 3, correct: 1 }, q2: { attempts: 2, correct: 0 } }, challenges: { c: { done: 5, best: 31.234567 } } }
    expect(assignmentStatus({ kind: 'scene', ref: 'belts' }, p)).toEqual({ complete: true, label: 'Toured' })
    expect(assignmentStatus({ kind: 'scene', ref: 'gears' }, p).label).toBe('Opened')
    expect(assignmentStatus({ kind: 'question', ref: 'q1' }, p)).toMatchObject({ complete: true, label: 'Solved (3 tries)' })
    expect(assignmentStatus({ kind: 'question', ref: 'q2' }, p)).toMatchObject({ complete: false, label: '2 tries' })
    expect(assignmentStatus({ kind: 'challenge', ref: 'c' }, p)).toMatchObject({ complete: true, label: 'Done, best 31.23' })
    expect(assignmentStatus({ kind: 'challenge', ref: 'x' }, empty).label).toBe('Not started')
  })

  it('offers every built scene and every exam question, with unique refs', () => {
    const scenes = assignableScenes()
    expect(scenes.length).toBeGreaterThan(60)
    expect(new Set(scenes.map((s) => s.ref)).size).toBe(scenes.length)
    const qs = assignableQuestions()
    expect(qs.length).toBeGreaterThan(50)
    expect(qs[0].route).toMatch(/^\/exam\?q=/)
  })

  it('routes students to the right place', () => {
    const s = assignableScenes()[0]
    expect(assignmentRoute({ kind: 'scene', ref: s.ref })).toBe(s.route)
    expect(assignmentRoute({ kind: 'question', ref: 'a b' })).toBe('/exam?q=a%20b')
  })
})
