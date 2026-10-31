import { boardCanvasMatrix } from '@/lib/blockblast/projection'
import { useId } from 'react'
import type { blastLayout } from '@/lib/blockblast/layout'

export function BlastArtwork({ colors, environment = 0 }: { colors: readonly string[]; environment?: number }) {
  const id = useId()
  return <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`${id}-a`}><stop stopColor={colors[2]} stopOpacity=".24" /><stop offset="1" stopColor={colors[2]} stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-b`}><stop stopColor={colors[3]} stopOpacity=".17" /><stop offset="1" stopColor={colors[3]} stopOpacity="0" /></radialGradient>
        <pattern id={`${id}-grid`} width="64" height="64" patternUnits="userSpaceOnUse"><path d="M32 2 62 32 32 62 2 32Z" fill="none" stroke="white" strokeOpacity=".025" /><circle cx="32" cy="32" r="1" fill="white" fillOpacity=".16" /></pattern>
      </defs>
      <ellipse cx="220" cy="140" rx="620" ry="470" fill={`url(#${id}-a)`} />
      <ellipse cx="1120" cy="750" rx="620" ry="560" fill={`url(#${id}-b)`} />
      <path d="M-100 700 Q400 300 1300 150 M-100 760 Q400 360 1300 210" fill="none" stroke={colors[0]} strokeOpacity=".08" strokeWidth="2" />
      <rect width="1200" height="900" fill={`url(#${id}-grid)`} />
      {environment === 0 && <g fill="white" opacity=".3">{Array.from({length:50},(_,i)=><circle key={i} cx={(i*197)%1200} cy={(i*113)%900} r={i%3===0 ? 2 : 1} />)}</g>}
      {environment === 1 && <g fill="none" opacity=".18" strokeLinecap="round"><path d="M-100 120 Q300 650 600 200 T1300 400" stroke={colors[3]} strokeWidth="90" /><path d="M-100 60 Q300 580 600 140 T1300 340" stroke={colors[2]} strokeWidth="45" /></g>}
      {environment === 2 && <g fill="none" stroke={colors[0]} opacity=".16">{[0,1,2,3].map(i=><path key={i} d={`M-100 ${620+i*65} Q200 ${500+i*65} 500 ${620+i*65} T1300 ${620+i*65}`} strokeWidth="5" />)}{[0,1,2,3,4].map(i=><circle key={i} cx={90+i*240} cy={160+(i%3)*150} r={18+i*6} strokeWidth="2" />)}</g>}
      {environment === 3 && <g opacity=".22"><circle cx="1040" cy="250" r="150" fill="#ffc77a" /><path d="M0 900V690L170 500 400 780 680 530 1000 790 1200 620V900Z" fill="#ff9f80" /><path d="M0 900V800L300 650 560 820 920 600 1200 820V900Z" fill="#37204e" /></g>}
      {environment === 4 && <g fill="#8cce9e" opacity=".17">{[0,1,2,3,4,5,6].map(i=><path key={i} d={`M${i*205-90} 900l80-220-45 20 65-210 65 210-45-20 80 220Z`} />)}</g>}
      {environment === 5 && <g opacity=".2"><path d="M0 900V780L210 400 450 800 760 330 1200 850V900Z" fill="#d7efff" /><path d="m210 400-64 120 64-35 65 34Zm550-70-85 146 85-40 85 40Z" fill="white" />{Array.from({length:30},(_,i)=><circle key={i} cx={(i*167)%1200} cy={(i*137)%900} r={2+i%3} fill="white" />)}</g>}
      <g fill="none" stroke={colors[1]} strokeOpacity=".12">
        <path d="m120 200 20-12 20 12v24l-20 12-20-12Zm20-12v24m-20-12 20 12 20-12m-20 12v24" />
        <path d="m1040 660 30-18 30 18v36l-30 18-30-18Zm30-18v36m-30-18 30 18 30-18m-30 18v36" />
      </g>
    </svg>
}

export function BlastBurst({ colors, layout, burst }: {
  colors: readonly string[]; layout: ReturnType<typeof blastLayout>; burst: number
}) {
  return burst > 0 ? <svg key={burst} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${layout.width || 1} ${layout.height || 1}`}>
      <g transform={`matrix(${boardCanvasMatrix(layout).join(' ')})`}>
      <g transform={`translate(${layout.x + layout.cell * 4} ${layout.y + layout.cell * 4})`}>
        {[0, 1, 2].map((i) => <circle key={i} className="blast-shockwave" r={layout.cell * 1.5} fill="none" stroke={i === 1 ? colors[3] : '#fff2bc'} strokeWidth={3 - i * .7} style={{ animationDelay: `${i * .09}s` }} />)}
      </g>
      </g>
    </svg> : null
}
