# Shop A

A local-first shop administration App for products, categories, customers, orders and invoices stored in a House Room. Edits use native drafts and explicit saves. No live payment, email or fulfillment service is connected.

## Build and publish

Use Node.js 24.21 or later and `npm ci`. Run `npm run verify` for type checking, lint, regression tests, build, release and startup checks. `npm run publish` requires a clean committed `main` branch and a House App HTTPS `origin`; it verifies the exact source, then atomically publishes source and a parentless release.

`starter/` contains one existing category, product and fictional customer. Image fields are omitted because Template starters are text-only. Missing media uses a plain placeholder. Both Shop siblings share the same schema and starter documents.

License texts and required attribution are retained in the repository and generated release notices.

## Portable publisher safety

The publisher accepts credential-free HTTPS House App remotes on any host, including
`https://<host>/app/new.git` for creation. Choose only a host and App you are authorized
to publish to. Host portability does not authorize publication to another environment.
For initial creation, use `npm run publish -- --name "<display name>"`; `--name` is
optional and no default display name is invented. The helper reports only complete,
explicitly returned App/Git receipt URLs and never changes `origin`. After creation,
inspect the returned canonical App in House and set its actual Git URL as `origin`
before another publication. Never retry an uncertain creation blindly.

`npm run test:publisher` runs offline local-Git regression fixtures with mocked
push/remote transport; it installs no packages and does not contact House. These
checks are included in `npm run verify` before the existing App-specific gates.
Publication requires clean committed `main`, runs exactly that full verify gate,
pins the source SHA, and atomically pushes source `main` plus a parentless dist-only
`release`. It preserves the normal index and source branch, rejects unsafe origin
rewrites, index flags, metadata mismatches, and conflicting publisher/worktree locks.
It never commits source, resets work, or substitutes a build-only verification.

Failure diagnostics suppress arbitrary subprocess output to avoid leaking credentials.
Run `npm run verify` locally for full compiler/test output; never share credential
values or verbose HTTP traces. A reported creation receipt or advertised source SHA
does not prove release admission: inspect the known App's published revision in House.
After a failed or uncertain push, inspect that state before deciding whether to retry.
