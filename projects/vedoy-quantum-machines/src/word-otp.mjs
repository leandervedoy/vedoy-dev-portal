/**
 * Educational word-segment OTP-like cipher. NOT production E2EE.
 * Each UTF-8 word, punctuation and whitespace segment consumes its own
 * non-overlapping pad bytes. Only FLAT ciphertext is transportable.
 * WebCrypto CSPRNG has no mathematical true-OTP guarantee.
 */
const te = new TextEncoder();
const td = new TextDecoder("utf-8",{fatal:true});
export const MAX_BYTES = 4096;
function secureBytes(n){
 if(!globalThis.crypto?.getRandomValues)throw Error("WebCrypto required");
 if(!Number.isInteger(n)||n<1||n>MAX_BYTES)throw RangeError("Invalid entropy length");
 return crypto.getRandomValues(new Uint8Array(n));
}
export function segmentWords(text){
 if(typeof text!=="string"||!text.length)throw Error("Empty message");
 if(typeof Intl.Segmenter!=="function")throw Error("Intl.Segmenter required");
 return Array.from(new Intl.Segmenter("nb",{granularity:"word"}).segment(text),x=>({text:x.segment,word:Boolean(x.isWordLike)}));
}
export function xor(a,b){
 if(!(a instanceof Uint8Array)||!(b instanceof Uint8Array)||a.length!==b.length||a.length<1||a.length>MAX_BYTES)
  throw Error("One independent pad byte is required per message byte");
 const out=new Uint8Array(a.length);
 for(let i=0;i<a.length;i++)out[i]=a[i]^b[i];
 return out;
}
function b64(bytes){let raw="";for(const b of bytes)raw+=String.fromCharCode(b);return btoa(raw);}
function unb64(s){
 if(typeof s!=="string"||s.length>10000||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))throw Error("Invalid base64");
 return Uint8Array.from(atob(s),c=>c.charCodeAt(0));
}
export async function makePad(length,{requireQuantum=false,qrng=null}={}){
 const local=secureBytes(length);
 if(!requireQuantum)return {bytes:local,source:"Local CSPRNG demo; NOT quantum"};
 if(!qrng||typeof qrng.readAttestedBytes!=="function"){
  local.fill(0);
  throw Error("Quantum entropy unavailable: attach and verify real QRNG hardware");
 }
 let p;
 try{p=await qrng.readAttestedBytes(length);}
 catch(e){local.fill(0);throw e;}
 if(!p||p.attestationVerified!==true||!(p.bytes instanceof Uint8Array)||p.bytes.length!==length||typeof p.provider!=="string"||!p.provider.trim()){
  local.fill(0);if(p?.bytes instanceof Uint8Array)p.bytes.fill(0);
  throw Error("Unverified QRNG entropy; refusing quantum mode");
 }
 const mixed=xor(local,p.bytes);
 local.fill(0);p.bytes.fill(0);
 return {bytes:mixed,source:"QRNG adapter-reported + local CSPRNG (experimental)",provider:p.provider};
}
export async function encryptWords(text,options={}){
 const parts=segmentWords(text);
 const raw=te.encode(text);
 if(raw.length>MAX_BYTES)throw RangeError("Message larger than 4096 UTF-8 bytes");
 const entropy=await makePad(raw.length,options);
 const flat=new Uint8Array(raw.length);
 const visual=[];
 let offset=0;
 try{
  for(const part of parts){
   const piece=te.encode(part.text);
   const cipher=xor(piece,entropy.bytes.subarray(offset,offset+piece.length));
   flat.set(cipher,offset);
   visual.push({text:part.text,word:part.word,bytes:piece.length,hex:[...cipher.subarray(0,8)].map(x=>x.toString(16).padStart(2,"0")).join("")});
   offset+=piece.length;piece.fill(0);cipher.fill(0);
  }
  if(offset!==raw.length)throw Error("UTF-8 reconstruction mismatch");
  const envelope={v:1,type:"word-otp-research",ciphertext:b64(flat)};
  return {envelope,localPad:entropy.bytes,visual,source:entropy.source,provider:entropy.provider||null,bytes:raw.length};
 }catch(e){entropy.bytes.fill(0);throw e;}
 finally{raw.fill(0);flat.fill(0);}
}
export function decryptLocally(envelope,localPad){
 if(envelope?.v!==1||envelope.type!=="word-otp-research")throw Error("Invalid research envelope");
 const encoded=unb64(envelope.ciphertext);
 try{const result=xor(encoded,localPad);try{return td.decode(result);}finally{result.fill(0);}}
 finally{encoded.fill(0);}
}
