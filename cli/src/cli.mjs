import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const help = `Vedoy CLI v0.1 (safe local MVP)
  vedoy status              Show Git branch, working tree and portal URL
  vedoy save "message"      Stage and commit tracked changes (never pushes)
  vedoy sync                Fetch remote Git changes (no merge)
  vedoy ship --dry-run      Preview checks and deployment (no deployment yet)
  vedoy connect             Show portal configuration (never secrets)
  vedoy control permissions  Show planned write scopes (no writes enabled)\n  vedoy control write plan <action>  Preview a future write action\n  vedoy control <resource>  GET Developer Portal API data (health, projects, usage, credits, limits, models, numbers, agents)
  vedoy control api get <resource> [--json]  Explicit read-only API retrieval
  vedoy help                Show this help
Environment: VEDOY_PORTAL_URL (defaults to https://vedoy-dev-portal.vercel.app)
`;
export function git(args, cwd = process.cwd()) {
  const p = spawnSync('git', args, { cwd, encoding:'utf8', shell:false });
  if (p.error) throw p.error;
  if (p.status !== 0) throw new Error((p.stderr || p.stdout || 'Git failed').trim());
  return p.stdout.trim();
}
export function planShip() {
  return ['npm run check','npm test','npm run build','create backup (not configured)','request deployment approval (not configured)'];
}
export async function run(argv, io = console, cwd = process.cwd(), executeGit = git) {
  const [cmd, ...args] = argv;
  const portal = process.env.VEDOY_PORTAL_URL || 'https://vedoy-dev-portal.vercel.app';
  if (!cmd || cmd === 'help' || cmd === '--help') return io.log(help);
  if (cmd === 'control' && args[0] === 'permissions') {
    if (args.length !== 1) throw new Error('Usage: vedoy control permissions');
    return io.log(JSON.stringify({status:'planned',writeEnabled:false,scopes:['projects:write','deployments:write','backups:write','servers:admin'],requirements:['short-lived scoped token','server-side authorization','audit log','idempotency key','approval for production or destructive changes']},null,2));
  }
  if (cmd === 'control' && args[0] === 'write') {
    const actions = { 'project-create':{scope:'projects:write',approval:'standard'},'deploy':{scope:'deployments:write',approval:'production'},'backup-create':{scope:'backups:write',approval:'standard'},'server-restart':{scope:'servers:admin',approval:'critical'} };
    if (args[1] !== 'plan' || !Object.hasOwn(actions,args[2]) || args.length !== 3) throw new Error('Usage: vedoy control write plan project-create|deploy|backup-create|server-restart');
    return io.log(JSON.stringify({action:args[2],...actions[args[2]],status:'not-implemented',executed:false,requirements:['authenticated principal','server-side RBAC','audit trail','explicit approval','idempotency']},null,2));
  }
  if (cmd === 'control') {
    const resource = args[0] === 'api' && args[1] === 'get' ? args[2] : args[0];
    const flags = args[0] === 'api' ? args.slice(3) : args.slice(1);
    const routes = {health:'/v1/health',projects:'/v1/projects',usage:'/v1/usage',credits:'/v1/credits/balance',limits:'/v1/rate-limits',models:'/v1/models',numbers:'/v1/numbers',agents:'/v1/agents'};
    if (!Object.hasOwn(routes,resource) || flags.some(f=>f!=='--json')) throw new Error('Unsupported read-only resource or flag. Use vedoy control health|projects|usage|credits|limits|models|numbers|agents [--json]');
    const base = (process.env.VEDOY_API_URL || portal+'/api').replace(/\\/$/,'');
    const headers = {Accept:'application/json'};
    if (process.env.VEDOY_ACCESS_TOKEN) headers.Authorization = 'Bearer '+process.env.VEDOY_ACCESS_TOKEN;
    const response = await fetch(base+routes[resource],{method:'GET',headers,redirect:'error'});
    const body = await response.text();
    if (!response.ok) throw new Error('API '+response.status+': '+body.slice(0,240));
    let data; try { data=JSON.parse(body) } catch { throw new Error('API did not return JSON') }
    return io.log(JSON.stringify(data,null,2));
  }
  if (cmd === 'connect') return io.log('Developer Portal: ' + portal + '\nAuthentication is not yet implemented; no credentials are stored.');
  if (cmd === 'ship') {
    if (args.length !== 1 || args[0] !== '--dry-run') throw new Error('Only vedoy ship --dry-run is supported until authenticated deploy is implemented.');
    return io.log('Planned only (nothing executed):\n' + planShip().map(x=>' - '+x).join('\n'));
  }
  if (cmd === 'status') {
    if (args.length) throw new Error('status accepts no arguments');
    io.log('Branch: ' + executeGit(['branch','--show-current'],cwd));
    io.log('Working tree:\n' + (executeGit(['status','--short'],cwd) || 'clean'));
    return io.log('Developer Portal: ' + portal);
  }
  if (cmd === 'sync') {
    if (args.length) throw new Error('sync accepts no arguments');
    executeGit(['fetch','--all','--prune'],cwd);
    return io.log('Fetched remote refs. No branches merged or files overwritten.');
  }
  if (cmd === 'save') {
    if (args.length !== 1 || !args[0].trim()) throw new Error('Usage: vedoy save "commit message"');
    executeGit(['add','--update'],cwd);
    const staged = executeGit(['diff','--cached','--name-only'],cwd);
    if (!staged) return io.log('No tracked changes to commit.');
    executeGit(['commit','-m',args[0]],cwd);
    return io.log('Committed tracked changes locally. No push or backup was performed.');
  }
  throw new Error('Unknown command: '+cmd+'\n'+help);
}
