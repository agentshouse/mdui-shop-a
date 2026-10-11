# Local replica navigation slice

Master1415/1420: retain the donor SPA and renderer while deriving every page from the continuously observed House replica.

The host waits for first sync and the first typed document snapshot once. A synchronous QueryCache projection seeds donor React Query observers when they are created, before their first result; list, record, reference and infinite-list pages use the same local snapshot. Later House observations update derived queries directly. No route starts another Runtime query, a REST request, or a page-code download. The derived projection is not an independent content store; Save preparation clones it so refused changes cannot mutate the displayed replica.

All App code is in the initial JS asset. Internal navigation retains the donor client router. Explicit attachment downloads and lazy visible images remain separate. Provider service-mode write-halted pauses uploads, not local Save; Action uploads still honor provider refusal.

Tests cover synchronous first query results, no query function/runtime-query invocation during navigation, observed updates, and unchanged projection after refused Save. Full type/lint/test/build/release audits must pass at the final source commit. Hosted acceptance remains pending actual installed-release activation.

This slice does not yet complete per-keystroke business-field RoomDraft integration. Existing submit-time drafts, first bases and refusal preservation remain; durable typing is the next bounded adaptation.
