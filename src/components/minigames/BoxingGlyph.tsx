import type { Action } from '@/lib/boxing/game'
export function BoxingGlyph({move}:{move:Action}) {
  const path=move==='hook'?'M5 20C0 7 16 0 22 11m-1-6 1 6-6-1':move==='uppercut'?'M6 23c-4-12 12-16 12-20m-5 4 5-4 4 5':move==='cross'?'M2 24 25 3m-7 0h7v7':move==='jab'?'M1 14h24m-5-5 5 5-5 5':move==='body'?'M14 2v5m0 14v5M2 14h5m14 0h5':move==='dodge'?'M3 21C4 6 19 2 25 10M4 9l-1 12 11-2':move==='guard'?'M14 2 24 6v9c0 6-10 11-10 11S4 21 4 15V6Z':move==='flurry'?'M1 5h14M1 14h19M1 23h14m6-18 5 9-5 9':move==='special'?'m14 1 3 8 9-5-5 10 6 4-10 2-3 7-3-8-9 2 5-8-5-6 10 2Z':'m16 1-4 10H5l8 16 3-11h7Z'
  return <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ringside-glyph"><path d={path}/>{move==='body'&&<><circle cx="14" cy="14" r="7"/><circle cx="14" cy="14" r="2" fill="currentColor"/></>}</svg>
}
