(() => {
 "use strict";
 const base="/api/v1";
 const $=selector=>document.querySelector("[data-app-module-root] "+selector);
 const safe=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 const state={token:"",projects:[],catalog:[],games:[],enabled:[],selected:[],subscribed:false,projectId:"",loading:false};
 async function api(path,options={}) {
   const response=await fetch(base+path,{...options,headers:{"Content-Type":"application/json",...(state.token?{"Authorization":"Bearer "+state.token}:{}),...(options.headers||{})},cache:"no-store"});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data?.error?.message||"Request failed ("+response.status+")");
   return data;
 }
 function status(message,error=false){const node=$("[data-module-message]");if(node){node.textContent=message;node.dataset.error=String(error)}}
 function render(){
   const select=$("[data-module-project]");
   if(!select)return;
   select.innerHTML='<option value="">Choose a registered app…</option>'+state.projects.map(p=>'<option value="'+safe(p.id)+'">'+safe(p.name)+'</option>').join("");
   select.value=state.projectId;
   const ready=Boolean(state.projectId);
   const projectLabel=state.projects.find(p=>p.id===state.projectId)?.name||"Select an app";
   const summary=$("[data-module-summary]");
   if(summary)summary.textContent=ready?projectLabel+" · "+state.enabled.length+" active module(s) · "+state.selected.length+" selected game(s)":"Select an app to configure modules.";
   const subscription=$("[data-module-subscription]");
   if(subscription)subscription.textContent=!ready?"Choose an app to see its subscription.":state.subscribed?"Active subscription · premium modules unlocked":"Subscription required · premium modules locked. Contact Vedoy Studio to activate your plan.";
   const cards=$("[data-module-cards]");
   if(cards)cards.innerHTML=state.catalog.map(item=>{
     const enabled=state.enabled.includes(item.key),allowed=item.installable && (item.tier!=="subscription"||state.subscribed);
     const locked=item.tier==="subscription"&&!state.subscribed;
     const disabled=!ready||!item.installable||(!enabled&&!allowed)||state.loading;
     return '<article class="app-module-card"><div class="app-module-icon" aria-hidden="true">'+safe(item.icon)+'</div><div class="app-module-heading"><h3>'+safe(item.title)+'</h3><span class="app-module-tier '+(item.tier==="subscription"?"premium":"")+'">'+(item.tier==="subscription"?"✦ Abonnement":"Inkludert")+'</span></div><p>'+safe(item.description)+'</p><small class="app-module-availability">'+safe(item.availability)+ (locked?" · låst":"")+'</small><div class="app-module-bottom"><button type="button" class="button-primary" data-module-toggle="'+safe(item.key)+'" '+(disabled?"disabled":"")+'>'+(!item.installable?"Kommer senere":enabled?"Fjern modul":locked?"Krever abonnement":"Legg til modul")+'</button>'+(item.endpoints?.length?'<button type="button" class="button-secondary" data-module-info="'+safe(item.key)+'">Se API-er</button>':"")+'</div></article>';
   }).join("");
   const games=$("[data-module-games]");
   if(games)games.innerHTML=state.games.map(game=>{
     const selected=state.selected.includes(game.id),canSelect=ready&&state.enabled.includes("games");
     return '<article class="app-game-option"><div class="app-game-symbol" aria-hidden="true">'+safe(game.icon)+'</div><div><strong>'+safe(game.title)+'</strong><small>Spillmotor under migrering</small></div><button type="button" data-game-toggle="'+safe(game.id)+'" '+(!canSelect||state.loading?"disabled":"")+' aria-pressed="'+String(selected)+'">'+(selected?"✓ Lagt til":"Velg")+'</button></article>';
   }).join("");
   const current=$("[data-module-endpoints]");
   if(current){
      const entries=state.catalog.filter(m=>state.enabled.includes(m.key));
      current.innerHTML=entries.length?entries.map(m=>'<article class="app-endpoint-group"><h3>'+safe(m.title)+'</h3>'+(m.endpoints.length?m.endpoints.map(e=>'<code>'+safe(e)+'</code>').join(""):'<p>Ingen offentlig API ennå.</p>')+'</article>').join(""):'<p>Ingen moduler aktivert. Legg til en modul for å se API-ene her.</p>';
   }
 }
 async function syncProject(projectId) {
   state.projectId=projectId;state.enabled=[];state.selected=[];state.subscribed=false;
   if(!projectId){render();return}
   try{
     const result=await api("/projects/"+encodeURIComponent(projectId)+"/modules");
     state.enabled=result.data.modules||[];
     state.selected=result.data.games||[];
     state.subscribed=Boolean(result.data.subscriptionActive);
     render();status("App modules loaded.");
   }catch(e){render();status(e.message,true)}
 }
 async function load(){
   if(!$("[data-module-project]")||!window.vedoySupabase)return;
   const session=await window.vedoySupabase.auth.getSession();
   state.token=session.data.session?.access_token||"";
   const auth=$("[data-module-auth]"),ui=$("[data-module-ui]");
   if(auth)auth.hidden=Boolean(state.token);
   if(ui)ui.hidden=!state.token;
   if(!state.token)return;
   try{
     const [projects,catalog]=await Promise.all([api("/projects"),api("/modules")]);
     state.projects=projects.data||[];
     state.catalog=catalog.data||[];
     state.games=catalog.games||[];
     if(!state.projects.some(x=>x.id===state.projectId))state.projectId=state.projects[0]?.id||"";
     await syncProject(state.projectId);
   }catch(e){status(e.message,true)}
 }
 document.addEventListener("change",e=>{if(e.target.matches("[data-module-project]"))syncProject(e.target.value)});
 document.addEventListener("click",async e=>{
   if(e.target.closest("[data-module-signin]")){document.querySelector("#account-button")?.click();return}
   const info=e.target.closest("[data-module-info]");
   if(info){
     const item=state.catalog.find(x=>x.key===info.dataset.moduleInfo);
     const detail=$("[data-module-inspector]");
     if(item&&detail){detail.hidden=false;detail.innerHTML='<h3>'+safe(item.title)+' — API reference</h3><p>'+safe(item.description)+'</p>'+(item.endpoints?.length?item.endpoints.map(x=>'<pre>'+safe(x)+'</pre>').join(""):'<p>API not yet published.</p>')+'<p>API keys belong on your backend. Subscription and project permissions are checked by the server.</p>';}
     return;
   }
   const toggle=e.target.closest("[data-module-toggle],[data-game-toggle]");
   if(!toggle||state.loading||!state.projectId)return;
   const isGame=toggle.hasAttribute("data-game-toggle"),key=isGame?toggle.dataset.gameToggle:toggle.dataset.moduleToggle;
   const active=isGame?state.selected.includes(key):state.enabled.includes(key);
   state.loading=true;render();
   try{
     await api("/projects/"+state.projectId+"/"+(isGame?"games":"modules")+"/"+encodeURIComponent(key),{method:active?"DELETE":"PUT"});
     await syncProject(state.projectId);
     status((active?"Removed ":"Added ")+key+".");
   }catch(e){status(e.message,true)}finally{state.loading=false;render()}
 });
 document.addEventListener("vedoy-page-change",e=>{if(e.detail?.page==="app-modules")setTimeout(load,0)});
 const setup=setInterval(()=>{if(!window.vedoySupabase)return;clearInterval(setup);window.vedoySupabase.auth.onAuthStateChange(()=>{if($("[data-app-module-root]"))setTimeout(load,0)});if(location.hash==="#app-modules")load()},100);
 setTimeout(()=>clearInterval(setup),5000);
})();
