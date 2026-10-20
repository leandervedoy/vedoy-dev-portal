# Make connections and Canvas Books API design

Date: 2026-10-18

## Purpose

Vedøy Developer Portal will let a customer assemble and publish real APIs from approved building blocks. The customer does not write or host server code. Vedøy operates a shared controlled runtime, produces a versioned API route, and generates the matching OpenAPI contract and SDK packages.

The first built-in template is a books API for Vedøy Canvas. A customer can create a book, organize it into categories, add and edit pages, and publish a read version that another application can fetch with an API key.

## Product surfaces

The existing project remains one product with three surfaces:

1. **Core Functions** explains what the portal can do and leads people into a template or the documentation.
2. **Make connections** is the visual application workspace. It replaces the API Builder and Studio naming. Customers add, remove and connect approved blocks, test the flow, and publish it.
3. **Developer Documentation** contains the deeper API, authentication, OpenAPI and SDK material. Every relevant block has a More info link into this documentation.

The old Studio navigation group is removed. Make connections is presented as a focused workspace inside the same deployed project, with its own app-like layout.

## Experience and motion

Make connections uses Anime.js scopes so animation lifecycles are tied to the current workspace view. Adding a block animates it into place, removing one closes the gap, and executing a test animates the data path from input through each block to the response. A successful publish resolves into the route, version and SDK actions.

Motion exists to explain state and make the experience memorable. It must not delay input, hide errors or move controls away from the pointer. `prefers-reduced-motion` disables travel and replaces it with immediate state changes or short fades.

## Controlled runtime

A published connection is a versioned workflow definition, not arbitrary customer code. The runtime accepts only registered block types with validated settings. Each block declares its input schema, output schema, permissions, timeout policy and usage unit.

Publication performs these steps atomically:

1. Validate the workflow graph and required service connections.
2. Save an immutable workflow version.
3. Generate an OpenAPI 3.1 document from the same schemas the runtime uses.
4. Expose the version at a stable project-scoped API route.
5. Generate supported SDK packages from the published contract.
6. Mark the version active only after a health check succeeds.

Existing project API keys, rate limits, usage records and credit controls are reused. Provider credentials and OAuth refresh tokens remain server-side. A test run is visibly marked as sample data unless it executes against an explicitly connected service.

## Service connections

Each external service is authorized once per Vedøy workspace and may be reused by several workflows. A workflow receives only the selected resource and permissions, rather than the entire external account. Reauthorization is required only when access expires, is revoked or needs broader permissions.

The initial connection catalog contains:

- Vedøy Canvas
- Microsoft OneNote
- Google Drive and Google Docs
- Google Sheets

The UI lets customers add more supported services later. A service appearing in the catalog does not imply that its OAuth client is configured; unavailable services show the exact setup state.

## Canvas Books template

The first template contains four user-facing capabilities:

1. Create a book with title, description, optional metadata and cover reference.
2. Add categories and add or edit pages within a category.
3. Fetch one page or a cursor-paginated list of pages.
4. Publish an immutable read version that applications can access with an API key.

Draft content stays editable. Publishing snapshots the book structure and page content so existing applications receive consistent results. Publishing a later version does not change an older version. Read access is the default. Write access is a separate scope and is never included in a public client key.

### Data model

- `books`: workspace, owner, title, description, cover, metadata and draft state.
- `book_categories`: book, name and explicit display order.
- `book_pages`: category, title, body, metadata and explicit display order.
- `book_versions`: immutable publication record and version number.
- `book_version_pages`: immutable page snapshot or content-addressed snapshot reference.

Page count is derived from stored pages. It is not trusted from client input. Category order and page order use stable explicit positions.

### Published response fields

Book responses include `categoryCount` and `pageCount`. Category responses include `name` and `pageCount`. Page responses include `categoryName`, `pageNumber`, `pageCount`, `title`, `content` and metadata. Human-readable display text may be generated from those fields, but the API does not require clients to parse text.

Example page representation:

```json
{
  "id": "page_intro_01",
  "categoryName": "Introduksjon",
  "pageNumber": 1,
  "pageCount": 6,
  "displayLabel": "Introduksjon · Side 1 av 6",
  "title": "Velkommen",
  "content": {}
}
```

### Routes

The exact public base path follows the existing project routing convention. The generated contract includes equivalent operations for:

- create a draft book;
- create a category;
- create and edit a page;
- publish a book version;
- fetch a published book;
- list published categories;
- list published pages with `limit` and `cursor`;
- fetch one published page.

Write routes require a server key with explicit write scopes. Published read routes accept a project API key scoped to the selected API and version.

## Acceptance scenario

The main end-to-end control creates one book with three categories and six pages in each category.

The system must report:

- the book as `3 categories` and `18 pages`;
- every category as `6 pages`;
- pages in each category as `Side 1 av 6` through `Side 6 av 6`;
- exactly 18 unique pages when all paginated results are traversed;
- stable ordering across repeated reads;
- the published snapshot unchanged after the draft is edited;
- access denied for a missing, invalid or incorrectly scoped API key.

## Errors and operational behavior

Validation errors return stable machine-readable codes with field details. Missing resources do not reveal whether another workspace owns them. Duplicate publish requests use an idempotency key. Runtime timeouts and connector failures record a request ID without logging secrets or full private page content.

A publication can be deactivated or rolled back to a previous healthy version. Existing immutable versions remain available only according to the project's retention and access policy.

## Security boundaries

All workspace and content queries enforce ownership on the server and in database policies where supported. API keys are stored as hashes and shown in full only once. OAuth tokens are encrypted at rest. Customer-controlled text is treated as data and never executed. Cover and attachment references use approved storage locations and signed access where required.

## Verification

Verification covers workflow schema validation, category and page counting, cursor pagination, immutable publication, API key scopes, cross-workspace isolation, OpenAPI parity with runtime validation, SDK request generation and reduced-motion behavior. The 3 × 6 acceptance scenario is also exercised through the public published route.

## Delivery boundary

The first delivery makes the Canvas Books template functional end to end. OneNote and Google appear as later connection choices only when their OAuth clients and connector implementations are ready. The interface supports adding services later without redesigning the workflow model.
