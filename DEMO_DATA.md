# Reused React Admin retail demo data

This replaces the earlier hand-authored demo as the source for new Room population under the user-adopted Master1150 rule. The old `scripts/seed-data.mjs` remains only as historical fixture/reproducibility evidence and for pre-existing provider regression tests; do not use it to populate new demos. The complete donor dataset has 2,005 schema-compatible records. Prior Room records were initially retained for preservation. Following the owner’s specific confirmation, the 72 unchanged generated originals were removed with fresh revision guards; the current Room contains only the 2,005 donor documents.

## Reproduction

From this checkout, run `npm ci --prefix scripts/donor-demo --ignore-scripts --no-audit --no-fund`, then `TZ=UTC node scripts/donor-demo/generate.mjs`. The isolated dependency lock pins the exact generator dependencies; the application dependency closure is unchanged. Node 24.19.0 was used. The source snapshot under `scripts/donor-demo/upstream/` is byte-for-byte upstream source at the commit in `provenance.json`; every source file, output and dependency lock has a SHA-256 hash. The donor license and generator dependency notice are retained in `public/licenses/donor-demo-NOTICE.txt` and the source tree.

The reference clock is fixed at 2026-10-11T12:00:00.000Z, UTC; RNG seed is 1150. Date freezing and seed initialization are the only generator controls. No donor record-count parameters are reduced. Run `node scripts/donor-seed-data.mjs --room shop-port` to print a proposed changeset; it performs no network calls and must not be blindly applied to an existing Room because the schema and any existing IDs need fresh exact bases.

## Adaptation boundary

Identifiers and all relationship identifiers receive `donor-` prefixes, preserving exact cross-resource links. Primitive booleans and complex values use the existing App schema serialization. Null optional fields are omitted. Carriage returns in the donor's paragraph separator are removed, retaining newlines, because House's accepted YAML subset refuses the `\r` escape. Generated source text is otherwise retained. No fixture is imported into application source or embedded as a live-data fallback. The production UI reads actual Room documents.

All 13 categories, 130 products, 900 customers, 600 orders, 77 invoices and 285 reviews are retained. Donor server/email settings are not an App resource and are excluded. The donor generator deliberately emits invoices for a subset of orders; no invoices are fabricated. The 379-image manifest supplied by Master maps official Marmelab posters filenames to attachments in the existing Shop Room. The seeded donor generator maps all 130 product images/thumbnails, 13 category covers, and 223 donor customer avatars to those references. The other 677 customers have no donor avatar and retain initials. Every other record field and all IDs are unchanged. Production image reads use the documented Room attachment Runtime route; no external poster host is fetched and no substitute image is shown.

## Validation and Room evidence

`tests/donor-demo.test.ts` checks pinned source/output hashes, every entity count, safe IDs, every relationship, opaque attachment references and all records against the current House JSON Schema. Existing provider regression tests remain. Population uses bounded 50-record batches below 90 KB, with readback split below the House shell 32 KB cap and exact content comparison. `reports/donor-demo/room-population-initial.json` preserves the original full-body population readback and preservation evidence. `reports/donor-demo/room-verification.json` records the current donor-only totals, guarded-removal manifest and post-removal path/relationship readback.

## Initial Room population (historical)

The initial population readback on 2026-10-11 verified 2,005 adapted donor records and preserved all 72 prior records byte-for-byte, for 2,077 documents in `shop-port` (`r_19.z`). The current schema remains `fr_rq.3.3`. Every donor document exactly matched its prepared source after the write, and all foreign-key, order-basket, invoice and review relationships are covered by the fixture tests. No documents were removed in that initial population step. The then-retained legacy rows were not represented as donor-derived; they have since been removed as described below.

## Current donor-only Room

After the owner explicitly confirmed removal even without a documented history-recovery path, all 72 unchanged generated original documents were removed in one revision-guarded `edit/remove` batch. Each target’s exact body was compared with the preservation manifest before and after inspecting its current revision. Changed or unrelated material was not targeted, and no history-purge command was used.

The post-removal check independently read every expected donor path and all type/ID/reference/array-reference fields, matching the source-validated relationship graph. The complete entity-file count equals those 2,005 expected donor paths, proving zero additional legacy documents remain. This is a relationship/path readback, not a second full-body comparison; the earlier full-body donor readback remains preserved separately. Source fixtures, schema, runtime and license notices are unchanged by this cleanup.

## Reader-first image rollout

The source image change prepares a new compatible reader and adds optional
`shop_customer.avatar` and `shop_category.image` string fields. Do not write Room
image fields while the prior strict image reader is still installed. First
publish and verify activation of this compatible reader, then update the Room
schema with its exact fresh revision, then apply the planned image-only fields
in bounded exact-base batches and read each field back. Publishing alone does
not prove the installed browser activated a release.

`node scripts/plan-donor-images.mjs --output /path/plan.json` performs only fresh
Room reads. It plans 496 field changes across 366 existing documents, refuses
changed artwork, verifies type/ID, and retains exact old field values as bases.
It never writes a schema or any Room data. All 2,005 original donor document IDs
and every non-image field are retained. The plan must be regenerated before an
authorized rollout if data changed. The fixture output hash and attachment-map
hash are recorded in `scripts/donor-demo/provenance.json`.
