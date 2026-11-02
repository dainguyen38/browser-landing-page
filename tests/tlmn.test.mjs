import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync(new URL('../src/lib/tlmn/game.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText
const {rank,suit,cardName,detectCombination:combo,canBeat,combinations,instantWin,unusedSpecials,calculateSettlement,createGame,seededRandom,defaultSettings,DEFAULT_RULES,observation,legalMoves,validateAction,applyAction,chooseBotAction,nextAction,getViewForSeat,validGame,validSettings}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const c=(rank,suit=0)=>rank*4+suit
const seq=(start,len)=>Array.from({length:len},(_,i)=>c(start+i))
const pairs=(start,len)=>Array.from({length:len},(_,i)=>[c(start+i),c(start+i,1)]).flat()
const quad=r=>[0,1,2,3].map(s=>c(r,s))
function fixture(hands,seat=0){const settings=defaultSettings();settings.rules.instantWinEnabled=false;const st=createGame(settings,42);st.mustThree=false;st.currentSeat=seat;st.startingSeat=seat;hands.forEach((h,i)=>{st.players[i].hand=h;st.players[i].played=13-h.length});return st}
const play=(st,seat,cards,id)=>applyAction(st,{...nextAction(st,seat,{type:'play',cards}),...(id?{id}:{})})
const pass=(st,seat)=>applyAction(st,nextAction(st,seat,{type:'pass',cards:[]}))

test('52 unique cards, deterministic Fisher–Yates, human counts 1–4 and 3♠ opening',()=>{
  for(let humanCount=1;humanCount<=4;humanCount++){
    const settings=defaultSettings();settings.humanCount=humanCount;settings.rules.instantWinEnabled=false
    const game=createGame(settings,12345)
    assert.equal(game.players.filter(p=>p.human).length,humanCount)
    assert.ok(game.players.every(p=>p.hand.length===13))
    assert.equal(new Set(game.players.flatMap(p=>p.hand)).size,52)
    assert.ok(game.players[game.currentSeat].hand.includes(0))
    assert.ok(legalMoves(observation(game,game.currentSeat)).every(m=>m.cards.includes(0)))
    const bad=game.players[game.currentSeat].hand.find(v=>v!==0)
    assert.match(play(game,game.currentSeat,[bad]).error,/3♠/)
    assert.deepEqual(createGame(settings,12345),game)
    assert.equal(validGame(game),true)
  }
  assert.equal(cardName(0),'3♠');assert.equal(cardName(51),'2♥');assert.equal(rank(51),12);assert.equal(suit(51),3)
})
test('all seven combinations and every rank/suit tie-break follow the profile',()=>{
  for(const [cards,type] of [[[3],'single'],[[4,7],'pair'],[[8,9,10],'triple'],[seq(1,5),'straight'],[quad(8),'four'],[pairs(1,3),'threePairs'],[pairs(3,4),'fourPairs']])assert.equal(combo(cards).kind,type)
  for(const cards of [[],[0,0],[52],[-1],[.5],[c(9),c(10),c(11),c(12)],[c(11),c(12),c(0)],pairs(8,5),pairs(10,3)])assert.equal(combo(cards),null)
  assert.equal(combo(seq(0,12)).kind,'straight')
  assert.equal(canBeat(combo([51]),combo([47])),true)
  assert.equal(canBeat(combo([48]),combo([51])),false)
  assert.equal(canBeat(combo([24,27]),combo([20,23])),true)
  assert.equal(canBeat(combo([4,7]),combo([0,1,2])),false)
  assert.equal(canBeat(combo(seq(1,4)),combo(seq(0,3))),false)
  assert.equal(canBeat(combo([c(5),c(5,3)]),combo([c(5),c(5,1)])),true)
  assert.equal(canBeat(combo([c(3),c(4),c(5,3)]),combo([c(3),c(4),c(5,1)])),true)
})
test('full cut matrix, same-kind overcuts, and optional quads over pair twos',()=>{
  const single=combo([51]),pair=combo([48,51]),three=combo(pairs(0,3)),four=combo(quad(5)),fourPairs=combo(pairs(0,4))
  for(const [candidate,target,expected] of [[three,single,true],[three,pair,false],[four,single,true],[four,three,true],[four,pair,false],[fourPairs,pair,true],[fourPairs,single,true],[fourPairs,three,true],[fourPairs,four,true],[three,four,false],[four,fourPairs,false]])assert.equal(canBeat(candidate,target),expected)
  assert.equal(canBeat(four,pair,{...DEFAULT_RULES,fourKindCutsPairTwo:true}),true)
  assert.equal(canBeat(combo(pairs(1,3)),three),true)
  assert.equal(canBeat(combo(quad(6)),four),true)
  assert.equal(canBeat(combo(pairs(1,4)),fourPairs),true)
})
test('pass locks a player until reset, leader cannot pass, invalid/duplicate actions are atomic',()=>{
  let st=fixture([[0,4,8],[1,5,9],[2,6,10],[3,7,11]])
  assert.match(pass(st,0).error,/mở vòng/)
  const original=structuredClone(st),missing=play(st,0,[51])
  assert.ok(missing.error);assert.equal(missing.state,st);assert.deepEqual(st,original)
  assert.ok(play(st,0,[0,0]).error)
  st=play(st,0,[0],'unique').state;st=pass(st,1).state;st=play(st,2,[6]).state
  assert.ok(play(st,1,[9]).error);st=pass(st,3).state
  assert.equal(st.currentSeat,0);st=pass(st,0).state
  assert.equal(st.currentSeat,2);assert.equal(st.table,null);assert.deepEqual(st.passed,[])
  assert.match(play(st,2,[10],'unique').error,/xử lý/)
  assert.equal(play(st,2,[10],'unique').state,st)
  assert.equal(pass(st,2).error,'Bạn đang mở vòng, hãy đánh bài.')
})
test('first finisher ends immediately, including last two; no late cut or duplicate settlement',()=>{
  let st=fixture([[51],[...quad(5),4],[8,12],[16,20]])
  st=play(st,0,[51]).state
  assert.equal(st.phase,'finished');assert.equal(st.winner,0);assert.equal(st.ledger.length,0)
  assert.equal(play(st,1,quad(5)).state,st);assert.equal(st.scores.reduce((a,b)=>a+b),0)
  const noTwo=fixture([[51],[4],[8],[12]]);noTwo.settings.rules.allowTwoAsLastCard=false
  assert.match(play(noTwo,0,[51]).error,/về bằng 2/)
})
test('instant wins use ordered priorities, six-pair decomposition and optional colors',()=>{
  for(const [hand,expected] of [[seq(0,12).concat(51),'Sảnh rồng'],[pairs(0,6).concat(51),'6 đôi thông'],[[...quad(0).slice(0,3),...quad(3).slice(0,3),...quad(6).slice(0,3),...quad(9).slice(0,3),51],'4 sám cô'],[[...quad(0),...quad(7),16,24,32,40,51],'2 tứ quý'],[seq(0,12).map(v=>v+1).concat(49),'Sảnh rồng'],[[...pairs(2,5),0,32,48],'5 đôi thông'],[[...quad(12),0,4,8,16,24,28,32,36,40],'Tứ quý 2'],[[...quad(0),...pairs(3,4),51],'6 đôi']])assert.equal(instantWin(hand).name,expected)
  const sameSuit=seq(1,12).concat(0);assert.equal(instantWin(sameSuit).name,'Sảnh rồng')
  const twelveSuit=[...seq(0,11),48,51];assert.equal(instantWin(twelveSuit).name,'12 lá cùng chất')
  assert.equal(instantWin(pairs(0,6).concat(51),{...DEFAULT_RULES,instantWinEnabled:false}),null)
  const color=[0,1,4,5,12,13,20,21,28,29,36,37,44]
  assert.equal(instantWin(color).name,'6 đôi')
  const colorOnly=[0,1,4,8,12,16,20,24,28,32,36,40,49]
  assert.equal(instantWin(colorOnly),null)
  assert.equal(instantWin(colorOnly,{...DEFAULT_RULES,instantWinSameColor13:true}).name,'13 lá cùng màu')
})
test('instant-win ties prioritize condition then clockwise distance from the starter',()=>{
  let tied=false
  const settings=defaultSettings()
  // Seeded deals exercise the production tie-break rather than a separate comparator.
  for(let seed=0;seed<100000&&!tied;seed++){
    const st=createGame(settings,seed)
    const wins=st.players.map((p,seat)=>({seat,win:instantWin(p.hand)})).filter(v=>v.win)
    if(wins.length<2)continue
    const ordered=wins.sort((a,b)=>a.win.priority-b.win.priority||((a.seat-st.startingSeat+4)%4)-((b.seat-st.startingSeat+4)%4))
    assert.equal(st.winner,ordered[0].seat);assert.equal(st.result.reduce((n,r)=>n+r.delta,0),0)
    assert.ok(st.result.filter(r=>r.seat!==st.winner).every(r=>r.loss===13&&r.cong===0&&r.twos===0&&r.specials===0));tied=true
  }
  assert.equal(tied,true)
})
test('unused special sets maximize penalties without overlapping cards',()=>{
  const hand=pairs(0,4),result=unusedSpecials(hand)
  assert.equal(result.points,12);assert.equal(result.sets.length,1);assert.equal(result.sets[0].kind,'fourPairs')
  assert.equal(unusedSpecials([...quad(0),...quad(4),...quad(8)]).points,24)
  const six=unusedSpecials(pairs(0,6)),used=six.sets.flatMap(c=>c.cards)
  assert.equal(new Set(used).size,used.length);assert.equal(six.points,12)
  assert.deepEqual(unusedSpecials(pairs(0,6)),six)
})
test('settlement matches the 38-point example, cong, black/red twos, flags and zero-sum cut ledger',()=>{
  const st=fixture([[],[0,4,8,12,16],[20,24,28],[1,2,5,6,9,10,13,14,17,18,21,25,51]])
  st.players[3].played=0;st.settings.rules.unusedSpecialSetsPenalty=false
  const rows=calculateSettlement(st,0)
  assert.deepEqual(rows.map(r=>r.delta),[38,-5,-3,-30]);assert.equal(rows[3].cong,13);assert.equal(rows[3].twos,4)
  st.ledger=[{from:3,to:1,points:6,reason:'test',turn:1},{from:1,to:2,points:8,reason:'test',turn:2}]
  assert.deepEqual(calculateSettlement(st,0).map(r=>r.delta),[38,-7,5,-36])
  st.settings.rules.congPenaltyEnabled=false;st.settings.rules.unusedTwosPenaltyEnabled=false
  assert.equal(calculateSettlement(st,0)[3].loss,13)
  st.settings.rules.instantWinBonusPerOpponent=2
  assert.deepEqual(calculateSettlement({...st,ledger:[]},0,true).map(r=>r.delta),[45,-15,-15,-15])
})
test('cut chains create independent two-party transfers, never multiply or reapply',()=>{
  let st=fixture([[48,0],[...quad(4),4],[...pairs(5,4),8],[12,16]])
  st=play(st,0,[48]).state;st=play(st,1,quad(4)).state
  assert.equal(st.ledger[0].points,3);assert.equal(st.ledger[0].from,0);assert.equal(st.ledger[0].to,1)
  st=play(st,2,pairs(5,4)).state
  assert.deepEqual(st.ledger.map(l=>l.points),[3,8]);assert.equal(st.ledger[1].from,1)
  const before=structuredClone(st)
  const duplicate={...nextAction(st,3,{type:'pass',cards:[]}),id:st.history[0].id}
  assert.ok(applyAction(st,duplicate).error);assert.deepEqual(st,before)
})
test('safe bot observation and seat views contain no other hands; suggestions are legal',()=>{
  const settings=defaultSettings();settings.rules.instantWinEnabled=false
  const st=createGame(settings,4),seat=st.currentSeat,view=observation(st,seat),moves=legalMoves(view)
  assert.equal('players' in view,false);assert.equal('hands' in view,false);assert.deepEqual(view.hand,st.players[seat].hand)
  view.hand.pop();assert.equal(st.players[seat].hand.length,13)
  for(const difficulty of ['easy','normal']){
    const observed=observation(st,seat),action=chooseBotAction(observed,legalMoves(observed),difficulty,()=>.5)
    assert.equal(validateAction(st,nextAction(st,seat,action)),null)
  }
  const hidden=getViewForSeat(st,null);assert.ok(hidden.players.every(p=>p.hand.length===0))
  const visible=getViewForSeat(st,seat);assert.deepEqual(visible.players[seat].hand,st.players[seat].hand)
  assert.ok(visible.players.filter((_,i)=>i!==seat).every(p=>p.hand.length===0))
  const blocked=fixture([[0],[4],[8],[12]],1);blocked.table=combo([51]);blocked.lastPlaySeat=0
  const obs=observation(blocked,1);assert.deepEqual(chooseBotAction(obs,legalMoves(obs),'normal'),{type:'pass',cards:[]})
})
test('20 consecutive games per difficulty and human count finish legally, preserve seats and zero-sum scores',()=>{
  for(const difficulty of ['easy','normal'])for(const humanCount of [1,2,4]){
    const settings={...defaultSettings(),humanCount,difficulty};let previous
    const random=seededRandom(92)
    for(let index=1;index<=20;index++){
      let st=createGame(settings,index*37,previous)
      assert.equal(st.gameIndex,index);if(previous)assert.equal(st.startingSeat,previous.winner)
      assert.equal(validGame(st),true)
      let turns=0
      while(st.phase==='playing'){
        const view=observation(st,st.currentSeat),action=nextAction(st,st.currentSeat,chooseBotAction(view,legalMoves(view),difficulty,random))
        const before=structuredClone(st),result=applyAction(st,action)
        assert.equal(result.error,null);assert.deepEqual(st,before);st=result.state
        assert.equal(validGame(st),true,`invalid state: game ${index}, turn ${turns}`)
        assert.ok(++turns<=208,'no stuck trick or endless bot loop')
      }
      assert.equal(st.scores.reduce((a,b)=>a+b),0);assert.equal(st.result.reduce((n,r)=>n+r.delta,0),0)
      previous=st
    }
  }
})
test('persisted configuration and game reject corrupted hands, turns, scores and settings',()=>{
  const settings=defaultSettings();settings.rules.instantWinEnabled=false
  assert.equal(validSettings(settings),true)
  const st=createGame(settings,4);assert.equal(validGame(st),true)
  for(const mutate of [g=>g.players[1].hand[0]=g.players[0].hand[0],g=>g.currentSeat=4,g=>g.scores[0]=1,g=>g.settings.humanCount=0,g=>g.settings.rules.instantWinEnabled='yes',g=>g.players[0].played=1,g=>g.history=[{id:'bad'}],g=>g.passed=[g.currentSeat],g=>g.table={cards:[52]},g=>g.ledger=[{from:0,to:0,points:8}]]){
    const bad=structuredClone(st);mutate(bad);assert.equal(validGame(bad),false)
  }
})

test('assisted selection completes only a unique legal response and leaves choices/deselection manual',async()=>{
  const {assistedSelection}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const current=combo(seq(2,4)),hand=seq(5,4),st=fixture([hand,[0],[4],[8]])
  st.table=current;st.lastPlaySeat=3
  const moves=legalMoves(observation(st,0))
  assert.equal(moves.length,1)
  assert.deepEqual(assistedSelection(moves,[],hand[0],true),hand)
  assert.deepEqual(assistedSelection(moves,[],hand[0],false),[hand[0]])
  assert.deepEqual(assistedSelection(moves,hand,hand[0],true),hand.slice(1))
  const choices=[combo(seq(5,4)),combo([...seq(5,3),c(8,1)])]
  assert.deepEqual(assistedSelection(choices,[],c(5),true),[c(5)])
  assert.deepEqual(assistedSelection(choices,[c(5)],c(8),true),seq(5,4))
  assert.deepEqual(assistedSelection([],[],c(5),true),[c(5)])
})
test('timeouts pass a response but play the smallest legal opening, including compulsory 3♠',async()=>{
  const {timeoutAction}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const settings=defaultSettings();settings.rules.instantWinEnabled=false
  const st=createGame(settings,36),opening=timeoutAction(st)
  assert.deepEqual(opening.cards,[0]);assert.equal(validateAction(st,opening),null)
  const next=applyAction(st,opening).state,skip=timeoutAction(next)
  assert.equal(skip.type,'pass');assert.equal(validateAction(next,skip),null)
  const reset=fixture([[4,8],[12],[16],[20]])
  assert.deepEqual(timeoutAction(reset).cards,[4])
})
test('bot usernames and unique local portrait choices are randomized once and preserved between games',async()=>{
  const {BOT_PROFILES,avatarPath}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  const a=createGame(defaultSettings(),18),b=createGame(defaultSettings(),91)
  assert.equal(new Set(a.players.map(p=>p.avatar)).size,4)
  assert.notDeepEqual(a.players.map(p=>p.avatar),b.players.map(p=>p.avatar))
  for(const player of a.players){
    assert.ok(BOT_PROFILES.some(([id])=>id===player.avatar))
    if(!player.human)assert.ok(!player.name.startsWith('Bot '))
    assert.ok(readFileSync(new URL(`../public${avatarPath(player.avatar)}`,import.meta.url)).length>1000)
  }
  a.winner=0;const next=createGame(a.settings,71,a)
  assert.deepEqual(next.players.map(p=>[p.name,p.avatar]),a.players.map(p=>[p.name,p.avatar]))
})
