export const MAX_DEBRIS = 384
export type Debris = {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  life: number; color: string; angle: number; size: number
}
export function makeDebris(
  cleared: { x: number; y: number; color: number }[],
  layout: { x: number; y: number; cell: number }, colors: readonly string[], random = Math.random,
): Debris[] {
  const particles: Debris[] = []
  for (const p of cleared) for (let i = 0; i < 5 && particles.length < MAX_DEBRIS; i++) {
    const angle = random() * Math.PI * 2
    const speed = layout.cell * (1.5 + random() * 3)
    particles.push({
      x: layout.x + (p.x + .5) * layout.cell, y: layout.y + (p.y + .5) * layout.cell,
      z: layout.cell * .3, vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - layout.cell, vz: layout.cell * (2 + random() * 3),
      life: .65 + random() * .35, color: colors[p.color - 1], angle,
      size: layout.cell * (.12 + random() * .12),
    })
  }
  return particles
}
export function advanceDebris(particles: Debris[], dt: number, cell: number) {
  for (const p of particles) {
    p.life -= dt
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt
    p.vy += cell * 9 * dt; p.vz -= cell * 14 * dt
    p.angle += dt * 6
    if (p.z < cell * .05) { p.z = cell * .05; p.vz = Math.abs(p.vz) * .35 }
  }
  return particles.filter((p) => p.life > 0)
}
