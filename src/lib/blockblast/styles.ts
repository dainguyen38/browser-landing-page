export const BLOCK_STYLES = [
  { id: 'candy', radius: .16, roughness: .27, metalness: .1, coat: .9, depth: .42, emissive: 0 },
  { id: 'crystal', radius: .04, roughness: .08, metalness: .5, coat: 1, depth: .58, emissive: .04 },
  { id: 'neon', radius: .1, roughness: .35, metalness: .3, coat: .4, depth: .38, emissive: .35 },
  { id: 'wood', radius: .07, roughness: .95, metalness: 0, coat: 0, depth: .5, emissive: 0 },
  { id: 'pixel', radius: 0, roughness: .7, metalness: .05, coat: 0, depth: .65, emissive: 0 },
  { id: 'chrome', radius: .12, roughness: .15, metalness: .9, coat: 1, depth: .4, emissive: .02 },
] as const
export const ENVIRONMENTS = [
  { id: 'cosmos', bg: ['#171e4b','#060b21'], colors: ['#52a8ff','#ffb946','#b482ff','#42debf','#ff688f','#fb8950','#c4e85c'], floor:'#111c35', socket:'#253453', light:'#b7c7ff' },
  { id: 'aurora', bg: ['#352146','#100d29'], colors: ['#f7a9da','#bba2ff','#8fcdf2','#9ce5c2','#ffe29a','#ffab9d','#d5e893'], floor:'#231c3e', socket:'#3b315b', light:'#d6a4ff' },
  { id: 'ocean', bg: ['#064b59','#041d27'], colors: ['#18d9ce','#44b4ff','#e5ce65','#fa8768','#b395ef','#75d47c','#f187bc'], floor:'#0c3444', socket:'#215466', light:'#61f5ed' },
  { id: 'sunset', bg: ['#6b3028','#21122d'], colors: ['#ffad32','#ed694f','#efce62','#92c984','#bba1f2','#f393ba','#67c9d6'], floor:'#442938', socket:'#614052', light:'#ffc58e' },
  { id: 'forest', bg: ['#1a4a36','#071d20'], colors: ['#a1d66a','#f8ce65','#ed9573','#74ced0','#be9cdd','#e9b2cf','#8ab5f3'], floor:'#173b30', socket:'#2d5846', light:'#c5ffc2' },
  { id: 'snow', bg: ['#416586','#17263f'], colors: ['#a6dfff','#e9bbff','#8cebd7','#ffd3a6','#ff9eb4','#d8e99e','#97b8ff'], floor:'#304c68', socket:'#52738b', light:'#e8faff' },
] as const
