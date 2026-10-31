import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../src/lib/blockblast/game.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { initial, deal, canPlace, hasMove, place } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const projectionSource = readFileSync(new URL('../src/lib/blockblast/projection.ts', import.meta.url), 'utf8')
const projectionCode = ts.transpileModule(projectionSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const projectionUrl = `data:text/javascript;base64,${Buffer.from(projectionCode).toString('base64')}`
const { boardToScreen, BOARD_TILT, DEFAULT_VIEW, clampView } = await import(projectionUrl)
const layoutSource = readFileSync(new URL('../src/lib/blockblast/layout.ts', import.meta.url), 'utf8').replace("'./projection'",JSON.stringify(projectionUrl))
const layoutCode = ts.transpileModule(layoutSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { blastLayout } = await import(`data:text/javascript;base64,${Buffer.from(layoutCode).toString('base64')}`)
const single = (color=2) => ({ cells:[{x:0,y:0}], color })

test('the map fills the available projected area and trays follow the longer screen axis', () => {
  for (const [width,height] of [[296,500],[351,625],[406,795],[616,337],[780,337],[952,714],[2483,915],[3840,2160]]) {
    for (const yaw of [-Math.PI*1.25,-Math.PI/4,0,.6,Math.PI*.75]) {
      for (const tilt of [35,55,65]) for (const zoom of [.6,1]) {
        const l=blastLayout(width,height,{yaw,tilt:tilt*Math.PI/180,zoom})
        assert.equal(l.landscape,width>height)
        assert.ok(l.cell>0)
        const corners=[]
        for(const x of [l.x,l.x+8*l.cell]) for(const y of [l.y,l.y+8*l.cell]) for(const z of [-.35*l.cell,.8*l.cell]) {
          const p=boardToScreen(l,x,y,z); corners.push(p)
          assert.ok(p.x>=l.map.x-1e-8 && p.x<=l.map.x+l.map.width+1e-8)
          assert.ok(p.y>=l.map.y-1e-8 && p.y<=l.map.y+l.map.height+1e-8)
        }
        const reference=blastLayout(width,height,{...DEFAULT_VIEW,zoom})
        assert.equal(l.cell,reference.cell,'rotation must not resize cells')
        assert.equal(l.x,reference.x,'rotation must keep the same center')
        assert.equal(l.y,reference.y,'rotation must keep the same center')
        if (zoom===1) {
          let diameter=0
          for(let angle=-Math.PI*1.25;angle<=Math.PI*.75;angle+=Math.PI/90) {
            const orbit=blastLayout(width,height,{yaw:angle,tilt:BOARD_TILT,zoom})
            for(const x of [orbit.x,orbit.x+8*orbit.cell]) for(const y of [orbit.y,orbit.y+8*orbit.cell]) {
              const p=boardToScreen(orbit,x,y,.8*orbit.cell)
              diameter=Math.max(diameter,2*Math.hypot(p.x-(orbit.x+orbit.cell*4),p.y-(orbit.y+orbit.cell*4)))
            }
          }
          assert.ok(Math.min(l.map.width,l.map.height)-diameter<=24.000001,'fit must use the largest safe rotation radius')
        }
        for(const slot of l.slots) {
          assert.ok(slot.x-slot.width/2>=0 && slot.x+slot.width/2<=width+1e-8)
          assert.ok(slot.y-slot.height/2>=0 && slot.y+slot.height/2<=height-68+1e-8)
          assert.ok(5*l.trayCell<=slot.width && 5*l.trayCell<=slot.height)
          assert.ok(l.landscape ? slot.x-slot.width/2>=l.map.x+l.map.width : slot.y-slot.height/2>=l.map.y+l.map.height)
        }
      }
    }
  }
  const large=blastLayout(2483,915)
  assert.ok(large.cell*8>650,'wide desktop must use a large map rather than the previous small board')
})
test('view limits keep zoom and orbit inside a recoverable range', () => {
  const low=clampView({yaw:-100,tilt:-100,zoom:-10})
  const high=clampView({yaw:100,tilt:100,zoom:10})
  assert.equal(low.zoom,.6); assert.equal(high.zoom,1)
  assert.equal(low.yaw,-Math.PI*1.25); assert.equal(high.yaw,Math.PI*.75)
  assert.equal(low.tilt,BOARD_TILT); assert.equal(high.tilt,BOARD_TILT)
  assert.deepEqual(clampView(DEFAULT_VIEW),DEFAULT_VIEW)
})

test('deals three normalized, fixed-orientation pieces with valid colors and no overlapping cells', () => {
  for(let i=0;i<100;i++) for(const piece of deal()) {
    assert.ok(piece.color>=1 && piece.color<=7)
    assert.equal(new Set(piece.cells.map(p=>`${p.x},${p.y}`)).size,piece.cells.length)
    assert.equal(Math.min(...piece.cells.map(p=>p.x)),0)
    assert.equal(Math.min(...piece.cells.map(p=>p.y)),0)
    assert.ok(canPlace(initial().board,piece,0,0))
  }
})
test('invalid drops do not consume pieces, score, or mutate the board', () => {
  const st=initial(); st.pieces=[single(),single(),single()]; st.board[0][0]=1
  const before=structuredClone(st)
  for(const [x,y] of [[0,0],[-1,0],[8,0],[0,8],[.5,0]]) assert.equal(place(st,0,x,y),null)
  assert.deepEqual(st,before)
})
test('crossing full row and column clear simultaneously, with the intersection counted once', () => {
  const st=initial(); st.pieces=[single(),single(),single()]
  st.board[3].fill(1); st.board[3][4]=0
  for(let y=0;y<8;y++) if(y!==3) st.board[y][4]=3
  const result=place(st,0,4,3)
  assert.equal(result.lines,2); assert.equal(result.cleared.length,15)
  assert.equal(st.board.flat().filter(Boolean).length,0)
  assert.equal(st.score,41); assert.equal(st.combo,1)
  assert.equal(st.pieces[0],null)
})
test('tray refills only after all three pieces are used; combos grow on consecutive clears then reset', () => {
  const st=initial(); st.pieces=[single(),single(),single()]
  for(let index=0;index<2;index++) {
    st.board[index].fill(1); st.board[index][7]=0
    place(st,index,7,index)
    assert.equal(st.combo,index+1)
    assert.equal(st.pieces[index],null)
  }
  assert.equal(st.score,32)
  place(st,2,0,0,()=>0)
  assert.equal(st.combo,0); assert.ok(st.pieces.every(Boolean)); assert.equal(st.pieces.length,3)
})
test('game ends only when none of the remaining pieces fit, including after a refill', () => {
  const st=initial(); st.board=Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>(x+y)%2 ? 1 : 0))
  const square={cells:[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}],color:2}
  st.pieces=[single(),square,null]
  assert.equal(hasMove(st),true)
  place(st,0,0,0)
  assert.equal(st.over,true); assert.equal(hasMove(st),false)
  const before=structuredClone(st); assert.equal(place(st,1,0,0),null); assert.deepEqual(st,before)
  const refill=initial()
  refill.board=structuredClone(st.board)
  refill.board[0][0]=0
  refill.pieces=[single(),null,null]
  // A full 3×3 square cannot fit into this checkerboard.
  place(refill,0,0,0,()=>12.1/21)
  assert.ok(refill.pieces.every(Boolean))
  assert.equal(refill.over,true)
})
