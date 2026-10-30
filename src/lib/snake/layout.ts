export function fitBoard(width: number, height: number, cols: number, rows: number) {
  const cell = Math.max(0, Math.min(width / cols, height / rows))
  return { width: cell * cols, height: cell * rows }
}
