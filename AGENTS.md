# Shop admin House port

- Donor: marmelab/react-admin, examples/demo, commit f1213e048d60d83df74900b2fc8415fd3287610c. Preserve its MIT notice and established MUI interface.
- `src/house.ts` is the only House bridge/Runtime boundary. Use current documented exact package pins; no provider URLs, credentials, protocol copies, local content fallback, or Runtime host imports.
- One typed Room document per customer, category, product, order, invoice or review. Read exact opened bases, preserve conflicting drafts, and label save results queued rather than synced.
- All sample data must be fictional. `scripts/seed-data.mjs` prints changes only; production code never seeds or silently creates data.
- App source stays local until explicit publication go. Do not allocate Apps, push, create release branches or change publication unless specifically authorized.
- Complete release is `dist/`, including app.json/schema.yaml, index, bundle, local assets and licenses. Maximum 2,000 files and 20 MiB. No external runtime images/fonts/scripts/styles/API/analytics or service worker.
- Before completion run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run release:check`, and audit self-tests. Read RELEASE_AUDIT.md before changing transformations or allowlists.
- Local tests/static checks do not establish browser or hosted App acceptance. Root owns shared browser; do not launch browser routes here.
