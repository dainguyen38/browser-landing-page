import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Crown, Coins, Layers, Play, Settings2, Shuffle, Sparkles, Users, Volume2, VolumeX, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createCardAudio } from '@/lib/tlmn/audio'
import { botThinkDelay, dealProgress, DEAL_DURATION_MS, DEAL_STEP_MS, seatPosition } from '@/lib/tlmn/presentation'
import { useGameRef, useGameSession, useGameState } from './GameSession'
import { assistedSelection, avatarPath, BOT_PROFILES, TURN_SECONDS, timeoutAction, cardName, chooseBotAction, defaultSettings, detectCombination, getViewForSeat, KIND_NAMES, legalMoves, nextAction, observation, rank, RANKS, SUITS, suit, validateAction, validSettings, type Card, type Game, type Rules, type Settings } from '@/lib/tlmn/game'

import { BETS, formatCoins, humanAccount, useDcoinStore } from '@/store/dcoin'
import { DcoinWallet } from './DcoinWallet'

const CONFIG_KEY='landing.tlmn.settings.v1'
function loadSettings():Settings {
  try {const saved=JSON.parse(localStorage.getItem(CONFIG_KEY)??'null');if(validSettings(saved))return saved}catch{}
  return defaultSettings()
}
const RULE_OPTIONS:[keyof Omit<Rules,'instantWinBonusPerOpponent'>,string][]=[
  ['fourKindCutsPairTwo','Tứ quý chặt đôi 2'],['instantWinEnabled','Bật tới trắng'],
  ['congPenaltyEnabled','Ghi nhận cóng'],['unusedTwosPenaltyEnabled','Ghi nhận thối 2'],['unusedSpecialSetsPenalty','Ghi nhận thối hàng'],
  ['instantWinSameColor12','Tới trắng: 12 lá cùng màu'],['instantWinSameColor13','Tới trắng: 13 lá cùng màu'],
]
function CardFace({card}:{card:Card}) {
  return <><span className="tl-card-corner">{RANKS[rank(card)]}<small>{SUITS[suit(card)]}</small></span><span className="tl-card-pip" aria-hidden="true">{SUITS[suit(card)]}</span><span className="tl-card-bottom" aria-hidden="true">{RANKS[rank(card)]}{SUITS[suit(card)]}</span></>
}
export function TienLenPayouts({players,winner,pot}:{players:Game['players'];winner:number;pot:number}) {
  return <ul className="tl-payouts" aria-label="Tiền nhận về từng người">{players.map((player,seat)=><li key={seat} className={seat===winner?'winner':''}><img src={avatarPath(player.avatar)} alt=""/><span>{player.name}</span><strong>{formatCoins(seat===winner?pot:0)} <small>d</small></strong></li>)}</ul>
}
export function TienLenGame() {
  const session=useGameSession()
  const [settings,setSettings]=useGameState<Settings>('settings',loadSettings)
  const coinRound=useDcoinStore(s=>s.round),balances=useDcoinStore(s=>s.balances)
  const [anchorSeat,setAnchorSeat]=useGameState('anchorSeat',0)
  const [muted,setMuted]=useGameState('muted',false)
  const audio=useRef<ReturnType<typeof createCardAudio>|null>(null)
  const dealClock=useGameRef('dealClock',()=>({roundId:'',elapsed:0}))
  const [dealElapsed,setDealElapsed]=useState(dealClock.current.elapsed)
  const isDealing=coinRound?.dealComplete===false
  const deal=dealProgress(dealClock.current.roundId===coinRound?.id?dealElapsed:0,coinRound?.game.startingSeat??0)
  const [stake,setStake]=useGameState<number>('stake',10_000)
  const [game,setGame]=useGameState<Game|null>('match',()=>coinRound?.game??null)
  const [screen,setScreen]=useGameState<'home'|'setup'|'table'|'rules'>('screen',()=>coinRound&&!coinRound.settled?'table':'home')
  const [viewer,setViewer]=useState<number|null>(null),[selected,setSelected]=useState<Card[]>([]),[error,setError]=useState('')
  const [returnTo,setReturnTo]=useState<'home'|'table'>('home')
  const felt=useRef<HTMLElement>(null)
  const clock=useGameRef('turnClock',()=>({key:'',remaining:TURN_SECONDS*1000}))
  const [seconds,setSeconds]=useState(TURN_SECONDS)
  const multi=!!game&&game.settings.humanCount>1
  const visibleSeat=!isDealing&&game?.phase==='playing'?(multi?(viewer===game.currentSeat&&game.players[game.currentSeat].human?viewer:null):0):null
  const view=game?getViewForSeat(game,visibleSeat):null
  const humanTurn=!!game&&game.phase==='playing'&&game.players[game.currentSeat].human
  const handoff=!isDealing&&screen==='table'&&humanTurn&&multi&&visibleSeat===null
  const canPlay=!isDealing&&humanTurn&&visibleSeat===game?.currentSeat&&!session.paused&&session.visible
  const moves=useMemo(()=>game&&canPlay?legalMoves(observation(game,game.currentSeat)):[],[game,canPlay])
  const selection=detectCombination(selected)
  const selectionError=game&&selected.length?validateAction(game,nextAction(game,game.currentSeat,{type:'play',cards:selected})):null
  function act(type:'play'|'pass',cards:Card[]) {
    if(!game||!canPlay)return
    commit(nextAction(game,game.currentSeat,{type,cards}))
  }
  function commit(action:ReturnType<typeof nextAction>) {
    const round=useDcoinStore.getState().round
    if(round&&round.id!==coinRound?.id)return
    if(!round){setError('Hãy đặt cược và chia bài để bắt đầu.');return}
    const result=useDcoinStore.getState().play(round.id,action)
    if(result.error){setError(result.error);if(result.game)setGame(result.game);return}
    setSelected([]);setError('');if(multi)setViewer(null);setGame(result.game)
  }
  useEffect(()=>{
    if(coinRound&&coinRound.game!==game){setGame(coinRound.game);setSelected([]);setViewer(null)}
  },[coinRound,setGame])
  useEffect(()=>{
    if(!game||game.phase!=='playing'||game.players[game.currentSeat].human||isDealing||session.paused||!session.visible)return
    const pauseVersion=session.pauseVersion
    const timer=setTimeout(()=>{
      if(session.paused||!session.visible||session.pauseVersion!==pauseVersion)return
      session.guard(()=>{
        const publicView=observation(game,game.currentSeat),move=chooseBotAction(publicView,legalMoves(publicView),game.settings.difficulty)
        commit(nextAction(game,game.currentSeat,move))
      })
    },botThinkDelay())
    return()=>clearTimeout(timer)
  },[game,isDealing,session,session.paused,session.visible])
  useEffect(()=>{
    if(!game||game.phase!=='playing'||isDealing)return
    const key=`${coinRound?.id??'legacy'}:${game.gameIndex}:${game.turnNumber}:${TURN_SECONDS}`
    if(clock.current.key!==key)clock.current={key,remaining:TURN_SECONDS*1000}
    setSeconds(Math.ceil(clock.current.remaining/1000))
    if(session.paused||!session.visible)return
    let last=performance.now()
    const pauseVersion=session.pauseVersion
    const timer=setInterval(()=>{
      const now=performance.now(),elapsed=now-last;last=now
      if(session.paused||!session.visible||session.pauseVersion!==pauseVersion)return
      clock.current.remaining=Math.max(0,clock.current.remaining-elapsed)
      setSeconds(Math.ceil(clock.current.remaining/1000))
      if(clock.current.remaining<=0){clearInterval(timer);commit(timeoutAction(game))}
    },100)
    return()=>clearInterval(timer)
  },[game,isDealing,coinRound?.id,session,session.paused,session.visible,clock])
  useEffect(()=>{
    const instance=createCardAudio();audio.current=instance
    return()=>{instance.dispose();if(audio.current===instance)audio.current=null}
  },[])
  useEffect(()=>{audio.current?.setMuted(muted);audio.current?.setPaused(session.paused||!session.visible)},[muted,session.paused,session.visible])
  useEffect(()=>{
    if(!isDealing||!coinRound)return
    const id=coinRound.id
    if(dealClock.current.roundId!==id)dealClock.current={roundId:id,elapsed:0}
    setDealElapsed(dealClock.current.elapsed)
    if(screen!=='table'||session.paused||!session.visible)return
    let last=performance.now(),launched=dealClock.current.elapsed===0?0:Math.min(52,Math.floor(dealClock.current.elapsed/DEAL_STEP_MS)+1)
    const pauseVersion=session.pauseVersion
    const timer=setInterval(()=>{
      const now=performance.now(),elapsed=Math.min(80,now-last);last=now
      if(session.paused||!session.visible||session.pauseVersion!==pauseVersion||document.hidden||useDcoinStore.getState().round?.id!==id)return
      dealClock.current.elapsed=Math.min(DEAL_DURATION_MS,dealClock.current.elapsed+elapsed)
      const nextLaunched=Math.min(52,Math.floor(dealClock.current.elapsed/DEAL_STEP_MS)+1)
      for(let i=Math.max(launched,nextLaunched-2);i<nextLaunched;i++)audio.current?.deal(i)
      launched=nextLaunched;setDealElapsed(dealClock.current.elapsed)
      if(dealClock.current.elapsed>=DEAL_DURATION_MS){clearInterval(timer);useDcoinStore.getState().completeDeal(id)}
    },32)
    return()=>clearInterval(timer)
  },[isDealing,coinRound?.id,screen,session,session.paused,session.visible,dealClock])
  useEffect(()=>{
    const node=felt.current
    if(!node||typeof ResizeObserver==='undefined')return
    const observer=new ResizeObserver(()=>{
      const rect=node.getBoundingClientRect()
      node.style.setProperty('--tl-flight-x',`${rect.width*.42}px`)
      node.style.setProperty('--tl-flight-y',`${rect.height*.35}px`)
    })
    observer.observe(node);return()=>observer.disconnect()
  },[screen,game?.phase])
  function start(next=false) {
    if(session.paused)return
    audio.current?.unlock()
    const config=next&&game?game.settings:settings
    const result=useDcoinStore.getState().startRound(config,next&&coinRound?coinRound.stake:stake,next)
    if(result.error){setError(result.error);if(result.game){setGame(result.game);setScreen('table')}return}
    try{localStorage.setItem(CONFIG_KEY,JSON.stringify(config))}catch{}
    dealClock.current={roundId:useDcoinStore.getState().round!.id,elapsed:0};setDealElapsed(0);setAnchorSeat(0)
    setGame(result.game);setSelected([]);setError('');setViewer(null);setScreen('table')
  }
  function cancel() {
    const round=useDcoinStore.getState().round
    if(!round||round.id!==coinRound?.id||!useDcoinStore.getState().cancelRound(round.id)){setError('Ván đã kết thúc, không thể hủy.');return}
    setGame(null);setSelected([]);setViewer(null);setAnchorSeat(0);setError('');setScreen('home')
    dealClock.current={roundId:'',elapsed:0};clock.current={key:'',remaining:TURN_SECONDS*1000};setDealElapsed(0)
  }
  function goHome(){setViewer(null);setSelected([]);setError('');setScreen('home')}
  function rules(){setReturnTo(screen==='table'?'table':'home');setViewer(null);setSelected([]);setScreen('rules')}
  function hint(){
    if(!game||!canPlay)return
    const move=chooseBotAction(observation(game,game.currentSeat),moves,'normal',()=>.5)
    setSelected(move.cards);setError(move.type==='pass'?'Không có bộ chặn hợp lệ. Bạn có thể bỏ lượt.':'')
  }
  const players=game?.players??[]
  const lastPlay=game?.history.slice().reverse().find(h=>h.type==='play')
  const pot=coinRound?coinRound.stake*4:0
  const hasHand=game?.phase==='playing'||isDealing
  function playerPanel(seat:number,inHand=false) {
    if(!game)return null
    const player=players[seat],position=seatPosition(seat,anchorSeat),count=isDealing?deal.counts[seat]:player.hand.length
    return <div key={seat} data-seat={seat} className={`tl-player ${inHand?'tl-hand-player':`tl-seat-${position}`} ${game.currentSeat===seat&&game.phase==='playing'&&!isDealing?'is-turn':''} ${game.passed.includes(seat)?'has-passed':''} ${seconds<=5&&game.currentSeat===seat&&!isDealing?'is-urgent':''}`}>
      <span className="tl-avatar" style={{'--turn-progress':`${seconds/TURN_SECONDS*100}%`} as CSSProperties}><img src={avatarPath(player.avatar)} alt={`Avatar ${player.name}`}/>{game.winner===seat&&!isDealing&&<Crown size={16}/>}</span>
      <div className="tl-player-info"><strong>{player.name}</strong><small>{player.human?'NGƯỜI CHƠI':'BOT'}{game.passed.includes(seat)?' · Bỏ lượt':''}</small><span className="tl-player-coins">{formatCoins(coinRound?balances[coinRound.accounts[seat]]??0:0)} d</span></div>
      {!inHand&&<div className="tl-card-count" aria-label={`${player.name} còn ${count} lá`}><span className="tl-mini-fan" aria-hidden="true">{Array.from({length:Math.min(5,count)},(_,n)=><i key={n} style={{'--fan-index':n} as CSSProperties}/>)}</span><b>{count}</b></div>}
    </div>
  }
  return <div className="tl-game" onPointerDownCapture={()=>audio.current?.unlock()}>
    <header className="tl-header"><button type="button" className="tl-brand" onClick={goHome} aria-label="Về trang chủ Tiến lên"><span>♠</span><div><strong>TIẾN LÊN</strong><small>MIỀN NAM · OFFLINE</small></div></button><div className="tl-header-actions"><div className="tl-wallet-chip"><Coins size={15}/>{formatCoins(balances[humanAccount(0)]??0)}<small>d</small></div><button type="button" className="tl-sound-button" onClick={()=>setMuted(!muted)} aria-label={muted?"Bật âm thanh":"Tắt âm thanh"}>{muted?<VolumeX size={16}/>:<Volume2 size={16}/>}</button>{coinRound&&!coinRound.settled&&<button type="button" className="tl-cancel" onClick={cancel} title="Hủy ván offline và hoàn lại cược" aria-label="Hủy ván và hoàn lại cược"><X size={15}/><span>Hủy ván</span></button>}{game&&screen==='table'&&<span>VÁN {game.gameIndex.toString().padStart(2,'0')}</span>}<button type="button" onClick={rules} aria-label="Luật chơi"><CircleHelp size={18}/></button></div></header>
    {screen==='home'&&<main className="tl-home">
      <div className="tl-hero-art" aria-hidden="true">{[0,49,50,51].map((card,i)=><div key={card} className={`tl-card ${suit(card)>1?'red':''}`} style={{'--tilt':`${(i-1.5)*14}deg`,'--i':i} as CSSProperties}><CardFace card={card}/></div>)}</div>
      <div className="tl-eyebrow">MỘT BÀN BÀI. BỐN CHỖ NGỒI.</div><h1>Đến lượt<br/><em>bạn ra bài.</em></h1><p>Chơi cùng bot hoặc chuyền máy cho bạn bè.<br/>Đặt cược d-coin, cùng vui mỗi ván.</p>
      <div className="tl-home-buttons"><button type="button" className="tl-primary" onClick={()=>setScreen('setup')}><Play size={18}/>Chơi mới<ArrowRight size={18}/></button>{game&&<button type="button" className="tl-secondary" onClick={()=>{setViewer(null);setScreen('table')}}>Tiếp tục ván {game.gameIndex}<ChevronRight size={18}/></button>}<div className="tl-home-links"><button type="button" className="tl-text-button" onClick={()=>setScreen('setup')}><Settings2 size={15}/>Cài đặt bàn</button><button type="button" className="tl-text-button" onClick={rules}>Luật chơi</button></div></div>
      <DcoinWallet/><div className="tl-home-meta"><span><Users size={15}/>1–4 người chung máy</span><span><Layers size={15}/>52 lá · 4 ghế</span></div>
    </main>}
    {screen==='setup'&&<main className="tl-setup"><div className="tl-setup-title"><div><div className="tl-eyebrow">CHUẨN BỊ BÀN</div><h2>Mời bạn ngồi.</h2></div><button type="button" className="tl-icon-button" onClick={goHome} aria-label="Quay lại"><ArrowLeft/></button></div>
      <div className="tl-setup-columns"><section><h3>Người chơi cùng máy</h3><div className="tl-segment">{[1,2,3,4].map(n=><button type="button" key={n} aria-pressed={settings.humanCount===n} onClick={()=>setSettings({...settings,humanCount:n})}>{n} người</button>)}</div><p className="tl-muted">{settings.humanCount} người thật + {4-settings.humanCount} bot · Luôn chia đủ 4 ghế</p>
        <div className="tl-name-list">{[0,1,2,3].map(i=><label key={i}><span className="tl-seat-number">0{i+1}</span>{i<settings.humanCount?<input aria-label={`Tên người chơi ${i+1}`} maxLength={24} value={settings.names[i]} onChange={e=>setSettings({...settings,names:settings.names.map((n,j)=>j===i?e.target.value:n)})}/>:<span className="tl-bot-name">{BOT_PROFILES[i][1]}<small>Bot · Ghép ngẫu nhiên</small></span>}<span className="tl-name-type">{i<settings.humanCount?'NGƯỜI':'BOT'}</span></label>)}</div>
        <h3>Độ khó bot</h3><div className="tl-segment">{(['easy','normal'] as const).map(level=><button type="button" key={level} aria-pressed={settings.difficulty===level} onClick={()=>setSettings({...settings,difficulty:level})}>{level==='easy'?'Cơ bản':'Trung bình'}</button>)}</div>
        {settings.humanCount>1&&<p className="tl-muted">Bài được che khi đổi lượt. Người nhận máy bấm sẵn sàng để xem bài.</p>}
      </section><section className="tl-rule-settings"><h3><Settings2 size={16}/>Luật bàn <span>V1</span></h3>{RULE_OPTIONS.map(([key,label])=><label key={key}><span>{label}</span><input type="checkbox" checked={settings.rules[key]} onChange={e=>setSettings({...settings,rules:{...settings.rules,[key]:e.target.checked}})}/></label>)}<p className="tl-muted">Cho về bằng 2. Chặt đúng lượt. Đã bỏ lượt phải chờ vòng mới. Không đền làng.</p></section></div>
      <section className="tl-bet-settings"><h3><Coins size={16}/>Mức cược mỗi ghế</h3><div className="tl-segment">{BETS.map(bet=><button type="button" key={bet} aria-pressed={stake===bet} onClick={()=>setStake(bet)}>{formatCoins(bet)} d</button>)}</div><p className="tl-muted">Trừ cược khi chia bài. Người thắng nhận cả bàn: <b>{formatCoins(stake*4)} d-coin</b>. Ví khách tách riêng cho từng người chơi cùng máy.</p></section>
      {error&&<p className="tl-wallet-error" role="alert">{error}</p>}<button type="button" className="tl-primary" onClick={()=>start()}><Shuffle size={18}/>Chia bài<ArrowRight size={18}/></button>
    </main>}
    {screen==='rules'&&<main className="tl-rules"><button type="button" className="tl-text-button" onClick={()=>setScreen(returnTo)}><ArrowLeft size={16}/>Quay lại</button><div className="tl-eyebrow">TLMN_OFFLINE_V1</div><h2>Luật của bàn này</h2>
      <p>4 ghế × 13 lá. Thứ tự: 3 → 4 → … → A → 2; chất: ♠ → ♣ → ♦ → ♥. Ván đầu mở bằng bộ có 3♠; ván sau người thắng mở.</p>
      <h3>Đánh & bỏ lượt</h3><p>Đánh lẻ, đôi, sám, sảnh từ 3 lá, tứ quý, 3 hoặc 4 đôi thông. Sảnh và đôi thông không chứa 2. Chặn bằng bộ cùng loại, cùng số lá và mạnh hơn. Khi đã bỏ lượt, bạn chờ đến vòng mới. Tất cả đối thủ bỏ lượt thì người đánh cuối được mở vòng. Hết bài đầu tiên là thắng ngay.</p>
      <h3>Chặt đúng lượt</h3><ul><li>3 đôi thông → một lá 2 hoặc 3 đôi thông nhỏ hơn.</li><li>Tứ quý → một lá 2, 3 đôi thông hoặc tứ quý nhỏ hơn.</li><li>4 đôi thông → một/đôi 2, 3 đôi thông, tứ quý hoặc 4 đôi thông nhỏ hơn.</li></ul>
      <h3>Tới trắng (ưu tiên từ trên xuống)</h3><p>Sảnh rồng 3–A → 6 đôi thông → 4 sám cô → 2 tứ quý → 12 lá cùng chất → 5 đôi thông → tứ quý 2 → 6 đôi (tứ quý tính 2 đôi). Nếu cùng mức, ưu tiên ghế gần người mở ván theo chiều lượt. Biến thể cùng màu nếu bật được xét sau các loại trên, 13 lá trước 12 lá.</p>
      <h3>Cược d-coin</h3><p>Mỗi ghế đặt cùng mức cược trước khi chia bài. Người đầu hết bài hoặc tới trắng nhận toàn bộ 4 phần cược. Kết quả được thanh toán một lần vào ví, không dùng điểm xếp hạng. Cóng, thối và các lần chặt vẫn được ghi nhận theo luật bàn nhưng không trừ thêm coin ngoài mức cược.</p><p>Mỗi lượt có {TURN_SECONDS} giây, tính cả thời gian bàn giao máy. Hết giờ tự bỏ lượt; nếu đang mở vòng thì tự đánh lá hợp lệ nhỏ nhất. Đồng hồ dừng khi pause hoặc đóng popup.</p>
      <h3>Biến thể đang dùng</h3><div className="tl-active-rules">{RULE_OPTIONS.map(([key,label])=><span key={key} className={(game&&returnTo==='table'?game.settings:settings).rules[key]?'on':''}>{(game&&returnTo==='table'?game.settings:settings).rules[key]?'✓':'–'} {label}</span>)}</div><p className="tl-muted">D-coin là coin ảo trên máy, không có giá trị quy đổi tiền thật. Bài và bot xử lý trên máy, không cần tài khoản. Khi chơi chung máy, tránh nhìn bài của người khác.</p>
    </main>}
    {screen==='table'&&game&&view&&<main className="tl-table-layout">
      <section ref={felt} className={`tl-felt ${hasHand?'has-hand':''} ${game.table&&game.table.cards.length>6?'has-long-play':''}`} aria-label="Bàn Tiến lên bốn người">
        <div className="tl-table-watermark" aria-hidden="true">♠<span>TIẾN LÊN MIỀN NAM</span></div>
        <div className="tl-table-pot"><Coins size={15}/><span>TỔNG CƯỢC</span><b>{formatCoins(pot)} d</b></div>
        <div className="tl-opponents">{players.map((_,seat)=>hasHand&&seat===anchorSeat?null:playerPanel(seat))}</div>
        {isDealing&&<div className="tl-deal-flights" aria-hidden="true">{deal.flights.map(flight=>{
          const position=seatPosition(flight.seat,anchorSeat),progress=1-(1-flight.progress)**2
          return <span key={flight.index} className={`tl-deal-card tl-deal-to-${position}`} style={{'--deal-progress':progress,'--deal-rotation':`${(position%2?-1:1)*progress*18}deg`,'--deal-scale':1-progress*.24} as CSSProperties}/>
        })}</div>}
        <div className="tl-center">
          {isDealing?<div className="tl-dealing-center" role="status"><div className="tl-deck"><i/><i/><i/></div><strong>Đang chia bài</strong><span>{deal.counts.reduce((n,count)=>n+count,0)} / 52 lá</span></div>:<>
          {game.phase==='playing'&&<div className={`tl-turn-clock ${seconds<=5?'is-urgent':''}`} role="timer" aria-label={`${players[game.currentSeat].name}: còn ${seconds} giây`}><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20"/><circle cx="24" cy="24" r="20" pathLength="100" strokeDasharray="100" strokeDashoffset={100-seconds/TURN_SECONDS*100}/></svg><strong>{seconds}</strong><span>GIÂY</span></div>}
          <div className="tl-turn-label"><span/>{game.phase==='finished'?'VÁN ĐÃ KẾT THÚC':`${players[game.currentSeat].name} ${humanTurn?'đến lượt':'đang nghĩ…'}`}</div>
          {game.table?<><div key={lastPlay?.id} data-origin={seatPosition(game.lastPlaySeat!,anchorSeat)} className="tl-played-cards tl-dealt" style={{'--card-count':game.table.cards.length} as CSSProperties}>{game.table.cards.map(c=><div key={c} className={`tl-card ${suit(c)>1?'red':''}`} aria-label={cardName(c)}><CardFace card={c}/></div>)}</div><div className="tl-table-caption">{players[game.lastPlaySeat!].name} · {KIND_NAMES[game.table.kind]}</div></>:<div className="tl-empty-table"><Layers size={32}/><strong>{game.mustThree?'Mở ván bằng 3♠':'Vòng mới'}</strong><span>{game.mustThree?'Bộ đầu tiên phải chứa 3♠':'Người có lượt được đánh bộ bất kỳ'}</span></div>}
          </>}
        </div>
        <div className="tl-history" aria-label="Lịch sử công khai">{game.history.slice(-3).map(h=><div key={h.id}><b>{players[h.seat].name}</b><span>{h.type==='pass'?'Bỏ lượt':`${h.newTrick?'Mở · ':''}${h.cards.map(cardName).join(' ')}`}</span></div>)}</div>
      </section>
      {hasHand&&<section className="tl-hand-area" aria-label="Bài trên tay">
        <div className="tl-hand-main">{playerPanel(anchorSeat,true)}<div className="tl-hand-content"><div className="tl-hand-heading"><span>{isDealing?`${deal.counts[anchorSeat]} / 13 LÁ`:visibleSeat!==null?`${view.players[visibleSeat].count} LÁ · CHỌN ĐỂ ĐÁNH`:humanTurn?'CHUYỀN MÁY':'CHỜ BOT'}</span></div>
        {visibleSeat!==null?<div className="tl-hand-scroll"><div className="tl-hand is-revealed" style={{'--card-count':view.players[visibleSeat].hand.length} as CSSProperties}>{view.players[visibleSeat].hand.map((c,index)=><button key={c} type="button" disabled={!canPlay} aria-label={cardName(c)} aria-pressed={selected.includes(c)} style={{'--hand-index':index} as CSSProperties} className={`tl-card ${suit(c)>1?'red':''} ${selected.includes(c)?'selected':''}`} onClick={()=>{setError('');setSelected(current=>assistedSelection(moves,current,c,!!game.table))}}><CardFace card={c}/></button>)}</div></div>:<div className="tl-hidden-hand" aria-label="Bài úp">{Array.from({length:isDealing?deal.counts[anchorSeat]:Math.min(13,players[anchorSeat].hand.length)},(_,i)=><span key={i}/>)}</div>}
        </div></div>
        <div className="tl-hand-status" role="status">{isDealing?'Đang chia bài · Ván bắt đầu sau khi chia xong.':error||selectionError||(selection?`${KIND_NAMES[selection.kind]} · ${selected.length} lá`:canPlay?'Chọn bài của bạn hoặc nhấn Gợi ý.':humanTurn?'Sẵn sàng rồi hãy mở bài.':'Bot sẽ tự động ra bài.')}</div>
        <div className="tl-actions"><button type="button" className="tl-secondary" disabled={!canPlay} onClick={hint}><Sparkles size={16}/>Gợi ý</button><button type="button" className="tl-text-button" disabled={!canPlay||!selected.length} onClick={()=>{setSelected([]);setError('')}}>Bỏ chọn</button><span/><button type="button" className="tl-secondary" disabled={!canPlay||!game.table} onClick={()=>act('pass',[])}>Bỏ lượt</button><button type="button" className="tl-primary" disabled={!canPlay||!selected.length||!!selectionError} onClick={()=>act('play',selected)}>Đánh{selected.length>0&&<b>{selected.length}</b>}<ArrowRight size={16}/></button></div>
      </section>}
      {handoff&&<div className="tl-handoff" role="dialog" aria-modal="true" aria-label="Chuyển người chơi"><div><div className="tl-handoff-icon"><Users size={32}/></div><div className="tl-eyebrow">CHUYỀN MÁY</div><h2>Đưa máy cho<br/><em>{players[game.currentSeat].name}</em></h2><p>Bài đang được che. Chỉ mở khi bạn đã nhận máy.</p><div className={`tl-handoff-clock ${seconds<=5?"is-urgent":""}`} role="timer">Còn <strong>{seconds}s</strong> để nhận lượt</div><button type="button" className="tl-primary" onClick={()=>{setSelected([]);setError('');setAnchorSeat(game.currentSeat);setViewer(game.currentSeat)}}><Check size={18}/>Tôi đã sẵn sàng</button></div></div>}
    </main>}
    <Dialog open={screen==='table'&&game?.phase==='finished'&&!isDealing&&!session.paused&&session.visible} onOpenChange={open=>{if(!open)goHome()}}>
      <DialogContent className="tl-result-dialog" onEscapeKeyDown={event=>{event.preventDefault();session.setPaused(true)}}>
        <div className="tl-result-medal"><Crown size={30}/></div>
        <DialogHeader><DialogTitle>{game?`${players[game.winner!]?.name} thắng!`:''}</DialogTitle><DialogDescription>{game?.instant??'Kết quả ván chơi'} · Tiền nhận về</DialogDescription></DialogHeader>
        {game&&<TienLenPayouts players={players} winner={game.winner!} pot={pot}/>}
        {error&&<p role="alert" className="tl-wallet-error">{error}</p>}
        <div className="tl-result-actions"><button type="button" className="tl-secondary" onClick={goHome}>Về trang chủ</button><button type="button" className="tl-primary" onClick={()=>start(true)}>Ván tiếp<ArrowRight size={18}/></button></div>
      </DialogContent>
    </Dialog>
  </div>
}
