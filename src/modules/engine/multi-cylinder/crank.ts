/**
 * The crank train of the multi-cylinder, performance and lubrication scenes now comes from the
 * shared parts library (src/parts/lib/engine.ts); this module keeps the old import path working.
 * Frame: crank axis = Z, crank pin at +Y in the throw's local frame.
 */
export { crankThrow, crankshaft, mainJournalZ, type CrankSpec, type ThrowPlacement } from '@/parts/lib/engine'
