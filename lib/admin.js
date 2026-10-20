import {query} from '../lib/database.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json');
  const send=(status,value)=>{res.statusCode=status;res.end(JSON.stringify(value));};
  try {
    const token=(req.headers.authorization||'').replace(/^Bearer /,'');
    if(!token) return send(401,{error:'Sign in required'});
    const auth=await fetch(`${process.env.SUPABASE_URL||'https://niedmgyyougvgiiuwcvw.supabase.co'}/auth/v1/user`,{headers:{Authorization:`Bearer ${token}`,apikey:process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_7PrmP1V4enFECw0jfTAiDw_XAXD-xqd'}});
    const user=await auth.json();
    if(!auth.ok||user.app_metadata?.role!=='admin')return send(403,{error:'Administrator access required'});
    if(req.method==='GET'){
      const projects=await query('select id,name,status,rate_limit_per_minute,created_at from developer_projects order by created_at desc limit 200');
      const keys=await query('select id,project_id,name,key_prefix,revoked_at from developer_api_keys order by created_at desc limit 200');
      return send(200,{projects:projects.rows,keys:keys.rows});
    }
    if(req.method!=='POST')return send(405,{error:'Method not allowed'});
    const input=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!/^[0-9a-f-]{36}$/i.test(input?.id||''))return send(422,{error:'Invalid resource ID'});
    if(input.action==='project-status'&&['active','paused','closed'].includes(input.status)){
      const result=await query('update developer_projects set status=$2,updated_at=now() where id=$1 returning id,status',[input.id,input.status]);
      return send(result.rowCount?200:404,{data:result.rows[0]});
    }
    if(input.action==='revoke-key'){
      const result=await query('update developer_api_keys set revoked_at=coalesce(revoked_at,now()) where id=$1 returning id,revoked_at',[input.id]);
      return send(result.rowCount?200:404,{data:result.rows[0]});
    }
    return send(422,{error:'Invalid action'});
  }catch{return send(500,{error:'Administration request failed'});}
}
