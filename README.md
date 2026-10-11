# Shop admin · House port

Master1150 demo-data correction: the full pinned upstream demo generator is now reproduced offline and adapted to the current Room schema. See [DEMO_DATA.md](DEMO_DATA.md) for counts, exact source/dependency hashes, field mapping, and readback evidence. The Room now contains exactly 2,005 donor documents and zero legacy fixtures after owner-confirmed removal of 72 unchanged generated documents. Earlier synthetic-seed and additive-population counts below are historical. No demo records are bundled as live App fallback data.

Current bridge migration: Master’s 2026-10-11 live go has been applied locally. The port pins the published MIT bridge `0.1.0-ce524f6608238` and uses the exact host-provided client from `connectHouseBridge().runtime`. Runtime imports/construction are removed. Earlier dated check counts and old bridge-gap findings below are historical; see the current migration result at the end. That earlier publication wait is historical; publication and Room binding have since been independently verified, with current release references recorded in the Porting status.

Local ordinary House App based on [marmelab/react-admin examples/demo](https://github.com/marmelab/react-admin/tree/f1213e048d60d83df74900b2fc8415fd3287610c/examples/demo), pinned to commit `f1213e048d60d83df74900b2fc8415fd3287610c`. Upstream MIT license and dependency notices are retained.

## Interface

The donor MUI administration remains: revenue/order dashboard, customer lists/editing and segments, product grid/details/create/edit, categories, orders and baskets, invoices, review moderation, mobile list variants, English/French UI and theme selection. Product artwork is twelve bundled original synthetic SVGs; customer avatars use initials. Roboto and Quicksand are bundled. Donor product branding, sign-in/passwords, fake REST/GraphQL servers, telemetry, remote avatars/fonts/media and outgoing services are removed. This App edits fictional shop records and does not process payments, fulfill orders or send mail.

Rich product descriptions retain restricted formatting; arbitrary markup, links and embedded resources are not rendered. Product images are selected from the local artwork catalog, and Room-supplied URLs cannot become network requests. Theme/list preferences use an in-memory react-admin store. Document content is never persisted by an App-local substitute.

## Room model

`src/house.ts` is the single bridge/Runtime boundary and react-admin DataProvider. The exact application pin is `@agentshouse/app-bridge@0.1.0-ce524f6608238`. The boundary awaits `bridge.runtime`, without a direct Runtime import or dependency.

Root `app.json` declares a writable `shop` slot; `schema.yaml` defines six entity types. Scalars are typed fields, nested baskets/segments use JSON strings, and booleans use supported string enums. Each entity is one document. The deterministic offline seed contains 72 fictional records: 4 categories, 12 products, 16 customers, 18 orders, 10 invoices and 12 reviews. `node scripts/seed-data.mjs --room <confirmed-handle>` prints schema/document creation changes and never sends them. Dates are fixed in October 2026 for reproducibility.

The provider supports full react-admin read/mutation contracts, Room-scoped queries, search/filter/sort/pagination, customer order aggregates, relational checks, exact opened field/Markdown bases, bulk grouped saves and stale deletion safeguards. It rejects unknown fields, credential fields, unsupported remote image locations, malformed basket/segment values, duplicate IDs and cross-Room data. Existing drafts and returned conflicts remain intact. Saves are queued, with synchronization, offline, queue, returned-draft, write-halt, storage-loss and connection-refusal observations surfaced separately.

Private Room `shop-port` (`r_19.z`) is owned/admitted. House accepted schema `fr_rq.2.8` and all 72 seed documents. Independent readback confirms schema and all entity counts; the audit report records the full-record comparison. Initial handles containing “admin” were rejected because it is a reserved substring; Master explained the constraint and the corrected handle succeeded. That issue is fixed by Master.


## Build

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run release:check`
- `node scripts/check-release.mjs --self-test`

Final local checks pass: TypeScript, ESLint, all 180 tests in 6 files, the donor build, strict release audit and audit self-tests. The complete artifact is 28 files / 2,997,805 bytes (2.859 MiB), with fourteen local font files and 220 dependency notices. These focused provider/model/UI/transform tests are not the full upstream monorepo regression suite.

The source prebuild copies authoritative manifest/schema and generates dependency notices. The donor build `tsc && vite build` creates a self-contained `dist/`. See `RELEASE_AUDIT.md` and `reports/` for exact final evidence. Browser/hosted Runtime tests are distinct from unit/static checks.

## Remaining gates

No App allocation, publication, Room binding, release branch, remote push, browser screenshot or hosted acceptance has occurred. Master’s live go and direct Runtime client are applied locally. Tasks must publish first, and the platform schema replacement fix remains pending. The current House bridge’s original published MIT grant is bundled; no distribution rights are inferred for the historical unlicensed package.

## Local dependency hardening (2026-10-11)

React Router and react-router-dom are aligned at exact 7.18.2, including react-admin/ra-core/ra-ui-materialui consumers. The upstream advisories cover [external redirect paths](https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6) and [unstable RSC CSRF](https://github.com/remix-run/react-router/security/advisories/GHSA-qwww-vcr4-c8h2). Local route targets remain fixed or ID-validated, and no RSC server is enabled; no port exploit was established. The exact framework-loader AST body/hash is byte-identical across the upgrade, so the existing narrow refusal and all guards remain. The reviewed version alone changes. See `reports/router-hardening-review.json`. Typecheck, lint, all 180 tests, build, strict release/source/network audits, scanner fixtures and license freshness pass. npm pruned an already-extraneous unused yaml package; no declared dependency or feature was removed. Original distributed notices remain exact for the current closure, including the unresolved UNLICENSED bridge. No registry audit, graph upload, remote write, browser or publication occurred.

## JSON Schema migration (2026-10-11)

All 6 types now use the Master-announced top-level JSON Schema properties and required lists, preserving every prior field and enum. Exact IDs/date strings/serialized values retain exact-match classification through unconstrained patterns; human-readable prose stays plain string. The development validator is pinned to @agentshouse/mdmodel 0.1.0-c68e2039f1ca8 independently of unchanged production runtime packages.

Typecheck, lint, 181 tests (including all 72 original fictional seed records), build and release audit pass. Existing conflict handling and queued outcomes are unchanged. Original seed/readback evidence was retained. Remote replacement is pending Porting issues/tasks-schema-replacement.md, the platform schema self-validation refusal; no migration write was attempted here. reports/schema-migration holds the current schema/base and prepared guarded replacement. Re-read before applying after Master resolves that issue. No App allocation or publication occurred, and browser/hosted acceptance remains unrun.

## Current bridge Runtime migration (2026-10-11)

Applied Master’s `20261011T0440Z-master-live-go.md` locally. The only application House dependency is exact `@agentshouse/app-bridge@0.1.0-ce524f6608238`. `src/house.ts` derives its client type from `connectHouseBridge()` and returns `bridge.runtime` unchanged. The existing retry-on-rejection and cached connection remain. No Runtime protocol or client is imported, constructed or copied into application source. The bridge still lists Runtime/model packages transitively for its declarations, so the conservative installed-production-closure notices include their original licenses.

The official package test host now checks missing-host failure, rejected-client failure, retry, deferred delivery, exact client identity, connection reuse and the tab title. All existing concurrency, exact bases, refused/queued save, editor and attachment tests are retained. Current results: typecheck, lint, 183 tests, build, static release/network checks and license checks pass. Release: 28 files / 2,995,001 bytes, 14 local font files. Full check results and immutable release hashes are under `reports/runtime-migration/`.

The newly installed bridge actually declares MIT and includes its own original LICENSE; that text is now distributed verbatim. The old installed bridge gap is closed locally, and license completeness reports no unresolved gap. Original donor, font and supplemental notices remain. Historical gap statements above describe earlier package versions and checks. This does not change a platform issue’s status or establish blanket legal clearance.

No remote schema or document write, App allocation, binding, release branch, push, browser or hosted acceptance was performed. Publication remains in Tasks-first order, with the schema replacement defect pending the platform fix. Existing identity and fidelity limitations are unchanged.

## Opaque-origin sandbox startup fix (2026-10-11)

The hosted donor Admin imported `ra-core` 5.15.4's default preference store before
the App supplied its explicit memory store. That dependency's eager availability
probe read `window.localStorage` outside its try/catch, throwing a SecurityError
in the House sandbox. A version/hash-guarded build adaptation now makes this
unused probe return false. All surrounding dependency code and original notices
remain intact. UI preferences stay in memory; House business records, the donor
UI, app manifest, schema and Room binding are unchanged. No global storage shim,
sandbox flag change, fallback records or new App are involved.

The regression suite demonstrates the original throwing getter failure and
verifies adapted module import, preference updates, notifications, and reload
reset without browser storage. `npm run release:check` now also evaluates the
actual built module with both storage getters throwing, covering missing-host
retry UI and donor-dashboard startup using the official bridge test host. This
local DOM check is distinct from hosted acceptance, which the root task verifies.

Validation for this fix: typecheck, ESLint, all 194 tests in 11 files, production
build, release audit, audit self-tests, built-module startup checks and all 220
dependency notices pass. The dashboard startup check reports zero localStorage
reads, zero uncaught errors and zero direct network calls. Its two optional
React Router sessionStorage probes throw and are safely caught.

## Donor Room images

Product pictures, category covers, and customer portraits support opaque Room
attachment references. The sole House boundary validates the returned Room,
reference, byte count and SHA-256; the lazy renderer verifies raster MIME/signature
and a 10 MiB cap before creating a temporary Blob URL. It never uses a stored
network URL. Missing images have no substitute artwork. The imported local artwork
choices remain available when explicitly selected.

The offline donor fixture maps all 130 products, 13 category covers and 223
customer portraits to Master's existing 379-image Room manifest. See DEMO_DATA.md
for the mandatory reader-first deployment order and read-only exact-base planner.
Local checks do not establish actual installed release activation or browser
acceptance, and the prepared fixture is never used as a live-data fallback.
