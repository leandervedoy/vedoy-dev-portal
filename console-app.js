(()=>{"use strict";
 const api="/api/v1",client=window.supabase?.createClient&&window.VEDOY_SUPABASE_CONFIG?window.supabase.createClient(window.VEDOY_SUPABASE_CONFIG.url,window.VEDOY_SUPABASE_CONFIG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
 const $=s=>document.querySelector(s);
 const safe=v=>String(v??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
 const state={token:"",projects:[],projectId:"",modules:[],selectedGames:[],catalog:[],games:[],subscription:false,balances:[],loading:false,view:"overview"};
 const notice=(s,error=false)=>{const n=$("#notice");if(n){n.textContent=s;n.classList.toggle("error",error)}};
 const authmsg=s=>{$("#auth-message").textContent=s};
 async function request(url,options={}){
   if(!state.token)throw Error("Du må logge inn.");
   const res=await fetch(api+url,{...options,headers:{"Authorization":"Bearer "+state.token,"Content-Type":"application/json",...(options.headers||{})},cache:"no-store"});
   const obj=await res.json().catch(()=>({}));if(!res.ok)throw Error(obj.error?.message||"API-feil ("+res.status+")");return url==="/modules"?obj:(obj.data??obj);
 }
 function view(name){state.view=name;document.querySelectorAll("[data-panel]").forEach(x=>x.hidden=x.dataset.panel!==name);document.querySelectorAll("[data-view]").forEach(x=>{x.classList.toggle("active",x.dataset.view===name);x.setAttribute("aria-current",x.dataset.view===name?"page":"false")});location.hash=name==="overview"?"":"#"+name;}
 function refresh(){
   const select=$("#project-select");select.innerHTML='<option value="">Velg app</option>'+state.projects.map(p=>'<option value="'+safe(p.id)+'">'+safe(p.name)+'</option>').join("");select.value=state.projectId;
   $("#stat-modules").textContent=String(state.modules.length);$("#stat-games").textContent=String(state.selectedGames.length);
   const balance=state.balances.find(x=>x.project_id===state.projectId)?.balance_microunits;
   const formatted=balance==null?"—":(Number(balance)/1000000).toLocaleString("nb-NO",{maximumFractionDigits:2});
   $("#stat-credits").textContent=formatted;$("#credit-balance").textContent=formatted;
   $("#subscription-status").textContent=state.subscription?"Aktivt abonnement":"Ingen aktivt abonnement";
   const busy=state.loading||!state.projectId;
   $("#module-cards").innerHTML=state.catalog.map(m=>{
     const installed=state.modules.includes(m.key),premium=m.tier==="subscription",blocked=!installed&&premium&&!state.subscription;
     const disabled=busy||!m.installable||blocked||(!installed&&m.requires?.some(r=>!state.modules.includes(r)));
     const label=!m.installable?"Kommer senere":installed?"Fjern modul":blocked?"Krever abonnement":"Legg til modul";
     return '<article class="module-card"><span class="symbol" aria-hidden="true">'+safe(m.icon)+'</span><h3>'+safe(m.title)+'</h3><span class="tag '+(premium?"paid":"")+'">'+(premium?"✦ Abonnement":"Inkludert")+'</span><p>'+safe(m.description)+'</p><div class="module-actions"><button class="secondary" data-module="'+safe(m.key)+'" '+(disabled?"disabled":"")+'>'+safe(label)+'</button><a href="/docs/#'+(m.key==="games"||m.key==="highscores"?"rewards":"security")+'">Guide ↗</a></div></article>';
   }).join("");
   $("#game-cards").innerHTML=state.games.map(g=>{const selected=state.selectedGames.includes(g.id);return '<article class="game-card"><span class="symbol" aria-hidden="true">'+safe(g.icon)+'</span><div class="game-label"><strong>'+safe(g.title)+'</strong><small>Under migrering</small></div><button class="secondary" aria-pressed="'+selected+'" data-game="'+safe(g.id)+'" '+(busy||!state.modules.includes("games")?"disabled":"")+'>'+(selected?"✓ Valgt":"Velg")+'</button></article>'}).join("");
   const enabled=state.catalog.filter(x=>state.modules.includes(x.key));
   $("#enabled-endpoints").innerHTML=enabled.length?enabled.map(x=>'<div class="api-entry"><h3>'+safe(x.title)+'</h3>'+(x.endpoints?.length?x.endpoints.map(e=>'<code>'+safe(e)+'</code>').join(""):'<p>Ingen publisert API ennå.</p>')+'</div>').join(""):'<p>Aktiver en modul for å se API-endepunktene her.</p>';
   $("#create-key").querySelector("button").disabled=busy;
 }
 async function project(id){
   state.projectId=id;state.modules=[];state.selectedGames=[];state.subscription=false;
   if(id){try{const data=await request("/projects/"+encodeURIComponent(id)+"/modules");state.modules=data.modules||[];state.selectedGames=data.games||[];state.subscription=Boolean(data.subscriptionActive)}catch(e){notice(e.message,true)}}
   refresh();
 }
 async function load(){
   const session=await client.auth.getSession();state.token=session.data.session?.access_token||"";
   $("#auth-panel").hidden=Boolean(state.token);$("#workspace").hidden=!state.token;
   $("#session-chip").textContent=state.token?"Innlogget":"Ikke logget inn";
   if(!state.token)return;
   try{
     const [projects,catalog,balances]=await Promise.all([request("/projects"),request("/modules"),request("/credits/balance")]);
     state.projects=projects||[];state.catalog=catalog.data||catalog.modules||[];state.games=catalog.games||[];state.balances=balances||[];
     if(!state.projects.some(p=>p.id===state.projectId))state.projectId=state.projects[0]?.id||"";
     await project(state.projectId);notice(state.projects.length?"Velg en app for å administrere integrasjoner.":"Opprett din første app for å komme i gang.");
   }catch(e){notice(e.message,true)}
 }
 if(!client){authmsg("Kunne ikke starte innlogging. Prøv å laste siden på nytt.");return}
 $("#signin-form").addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,btn=form.querySelector("button");btn.disabled=true;try{const fd=new FormData(form);const result=await client.auth.signInWithPassword({email:String(fd.get("email")),password:String(fd.get("password"))});if(result.error)throw result.error;form.reset();await load()}catch(err){authmsg(err.message)}finally{btn.disabled=false}});
 $("#signout").addEventListener("click",async()=>{await client.auth.signOut();state.token="";state.projects=[];state.projectId="";$("#new-key").hidden=true;await load();});
 $("#project-select").addEventListener("change",e=>project(e.target.value));
 $("#create-app").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;const button=f.querySelector("button");button.disabled=true;try{const created=await request("/projects",{method:"POST",body:JSON.stringify({name:new FormData(f).get("name")})});f.reset();state.projectId=created.id;await load();notice("App opprettet.")}catch(err){notice(err.message,true)}finally{button.disabled=false}});
 $("#create-key").addEventListener("submit",async e=>{e.preventDefault();if(!state.projectId){notice("Velg en app først.",true);return}const f=e.currentTarget,button=f.querySelector("button");button.disabled=true;try{const key=await request("/projects/"+state.projectId+"/api-keys",{method:"POST",body:JSON.stringify({name:new FormData(f).get("name")})});$("#key-value").textContent=key.key;$("#new-key").hidden=false;f.reset();notice("API-nøkkel opprettet. Kopier den nå.")}catch(err){notice(err.message,true)}finally{button.disabled=false}});
 $("#copy-key").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("#key-value").textContent);notice("Nøkkelen er kopiert.")}catch{notice("Kopiering feilet. Marker nøkkelen manuelt.",true)}});
 document.addEventListener("click",async e=>{
   const v=e.target.closest("[data-view],[data-go]");if(v){view(v.dataset.view||v.dataset.go);return}
   const mod=e.target.closest("[data-module]"),game=e.target.closest("[data-game]");if(!mod&&!game||state.loading||!state.projectId)return;
   const isGame=Boolean(game),key=isGame?game.dataset.game:mod.dataset.module,list=isGame?state.selectedGames:state.modules,enabled=list.includes(key);
   state.loading=true;refresh();
   try{await request("/projects/"+state.projectId+"/"+(isGame?"games":"modules")+"/"+encodeURIComponent(key),{method:enabled?"DELETE":"PUT"});await project(state.projectId);notice((enabled?"Fjernet ":"Lagt til ")+key)}
   catch(err){notice(err.message,true)}finally{state.loading=false;refresh()}
 });
 client.auth.onAuthStateChange((_event,session)=>{if(!session?.access_token){state.token="";$("#auth-panel").hidden=false;$("#workspace").hidden=true;$("#session-chip").textContent="Ikke logget inn"}else if(session.access_token!==state.token){load().catch(console.error)}});
 view(["overview","services","modules","keys","billing"].includes(location.hash.slice(1))?location.hash.slice(1):"overview");
 load().catch(err=>authmsg(err.message));
})();
