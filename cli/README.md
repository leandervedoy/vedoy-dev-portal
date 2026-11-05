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


## Vedoy Control API commands

The CLI reuses the existing Developer Portal REST API. Supported **read-only** commands:

```bash
node bin/vedoy.mjs control health
node bin/vedoy.mjs control projects
node bin/vedoy.mjs control usage
node bin/vedoy.mjs control credits
node bin/vedoy.mjs control limits
node bin/vedoy.mjs control models
node bin/vedoy.mjs control numbers
node bin/vedoy.mjs control agents
node bin/vedoy.mjs control api get projects --json
```

Configure `VEDOY_ACCESS_TOKEN` with an appropriately scoped token for protected endpoints. The default API base is `https://vedoy-dev-portal.vercel.app/api`; override using `VEDOY_API_URL`. The API may reject requests if the token type or permissions do not match the endpoint.

No write operations, Gitea deployment, backup, device authorization, or automatic production changes are implemented. The CLI is on a feature branch and is not yet released or verified in production.

## Future write permissions (scaffold only)

```bash
node bin/vedoy.mjs control permissions
node bin/vedoy.mjs control write plan project-create
node bin/vedoy.mjs control write plan deploy
node bin/vedoy.mjs control write plan backup-create
node bin/vedoy.mjs control write plan server-restart
```

The above commands **never send API write requests**. They only display proposed scopes and approval requirements. Planned scopes: `projects:write`, `deployments:write`, `backups:write`, `servers:admin`.

Before enabling writes, the server must enforce scoped authorization per project, audit every change, use idempotency for retryable operations, and require explicit confirmation for production deployments, destructive changes and server restarts. CLI checks are advisory, not a substitute for server enforcement.
