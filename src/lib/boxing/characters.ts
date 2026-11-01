export const FIGHTERS = [
  { id:'ace', name:'Ace', skin:'#c98761', hair:'#201b1d', cut:'quiff', kit:'#174b80', glove:'#367fc3', trim:'#e8c47a', height:2.4, build:1 },
  { id:'blaze', name:'Blaze', skin:'#a76143', hair:'#873d28', cut:'mohawk', kit:'#8c272c', glove:'#d34b3d', trim:'#ffcc83', height:2.38, build:1.04 },
  { id:'raven', name:'Raven', skin:'#d9a479', hair:'#14151c', cut:'knot', kit:'#29213f', glove:'#7b64bc', trim:'#e6d6f3', height:2.34, build:.93 },
  { id:'titan', name:'Titan', skin:'#744a36', hair:'#201915', cut:'beard', kit:'#23282c', glove:'#bd8b42', trim:'#f0d9a2', height:2.5, build:1.13 },
  { id:'jade', name:'Jade', skin:'#b98264', hair:'#c9d4ca', cut:'braids', kit:'#12524c', glove:'#48c0a2', trim:'#e4e9d4', height:2.37, build:.97 },
  { id:'frost', name:'Frost', skin:'#e0b99b', hair:'#dad8ce', cut:'slick', kit:'#c1cbd1', glove:'#dbe4e8', trim:'#457a94', height:2.43, build:1.01 },
  { id:'nova', name:'Nova', skin:'#8c533b', hair:'#2c1c1b', cut:'curls', kit:'#593338', glove:'#eb8357', trim:'#f4ce95', height:2.36, build:.96 },
  { id:'onyx', name:'Onyx', skin:'#be8764', hair:'#15171d', cut:'headguard', kit:'#161b28', glove:'#263c58', trim:'#d0a96a', height:2.45, build:1.08 },
] as const
export type FighterLook = typeof FIGHTERS[number]
export const DEFAULT_ROSTER: [string,string] = ['ace','blaze']
export const fighterLook = (id:string) => FIGHTERS.find(f=>f.id===id) ?? FIGHTERS[0]
export const validRoster = (value:unknown):value is [string,string] => Array.isArray(value) && value.length===2 && value.every(id=>FIGHTERS.some(f=>f.id===id))
