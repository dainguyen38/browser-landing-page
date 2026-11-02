export type Card = number
export type Kind = 'single'|'pair'|'triple'|'straight'|'four'|'threePairs'|'fourPairs'
export type Combination = {kind:Kind; cards:Card[]; rank:number; suit:number}
export const SUITS = ['♠','♣','♦','♥'] as const
export const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'] as const
export const KIND_NAMES:Record<Kind,string> = {single:'Lẻ',pair:'Đôi',triple:'Sám',straight:'Sảnh',four:'Tứ quý',threePairs:'3 đôi thông',fourPairs:'4 đôi thông'}
export const rank=(card:Card)=>Math.floor(card/4)
export const suit=(card:Card)=>card%4
export const cardName=(card:Card)=>`${RANKS[rank(card)]}${SUITS[suit(card)]}`
export type Rules = {
  fourKindCutsPairTwo:boolean; allowTwoAsLastCard:boolean; instantWinEnabled:boolean
  instantWinSameColor12:boolean; instantWinSameColor13:boolean; congPenaltyEnabled:boolean
  unusedTwosPenaltyEnabled:boolean; unusedSpecialSetsPenalty:boolean; instantWinBonusPerOpponent:number
}
export const DEFAULT_RULES:Rules = {fourKindCutsPairTwo:false,allowTwoAsLastCard:true,instantWinEnabled:true,
  instantWinSameColor12:false,instantWinSameColor13:false,congPenaltyEnabled:true,
  unusedTwosPenaltyEnabled:true,unusedSpecialSetsPenalty:true,instantWinBonusPerOpponent:0}
export type Settings = {humanCount:number; names:string[]; difficulty:'easy'|'normal'; rules:Rules}
export const defaultSettings=():Settings=>({humanCount:1,names:['Bạn','Người chơi 2','Người chơi 3','Người chơi 4'],difficulty:'normal',rules:{...DEFAULT_RULES}})
export const BOT_PROFILES = [
  ['minh','MinhKoi_98'],['linh','LinhMiu'],['huy','HuyChill'],['mai','MaiAnh.21'],
  ['khoa','KhoaBlue'],['anh','AnNhien'],['long','LongWalker'],['vy','VyCloud'],
  ['nam','NamNeo'],['nhi','NhiSunshine'],['phuc','PhucPixel'],['trang','TrangMoon'],
] as const
export const avatarPath=(avatar?:string)=>`/assets/tlmn/avatars/${avatar??'minh'}.jpg`
export const TURN_SECONDS=30
export type Player = {name:string; human:boolean; hand:Card[]; played:number; avatar?:string}
export type Action = {id:string; seat:number; type:'play'|'pass'; cards:Card[]}
export type History = Action & {kind:Kind|null; newTrick:boolean}
export type Transfer = {from:number; to:number; points:number; reason:string; turn:number}
export type Settlement = {seat:number; remaining:number; cong:number; twos:number; specials:number; loss:number; delta:number}
export type Game = {
  profile:'TLMN_OFFLINE_V1'; settings:Settings; phase:'playing'|'finished'; gameIndex:number
  players:Player[]; currentSeat:number; startingSeat:number; mustThree:boolean
  table:Combination|null; lastPlaySeat:number|null; passed:number[]; turnNumber:number
  history:History[]; ledger:Transfer[]; scores:number[]; winner:number|null; instant:string|null; result:Settlement[]
}
const validCard=(c:unknown):c is Card=>Number.isInteger(c)&&Number(c)>=0&&Number(c)<52
export function detectCombination(cards:Card[]):Combination|null {
  if(!cards.length||cards.length>13||!cards.every(validCard)||new Set(cards).size!==cards.length)return null
  const sorted=[...cards].sort((a,b)=>a-b),ranks=sorted.map(rank),unique=[...new Set(ranks)]
  let kind:Kind
  if(unique.length===1&&cards.length<=4)kind=(['single','pair','triple','four'] as const)[cards.length-1]
  else if(unique.length===cards.length&&cards.length>=3&&unique[unique.length-1]!==12&&unique.every((r,i)=>!i||r===unique[i-1]+1))kind='straight'
  else if((cards.length===6||cards.length===8)&&unique.length===cards.length/2&&unique[unique.length-1]!==12&&unique.every((r,i)=>ranks.filter(v=>v===r).length===2&&(!i||r===unique[i-1]+1)))kind=cards.length===6?'threePairs':'fourPairs'
  else return null
  return {kind,cards:sorted,rank:rank(sorted[sorted.length-1]),suit:suit(sorted[sorted.length-1])}
}
export function canBeat(candidate:Combination,current:Combination|null,rules:Rules=DEFAULT_RULES):boolean {
  if(!current)return true
  if(candidate.kind===current.kind&&candidate.cards.length===current.cards.length)
    return candidate.rank>current.rank||(candidate.rank===current.rank&&!['triple','four'].includes(candidate.kind)&&candidate.suit>current.suit)
  const singleTwo=current.kind==='single'&&current.rank===12,pairTwo=current.kind==='pair'&&current.rank===12
  if(candidate.kind==='threePairs')return singleTwo
  if(candidate.kind==='four')return singleTwo||current.kind==='threePairs'||(pairTwo&&rules.fourKindCutsPairTwo)
  if(candidate.kind==='fourPairs')return singleTwo||pairTwo||current.kind==='threePairs'||current.kind==='four'
  return false
}
export function combinations(hand:Card[]):Combination[] {
  const result:Combination[]=[]
  for(let mask=1;mask<1<<hand.length;mask++){
    const cards=hand.filter((_,i)=>mask&(1<<i)),combo=detectCombination(cards)
    if(combo)result.push(combo)
  }
  return result
}
export function instantWin(hand:Card[],rules:Rules=DEFAULT_RULES):{priority:number;name:string}|null {
  if(!rules.instantWinEnabled)return null
  const counts=Array.from({length:13},(_,r)=>hand.filter(c=>rank(c)===r).length)
  let longest=0,run=0
  for(let r=0;r<12;r++){run=counts[r]>=2?run+1:0;longest=Math.max(longest,run)}
  const checks:[boolean,string][]=[
    [counts.slice(0,12).every(n=>n>0),'Sảnh rồng'],[longest>=6,'6 đôi thông'],
    [counts.filter(n=>n>=3).length>=4,'4 sám cô'],[counts.filter(n=>n===4).length>=2,'2 tứ quý'],
    [SUITS.some((_,s)=>hand.filter(c=>suit(c)===s).length>=12),'12 lá cùng chất'],[longest>=5,'5 đôi thông'],
    [counts[12]===4,'Tứ quý 2'],[counts.reduce((n,c)=>n+Math.floor(c/2),0)>=6,'6 đôi'],
    [rules.instantWinSameColor13&&[0,1].some(color=>hand.filter(c=>Math.floor(suit(c)/2)===color).length>=13),'13 lá cùng màu'],
    [rules.instantWinSameColor12&&[0,1].some(color=>hand.filter(c=>Math.floor(suit(c)/2)===color).length>=12),'12 lá cùng màu'],
  ]
  const priority=checks.findIndex(([yes])=>yes)
  return priority<0?null:{priority,name:checks[priority][1]}
}
const SPECIAL_POINTS:Partial<Record<Kind,number>>={threePairs:6,four:8,fourPairs:12}
export function unusedSpecials(hand:Card[]):{points:number;sets:Combination[]} {
  const sets=combinations(hand).filter(c=>SPECIAL_POINTS[c.kind]).sort((a,b)=>(SPECIAL_POINTS[b.kind]!-SPECIAL_POINTS[a.kind]!)||b.rank-a.rank||b.suit-a.suit)
  const masks=sets.map(c=>c.cards.reduce((m,card)=>m|(1<<hand.indexOf(card)),0)),memo=new Map<number,{points:number;sets:Combination[]}>()
  function best(available:number):{points:number;sets:Combination[]} {
    const saved=memo.get(available);if(saved)return saved
    let result={points:0,sets:[] as Combination[]}
    for(let i=0;i<sets.length;i++)if((available&masks[i])===masks[i]){
      const tail=best(available^masks[i]),points=SPECIAL_POINTS[sets[i].kind]!+tail.points
      if(points>result.points)result={points,sets:[sets[i],...tail.sets]}
    }
    memo.set(available,result);return result
  }
  return best((1<<hand.length)-1)
}
export function calculateSettlement(game:Game,winner:number,instant=false):Settlement[] {
  const rules=game.settings.rules
  const rows=game.players.map((p,seat)=>{
    const remaining=p.hand.length,cong=!instant&&rules.congPenaltyEnabled&&p.played===0&&remaining===13?13:0
    const twos=!instant&&rules.unusedTwosPenaltyEnabled?p.hand.filter(c=>rank(c)===12).reduce((n,c)=>n+(suit(c)<2?2:4),0):0
    const specials=!instant&&rules.unusedSpecialSetsPenalty?unusedSpecials(p.hand).points:0
    const loss=seat===winner?0:instant?13+rules.instantWinBonusPerOpponent:remaining+cong+twos+specials
    return {seat,remaining,cong:seat===winner?0:cong,twos:seat===winner?0:twos,specials:seat===winner?0:specials,loss,delta:-loss}
  })
  rows[winner].delta=rows.reduce((n,r)=>n+r.loss,0)
  for(const entry of game.ledger){rows[entry.from].delta-=entry.points;rows[entry.to].delta+=entry.points}
  return rows
}
function finish(game:Game,winner:number,instant:string|null=null) {
  game.phase='finished';game.winner=winner;game.instant=instant
  game.result=calculateSettlement(game,winner,instant!==null)
  game.scores=game.scores.map((score,i)=>score+game.result[i].delta)
}
export function randomSeed():number {
  return globalThis.crypto?.getRandomValues?globalThis.crypto.getRandomValues(new Uint32Array(1))[0]:Math.floor(Math.random()*2**32)
}
export function seededRandom(seed:number) {
  let value=seed>>>0
  return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/2**32}
}
export function createGame(settings:Settings=defaultSettings(),seed=randomSeed(),previous?:Game):Game {
  const random=seededRandom(seed),deck=Array.from({length:52},(_,i)=>i)
  for(let i=51;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}
  const profiles=[...BOT_PROFILES]
  for(let i=profiles.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[profiles[i],profiles[j]]=[profiles[j],profiles[i]]}
  const players=Array.from({length:4},(_,i)=>({name:i<settings.humanCount?(settings.names[i].trim()||`Người chơi ${i+1}`):(previous?.players[i].name??profiles[i][1]),
    avatar:previous?.players[i].avatar??profiles[i][0],human:i<settings.humanCount,hand:deck.slice(i*13,i*13+13).sort((a,b)=>a-b),played:0}))
  const startingSeat=previous?.winner??players.findIndex(p=>p.hand.includes(0))
  const game:Game={profile:'TLMN_OFFLINE_V1',settings:structuredClone(settings),phase:'playing',gameIndex:(previous?.gameIndex??0)+1,
    players,currentSeat:startingSeat,startingSeat,mustThree:!previous,table:null,lastPlaySeat:null,passed:[],turnNumber:0,
    history:[],ledger:[],scores:previous?[...previous.scores]:[0,0,0,0],winner:null,instant:null,result:[]}
  const wins=players.map((p,seat)=>({seat,win:instantWin(p.hand,settings.rules)})).filter(v=>v.win)
    .sort((a,b)=>a.win!.priority-b.win!.priority||((a.seat-startingSeat+4)%4)-((b.seat-startingSeat+4)%4))
  if(wins.length)finish(game,wins[0].seat,wins[0].win!.name)
  return game
}
export type Observation = {
  hand:Card[]; seat:number; counts:number[]; table:Combination|null; mustThree:boolean; rules:Rules
  passed:number[]; currentSeat:number; phase:Game['phase']; history:History[]
}
export function observation(game:Game,seat:number):Observation {
  return structuredClone({hand:game.players[seat].hand,seat,counts:game.players.map(p=>p.hand.length),table:game.table,
    mustThree:game.mustThree,rules:game.settings.rules,passed:game.passed,currentSeat:game.currentSeat,phase:game.phase,history:game.history})
}
export function legalMoves(view:Observation):Combination[] {
  if(view.phase!=='playing'||view.currentSeat!==view.seat||view.passed.includes(view.seat))return []
  return combinations(view.hand).filter(c=>(!view.mustThree||c.cards.includes(0))&&canBeat(c,view.table,view.rules)&&
    (view.rules.allowTwoAsLastCard||c.cards.length!==view.hand.length||!c.cards.some(card=>rank(card)===12)))
}
export function validateAction(game:Game,action:Action):string|null {
  if(game.phase!=='playing')return 'Ván bài đã kết thúc.'
  if(!action.id||action.id.length>100||game.history.some(h=>h.id===action.id))return 'Nước đi đã được xử lý.'
  if(action.seat!==game.currentSeat||game.passed.includes(action.seat))return 'Chưa đến lượt của bạn.'
  if(action.type==='pass')return action.cards.length?'Bỏ lượt không được kèm bài.':!game.table?'Bạn đang mở vòng, hãy đánh bài.':null
  if(action.type!=='play')return 'Hành động không hợp lệ.'
  const hand=game.players[action.seat].hand
  if(!action.cards.every(c=>hand.includes(c))||new Set(action.cards).size!==action.cards.length)return 'Bài được chọn không nằm trong tay.'
  const combo=detectCombination(action.cards)
  if(!combo)return 'Hãy chọn lẻ, đôi, sám, sảnh, tứ quý hoặc đôi thông hợp lệ.'
  if(game.mustThree&&!action.cards.includes(0))return 'Lượt đầu ván đầu phải có 3♠.'
  if(!canBeat(combo,game.table,game.settings.rules))return 'Bộ bài chưa chặn được bài trên bàn.'
  if(!game.settings.rules.allowTwoAsLastCard&&action.cards.length===hand.length&&action.cards.some(c=>rank(c)===12))return 'Luật bàn này không cho về bằng 2.'
  return null
}
export function applyAction(game:Game,action:Action):{state:Game;error:string|null} {
  const error=validateAction(game,action);if(error)return {state:game,error}
  const state=structuredClone(game),player=state.players[action.seat],combo=action.type==='play'?detectCombination(action.cards)!:null
  const newTrick=state.table===null
  if(combo){
    const target=state.table
    if(target&&SPECIAL_POINTS[combo.kind]&&state.lastPlaySeat!==null){
      const points=SPECIAL_POINTS[target.kind]??(target.rank===12&&['single','pair'].includes(target.kind)?target.cards.reduce((n,c)=>n+(suit(c)<2?3:6),0):0)
      if(points)state.ledger.push({from:state.lastPlaySeat,to:action.seat,points,reason:`${KIND_NAMES[combo.kind]} chặt ${target.cards.map(cardName).join(' ')}`,turn:state.turnNumber})
    }
    player.hand=player.hand.filter(c=>!action.cards.includes(c));player.played+=action.cards.length
    state.table=combo;state.lastPlaySeat=action.seat;state.mustThree=false
  }else state.passed.push(action.seat)
  state.history.push({...action,cards:[...action.cards],kind:combo?.kind??null,newTrick});state.turnNumber++
  if(!player.hand.length){finish(state,action.seat);return {state,error:null}}
  if(state.passed.length===3){state.currentSeat=state.lastPlaySeat!;state.table=null;state.lastPlaySeat=null;state.passed=[]}
  else{let next=(action.seat+1)%4;while(state.passed.includes(next))next=(next+1)%4;state.currentSeat=next}
  return {state,error:null}
}
export function chooseBotAction(view:Observation,moves:Combination[],difficulty:Settings['difficulty'],random=Math.random):{type:'play'|'pass';cards:Card[]} {
  if(!moves.length)return {type:'pass',cards:[]}
  const finish=moves.find(m=>m.cards.length===view.hand.length)
  if(finish)return {type:'play',cards:finish.cards}
  if(difficulty==='easy'){
    if(view.table&&random()<.08)return {type:'pass',cards:[]}
    const small=[...moves].sort((a,b)=>a.rank-b.rank||a.cards.length-b.cards.length).slice(0,Math.min(4,moves.length))
    return {type:'play',cards:small[Math.floor(random()*small.length)].cards}
  }
  const danger=view.counts.some((n,i)=>i!==view.seat&&n<=2),counts=Array.from({length:13},(_,r)=>view.hand.filter(c=>rank(c)===r).length)
  const protectedSets=combinations(view.hand).filter(c=>SPECIAL_POINTS[c.kind])
  const value=(move:Combination)=>{
    const broken=move.cards.reduce((n,c)=>n+(counts[rank(c)]>=2&&move.cards.filter(v=>rank(v)===rank(c)).length<counts[rank(c)]?counts[rank(c)]===4?8:2:0),0)
    const breaksSet=protectedSets.some(set=>set.cards.some(c=>move.cards.includes(c))&&!set.cards.every(c=>move.cards.includes(c)))
    return move.cards.length*(view.table?1:5)-move.rank*.35-move.suit*.025-broken-(breaksSet&&!danger?8:0)-(SPECIAL_POINTS[move.kind]&&!danger?5:0)-(move.rank===12&&!danger?4:0)
  }
  const best=[...moves].sort((a,b)=>value(b)-value(a)||a.rank-b.rank)[0]
  return {type:'play',cards:best.cards}
}
export function nextAction(game:Game,seat:number,move:{type:'play'|'pass';cards:Card[]}):Action {
  return {...move,seat,id:`${game.gameIndex}:${game.turnNumber}:${seat}`}
}
export function getViewForSeat(game:Game,viewer:number|null) {
  return {players:game.players.map((p,i)=>({name:p.name,human:p.human,avatar:p.avatar??'minh',count:p.hand.length,hand:i===viewer?[...p.hand]:[]})),table:game.table,currentSeat:game.currentSeat}
}
const obj=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const int=(v:unknown)=>Number.isSafeInteger(v)
const cards=(v:unknown):v is Card[]=>Array.isArray(v)&&v.length<=52&&v.every(validCard)&&new Set(v).size===v.length
export function validSettings(v:unknown):v is Settings {
  return obj(v)&&int(v.humanCount)&&v.humanCount>=1&&v.humanCount<=4&&['easy','normal'].includes(v.difficulty)&&
    v.rules?.allowTwoAsLastCard===true&&Array.isArray(v.names)&&v.names.length===4&&v.names.every((n:unknown)=>typeof n==='string'&&n.length<=24)&&obj(v.rules)&&
    Object.keys(DEFAULT_RULES).every(k=>k==='instantWinBonusPerOpponent'?int(v.rules[k])&&v.rules[k]>=0&&v.rules[k]<=100:typeof v.rules[k]==='boolean')
}
export function validGame(v:unknown):v is Game {
  if(!obj(v)||v.profile!=='TLMN_OFFLINE_V1'||!validSettings(v.settings)||!['playing','finished'].includes(v.phase)||!int(v.gameIndex)||v.gameIndex<1||
    !int(v.currentSeat)||v.currentSeat<0||v.currentSeat>3||!int(v.startingSeat)||v.startingSeat<0||v.startingSeat>3||typeof v.mustThree!=='boolean'||
    !Array.isArray(v.players)||v.players.length!==4||!v.players.every((p:any,i:number)=>obj(p)&&typeof p.name==='string'&&p.name.length<=24&&(p.avatar===undefined||BOT_PROFILES.some(([id])=>id===p.avatar))&&p.human===(i<v.settings.humanCount)&&cards(p.hand)&&p.hand.length<=13&&int(p.played)&&p.played>=0&&p.played+p.hand.length===13)||
    !Array.isArray(v.scores)||v.scores.length!==4||!v.scores.every(int)||v.scores.reduce((a:number,b:number)=>a+b,0)!==0||
    !Array.isArray(v.passed)||new Set(v.passed).size!==v.passed.length||v.passed.length>2||!v.passed.every((s:unknown)=>int(s)&&Number(s)>=0&&Number(s)<4)||v.passed.includes(v.currentSeat)||
    !int(v.turnNumber)||v.turnNumber<0||!Array.isArray(v.history)||v.history.length!==v.turnNumber||v.history.length>208||
    !v.history.every((h:any)=>obj(h)&&typeof h.id==='string'&&h.id.length>0&&h.id.length<=100&&int(h.seat)&&h.seat>=0&&h.seat<4&&['play','pass'].includes(h.type)&&cards(h.cards)&&typeof h.newTrick==='boolean'&&(h.type==='pass'?h.cards.length===0&&h.kind===null:detectCombination(h.cards)?.kind===h.kind))||
    new Set(v.history.map((h:any)=>h.id)).size!==v.history.length)return false
  const all=[...v.players.flatMap((p:Player)=>p.hand),...v.history.flatMap((h:History)=>h.cards)]
  if(all.length!==52||new Set(all).size!==52||v.players.some((p:Player,i:number)=>v.history.filter((h:History)=>h.seat===i).reduce((n:number,h:History)=>n+h.cards.length,0)!==p.played))return false
  if(v.table===null){if(v.lastPlaySeat!==null||v.passed.length)return false}
  else if(!obj(v.table)||!cards(v.table.cards)||JSON.stringify(detectCombination(v.table.cards))!==JSON.stringify(v.table)||!int(v.lastPlaySeat)||v.lastPlaySeat<0||v.lastPlaySeat>3||v.passed.includes(v.lastPlaySeat))return false
  if(!Array.isArray(v.ledger)||v.ledger.length>52||!v.ledger.every((l:any)=>obj(l)&&int(l.from)&&l.from>=0&&l.from<4&&int(l.to)&&l.to>=0&&l.to<4&&l.to!==l.from&&int(l.points)&&l.points>0&&l.points<=12&&typeof l.reason==='string'&&int(l.turn)&&l.turn>=0&&l.turn<v.turnNumber))return false
  if(v.phase==='playing')return v.winner===null&&v.instant===null&&Array.isArray(v.result)&&!v.result.length&&v.players.every((p:Player)=>p.hand.length>0)
  return int(v.winner)&&v.winner>=0&&v.winner<4&&(v.instant===null||typeof v.instant==='string')&&
    (v.instant!==null||v.players[v.winner].hand.length===0)&&JSON.stringify(v.result)===JSON.stringify(calculateSettlement(v as Game,v.winner,v.instant!==null))
}


export function assistedSelection(moves:Combination[],selected:Card[],clicked:Card,responding:boolean):Card[] {
  if(selected.includes(clicked))return selected.filter(c=>c!==clicked)
  const next=[...selected,clicked]
  if(!responding)return next
  const matches=moves.filter(move=>next.every(c=>move.cards.includes(c)))
  return matches.length===1?[...matches[0].cards]:next
}
export function timeoutAction(game:Game):Action {
  if(game.table)return nextAction(game,game.currentSeat,{type:'pass',cards:[]})
  const moves=legalMoves(observation(game,game.currentSeat)).sort((a,b)=>a.cards.length-b.cards.length||a.rank-b.rank||a.suit-b.suit)
  return nextAction(game,game.currentSeat,{type:'play',cards:moves[0]?.cards??[]})
}
