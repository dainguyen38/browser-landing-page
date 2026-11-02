import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {build} from 'esbuild'
const root=dirname(dirname(fileURLToPath(import.meta.url))),temp=mkdtempSync(join(root,'.dcoin-tests-')),storage=new Map()
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}
after(()=>{rmSync(temp,{recursive:true,force:true});delete globalThis.localStorage})
const file=join(temp,'store.mjs')
await build({stdin:{contents:"export * from './src/store/dcoin.ts'; export * from './src/lib/tlmn/game.ts'",resolveDir:root},absWorkingDir:root,outfile:file,bundle:true,packages:'external',platform:'node',format:'esm',logLevel:'silent'})
const {useDcoinStore:store,INITIAL_COINS,COIN_PHRASE,humanAccount,validCoinState,defaultSettings,observation,legalMoves,chooseBotAction,nextAction}=await import(pathToFileURL(file))
const reset=()=>store.setState({balances:Object.fromEntries([0,1,2,3].map(i=>[humanAccount(i),INITIAL_COINS])),round:null})
function complete(){store.getState().completeDeal(store.getState().round.id);let guard=0;while(!store.getState().round.settled){
  const round=store.getState().round,game=round.game,view=observation(game,game.currentSeat)
  const action=nextAction(game,game.currentSeat,chooseBotAction(view,legalMoves(view),'normal',()=>.5))
  assert.equal(store.getState().play(round.id,action).error,null);assert.ok(++guard<210)
}return store.getState().round}
test('wallet starts at 1,000,000, grants exact phrase rewards and preserves guest wallets',()=>{
  reset();assert.equal(store.getState().balances[humanAccount(0)],1_000_000)
  assert.equal(store.getState().claim('wrong'),false);assert.equal(store.getState().balances[humanAccount(0)],INITIAL_COINS)
  assert.equal(store.getState().claim(`  ${COIN_PHRASE.normalize('NFD')}  `),true)
  assert.equal(store.getState().balances[humanAccount(0)],2_000_000)
  assert.equal(store.getState().claim(COIN_PHRASE,humanAccount(2)),true)
  assert.equal(store.getState().balances[humanAccount(2)],2_000_000);assert.equal(store.getState().balances[humanAccount(1)],INITIAL_COINS)
  assert.equal(store.getState().claim(COIN_PHRASE,'bot:minh'),false)
  store.setState({balances:{...store.getState().balances,'human:0':Number.MAX_SAFE_INTEGER}})
  assert.equal(store.getState().claim(COIN_PHRASE),false)
})
test('bet reservation, active-round guard, settlement and duplicate actions never duplicate or lose coins',()=>{
  reset();const settings=defaultSettings();settings.rules.instantWinEnabled=false
  const result=store.getState().startRound(settings,10_000);assert.equal(result.error,null)
  let round=store.getState().round
  assert.equal(validCoinState(store.getState()),true)
  for(const account of round.accounts)assert.equal(store.getState().balances[account],990_000)
  const before=JSON.stringify(store.getState()),blocked=store.getState().startRound(settings,50_000)
  assert.ok(blocked.error);assert.equal(JSON.stringify(store.getState()),before)
  store.getState().completeDeal(round.id)
  const game=round.game,view=observation(game,game.currentSeat),action=nextAction(game,game.currentSeat,chooseBotAction(view,legalMoves(view),'normal',()=>.5))
  assert.equal(store.getState().play(round.id,action).error,null)
  const afterFirst=JSON.stringify(store.getState());assert.ok(store.getState().play(round.id,action).error);assert.equal(JSON.stringify(store.getState()),afterFirst)
  round=complete();assert.equal(round.deltas.reduce((a,b)=>a+b),0)
  for(const [seat,account] of round.accounts.entries())assert.equal(store.getState().balances[account],seat===round.game.winner?1_030_000:990_000)
  const final=JSON.stringify(store.getState());assert.equal(store.getState().cancelRound(round.id),false);assert.ok(store.getState().play(round.id,action).error);assert.equal(JSON.stringify(store.getState()),final)
  assert.equal(validCoinState(store.getState()),true)
  const oldId=round.id;store.getState().startRound(settings,10_000,true)
  assert.equal(store.getState().round.game.startingSeat,round.game.winner)
  const newRound=JSON.stringify(store.getState());assert.ok(store.getState().play(oldId,action).error);assert.equal(JSON.stringify(store.getState()),newRound)
})
test('insufficient funds and invalid stakes/configuration leave every wallet unchanged',()=>{
  reset();store.setState({balances:{...store.getState().balances,'human:0':900}})
  const before=JSON.stringify(store.getState())
  assert.ok(store.getState().startRound(defaultSettings(),1000).error)
  assert.ok(store.getState().startRound(defaultSettings(),-1).error)
  assert.ok(store.getState().startRound({...defaultSettings(),humanCount:8},1000).error)
  assert.equal(JSON.stringify(store.getState()),before)
})
test('rehydration restores escrow, private game and final payout without re-crediting any result',async()=>{
  reset();const settings={...defaultSettings(),humanCount:4};settings.rules.instantWinEnabled=false
  store.getState().startRound(settings,50_000)
  const pending=JSON.parse(storage.get('landing.dcoin.v1')),expected=structuredClone(pending.state)
  assert.equal(validCoinState(expected),true)
  reset();storage.set('landing.dcoin.v1',JSON.stringify(pending));await store.persist.rehydrate()
  assert.deepEqual({balances:store.getState().balances,round:store.getState().round},expected)
  const done=complete(),saved=storage.get('landing.dcoin.v1'),balances=structuredClone(store.getState().balances)
  reset();storage.set('landing.dcoin.v1',saved);await store.persist.rehydrate()
  assert.deepEqual(store.getState().balances,balances);assert.equal(store.getState().round.id,done.id)
  assert.equal(store.getState().round.settled,true);assert.equal(validCoinState(store.getState()),true)
  for(const mutate of [s=>s.balances['human:0']=-1,s=>s.round.deltas[0]=1,s=>s.round.accounts[0]=s.round.accounts[1],s=>s.round.game.players[0].avatar='../../secret',s=>s.round.game.currentSeat=9,s=>s.round.stake=99]){
    const bad=structuredClone(JSON.parse(saved).state);mutate(bad);assert.equal(validCoinState(bad),false)
  }
})

test('an instant win reserves all bets and credits the pot once within startRound',async()=>{
  const {createGame}=await import(pathToFileURL(file))
  let seed=0;while(createGame(defaultSettings(),seed).phase!=='finished')seed++
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto')
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues(array){array[0]=seed;return array}}})
  try{
    reset();assert.equal(store.getState().startRound(defaultSettings(),1000).error,null)
    const state=store.getState(),round=state.round
    assert.equal(round.settled,true);assert.ok(round.game.instant)
    for(const [seat,account] of round.accounts.entries())assert.equal(state.balances[account],seat===round.game.winner?1_003_000:999_000)
    assert.equal(validCoinState(state),true)
  }finally{
    if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);else delete globalThis.crypto
  }
})

test('cancel refunds all four seats once during dealing or play and invalidates stale work',()=>{
  for(const afterDeal of [false,true]){
    reset();const settings={...defaultSettings(),humanCount:4};settings.rules.instantWinEnabled=false
    store.getState().startRound(settings,50_000)
    const round=store.getState().round,view=observation(round.game,round.game.currentSeat)
    const action=nextAction(round.game,round.game.currentSeat,chooseBotAction(view,legalMoves(view),'normal',()=>.5))
    if(afterDeal){store.getState().completeDeal(round.id);assert.equal(store.getState().play(round.id,action).error,null)}
    assert.equal(store.getState().claim(COIN_PHRASE),true)
    assert.equal(store.getState().cancelRound('wrong'),false)
    assert.equal(store.getState().cancelRound(round.id),true)
    assert.equal(store.getState().round,null)
    assert.deepEqual(store.getState().balances,{'human:0':2_000_000,'human:1':1_000_000,'human:2':1_000_000,'human:3':1_000_000})
    const refunded=JSON.stringify(store.getState())
    assert.equal(store.getState().cancelRound(round.id),false)
    assert.equal(store.getState().completeDeal(round.id),false)
    assert.ok(store.getState().play(round.id,action).error)
    assert.equal(JSON.stringify(store.getState()),refunded)
    assert.equal(validCoinState(JSON.parse(storage.get('landing.dcoin.v1')).state),true)
  }
})
test('dealing is an enforced barrier, completes idempotently, and restores across reload',async()=>{
  reset();const settings=defaultSettings();settings.rules.instantWinEnabled=false
  store.getState().startRound(settings,10_000)
  let round=store.getState().round;assert.equal(round.dealComplete,false)
  const view=observation(round.game,round.game.currentSeat),action=nextAction(round.game,round.game.currentSeat,chooseBotAction(view,legalMoves(view),'normal',()=>.5))
  const pending=storage.get('landing.dcoin.v1');assert.ok(store.getState().play(round.id,action).error)
  assert.equal(storage.get('landing.dcoin.v1'),pending)
  reset();storage.set('landing.dcoin.v1',pending);await store.persist.rehydrate()
  assert.equal(store.getState().round.dealComplete,false)
  assert.equal(store.getState().completeDeal('stale'),false)
  assert.equal(store.getState().completeDeal(round.id),true)
  const completed=JSON.stringify(store.getState());assert.equal(store.getState().completeDeal(round.id),true);assert.equal(JSON.stringify(store.getState()),completed)
  assert.equal(store.getState().play(round.id,action).error,null)
  const legacy=JSON.parse(pending).state;delete legacy.round.dealComplete
  assert.equal(validCoinState(legacy),true)
})
