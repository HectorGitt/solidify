/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import base from './vite.config'

/** the nightly test run only (src/evals/nightly.eval.ts); `npm test` never runs it */
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    // replaced, not merged: only the nightly run
    include: ['src/evals/**/*.eval.ts'],
    testTimeout: 60 * 60_000,
  },
})
