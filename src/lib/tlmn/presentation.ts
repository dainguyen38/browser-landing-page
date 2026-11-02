export const DEAL_STEP_MS=65
export const DEAL_FLIGHT_MS=300
export const DEAL_DURATION_MS=51*DEAL_STEP_MS+DEAL_FLIGHT_MS

export function botThinkDelay(random=Math.random) {
  return 1300+Math.floor(Math.max(0,Math.min(1,random()))*1200)
}
export function seatPosition(seat:number,anchor:number) {return (seat-anchor+4)%4}
export function dealProgress(elapsed:number,startingSeat:number) {
  const time=Math.max(0,Math.min(DEAL_DURATION_MS,elapsed)),counts=[0,0,0,0]
  const flights:{index:number;seat:number;progress:number}[]=[]
  for(let index=0;index<52;index++) {
    const age=time-index*DEAL_STEP_MS,seat=(startingSeat+index)%4
    if(age>=DEAL_FLIGHT_MS)counts[seat]++
    else if(age>=0)flights.push({index,seat,progress:age/DEAL_FLIGHT_MS})
  }
  return {counts,flights,complete:time>=DEAL_DURATION_MS}
}
