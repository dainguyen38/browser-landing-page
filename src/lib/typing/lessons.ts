// Progressive typing curriculum, hard-coded so it works offline and ships
// with the bundle. Stages within a language go from absolute beginner
// (2-finger F/J drills) up to full paragraphs. The structure is the same
// for English and Vietnamese so the UI doesn't need to branch.

export type LessonLang = 'en' | 'vi'
export type LessonType = 'chars' | 'words' | 'sentence' | 'paragraph'

export interface LessonStage {
  id: string
  lang: LessonLang
  title: string
  /** Short hint shown next to the title */
  blurb: string
  type: LessonType
  /** Sequence of items to type (chars/words/sentences/paragraphs). */
  units: string[]
  /** ms allotted PER CHARACTER before the enemy reaches the hero. Lower = harder. */
  msPerChar: number
  /** Minimum accuracy % required to pass. */
  minAccuracy: number
  /** Minimum WPM required (paragraphs only — undefined skips check). */
  minWpm?: number
}

// === English curriculum ===================================================

const EN_HOME_FJ = ['fj', 'jf', 'ff', 'jj', 'fjf', 'jfj', 'fjjf', 'jffj', 'ffjj', 'jjff']
const EN_HOME_DK = ['dk', 'kd', 'dkdk', 'fjdk', 'kdjf', 'fdjk', 'fkdj']
const EN_HOME_SL = ['sl', 'ls', 'sa la', 'asdf jkl', 'sad fall', 'all lads']
const EN_HOME_FULL = [
  'asdf jkl;',
  'a sad lad',
  'add salad',
  'has half',
  'jakal fall',
  'glad jakl',
  'a dash of salt',
]

const EN_TOP = [
  'qwer tyui',
  'opqw eryt',
  'we type quietly',
  'royal pewter quotes',
  'try your power',
  'we were quite quiet',
]

const EN_BOTTOM = [
  'zxcv bnm',
  'mix bench',
  'zen vibe',
  'cab van',
  'six men climb',
  'a brave cat',
]

const EN_WORDS = [
  'the and you for are not but can her',
  'his out one all our who has had',
  'when from will what some they were',
  'about could would there their which',
]

const EN_NUMBERS = [
  '1234 5678 90',
  '11 22 33 44 55',
  'order 482 today',
  'in 1969 we landed',
  'pi is 3.14159',
]

const EN_PUNCT = [
  "It's a fine day, isn't it?",
  '"Hello," she said. "How are you?"',
  'Send me an email: hello@example.com.',
  '(Note: see page 42; details there.)',
]

const EN_SENTENCES = [
  'The quick brown fox jumps over the lazy dog.',
  'Pack my box with five dozen liquor jugs.',
  'Sphinx of black quartz, judge my vow.',
  'Bright vixens jump; dozy fowl quack.',
  'How vexingly quick daft zebras jump!',
]

const EN_PARAGRAPHS = [
  // Public-domain feel; original short passages
  "A good typist learns to trust the home row. The fingers rest lightly on a s d f and j k l semicolon, and from there they reach outward to every other key. Practice slowly at first. Speed will follow accuracy, but accuracy never follows speed.",
  "The best way to predict the future is to invent it. Build something every day, even if it is small. Small steps compound into miles of progress, and miles compound into the journey of a lifetime.",
  "She walked along the quiet street, listening to the leaves rustle in the cool autumn wind. The streetlamps painted long shadows on the pavement, and somewhere far away a dog barked twice and then was silent.",
]

// === Vietnamese curriculum ================================================
//
// Stages 1-5 are language-agnostic finger drills. Stages 6+ exercise tone
// marks and Telex diacritics. We assume the user has a Vietnamese IME or
// uses our built-in Telex transformer (see telex.ts).

const VI_TELEX_VOWELS = [
  'aa ee oo',         // â ê ô (typed: aa, ee, oo)
  'aw uw ow',         // ă ư ơ
  'dd',               // đ
  'cây hoa lá',
  'mây trắng',
  'ơ kìa nắng',
  'mưa nhẹ rơi',
]

const VI_TELEX_TONES = [
  'á à ả ã ạ',
  'é è ẻ ẽ ẹ',
  'í ì ỉ ĩ ị',
  'ó ò ỏ õ ọ',
  'cá vàng',
  'mẹ hiền',
  'bố thương',
  'học sinh giỏi',
]

const VI_WORDS = [
  'xin chào, cảm ơn, tạm biệt',
  'tiếng Việt, học sinh, gia đình',
  'cà phê, bánh mì, phở bò',
  'mặt trời, mặt trăng, biển cả',
]

const VI_SENTENCES = [
  'Hôm nay trời rất đẹp và mát mẻ.',
  'Tôi yêu tiếng Việt và quê hương Việt Nam.',
  'Học tập chăm chỉ thì sẽ thành công.',
  'Cô ấy đang đọc một cuốn sách hay.',
  'Mặt trời mọc ở đằng đông, lặn ở đằng tây.',
]

const VI_PROVERBS = [
  'Có công mài sắt, có ngày nên kim.',
  'Học, học nữa, học mãi.',
  'Đi một ngày đàng, học một sàng khôn.',
  'Lá lành đùm lá rách.',
  'Ăn quả nhớ kẻ trồng cây.',
  'Chậm mà chắc.',
  'Tốt gỗ hơn tốt nước sơn.',
]

const VI_PARAGRAPHS = [
  'Ngày xưa, ở một làng nhỏ ven sông có hai anh em mồ côi cha mẹ từ thuở nhỏ. Người anh tham lam ích kỷ, còn người em hiền lành chăm chỉ. Mỗi sáng, người em ra đồng làm việc, còn người anh ở nhà nghỉ ngơi. Dù vậy, người em không bao giờ giận anh mình.',
  'Một buổi chiều mùa thu, gió heo may nhẹ thổi qua những hàng tre xanh mướt. Trẻ con trong làng tụ tập trên bãi cỏ, thả diều và đuổi bắt nhau. Tiếng cười vang vọng khắp xóm, hòa cùng tiếng chim hót líu lo trên cành đa cổ thụ.',
  'Tiếng Việt là ngôn ngữ giàu thanh điệu, mỗi từ đều mang một nhạc điệu riêng. Để gõ tiếng Việt bằng bàn phím, người ta thường dùng kiểu Telex hoặc VNI. Khi luyện tập, hãy đi từng bước chậm rãi, đặt độ chính xác lên trên tốc độ.',
]

// === Stage list ===========================================================

export const STAGES: LessonStage[] = [
  // English
  { id: 'en.fj', lang: 'en', title: 'F & J — Home position', blurb: 'Index fingers, 2-finger drill', type: 'chars', units: EN_HOME_FJ, msPerChar: 1800, minAccuracy: 90 },
  { id: 'en.dk', lang: 'en', title: 'D & K — Middle fingers', blurb: 'Add the middle fingers', type: 'chars', units: EN_HOME_DK, msPerChar: 1700, minAccuracy: 90 },
  { id: 'en.sl', lang: 'en', title: 'S & L — Ring fingers', blurb: 'Add the ring fingers', type: 'words', units: EN_HOME_SL, msPerChar: 1600, minAccuracy: 90 },
  { id: 'en.home', lang: 'en', title: 'Full home row', blurb: 'asdfg hjkl;', type: 'words', units: EN_HOME_FULL, msPerChar: 1400, minAccuracy: 92 },
  { id: 'en.top', lang: 'en', title: 'Top row', blurb: 'qwert yuiop', type: 'words', units: EN_TOP, msPerChar: 1300, minAccuracy: 92 },
  { id: 'en.bottom', lang: 'en', title: 'Bottom row', blurb: 'zxcvb nm', type: 'words', units: EN_BOTTOM, msPerChar: 1300, minAccuracy: 92 },
  { id: 'en.words', lang: 'en', title: 'Common words', blurb: 'Speed up on familiar words', type: 'sentence', units: EN_WORDS, msPerChar: 1100, minAccuracy: 93 },
  { id: 'en.numbers', lang: 'en', title: 'Numbers row', blurb: '1234567890', type: 'sentence', units: EN_NUMBERS, msPerChar: 1300, minAccuracy: 90 },
  { id: 'en.punct', lang: 'en', title: 'Punctuation & capitals', blurb: 'Shift + symbols', type: 'sentence', units: EN_PUNCT, msPerChar: 1300, minAccuracy: 90 },
  { id: 'en.sentences', lang: 'en', title: 'Pangram sentences', blurb: 'Whole sentences', type: 'sentence', units: EN_SENTENCES, msPerChar: 1000, minAccuracy: 94 },
  { id: 'en.paragraph', lang: 'en', title: 'Paragraph practice', blurb: 'Sustain speed + accuracy', type: 'paragraph', units: EN_PARAGRAPHS, msPerChar: 950, minAccuracy: 95, minWpm: 25 },
  // Vietnamese
  { id: 'vi.fj', lang: 'vi', title: 'F & J — Vị trí gốc', blurb: 'Hai ngón trỏ', type: 'chars', units: EN_HOME_FJ, msPerChar: 1800, minAccuracy: 90 },
  { id: 'vi.dk', lang: 'vi', title: 'D & K — Ngón giữa', blurb: 'Thêm ngón giữa', type: 'chars', units: EN_HOME_DK, msPerChar: 1700, minAccuracy: 90 },
  { id: 'vi.home', lang: 'vi', title: 'Hàng phím cơ sở', blurb: 'asdfg hjkl;', type: 'words', units: EN_HOME_FULL, msPerChar: 1400, minAccuracy: 92 },
  { id: 'vi.top', lang: 'vi', title: 'Hàng phím trên', blurb: 'qwerty uiop', type: 'words', units: EN_TOP, msPerChar: 1300, minAccuracy: 92 },
  { id: 'vi.bottom', lang: 'vi', title: 'Hàng phím dưới', blurb: 'zxcvb nm', type: 'words', units: EN_BOTTOM, msPerChar: 1300, minAccuracy: 92 },
  { id: 'vi.telex_vowels', lang: 'vi', title: 'Telex: â ă ê ô ơ ư đ', blurb: 'aa aw ee oo ow uw dd', type: 'words', units: VI_TELEX_VOWELS, msPerChar: 1500, minAccuracy: 90 },
  { id: 'vi.telex_tones', lang: 'vi', title: 'Telex: dấu thanh', blurb: 's f r x j', type: 'words', units: VI_TELEX_TONES, msPerChar: 1400, minAccuracy: 90 },
  { id: 'vi.words', lang: 'vi', title: 'Từ thông dụng', blurb: 'Các từ thường gặp', type: 'sentence', units: VI_WORDS, msPerChar: 1200, minAccuracy: 92 },
  { id: 'vi.sentences', lang: 'vi', title: 'Câu hoàn chỉnh', blurb: 'Cả câu', type: 'sentence', units: VI_SENTENCES, msPerChar: 1050, minAccuracy: 93 },
  { id: 'vi.proverbs', lang: 'vi', title: 'Tục ngữ Việt', blurb: 'Tục ngữ ca dao', type: 'sentence', units: VI_PROVERBS, msPerChar: 1050, minAccuracy: 93 },
  { id: 'vi.paragraph', lang: 'vi', title: 'Đoạn văn', blurb: 'Sustain — duy trì tốc độ', type: 'paragraph', units: VI_PARAGRAPHS, msPerChar: 1000, minAccuracy: 95, minWpm: 20 },
]

export function getStage(id: string): LessonStage | undefined {
  return STAGES.find((s) => s.id === id)
}

export function stagesByLang(lang: LessonLang): LessonStage[] {
  return STAGES.filter((s) => s.lang === lang)
}

// === Time-attack & endless pools (random word/sentence fountains) =========

export const ENDLESS_POOL_EN = [
  'the', 'and', 'you', 'for', 'are', 'not', 'but', 'can', 'her', 'his', 'out',
  'one', 'all', 'our', 'who', 'has', 'had', 'when', 'from', 'will', 'what',
  'some', 'they', 'were', 'about', 'could', 'would', 'there', 'their', 'which',
  'time', 'people', 'water', 'after', 'world', 'place', 'where', 'while',
  'house', 'light', 'music', 'never', 'every', 'often', 'paper', 'right',
  'small', 'stand', 'still', 'study', 'voice', 'whole', 'happy', 'green',
]

export const ENDLESS_POOL_VI = [
  'tôi', 'bạn', 'ngày', 'mai', 'hôm nay', 'sáng', 'chiều', 'tối', 'mẹ', 'bố',
  'anh', 'chị', 'em', 'ông', 'bà', 'cô', 'chú', 'thầy', 'nhà', 'trường',
  'sách', 'bút', 'ghế', 'bàn', 'cửa', 'đường', 'phố', 'cây', 'hoa', 'lá',
  'mây', 'gió', 'nắng', 'mưa', 'biển', 'núi', 'sông', 'cánh đồng', 'tiếng việt',
  'học', 'chơi', 'ăn', 'uống', 'đi', 'đến', 'về', 'ngủ', 'thức', 'cười',
  'vui', 'buồn', 'đẹp', 'giỏi', 'hiền', 'thông minh', 'chăm chỉ',
]

export function pickRandom<T>(arr: T[], rng = Math.random): T {
  return arr[Math.floor(rng() * arr.length)]
}
