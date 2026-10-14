/**
 * Mouldboard bottom, disc coulter and coulter shank. They now live in the parts library
 * (src/parts/lib/implements.ts); this path re-exports them under their old names.
 */
export { BOARDS, coulterDisc, coulterShank, liftY, mouldboardBottom as buildBottom, turnAt, type BoardShape, type BottomGeo } from '@/parts/lib/implements'
