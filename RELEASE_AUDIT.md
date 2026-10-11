# Shop Admin release asset and license audit

This is a local static release audit. It does not establish browser acceptance,
runtime network interception, hosted publication, or end-to-end House behavior.
The additional `npm run test:startup` check evaluates the exact built entry module
in a local Happy DOM/VM with throwing localStorage/sessionStorage getters and
network requests disabled. It covers both missing-host retry UI and the donor
dashboard with an official bridge test host and an empty test provider. It navigates
the eager Products and Create Product routes, preserves exactly three donor tabs,
and verifies typing stages an actual product field in a local Room Draft without
Save, an extra Room query, or network calls. It asserts zero localStorage reads,
uncaught errors and direct network calls. React Router's
optional sessionStorage probes are caught, with attempts reported explicitly;
this test neither provides persistent browser storage nor changes the sandbox.

## Reproduce

From this directory, with the lockfile-pinned packages installed:

```sh
node scripts/check-release.mjs --self-test
npx vitest run tests/release-transform.test.ts tests/external-features-transform.test.ts tests/ui-safety.test.tsx
node scripts/prepare-release.mjs
npm run build
node scripts/check-release.mjs > reports/release-audit.json
node scripts/generate-notices.mjs --check
```

The preparation step copies authoritative root `app.json` and `schema.yaml` into
`public` and generates full dependency notices. The build packages them in `dist`.
The JSON report includes output file/byte counts, SHA-256 for every distributed
file, locally resolved asset references, checked source files and their checksums,
lockfile/build-transform checksums, and licensing gaps.

## Enforced checks

- Root `index.html` entry and byte-identical root manifests.
- At most 2,000 regular release files and 20 MiB total; no symlinks, source maps,
  TypeScript source files, service-worker files, or escaping asset references.
- Every emitted HTML/SVG, JavaScript, and CSS file is inspected. Module imports,
  static dynamic imports, local resource literals, stylesheet imports, CSS URLs,
  fonts, workers, and Vite preload references must resolve within the release.
- Embedded SVG is decoded and scanned; active SVG/event markup, embedded outside-
  capable documents, form actions, and meta refresh redirects are rejected.
- The reachable first-party source import graph is inspected for forbidden demo
  API/service dependencies, network APIs, external URLs, arbitrary dynamic imports,
  and unreviewed dynamic asset sinks, including Material UI's `image` prop.
- Font files, if present, must be referenced locally; system font stacks make no
  external requests and do not require a file.
- The sole permitted browser `fetch` is the exact SHA-256-reviewed Vite module
  preload polyfill, whose local links are separately checked. A modified body or
  extra fetch fails the check. No arbitrary fetch target is allowlisted.
- Inert SVG/XML namespaces, license/schema documentation, React error URLs, and
  bounded React Router URL parsing bases are distinguished from loaded assets.
  An inert data-URI MIME prefix used by the chart serializer is not mistaken for
  a complete resource; complete SVG data URIs are decoded and checked.
  An otherwise harmless URL in a resource-loading sink still fails.

The checker uses conservative AST and asset-closure checks, not a formal proof of
all JavaScript data flow. Positive/negative self-tests exercise direct and aliased
network APIs, computed property access, template URLs, dynamic assets, embedded
SVG, external styles/scripts/fonts, traversal, and the exact preload exception.

## Reviewed local resource boundaries

`src/assets.ts` keeps the twelve explicit bundled synthetic-artwork choices and
maps their logical IDs to imported assets. Missing images produce no fabricated
picture. Donor product images, category covers, and customer avatars use opaque
`at_` Room references, never a stored arbitrary URL. `src/house.ts` is the only
Runtime boundary: its documented `attachments/get` call verifies the selected
Room, returned reference, exact metadata shape, Blob size, and SHA-256. It checks
that the binding is still available after asynchronous reads. New image references
are checked against the selected Room’s locally declared `attachments` metadata
before a document save is queued. Runtime `rooms()` is a local detached snapshot,
not a network read (installed Runtime AGENTS.md lines 45–53). Save never calls an
attachment Action or fetches bytes. Unknown references are refused locally with
their drafts preserved; visible image reads separately verify Blob bytes and hash.

`src/RoomImage.tsx` only requests attachment bytes when its element approaches the
viewport (IntersectionObserver; bounded immediate fallback where unsupported).
The img retains `loading="lazy"` and `decoding="async"`. A Blob must have a
supported raster MIME type, matching signature, and size no greater than 10 MiB.
SVG/HTML attachment previews are rejected. Only verified Blob object URLs or
reviewed imported assets can reach img src. Stale responses are discarded and
object URLs are revoked on cleanup. Missing bytes never trigger a network URL
fallback. The release checker pins both complete source boundaries by SHA-256,
limits the dynamic image-src exception to the pinned RoomImage file and its source
variable, and tests altered helpers and unreviewed paths negatively. Room image
mapping is offline migration/demo input and is never imported by production code.

The editor is formatting-only. `src/safeRichText.ts` uses an inert HTML template
and rebuilds a small formatting-tag allowlist without any attributes; resource,
script, style, SVG, and embedded-document elements are discarded. The input's
format/parse and pasted-HTML hooks apply this sanitizer; image/link extensions and
external-link controls are disabled. Both boundary modules are checksum-pinned.
This is also exercised by local tests for malicious URLs/markup, formatting
preservation, idempotence, and inert text. Donor chart options use numeric/date
order data and fixed labels; they do not accept image/URL options from Room data.

## Narrow dependency adaptations

No House bridge or Runtime protocol source is patched. Build-time transforms
replace only the following exact reviewed optional features, validating the
installed version, AST-node SHA-256, and a single node/module match:

- React Router 7.18.2: unused framework/SSR `loadRouteModule` is an explicit refusal,
  removing arbitrary `import(route.module)` while local client routing remains.
- `ra-core` 5.15.4: the eagerly executed browser-storage availability probe becomes
  `() => false`. The dependency default store remains memory-only even when its
  module is imported before the App supplies its explicit `memoryStore`. This
  avoids reading a forbidden storage getter in an opaque-origin House sandbox.
  No global storage shim, sandbox change, or document-data fallback is added.
- `ra-core` 5.15.4: telemetry `useEffect` becomes an inert hook with the same
  dependency array. The donor's `disableTelemetry` also remains enabled.
- `@tiptap/extension-link` 3.31.4: only `window.open` in the reviewed click helper
  becomes a refusal. Editor click-selection and all surrounding code remain.
- ECharts 6.1.0: the optional `windowOpen` helper becomes an external-navigation
  refusal. The local chart renderer, data, hover, and interaction code remain.

Tests verify exact surrounding-source preservation and reject version drift,
changed reviewed source, missing features, and duplicate matches. Upstream
copyright/license/notice texts remain in the release.

## Licensing and provenance

The donor is `marmelab/react-admin`, `examples/demo`, at commit
`f1213e048d60d83df74900b2fc8415fd3287610c`, under MIT. The original license is copied
unchanged and checksum-verified. The Material UI Shop UI remains donor-derived.
Dependency notices are generated from the installed production closure, a superset
of the modules actually emitted. Full distributed notices and declared identifiers
are preserved, including separate local font notices. Development-only build/test
packages are excluded. The generator fails for an unaccounted missing license text
or undeclared license rather than manufacturing an MIT grant.

The current `@agentshouse/app-bridge@0.1.0-ce524f6608238` declares MIT and ships
its original LICENSE, now preserved verbatim. The former missing-grant exception
is removed, so any missing grant fails generation. This resolves the old installed
bridge gap, without a blanket legal-clearance claim or platform issue status change.
