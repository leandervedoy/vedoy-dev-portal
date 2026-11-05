import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const help = `Vedoy CLI v0.1 (safe local MVP)
  vedoy status              Show Git branch, working tree and portal URL
  vedoy save "message"      Stage and commit tracked changes (never pushes)
  vedoy sync                Fetch remote Git changes (no merge)
  vedoy ship --dry-run      Preview checks and deployment (no deployment yet)
  vedoy connect             Show portal configuration (never secrets)
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
