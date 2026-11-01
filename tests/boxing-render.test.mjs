import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,mkdtempSync,rmSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {build} from 'esbuild'
import * as T from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'

const root=dirname(dirname(fileURLToPath(import.meta.url))),temp=mkdtempSync(join(root,'.boxing-tests-'))
after(()=>rmSync(temp,{recursive:true,force:true}))
const output=join(temp,'render.mjs')
await build({stdin:{contents:["export * from './src/lib/boxing/fighter-rig.ts'","export * from './src/lib/boxing/effects.ts'","export * from './src/lib/boxing/characters.ts'","export * from './src/lib/boxing/game.ts'","export * from './src/lib/boxing/scene.ts'"].join('\n'),resolveDir:root},outfile:output,bundle:true,packages:'external',platform:'node',format:'esm',logLevel:'silent',define:{'import.meta.env.BASE_URL':JSON.stringify('/')},plugins:[{name:'gpu-boundary',setup(build){build.onLoad({filter:/boxing\/scene\.ts$/},({path})=>({contents:readFileSync(path,'utf8').replace('new T.WebGLRenderer(', 'new globalThis.BoxingMockRenderer(').replace('new T.PMREMGenerator(renderer)','new globalThis.BoxingMockPMREM(renderer)'),loader:'ts'}))}}]})
const {createFighterRig,createFightEffects,FIGHTERS,DEFAULT_ROSTER,validRoster,IMPACTS,initial,start,act,MOVES,createBoxingScene}=await import(pathToFileURL(output).href)
const file=readFileSync(join(root,'public/assets/boxing/fighter-base.glb'))
const base=(await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'')).scene
const position=o=>o.getWorldPosition(new T.Vector3())

test('all eight looks have local portraits, valid selections and separate skeletons',()=>{
  assert.equal(FIGHTERS.length,8);assert.equal(new Set(FIGHTERS.map(f=>f.id)).size,8)
  assert.ok(validRoster(DEFAULT_ROSTER));assert.ok(validRoster(['nova','nova']))
  for(const bad of [null,{},['ace'],['ace','invalid'],['ace','../../remote'],['ace','blaze','titan']])assert.equal(validRoster(bad),false)
  const original=base.getObjectByName('upperarm_l').position.clone()
  const inverse=base.getObjectByName('SuperHero_Male').skeleton.boneInverses.map(m=>m.toArray())
  for(const look of FIGHTERS){
    for(const suffix of ['.png','-portrait.png'])assert.equal(readFileSync(join(root,`public/assets/boxing/${look.id}${suffix}`)).subarray(1,4).toString(),'PNG')
    const rig=createFighterRig(base,look)
    assert.notEqual(rig.root.getObjectByName('Head'),base.getObjectByName('Head'))
    rig.pose(initial().fighters[0],0,150,true);rig.dispose()
  }
  assert.deepEqual(base.getObjectByName('upperarm_l').position,original)
  assert.deepEqual(base.getObjectByName('SuperHero_Male').skeleton.boneInverses.map(m=>m.toArray()),inverse)
})

test('actual skinned fighter poses keep limb lengths, finite joints and reusable geometry across every move',()=>{
  for(const look of FIGHTERS){
    const rig=createFighterRig(base,look)
    rig.root.rotation.y=Math.PI/2;rig.root.position.set(-.6,0,0);rig.root.updateMatrixWorld(true)
    const chainNames=[['upperarm_l','lowerarm_l','hand_l'],['upperarm_r','lowerarm_r','hand_r'],['thigh_l','calf_l','foot_l'],['thigh_r','calf_r','foot_r']]
    const chains=chainNames.map(names=>names.map(n=>rig.root.getObjectByName(n)))
    const fingertips=['l','r'].flatMap(side=>['index','middle','ring','pinky','thumb'].map(finger=>[rig.root.getObjectByName(`hand_${side}`),rig.root.getObjectByName(`${finger}_04_leaf_${side}`)]))
    const lengths=chains.map(([a,b,c])=>[position(a).distanceTo(position(b)),position(b).distanceTo(position(c))])
    const geometry=new Set();rig.root.traverse(o=>{if(o.isMesh)geometry.add(o.geometry.uuid)})
    for(const action of [...Object.keys(MOVES),'guard','dodge']){
      const state=initial('versus');start(state);act(state,0,action)
      for(let frame=0;frame<35;frame++){
        rig.pose(state.fighters[0],frame/60,150,frame%2===0)
        chains.forEach(([a,b,c],i)=>{
          assert.ok(Math.abs(position(a).distanceTo(position(b))-lengths[i][0])<1e-6,`${look.id} ${action} upper limb`)
          assert.ok(Math.abs(position(b).distanceTo(position(c))-lengths[i][1])<1e-6,`${look.id} ${action} lower limb`)
        })
        for(const [hand,tip] of fingertips)assert.ok(position(hand).distanceTo(position(tip))<.25*look.height/2.4,`${look.id} clenched fist stays inside glove`)
        for(const p of rig.fistPositions)assert.ok(p.toArray().every(Number.isFinite))
        rig.root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.isMesh)assert.ok(geometry.has(o.geometry.uuid))})
      }
    }
    rig.dispose()
  }
})

test('all eight attacks have distinct effects; particles stay bounded, expire and honor reduced motion',()=>{
  assert.equal(new Set(Object.values(IMPACTS).map(v=>JSON.stringify(v))).size,8)
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(40,1,.1,20);camera.position.set(0,2,7);camera.lookAt(0,1,0);camera.updateMatrixWorld()
  const effects=createFightEffects(scene,camera),count=scene.children.length,point=new T.Vector3(0,2,0)
  for(let i=0;i<500;i++){
    effects.impact({kind:'hit',player:i%2,move:'special',damage:34},point,1,false)
    effects.trail(i%4,point,1+i/1000,true,'#ffc866',true,false)
  }
  effects.update(1.1,false)
  assert.equal(scene.children.length,count)
  const sparks=scene.children.find(o=>o.isInstancedMesh)
  assert.equal(sparks.count,192);assert.ok([...sparks.instanceMatrix.array].every(Number.isFinite))
  assert.ok([...sparks.instanceColor.array].every(Number.isFinite))
  const frozen=sparks.instanceMatrix.array.slice();effects.update(1.1,false);assert.deepEqual(sparks.instanceMatrix.array,frozen)
  effects.update(3,false)
  for(let i=0;i<sparks.count;i++){const matrix=new T.Matrix4();sparks.getMatrixAt(i,matrix);assert.equal(Math.abs(matrix.elements[0]),0);assert.equal(Math.abs(matrix.elements[5]),0)}
  effects.reset();effects.impact({kind:'hit',player:0,move:'special',damage:34},point,4,true);effects.update(4,true)
  assert.ok(scene.children.filter(o=>!o.isInstancedMesh).every(o=>!o.visible))
  effects.dispose()
})

test('arena loads the real GLB, frames mobile layouts, freezes effects and cleans up failed or cancelled loading',async()=>{
  const previous={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch}
  let renderer,readyCount=0,failCount=0,mode='success',resolvePending,pendingSignal
  class MockRenderer {
    shadowMap={};renders=0
    constructor(){renderer=this}
    setPixelRatio(value){this.ratio=value}
    setSize(){}
    render(scene,camera){this.scene=scene;this.camera=camera;this.renders++;scene.updateMatrixWorld(true)}
    dispose(){this.disposed=true}
    forceContextLoss(){this.released=true}
  }
  globalThis.BoxingMockRenderer=MockRenderer
  globalThis.BoxingMockPMREM=class{fromScene(){return {texture:new T.Texture(),dispose(){}}}dispose(){}}
  globalThis.window={devicePixelRatio:3,matchMedia:()=>({matches:true})}
  globalThis.document={createElement:()=>({getContext:()=>null})}
  const response={ok:true,arrayBuffer:async()=>file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength)}
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'/assets/boxing/fighter-base.glb')
    if(mode==='failure')throw new Error('offline')
    if(mode==='pending'){pendingSignal=options.signal;return new Promise(resolve=>{resolvePending=resolve})}
    return response
  }
  try {
    const state=initial('versus');start(state)
    const frame={state,event:null,eventAt:0,roster:['ace','titan'],reducedMotion:false}
    const arena=createBoxingScene({},()=>readyCount++,()=>failCount++)
    arena.render(frame);await arena.ready
    assert.equal(readyCount,1);assert.equal(failCount,0);assert.equal(renderer.ratio,1.5)
    for(const [width,height] of [[351,280],[780,300],[1400,750]]){
      arena.resize(width,height);arena.render(frame)
      for(const rig of renderer.scene.children.filter(o=>['ace','titan'].includes(o.name))){
        const head=position(rig.getObjectByName('Head')).project(renderer.camera)
        const foot=position(rig.getObjectByName('foot_l')).project(renderer.camera)
        assert.ok(Math.abs(head.x)<1&&Math.abs(head.y)<1);assert.ok(Math.abs(foot.x)<1&&Math.abs(foot.y)<1)
      }
    }
    const beforePreview=structuredClone(state)
    frame.motionTime=0;arena.render(frame);const previewHead=position(renderer.scene.getObjectByName('ace').getObjectByName('Head'))
    frame.motionTime=.4;arena.render(frame);assert.ok(position(renderer.scene.getObjectByName('ace').getObjectByName('Head')).distanceTo(previewHead)>.005)
    assert.deepEqual(state,beforePreview);delete frame.motionTime
    state.fighters[0].meter=100;act(state,0,'special');state.time=MOVES.special.windup
    frame.event={kind:'hit',player:0,move:'special',damage:34};frame.eventAt=state.time
    arena.render(frame)
    const particles=renderer.scene.children.find(o=>o.isInstancedMesh&&o.count===192)
    const frozen=particles.instanceMatrix.array.slice();arena.render(frame);assert.deepEqual(particles.instanceMatrix.array,frozen)
    const shaken=renderer.camera.position.clone();frame.reducedMotion=true;arena.render(frame)
    assert.ok(shaken.distanceTo(renderer.camera.position)<=.04)
    frame.roster=['nova','onyx'];arena.render(frame)
    assert.ok(renderer.scene.getObjectByName('nova'));assert.ok(renderer.scene.getObjectByName('onyx'));assert.equal(renderer.scene.getObjectByName('ace'),undefined)
    arena.dispose();arena.dispose();assert.ok(renderer.disposed&&renderer.released)
    mode='failure';const failed=createBoxingScene({},()=>readyCount++,()=>failCount++);await failed.ready
    assert.equal(failCount,1);assert.ok(renderer.disposed&&renderer.released)
    mode='pending';const cancelled=createBoxingScene({},()=>readyCount++,()=>failCount++);cancelled.dispose()
    assert.equal(pendingSignal.aborted,true);resolvePending(response);await cancelled.ready
    assert.equal(readyCount,1);assert.equal(failCount,1);assert.ok(renderer.disposed&&renderer.released)
  } finally {
    for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}
    delete globalThis.BoxingMockRenderer;delete globalThis.BoxingMockPMREM
  }
})

test('idle animation breathes, bounces on alternating heels and leaves punch contacts and saved state intact',()=>{
  const rig=createFighterRig(base,FIGHTERS[0]),state=initial('versus'),saved=structuredClone(state)
  rig.root.rotation.y=Math.PI/2
  const head=rig.root.getObjectByName('Head'),left=rig.root.getObjectByName('foot_l'),right=rig.root.getObjectByName('foot_r')
  const toes=['l','r'].map(side=>rig.root.getObjectByName(`ball_leaf_${side}`))
  const heights=[],handHeights=[],toeHeights=[[],[]],heelDifferences=[]
  for(let frame=0;frame<180;frame++){
    rig.pose(state.fighters[0],0,150,false,frame/60)
    heights.push(position(head).y);handHeights.push(rig.fistPositions[0].y)
    heelDifferences.push(position(left).y-position(right).y)
    toes.forEach((toe,i)=>toeHeights[i].push(position(toe).y))
  }
  assert.ok(Math.max(...heights)-Math.min(...heights)>.035)
  assert.ok(Math.max(...heights)-Math.min(...heights)<.12)
  assert.ok(Math.max(...handHeights)-Math.min(...handHeights)>.025)
  assert.ok(Math.max(...heelDifferences)>.015&&Math.min(...heelDifferences)<-.015)
  for(const values of toeHeights){assert.ok(Math.max(...values)-Math.min(...values)<.015);assert.ok(Math.min(...values)>-.025)}
  assert.deepEqual(state,saved)
  const capture=()=>[position(head),position(left),position(right),...rig.fistPositions.map(p=>p.clone())]
  rig.pose(state.fighters[0],0,150,true,0);const reduced=capture()
  rig.pose(state.fighters[0],0,150,true,10);capture().forEach((point,i)=>assert.ok(point.distanceTo(reduced[i])<1e-12))
  start(state);act(state,0,'cross')
  rig.pose(state.fighters[0],MOVES.cross.windup,150,false,0);const contact=capture()
  rig.pose(state.fighters[0],MOVES.cross.windup,150,false,10);capture().forEach((point,i)=>assert.ok(point.distanceTo(contact[i])<1e-12))
  rig.dispose()
})
