// Minimal Telex transformer for Vietnamese input. Converts a stream of
// raw ASCII keystrokes into Vietnamese Unicode characters. Works alongside
// (rather than replacing) any OS-level Vietnamese IME the user may have —
// we run this on raw keys; if the OS IME has already composed the character
// it will arrive via the `input` event already in final form and skip Telex.

// Vowel base + tone tables. Index by [base][tone] where tone:
//   0 none, 1 sắc, 2 huyền, 3 hỏi, 4 ngã, 5 nặng
const TONES: Record<string, string[]> = {
  a:  ['a', 'á', 'à', 'ả', 'ã', 'ạ'],
  â:  ['â', 'ấ', 'ầ', 'ẩ', 'ẫ', 'ậ'],
  ă:  ['ă', 'ắ', 'ằ', 'ẳ', 'ẵ', 'ặ'],
  e:  ['e', 'é', 'è', 'ẻ', 'ẽ', 'ẹ'],
  ê:  ['ê', 'ế', 'ề', 'ể', 'ễ', 'ệ'],
  i:  ['i', 'í', 'ì', 'ỉ', 'ĩ', 'ị'],
  o:  ['o', 'ó', 'ò', 'ỏ', 'õ', 'ọ'],
  ô:  ['ô', 'ố', 'ồ', 'ổ', 'ỗ', 'ộ'],
  ơ:  ['ơ', 'ớ', 'ờ', 'ở', 'ỡ', 'ợ'],
  u:  ['u', 'ú', 'ù', 'ủ', 'ũ', 'ụ'],
  ư:  ['ư', 'ứ', 'ừ', 'ử', 'ữ', 'ự'],
  y:  ['y', 'ý', 'ỳ', 'ỷ', 'ỹ', 'ỵ'],
}

// Reverse map: any toned vowel → [base, tone]
const FROM_TONED: Map<string, [string, number]> = new Map()
for (const [base, arr] of Object.entries(TONES)) {
  arr.forEach((ch, t) => FROM_TONED.set(ch, [base, t]))
  arr.forEach((ch, t) => FROM_TONED.set(ch.toUpperCase(), [base.toUpperCase(), t]))
}

const VOWELS = new Set(Object.keys(TONES).concat(Object.keys(TONES).map((c) => c.toUpperCase())))

const TONE_KEYS: Record<string, number> = { s: 1, f: 2, r: 3, x: 4, j: 5, z: 0 }

const VOWEL_MOD: Record<string, string> = {
  // base + modifier key → modified base
  aa: 'â', AA: 'Â',
  aw: 'ă', AW: 'Ă',
  ee: 'ê', EE: 'Ê',
  oo: 'ô', OO: 'Ô',
  ow: 'ơ', OW: 'Ơ',
  uw: 'ư', UW: 'Ư',
  dd: 'đ', DD: 'Đ',
}

/** Strip the tone off a base+tone vowel, returning [bareBase, tone]. */
function decompose(ch: string): [string, number] {
  return FROM_TONED.get(ch) ?? [ch, 0]
}

/** Compose [base, tone] back into a single Unicode character. */
function compose(base: string, tone: number): string {
  const lower = base.toLowerCase()
  const arr = TONES[lower]
  if (!arr) return base
  const composed = arr[tone] || arr[0]
  return base === lower ? composed : composed.toUpperCase()
}

/** Find the last vowel in a string (returns its index, or -1). */
function lastVowelIndex(s: string): number {
  for (let i = s.length - 1; i >= 0; i--) {
    const [base] = decompose(s[i])
    if (VOWELS.has(base.toLowerCase())) return i
  }
  return -1
}

/**
 * Process a single raw key against the current buffer and return the new
 * buffer. The key is a single character (a-z, A-Z, etc.) typed by the user.
 *
 * Rules:
 *   - aa/aw/ee/oo/ow/uw/dd → â ă ê ô ơ ư đ (case-preserving)
 *   - s f r x j z → apply tone to the most recent vowel
 *   - z removes any existing tone
 *   - If a tone/modifier key follows a non-vowel context, append it literally
 */
export function applyTelexKey(buffer: string, key: string): string {
  if (key.length !== 1) return buffer + key

  const last = buffer.slice(-1)

  // Vowel modifier (aa/aw/ee/oo/ow/uw/dd)
  const combo = last + key
  if (VOWEL_MOD[combo]) {
    return buffer.slice(0, -1) + VOWEL_MOD[combo]
  }

  // Tone marks
  const lowerKey = key.toLowerCase()
  if (lowerKey in TONE_KEYS) {
    const tone = TONE_KEYS[lowerKey]
    const idx = lastVowelIndex(buffer)
    if (idx >= 0) {
      const [base, existing] = decompose(buffer[idx])
      // 'z' removes existing tone; 'sfrxj' apply new tone
      const newTone = lowerKey === 'z' ? 0 : tone
      if (newTone !== existing || lowerKey === 'z') {
        return buffer.slice(0, idx) + compose(base, newTone) + buffer.slice(idx + 1)
      }
    }
  }

  return buffer + key
}

/**
 * Run a full string of raw keys through Telex transformation.
 * Useful for tests and bulk conversion.
 */
export function telexString(raw: string): string {
  let out = ''
  for (const ch of raw) out = applyTelexKey(out, ch)
  return out
}

/**
 * Predict the raw key sequence needed to TYPE a given Vietnamese character
 * via Telex — used by the keyboard widget to highlight the next key.
 * Returns the sequence of raw keys.
 */
export function telexHintFor(ch: string): string[] {
  const [base, tone] = decompose(ch)
  const lower = base.toLowerCase()
  // Vowel modifier mapping (lowercase base → raw key sequence)
  const modSeq: Record<string, string[]> = {
    â: ['a', 'a'], ă: ['a', 'w'],
    ê: ['e', 'e'],
    ô: ['o', 'o'], ơ: ['o', 'w'],
    ư: ['u', 'w'],
    đ: ['d', 'd'],
  }
  const baseKeys = modSeq[lower] ?? [lower]
  const toneKey: Record<number, string | undefined> = {
    0: undefined,
    1: 's', 2: 'f', 3: 'r', 4: 'x', 5: 'j',
  }
  const tk = toneKey[tone]
  return tk ? [...baseKeys, tk] : baseKeys
}
