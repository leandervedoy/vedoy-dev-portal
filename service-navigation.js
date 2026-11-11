/* Progressive navigation enhancement: only project-enabled modules appear in My services.
   Global documentation remains discoverable under Platform APIs. */
(()=>{"use strict";
 const target=document.querySelector("[data-my-services]");
 if(!target)return;
 const safe=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 const entries={games:{title:"Game Library",page:"app-modules"},highscores:{title:"Highscore API",page:"app-modules"},statistics:{title:"Vedoy Statistics",page:"app-modules"},advertize:{title:"Vedoy Advertize",page:"app-modules"},rewards:{title:"Vedoy Rewards",page:"app-modules"},spotlight:{title:"Vedoy Spotlight",page:"app-modules"}};
 function render(keys,projectId){
   const active=[...new Set(keys)].filter(k=>entries[k]);
   target.innerHTML='<a class="nav-link" href="#app-modules" data-page="app-modules">＋ Add or manage services</a>'+
    (active.length?active.map(k=>'<a class="nav-link" href="#'+entries[k].page+'" data-page="'+entries[k].page+'" data-service-key="'+safe(k)+'">▸ '+safe(entries[k].title)+'</a>').join(""):'<p class="my-services-empty">No services activated for this project.</p>');
   target.dataset.projectId=projectId||"";
 }
 document.addEventListener("vedoy-modules-changed",event=>{
   const d=event.detail||{};render(Array.isArray(d.modules)?d.modules:[],d.projectId);
 });
 render([],"");
})();
