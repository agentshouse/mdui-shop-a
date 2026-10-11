# Shop donor attachment integration

Prepared 2026-10-11 for the existing dev Shop App and Room only.

- Donor source: React Admin f1213e048d60d83df74900b2fc8415fd3287610c.
- Official image source: Marmelab posters 143ffbf4772146f9ab6131bfdfe090bdc36c1218, using Master's existing 379-reference Room manifest.
- Source fixture: 2,005 documents retained, with 496 image fields changed across 366 documents: 130 product images/thumbnails, 13 category covers, 223 customer avatars. Every non-image fixture value and ID is unchanged.
- `npm run typecheck`, `npm run lint`, all 227 tests, `npm run build`, `npm run release:check`, startup probes, and audit self-tests pass in this image worktree.
- The full release report is `release-audit.json`. The source image helper has its own SHA-256-pinned dynamic-resource boundary and negative audit fixtures.
- Runtime attachment reads are scoped to the selected Room, verify reference/metadata/byte length/SHA-256, and reject non-Blob bytes. Rendering is viewport-triggered and raster-only with lazy image elements. No external image fetch or missing-image artwork is used.
- No App publication, Room schema update, or live image-field mutation was performed by this worktree. Browser acceptance and installed reader activation remain unverified due to the already reported stale-installed-release/authentication blocker.
- Required rollout: merge and publish compatible reader; verify actual installed activation; update Room schema using fresh exact revision; regenerate the read-only field plan; apply bounded exact-base batches; verify all changed fields and 2,005 retained documents. Never update live data while the old strict reader remains active.
