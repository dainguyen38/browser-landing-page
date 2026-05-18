export function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export function faviconUrl(url: string, size = 64): string | null {
  const host = getHostname(url)
  if (!host) return null
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`
}

const GRADIENTS = [
  ['#7c3aed', '#22d3ee'],
  ['#f97316', '#ef4444'],
  ['#10b981', '#22d3ee'],
  ['#ec4899', '#8b5cf6'],
  ['#0ea5e9', '#6366f1'],
  ['#facc15', '#f97316'],
  ['#14b8a6', '#3b82f6'],
  ['#a855f7', '#f43f5e'],
]

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function letterFallback(name: string, url?: string) {
  const seed = (url ?? name).toLowerCase()
  const idx = hashCode(seed) % GRADIENTS.length
  const [a, b] = GRADIENTS[idx]
  const letter = (name.trim()[0] ?? '?').toUpperCase()
  return { letter, gradient: `linear-gradient(135deg, ${a}, ${b})` }
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function isValidUrl(input: string): boolean {
  try {
    const u = new URL(normalizeUrl(input))
    return !!u.hostname && u.hostname.includes('.')
  } catch {
    return false
  }
}
