// Vietnamese lunar calendar — based on the public algorithm by Hồ Ngọc Đức
// https://www.informatik.uni-leipzig.de/~duc/amlich/

const PI = Math.PI

function INT(d: number): number {
  return Math.floor(d)
}

export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12)
  const y = yy + 4800 - a
  const m = mm + 12 * a - 3
  let jd =
    dd +
    INT((153 * m + 2) / 5) +
    365 * y +
    INT(y / 4) -
    INT(y / 100) +
    INT(y / 400) -
    32045
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083
  }
  return jd
}

function getNewMoonDay(k: number, timeZone: number): number {
  const T = k / 1236.85
  const T2 = T * T
  const T3 = T2 * T
  const dr = PI / 180
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
  Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr)
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M)
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr)
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr)
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr))
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M))
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr))
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M))
  let deltat
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2
  }
  const JdNew = Jd1 + C1 - deltat
  return INT(JdNew + 0.5 + timeZone / 24)
}

function getSunLongitude(jdn: number, timeZone: number): number {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525
  const T2 = T * T
  const dr = PI / 180
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M)
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M)
  let L = L0 + DL
  L = L * dr
  L = L - PI * 2 * INT(L / (PI * 2))
  return INT((L / PI) * 6)
}

function getLunarMonth11(yy: number, timeZone: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021
  const k = INT(off / 29.530588853)
  let nm = getNewMoonDay(k, timeZone)
  const sunLong = getSunLongitude(nm, timeZone)
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone)
  }
  return nm
}

function getLeapMonthOffset(a11: number, timeZone: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let last = 0
  let i = 1
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone)
  do {
    last = arc
    i++
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone)
  } while (arc !== last && i < 14)
  return i - 1
}

export interface LunarDate {
  day: number
  month: number
  year: number
  leap: 0 | 1
  jd: number
}

export function convertSolar2Lunar(
  dd: number,
  mm: number,
  yy: number,
  timeZone: number = 7,
): LunarDate {
  const dayNumber = jdFromDate(dd, mm, yy)
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853)
  let monthStart = getNewMoonDay(k + 1, timeZone)
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone)
  }
  let a11 = getLunarMonth11(yy, timeZone)
  let b11 = a11
  let lunarYear: number
  if (a11 >= monthStart) {
    lunarYear = yy
    a11 = getLunarMonth11(yy - 1, timeZone)
  } else {
    lunarYear = yy + 1
    b11 = getLunarMonth11(yy + 1, timeZone)
  }
  const lunarDay = dayNumber - monthStart + 1
  const diff = INT((monthStart - a11) / 29)
  let lunarLeap: 0 | 1 = 0
  let lunarMonth = diff + 11
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone)
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10
      if (diff === leapMonthDiff) lunarLeap = 1
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap, jd: dayNumber }
}

// === Can Chi ===

export const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý']
export const CHI = [
  'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi',
]

export const ANIMAL_EMOJI: Record<string, string> = {
  Tý: '🐀', Sửu: '🐂', Dần: '🐅', Mão: '🐈', Thìn: '🐉', Tỵ: '🐍',
  Ngọ: '🐎', Mùi: '🐐', Thân: '🐒', Dậu: '🐓', Tuất: '🐕', Hợi: '🐖',
}

export function canChiYear(lunarYear: number): string {
  return `${CAN[(lunarYear + 6) % 10]} ${CHI[(lunarYear + 8) % 12]}`
}

export function canChiMonth(lunarMonth: number, lunarYear: number): string {
  const canIdx = (lunarYear * 12 + lunarMonth + 3) % 10
  const chiIdx = (lunarMonth + 1) % 12
  return `${CAN[canIdx]} ${CHI[chiIdx]}`
}

export function canChiDay(jd: number): string {
  return `${CAN[(jd + 9) % 10]} ${CHI[(jd + 1) % 12]}`
}

export function chiIndexOfDay(jd: number): number {
  return (jd + 1) % 12
}

export function animalOfYear(lunarYear: number): string {
  return CHI[(lunarYear + 8) % 12]
}

// === Hoàng đạo / Hắc đạo (good vs bad days) ===
// Based on Vietnamese tradition: for each lunar month, certain day-Chi are
// "Hoàng đạo" (auspicious). Source: traditional almanac.

const HOANG_DAO_BY_MONTH: Record<number, number[]> = {
  1: [0, 1, 5, 7, 8, 9], 7: [0, 1, 5, 7, 8, 9],
  2: [2, 3, 7, 9, 10, 11], 8: [2, 3, 7, 9, 10, 11],
  3: [4, 5, 9, 11, 0, 1], 9: [4, 5, 9, 11, 0, 1],
  4: [6, 7, 11, 1, 2, 3], 10: [6, 7, 11, 1, 2, 3],
  5: [8, 9, 1, 3, 4, 5], 11: [8, 9, 1, 3, 4, 5],
  6: [10, 11, 3, 5, 6, 7], 12: [10, 11, 3, 5, 6, 7],
}

export function isHoangDao(lunarMonth: number, dayChi: number): boolean {
  return (HOANG_DAO_BY_MONTH[lunarMonth] ?? []).includes(dayChi)
}

// === Giờ hoàng đạo (auspicious hours) ===
// Pattern based on day-Chi (Vietnamese tradition). Returns list of CHI indices
// that are auspicious hours.

const GIO_HOANG_DAO: Record<number, number[]> = {
  0: [0, 1, 3, 6, 8, 9],   // Day Tý
  1: [2, 3, 5, 8, 10, 11], // Day Sửu
  2: [4, 5, 7, 10, 0, 1],  // Day Dần
  3: [6, 7, 9, 0, 2, 3],   // Day Mão
  4: [8, 9, 11, 2, 4, 5],  // Day Thìn
  5: [10, 11, 1, 4, 6, 7], // Day Tỵ
  6: [0, 1, 3, 6, 8, 9],   // Day Ngọ
  7: [2, 3, 5, 8, 10, 11], // Day Mùi
  8: [4, 5, 7, 10, 0, 1],  // Day Thân
  9: [6, 7, 9, 0, 2, 3],   // Day Dậu
  10: [8, 9, 11, 2, 4, 5], // Day Tuất
  11: [10, 11, 1, 4, 6, 7],// Day Hợi
}

export function gioHoangDao(dayChi: number): { chi: string; range: string }[] {
  const indices = GIO_HOANG_DAO[dayChi] ?? []
  return indices.map((i) => ({
    chi: CHI[i],
    range: hourRangeForChi(i),
  }))
}

function hourRangeForChi(chiIdx: number): string {
  // Giờ Tý = 23-1, Sửu = 1-3, Dần = 3-5, ...
  const start = (chiIdx * 2 + 23) % 24
  const end = (start + 2) % 24
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(start)}:00 – ${pad(end)}:00`
}

// === Convenience ===
export function todayLunar(now: Date = new Date()): LunarDate {
  return convertSolar2Lunar(now.getDate(), now.getMonth() + 1, now.getFullYear())
}
