Warning: truncated output (original token count: 28416)
Total output lines: 302

const pages={
  landing:{title:"Vedøy Developers",label:"VEDØY / BUILD WITH US",lead:"A workspace for your next build."},
  missions:{title:"Choose your mission",label:"VEDØY CORE",lead:"Explore the original mission tour."},
  overview:{title:"Overview",label:"DEVELOPER PORTAL",lead:"Everything you need to build with Vedøy. Connect identity, search, AI, Canvas and Sites through one thoughtful platform."},
  "public-apis":{title:"Public API examples",label:"LEARN / EXTERNAL INTEGRATIONS",lead:"Try dog images, local weather, IP diagnostics and coastal data. Learn with real responses from clearly identified public providers."},
  quickstart:{title:"Quickstart",label:"GET STARTED",lead:"Get oriented, explore the product guides, and request access for the Vedøy capabilities that fit your project."},
  learn:{title:"Learn Vedøy",label:"GUIDES / APIs & SDKs",lead:"Follow practical lessons from your first authenticated request to phone, webhook and agent integrations."},
  authentication:{title:"Authentication",label:"GET STARTED",lead:"A simple overview of how application credentials and user identity fit into the Vedøy platform."},
  personal:{title:"Personal Phone API",label:"API REFERENCE / PERSONAL",lead:"Privacy-first phone numbers, calls and secure messaging for people and personal products."},
  phone:{title:"Developer Portal Phone APIs",label:"API REFERENCE / COMMUNICATIONS",lead:"The canonical communications API reference for numbers, calls and messaging. Vedøy Phone is separate software that requests these APIs after sign-in."},
  business:{title:"Business Number API",label:"API REFERENCE / BUSINESS",lead:"Provision numbers and messaging through one Vedøy contract, with project budgets, usage records and secure server credentials."},
  notify:{title:"Vedøy Notify",label:"PRODUCT / COMMUNICATION WORKFLOWS",lead:"Reliable customer notifications with messages, signed webhooks, delivery history and budget controls."},
  webhooks:{title:"Webhooks",label:"API…27416 tokens truncated…age_id:"sms_mock_"+Date.now(),status:"delivered"},esim:{iccid:"8947000000001234567",qr_payload:"LPA:1$vedoy.mock$eSIM-1GB",status:"ready"},sip:{trunk_id:"trunk_eu_"+Date.now().toString().slice(-6),region:card.querySelector("select")?.value||"Europe",status:"provisioned"},ivr:{flow:[{key:"1",route:"sales"},{key:"2",route:"support"}],status:"saved"},ais:{vessels:[{mmsi:"257123400",lat:59.91,lon:10.73},{mmsi:"257894100",lat:59.88,lon:10.76},{mmsi:"258004200",lat:59.94,lon:10.69}],scanned_at:new Date().toISOString()}};result.textContent=JSON.stringify({ok:true,data:payload[id]},null,2);card.classList.add("ran");toast(`Demo success: -${cost} Vedøy Credits`);});
document.addEventListener("click",e=>{const demo=e.target.closest("[data-demo-key]");if(!demo)return;demo.textContent="Demo key generated ✓";demo.disabled=true;toast("Demo only — no real secret was created");});
const search=document.querySelector("#search-input"),results=document.querySelector("#search-results");
function runSearch(){const q=search.value.trim().toLowerCase();if(!q){results.hidden=true;return;}const matches=Object.entries(pages).filter(([key,p])=>(`${p.title} ${p.label} ${p.lead} ${key}`).toLowerCase().includes(q)).slice(0,6);results.innerHTML=matches.map(([key,p])=>`<a href="#${key}" data-result="${key}">${p.title}<span style="float:right;color:#9aa39b">↗</span></a>`).join("")||'<a href="#">No matching docs</a>';results.hidden=false;results.querySelectorAll("[data-result]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();openPage(a.dataset.result);history.replaceState(null,"",`#${a.dataset.result}`);results.hidden=true;search.value="";}));}
search.addEventListener("input",runSearch);document.addEventListener("click",e=>{if(!e.target.closest(".sidebar-search-wrap"))results.hidden=true;});document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();search.focus();}if(e.key==="Escape"){results.hidden=true;closeMenu(true);}});

