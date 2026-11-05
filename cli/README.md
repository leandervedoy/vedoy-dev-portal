# Vedoy CLI — Developer Portal companion (MVP)

A small, **working Node.js CLI** colocated with Vedoy Developer Portal. This is a safe first implementation, not the future Rust binary. The existing portal uses Node.js and PostgreSQL, so this prototype avoids introducing a second runtime prematurely.

## Run

```sh
cd cli
npm test
node bin/vedoy.mjs help
node bin/vedoy.mjs connect
node bin/vedoy.mjs status
node bin/vedoy.mjs ship --dry-run
```

For `status`, `save` and `sync`, run from inside the target Git repository (e.g. `node /path/to/cli/bin/vedoy.mjs status`).

## Implemented
- `status`: branch and working-tree summary
- `save "message"`: stage **tracked** changes and create local Git commit; does not push or back up
- `sync`: fetch refs; never merges
- `connect`: display configured portal URL without exposing secrets
- `ship --dry-run`: print intended pipeline without executing it

## Not implemented
Login, project selection, remote jobs, Gitea, Coolify, Kopia, Vedi AI, deployment, cloud backup, API key provisioning and Rust distribution. These require server-side contracts and security review; commands must not pretend they succeeded.

## Future integration
Use the portal's existing `/api/v1/projects` and bearer-token auth as the starting point. Add explicit CLI device authorization, narrowly scoped short-lived tokens, server-side job queue, audit log and approval gate before deploying. Never send provider secrets to the CLI.

This directory is isolated from the portal's production application and does not change its existing API or build pipeline.
