import { useState } from 'react'
import { Coins, Gift } from 'lucide-react'
import { COIN_PHRASE, formatCoins, humanAccount, useDcoinStore } from '@/store/dcoin'

export function DcoinWallet({compact=false}:{compact?:boolean}) {
  const [phrase,setPhrase]=useState(''),[account,setAccount]=useState(humanAccount(0)),[message,setMessage]=useState('')
  const coins=useDcoinStore(s=>s.balances[account]),claim=useDcoinStore(s=>s.claim)
  return <section className={`dcoin-wallet ${compact?'is-compact':''}`} aria-label="Ví d-coin">
    <div className="dcoin-balance"><Coins size={20}/><span><small>VÍ D-COIN</small><strong>{formatCoins(coins??0)} <em>d</em></strong></span></div>
    <form onSubmit={e=>{e.preventDefault();const ok=claim(phrase,account);setMessage(ok?'+1.000.000 d-coin đã vào ví.':`Hãy nhập đúng “${COIN_PHRASE}”.`);if(ok)setPhrase('')}}>
      {!compact&&<select aria-label="Chọn ví người chơi" value={account} onChange={e=>{setAccount(e.target.value);setMessage('')}}>{[0,1,2,3].map(i=><option key={i} value={humanAccount(i)}>{i===0?'Ví của bạn':`Ví khách ${i+1}`}</option>)}</select>}
      <input aria-label="Câu nhận d-coin" placeholder={COIN_PHRASE} value={phrase} maxLength={80} onChange={e=>{setPhrase(e.target.value);setMessage('')}}/>
      <button type="submit" title="Nhận 1.000.000 d-coin"><Gift size={16}/><span>Nhận coin</span></button>
    </form>
    {message&&<p role="status">{message}</p>}
  </section>
}
