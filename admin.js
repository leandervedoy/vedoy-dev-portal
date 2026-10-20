import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const config=window.VEDOY_SUPABASE_CONFIG;
const client=createClient(config.url,config.publishableKey);
const status=document.querySelector('#status');
async function request(input){
  const {data:{session}}=await client.auth.getSession();
  if(!session)throw new Error('Sign in through the Developer Portal first.');
  const response=await fetch('/api/admin',{method:input?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{})});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Request failed');return result;
}
function row(parent,text,buttons){const article=document.createElement('article');article.className='doc-mini-card';article.style.margin='12px 0';const title=document.createElement('p');title.textContent=text;article.append(title);for(const [label,input]of buttons){const button=document.createElement('button');button.type='button';button.textContent=label;button.style.margin='5px';button.onclick=async()=>{if(!confirm(`${label}?`))return;button.disabled=true;try{await request(input);await load();}catch(error){status.textContent=error.message;button.disabled=false;}};article.append(button);}parent.append(article);}
async function load(){status.textContent='Loading…';try{const data=await request();for(const id of ['projects','keys']){const target=document.getElementById(id);target.replaceChildren();const title=document.createElement('h2');title.textContent=id==='projects'?'Projects':'API keys';target.append(title);}for(const p of data.projects)row(document.querySelector('#projects'),`${p.name} · ${p.status} · ${p.rate_limit_per_minute} requests/min`,[['Activate',{action:'project-status',id:p.id,status:'active'}],['Pause',{action:'project-status',id:p.id,status:'paused'}],['Close',{action:'project-status',id:p.id,status:'closed'}]]);for(const k of data.keys)row(document.querySelector('#keys'),`${k.name} · ${k.key_prefix} · ${k.revoked_at?'Revoked':'Active'}`,k.revoked_at?[]:[['Revoke key',{action:'revoke-key',id:k.id}]]);status.textContent='Administration ready.';}catch(error){status.textContent=error.message;}}
document.querySelector('#refresh').onclick=load;load();
