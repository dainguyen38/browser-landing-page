import * as T from 'three'
import type { FightEvent, Punch } from './game'

export const IMPACTS:Record<Punch,{sparks:number;speed:number;lift:number;life:number;ring:number;color:string}>={
  jab:{sparks:12,speed:1.4,lift:.3,life:.22,ring:.28,color:'#f3e4bd'},
  cross:{sparks:19,speed:2.1,lift:.5,life:.30,ring:.42,color:'#ffcf85'},
  hook:{sparks:23,speed:2.0,lift:.8,life:.34,ring:.46,color:'#ffb86e'},
  uppercut:{sparks:26,speed:2.2,lift:2.4,life:.40,ring:.5,color:'#b9e9ff'},
  body:{sparks:17,speed:1.3,lift:-.4,life:.28,ring:.35,color:'#e9c68e'},
  power:{sparks:35,speed:3.1,lift:1,life:.46,ring:.72,color:'#ffc66b'},
  flurry:{sparks:15,speed:2.5,lift:.2,life:.23,ring:.31,color:'#d8f6ff'},
  special:{sparks:48,speed:3.8,lift:1.5,life:.6,ring:.95,color:'#e0bbff'},
}

export function glowTexture() {
  const size=32,data=new Uint8Array(size*size*4)
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const offset=(y*size+x)*4,r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1)
    data[offset]=data[offset+1]=data[offset+2]=255;data[offset+3]=Math.round(Math.max(0,1-r)**2*255)
  }
  const texture=new T.DataTexture(data,size,size);texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearFilter;texture.needsUpdate=true;return texture
}

export function createFightEffects(scene:T.Scene,camera:T.Camera) {
  const texture=glowTexture(),dummy=new T.Object3D(),color=new T.Color(),turn=new T.Quaternion(),z=new T.Vector3(0,0,1)
  const material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false})
  const sparkGeometry=new T.PlaneGeometry(1,1),capacity=192
  const sparks=new T.InstancedMesh(sparkGeometry,material,capacity);sparks.frustumCulled=false
  sparks.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(sparks)
  const particles=Array.from({length:capacity},()=>({at:-10,life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,size:0,color:new T.Color()}))
  const ringGeometry=new T.RingGeometry(.92,1,64)
  const rings=Array.from({length:8},()=>{
    const m=new T.MeshBasicMaterial({color:'#ffd19b',transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false})
    const mesh=new T.Mesh(ringGeometry,m);mesh.visible=false;scene.add(mesh)
    return {mesh,at:-10,life:0,size:1}
  })
  let cursor=0,ringCursor=0
  function impact(event:FightEvent,position:T.Vector3,time:number,reduced:boolean) {
    if(reduced||!['hit','block','ko'].includes(event.kind))return
    const style=IMPACTS[event.move??'power'],blocked=event.kind==='block'
    const tint=blocked?'#a2d8ed':event.counter?'#f4c2ff':style.color,count=blocked?14:style.sparks
    for(let i=0;i<count;i++){
      const p=particles[cursor++%capacity],angle=i*2.399963+time*9,speed=style.speed*(.4+(i%7)/10)
      p.at=time;p.life=style.life*(.6+(i%5)/10);p.x=position.x;p.y=position.y;p.z=position.z
      p.vx=Math.cos(angle)*speed;p.vy=Math.sin(angle)*speed+style.lift;p.vz=Math.sin(i*3.7)*speed*.4
      p.size=.045+(i%4)*.023;p.color.set(tint)
    }
    for(let i=0;i<(event.move==='special'?2:1);i++){
      const r=rings[ringCursor++%rings.length];r.at=time-i*.045;r.life=style.life;r.size=style.ring*(i?1.35:1)
      r.mesh.position.copy(position);r.mesh.material.color.set(i?'#ffd888':tint)
    }
  }
  const traces=Array.from({length:4},()=>{
    const positions=new Float32Array(12*2*3),uv=new Float32Array(12*2*2),indices:number[]=[]
    for(let i=0;i<12;i++){uv.set([0,i/11,1,i/11],i*4);if(i<11)indices.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2)}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.setIndex(indices)
    const m=new T.MeshBasicMaterial({map:texture,transparent:true,opacity:.75,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false})
    const mesh=new T.Mesh(geometry,m);mesh.frustumCulled=false;scene.add(mesh)
    return {mesh,positions,points:Array.from({length:12},()=>new T.Vector3()),times:new Float64Array(12).fill(-10),last:-1}
  })
  const normal=new T.Vector3(),across=new T.Vector3()
  function trail(index:number,point:T.Vector3,time:number,active:boolean,tint:string,heavy:boolean,reduced:boolean) {
    const t=traces[index],life=heavy?.19:.13
    if(reduced){t.mesh.visible=false;return}
    if(active&&time>t.last){
      for(let i=11;i>0;i--){t.points[i].copy(t.points[i-1]);t.times[i]=t.times[i-1]}
      t.points[0].copy(point);t.times[0]=time;t.last=time
    }
    t.mesh.visible=time-t.times[0]<life
    if(!t.mesh.visible)return
    camera.getWorldDirection(normal);t.mesh.material.color.set(tint)
    for(let i=0;i<12;i++){
      const sample=t.points[i],valid=time-t.times[i]<life
      const next=t.points[Math.max(0,i-1)]
      across.copy(next).sub(sample).cross(normal).normalize().multiplyScalar(valid?Math.max(0,1-(time-t.times[i])/life)*(heavy?.09:.045):0)
      const p=valid?sample:t.points[Math.max(0,i-1)]
      t.positions.set([p.x+across.x,p.y+across.y,p.z+across.z,p.x-across.x,p.y-across.y,p.z-across.z],i*6)
    }
    t.mesh.geometry.attributes.position.needsUpdate=true
  }
  function update(time:number,reduced:boolean) {
    for(let i=0;i<capacity;i++){
      const p=particles[i],age=time-p.at,alive=!reduced&&age>=0&&age<p.life,fade=alive?1-age/p.life:0
      if(alive){
        const drag=age/(1+age*2)
        dummy.position.set(p.x+p.vx*drag,p.y+p.vy*drag-2*age*age,p.z+p.vz*drag)
        dummy.quaternion.copy(camera.quaternion).multiply(turn.setFromAxisAngle(z,Math.atan2(p.vy-4*age,p.vx)))
      }
      dummy.scale.set(p.size*fade*(2+Math.hypot(p.vx,p.vy)),p.size*fade*.4,1);dummy.updateMatrix();sparks.setMatrixAt(i,dummy.matrix)
      color.copy(p.color).multiplyScalar(fade);sparks.setColorAt(i,color)
    }
    sparks.instanceMatrix.needsUpdate=true;if(sparks.instanceColor)sparks.instanceColor.needsUpdate=true
    for(const r of rings){const age=(time-r.at)/r.life;r.mesh.visible=!reduced&&age>=0&&age<1
      if(r.mesh.visible){r.mesh.quaternion.copy(camera.quaternion);r.mesh.scale.setScalar(r.size*(.15+age));r.mesh.material.opacity=(1-age)**2*.8}
    }
  }
  return {impact,trail,update,reset:()=>{
    particles.forEach(p=>p.life=0);rings.forEach(r=>r.life=0);traces.forEach(t=>{t.times.fill(-10);t.last=-1;t.mesh.visible=false})
  },dispose:()=>{texture.dispose()}}
}
