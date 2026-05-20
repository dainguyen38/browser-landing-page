import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'

// ===== Config =====

export const WATER_REGEN_MS = 3 * 60 * 60 * 1000 // 3 hours
export const FERT_REGEN_MS = 12 * 60 * 60 * 1000 // 12 hours
export const MAX_WATER = 5
export const MAX_FERT = 3
export const WATER_POINTS = 1
export const FERT_POINTS = 5
/** 1 month at perfect care = 100% growth. 30 days × (8 waters + 2 ferts × 5) = 540 */
export const MAX_GROWTH_POINTS = 540
export const GROWTH_DAYS = 30
export const CHOP_THRESHOLD = 0.7

// ===== Anti-tamper =====
// Sign the persisted blob so localStorage edits invalidate it. Not strong
// crypto — just makes casual edits a hassle.

const SECRET = ['t', '7', 'a', 'k', 'f', '$', 'p', 'l', 'a', 'n', 't', '#', 'v', '2'].join('')

function sign(data: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  const apply = (str: string) => {
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i)
      h1 = Math.imul(h1 ^ ch, 2654435761)
      h2 = Math.imul(h2 ^ ch, 1597334677)
    }
  }
  apply(data)
  apply(SECRET)
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

const signedStorage: StateStorage = {
  getItem: (key) => {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    try {
      const wrap = JSON.parse(raw) as { d?: string; s?: string }
      if (!wrap.d || !wrap.s || sign(wrap.d) !== wrap.s) {
        localStorage.removeItem(key)
        return null
      }
      return wrap.d
    } catch {
      return null
    }
  },
  setItem: (key, value) => {
    const data = typeof value === 'string' ? value : JSON.stringify(value)
    localStorage.setItem(key, JSON.stringify({ d: data, s: sign(data) }))
  },
  removeItem: (key) => localStorage.removeItem(key),
}

// ===== State =====

interface TreeState {
  plantedAt: number | null // ms timestamp
  waterInventory: number
  lastWaterTime: number
  fertInventory: number
  lastFertTime: number
  growthPoints: number
  totalWaterUsed: number
  totalFertUsed: number
  totalWood: number
  treesChopped: number
}

interface TreeActions {
  plant: () => void
  water: () => boolean
  fertilize: () => boolean
  chop: () => number
  tick: () => void // regen + clamp
  reset: () => void
}

const INITIAL: TreeState = {
  plantedAt: null,
  waterInventory: 1,
  lastWaterTime: 0,
  fertInventory: 0,
  lastFertTime: 0,
  growthPoints: 0,
  totalWaterUsed: 0,
  totalFertUsed: 0,
  totalWood: 0,
  treesChopped: 0,
}

function clampState(s: TreeState): TreeState {
  const now = Date.now()
  return {
    ...s,
    waterInventory: Math.max(0, Math.min(MAX_WATER, Math.floor(s.waterInventory))),
    fertInventory: Math.max(0, Math.min(MAX_FERT, Math.floor(s.fertInventory))),
    growthPoints: Math.max(0, Math.min(MAX_GROWTH_POINTS, Math.floor(s.growthPoints))),
    totalWaterUsed: Math.max(0, Math.floor(s.totalWaterUsed)),
    totalFertUsed: Math.max(0, Math.floor(s.totalFertUsed)),
    totalWood: Math.max(0, Math.floor(s.totalWood)),
    treesChopped: Math.max(0, Math.floor(s.treesChopped)),
    // timestamps can't be in the future and can't be impossibly old
    lastWaterTime: Math.min(now, Math.max(0, s.lastWaterTime)),
    lastFertTime: Math.min(now, Math.max(0, s.lastFertTime)),
    plantedAt: s.plantedAt === null ? null : Math.min(now, Math.max(0, s.plantedAt)),
  }
}

function applyRegen(s: TreeState): TreeState {
  if (s.plantedAt === null) return s
  const now = Date.now()
  let waterInv = s.waterInventory
  let fertInv = s.fertInventory
  let lastW = s.lastWaterTime || now
  let lastF = s.lastFertTime || now

  if (waterInv < MAX_WATER) {
    const elapsed = Math.max(0, now - lastW)
    const ticks = Math.floor(elapsed / WATER_REGEN_MS)
    if (ticks > 0) {
      const next = Math.min(MAX_WATER, waterInv + ticks)
      if (next >= MAX_WATER) {
        lastW = now
      } else {
        lastW = lastW + ticks * WATER_REGEN_MS
      }
      waterInv = next
    }
  } else {
    lastW = now
  }

  if (fertInv < MAX_FERT) {
    const elapsed = Math.max(0, now - lastF)
    const ticks = Math.floor(elapsed / FERT_REGEN_MS)
    if (ticks > 0) {
      const next = Math.min(MAX_FERT, fertInv + ticks)
      if (next >= MAX_FERT) {
        lastF = now
      } else {
        lastF = lastF + ticks * FERT_REGEN_MS
      }
      fertInv = next
    }
  } else {
    lastF = now
  }

  if (waterInv === s.waterInventory && fertInv === s.fertInventory && lastW === s.lastWaterTime && lastF === s.lastFertTime) {
    return s
  }
  return { ...s, waterInventory: waterInv, fertInventory: fertInv, lastWaterTime: lastW, lastFertTime: lastF }
}

export function progressOf(s: Pick<TreeState, 'growthPoints'>): number {
  return Math.max(0, Math.min(1, s.growthPoints / MAX_GROWTH_POINTS))
}

export function woodReward(progress: number): number {
  if (progress < CHOP_THRESHOLD) return 0
  return Math.floor(50 + (progress - CHOP_THRESHOLD) * 500)
}

export function daysSincePlant(s: Pick<TreeState, 'plantedAt'>): number {
  if (!s.plantedAt) return 0
  const ms = Date.now() - s.plantedAt
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)))
}

export const useTreeStore = create<TreeState & TreeActions>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      plant: () => {
        const now = Date.now()
        set((s) =>
          clampState({
            ...INITIAL,
            totalWood: s.totalWood, // keep wood across new plantings
            treesChopped: s.treesChopped,
            plantedAt: now,
            lastWaterTime: now,
            lastFertTime: now,
          }),
        )
      },
      water: () => {
        const s = applyRegen(clampState(get()))
        if (!s.plantedAt) return false
        if (s.waterInventory <= 0) {
          set(s)
          return false
        }
        const wasAtMax = s.waterInventory === MAX_WATER
        const next: TreeState = {
          ...s,
          waterInventory: s.waterInventory - 1,
          lastWaterTime: wasAtMax ? Date.now() : s.lastWaterTime,
          growthPoints: s.growthPoints + WATER_POINTS,
          totalWaterUsed: s.totalWaterUsed + 1,
        }
        set(clampState(next))
        return true
      },
      fertilize: () => {
        const s = applyRegen(clampState(get()))
        if (!s.plantedAt) return false
        if (s.fertInventory <= 0) {
          set(s)
          return false
        }
        const wasAtMax = s.fertInventory === MAX_FERT
        const next: TreeState = {
          ...s,
          fertInventory: s.fertInventory - 1,
          lastFertTime: wasAtMax ? Date.now() : s.lastFertTime,
          growthPoints: s.growthPoints + FERT_POINTS,
          totalFertUsed: s.totalFertUsed + 1,
        }
        set(clampState(next))
        return true
      },
      chop: () => {
        const s = clampState(get())
        const p = progressOf(s)
        const wood = woodReward(p)
        if (wood <= 0) return 0
        const now = Date.now()
        set(
          clampState({
            ...s,
            plantedAt: now,
            growthPoints: 0,
            lastWaterTime: now,
            lastFertTime: now,
            totalWood: s.totalWood + wood,
            treesChopped: s.treesChopped + 1,
          }),
        )
        return wood
      },
      tick: () => {
        set((s) => applyRegen(clampState(s)))
      },
      reset: () => {
        set(INITIAL)
      },
    }),
    {
      name: 'landing.tree.v2',
      version: 2,
      storage: createJSONStorage(() => signedStorage),
      migrate: (persisted: unknown) => {
        // Old v1 state shape is incompatible — start clean if mismatch.
        if (
          persisted &&
          typeof persisted === 'object' &&
          'waterInventory' in (persisted as object)
        ) {
          return persisted
        }
        return INITIAL
      },
    },
  ),
)

// ===== Convenience helpers (consumers) =====

/** ms remaining until the next water regen, or 0 if inventory is full. */
export function nextWaterMs(s: Pick<TreeState, 'waterInventory' | 'lastWaterTime'>): number {
  if (s.waterInventory >= MAX_WATER) return 0
  const elapsed = Date.now() - s.lastWaterTime
  return Math.max(0, WATER_REGEN_MS - (elapsed % WATER_REGEN_MS))
}
/** ms remaining until the next fertilizer regen, or 0 if inventory is full. */
export function nextFertMs(s: Pick<TreeState, 'fertInventory' | 'lastFertTime'>): number {
  if (s.fertInventory >= MAX_FERT) return 0
  const elapsed = Date.now() - s.lastFertTime
  return Math.max(0, FERT_REGEN_MS - (elapsed % FERT_REGEN_MS))
}
