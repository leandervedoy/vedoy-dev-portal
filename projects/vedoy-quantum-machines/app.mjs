import {simulateBB84} from './src/bb84.mjs';
import {encryptWords,decryptLocally} from './src/word-otp.mjs';
const get=id=>document.getElementById(id);
const percent=n=>n===null?'For lite utvalg':(100*n).toLocaleString('nb-NO',{maximumFractionDigits:2})+' %';
const format=n=>n.toLocaleString('nb-NO');
let ephemeral=null;
function revokePad(){
 if(ephemeral?.localPad)ephemeral.localPad.fill(0);
 ephemeral=null;
 get('decrypt-button').disabled=true;
}
window.addEventListener('pagehide',revokePad);
for(const [id,value,formatLabel] of [
 ['intercept','intercept-value',v=>v+' %'],
 ['noise','noise-value',v=>v+' %'],
 ['distance','distance-value',v=>v+' km']]){
 const el=get(id);
 el.addEventListener('input',()=>{get(value).textContent=formatLabel(el.value);});
}
get('bb-form').addEventListener('submit',event=>{
 event.preventDefault();
 try {
  const r=simulateBB84({
   rounds:Number(get('rounds').value),
   intercept:Number(get('intercept').value)/100,
   noise:Number(get('noise').value)/100,
   km:Number(get('distance').value)
  });
  get('bb-expected').textContent=percent(r.expectedQber);
  get('bb-observed').textContent=percent(r.observedQber);
  get('bb-remaining').textContent=format(r.counts.remaining);
  get('bb-validated').textContent='0';
  const setBar=(name,value)=>{get(name+'-bar').style.width=((value??0)*100)+'%';get(name+'-text').textContent=percent(value);};
  setBar('expected',r.expectedQber);
  setBar('observed',r.observedQber);
  get('bb-status').textContent='Sendt '+format(r.counts.sent)+' signaler · '+format(r.counts.detected)+' detektert · '+format(r.counts.sifted)+' samme basis · '+format(r.counts.revealed)+' kontrollbiter offentliggjort. Ingen endelig sikker nøkkel produsert.';
  const table=get('bb-preview');table.replaceChildren();
  for(let i=0;i<r.preview.length;i++){
   const p=r.preview[i];const tr=document.createElement('tr');
   for(const value of [i+1,p.aliceBit,p.aliceBasis,p.bobBit,p.bobBasis,p.matched?'Ja':'Nei']){
    const td=document.createElement('td');td.textContent=String(value);tr.append(td);
   }
   table.append(tr);
  }
 }catch(e){get('bb-status').textContent='Simuleringsfeil: '+e.message;}
});
get('otp-form').addEventListener('submit',async event=>{
 event.preventDefault();
 revokePad();
 const alert=get('otp-alert');
 alert.textContent='Genererer lokale testbyte…';
 try{
  const text=get('message').value;
  const requireQuantum=get('entropy').value==='quantum';
  const r=await encryptWords(text,{requireQuantum});
  ephemeral={localPad:r.localPad,envelope:r.envelope,original:text};
  get('decrypt-button').disabled=false;
  get('otp-words').textContent=format(r.visual.filter(s=>s.word).length);
  get('otp-segments').textContent=format(r.visual.length);
  get('otp-bytes').textContent=format(r.bytes);
  get('otp-padbytes').textContent=format(r.localPad.length);
  alert.textContent='Kilde: '+r.source+'. Lokal forskningsdemo, ingen nøkler utlevert til andre enheter.';
  const list=get('otp-segment-list');list.replaceChildren();
  for(const segment of r.visual){
   const div=document.createElement('div');
   div.className='segment'+(segment.word?'':' sep');
   const b=document.createElement('b');b.textContent=segment.word?segment.text:'␣ '+JSON.stringify(segment.text);
   const sub=document.createElement('small');sub.textContent=segment.bytes+' nøkkelbyte · '+segment.hex+(segment.bytes>8?'…':'');
   div.append(b,sub);list.append(div);
  }
  get('otp-output').textContent=JSON.stringify(r.envelope,null,2);
 }catch(e){
  alert.textContent=e.message;
  get('otp-output').textContent='Ingen kryptografisk utdata produsert.';
  get('otp-segment-list').replaceChildren();
  for(const id of ['otp-words','otp-segments','otp-bytes','otp-padbytes'])get(id).textContent='–';
 }
});
get('decrypt-button').addEventListener('click',()=>{
 const alert=get('otp-alert');
 if(!ephemeral){alert.textContent='Ingen lokal testnøkkel tilgjengelig';return;}
 try{
  const clear=decryptLocally(ephemeral.envelope,ephemeral.localPad);
  alert.textContent=clear===ephemeral.original?
   'Lokal dekryptering kontrollert. Dette beviser IKKE sikkerheten til en meldingsapp.':
   'Feil: Melding stemmer ikke. Ikke bruk dette som kryptering.';
 }catch(e){alert.textContent='Dekryptering feilet: '+e.message;}
});
get('message').addEventListener('input',()=>{
 revokePad();get('otp-output').textContent='Ingen chiffertekst ennå';
 get('otp-segment-list').replaceChildren();
 get('otp-alert').textContent='Tidligere testpad slettet fra aktiv demotilstand.';
});
get('bb-form').requestSubmit();
