/**
 * three-bvh-csg still passes three-mesh-bvh's old `maxLeafSize` option, and three-mesh-bvh warns about it on
 * every cut (hundreds of lines per model) while using it correctly. Only that one message is dropped; remove
 * this once three-bvh-csg passes `targetLeafSize`.
 */
const DEPRECATED = 'BVH: "maxLeafSize" option has been deprecated'
const warn = console.warn.bind(console)
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].startsWith(DEPRECATED)) return
  warn(...args)
}
