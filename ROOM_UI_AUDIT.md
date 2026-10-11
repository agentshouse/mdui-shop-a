# Master 12:25 donor chrome audit

Instruction: Porting `messages/20261011T1225Z-master-crm-room-label.md`, 2026-10-11. Donor `marmelab/react-admin` at `f1213e048d60d83df74900b2fc8415fd3287610c`, `examples/demo/src/layout/AppBar.tsx` and its toolbar/layout, has no generic Room/sync/queue strip. Core React Admin offline/error behavior is separate and unchanged.

Removed the port-added status header and Room-switch dialog. Exactly one host binding is used; multiple Rooms show a configuration error and no Shop app, rather than guessing first. True refusal/errors, returned drafts, sync-reset, storage-loss and write-halt warnings remain. No manifest/schema, data, provider, permission or binding changes.

Typecheck, lint, all 187 tests across 10 files, build and release:check pass. DOM tests cover absent storage/sync instrumentation, ambiguous-binding refusal/recovery, observer isolation and preserved notices. Isolated worktree builds required a local copy of installed dependencies for existing exact-path security transforms; no transform, dependency pin or security rule was changed. Hosted browser acceptance remains separate.
