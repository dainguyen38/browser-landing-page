export const SIZE = 8
export type Point = { x: number; y: number }
export type Piece = { cells: Point[]; color: number }
export type BlastState = { board: number[][]; pieces: (Piece | null)[]; score: number; combo: number; over: boolean }
const SHAPES = [
  [[0,0]], [[0,0],[1,0]], [[0,0],[0,1]],
  [[0,0],[1,0],[2,0]], [[0,0],[0,1],[0,2]],
  [[0,0],[1,0],[2,0],[3,0]], [[0,0],[0,1],[0,2],[0,3]],
  [[0,0],[1,0],[2,0],[3,0],[4,0]], [[0,0],[0,1],[0,2],[0,3],[0,4]],
  [[0,0],[1,0],[0,1],[1,1]],
  [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],
  [[0,0],[1,0],[0,1],[1,1],[0,2],[1,2]],
  [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]],
  [[0,0],[0,1],[0,2],[1,2]], [[1,0],[1,1],[0,2],[1,2]],
  [[0,0],[1,0],[2,0],[1,1]], [[1,0],[0,1],[1,1],[2,1]],
  [[0,0],[1,0],[1,1],[2,1]], [[1,0],[2,0],[0,1],[1,1]],
  [[0,0],[1,0],[0,1]], [[0,0],[1,0],[1,1]],
]
export function deal(random = Math.random): Piece[] {
  return Array.from({ length: 3 }, () => ({
    cells: SHAPES[Math.floor(random() * SHAPES.length)].map(([x,y]) => ({ x, y })),
    color: 1 + Math.floor(random() * 7),
  }))
}
export function initial(random = Math.random): BlastState {
  return { board: Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0)), pieces: deal(random), score: 0, combo: 0, over: false }
}
export function canPlace(board: number[][], piece: Piece, x: number, y: number) {
  return Number.isInteger(x) && Number.isInteger(y) && piece.cells.every((p) =>
    x+p.x >= 0 && x+p.x < SIZE && y+p.y >= 0 && y+p.y < SIZE && board[y+p.y][x+p.x] === 0)
}
export function hasMove(st: BlastState) {
  return st.pieces.some((piece) => piece && st.board.some((row,y) => row.some((_,x) => canPlace(st.board, piece, x, y))))
}
export function place(st: BlastState, index: number, x: number, y: number, random = Math.random) {
  const piece = st.pieces[index]
  if (st.over || !piece || !canPlace(st.board, piece, x, y)) return null
  for (const p of piece.cells) st.board[y+p.y][x+p.x] = piece.color
  const rows = st.board.flatMap((row,y) => row.every(Boolean) ? [y] : [])
  const cols = Array.from({ length: SIZE }, (_,x) => x).filter((x) => st.board.every((row) => row[x]))
  const cleared: (Point & { color: number })[] = []
  for (let y=0; y<SIZE; y++) for (let x=0; x<SIZE; x++) {
    if (rows.includes(y) || cols.includes(x)) {
      cleared.push({ x, y, color: st.board[y][x] })
      st.board[y][x] = 0
    }
  }
  const lines = rows.length + cols.length
  st.combo = lines ? st.combo + 1 : 0
  const gained = piece.cells.length + lines * 10 * lines * Math.max(1, st.combo)
  st.score += gained
  st.pieces[index] = null
  if (st.pieces.every((p) => p === null)) st.pieces = deal(random)
  st.over = !hasMove(st)
  return { cleared, lines, gained }
}
