import * as T from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { boxingFootwork, boxingIdle, boxingPose } from './pose'
import { MOVES, type Fighter } from './game'
import type { FighterLook } from './characters'

const yAxis=new T.Vector3(0,1,0)
const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),d=new T.Vector3(),e=new T.Vector3(),elbow=new T.Vector3()
const q=new T.Quaternion(),parentQ=new T.Quaternion(),worldQ=new T.Quaternion(),angles=new T.Euler()

function aim(bone:T.Bone,end:T.Bone,target:T.Vector3) {
  bone.getWorldPosition(a);end.getWorldPosition(b)
  b.sub(a).normalize();c.copy(target).sub(a).normalize()
  q.setFromUnitVectors(b,c);bone.getWorldQuaternion(worldQ)
  bone.parent!.getWorldQuaternion(parentQ).invert()
  bone.quaternion.copy(parentQ.multiply(q.multiply(worldQ)))
  bone.updateWorldMatrix(false,true)
}

// Two-bone IK preserves the mesh's arm/leg lengths even on the longest punches.
function ik(upper:T.Bone,lower:T.Bone,end:T.Bone,target:T.Vector3,pole:T.Vector3) {
  upper.getWorldPosition(a);lower.getWorldPosition(b);end.getWorldPosition(c)
  const l1=a.distanceTo(b),l2=b.distanceTo(c)
  d.copy(target).sub(a)
  const distance=T.MathUtils.clamp(d.length(),Math.abs(l1-l2)+.001,l1+l2-.001)
  d.normalize();e.copy(pole).sub(a);e.addScaledVector(d,-e.dot(d)).normalize()
  const along=(l1*l1+distance*distance-l2*l2)/(2*distance)
  elbow.copy(a).addScaledVector(d,along).addScaledVector(e,Math.sqrt(Math.max(0,l1*l1-along*along)))
  aim(upper,lower,elbow);aim(lower,end,target)
}

export function createFighterRig(base:T.Group,look:FighterLook) {
  const root=new T.Group(),avatar=clone(base) as T.Group,gear=new T.Group()
  root.name=look.id;root.add(avatar,gear)
  const ownedGeometry=new Set<T.BufferGeometry>(),ownedMaterial=new Set<T.Material>()
  const mat=(color:string,roughness=.55,metalness=0)=>{
    const m=new T.MeshStandardMaterial({color,roughness,metalness});ownedMaterial.add(m);return m
  }
  const skin=mat(look.skin,.56),hair=mat(look.hair,.8),cloth=mat(look.kit,.86),trim=mat(look.trim,.48,.15)
  const leather=mat(look.glove,.28,.08),ivory=mat('#eae4d6',.68),sole=mat('#171923',.78),eyes=mat('#f4ede1',.25),pupil=mat('#171921',.2)
  const sphere=new T.SphereGeometry(1,24,16),box=new RoundedBoxGeometry(1,1,1,3,.12)
  const cylinder=new T.CylinderGeometry(1,1,1,20),cap=new T.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI*.53)
  ;[sphere,box,cylinder,cap].forEach(g=>ownedGeometry.add(g))
  function mesh(parent:T.Object3D,g:T.BufferGeometry,m:T.Material,pos:number[],scale:number[]) {
    const object=new T.Mesh(g,m);object.position.fromArray(pos);object.scale.fromArray(scale)
    object.castShadow=true;object.receiveShadow=true;parent.add(object);return object
  }
  const bones:Record<string,T.Bone>={},rest:{bone:T.Bone;position:T.Vector3;quaternion:T.Quaternion}[]=[]
  avatar.traverse(o=>{
    if(o instanceof T.Bone) {bones[o.name]=o;rest.push({bone:o,position:o.position.clone(),quaternion:o.quaternion.clone()})}
    if(o instanceof T.Mesh) {
      o.material=o.name==='Eyes'?eyes:o.name==='Eyebrows'?hair:skin
      o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false
    }
  })
  // Bake build into the bind pose; nonuniform parent scale would stretch arms during IK.
  if(look.build!==1) {
    root.updateMatrixWorld(true)
    const targets=rest.map(r=>r.bone.getWorldPosition(new T.Vector3()).multiply(new T.Vector3(look.build,1,1)))
    rest.forEach((r,i)=>{r.bone.position.copy(r.bone.parent!.worldToLocal(targets[i]));r.bone.updateWorldMatrix(false,true);r.position.copy(r.bone.position)})
    avatar.traverse(o=>{if(o instanceof T.SkinnedMesh){
      o.geometry=o.geometry.clone().scale(look.build,1,1);ownedGeometry.add(o.geometry)
      o.skeleton.boneInverses=[];o.skeleton.calculateInverses()
    }})
  }
  const bounds=new T.Box3().setFromObject(avatar),scale=look.height/(bounds.max.y-bounds.min.y),u=look.height/2.4
  avatar.scale.setScalar(scale);avatar.position.y=-bounds.min.y*scale
  const floorOffset=avatar.position.y
  root.updateMatrixWorld(true)
  const restHeadQ=bones.Head.getWorldQuaternion(new T.Quaternion()).invert()
  const restFootQ=['l','r'].map(side=>bones[`foot_${side}`].getWorldQuaternion(new T.Quaternion()))
  const head=new T.Group();gear.add(head)
  // Hair and pupils follow the head bone, with offsets authored in normalized model space.
  const hairpiece=new T.Group();head.add(hairpiece)
  hairpiece.scale.set(u*look.build,u,u)
  if(look.cut!=='beard'&&look.cut!=='headguard') {
    mesh(hairpiece,cap,hair,[0,.205,-.02],[.146,.16,.133])
    if(look.cut==='quiff'||look.cut==='slick') {
      for(let i=0;i<7;i++) {
        const tuft=mesh(hairpiece,sphere,hair,[(i-3)*.034,.31-Math.abs(i-3)*.009,look.cut==='quiff'?.045:-.035],[.037,.055,.11])
        tuft.rotation.x=look.cut==='quiff'?-.3:.3
      }
    } else if(look.cut==='mohawk') {
      for(let i=0;i<6;i++) mesh(hairpiece,box,hair,[0,.34-Math.abs(i-2)*.012,.09-i*.045],[.055,.12,.057])
    } else if(look.cut==='knot') {
      mesh(hairpiece,sphere,hair,[0,.32,-.09],[.082,.075,.08])
      mesh(hairpiece,cylinder,trim,[0,.295,-.08],[.085,.025,.085])
    } else if(look.cut==='braids') {
      for(let i=0;i<5;i++) {
        const braid=mesh(hairpiece,sphere,hair,[(i-2)*.05,.33-Math.abs(i-2)*.014,-.02],[.026,.032,.14])
        braid.rotation.x=-.15
      }
    } else if(look.cut==='curls') {
      for(let i=0;i<28;i++) {
        const angle=i*2.399963,r=Math.sqrt(i/28)*.16
        mesh(hairpiece,sphere,hair,[Math.cos(angle)*r,.35-(r/.16)**2*.10,Math.sin(angle)*r-.018],[.056,.05,.053])
      }
    }
  }
  if(look.cut==='beard') {
    mesh(hairpiece,sphere,hair,[0,.005,.055],[.105,.055,.075])
    for(const side of [-1,1])mesh(hairpiece,box,hair,[side*.091,.065,.035],[.027,.15,.066])
  }
  if(look.cut==='headguard') {
    mesh(hairpiece,cap,leather,[0,.20,-.02],[.162,.17,.15])
    mesh(hairpiece,box,trim,[0,.225,.121],[.20,.047,.025])
    for(const side of [-1,1]) {
      mesh(hairpiece,box,leather,[side*.124,.08,.057],[.07,.19,.13])
      mesh(hairpiece,sphere,trim,[side*.159,.09,-.027],[.023,.058,.05])
    }
  }
  for(const side of [-1,1]) {
    mesh(head,sphere,pupil,[side*.042*u*look.build,.131*u,.132*u],[.014*u,.016*u,.008*u])
    mesh(head,sphere,eyes,[side*.042*u*look.build-.003*u,.136*u,.139*u],[.004*u,.004*u,.002*u])
  }
  const waist=new T.Group();gear.add(waist)
  waist.scale.set(u*look.build,u,u)
  mesh(waist,box,cloth,[0,0,0],[.55,.32,.46])
  mesh(waist,box,ivory,[0,.18,0],[.56,.09,.47])
  mesh(waist,box,trim,[0,.18,.241],[.18,.065,.025])
  for(const side of [-1,1])mesh(waist,box,trim,[side*.248,-.012,.20],[.035,.26,.055])

  const legs=[-1,1].map(side=>{
    const shorts=new T.Group(),boot=new T.Group();gear.add(shorts,boot)
    mesh(shorts,cylinder,cloth,[0,0,0],[.185*u*look.build,.45*u,.205*u])
    mesh(shorts,cylinder,trim,[0,-.216*u,0],[.187*u*look.build,.027*u,.207*u])
    mesh(boot,box,ivory,[0,.09*u,0],[.205*u,.30*u,.20*u])
    mesh(boot,box,leather,[0,-.02*u,.105*u],[.225*u,.18*u,.44*u])
    mesh(boot,box,sole,[0,-.105*u,.106*u],[.23*u,.035*u,.45*u])
    for(let i=0;i<4;i++)mesh(boot,box,trim,[0,(.04+i*.039)*u,.11*u],[.13*u,.012*u,.022*u])
    mesh(boot,box,trim,[side*.108*u,.12*u,0],[.014*u,.17*u,.045*u])
    return {shorts,boot}
  })
  const fists=[-1,1].map(side=>{
    const glove=new T.Group();gear.add(glove)
    mesh(glove,cylinder,ivory,[0,-.025*u,0],[.115*u,.12*u,.115*u])
    mesh(glove,cylinder,leather,[0,.005*u,0],[.124*u,.07*u,.124*u])
    mesh(glove,sphere,leather,[0,.12*u,0],[.14*u,.175*u,.145*u])
    mesh(glove,sphere,leather,[side*.105*u,.06*u,.027*u],[.060*u,.105*u,.085*u])
    mesh(glove,box,trim,[0,.12*u,.14*u],[.075*u,.055*u,.012*u])
    return glove
  })
  function mergeStatic(group:T.Object3D) {
    const byMaterial=new Map<T.Material,T.Mesh[]>()
    for(const child of [...group.children]) {
      if(child instanceof T.Group)mergeStatic(child)
      if(child instanceof T.Mesh&&!Array.isArray(child.material)) {
        const meshes=byMaterial.get(child.material)??[];meshes.push(child);byMaterial.set(child.material,meshes)
      }
    }
    for(const [material,meshes] of byMaterial)if(meshes.length>1) {
      const parts=meshes.map(m=>{m.updateMatrix();return (m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()).applyMatrix4(m.matrix)})
      const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose())
      if(merged){ownedGeometry.add(merged);const object=new T.Mesh(merged,material);object.castShadow=true;object.receiveShadow=true;group.add(object);meshes.forEach(m=>group.remove(m))}
    }
  }
  mergeStatic(gear)
  const curl=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.95)
  for(const r of rest)if(/^(index|middle|ring|pinky|thumb)_0[123]_[lr]$/.test(r.bone.name))r.quaternion.multiply(curl)
  const handTargets=[new T.Vector3(),new T.Vector3()],poles=[new T.Vector3(),new T.Vector3()]
  const footTarget=new T.Vector3(),pole=new T.Vector3(),point=new T.Vector3(),other=new T.Vector3(),direction=new T.Vector3()
  const rotation=new T.Quaternion(),rootRotation=new T.Quaternion(),headRotation=new T.Quaternion()
  const fistPositions=[new T.Vector3(),new T.Vector3()]
  const plantedFeet=[new T.Vector3(),new T.Vector3()]
  let lastPoseTime=-1
  const idlePhase=[...look.id].reduce((sum,c)=>sum+c.charCodeAt(0),0)*.19
  function pose(f:Fighter,time:number,distance:number,reducedMotion:boolean,motionTime=time) {
    const p=boxingPose(f,time,distance,reducedMotion)
    const dt=time-lastPoseTime,resetFeet=lastPoseTime<0||dt<0||dt>.25
    lastPoseTime=time
    const facing=root.rotation.y<0?-1:1,footwork=[boxingFootwork(f,time,0,facing),boxingFootwork(f,time,1,facing)]
    const travel=footwork[0].active?footwork[0].drive:0
    const stepAge=time-(f.stepAt??-10),moving=1-.8*T.MathUtils.smoothstep(stepAge,0,.035)*(1-T.MathUtils.smoothstep(stepAge,.12,.22))
    const strength=reducedMotion||Math.abs(root.rotation.x)>.1?0:(1-Math.max(p.extension,p.charge,p.hurt,p.dodgeBlend))*(1-p.guardBlend*.75)*moving
    const idle=boxingIdle(motionTime,idlePhase+(root.rotation.y<0?1.7:0),strength)
    for(const r of rest) {r.bone.position.copy(r.position);r.bone.quaternion.copy(r.quaternion)}
    avatar.position.set(idle.lateral*u,floorOffset+(-.08+idle.bounce+idle.breath*.006-p.crouch*.003-travel*.018+p.recoil)*u,(p.lean*.003+p.extension*.20+idle.sway+travel*.018)*u)
    bones.spine_01.quaternion.multiply(rotation.setFromEuler(angles.set(p.lean*.009+idle.breath*.012+travel*.025,p.twist*.015,idle.lateral*.7)))
    bones.spine_03.quaternion.multiply(rotation.setFromEuler(angles.set(idle.breath*.018,p.twist*.006,-p.hurt*.08-idle.lateral*.8)))
    bones.Head.quaternion.multiply(rotation.setFromEuler(angles.set(p.hurt*(p.upperHit?-.30:p.bodyHit?.08:-.17)-idle.breath*.012,-p.twist*.004+idle.sway*.3,p.hurt*.06)))
    root.updateMatrixWorld(true)
    root.getWorldQuaternion(rootRotation);rotation.setFromAxisAngle(yAxis,p.hipYaw)
    rotation.premultiply(rootRotation).multiply(q.copy(rootRotation).invert())
    bones.pelvis.getWorldQuaternion(headRotation);rotation.multiply(headRotation)
    bones.pelvis.parent!.getWorldQuaternion(parentQ).invert();bones.pelvis.quaternion.copy(parentQ.multiply(rotation))
    root.updateMatrixWorld(true)
    for(let i=0;i<2;i++) {
      const suffix=i===0?'l':'r',side=i===0?1:-1
      const heel=idle.heels[i]+(i===1?p.arms[1].extension*.12:p.arms[0].extension*.045)
      const foot=footwork[i]
      footTarget.set(side*.19*u,(.115+.28*Math.sin(heel)+(reducedMotion?0:foot.lift))*u,(i===0?.22:-.23)*u+foot.offset)
      pole.set(side*.23*u,.55*u,.65*u)
      root.localToWorld(footTarget);root.localToWorld(pole)
      if(f.stepAt===undefined||resetFeet)plantedFeet[i].copy(footTarget)
      else plantedFeet[i].lerp(footTarget,1-Math.exp(-Math.max(0,dt)*65))
      footTarget.copy(plantedFeet[i])
      ik(bones[`thigh_${suffix}`],bones[`calf_${suffix}`],bones[`foot_${suffix}`],footTarget,pole)
      root.getWorldQuaternion(rootRotation);rotation.copy(rootRotation).multiply(q.setFromEuler(angles.set(heel,0,0))).multiply(restFootQ[i])
      bones[`foot_${suffix}`].parent!.getWorldQuaternion(parentQ).invert()
      bones[`foot_${suffix}`].quaternion.copy(parentQ.multiply(rotation))
      bones[`foot_${suffix}`].updateWorldMatrix(false,true)
      const upper=bones[`thigh_${suffix}`],lower=bones[`calf_${suffix}`]
      root.worldToLocal(upper.getWorldPosition(point));root.worldToLocal(lower.getWorldPosition(other))
      legs[i].shorts.position.copy(point).lerp(other,.29)
      direction.copy(other).sub(point).normalize().negate()
      legs[i].shorts.quaternion.setFromUnitVectors(yAxis,direction)
      root.worldToLocal(bones[`foot_${suffix}`].getWorldPosition(point));legs[i].boot.position.copy(point);legs[i].boot.rotation.x=heel
    }
    root.worldToLocal(bones.pelvis.getWorldPosition(point));waist.position.copy(point).addScaledVector(yAxis,.015*u);waist.rotation.y=p.hipYaw
    root.worldToLocal(bones.Head.getWorldPosition(point));head.position.copy(point)
    root.getWorldQuaternion(rootRotation).invert();bones.Head.getWorldQuaternion(headRotation)
    head.quaternion.copy(rootRotation.multiply(headRotation).multiply(restHeadQ))
    const headY=head.position.y
    for(let i=0;i<2;i++) {
      const suffix=i===0?'l':'r',stroke=p.arms[i],active=p.punch&&stroke.blend>0
      const hand=handTargets[i],pole=poles[i]
      const restY=i===0?-.16:-.24,restZ=i===0?.43:.25
      hand.set((i===0?.20:-.20)*u,headY+(restY+(.04-restY)*p.guardBlend)*u,(restZ+(.36-restZ)*p.guardBlend)*u)
      hand.x+=idle.lateral*u;hand.y+=(idle.breath*.013+Math.sin(motionTime*3.1+idlePhase+i*.8)*.009*strength)*u;hand.z+=idle.sway*.4*u
      hand.y+=p.arms[1-i].extension*.08*u;hand.z-=p.arms[1-i].extension*.025*u
      if(active) {
        const extension=stroke.extension,arc=Math.sin(extension*Math.PI),restZ=i===0?.43:.25
        const reach=Math.max(.53,Math.min(distance-18,MOVES[p.punch!].range*580)/580*4.4)
        const targetX=(i===0?1:-1)*(.20+(p.punch==='hook'?arc*.32:0)-extension*.13)*u
        const targetY=(p.punch==='body'?168:p.punch==='uppercut'?250:235)/255*look.height-p.crouch*.003*u
        const y=hand.y+(targetY-hand.y)*extension-stroke.charge*(p.punch==='uppercut'?.18:.035)*u-(p.punch==='uppercut'?arc*.16:0)
        const z=(restZ+(reach-restZ)*extension-stroke.charge*.11)*u+p.lean*.003*u
        hand.x+=(targetX-hand.x)*stroke.blend;hand.y+=(y-hand.y)*stroke.blend;hand.z+=(z-hand.z)*stroke.blend
      }
      const elbowWidth=.48+(p.punch==='hook'?.10+stroke.extension*.28:p.punch==='uppercut'?-.14:0)*stroke.blend
      pole.set((i===0?elbowWidth:-elbowWidth)*u,(1.27+(p.punch==='hook'?stroke.extension*stroke.blend*.42:0))*u,.14*u)
      root.localToWorld(hand);root.localToWorld(pole)
      ik(bones[`upperarm_${suffix}`],bones[`lowerarm_${suffix}`],bones[`hand_${suffix}`],hand,pole)
      root.worldToLocal(bones[`hand_${suffix}`].getWorldPosition(point));fists[i].position.copy(point)
      root.worldToLocal(bones[`lowerarm_${suffix}`].getWorldPosition(other))
      direction.copy(point).sub(other).normalize()
      fists[i].quaternion.setFromUnitVectors(yAxis,direction)
      fists[i].localToWorld(fistPositions[i].set(0,.22*u,0))
    }
    return p
  }
  return {root,pose,fistPositions,dispose:()=>{
    ownedGeometry.forEach(g=>g.dispose());ownedMaterial.forEach(m=>m.dispose())
    avatar.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.dispose()})
  }}
}
