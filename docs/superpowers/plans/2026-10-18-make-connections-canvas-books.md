# Make connections Canvas Books Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real Make connections template so a customer can create a Canvas book, organize three categories with pages, publish an immutable version, and read it through a scoped API key.

**Architecture:** A small workflow registry validates approved template definitions and delegates Canvas Books operations to a focused service backed by PostgreSQL. Draft write routes use the signed-in owner or a scoped server key; published read routes use existing Vedøy project keys, rate limits and usage records. The UI becomes an animated Make connections workspace that calls these routes and links to the generated OpenAPI and SDK artifacts.

**Tech Stack:** Node.js 20 ES modules, Vercel Functions, PostgreSQL/Supabase, Node test runner, Anime.js 4, OpenAPI 3.1.

**Spec:** `docs/superpowers/specs/2026-10-18-make-connections-canvas-books-design.md`

## Global Constraints

- Product copy uses **Make connections**; remove API Builder and Studio as product names.
- Published workflow versions and book snapshots are immutable.
- Customers execute only registered blocks; never execute customer-provided code.
- Service credentials and OAuth tokens stay server-side and are authorized once per workspace.
- Read access is the default; write access requires the explicit `canvas:books:write` scope.
- Page and category counts are derived from stored rows, never accepted from client input.
- Every published contract comes from the same schemas used for runtime validation.
- Anime.js motion must honor `prefers-reduced-motion`.
- OneNote and Google are future connection choices; do not present them as configured until their connectors exist.

## Review Focus

- Duplicate or missing display positions must either normalize deterministically or return `invalid_display_order`; Task 2 pins this behavior.
- A cursor from another category or publication must return `invalid_cursor`, never leak rows; Task 3 pins this behavior.
- A stale or incorrectly scoped API key must return `403 insufficient_scope`; Task 4 pins this behavior.
- Concurrent duplicate publication with one idempotency key must return the same version; Task 5 pins this behavior.
- Draft edits after publication must not change published content or counts; Task 9 pins this behavior.

---

## File structure

- `migrations/004_make_connections_canvas_books.sql`: workflow, connection, book draft, publication and API-key-scope schema.
- `lib/workflow-registry.js`: approved block registry and workflow graph validation.
- `lib/canvas-book-model.js`: pure validation, labels, cursor encoding and response shaping.
- `lib/canvas-books.js`: database operations for drafts, pages and immutable publication.
- `lib/make-connections-api.js`: HTTP-independent operation dispatcher and error mapping.
- `lib/canvas-books-contract.js`: runtime-derived OpenAPI document and SDK metadata for one published workflow version.
- `api/[...path].js`: thin route matching, authentication and response transport.
- `openapi.yaml`: public Canvas Books routes and schemas.
- `sdk/javascript/vedoy-canvas-books.js`: zero-dependency JavaScript client for published reads.
- `sdk/typescript/vedoy-canvas-books.ts`: typed source client using the same public operations.
- `app.js`: Make connections view, route calls and status rendering.
- `index.html`: navigation label and entry point.
- `beginner.css`, `responsive.css`: workspace layout, blocks and responsive states.
- `portal-motion.js`: scoped workspace transitions and reduced-motion behavior.
- `tests/*.test.mjs`: pure domain, service, API, contract and acceptance tests.

### Task 1: Persist approved workflows and Canvas Books

**Files:**
- Create: `migrations/004_make_connections_canvas_books.sql`
- Modify: `scripts/migrate.mjs`
- Test: `tests/migration-canvas-books.test.mjs`

**Interfaces:**
- Consumes: existing `developer_projects`, `developer_api_keys` and PostgreSQL migration runner.
- Produces: tables `developer_service_connections`, `developer_workflows`, `developer_workflow_versions`, `canvas_books`, `canvas_book_categories`, `canvas_book_pages`, `canvas_book_versions`, `canvas_book_version_pages`; `developer_api_keys.scopes text[]`.

- [ ] **Step 1: Write the failing migration contract test**

Assert that migration 004 defines all eight tables, foreign keys to project/workspace ownership, unique category/page positions, immutable publication constraints, an idempotency uniqueness rule, supporting indexes and default API-key scopes containing `canvas:books:read` only.

- [ ] **Step 2: Run the migration contract test and verify failure**

Run: `node --test tests/migration-canvas-books.test.mjs`
Expected: FAIL because migration 004 is absent.

- [ ] **Step 3: Add migration 004 and include it in migration execution**

Use UUID primary keys, cascading draft children, immutable version rows, JSONB metadata, timestamps and explicit positive display-position checks. Preserve existing keys by backfilling `canvas:books:read` before making scopes non-null.

- [ ] **Step 4: Verify migration contract and syntax checks**

Run: `node --test tests/migration-canvas-books.test.mjs && npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add migrations/004_make_connections_canvas_books.sql scripts/migrate.mjs tests/migration-canvas-books.test.mjs && git commit -m "feat: add Canvas Books data model"`

### Task 2: Define approved blocks and book response rules

**Files:**
- Create: `lib/workflow-registry.js`
- Create: `lib/canvas-book-model.js`
- Test: `tests/workflow-registry.test.mjs`
- Test: `tests/canvas-book-model.test.mjs`

**Interfaces:**
- Produces: `validateWorkflow(definition) -> { template, blocks, edges }`; `normalizeBookInput(input)`; `normalizeCategoryInput(input)`; `normalizePageInput(input)`; `pageLabel(categoryName, pageNumber, pageCount)`; `encodePageCursor(payload)`; `decodePageCursor(cursor, expectedContext)`; `shapePublishedPage(row)`.

- [ ] **Step 1: Write failing registry tests**

Test the approved Canvas flow `canvas.book -> canvas.category -> canvas.page -> canvas.publish`, rejection of unknown block types, cycles, disconnected blocks and customer-supplied executable fields such as `code` or `script`.

- [ ] **Step 2: Run registry tests and verify failure**

Run: `node --test tests/workflow-registry.test.mjs`
Expected: FAIL because the registry does not exist.

- [ ] **Step 3: Implement the registry**

Register exact input/output schema metadata and required scopes for the four Canvas blocks. Return a normalized acyclic graph and stable machine-readable validation errors.

- [ ] **Step 4: Write failing model tests**

Assert length limits, metadata object validation, deterministic `Introduksjon · Side 1 av 6`, rejection of duplicate/non-positive positions and contextual cursor rejection.

- [ ] **Step 5: Implement the pure model functions**

Use URL-safe base64 JSON cursors containing publication ID, category ID and last display position; validate every decoded field against the current request context.

- [ ] **Step 6: Run both suites**

Run: `node --test tests/workflow-registry.test.mjs tests/canvas-book-model.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

Run: `git add lib/workflow-registry.js lib/canvas-book-model.js tests/workflow-registry.test.mjs tests/canvas-book-model.test.mjs && git commit -m "feat: validate Make connections workflows"`

### Task 3: Implement Canvas Books draft service

**Files:**
- Create: `lib/canvas-books.js`
- Test: `tests/canvas-books-service.test.mjs`

**Interfaces:**
- Consumes: `query(text, values)` and `transaction(callback)` from `lib/database.js`; normalization and cursor helpers from Task 2.
- Produces: `createBook(ctx, input)`, `createCategory(ctx, bookId, input)`, `createPage(ctx, bookId, categoryId, input)`, `updatePage(ctx, bookId, pageId, input)`, `getDraftSummary(ctx, bookId)`, `listPublishedPages(ctx, versionId, options)` and `getPublishedPage(ctx, versionId, pageId)`.

- [ ] **Step 1: Write failing service tests with a query adapter fixture**

Cover project ownership, three categories with six pages each, derived counts, stable position ordering, page edits, cross-project not-found behavior and rejection of a cursor belonging to another category/version.

- [ ] **Step 2: Run the service suite and verify failure**

Run: `node --test tests/canvas-books-service.test.mjs`
Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement draft and read service functions**

Accept the database adapter as an optional final argument for deterministic tests. Every query includes `project_id`; return `resource_not_found` for both absent and foreign resources.

- [ ] **Step 4: Run service and existing tests**

Run: `node --test tests/canvas-books-service.test.mjs tests/telnyx-pricing.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add lib/canvas-books.js tests/canvas-books-service.test.mjs && git commit -m "feat: add Canvas Books draft service"`

### Task 4: Add scoped authentication and API operation dispatch

**Files:**
- Create: `lib/make-connections-api.js`
- Modify: `api/[...path].js`
- Test: `tests/make-connections-api.test.mjs`

**Interfaces:**
- Consumes: Canvas service functions from Task 3; existing signed-in Supabase user and Vedøy API-key authorization.
- Produces: `handleMakeConnectionsOperation({ method, path, input, query, user, apiAuth }) -> { status, body, headers }`; API-key auth result with `scopes` and `requireScope(scope)`.

- [ ] **Step 1: Write failing API dispatcher tests**

Cover draft book/category/page operations with owner authentication, published reads with `canvas:books:read`, write rejection for read-only keys, `403 insufficient_scope`, stable 404 behavior and validation error envelopes.

- [ ] **Step 2: Run the dispatcher tests and verify failure**

Run: `node --test tests/make-connections-api.test.mjs`
Expected: FAIL because the dispatcher does not exist and API auth omits scopes.

- [ ] **Step 3: Implement scoped auth and thin route delegation**

Load scopes with the API key, expose `requireScope`, route `/v1/make-connections/...` requests to the dispatcher and retain existing rate-limit/usage headers. Avoid adding Canvas SQL directly to the catch-all handler.

- [ ] **Step 4: Run dispatcher tests and syntax checks**

Run: `node --test tests/make-connections-api.test.mjs && npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add lib/make-connections-api.js 'api/[...path].js' tests/make-connections-api.test.mjs && git commit -m "feat: expose scoped Canvas Books operations"`

### Task 5: Publish immutable workflow and book versions

**Files:**
- Modify: `lib/canvas-books.js`
- Modify: `lib/make-connections-api.js`
- Test: `tests/canvas-book-publishing.test.mjs`

**Interfaces:**
- Produces: `publishBook(ctx, bookId, { workflowId, idempotencyKey }) -> PublishedBookVersion`; route `POST /v1/make-connections/books/{bookId}/publish`.

- [ ] **Step 1: Write failing publication tests**

Assert one transaction snapshots 3 categories and 18 pages, increments version numbers, returns the same version for concurrent/repeated idempotency keys, rejects empty books and never exposes an active version until the snapshot is complete.

- [ ] **Step 2: Run publication tests and verify failure**

Run: `node --test tests/canvas-book-publishing.test.mjs`
Expected: FAIL because publication is absent.

- [ ] **Step 3: Implement atomic publication**

Lock the draft book, validate its workflow, insert immutable version records and snapshot pages in stable order. Record a health-checked active workflow version only after all rows exist.

- [ ] **Step 4: Run publication and service suites**

Run: `node --test tests/canvas-book-publishing.test.mjs tests/canvas-books-service.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add lib/canvas-books.js lib/make-connections-api.js tests/canvas-book-publishing.test.mjs && git commit -m "feat: publish immutable Canvas book APIs"`

### Task 6: Generate the public contract and SDK clients

**Files:**
- Create: `lib/canvas-books-contract.js`
- Modify: `lib/make-connections-api.js`
- Modify: `openapi.yaml`
- Create: `sdk/javascript/vedoy-canvas-books.js`
- Create: `sdk/typescript/vedoy-canvas-books.ts`
- Test: `tests/canvas-books-contract.test.mjs`

**Interfaces:**
- Consumes: registered block schemas from Task 2 and immutable workflow versions from Task 5.
- Produces: `createCanvasBooksOpenApi(version) -> OpenAPIObject`; route `GET /v1/make-connections/workflows/{workflowId}/versions/{version}/openapi.json`; SDK metadata plus `VedoyCanvasBooksClient` methods `getBook`, `listCategories`, `listPages` and `getPage`.

- [ ] **Step 1: Write the failing contract parity test**

Assert the generated document uses Task 2 schemas, includes the published version in every route, documents scopes and error envelopes, and both SDKs generate Bearer-authenticated requests with `limit`/`cursor` encoding.

- [ ] **Step 2: Run contract test and verify failure**

Run: `node --test tests/canvas-books-contract.test.mjs`
Expected: FAIL because contract and SDK clients are absent.

- [ ] **Step 3: Implement runtime-derived contract generation and SDK clients**

Generate each version contract directly from the approved registry schemas, expose it through the dispatcher, and add its stable catalog route to `openapi.yaml`. Use the deployed `/api` server base. Keep clients zero-dependency, accept `{ baseUrl, apiKey, fetchImpl }`, and return the API response envelope without hiding request IDs.

- [ ] **Step 4: Run contract and full unit suites**

Run: `node --test tests/canvas-books-contract.test.mjs && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add lib/canvas-books-contract.js lib/make-connections-api.js openapi.yaml sdk tests/canvas-books-contract.test.mjs && git commit -m "feat: publish Canvas Books contract and SDKs"`

### Task 7: Build the Make connections workspace

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `beginner.css`
- Modify: `responsive.css`
- Test: `tests/make-connections-ui.test.mjs`

**Interfaces:**
- Consumes: routes from Tasks 4–5 and generated SDK links from Task 6.
- Produces: `#make-connections` workspace with add/remove blocks, Canvas Books template, 3 × 6 seed action, test response, publish action and More info documentation links.

- [ ] **Step 1: Write a failing rendered-markup behavior test**

Assert removal of Studio/API Builder product labels, presence of Make connections navigation, Canvas template controls, service-add affordance, accessible live status, test/publish controls and no claims that OneNote/Google are configured.

- [ ] **Step 2: Run UI test and verify failure**

Run: `node --test tests/make-connections-ui.test.mjs`
Expected: FAIL against the current API Builder markup.

- [ ] **Step 3: Replace the blueprint UI with the functional workspace**

Render a book hierarchy, block palette and response panel. The acceptance seed creates category labels and `Side 1 av 6` through `Side 6 av 6`; all requests use the authenticated portal session or explicitly entered server API-key context.

- [ ] **Step 4: Add responsive workspace styles**

Use one column below 720px, preserve 44px touch targets, keep the response panel reachable without horizontal scrolling and ensure add/remove controls remain visible at 320px width.

- [ ] **Step 5: Run UI, syntax and build checks**

Run: `node --test tests/make-connections-ui.test.mjs && npm run build`
Expected: PASS and production assets generated.

- [ ] **Step 6: Commit**

Run: `git add index.html app.js beginner.css responsive.css tests/make-connections-ui.test.mjs && git commit -m "feat: add Make connections workspace"`

### Task 8: Add scoped Anime.js workflow motion

**Files:**
- Modify: `portal-motion.js`
- Test: `tests/make-connections-motion.test.mjs`

**Interfaces:**
- Consumes: workspace data attributes from Task 7.
- Produces: a reversible Anime.js scope for block add/remove, connection execution and publication completion.

- [ ] **Step 1: Write a failing motion contract test**

Assert a Make connections scope exists, cleanup is returned, runtime state uses `self.add`, and reduced motion skips transforms while leaving status changes immediate.

- [ ] **Step 2: Run motion test and verify failure**

Run: `node --test tests/make-connections-motion.test.mjs`
Expected: FAIL because workspace motion is absent.

- [ ] **Step 3: Implement scoped motion**

Animate only transform and opacity, cancel replaced animations, keep pointer controls stationary, and revert the scope on SPA navigation.

- [ ] **Step 4: Run motion and build checks**

Run: `node --test tests/make-connections-motion.test.mjs && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add portal-motion.js tests/make-connections-motion.test.mjs assets/vendor/portal-motion.js assets/vendor/portal-motion.js.LEGAL.txt && git commit -m "feat: animate Make connections workflows"`

### Task 9: Prove the 3 × 6 public API journey and document operations

**Files:**
- Create: `tests/canvas-books-acceptance.test.mjs`
- Modify: `README.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: automated acceptance proof and operator setup guidance.

- [ ] **Step 1: Write the end-to-end acceptance test**

Create a book, three named categories and six uniquely titled pages per category; publish; traverse cursor pagination; assert 18 unique pages, correct `categoryName`, `pageNumber`, `pageCount`, `displayLabel`, stable repeated ordering, read-only key behavior and unchanged snapshot after editing the draft.

- [ ] **Step 2: Run acceptance test and fix only integration gaps**

Run: `node --test tests/canvas-books-acceptance.test.mjs`
Expected: PASS.

- [ ] **Step 3: Document migration, auth and connector status**

Document database migration, Canvas template routes, API-key scopes, OpenAPI/SDK locations and the rule that OneNote/Google remain unavailable until their OAuth connectors are configured.

- [ ] **Step 4: Run complete verification**

Run: `npm test && npm run build`
Expected: all tests pass and the production build completes.

- [ ] **Step 5: Commit**

Run: `git add tests/canvas-books-acceptance.test.mjs README.md .env.example && git commit -m "docs: verify Canvas Books API publishing"`

### Task 10: Apply migration, deploy and smoke-test the public alias

**Files:**
- Modify only if required by verified deployment configuration: `.env.example`, `README.md`

**Interfaces:**
- Consumes: successful Task 9 branch, configured Supabase production connection and Vercel project.
- Produces: migrated production database and a deployment whose canonical alias serves the verified Canvas Books API.

- [ ] **Step 1: Confirm exact deployment targets without exposing secrets**

Run: `vercel whoami`, `vercel project ls`, and a read-only database connectivity check through `/api/v1/health`.
Expected: the intended Vedøy Developer Portal project, production scope and Supabase provider are explicit.

- [ ] **Step 2: Apply migration 004 once**

Run: `npm run db:migrate`
Expected: migration succeeds against the intended production database and is recorded by the migration mechanism.

- [ ] **Step 3: Deploy production build**

Run the repository's established Vercel production deployment command.
Expected: deployment succeeds and the canonical alias points at the new deployment.

- [ ] **Step 4: Exercise the live acceptance path**

Create a disposable project/book using authorized test credentials, publish 3 × 6 pages, fetch all pages through the canonical public alias, verify scopes/counts/snapshot behavior, then remove or deactivate the disposable records through supported APIs.

- [ ] **Step 5: Record deployment evidence**

Capture deployment URL, canonical alias, migration result, API version header and acceptance result in the final handoff. Do not claim OneNote or Google connectivity.

