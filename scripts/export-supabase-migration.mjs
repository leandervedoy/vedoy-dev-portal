import pg from 'pg';
const client=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await client.connect();
try{
 await client.query('begin isolation level repeatable read read only');
 const tables=['developer_projects','developer_api_keys','developer_wallets','developer_ledger_entries','developer_usage_events','developer_provider_quotes','developer_provider_operations','developer_phone_numbers','developer_messages','developer_provider_webhooks','developer_webhook_endpoints','developer_webhook_events','developer_webhook_deliveries','developer_agents','developer_agent_runs'];
 const sql=['begin;','alter table developer_projects disable trigger developer_projects_create_wallet;'];
 if(process.argv.includes('--verify')){
  const results=[];
  for(const table of tables){const r=await client.query(`select '${table}' as resource,count(*) as count,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) as fingerprint from public.${table} t`);results.push(r.rows[0]);}
  console.log(JSON.stringify(results));await client.query('commit');process.exitCode=0;returnResults(results);
 }else{
 const counts={};
 for(const table of tables){
  const exported=await client.query(`select coalesce(json_agg(t),'[]'::json) as records from (select * from public.${table} order by 1) t`);
  const rows=exported.rows[0].records;
  counts[table]=rows.length;
  if(rows.length){const json=JSON.stringify(rows).replace(/'/g,"''");const key=table==='developer_wallets'?'project_id':'id';const updates=Object.keys(rows[0]).filter(c=>c!==key).map(c=>`"${c}"=excluded."${c}"`).join(',');sql.push(`insert into public.${table} select * from json_populate_recordset(null::public.${table}, '${json}'::json) on conflict (${key}) do update set ${updates};`);}
 }
 sql.push('alter table developer_projects enable trigger developer_projects_create_wallet;','commit;');
 await client.query('commit');
 console.log(JSON.stringify({sql:sql.join('\n'),counts}));
 }
}finally{await client.end();}
function returnResults(){}
