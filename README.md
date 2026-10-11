# Shop A

A local-first shop administration App for products, categories, customers, orders and invoices stored in a House Room. Edits use native drafts and explicit saves. No live payment, email or fulfillment service is connected.

## Build and publish

Use Node.js 24.21 or later and `npm ci`. Run `npm run verify` for type checking, lint, regression tests, build, release and startup checks. `npm run publish` requires a clean committed `main` branch and a House App HTTPS `origin`; it verifies the exact source, then atomically publishes source and a parentless release.

`starter/` contains one existing category, product and fictional customer. Image fields are omitted because Template starters are text-only. Missing media uses a plain placeholder. Both Shop siblings share the same schema and starter documents.

License texts and required attribution are retained in the repository and generated release notices.
