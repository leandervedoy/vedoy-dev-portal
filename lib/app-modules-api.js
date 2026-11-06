import { API_MODULES, REWARDS_GAMES, findApiModule, isRewardGame } from "./module-catalog.js";

const failure = (status, code, message) => Object.assign(new Error(message), { status, code });
const projectPath = /^\/v1\/projects\/([0-9a-f-]{36})\/(modules|games)(?:\/([a-z0-9-]+))?$/i;

async function ownedProject(projectId, userId, query) {
 const result = await query("select id,name,status from developer_projects where id=$1 and owner_id=$2", [projectId,userId]);
 if (!result.rowCount) throw failure(404,"project_not_found","Project not found.");
 return result.rows[0];
}

async function subscriptionActive(projectId, query) {
 const result=await query("select status,valid_until from developer_project_subscriptions where project_id=$1",[projectId]);
 const item=result.rows[0];
 return Boolean(item && ["active","trialing"].includes(item.status) && item.valid_until && new Date(item.valid_until).getTime()>Date.now());
}

async function installedModules(projectId, query) {
 const r=await query("select module_key from developer_app_modules where project_id=$1 order by module_key",[projectId]);
 return r.rows.map(x=>x.module_key);
}
async function installedGames(projectId, query) {
 const r=await query("select game_key from developer_app_games where project_id=$1 order by game_key",[projectId]);
 return r.rows.map(x=>x.game_key);
}

export async function handleAppModuleRoutes({req,res,path,query,body,send,requireUser,authorizeApiKey}) {
 if(req.method==="GET"&&path==="/v1/modules"){
   send(res,200,{data:API_MODULES,games:REWARDS_GAMES},{ "Cache-Control":"public,max-age=180" });return true;
 }
 if(req.method==="GET"&&path==="/v1/rewards/games"){
   send(res,200,{data:REWARDS_GAMES,availability:"catalog-only",awardsCoins:false,note:"Game engines are not hosted in this API yet."},{"Cache-Control":"public,max-age=180"});return true;
 }
 const match=path.match(projectPath);
 if(match){
   const [,projectId,resource,key]=match;
   const user=await requireUser(req);
   await ownedProject(projectId,user.id,query);
   if(req.method==="GET"&&!key){
     const [modules,games,subscription]=await Promise.all([installedModules(projectId,query),installedGames(projectId,query),subscriptionActive(projectId,query)]);
     send(res,200,{data:{projectId,modules,games,subscriptionActive:subscription}});return true;
   }
   if(resource==="modules"&&key&&["PUT","DELETE"].includes(req.method)){
     const module=findApiModule(key);
     if(!module)throw failure(404,"module_not_found","Unknown module.");
     if(!module.installable)throw failure(409,"module_not_ready","This module is not available for activation.");
     if(req.method==="PUT"){
       if(module.tier==="subscription"&&!(await subscriptionActive(projectId,query)))throw failure(402,"subscription_required","An active project subscription is required for this module.");
       if(module.requires?.length){
         const enabled=await installedModules(projectId,query);
         if(module.requires.some(required=>!enabled.includes(required)))throw failure(409,"module_dependency_required","Activate the Games module first.");
       }
       await query("insert into developer_app_modules(project_id,module_key) values($1,$2) on conflict do nothing",[projectId,key]);
     }else{
       if(key==="games"&&(await installedModules(projectId,query)).includes("highscores"))throw failure(409,"module_dependency_in_use","Remove Highscore API before removing Games.");
       await query("delete from developer_app_modules where project_id=$1 and module_key=$2",[projectId,key]);
       // Game selections remain stored as drafts so that highscore history remains intact.
     }
     send(res,200,{data:{projectId,module:key,enabled:req.method==="PUT"}});return true;
   }
   if(resource==="games"&&key&&["PUT","DELETE"].includes(req.method)){
     if(!isRewardGame(key))throw failure(404,"game_not_found","Unknown game.");
     const modules=await installedModules(projectId,query);
     if(!modules.includes("games"))throw failure(409,"games_module_required","Activate the Games module first.");
     if(req.method==="PUT")await query("insert into developer_app_games(project_id,game_key) values($1,$2) on conflict do nothing",[projectId,key]);
     else { const scores=await query("select 1 from developer_app_highscores where project_id=$1 and game_key=$2 limit 1",[projectId,key]); if(scores.rowCount)throw failure(409,"game_has_scores","This game has scores. Archive or export them before removing the game."); await query("delete from developer_app_games where project_id=$1 and game_key=$2",[projectId,key]); }
     send(res,200,{data:{projectId,game:key,selected:req.method==="PUT"}});return true;
   }
   throw failure(405,"method_not_allowed","Unsupported project module operation.");
 }
 if(path==="/v1/rewards/highscores"&&(req.method==="GET"||req.method==="POST")){
   const auth=await authorizeApiKey(req,path,0);
   const enabled=await installedModules(auth.project_id,query);
   if(!enabled.includes("games")||!enabled.includes("highscores"))throw failure(403,"module_not_enabled","Games and Highscore API must be enabled for this project.");
   if(!(await subscriptionActive(auth.project_id,query)))throw failure(402,"subscription_required","An active subscription is required to use the Highscore API.");
   const url=new URL(req.url,"https://developer.vedoy.local");
   if(req.method==="GET"){
      const game=String(url.searchParams.get("game")||"");
      if(!isRewardGame(game))throw failure(422,"invalid_game","Specify a valid game ID.");
      const rows=await query("select player_alias,score,created_at from developer_app_highscores where project_id=$1 and game_key=$2 order by score desc,created_at asc limit 50",[auth.project_id,game]);
      send(res,200,{data:rows.rows,verified:false,note:"Beta, developer-submitted scores. No Rewards coins."},{"Cache-Control":"no-store"});return true;
   }
   const input=await body(req);
   const game=String(input.game||"");
   const alias=String(input.playerAlias||"").trim();
   const score=Number(input.score);
   const idempotency=String(req.headers["idempotency-key"]||"");
   if(!isRewardGame(game)||!alias||alias.length>36||/[\x00-\x1f<>]/.test(alias)||!Number.isSafeInteger(score)||score<0||score>100000000||idempotency.length<8||idempotency.length>200)throw failure(422,"invalid_highscore","Provide game, a playerAlias (1-36 characters), integer score (0-100000000) and an Idempotency-Key (8-200 characters).");
   const selected=await installedGames(auth.project_id,query);
   if(!selected.includes(game))throw failure(403,"game_not_enabled","Select the game in App Modules before submitting highscores.");
   const rows=await query("insert into developer_app_highscores(project_id,game_key,player_alias,score,idempotency_key) values($1,$2,$3,$4,$5) on conflict(project_id,idempotency_key) do nothing returning id,game_key,player_alias,score,created_at",[auth.project_id,game,alias,score,idempotency]);
   if(!rows.rowCount)throw failure(409,"duplicate_score","This Idempotency-Key was already used.");
   send(res,201,{data:rows.rows[0],verified:false,awardedCoins:0,note:"Beta score only; server-side result verification is planned."});return true;
 }
 return false;
}
