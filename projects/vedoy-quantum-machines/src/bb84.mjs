/** BB84 simulation only: no photons, reconciliation, authentication, or real QKD keys. */
const between=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
export const expectedQber=(intercept,noise=0)=>{
 if(!between(intercept,0,1)||!between(noise,0,.5))throw RangeError("Probability");
 const attack=intercept/4;return attack+noise-2*attack*noise;
};
export const fiberTransmission=km=>{
 if(!between(km,0,150))throw RangeError("Distance");
 return 10**(-.2*km/10);
};
const next=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
export function simulateBB84({rounds=2048,intercept=.4,noise=.01,km=10}={},rng=next){
 if(!Number.isInteger(rounds)||!between(rounds,128,20000)||!between(intercept,0,1)||!between(noise,0,.5)||!between(km,0,150))throw RangeError("Invalid BB84 settings");
 const bit=()=>rng()<.5?0:1;
 const basis=()=>rng()<.5?"Z":"X";
 let detected=0, attacked=0;
 const sifted=[],preview=[];
 for(let i=0;i<rounds;i++){
  const a=bit(),ab=basis(),bb=basis(),eve=rng()<intercept;
  if(eve)attacked++;
  if(rng()>=fiberTransmission(km))continue;
  detected++;
  let transfer=a,tb=ab,eb=null;
  if(eve){eb=basis();transfer=eb===ab?a:bit();tb=eb;}
  let b=bb===tb?transfer:bit();
  if(rng()<noise)b^=1;
  if(ab===bb)sifted.push({a,b});
  if(preview.length<24)preview.push({aliceBit:a,aliceBasis:ab,bobBit:b,bobBasis:bb,eveBasis:eb,matched:ab===bb,error:ab===bb&&a!==b});
 }
 const ids=sifted.map((_,i)=>i);
 for(let i=ids.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
 const sample=Math.floor(sifted.length*.2);
 const errors=ids.slice(0,sample).filter(i=>sifted[i].a!==sifted[i].b).length;
 return {counts:{sent:rounds,attacked,detected,sifted:sifted.length,revealed:sample,remaining:sifted.length-sample,finalSecureBits:0},
  expectedQber:expectedQber(intercept,noise),observedQber:sample>=32?errors/sample:null,preview,
  settings:{rounds,intercept,noise,km},securityVerified:false};
}
