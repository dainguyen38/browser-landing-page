import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { applyAction, createGame, randomSeed, validGame, validSettings, type Action, type Game, type Settings } from '@/lib/tlmn/game'

export const INITIAL_COINS=1_000_000
export const COIN_PHRASE='Việt Nam vô địch'
export const BETS=[1_000,10_000,50_000,100_000] as const
export const humanAccount=(seat:number)=>`human:${seat}`
export const formatCoins=(value:number)=>value.toLocaleString('vi-VN')
export type CoinRound={id:string; stake:number; accounts:string[]; game:Game; settled:boolean; deltas:number[]; dealComplete?:boolean}
type State={balances:Record<string,number>;round:CoinRound|null}
type Result={game:Game|null;error:string|null}
type Actions={
  claim:(phrase:string,account?:string)=>boolean
  startRound:(settings:Settings,stake:number,next?:boolean)=>Result
  play:(roundId:string,action:Action)=>Result
  completeDeal:(roundId:string)=>boolean
  cancelRound:(roundId:string)=>boolean
}
const fresh=():State=>({balances:Object.fromEntries([0,1,2,3].map(i=>[humanAccount(i),INITIAL_COINS])),round:null})
const balance=(balances:Record<string,number>,account:string)=>balances[account]??INITIAL_COINS
function settle(state:State):State {
  const round=state.round
  if(!round||round.settled||round.game.phase!=='finished')return state
  const balances={...state.balances},winner=round.game.winner!,account=round.accounts[winner]
  balances[account]=balance(balances,account)+round.stake*4
  return {...state,balances,round:{...round,settled:true,deltas:round.accounts.map((_,seat)=>seat===winner?round.stake*3:-round.stake)}}
}
const accountIsHuman=(id:string)=>/^human:[0-3]$/.test(id)
export function validCoinState(value:unknown):value is State {
  const s=value as State
  if(!s||typeof s!=='object'||!s.balances||typeof s.balances!=='object'||Array.isArray(s.balances)||
    !Object.entries(s.balances).every(([id,n])=>(accountIsHuman(id)||/^bot:[a-z]+$/.test(id))&&Number.isSafeInteger(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER)||
    ![0,1,2,3].every(i=>Number.isSafeInteger(s.balances[humanAccount(i)])))return false
  if(s.round===null)return true
  const r=s.round
  return !!r&&typeof r.id==='string'&&r.id.length>0&&r.id.length<=100&&(r.dealComplete===undefined||typeof r.dealComplete==='boolean')&&(BETS as readonly number[]).includes(r.stake)&&
    Array.isArray(r.accounts)&&r.accounts.length===4&&new Set(r.accounts).size===4&&r.accounts.every(id=>typeof id==='string'&&Number.isSafeInteger(s.balances[id]))&&
    validGame(r.game)&&r.accounts.every((id,i)=>id===(r.game.players[i].human?humanAccount(i):`bot:${r.game.players[i].avatar}`))&&
    r.settled===(r.game.phase==='finished')&&Array.isArray(r.deltas)&&r.deltas.length===4&&
    r.deltas.every((n,i)=>n===(r.settled?(i===r.game.winner?r.stake*3:-r.stake):0))
}
export const useDcoinStore=create<State&Actions>()(persist((set,get)=>({
  ...fresh(),
  claim:(phrase,account=humanAccount(0))=>{
    if(phrase.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi')!==COIN_PHRASE.toLocaleLowerCase('vi')||!accountIsHuman(account))return false
    const st=get(),coins=balance(st.balances,account)
    const reserved=st.round&&!st.round.settled&&st.round.accounts.includes(account)?st.round.stake*4:0
    if(coins>Number.MAX_SAFE_INTEGER-INITIAL_COINS-reserved)return false
    set({balances:{...st.balances,[account]:coins+INITIAL_COINS}});return true
  },
  startRound:(settings,stake,next=false)=>{
    const st=get()
    if(st.round&&!st.round.settled)return {game:st.round.game,error:'Ván hiện tại chưa kết thúc. Hãy tiếp tục bàn đang chơi.'}
    if(!validSettings(settings))return {game:null,error:'Cấu hình bàn không hợp lệ.'}
    if(!(BETS as readonly number[]).includes(stake))return {game:null,error:'Mức cược không hợp lệ.'}
    const game=createGame(settings,randomSeed(),next?st.round?.game:undefined)
    const accounts=game.players.map((p,i)=>p.human?humanAccount(i):`bot:${p.avatar}`),balances={...st.balances}
    accounts.forEach((id,i)=>{if(!game.players[i].human&&balance(balances,id)<stake)balances[id]=INITIAL_COINS})
    const short=accounts.findIndex(id=>balance(balances,id)<stake)
    if(short>=0)return {game:null,error:`${game.players[short].name} không đủ d-coin cho mức cược này.`}
    if(accounts.some(id=>balance(balances,id)>Number.MAX_SAFE_INTEGER-stake*3))return {game:null,error:'Ví đã đạt giới hạn d-coin.'}
    for(const id of accounts)balances[id]=balance(balances,id)-stake
    const round:CoinRound={id:`${Date.now().toString(36)}-${randomSeed().toString(36)}`,stake,accounts,game,settled:false,deltas:[0,0,0,0],dealComplete:false}
    const result=settle({balances,round});set(result)
    return {game:result.round!.game,error:null}
  },
  completeDeal:(roundId)=>{
    const round=get().round
    if(!round||round.id!==roundId)return false
    if(round.dealComplete===false)set({round:{...round,dealComplete:true}})
    return true
  },
  cancelRound:(roundId)=>{
    const st=get(),round=st.round
    if(!round||round.id!==roundId||round.settled)return false
    const balances={...st.balances}
    if(round.accounts.some(id=>balances[id]>Number.MAX_SAFE_INTEGER-round.stake))return false
    for(const id of round.accounts)balances[id]+=round.stake
    set({balances,round:null});return true
  },
  play:(roundId,action)=>{
    const st=get(),round=st.round
    if(!round||round.id!==roundId||round.settled)return {game:round?.game??null,error:'Ván bài đã thay đổi hoặc kết thúc.'}
    if(round.dealComplete===false)return {game:round.game,error:'Đang chia bài, vui lòng chờ.'}
    const result=applyAction(round.game,action)
    if(result.error)return {game:round.game,error:result.error}
    const updated=settle({balances:st.balances,round:{...round,game:result.state}})
    set(updated);return {game:result.state,error:null}
  },
}),{name:'landing.dcoin.v1',storage:createJSONStorage(()=>localStorage),
  partialize:({balances,round})=>({balances,round}),
  merge:(saved,current)=>validCoinState(saved)?{...current,...saved}:current,
}))
