import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createFighterRig } from './fighter-rig'
import { createFightEffects } from './effects'
import { fighterLook } from './characters'
import { fighterX } from './pose'
import type { BoxingState, FightEvent } from './game'

type Frame={state:BoxingState;event:FightEvent|null;eventAt:number;roster:[string,string];reducedMotion:boolean;motionTime?:number}
function disposeTree(root:T.Object3D) {
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>()
  root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)}})
  materials.forEach(m=>{for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);m.dispose()})
  geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose())
}

export function createBoxingScene(canvas:HTMLCanvasElement,onReady:()=>void,onError:()=>void) {
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'})
  try {
  const coarse=window.matchMedia('(pointer: coarse)').matches
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,coarse?1.5:2))
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap
  const scene=new T.Scene();scene.background=new T.Color('#11131b');scene.fog=new T.Fog('#11131b',9,17)
  const camera=new T.OrthographicCamera(-3,3,1.7,-1.7,.1,30)
  const hemisphere=new T.HemisphereLight('#d9e8ff','#514034',1.5);scene.add(hemisphere)
  const key=new T.DirectionalLight('#fff0d4',3.1);key.position.set(-2.5,5.5,3.5);key.target.position.set(0,1,0)
  key.castShadow=true;key.shadow.mapSize.setScalar(coarse?512:1024);key.shadow.camera.left=-4;key.shadow.camera.right=4
  key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.camera.near=.5;key.shadow.camera.far=13
  key.shadow.normalBias=.025;key.shadow.bias=-.0001;scene.add(key,key.target)
  const rim=new T.DirectionalLight('#9bbcff',2.4);rim.position.set(1,3,-3);scene.add(rim)
  const fill=new T.DirectionalLight('#ffe1c3',.7);fill.position.set(4,2,5);scene.add(fill)
  const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer)
  const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.4
  room.dispose();pmrem.dispose()
  const rounded=new RoundedBoxGeometry(1,1,1,3,.08),cylinder=new T.CylinderGeometry(1,1,1,12)
  const material=(color:string,roughness=.8)=>new T.MeshStandardMaterial({color,roughness})
  const mat=material('#b3a084'),edge=material('#232733'),ivory=material('#dbd5c6'),blue=material('#346b9c'),red=material('#a3473d'),dark=material('#151924')
  function box(m:T.Material,position:number[],scale:number[]) {
    const mesh=new T.Mesh(rounded,m);mesh.position.fromArray(position);mesh.scale.fromArray(scale);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh
  }
  box(edge,[0,-.20,0],[5.8,.33,4.4]);box(mat,[0,-.075,0],[5.65,.15,4.25])
  const logoCanvas=document.createElement('canvas');logoCanvas.width=512;logoCanvas.height=256
  const ctx=logoCanvas.getContext('2d')
  if(ctx){
    ctx.fillStyle='#6e6251';ctx.textAlign='center';ctx.font='italic 900 76px Impact, sans-serif';ctx.fillText('RINGSIDE',256,140)
    ctx.font='600 15px Arial';ctx.fillText('F I G H T   C L U B',256,178)
    const texture=new T.CanvasTexture(logoCanvas);texture.colorSpace=T.SRGBColorSpace
    const logo=new T.Mesh(new T.PlaneGeometry(2.8,1.4),new T.MeshBasicMaterial({map:texture,transparent:true,opacity:.6,depthWrite:false}))
    logo.rotation.x=-Math.PI/2;logo.position.set(0,.009,0);scene.add(logo)
  }
  function rope(start:T.Vector3,end:T.Vector3,m:T.Material,radius=.022) {
    const mesh=new T.Mesh(cylinder,m);mesh.position.copy(start).lerp(end,.5);mesh.scale.set(radius,start.distanceTo(end),radius)
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.clone().sub(start).normalize());scene.add(mesh)
  }
  for(const x of [-2.62,2.62])for(const z of [-1.9,1.9]){
    box(dark,[x,.72,z],[.12,1.6,.12]);box(x<0?blue:red,[x,.94,z],[.23,.9,.23])
  }
  for(const height of [.43,.76,1.09]){
    const m=height===.76?ivory:dark
    for(const z of [-1.9,1.9])rope(new T.Vector3(-2.62,height,z),new T.Vector3(2.62,height,z),m)
    for(const x of [-2.62,2.62])rope(new T.Vector3(x,height,-1.9),new T.Vector3(x,height,1.9),m)
  }
  const crowdGeometry=new T.SphereGeometry(1,8,6),crowdMaterial=material('#272a36')
  const crowd=new T.InstancedMesh(crowdGeometry,crowdMaterial,112),dummy=new T.Object3D()
  for(let i=0;i<112;i++){
    const row=Math.floor(i/28),column=i%28
    dummy.position.set((column-13.5)*.36,.35+row*.28,-2.9-row*.52);dummy.scale.set(.105,.16,.11);dummy.updateMatrix();crowd.setMatrixAt(i,dummy.matrix)
  }
  scene.add(crowd)
  const backdrop=box(material('#171b27'),[0,.3,-4.9],[14,2,.2]);backdrop.castShadow=false
  for(const x of [-3.3,3.3]){
    const neon=new T.MeshBasicMaterial({color:x<0?'#456d97':'#925748'})
    box(neon,[x,2.3,-3],[.025,3.4,.025]);box(neon,[x,2.3,-3],[1,.025,.025])
  }
  const effects=createFightEffects(scene,camera)
  const auraGeometry=new T.TorusGeometry(.45,.01,6,64)
  const auras=[0,1].map(()=>{
    const m=new T.MeshBasicMaterial({color:'#e8c27d',transparent:true,opacity:.45,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false})
    const mesh=new T.Mesh(auraGeometry,m);mesh.rotation.x=-Math.PI/2;mesh.visible=false;scene.add(mesh);return mesh
  })
  let rigs:ReturnType<typeof createFighterRig>[]=[],base:T.Group|null=null,disposed=false,width=1,height=1
  let latest:Frame|null=null,lastTime=-1,lastEvent:FightEvent|null=null,lastEventAt=-1
  const abort=new AbortController(),hit=new T.Vector3()
  function render(frame:Frame) {
    latest=frame;if(disposed||!base)return
    const {state:st,roster,reducedMotion,event,eventAt}=frame
    for(let i=0;i<2;i++)if(rigs[i]?.root.name!==fighterLook(roster[i]).id){
      if(rigs[i]){scene.remove(rigs[i].root);rigs[i].dispose()}
      rigs[i]=createFighterRig(base,fighterLook(roster[i]));scene.add(rigs[i].root)
    }
    if(st.time<lastTime){effects.reset();lastEvent=null;lastEventAt=-1}
    lastTime=st.time
    const xs=st.fighters.map(f=>(fighterX(f,st.time)-.5)*4.4),gap=Math.abs(xs[1]-xs[0]),middle=(xs[0]+xs[1])/2
    const halfHeight=Math.max(1.55,(gap+1.4)/(width/height)/2)
    camera.left=-halfHeight*width/height;camera.right=halfHeight*width/height;camera.top=halfHeight;camera.bottom=-halfHeight
    const age=st.time-eventAt,kick=!reducedMotion&&event?.kind==='hit'&&event.damage>=15&&age>=0&&age<.13?(1-age/.13)*.035:0
    const shakeX=Math.sin(age*90)*kick,shakeY=Math.cos(age*75)*kick*.5
    camera.position.set(middle+.55+shakeX,3.15+shakeY,7.2);camera.lookAt(middle+shakeX,1.18+shakeY,0);camera.updateProjectionMatrix();camera.updateMatrixWorld()
    for(let i=0;i<2;i++){
      const rig=rigs[i],look=fighterLook(roster[i])
      rig.root.position.set(xs[i],0,0);rig.root.rotation.set(st.over&&st.winner===1-i?-.95:0,i===0?Math.PI/2:-Math.PI/2,0)
      const p=rig.pose(st.fighters[i],st.time,gap/4.4*580,reducedMotion,frame.motionTime??st.time)
      const heavy=p.punch==='power'||p.punch==='special',tint=p.punch==='special'?'#ddb8ff':p.punch==='uppercut'?'#b8e9ff':look.trim
      for(let arm=0;arm<2;arm++)effects.trail(i*2+arm,rig.fistPositions[arm],st.time,!!p.punch&&p.arms[arm].extension>.08,tint,heavy,reducedMotion)
      auras[i].visible=!reducedMotion&&(st.fighters[i].meter>=100||heavy&&p.charge>.25)
      auras[i].position.set(xs[i],.025,0);auras[i].scale.setScalar(1+p.charge*.4);auras[i].material.opacity=.23+p.charge*.3
    }
    if(event&&(event!==lastEvent||eventAt!==lastEventAt)){
      lastEvent=event;lastEventAt=eventAt
      const target=event.player===0?1:0,look=fighterLook(roster[target])
      hit.set(xs[target]+(target===0?.17:-.17),look.height*(event.move==='body'?.62:.9),.05)
      effects.impact(event,hit,eventAt,reducedMotion)
    }
    effects.update(st.time,reducedMotion)
    renderer.render(scene,camera)
  }
  function dispose() {
    if(disposed)return;disposed=true;abort.abort()
    for(const rig of rigs){scene.remove(rig.root);rig.dispose()}
    if(base)disposeTree(base)
    disposeTree(scene);key.shadow.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss()
  }
  const ready=fetch(`${import.meta.env.BASE_URL}assets/boxing/fighter-base.glb`,{signal:abort.signal})
    .then(response=>{if(!response.ok)throw new Error('Boxing model');return response.arrayBuffer()})
    .then(buffer=>new GLTFLoader().parseAsync(buffer,''))
    .then(model=>{
      if(disposed){disposeTree(model.scene);return}
      base=model.scene;if(latest)render(latest);onReady()
    }).catch(()=>{if(!disposed){dispose();onError()}})
  return {render,ready,resize:(w:number,h:number)=>{width=Math.max(1,w);height=Math.max(1,h);renderer.setSize(width,height,false)},dispose}
  } catch(error) {renderer.dispose();renderer.forceContextLoss();throw error}
}
